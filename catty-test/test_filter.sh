#!/usr/bin/env bash

set -euo pipefail

ignoreCSV="$1"

TMP_IGNORE="$(mktemp)"
trap 'rm -f "$TMP_IGNORE"' EXIT

IFS=',' read -r -a __arr <<<"$ignoreCSV"; for x in "${__arr[@]:-}"; do [[ -n "${x// }" ]] && printf "%s\n" "$x"; done > "$TMP_IGNORE"

echo "Ignore patterns:" >&2
cat "$TMP_IGNORE" >&2

ALL="$(mktemp)"
cat > "$ALL"

echo "All files:" >&2
cat "$ALL" >&2

IG="$(mktemp)"

# git check-ignore exits non-zero if some paths are not ignored — ignore status
git -c core.excludesFile="$TMP_IGNORE" check-ignore --no-index --stdin < "$ALL" > "$IG" 2>/dev/null || true

echo "Ignored files:" >&2
cat "$IG" >&2

if [[ -s "$IG" ]]; then
  # all \ ignored → not-ignored
  grep -F -x -v -f "$IG" "$ALL"
else
  cat "$ALL"
fi
