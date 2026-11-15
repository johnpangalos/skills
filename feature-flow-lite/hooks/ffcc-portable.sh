# feature-flow-lite check cache: the platform's tools, chosen once. Sourced by
# ffcc.sh. Works in macOS's /bin/bash 3.2: no mapfile, no EPOCHREALTIME. Linux
# uses util-linux and coreutils; macOS uses perl (shipped with it), shasum and
# BSD stat.

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

# ff_now: seconds with fractions
case $(date +%N 2>/dev/null) in
  *[!0-9]* | '')
    ff_now() { perl -MTime::HiRes=time -e 'printf "%.3f\n", time'; }
    ;;
  *)
    ff_now() { date +%s.%N; }
    ;;
esac
