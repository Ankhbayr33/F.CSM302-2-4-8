#!/bin/sh
# run_tests.sh - automated tests for the CPU scheduling project
#
#   sh tests/run_tests.sh            run all tests (make test does this)
#   sh tests/run_tests.sh --update   regenerate tests/expected/ (check by hand!)
#
# 1. golden tests  : every algorithm on every file in tests/data/,
#                    output compared with tests/expected/<alg>_<file>.txt
# 2. error tests   : invalid input must exit with status 1 and a clear message
# 3. option tests  : invalid command-line arguments
# 4. reference     : random task sets compared with tests/reference_check.py

cd "$(dirname "$0")/.." || exit 1

ALGS="fcfs sjf priority rr priority_rr"
EXP=tests/expected
pass=0
fail=0
update=0
[ "$1" = "--update" ] && update=1

ok()  { pass=$((pass + 1)); printf '  PASS  %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf '  FAIL  %s\n' "$1"; }

for a in $ALGS; do
    [ -x "./$a" ] || { echo "error: ./$a not built - run make"; exit 1; }
done

# ------------------------------------------------------------------
echo "1. Golden tests (expected output in $EXP/)"
mkdir -p "$EXP"
for f in tests/data/*.txt; do
    base=$(basename "$f" .txt)
    for a in $ALGS; do
        for q in 10 4; do
            # the quantum only matters for RR algorithms
            if [ "$q" = 4 ] && [ "$a" != rr ] && [ "$a" != priority_rr ]; then
                continue
            fi
            name="${a}_${base}_q${q}"
            case "$a" in
                rr|priority_rr) out=$("./$a" -q "$q" "$f" 2>&1) ;;
                *)              out=$("./$a" "$f" 2>&1) ;;
            esac
            if [ $update = 1 ]; then
                printf '%s\n' "$out" > "$EXP/$name.txt"
                ok "$name (updated)"
            elif [ ! -f "$EXP/$name.txt" ]; then
                bad "$name (no expected file)"
            elif [ "$out" = "$(cat "$EXP/$name.txt")" ]; then
                ok "$name"
            else
                bad "$name"
                printf '%s\n' "$out" | diff "$EXP/$name.txt" - | head -20
            fi
        done
    done
done

# ------------------------------------------------------------------
echo "2. Error tests (must exit 1 with this message)"
check_error() {   # file  expected-substring  [algorithm]
    alg=${3:-fcfs}
    msg=$("./$alg" "tests/errors/$1" 2>&1 >/dev/null)
    status=$?
    if [ $status -eq 1 ] && printf '%s' "$msg" | grep -q -- "$2"; then
        ok "$1 -> $msg"
    else
        bad "$1 (status $status, message: $msg)"
    fi
}
check_error priority_too_high.txt "line 2: priority '11' must be an integer from 1 to 10"
check_error priority_zero.txt     "priority '0' must be an integer from 1 to 10"
check_error zero_burst.txt        "CPU burst '0' must be a positive integer"
check_error negative_burst.txt    "CPU burst '-5' must be a positive integer"
check_error missing_field.txt     "expected 'name, priority, burst\[, arrival\]'"
check_error extra_field.txt       "expected 'name, priority, burst\[, arrival\]'"
check_error duplicate_name.txt    "line 2: duplicate task name 'T1'"
check_error empty.txt             "contains no tasks"
check_error space_in_name.txt     "invalid task name 'T 1'"
check_error not_a_number.txt      "priority 'four' must be an integer"
check_error negative_arrival.txt  "arrival time '-1' must be a non-negative integer"
check_error burst_too_large.txt   "CPU burst '2000000' must be a positive integer"
check_error too_many_slices.txt   "quantum too small" rr

# ------------------------------------------------------------------
echo "3. Command-line option tests"
check_opt() {     # expected-status  expected-substring  args...
    want=$1; text=$2; shift 2
    msg=$("$@" 2>&1 >/dev/null)
    status=$?
    if [ $status -eq "$want" ] && printf '%s' "$msg" | grep -q -- "$text"; then
        ok "$* -> status $status"
    else
        bad "$* (status $status, message: $msg)"
    fi
}
check_opt 1 "no schedule file given"           ./rr
check_opt 1 "cannot open schedule file"        ./rr no_such_file.txt
check_opt 1 "time quantum '0' must be a positive integer"   ./rr -q 0 tests/data/book.txt
check_opt 1 "time quantum 'abc' must be a positive integer" ./rr -q abc tests/data/book.txt
check_opt 1 "option -q needs a value"          ./rr tests/data/book.txt -q
check_opt 1 "unknown option '-x'"              ./rr -x tests/data/book.txt
check_opt 1 "only one schedule file"           ./rr tests/data/book.txt tests/data/eight.txt
check_opt 0 "does not use a time quantum"      ./fcfs -q 5 tests/data/book.txt
check_opt 0 "Usage:"                           ./sjf -h

# JSON mode must print valid JSON for results and for errors
if command -v python3 >/dev/null 2>&1; then
    if ./rr -j tests/data/book.txt | python3 -c "import sys,json; json.load(sys.stdin)" \
       && ./rr -j tests/errors/zero_burst.txt 2>/dev/null \
          | python3 -c "import sys,json; assert 'error' in json.load(sys.stdin)"; then
        ok "JSON output (result and error) is valid"
    else
        bad "JSON output is not valid"
    fi
fi

# ------------------------------------------------------------------
echo "4. Reference implementation check"
if command -v python3 >/dev/null 2>&1; then
    if python3 tests/reference_check.py --cases 300; then
        ok "C schedulers match tests/reference_check.py"
    else
        bad "reference check"
    fi
else
    echo "  SKIP  python3 not found"
fi

# ------------------------------------------------------------------
echo
echo "Passed: $pass   Failed: $fail"
[ $fail -eq 0 ]
