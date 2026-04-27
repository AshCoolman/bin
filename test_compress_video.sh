#!/usr/bin/env bash
# test_compress_video.sh — dry-run golden tests + unit tests for compress_video.
#
# Usage:
#   ./test_compress_video.sh                    run all tests
#   UPDATE_GOLDEN=1 ./test_compress_video.sh    regenerate golden files
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CV="$SCRIPT_DIR/compress_video"
LIB="$SCRIPT_DIR/compress_video_lib.sh"
GOLDEN="$SCRIPT_DIR/tests/compress_video_golden"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

FAIL=0
PASS=0
TOTAL=0

# --- helpers --------------------------------------------------------------

log_pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); printf '  PASS: %s\n' "$1"; }
log_fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); printf '  FAIL: %s\n' "$1"; }

# --- generate deterministic 5-second test pattern -------------------------

printf 'Generating test input...\n'
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "testsrc=duration=5:size=640x480:rate=30" \
  -f lavfi -i "sine=frequency=440:duration=5" \
  -c:v libx264 -c:a aac -shortest \
  "$TMP/test.mp4"

# --- golden (dry-run) tests -----------------------------------------------
#
# Each case runs compress_video --dry-run, normalizes the tmp path, and
# diffs against a golden file. Running UPDATE_GOLDEN=1 regenerates them.

run_golden() {
  local name="$1"; shift
  local actual="$TMP/$name.actual"
  local golden="$GOLDEN/$name.txt"

  if ! "$CV" --dry-run "$@" > "$actual" 2>&1; then
    log_fail "$name (command failed)"
    cat "$actual"
    return
  fi

  # Normalize tmp paths so goldens are portable.
  sed -i.bak "s|${TMP}|TMPDIR|g" "$actual" && rm -f "$actual.bak"

  if [[ "${UPDATE_GOLDEN:-}" == "1" ]]; then
    mkdir -p "$GOLDEN"
    cp "$actual" "$golden"
    printf '  UPDATED: %s\n' "$name"
    TOTAL=$((TOTAL+1)); PASS=$((PASS+1))
    return
  fi

  if [[ ! -f "$golden" ]]; then
    log_fail "$name (no golden file — run with UPDATE_GOLDEN=1)"
    return
  fi

  if diff -u "$golden" "$actual" > "$TMP/$name.diff" 2>&1; then
    log_pass "$name"
  else
    log_fail "$name"
    cat "$TMP/$name.diff"
  fi
}

printf '\n=== Golden (dry-run) tests ===\n'

# mb mode
run_golden "mb_default"         "$TMP/test.mp4" 10mb
run_golden "mb_with_speed"      "$TMP/test.mp4" 10mb --speed 1.5
run_golden "mb_speed_35_atempo" "$TMP/test.mp4" 10mb --speed 3.5
run_golden "mb_match"           "$TMP/test.mp4" 10mb --match --speed 1
run_golden "mb_tiny_cap_floor"  "$TMP/test.mp4" 1mb

# pct mode
run_golden "pct_10"             "$TMP/test.mp4" 10%

# br mode
run_golden "br_15mbps"          "$TMP/test.mp4" 15br
run_golden "br_2mbps_match"     "$TMP/test.mp4" 2br --match --speed 1

# --- pure-function unit tests ---------------------------------------------

printf '\n=== Unit tests (compress_video_lib.sh) ===\n'

(
  # Source lib in a subshell to avoid polluting the test harness.
  source "$LIB"

  assert_eq() {
    local name="$1" expected="$2" actual="$3"
    if [[ "$expected" == "$actual" ]]; then
      printf '  PASS: %s\n' "$name"
    else
      printf '  FAIL: %s — expected "%s", got "%s"\n' "$name" "$expected" "$actual"
      exit 1
    fi
  }

  # _cvlib_parse_target
  assert_eq "parse_target 10mb"  "mb 10"  "$(_cvlib_parse_target 10mb)"
  assert_eq "parse_target 10MB"  "mb 10"  "$(_cvlib_parse_target 10MB)"
  assert_eq "parse_target 10%"   "pct 10" "$(_cvlib_parse_target 10%)"
  assert_eq "parse_target 15br"  "br 15"  "$(_cvlib_parse_target 15br)"
  assert_eq "parse_target 2.5br" "br 2.5" "$(_cvlib_parse_target 2.5br)"

  # _cvlib_output_name_size
  assert_eq "output_name_size no-match" \
    "input_max10MB_1.5x.mp4" \
    "$(_cvlib_output_name_size input.mov 10 1.5 0)"
  assert_eq "output_name_size match" \
    "input_max10MB_1.5x_match.mp4" \
    "$(_cvlib_output_name_size input.mov 10 1.5 1)"

  # _cvlib_output_name_bitrate
  assert_eq "output_name_bitrate" \
    "input_15mbps_1.5x.mp4" \
    "$(_cvlib_output_name_bitrate input.mov 15 1.5 0)"

  # _cvlib_is_compressed_output
  _cvlib_is_compressed_output "demo_max10MB_1.5x.mp4" \
    || { printf '  FAIL: is_compressed (old pattern)\n'; exit 1; }
  _cvlib_is_compressed_output "demo_15mbps_1.5x.mp4" \
    || { printf '  FAIL: is_compressed (br pattern)\n'; exit 1; }
  ! _cvlib_is_compressed_output "demo.mov" \
    || { printf '  FAIL: is_compressed (plain file)\n'; exit 1; }
  assert_eq "is_compressed old"  "yes" "$(_cvlib_is_compressed_output "demo_max10MB_1.5x.mp4" && echo yes || echo no)"
  assert_eq "is_compressed br"   "yes" "$(_cvlib_is_compressed_output "demo_15mbps_1.5x.mp4" && echo yes || echo no)"
  assert_eq "is_compressed plain" "no" "$(_cvlib_is_compressed_output "demo.mov" && echo yes || echo no)"

  # _cvlib_build_audio_filter
  assert_eq "audio_filter speed=1"   ""          "$(_cvlib_build_audio_filter 1)"
  assert_eq "audio_filter speed=1.5" "atempo=1.5" "$(_cvlib_build_audio_filter 1.5)"

  # _cvlib_build_video_filter
  assert_eq "video_filter default" \
    "setpts=PTS/1.5,fps=30,scale=trunc(iw*0.75/2)*2:trunc(ih*0.75/2)*2,unsharp=5:5:1.0:5:5:0.0" \
    "$(_cvlib_build_video_filter 1.5 0 0.75 30 "5:5:1.0:5:5:0.0")"
  assert_eq "video_filter match" \
    "setpts=PTS/1,scale=trunc(iw*0.75/2)*2:trunc(ih*0.75/2)*2,unsharp=5:5:1.0:5:5:0.0" \
    "$(_cvlib_build_video_filter 1 1 0.75 30 "5:5:1.0:5:5:0.0")"
) && {
  # Count passes from subshell output
  UNIT_PASS=$(printf '' | wc -l)
  log_pass "unit tests (all assertions passed)"
} || {
  log_fail "unit tests (assertion failure — see above)"
}

# --- error-path tests -----------------------------------------------------

printf '\n=== Error-path tests ===\n'

check_error() {
  local name="$1"; shift
  if "$CV" "$@" >/dev/null 2>&1; then
    log_fail "$name (should have failed but exited 0)"
  else
    log_pass "$name"
  fi
}

check_error "no args"                 # no arguments at all
check_error "missing target"          "$TMP/test.mp4"
check_error "unknown flag"            "$TMP/test.mp4" 10mb --speedy
check_error "bad target suffix"       "$TMP/test.mp4" 10xyz
check_error "missing file"            /tmp/does_not_exist.mp4 10mb
check_error "speed zero"              "$TMP/test.mp4" 10mb --speed 0

# --- summary --------------------------------------------------------------

printf '\n=== Results: %d/%d passed ===\n' "$PASS" "$TOTAL"
if [[ $FAIL -gt 0 ]]; then
  printf '%d FAILED\n' "$FAIL"
  exit 1
fi
printf 'All tests passed.\n'
