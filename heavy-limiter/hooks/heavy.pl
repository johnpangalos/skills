#!/usr/bin/perl
# heavy-limiter: runs one heavy command once the machine has room for it.
#
#   perl heavy.pl --dir <pool> --kind <kind> --key <key> --cores <n> --mem <MB>
#                 [--min-cores <n>] [--hint <spec>] [--notes <file>]
#                 [--budget-cores <n>] [--budget-mem <MB>] -- <command...>
#   perl heavy.pl --dir <pool> --status [same weight and budget options]
#
# Every session, terminal and worktree on the machine shares one pool: a folder
# with a file per command that is waiting or running. Each command has a weight,
# cores and peak memory, and starts when the free budget covers it: all of its
# memory, and at least --min-cores cores. Waiters start in order (an agent's
# command ahead of speculative work, then first come), and one that doesn't fit
# holds the ones behind it, so a big command is never starved. A command alone
# on the machine always starts, whatever its weight.
#
# Liveness is a lock: each participant holds flock(2) on its own file for as long
# as it lives, so a file whose lock can be taken belongs to a process that's gone
# (killed, crashed) and is removed. No pids are compared, so pid reuse and
# sandboxes that hide other processes don't matter.
#
# A command that took fewer cores than it asked for gets a hint to use that many
# (--hint env:NAME, append:FLAG= or after:<i>:FLAG=, see hint()). Each pass is
# recorded with its duration and peak memory (the sum over the command's
# processes, sampled with ps where ps may run), and the next run of the same
# command in the same repo is weighed by that record.
#
# CLAUDE_HEAVY_SLOT=1 marks a command already holding a slot: one nested under it
# runs at once. FF_CACHE_BG=1 (feature-flow-lite's queued checks) or
# CLAUDE_HEAVY_LOW=1 marks speculative work: it waits behind agents' commands and
# runs at the lowest priority.
use strict;
use warnings;
use Fcntl qw(:flock O_RDWR O_CREAT);
use POSIX qw(WNOHANG);
use Time::HiRes qw(time sleep);

my @FIELDS = qw(state prio arrival want min mem kind key cwd pid est started alloc);
my %o = (cores => 1, mem => 1024, kind => 'command', key => '');
my @cmd;
while (@ARGV) {
  my $a = shift @ARGV;
  if ($a eq '--') { @cmd = @ARGV; last }
  elsif ($a eq '--status') { $o{status} = 1 }
  elsif ($a =~ /^--([a-z-]+)$/ && @ARGV) { $o{$1} = shift @ARGV }
  else { die "heavy.pl: unknown argument $a\n" }
}
die "heavy.pl: no command\n" if !@cmd && !$o{status};
run_now() if $ENV{CLAUDE_HEAVY_SLOT} && !$o{status};

my $dir = $o{dir};
my $pdir = defined $dir ? "$dir/p" : '';
if (defined $dir && !-d $pdir) { mkdir $dir, 0700; mkdir $pdir }
# no pool to share (no folder, or one this process can't write): no limit
unless ($pdir ne '' && -d $pdir && -w $pdir) {
  if ($o{status}) { print "0\t0\n"; exit 0 }
  run_now();
}

my $low = ($ENV{FF_CACHE_BG} // '') eq '1' || ($ENV{CLAUDE_HEAVY_LOW} // '') eq '1';
my ($bcores, $bmem) = budget();
my $repo = repo();
my ($last_secs, $last_peak) = last_record($repo, $o{key});
my $mem = defined $last_peak ? int($last_peak * 1.25) : $o{mem};
my $want = int($o{cores}) || 1;
my $min = $o{'min-cores'} // $want;
$min = $want if $min > $want;

if ($o{status}) {
  my ($ahead, $wait) = status();
  print "$ahead\t$wait\n";
  exit 0;
}

# --- join the pool
# Locked under a hidden name first, then renamed in: a file others can see is
# always locked while its owner lives.
my $id = sprintf '%d-%.6f', $$, time;
my $mine = "$pdir/$id";
sysopen(my $me, "$pdir/.$id", O_RDWR | O_CREAT) or run_now();
flock($me, LOCK_EX) or run_now();
rename("$pdir/.$id", $mine) or run_now();
my $joined = time;
# Stored as written, so every participant orders the waiters the same way; ties
# (commands started together) go by id, which is unique. CLAUDE_HEAVY_TEST_ARRIVAL
# forces a tie in the tests.
my $arrival = $ENV{CLAUDE_HEAVY_TEST_ARRIVAL} // sprintf('%.6f', $joined);
my %self = (
  state => 'wait', prio => $low ? 1 : 0, arrival => $arrival, want => $want, min => $min, mem => $mem,
  kind => $o{kind}, key => $o{key}, cwd => cwd_short(), pid => $$, est => $last_secs // '', started => '', alloc => 0,
);
$self{id} = $id;
my $done = 0;
sub leave { return if $done++; unlink $mine; close $me }
for my $sig (qw(INT TERM HUP)) { $SIG{$sig} = sub { leave(); exit 128 + ($sig eq 'INT' ? 2 : $sig eq 'HUP' ? 1 : 15) } }
END { leave() if defined $me }
with_pool(sub { write_self() });

# --- wait for room
my ($alloc, $contended);
my $said = 0;
my $first_ahead;
while (1) {
  my ($granted, $a, $c, $ahead, $wait, $what) = with_pool(\&try);
  if ($granted) { ($alloc, $contended) = ($a, $c); last }
  $first_ahead //= $ahead;
  my $now = time;
  if ($now - $said >= 30) {
    my $left = $wait > 0 ? ', ~' . human($wait) . ' left' : '';
    print STDERR "heavy-limiter: waiting for a slot: $ahead ahead ($what$left)\n";
    $said = $now;
  }
  sleep 0.5;
}
my $waited = time - $joined;

# --- run it
$ENV{CLAUDE_HEAVY_SLOT} = 1;
my @run = @cmd;
@run = hint($o{hint}, $alloc, @run) if defined $o{hint} && $alloc < $bcores && $contended;
my $started = time;
my $pid = fork() // do { leave(); exec { $cmd[0] } @cmd; exit 127 };
if ($pid == 0) {
  setpriority(0, 0, 19) if $low;
  exec { $run[0] } @run or do { print STDERR "heavy-limiter: $run[0]: $!\n"; POSIX::_exit(127) };
}
for my $sig (qw(INT TERM HUP)) { $SIG{$sig} = sub { kill $sig, $pid } }
my ($peak, $next_sample) = (undef, 0);
my $status;
while (1) {
  my $r = waitpid($pid, WNOHANG);
  if ($r == $pid) { $status = $?; last }
  if ($r < 0) { $status = 255 << 8; last }
  if (time >= $next_sample) {
    my $rss = tree_rss($pid);
    $peak = $rss if defined $rss && (!defined $peak || $rss > $peak);
    $next_sample = time + 2;
  }
  sleep 0.25;
}
my $secs = time - $started;
leave();
my $code = $status & 127 ? 128 + ($status & 127) : $status >> 8;
record($repo, $o{key}, $secs, $peak) if $code == 0;
if (defined $o{notes} && $waited >= 1) {
  if (open(my $n, '>>', $o{notes})) {
    printf $n "waited\t%s\t%.0f\t%d\t%d\n", $o{key}, $waited, $first_ahead // 0, $alloc;
    close $n;
  }
}
exit $code;

# ---------------------------------------------------------------------------

sub run_now { exec { $cmd[0] } @cmd; exit 127 }

# Runs $fn holding the pool's lock.
sub with_pool {
  my ($fn) = @_;
  open(my $l, '>>', "$dir/lock") or return $fn->();
  flock($l, LOCK_EX);
  my @r = $fn->();
  close $l;
  return wantarray ? @r : $r[0];
}

sub write_self {
  open(my $w, '>', $mine) or return;
  print $w join("\t", map { $self{$_} // '' } @FIELDS), "\n";
  close $w;
}

# Every live participant but this one; the files of dead ones are removed.
sub others {
  my @out;
  opendir(my $d, $pdir) or return ();
  for my $f (readdir $d) {
    next if $f =~ /^\./ || (defined $id && $f eq $id);
    my $path = "$pdir/$f";
    open(my $h, '<', $path) or next;
    if (flock($h, LOCK_EX | LOCK_NB)) { unlink $path; close $h; next }
    my $line = <$h> // '';
    close $h;
    chomp $line;
    my %p;
    @p{@FIELDS} = split /\t/, $line, -1;
    next unless defined $p{state} && $p{state} ne '';
    $p{id} = $f;
    push @out, \%p;
  }
  return @out;
}

# Under the pool lock: whether this command starts now, and if not, what it waits on.
sub try {
  my @all = others();
  my @running = grep { $_->{state} eq 'run' } @all;
  my @waiting = sort { $a->{prio} <=> $b->{prio} || $a->{arrival} <=> $b->{arrival} || $a->{id} cmp $b->{id} } (grep({ $_->{state} eq 'wait' } @all), \%self);
  my ($free_c, $free_m) = ($bcores, $bmem);
  for (@running) { $free_c -= $_->{alloc}; $free_m -= $_->{mem} }
  my $busy = @running > 0;
  my $ahead = @running;
  for my $w (@waiting) {
    my $m = $w->{mem} < $bmem ? $w->{mem} : $bmem;
    my $mc = $w->{min} < $bcores ? $w->{min} : $bcores;
    last unless !$busy || ($free_m >= $m && $free_c >= $mc);
    my $a = $busy ? ($w->{want} < $free_c ? $w->{want} : $free_c) : ($w->{want} < $bcores ? $w->{want} : $bcores);
    $a = $mc if $a < $mc;
    if ($w == \%self) {
      @self{qw(state alloc started)} = ('run', $a, time);
      write_self();
      return (1, $a, scalar(@all) > 0);
    }
    $free_c -= $a;
    $free_m -= $m;
    $busy = 1;
  }
  for my $w (@waiting) { last if $w == \%self; $ahead++ }
  # what it waits on: the running command expected to finish first
  my ($wait, $what) = (0, 'behind other waiting commands');
  my $best;
  for my $r (@running) {
    my $left = $r->{est} ne '' ? $r->{est} - (time - $r->{started}) : undef;
    $left = 5 if defined $left && $left < 5;
    if (!$best || (defined $left && (!defined $best->[0] || $left < $best->[0]))) { $best = [$left, $r] }
  }
  ($wait, $what) = ($best->[0] // 0, "$best->[1]{kind} in $best->[1]{cwd}") if $best;
  return (0, 0, 1, $ahead, $wait, $what);
}

# Rough expected wait for a command that would join now: 0 when it would start at once.
sub status {
  my @all = with_pool(\&others);
  my @running = grep { $_->{state} eq 'run' } @all;
  my @waiting = grep { $_->{state} eq 'wait' && ($_->{prio} <= ($low ? 1 : 0)) } @all;
  my ($free_c, $free_m) = ($bcores, $bmem);
  for (@running) { $free_c -= $_->{alloc}; $free_m -= $_->{mem} }
  my $m = $mem < $bmem ? $mem : $bmem;
  my $mc = $min < $bcores ? $min : $bcores;
  return (0, 0) if !@waiting && (!@running || ($free_m >= $m && $free_c >= $mc));
  my $wait = 0;
  for my $r (@running) {
    my $left = ($r->{est} ne '' ? $r->{est} : 60) - (time - $r->{started});
    $left = 5 if $left < 5;
    $wait = $left if $wait == 0 || $left < $wait;
  }
  $wait += $_->{est} ne '' ? $_->{est} : 60 for @waiting;
  return (@running + @waiting, int $wait);
}

# The budget: --budget-* (the mod passes them), else CLAUDE_HEAVY_CORES and
# CLAUDE_HEAVY_MEM_MB, else the machine less headroom for the sessions themselves.
sub budget {
  my $c = $o{'budget-cores'} // $ENV{CLAUDE_HEAVY_CORES};
  my $m = $o{'budget-mem'} // $ENV{CLAUDE_HEAVY_MEM_MB};
  if (!$c) {
    $c = `getconf _NPROCESSORS_ONLN 2>/dev/null` || `sysctl -n hw.ncpu 2>/dev/null` || 2;
    chomp $c;
  }
  if (!$m) {
    my $total;
    if (open(my $mi, '<', '/proc/meminfo')) {
      while (<$mi>) { if (/^MemTotal:\s+(\d+)/) { $total = $1 / 1024; last } }
    } else {
      my $b = `sysctl -n hw.memsize 2>/dev/null`;
      $total = $b / 1048576 if $b && $b =~ /^\d+/;
    }
    $total //= 8192;
    my $head = $total * 0.2 > 4096 ? $total * 0.2 : 4096;
    $m = $total - $head > 1024 ? $total - $head : 1024;
  }
  return (int($c) || 1, int $m);
}

sub repo {
  my $top = `git rev-parse --show-toplevel 2>/dev/null`;
  chomp $top;
  return $top ne '' ? $top : cwd_real();
}

sub cwd_real { my $p = `pwd -P`; chomp $p; $p }

sub cwd_short {
  my $p = cwd_real();
  my $home = $ENV{HOME} // '';
  $p =~ s/^\Q$home\E(?=\/|$)/~/ if $home ne '';
  return $p;
}

# The last pass of this command in this repo: (seconds, peak MB or undef).
sub last_record {
  my ($repo, $key) = @_;
  open(my $r, '<', "$dir/record.tsv") or return;
  my @hit;
  while (<$r>) {
    chomp;
    my ($when, $rp, $k, $s, $p) = split /\t/, $_, -1;
    @hit = ($s, (defined $p && $p ne '' ? $p : undef)) if defined $k && $rp eq $repo && $k eq $key;
  }
  return @hit;
}

sub record {
  my ($repo, $key, $secs, $peak) = @_;
  open(my $r, '>>', "$dir/record.tsv") or return;
  printf $r "%d\t%s\t%s\t%.1f\t%s\n", time, $repo, $key, $secs, defined $peak ? int($peak) : '';
  close $r;
}

# Resident memory (MB) of a process and all its descendants, or undef where ps
# can't run (macOS's sandbox refuses it).
my $ps_ok;
sub tree_rss {
  my ($root) = @_;
  $ps_ok //= system('ps -p $$ -o pid= >/dev/null 2>&1') == 0;
  return unless $ps_ok;
  open(my $ps, '-|', 'ps', '-A', '-o', 'pid=,ppid=,rss=') or return;
  my (%kids, %rss);
  while (<$ps>) {
    my ($p, $pp, $r) = split ' ';
    next unless defined $r;
    push @{ $kids{$pp} }, $p;
    $rss{$p} = $r;
  }
  close $ps or return;
  return unless exists $rss{$root};
  my ($sum, @todo) = (0, $root);
  while (defined(my $p = shift @todo)) { $sum += $rss{$p} // 0; push @todo, @{ $kids{$p} // [] } }
  return $sum / 1024;
}

# Tells the command how many cores it got:
#   env:NAME            sets NAME=<n> unless already set (CARGO_BUILD_JOBS)
#   append:FLAG=        adds FLAG=<n> at the end unless an argument starts with FLAG
#   after:<i>:FLAG=     inserts FLAG=<n> after argument <i> (go test -p=<n>)
sub hint {
  my ($spec, $n, @argv) = @_;
  if ($spec =~ /^env:(\w+)$/) {
    $ENV{$1} //= $n;
  } elsif ($spec =~ /^append:(.+)$/) {
    my $flag = $1;
    (my $name = $flag) =~ s/=$//;
    push @argv, "$flag$n" unless grep { index($_, $name) == 0 } @argv;
  } elsif ($spec =~ /^after:(\d+):(.+)$/) {
    my ($i, $flag) = ($1, $2);
    (my $name = $flag) =~ s/=$//;
    splice @argv, $i + 1, 0, "$flag$n" unless grep { index($_, $name) == 0 } @argv;
  }
  return @argv;
}

sub human { my $s = shift; $s < 90 ? sprintf('%ds', $s) : sprintf('%d min', ($s + 30) / 60) }
