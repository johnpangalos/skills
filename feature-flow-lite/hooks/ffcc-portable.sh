# feature-flow-lite check cache: the platform's tools, chosen once. Sourced by
# ffcc.sh and ffcc-queue.sh. Works in macOS's /bin/bash 3.2: no mapfile, no
# EPOCHREALTIME. Linux uses util-linux and coreutils; macOS uses perl (shipped
# with it), shasum, BSD stat and taskpolicy.

# ff_lock <fd> nb|wait <seconds>|un: flock(2) on an open fd. The lock belongs to
# the open file, so taking it in a child (flock(1) or perl) holds it for this
# shell until the fd is closed or unlocked.
if command -v flock >/dev/null 2>&1; then
  ff_lock() {
    case $2 in
      nb) flock -n "$1" ;;
      wait) flock -w "$3" "$1" ;;
      un) flock -u "$1" ;;
    esac
  }
else
  ff_lock() {
    perl -MFcntl=:flock -e '
      my ($fd, $mode, $secs) = @ARGV;
      open(my $fh, ">&=", $fd) or exit 2;
      exit(flock($fh, LOCK_UN) ? 0 : 1) if $mode eq "un";
      exit(flock($fh, LOCK_EX | LOCK_NB) ? 0 : 1) if $mode eq "nb";
      local $SIG{ALRM} = sub { exit 1 };
      alarm $secs;
      exit(flock($fh, LOCK_EX) ? 0 : 1);
    ' -- "$@"
  }
fi

# "${ff_setsid[@]}" <command...> &: run it as the leader of a new session and
# process group, so one kill of -$! stops it and everything it started. An array,
# not a function: a function run with & forks a subshell first, and $! would be
# the subshell's pid rather than the group's.
if command -v setsid >/dev/null 2>&1; then
  ff_setsid=(setsid)
else
  ff_setsid=(perl -MPOSIX -e 'POSIX::setsid(); exec { $ARGV[0] } @ARGV or exit 127' --)
fi

if command -v sha256sum >/dev/null 2>&1; then
  ff_sha() { sha256sum; }
else
  ff_sha() { shasum -a 256; }
fi

# ff_stat <path>: "<size> <mtime>", following links
if stat --version >/dev/null 2>&1; then
  ff_stat() { stat -L -c '%s %Y' "$1"; }
  ff_mtime() { stat -L -c '%Y' "$1"; }
else
  ff_stat() { stat -L -f '%z %m' "$1"; }
  ff_mtime() { stat -L -f '%m' "$1"; }
fi

# ff_now: seconds with fractions; ff_nanos: an integer that grows with time
case $(date +%N 2>/dev/null) in
  *[!0-9]* | '')
    ff_now() { perl -MTime::HiRes=time -e 'printf "%.3f\n", time'; }
    ff_nanos() { perl -MTime::HiRes=time -e 'printf "%d\n", time * 1e9'; }
    ;;
  *)
    ff_now() { date +%s.%N; }
    ff_nanos() { date +%s%N; }
    ;;
esac

# ff_timeout <seconds> <command...>: TERM the command when it runs too long
# (status 124, as coreutils' timeout)
if command -v timeout >/dev/null 2>&1; then
  ff_timeout() { timeout "$@"; }
else
  ff_timeout() {
    perl -e '
      my $secs = shift;
      my $pid = fork() // exit 125;
      if ($pid == 0) { exec { $ARGV[0] } @ARGV or exit 127 }
      my $timed = 0;
      $SIG{ALRM} = sub { $timed = 1; kill "TERM", $pid };
      $SIG{TERM} = sub { kill "TERM", $pid };
      alarm $secs;
      waitpid($pid, 0);
      exit 124 if $timed;
      exit($? & 127 ? 128 + ($? & 127) : $? >> 8);
    ' -- "$@"
  }
fi

# ff_lowprio: the prefix that runs a command at the lowest CPU and IO priority.
# Where setpriority is refused (a sandbox), nice warns and runs the command
# anyway; ionice and taskpolicy fail instead, so they're used only if they work.
ff_lowprio=(nice -n 19)
if command -v ionice >/dev/null 2>&1 && ionice -c3 true 2>/dev/null; then
  ff_lowprio+=(ionice -c3)
elif command -v taskpolicy >/dev/null 2>&1 && taskpolicy -b true 2>/dev/null; then
  ff_lowprio+=(taskpolicy -b)
fi
