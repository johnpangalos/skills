#!/bin/bash
# probe.sh <build dir>: prints "pass/total failing..."
set -u
d=$(mktemp -d); cp -r "$1"/. "$d"
cache="${FF_EVALS_CACHE:-$HOME/.cache/ff-evals}/fd.target"
[ -d "$cache" ] && [ ! -d "$d/target" ] && cp -r "$cache" "$d/target"
(cd "$d" && cargo build -q 2>/dev/null)
fd="$d/target/debug/fd"
t=$(mktemp -d); mkdir -p "$t/a/b"; touch "$t/a/foo" "$t/a/b/foo.txt" "$t/bar"
pass=0; total=0; fails=""
check() { total=$((total+1)); if eval "$2"; then pass=$((pass+1)); else fails="$fails $1"; fi; }
check completion_mentions_count "grep -q -- '--count' '$d/contrib/completion/_fd'"
check exec_conflict_usage_error "cd '$t' && '$fd' --count --exec echo x >/dev/null 2>'$t/err'; [ \$? -eq 2 ] && grep -qi 'cannot be used\|conflict' '$t/err'"
check print0_conflict_usage_error "cd '$t' && '$fd' --count -0 >/dev/null 2>/dev/null; [ \$? -eq 2 ]"
check write_error_reported "cd '$t' && ! '$fd' --count foo >/dev/full 2>/dev/null"
check tests_assert_message "grep -q 'cannot be used\|assert_failure_with_error\|stderr' <(cd '$d' && git diff HEAD -- tests/ 2>/dev/null || cat tests/tests.rs)"
check no_partial_count_on_interrupt "[ -z \"\$(timeout -s INT 0.3 '$fd' --color=always --count -u . / 2>/dev/null)\" ]"
check count_with_filters "cd '$t' && [ \"\$('$fd' --count -e txt foo)\" = 1 ]"
echo "$pass/$total$fails"; rm -rf "$d" "$t"
