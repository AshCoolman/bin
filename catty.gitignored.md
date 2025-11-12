./all_source
```/all_source
#!/usr/bin/env bash
# Usage:
#   all_source [--append] [--onlyChanged] [--changedSince=<branch>] [--format=ext1,ext2,…] [--exclude=pathOrExt1,pathOrExt2,…] [<root>]

append=0; onlyChanged=0; changedSince=""; format=""; exclude=""; root="."

# Parse args (flags in any order; first non-flag is root)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --append) append=1; shift ;;
    --onlyChanged) onlyChanged=1; shift ;;
    --changedSince=*) changedSince="${1#--changedSince=}"; shift ;;
    --format=*) format="${1#--format=}"; shift ;;
    --exclude=*) exclude="${1#--exclude=}"; shift ;;
    --) shift; break ;;
    -*) echo "Unknown option: $1" >&2; exit 2 ;;
    *)  root="$1"; shift ;;
  esac
done

out="all_source.gitignored.md"
out_abs="$(cd -P . && pwd)/$out"

# Clear output if not appending
[[ $append -eq 0 ]] && : > "$out_abs"

# Build extension patterns
patterns=( '*.[jt]s' '*.[jt]sx' '*.yaml' '*.yml' '*.sh' '*.json' )
if [[ -n "$format" ]]; then
  IFS=',' read -r -a fmts <<<"$format"
  patterns=()
  for ext in "${fmts[@]}"; do
    ext="${ext#.}"
    [[ -n "$ext" ]] && patterns+=("*.${ext}")
  done
fi

# Build excludes list
excludes=()
if [[ -n "$exclude" ]]; then
  IFS=',' read -r -a excludes <<<"$exclude"
fi

cd "$root" || exit 1

# 2-column header (stdout only)
if [[ $append -eq 0 ]]; then
  printf "%7s  %s\n" "lines" "file"
  printf "%7s  %s\n" "-----" "----"
fi

git ls-files --cached --others --exclude-standard -- "${patterns[@]}" \
| sort \
| while IFS= read -r file; do
  file_abs="$(cd -P -- "$(dirname -- "$file")" && pwd)/$(basename -- "$file")"

  # Skip output file itself
  [[ "$file_abs" == "$out_abs" ]] && continue

  # --exclude filter (paths or extensions)
  if [[ ${#excludes[@]} -gt 0 ]]; then
    file_rel="${file#./}"
    file_ext="${file##*.}"
    skip=0
    for ex in "${excludes[@]}"; do
      ex_norm="${ex#./}"
      if [[ "$ex_norm" =~ ^[A-Za-z0-9]+$ ]]; then
        [[ "$file_ext" == "$ex_norm" ]] && { skip=1; break; }
      else
        [[ "$file_rel" == "$ex_norm" ]] && { skip=1; break; }
      fi
    done
    [[ $skip -eq 1 ]] && continue
  fi

  # --onlyChanged filter (staged or unstaged)
  if [[ $onlyChanged -eq 1 ]] && [[ -z $(git status --porcelain -- "$file") ]]; then
    continue
  fi

  # --changedSince=branch filter
  if [[ -n $changedSince ]] && [[ -z $(git diff --name-only "$changedSince"..HEAD -- "$file") ]]; then
    continue
  fi

  # Column line to STDOUT ONLY
  if lines=$(wc -l < "$file" 2>/dev/null | awk '{print $1}'); then :; else lines=0; fi
  printf "%7d  %s\n" "$lines" "$file"

  # Markdown output: filename line, then code fence (NO line count)
  echo "$file" >> "$out_abs"
  ext="${file##*.}"
  if [[ $ext =~ ^js$|^jsx$ ]]; then lang="ts"; else lang="$ext"; fi
  {
    echo '```'"$lang"
    cat "$file"
    echo '```'
    echo
  } >> "$out_abs"
done```

./bb
```/bb
#!/usr/bin/env bash
set -e
set -u

if test -t 1; then
  exec 1>/dev/null
fi

if test -t 2; then
  exec 2>/dev/null
fi

"$@" &
```

./catty
```/catty
#!/usr/bin/env bash
# catty — collect source files with gitignore support via ripgrep
# Usage:
#   catty [OPTIONS] [--include=PATTERN]... [--exclude=PATTERN]...
#
# Options:
#   --include=PATTERN       Include glob pattern (multiple allowed)
#   --exclude=PATTERN       Exclude glob pattern (multiple allowed)
#   --no-gitignore          Don't respect .gitignore (include all files)
#   --max-lines=N           Skip files with more than N lines
#   --max-total-lines=N     Exit 1 if total output exceeds N lines
#   --out=FILE              Output file (default: catty.gitignored.md)
#   --append                Append to output file instead of overwriting
#   --print                 Print file list only (no markdown)
#   --help, -h              Show this help message

set -euo pipefail

show_help() {
  sed -n '2,4p;6,15p' "$0" | sed 's/^# //'
  exit 0
}

# ---------- args ----------
out="catty.gitignored.md"
append=0
printOnly=0
no_gitignore=0
max_lines=""
max_total_lines=""
declare -a includes
declare -a excludes

for arg in "$@"; do
  case "$arg" in
    --help|-h)            show_help;;
    --out=*)              out="${arg#--out=}";;
    --append)             append=1;;
    --print)              printOnly=1;;
    --no-gitignore)       no_gitignore=1;;
    --include=*)          includes+=("${arg#--include=}");;
    --exclude=*)          excludes+=("${arg#--exclude=}");;
    --max-lines=*)        max_lines="${arg#--max-lines=}";;
    --max-total-lines=*)  max_total_lines="${arg#--max-total-lines=}";;
    --)                   shift; break;;
    -*)                   echo "Unknown option: $arg" >&2; exit 2;;
    *)                    ;; # Positional args handled separately
  esac
done

# ---------- utils ----------
pad_left() { # $1=str $2=width
  local s=""
  if [[ -n "$1" ]]; then
    s="$1"
  fi
  local n="$2" len=${#s}
  (( len >= n )) && { printf "%s" "$s"; return; }
  printf "%*s%s" $((n-len)) "" "$s"
}
ext_to_lang() { # $1=path
  local e
  if [[ -z "$1" ]]; then
    printf ""
    return
  fi
  e=$(printf "%s" "${1##*.}" | tr '[:upper:]' '[:lower:]')
  case "$e" in
    js|jsx|ts|tsx) printf "ts" ;;
    yml)           printf "yaml" ;;
    sh)            printf "bash" ;;
    *)             printf "%s" "$e" ;;
  esac
}
mktemp_compat() { local t; t=$(mktemp -t allsrc.XXXXXX 2>/dev/null || mktemp); printf "%s" "$t"; }
resolve_self() {
  local src="${BASH_SOURCE[0]}"; [[ "$src" = /* ]] || src="$PWD/$src"
  local dir; dir="$(cd -P -- "$(dirname -- "$src")" && pwd)"; printf "%s/%s" "$dir" "$(basename -- "$src")"
}

build_rg_command() {
  # Build rg --files command with all filters
  # Use '.' as pattern to match all files (required by rg even in --files mode)
  local -a cmd=("rg" "--files" "--sort=path" ".")

  # Add include globs
  if (( ${#includes[@]} > 0 )); then
    local pattern
    for pattern in "${includes[@]}"; do
      cmd+=("--glob=$pattern")
    done
  fi

  # Add exclude globs
  if (( ${#excludes[@]} > 0 )); then
    local pattern
    for pattern in "${excludes[@]}"; do
      cmd+=("--glob=!$pattern")
    done
  fi

  # Add no-ignore flag if requested
  if (( no_gitignore )); then
    cmd+=("--no-ignore")
  fi

  # Print the command array
  printf "%s\n" "${cmd[@]}"
}

# ---------- main ----------



# Build rg command array
declare -a rg_args=(rg --files --sort=path .)

# Add include globs
if (( ${#includes[@]} > 0 )); then
  for pattern in "${includes[@]}"; do
    rg_args+=(--glob="$pattern")
  done
fi

# Add exclude globs
if (( ${#excludes[@]} > 0 )); then
  for pattern in "${excludes[@]}"; do
    rg_args+=(--glob="!$pattern")
  done
fi

# Add no-ignore flag
if (( no_gitignore )); then
  rg_args+=(--no-ignore)
fi

# Determine output file path
if [[ "$out" = /* ]]; then
  out_abs="$out"
else
  out_abs="$(cd -P . && pwd)/$out"
fi

# Execute rg and pipe results
"${rg_args[@]}" | {
  # Print-only mode (for piping/fzf)
  if (( printOnly )); then
    while IFS= read -r file; do
      # skip output file itself
      if [[ "$(cd -P -- "$(dirname -- "$file")" && pwd)/$(basename -- "$file")" == "$out_abs" ]]; then
        continue
      fi

      # skip if exceeds max-lines
      lines=0
      if lc=$(wc -l < "$file" 2>/dev/null | awk '{print $1}'); then lines="$lc"; fi
      if [[ -n "$max_lines" ]] && (( lines > max_lines )); then
        continue
      fi

      printf "%s\n" "$file"
    done
    exit 0
  fi

  # Emit markdown
  (( append == 0 )) && : > "$out_abs"

  # Header to stdout
  if (( append == 0 )); then
    printf "%s  %s\n" "$(pad_left lines 7)" "file"
    printf "%s  %s\n" "$(pad_left ----- 7)" "----"
  fi

  total_lines=0

  while IFS= read -r file; do
    if [[ -z "$file" ]]; then
      continue
    fi

    # skip output file itself
    if [[ "$(cd -P -- "$(dirname -- "$file")" && pwd)/$(basename -- "$file")" == "$out_abs" ]]; then
      continue
    fi

    # line count
    lines=0
    if lc=$(wc -l < "$file" 2>/dev/null | awk '{print $1}'); then lines="$lc"; fi

    # skip if exceeds max-lines
    if [[ -n "$max_lines" ]] && (( lines > max_lines )); then
      continue
    fi

    printf "%s  %s\n" "$(pad_left "$lines" 7)" "$file"
    (( total_lines += lines ))

    # markdown
    echo "$file" >> "$out_abs"
    lang="$(ext_to_lang "$file")"
    {
      echo '```'"$lang"
      cat "$file" 2>/dev/null || true
      echo '```'
      echo
    } >> "$out_abs"
  done

  # Check if total lines exceed max-total-lines
  if [[ -n "$max_total_lines" ]] && (( total_lines > max_total_lines )); then
    echo "Error: Total lines ($total_lines) exceeds max-total-lines ($max_total_lines)" >&2
    exit 1
  fi
}
```

./catty-test/README.md
```md
This is a README file.```

./catty-test/SKILLS.md
```md
This file contains skills.```

./catty-test/all_source.gitignored.md
```md
README.md
```md
This is a README file.```

SKILLS.md
```md
This file contains skills.```

down
```down
down```

exec
```exec
exec```

package-lock.json
```json
{}```

some-other-file.txt
```txt
Some other content.```

test.sh
```bash
#!/bin/bash

# Run catty with the specified ignore pattern
/Users/ashleycoleman/bin/catty --ignore='**/*.md,package-lock.json,!up,!down,!exec,!SKILLS.md,!.gitignore' --print . > output.txt

# Check the output
errors=0
while read -r file; do
  if [[ "$file" == "README.md" ]]; then
    echo "ERROR: README.md should be ignored"
    errors=$((errors + 1))
  fi
  if [[ "$file" == "package-lock.json" ]]; then
    echo "ERROR: package-lock.json should be ignored"
    errors=$((errors + 1))
  fi
done < output.txt

if ! grep -q "SKILLS.md" output.txt; then
  echo "ERROR: SKILLS.md should be included"
  errors=$((errors + 1))
fi

if ! grep -q "up" output.txt; then
  echo "ERROR: up should be included"
  errors=$((errors + 1))
fi

if ! grep -q "down" output.txt; then
  echo "ERROR: down should be included"
  errors=$((errors + 1))
fi

if ! grep -q "exec" output.txt; then
  echo "ERROR: exec should be included"
  errors=$((errors + 1))
fi

if ! grep -q ".gitignore" output.txt; then
  echo "ERROR: .gitignore should be included"
  errors=$((errors + 1))
fi

if [[ $errors -eq 0 ]]; then
  echo "All tests passed!"
else
  echo "$errors errors found"
fi

# Clean up
rm output.txt```

test2.sh
```bash
#!/bin/bash

# Create a fresh directory for the test
rm -rf test-env
mkdir test-env
cd test-env

# Create some files
touch a.txt
touch b.txt
touch c.md

# Run catty with an ignore pattern
/Users/ashleycoleman/bin/catty --ignore='*.md' --print . > output.txt

# Check the output
errors=0
if grep -q "c.md" output.txt; then
  echo "ERROR: c.md should be ignored"
  errors=$((errors + 1))
fi

if ! grep -q "a.txt" output.txt; then
  echo "ERROR: a.txt should be included"
  errors=$((errors + 1))
fi

if ! grep -q "b.txt" output.txt; then
  echo "ERROR: b.txt should be included"
  errors=$((errors + 1))
fi

if [[ $errors -eq 0 ]]; then
  echo "All tests passed!"
else
  echo "$errors errors found"
fi

# Clean up
cd ..
rm -rf test-env
```

test3.sh
```bash
#!/bin/bash

# Create a fresh directory for the test
rm -rf test-env
mkdir test-env
cd test-env

# Initialize a git repository
git init

# Create some files
touch a.txt
touch b.txt
touch c.md
touch d.md
touch up
touch down
touch exec
touch .gitignore

# Add some files to the index
git add a.txt c.md up .gitignore

# Run catty with the specified ignore pattern
/Users/ashleycoleman/bin/catty --ignore='**/*.md,package-lock.json,!up,!down,!exec,!SKILLS.md,!.gitignore' --print . > output.txt

# Check the output
errors=0
if grep -q "c.md" output.txt; then
  echo "ERROR: c.md should be ignored"
  errors=$((errors + 1))
fi

if grep -q "d.md" output.txt; then
  echo "ERROR: d.md should be ignored"
  errors=$((errors + 1))
fi

if ! grep -q "up" output.txt; then
  echo "ERROR: up should be included"
  errors=$((errors + 1))
fi

if ! grep -q "down" output.txt; then
  echo "ERROR: down should be included"
  errors=$((errors + 1))
fi

if ! grep -q "exec" output.txt; then
  echo "ERROR: exec should be included"
  errors=$((errors + 1))
fi

if ! grep -q ".gitignore" output.txt; then
  echo "ERROR: .gitignore should be included"
  errors=$((errors + 1))
fi

if [[ $errors -eq 0 ]]; then
  echo "All tests passed!"
else
  echo "$errors errors found"
fi

# Clean up
cd ..
rm -rf test-env
```

test_filter.sh
```bash
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
```

up
```up
up```

```

./catty-test/catty.gitignored.md
```md
README.md
```md
This is a README file.```

SKILLS.md
```md
This file contains skills.```

all_source.gitignored.md
```md
README.md
```md
This is a README file.```

SKILLS.md
```md
This file contains skills.```

down
```down
down```

exec
```exec
exec```

package-lock.json
```json
{}```

some-other-file.txt
```txt
Some other content.```

test.sh
```bash
#!/bin/bash

# Run catty with the specified ignore pattern
/Users/ashleycoleman/bin/catty --ignore='**/*.md,package-lock.json,!up,!down,!exec,!SKILLS.md,!.gitignore' --print . > output.txt

# Check the output
errors=0
while read -r file; do
  if [[ "$file" == "README.md" ]]; then
    echo "ERROR: README.md should be ignored"
    errors=$((errors + 1))
  fi
  if [[ "$file" == "package-lock.json" ]]; then
    echo "ERROR: package-lock.json should be ignored"
    errors=$((errors + 1))
  fi
done < output.txt

if ! grep -q "SKILLS.md" output.txt; then
  echo "ERROR: SKILLS.md should be included"
  errors=$((errors + 1))
fi

if ! grep -q "up" output.txt; then
  echo "ERROR: up should be included"
  errors=$((errors + 1))
fi

if ! grep -q "down" output.txt; then
  echo "ERROR: down should be included"
  errors=$((errors + 1))
fi

if ! grep -q "exec" output.txt; then
  echo "ERROR: exec should be included"
  errors=$((errors + 1))
fi

if ! grep -q ".gitignore" output.txt; then
  echo "ERROR: .gitignore should be included"
  errors=$((errors + 1))
fi

if [[ $errors -eq 0 ]]; then
  echo "All tests passed!"
else
  echo "$errors errors found"
fi

# Clean up
rm output.txt```

test2.sh
```bash
#!/bin/bash

# Create a fresh directory for the test
rm -rf test-env
mkdir test-env
cd test-env

# Create some files
touch a.txt
touch b.txt
touch c.md

# Run catty with an ignore pattern
/Users/ashleycoleman/bin/catty --ignore='*.md' --print . > output.txt

# Check the output
errors=0
if grep -q "c.md" output.txt; then
  echo "ERROR: c.md should be ignored"
  errors=$((errors + 1))
fi

if ! grep -q "a.txt" output.txt; then
  echo "ERROR: a.txt should be included"
  errors=$((errors + 1))
fi

if ! grep -q "b.txt" output.txt; then
  echo "ERROR: b.txt should be included"
  errors=$((errors + 1))
fi

if [[ $errors -eq 0 ]]; then
  echo "All tests passed!"
else
  echo "$errors errors found"
fi

# Clean up
cd ..
rm -rf test-env
```

test3.sh
```bash
#!/bin/bash

# Create a fresh directory for the test
rm -rf test-env
mkdir test-env
cd test-env

# Initialize a git repository
git init

# Create some files
touch a.txt
touch b.txt
touch c.md
touch d.md
touch up
touch down
touch exec
touch .gitignore

# Add some files to the index
git add a.txt c.md up .gitignore

# Run catty with the specified ignore pattern
/Users/ashleycoleman/bin/catty --ignore='**/*.md,package-lock.json,!up,!down,!exec,!SKILLS.md,!.gitignore' --print . > output.txt

# Check the output
errors=0
if grep -q "c.md" output.txt; then
  echo "ERROR: c.md should be ignored"
  errors=$((errors + 1))
fi

if grep -q "d.md" output.txt; then
  echo "ERROR: d.md should be ignored"
  errors=$((errors + 1))
fi

if ! grep -q "up" output.txt; then
  echo "ERROR: up should be included"
  errors=$((errors + 1))
fi

if ! grep -q "down" output.txt; then
  echo "ERROR: down should be included"
  errors=$((errors + 1))
fi

if ! grep -q "exec" output.txt; then
  echo "ERROR: exec should be included"
  errors=$((errors + 1))
fi

if ! grep -q ".gitignore" output.txt; then
  echo "ERROR: .gitignore should be included"
  errors=$((errors + 1))
fi

if [[ $errors -eq 0 ]]; then
  echo "All tests passed!"
else
  echo "$errors errors found"
fi

# Clean up
cd ..
rm -rf test-env
```

test_filter.sh
```bash
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
```

up
```up
up```

```

```

./catty-test/down
```/catty-test/down
down```

./catty-test/exec
```/catty-test/exec
exec```

./catty-test/package-lock.json
```json
{}```

./catty-test/some-other-file.txt
```txt
Some other content.```

./catty-test/test.sh
```bash
#!/bin/bash

# Run catty with the specified ignore pattern
/Users/ashleycoleman/bin/catty --ignore='**/*.md,package-lock.json,!up,!down,!exec,!SKILLS.md,!.gitignore' --print . > output.txt

# Check the output
errors=0
while read -r file; do
  if [[ "$file" == "README.md" ]]; then
    echo "ERROR: README.md should be ignored"
    errors=$((errors + 1))
  fi
  if [[ "$file" == "package-lock.json" ]]; then
    echo "ERROR: package-lock.json should be ignored"
    errors=$((errors + 1))
  fi
done < output.txt

if ! grep -q "SKILLS.md" output.txt; then
  echo "ERROR: SKILLS.md should be included"
  errors=$((errors + 1))
fi

if ! grep -q "up" output.txt; then
  echo "ERROR: up should be included"
  errors=$((errors + 1))
fi

if ! grep -q "down" output.txt; then
  echo "ERROR: down should be included"
  errors=$((errors + 1))
fi

if ! grep -q "exec" output.txt; then
  echo "ERROR: exec should be included"
  errors=$((errors + 1))
fi

if ! grep -q ".gitignore" output.txt; then
  echo "ERROR: .gitignore should be included"
  errors=$((errors + 1))
fi

if [[ $errors -eq 0 ]]; then
  echo "All tests passed!"
else
  echo "$errors errors found"
fi

# Clean up
rm output.txt```

./catty-test/test2.sh
```bash
#!/bin/bash

# Create a fresh directory for the test
rm -rf test-env
mkdir test-env
cd test-env

# Create some files
touch a.txt
touch b.txt
touch c.md

# Run catty with an ignore pattern
/Users/ashleycoleman/bin/catty --ignore='*.md' --print . > output.txt

# Check the output
errors=0
if grep -q "c.md" output.txt; then
  echo "ERROR: c.md should be ignored"
  errors=$((errors + 1))
fi

if ! grep -q "a.txt" output.txt; then
  echo "ERROR: a.txt should be included"
  errors=$((errors + 1))
fi

if ! grep -q "b.txt" output.txt; then
  echo "ERROR: b.txt should be included"
  errors=$((errors + 1))
fi

if [[ $errors -eq 0 ]]; then
  echo "All tests passed!"
else
  echo "$errors errors found"
fi

# Clean up
cd ..
rm -rf test-env
```

./catty-test/test3.sh
```bash
#!/bin/bash

# Create a fresh directory for the test
rm -rf test-env
mkdir test-env
cd test-env

# Initialize a git repository
git init

# Create some files
touch a.txt
touch b.txt
touch c.md
touch d.md
touch up
touch down
touch exec
touch .gitignore

# Add some files to the index
git add a.txt c.md up .gitignore

# Run catty with the specified ignore pattern
/Users/ashleycoleman/bin/catty --ignore='**/*.md,package-lock.json,!up,!down,!exec,!SKILLS.md,!.gitignore' --print . > output.txt

# Check the output
errors=0
if grep -q "c.md" output.txt; then
  echo "ERROR: c.md should be ignored"
  errors=$((errors + 1))
fi

if grep -q "d.md" output.txt; then
  echo "ERROR: d.md should be ignored"
  errors=$((errors + 1))
fi

if ! grep -q "up" output.txt; then
  echo "ERROR: up should be included"
  errors=$((errors + 1))
fi

if ! grep -q "down" output.txt; then
  echo "ERROR: down should be included"
  errors=$((errors + 1))
fi

if ! grep -q "exec" output.txt; then
  echo "ERROR: exec should be included"
  errors=$((errors + 1))
fi

if ! grep -q ".gitignore" output.txt; then
  echo "ERROR: .gitignore should be included"
  errors=$((errors + 1))
fi

if [[ $errors -eq 0 ]]; then
  echo "All tests passed!"
else
  echo "$errors errors found"
fi

# Clean up
cd ..
rm -rf test-env
```

./catty-test/test_filter.sh
```bash
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
```

./catty-test/up
```/catty-test/up
up```

./compress_video
```/compress_video
#!/usr/bin/env bash
set -euo pipefail

# Usage: script input.mov max_size_MB [speed_multiplier=1.5]

err(){ printf "ERROR: %s\n" "$*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || err "Missing dependency: $1"; }

# --- required tools ---
need ffmpeg
need ffprobe
need bc
need awk
need sed

# --- capability checks (portable; no PCRE/grep -P) ---
ff_list_names() {
  case "$1" in
    encoders)
      ffmpeg -hide_banner -v error -encoders \
        | awk 'NF>=2 && $1 !~ /Encoders:|------/ {print $2}'
      ;;
    filters)
      ffmpeg -hide_banner -v error -filters \
        | awk 'NF>=2 && $1 !~ /Filters:|------/ {print $2}'
      ;;
    *) err "ff_list_names: unknown list '$1'";;
  esac
}
ff_has() { # $1=list (encoders|filters), $2=name
  ff_list_names "$1" | grep -Fxq "$2"
}

ff_has encoders libx264 || err "ffmpeg built without libx264 encoder"
ff_has encoders aac     || err "ffmpeg built without AAC encoder"
ff_has filters  setpts  || err "ffmpeg missing 'setpts' filter"
ff_has filters  fps     || err "ffmpeg missing 'fps' filter"
ff_has filters  scale   || err "ffmpeg missing 'scale' filter"
ff_has filters  unsharp || err "ffmpeg missing 'unsharp' filter"
ff_has filters  atempo  || err "ffmpeg missing 'atempo' filter"

# --- args ---
if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: $0 input.mov max_size_MB [speed_multiplier=1.5]"
  exit 1
fi

INPUT="$1"
MAX_MB="$2"
SPEED="${3:-1.5}"
OUTPUT="${INPUT%.*}_max${MAX_MB}MB_${SPEED}x.mp4"

[[ -f "$INPUT" ]] || err "Input not found: $INPUT"
[[ "$MAX_MB" =~ ^[0-9]+([.][0-9]+)?$ ]] || err "max_size_MB must be a number"
[[ "$SPEED"  =~ ^[0-9]+([.][0-9]+)?$ ]] || err "speed must be a number"
(( $(echo "$SPEED > 0" | bc -l) )) || err "speed must be > 0"

# --- probe duration ---
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$INPUT") || true
[[ -n "${DURATION:-}" ]] || err "Could not probe duration"

# --- bitrate budget (UNDER cap, single-pass) ---
# Output duration adjusts for speed: setpts=PTS/SPEED ⇒ duration / SPEED
OUT_DUR=$(echo "scale=6; $DURATION / $SPEED" | bc -l)

AUDIO_KBPS=64
HEADROOM=0.88  # conservative to stay under cap
TARGET_KBPS=$(echo "$MAX_MB*1024*1024*8 / $OUT_DUR / 1000" | bc -l)
SAFE_TOTAL_KBPS=$(echo "$TARGET_KBPS * $HEADROOM"       | bc -l)
VIDEO_KBPS=$(echo "$SAFE_TOTAL_KBPS - $AUDIO_KBPS"      | bc -l | awk '{printf "%.0f",$0}')
(( VIDEO_KBPS < 50 )) && VIDEO_KBPS=50
BUF_KBPS=$(( VIDEO_KBPS * 2 ))

# --- audio atempo chain for any SPEED ---
AUDIO_ARGS=()
if (( $(echo "$SPEED != 1" | bc -l) )); then
  factor="$SPEED"
  atempo_filters=()
  while (( $(echo "$factor > 2.0" | bc -l) )); do
    atempo_filters+=("atempo=2.0")
    factor=$(echo "$factor / 2.0" | bc -l)
  done
  while (( $(echo "$factor < 0.5" | bc -l) )); do
    atempo_filters+=("atempo=0.5")
    factor=$(echo "$factor / 0.5" | bc -l)
  done
  atempo_filters+=("atempo=$factor")
  AUDIO_FILTER=$(IFS=,; echo "${atempo_filters[*]}")
  AUDIO_ARGS=(-filter:a "$AUDIO_FILTER")
fi

# --- encode (single-pass, VBV-locked) ---
ffmpeg -hide_banner -y -i "$INPUT" \
  -map 0:v:0 -map 0:a:0? -sn -dn \
  -vf "setpts=PTS/${SPEED},fps=30,scale=trunc(iw*0.75/2)*2:trunc(ih*0.75/2)*2,unsharp=5:5:1.0:5:5:0.0" \
  -pix_fmt yuv420p \
  -c:v libx264 -preset slow -g 30 -x264-params "bframes=0:nal-hrd=cbr" \
  -b:v "${VIDEO_KBPS}k" -minrate "${VIDEO_KBPS}k" -maxrate "${VIDEO_KBPS}k" -bufsize "${BUF_KBPS}k" \
  "${AUDIO_ARGS[@]}" -c:a aac -ac 1 -b:a "${AUDIO_KBPS}k" \
  -movflags +faststart \
  "$OUTPUT"```

./emoji
```/emoji
#!/usr/bin/env bash
set -e
set -u
set -o pipefail

emoji="😀 grinning cheerful cheery face grin grinning face happy laugh nice smile smiling teeth
😃 smiley awesome face grin happy mouth open smile smiling smiling face with open mouth teeth yay
😄 smile eye face grin happy laugh lol mouth open smiling smiling face with open mouth & smiling eyes
😁 grin eye face grinning face with smiling eyes happy nice smile smiling teeth beaming
😆 laughing face haha hahaha happy laugh lol mouth open rofl satisfied smile smiling smiling face with open mouth & closed eyes grinning squinting face squint
😅 sweat smile cold dejected excited face nervous open smile smiling face with open mouth & cold sweat stress stressed sweat funny grinning face with sweat heh laugh smiling
🤣 rolling on the floor laughing crying laughing cryinglaughing face floor funny haha hahaha happy hehe hilarious joy laugh laughing laughter lmao lmfao lol lolol lololol rofl roflmao rolling tear tears cry rotfl
😂 joy crying crying laughing face face with tears of joy feels funny haha hahaha happy hehe hilarious laugh laughing laughter lmao lmfao lol lolol lololol rofl roflmao tear tears cry
🙂 slightly smiling face face happy smile smiling
🙃 upside down face face hehe smile upside down oh well sarcasm sarcastic silly uh oh
🫠 melting face embarrassed haha heat hot lol melt melting sarcasm sarcastic dripping embarassed sagging shame
😉 wink face flirt heartbreaker sexy slide tease winking winking face winks
😊 blush eye face glad satisfied smile smiling smiling face with smiling eyes
😇 innocent angel angelic angels bible blessed face fairy tale fairytale fantasy halo happy peaceful smile smiling smiling face with halo spirit
🥰 smiling face with 3 hearts adore crush face heart hearts i love you ily in love love romance smile smiling hearts
😍 heart eyes 143 bae eye face feels heart hearts ily in love kisses love loving romance romantic smile smiling face with heart eyes xoxo
🤩 star struck excited eyes face grinning smile star starry eyed wow grinning face with star eyes
😘 kissing heart 143 adorbs bae face face blowing a kiss flirt heart ily kiss kisses love love you lover miss you morning muah night romance romantic smooch smooches xoxo kissy
😗 kissing 143 date dating face flirt ily kiss kisses kissing face love love you smooch smooches xoxo kissy pout
☺️ relaxed face happy outlined smile smiling smiling face slightly smiling face
😚 kissing closed eyes 143 bae blush closed date dating eye face flirt ily kiss kisses kissing face with closed eyes smooches under the tuscan sun xoxo
😙 kissing smiling eyes 143 closed eyes date dating eye face flirt ily kiss kisses kissing face with smiling eyes love night smile
🥲 smiling face with tear glad grateful happy joy pain proud smile smiley tear touched relieved smiling
😋 yum delicious eat face face savouring delicious food food full hungry savour savouring smile smiling tasty um yummy
😛 stuck out tongue awesome cool face face with stuck out tongue nice party sweet tongue face with tongue
😜 stuck out tongue winking eye crazy epic eye face face with stuck out tongue & winking eye fun funny joke loopy nutty party tongue wacky weirdo wink yolo
🤪 zany face crazy crazy eyes crazy face eye eyes large small goofy grinning face with one large and one small eye silly
😝 stuck out tongue closed eyes eye face face with stuck out tongue & closed eyes gross horrible omg taste tongue whatever yolo squinting face with tongue
🤑 money mouth face face money mouth paid
🤗 hugging face face hands hug hugging
🤭 face with hand over mouth giggle giggling oops secret shock sudden realization surprise whoops shh shush
🫢 face with open eyes and hand over mouth gasp omg quiet shock shocked surprise cover surprised
🫣 face with peeking eye embarrass hide hiding peek peeking scared shy cover curious
🤫 shushing face be quiet quiet shh shush face with finger covering closed lips
🤔 thinking face chin consider face hmm ponder pondering thinking wondering
🫡 saluting face good luck respect salute yes yes ma'am yes sir military
🤐 zipper mouth face face keep my mouth shut mouth not telling quiet secret zipper shh
🤨 face with raised eyebrow colbert emoji disapproval disbelief distrust hmm mildsurprise scepticism skeptic skeptical surprise what face with one eyebrow raised unsure
😐 neutral face awk awkward bad basic blank dead deadpan expressionless face fine jealous jel jelly neutral not amused not funny not impressed not laughing shade straight face uh uh oh unamused unhappy unimpressed whatever wtf meh
😑 expressionless awk awkward bad basic cost dead expressionless face face fine inexpressive jealous jel jelly no not impressed notimpressed omg straight face uh uh oh uhoh unexpressive unhappy unimpressed whatever wtf meh
😶 no mouth awkward blank cant even expressionless face face without mouth mouth mouthless mute quiet secret silence silent speechless
🫥 dotted line face depressed hidden invisible meh whatever wtv disappear ghost hide
😶‍🌫️ face in clouds brain fog calm chill fog hiding peak smiley absentminded face in the fog head in clouds
😏 smirk boss dapper eyebrows face flirt homie kidding leer shade slick slide sly smirking face smug snicker suave suspicious swag swagger wink
😒 unamused ... bored coolstorybro face fine jealous jel jelly pissed smh ugh uhh unamused face unhappy weird whatever wtf eyeroll
🙄 face with rolling eyes eyeroll eyes face rolling shade ugh whatever
😬 grimacing awk awkward dentist face grimace grimacing face grinning nothing smile smiling
😮‍💨 face exhaling blow blowing exhale exhausted sigh smiley smoke breathe gasp groan relief relieved whisper whistle
🤥 lying face face liar lie pinocchio
🫨 shaking face crazy daze earthquake omg panic shaking shock surprise vibrate whoa wow
🙂‍↔️ head shaking horizontally head shake no smh
🙂‍↕️ head shaking vertically nod nodding yes
😌 relieved calm face peace relief relieved face zen content mindful
😔 pensive awful bored dejected died disappointed face losing lost pensive face sad sucks thinking
😪 sleepy crying face sad sleep sleeping sleepy face tired snore
🤤 drooling face drooling face hungry mouth watering
😴 sleeping bed bedtime face good night goodnight nap night sleep sleeping face tired whatever yawn zz zzz zzzz
😷 mask cold dentist dermatologist doctor dr face face with medical mask germs medicine sick
🤒 face with thermometer face ill sick thermometer
🤕 face with head bandage bandage face hurt injury ouch
🤢 nauseated face face gross nasty nauseated sick vomit throw up
🤮 face vomiting ew gross puke sick spew throw up vomit face with open mouth vomiting
🤧 sneezing face face fever flu gesundheit sick sneeze
🥵 hot face dying face feverish heat stroke hot panting red faced sweating tongue out
🥶 cold face blue blue faced cold cold teeth face freezing frostbite icicles subzero
🥴 woozy face dizzy drunk intoxicated tipsy uneven eyes wavy mouth
😵 dizzy face dead dizzy face feels sick tired knocked out knocked out face
😵‍💫 face with spiral eyes confused dizzy omg smiley whoa woah woozy hypnotized overwhelmed spiral trouble
🤯 exploding head explode mind blown mindblown no way shocked shocked face with exploding head
🤠 face with cowboy hat cowboy cowgirl face hat
🥳 partying face birthday celebrate celebration excited face happy bday happy birthday hat hooray horn party
🥸 disguised face disguise eyebrow glasses moustache mustache person spy tache tash face incognito nose
😎 sunglasses awesome beach bright bro chillin cool eye eyewear face fly glasses maverick rad relaxed shades slay smile smiling face with sunglasses stunner style sun swag swagger win winning yeah
🤓 nerd face brainy clever dork dweeb expert face geek gifted glasses intelligent nerd silly smart
🧐 face with monocle classy fancy rich stuffy wealthy butler curious
😕 confused befuddled confused face confusing dunno face frown hm i dunno meh not sure sad sorry
🫤 face with diagonal mouth confused confusion doubt doubtful frustrated frustration meh skeptical whatever wtv slanted
😟 worried anxious butterflies face nerves nervous sad stress stressed surprised worried face worry
🙁 slightly frowning face face frown sad
☹️ white frowning face face frown frowning face sad slightly frowning face
😮 open mouth face face with open mouth forgot i dont believe you mouth omg open shocked surprised sympathy unbelievable unreal whoa woah wow
😯 hushed epic face hushed face omg stunned surprised whoa woah
😲 astonished astonished face cost face gtfo no way omfg omg shocked totally wtf wow
😳 flushed amazed awk awkward blame dazed dead disbelief embarrassed exercise face flushed face geez heat hot impressed jeez that's crazy what wow
🥺 pleading face begging big eyes face mercy please pretty please puppy eyes sad why not cute
🥹 face holding back tears admiration aw aww embarrassed feelings grateful gratitude please proud sad sadness tears of joy
😦 frowning caught off guard face frown frowning face with open mouth mouth open scared scary suprise what wow
😧 anguished anguished face face forgot scared scary stressed suprise unhappy what wow
😨 fearful afraid anxious blame face fear fearful face scared worried
😰 cold sweat blue cold eek face face with open mouth & cold sweat mouth nervous open rushed scared sweat yikes anxious face with sweat
😥 disappointed relieved anxious close call complicated disappointed disappointed but relieved face face not this time relieved sad sweat whew sad but relieved face
😢 cry awful crying crying face face feels miss sad tear triste unhappy
😭 sob bawling cry crying face loudly crying face sad tear tears unhappy
😱 scream epic face face screaming in fear fear fearful munch scared screamer shocked surprised woah
😖 confounded annoyed confounded face confused cringe distraught face feels frustrated mad sad scrunch
😣 persevere concentrate concentration face focus headache persevering face scrunch
😞 disappointed awful blame dejected disappointed face face fail losing sad unhappy defeated despair
😓 sweat cold face face with cold sweat feels headache nervous sad scared that was close yikes drop
😩 weary crying face fail feels hungry mad nooo sad sleepy tired unhappy weary face despair
😫 tired face cost face feels nap sad sneeze tired despair
🥱 yawning face bedtime bored face goodnight nap night sleep sleepy tired whatever yawn zz zzz zzzz
😤 triumph anger angry face face with steam from nose feels fume fuming furious fury mad steam unhappy huff won
😡 rage anger angry face feels mad maddening pouting pouting face red shade unhappy upset
😠 angry anger angry face blame face feels frustrated mad maddening rage shade unhappy upset
🤬 face with symbols on mouth censor cursing cussing mad pissed swearing serious face with symbols covering mouth
😈 smiling imp devil evil face fairy tale fairytale fantasy horns purple face shade smile smiling face with horns demon devious nasty
👿 imp angry face with horns demon devil evil face fairy tale fairytale fantasy mischievous purple face shade angry horns mad
💀 skull body dead death face fairy tale fairytale i'm dead lmao monster yolo funny laugh
☠️ skull and crossbones bone crossbones dead death monster skull bones funny laugh
💩 hankey bs comic doo doo dung face fml monster pile of poo poo poop smelly smh stink stinks stinky turd shit
🤡 clown face clown face silly
👹 japanese ogre creature devil face fairy tale fairytale fantasy japanese mask monster ogre scary demon
👺 japanese goblin angry creature face fairytale fantasy goblin japanese mask mean monster demon devil
👻 ghost boo creature excited face fairy tale fairytale fantasy ghostface halloween haunting monster scary silly spooky
👽 alien creature extraterrestrial face fairy tale fairytale fantasy monster skrillex space ufo
👾 space invader alien alien monster creature extraterrestrial face fairy tale fairytale fantasy game gamer games monster pixellated space space invaders ufo retro
🤖 robot face face monster robot android
😺 smiley cat animal cat face mouth open smile smiling cat face with open mouth grinning
😸 smile cat animal cat eye face grin grinning cat face with smiling eyes smile
😹 joy cat animal cat cat face with tears of joy face joy laugh laughing lol tear
😻 heart eyes cat animal cat eye face heart love smile smiling cat face with heart eyes heart eyes
😼 smirk cat animal cat cat face with wry smile face ironic smile wry
😽 kissing cat animal cat eye face kiss kissing cat face with closed eyes
🙀 scream cat animal cat face oh surprised weary weary cat face scared
😿 crying cat face animal cat cry face sad tear crying cat
😾 pouting cat animal cat face pouting pouting cat face
🙈 see no evil animal cant watch embarrassed evil face forbidden forgot gesture hide monkey no nono not omg prohibited scared secret see see no evil monkey smh blind
🙉 hear no evil animal ears evil face forbidden gesture hear hear no evil monkey listen monkey no not prohibited secret shh tmi deaf
🙊 speak no evil animal evil face forbidden gesture monkey no not oops prohibited quiet secret speak speak no evil monkey stealth mute
💌 love letter heart letter love mail romance valentine heart letter
💘 cupid 143 adorbs arrow date emotion heart heart with arrow ily love romance valentine
💝 gift heart 143 anniversary emotion heart heart with ribbon ily kisses ribbon valentine xoxo
💖 sparkling heart 143 emotion excited good night heart ily kisses morning sparkle sparkling xoxo
💗 heartpulse 143 emotion excited growing growing heart heart ily kisses muah nervous pulse xoxo
💓 heartbeat 143 beating beating heart cardio emotion heart ily love pulsating pulse
💞 revolving hearts 143 adorbs anniversary emotion heart revolving
💕 two hearts 143 anniversary date dating emotion heart hearts ily kisses love loving xoxo double heart
💟 heart decoration 143 emotion heart purple heart white hearth purple
❣️ heavy heart exclamation mark ornament exclamation heavy heart exclamation mark punctuation heart drop heart exclamation
💔 broken heart break broken crushed emotion heartbroken lonely sad heart break
❤️‍🔥 heart on fire burn fire flaming heart fuego heart love love you passion burning heart lust sacred heart
❤️‍🩹 mending heart bandaged broken heal heartbreak heartbroken hurt on the mend ouch poor you healthier heart mending improving mending recovering recuperating well
❤️ heart emotion love red heart
🩷 pink heart 143 adorable cute emotion heart ily like love pink special sweet
🧡 orange heart orange heart orange
💛 yellow heart 143 cardiac emotion heart ily love yellow heart yellow
💚 green heart 143 emotion green heart ily love romantic heart green
💙 blue heart 143 blue emotion heart ily love romance heart blue
🩵 light blue heart 143 cute cyan emotion heart ily light blue like love sky blue special teal
💜 purple heart 143 bestest emotion heart ily love purple heart purple
🤎 brown heart brown heart brownheart heart brown
🖤 black heart black evil heart wicked heart black
🩶 grey heart 143 emotion gray grey heart ily love silver special
🤍 white heart heart white heart white
💋 kiss dating emotion heart kiss mark kissing lips romance sexy smooch
💯 100 a+ agree bruh clearly definitely faithful fleek full hbd homie hundred hundred points keep it 100 kidding on point perfect score score true truth yup
💢 anger anger symbol angry comic mad upset
💥 boom bomb collide collision comic explode
💫 dizzy comic shining shooting star star stars
💦 sweat drops comic drip droplet droplets drops splashing squirt sweat sweat droplets water wet work out workout
💨 dash cloud comic dashing away fart fast gone gotta go running smoke
🕳️ hole pit
💬 speech balloon balloon bubble comic dialog message sms speech talk text typing
👁️‍🗨️ eye in speech bubble eye speech bubble witness
🗨️ left speech bubble dialog speech balloon bubble comic
🗯️ right anger bubble angry balloon bubble mad danger
💭 thought balloon balloon bubble cartoon cloud comic daydream decisions dream dreams idea invent invention realize think thinking thought thoughts wonder
💤 zzz comic goodnight night sleep sleeping sleepy tired zz zzzz
👋 wave bye cya felicia g2g greetings gtg hand hello hey hi later outtie ttfn ttyl u there? waving waving hand yo goodbye
🤚 raised back of hand backhand raised handraise
🖐️ raised hand with fingers splayed finger hand splayed stop handraise
✋ hand five high five raised hand stop handraise hifive high 5
🖖 spock hand finger hand hands spock star trek vulcan vulcan salute
🫱 rightwards hand hand handshake hold reach right hand shake
🫲 leftwards hand hand handshake hold left hand reach shake
🫳 palm down hand drop dropped hand pick pick up grab take
🫴 palm up hand come don't know hand hold lift offer tell me
🫷 leftwards pushing hand block halt hand high five hold leftward pause push refuse slap five stop wait
🫸 rightwards pushing hand block halt hand high five hold pause push refuse rightward slap five stop wait
👌 ok hand awesome bet dope fleek for sure fosho got it gotcha hand legit ok okay pinch rad sure sweet three
🤌 pinched fingers hand hold on huh patience relax ugh what zip it
🤏 pinching hand fingers little bit small small amount sort of little
✌️ v hand peace victory victory hand
🤞 crossed fingers cross finger fingers crossed hand luck hope
🫰 hand with index finger and thumb crossed <3 expensive hand heart love money finger heart snap
🤟 i love you hand sign hand i love you ily love you gesture three fingers
🤘 the horns finger hand horns rock on sign of the horns metal
🤙 call me hand call hand right on shaka sign thanks
👈 point left backhand backhand index pointing left finger hand index left point
👉 point right backhand backhand index pointing right finger hand index point right
👆 point up 2 backhand backhand index pointing up finger hand index point up agree
🖕 middle finger finger hand
👇 point down backhand backhand index pointing down down finger hand index point agree
☝️ point up finger hand index index pointing up point this up agree
🫵 index pointing at the viewer finger hand point poke you i want you uncle same
👍 +1 awesome dope fleek for sure fosho good gotcha great hand legit like nice okay rad sure thumb thumbs up tubular up yeah yes thumbsup
👎 1 bad dislike down hand no no good nope thumb thumbs down thumbsdown
✊ fist clenched hand raised fist solidarity punch
👊 facepunch absolutely agree boom bro bruh bump clenched correct fist hand knuckle oncoming fist pound punch rock ttyl
🤛 left facing fist fist leftwards bump
🤜 right facing fist fist rightwards bump
👏 clap applause approval awesome clapping hands congrats congratulations excited good job great hand homie nice prayed well done yay
🙌 raised hands celebration gesture hand hooray praise raised raising hands
🫶 heart hands <3 hands heart love love you handes
👐 open hands hand hug jazz hands open swerve yay
🤲 palms up together cupped hands dua pray prayer wish
🤝 handshake agreement deal hand meeting shake
🙏 pray appreciate ask beg blessed bow cmon five folded folded hands gesture hand high five please thank thank you thanks thx high 5
✍️ writing hand hand write
💅 nail care bored care cosmetics i'm done makeup manicure nail nail polish polish whatever
🤳 selfie camera phone
💪 muscle arm beast bench press biceps body bodybuilder bro comic curls flex flexed biceps flexing gains gym jacked ripped strong weightlift weightlifter
🦾 mechanical arm accessibility prosthetic metal strong
🦿 mechanical leg accessibility prosthetic metal
🦵 leg bent leg foot kick knee limb
🦶 foot ankle feet kick stomp
👂 ear body ears hear hearing listen listening sound
🦻 ear with hearing aid accessibility hard of hearing deaf
👃 nose body noses nosey odor smell smells
🧠 brain intelligent smart
🫀 anatomical heart anatomical beat heart heartbeat real heart red cardiology organ pulse
🫁 lungs breathe lung breath exhalation inhalation organ respiration
🦷 tooth dentist pearly teeth white
🦴 bone bones dog skeleton wishbone
👀 eyes body eye face googley look looking omg peep see seeing stare
👁️ eye 1 eye body one eye stare
👅 tongue body lick slurp
👄 lips beauty body kiss kissing lipstick mouth
🫦 biting lip bite flirt kiss lip lipstick nervous sexy worried worry lips mouth
👶 baby babies children goo goo infant newborn pregnant young
🧒 child gender neutral kid young unspecified gender
👦 boy kid young
👧 girl bangs bright eyed daughter lady pigtails young virgo zodiac
🧑 adult gender neutral person unspecified gender
👱 person with blond hair blond haired person blonde dude flat top man blond
👨 man boy boyfriend bro friend adult male
🧔 bearded person beard bearded bewhiskered person
🧔‍♂️ man with beard beard dude facial hair man person male
🧔‍♀️ woman with beard beard facial hair person trans woman female
👨‍🦰 red haired man adult man person red hair
👨‍🦱 curly haired man adult curly hair man person
👨‍🦳 white haired man adult man person white hair
👨‍🦲 bald man adult bald man shaved head
👩 woman blonde blondie haircut lady adult female
👩‍🦰 red haired woman adult person red hair woman
🧑‍🦰 red haired person
👩‍🦱 curly haired woman adult curly hair person woman
🧑‍🦱 curly haired person
👩‍🦳 white haired woman adult person white hair woman
🧑‍🦳 white haired person
👩‍🦲 bald woman adult bald shaved head woman
🧑‍🦲 bald person
👱‍♀️ blond haired woman blonde woman female hair
👱‍♂️ blond haired man blond hair male man
🧓 older adult gender neutral old adult older person
👴 older man bald elderly grandfather grandpa losing hair man old old dude old man wise adult male
👵 older woman bad haircut blond blondie grandma grandmother granny lady old old woman wise woman adult female
🙍 person frowning disgruntled frown gesture upset woman frowning male
🙍‍♂️ man frowning disgruntled frown gesture upset frowning male man
🙍‍♀️ woman frowning female frowning gesture woman
🙎 person with pouting face gesture person pouting pouting woman pouting
🙎‍♂️ man pouting gesture pouting male man
🙎‍♀️ woman pouting female gesture pouting woman
🙅 no good forbidden gesture hand no nope not person gesturing no prohibited woman gesturing no crossed arms x
🙅‍♂️ man gesturing no forbidden gesture hand no nope not prohibited crossed arms male x
🙅‍♀️ woman gesturing no crossed arms female forbidden gesture hand no nope not prohibited x
🙆 ok woman exercise gesture hand ok omg person gesturing ok woman gesturing ok ok person
🙆‍♂️ man gesturing ok exercise gesture hand ok omg male
🙆‍♀️ woman gesturing ok exercise female gesture hand ok omg
💁 information desk person diva fetch gossip hair flick hair flip hand help information person tipping hand sarcasm sarcastic sassy tipping whatever woman tipping hand
💁‍♂️ man tipping hand diva fetch gossip hair flick hair flip hand help information sarcasm sarcastic sassy tipping whatever male man tipping hand
💁‍♀️ woman tipping hand female sassy tipping hand woman
🙋 raising hand gesture hand hands i know me person raising hand question raised woman raising hand handraise hello hey hi
🙋‍♂️ man raising hand gesture hand hands i know me person raising hand question raised handraise hello hey hi male raising hand
🙋‍♀️ woman raising hand female gesture hand handraise hands hello hey hi i know me person raising hand question raised raising hand
🧏 deaf person accessibility deaf ear hear
🧏‍♂️ deaf man deaf ear hear male man
🧏‍♀️ deaf woman deaf ear female hear woman
🙇 bow apology gesture man bowing meditate meditation person bowing sorry
🙇‍♂️ man bowing apology bowing favor gesture male man sorry
🙇‍♀️ woman bowing apology bow gesture meditate meditation sorry bowing favor female woman
🤦 face palm disbelief exasperation face facepalm palm smh
🤦‍♂️ man facepalming disbelief exasperation facepalm man smh face male palm
🤦‍♀️ woman facepalming disbelief exasperation facepalm smh woman face female palm
🤷 shrug doubt ignorance indifference
🤷‍♂️ man shrugging doubt dunno i dunno idk ignorance indifference man shrug don't know male
🤷‍♀️ woman shrugging doubt dunno i dunno idk ignorance indifference shrug woman don't know female
🧑‍⚕️ health worker doctor healthcare nurse therapist
👨‍⚕️ male doctor doctor healthcare man nurse therapist male
👩‍⚕️ female doctor doctor healthcare nurse therapist woman female
🧑‍🎓 student graduate
👨‍🎓 male student graduate man student male
👩‍🎓 female student graduate student woman female
🧑‍🏫 teacher instructor professor
👨‍🏫 male teacher instructor man professor teacher male
👩‍🏫 female teacher instructor professor teacher woman female
🧑‍⚖️ judge court justice law scales
👨‍⚖️ male judge judge justice man scales court law male
👩‍⚖️ female judge judge justice scales woman court female law
🧑‍🌾 farmer gardener rancher
👨‍🌾 male farmer farmer gardener man rancher male
👩‍🌾 female farmer farmer gardener rancher woman female
🧑‍🍳 cook chef
👨‍🍳 male cook chef cook man male
👩‍🍳 female cook chef cook woman female
🧑‍🔧 mechanic electrician plumber tradesperson
👨‍🔧 male mechanic electrician man mechanic plumber tradesperson male
👩‍🔧 female mechanic electrician mechanic plumber tradesperson woman female
🧑‍🏭 factory worker assembly factory industrial worker
👨‍🏭 male factory worker assembly factory industrial man worker male
👩‍🏭 female factory worker assembly factory industrial woman worker female
🧑‍💼 office worker architect business manager white collar
👨‍💼 male office worker architect business man manager office male white collar
👩‍💼 female office worker architect business manager office woman female white collar
🧑‍🔬 scientist biologist chemist engineer physicist
👨‍🔬 male scientist biologist chemist engineer man mathematician physicist scientist
👩‍🔬 female scientist biologist chemist engineer mathematician physicist scientist woman
🧑‍💻 technologist coder developer inventor programmer software
👨‍💻 male technologist coder computer developer inventor man software technologist programmer
👩‍💻 female technologist coder computer developer inventor software technologist woman programmer
🧑‍🎤 singer actor entertainer rock star
👨‍🎤 male singer actor entertainer man rock rockstar singer star male
👩‍🎤 female singer actor entertainer rock rockstar singer star woman female
🧑‍🎨 artist painter palette
👨‍🎨 male artist artist man palette male painter
👩‍🎨 female artist artist palette woman female painter
🧑‍✈️ pilot plane
👨‍✈️ male pilot man pilot plane male
👩‍✈️ female pilot pilot plane woman female
🧑‍🚀 astronaut rocket
👨‍🚀 male astronaut astronaut man rocket space male
👩‍🚀 female astronaut astronaut rocket space woman female
🧑‍🚒 firefighter firetruck
👨‍🚒 male firefighter firefighter firetruck man male
👩‍🚒 female firefighter firefighter firetruck woman female
👮 cop man officer police police officer policeman
👮‍♂️ male police officer cop male man officer police
👮‍♀️ female police officer cop officer police police officer woman female
🕵️ sleuth or spy detective man sleuth spy
🕵️‍♂️ male detective detective sleuth spy
🕵️‍♀️ female detective detective sleuth spy
💂 guardsman buckingham palace guard helmet london
💂‍♂️ male guard guard male man
💂‍♀️ female guard buckingham palace guard helmet london woman female
🥷 ninja assassin fight person secret skills sly soldier war fighter hidden stealth
👷 construction worker construction hardhat hat helmet man work worker
👷‍♂️ male construction worker construction male man worker
👷‍♀️ female construction worker construction construction worker hardhat hat helmet woman work worker female
🫅 person with crown crown king queen royal royalty
🤴 prince royal royalty king
👸 princess crown fairy tale fairytale fantasy queen royal
👳 man with turban man wearing turban person wearing turban turban
👳‍♂️ man wearing turban male man turban
👳‍♀️ woman wearing turban turban female woman
👲 man with gua pi mao guapimao hat man man with chinese cap cap gua pi mao person skullcap
🧕 person with headscarf bandana headkerchief headscarf hijab mantilla tichel woman with headscarf
🤵 person in tuxedo formal groom man tuxedo person wedding
🤵‍♂️ man in tuxedo charming cocktail dress up formal gentleman male person tux tuxedo groom man wedding
🤵‍♀️ woman in tuxedo charming cocktail dress up female formal person tux tuxedo women groom wedding woman
👰 bride with veil bride veil wedding person person with veil
👰‍♂️ man with veil bride male man marriage marry person veil wedding
👰‍♀️ woman with veil bride female marriage marry person veil wedding woman
🤰 pregnant woman pregnant woman baby female
🫃 pregnant man man overeat pregnant
🫄 pregnant person overeat pregnant
🤱 breast feeding baby breast nursing
👩‍🍼 woman feeding baby baby feed love mam mammy mom mother nanny newborn person nursing
👨‍🍼 man feeding baby baby dad father feed love male man nanny newborn person nursing
🧑‍🍼 person feeding baby baby dad feed man mom nanny newborn person woman nursing
👼 angel baby baby angel church face fairy tale fairytale fantasy
🎅 santa celebration christmas claus fairy tale fantasy father santa claus male
🤶 mrs claus celebration christmas claus mother mrs. santa mother christmas
🧑‍🎄 mx claus christmas hat holiday merry xmas person santa santa claus santy xmas
🦸 superhero batman good hero heroine superman superpower superpowers
🦸‍♂️ male superhero batman good good guy hero man superhero superman superpower superpowers male man superhero
🦸‍♀️ female superhero batwoman good hero heroine superhero superpower superpowers superwoman woman female
🦹 supervillain bad criminal evil superpower superpowers villain
🦹‍♂️ male supervillain bad bad guy criminal evil man superpower superpowers supervillain villain male man supervillain
🦹‍♀️ female supervillain bad criminal evil superpower superpowers supervillain villain woman female
🧙 mage sorcerer sorceress witch wizard
🧙‍♂️ male mage mage magic man mage sorcerer spell wizard male
🧙‍♀️ female mage mage magic sorceress spell witch woman mage female wizard
🧚 fairy oberon puck titania
🧚‍♂️ male fairy fairy man fairy oberon puck wings male
🧚‍♀️ female fairy fairy titania wings woman fairy female
🧛 vampire dracula undead
🧛‍♂️ male vampire blood dracula fangs man vampire teeth undead male
🧛‍♀️ female vampire blood fangs teeth undead vampire woman vampire dracula female
🧜 merperson mermaid merman merwoman
🧜‍♂️ merman triton male
🧜‍♀️ mermaid merwoman female
🧝 elf magical
🧝‍♂️ male elf elf magical man elf male
🧝‍♀️ female elf elf lotr style magical woman elf female
🧞 genie djinn
🧞‍♂️ male genie djinn genie jinn man genie male
🧞‍♀️ female genie djinn genie jinn woman genie female
🧟 zombie undead walking dead
🧟‍♂️ male zombie halloween man zombie scary undead walking dead zombie
🧟‍♀️ female zombie halloween scary undead walking dead woman zombie zombie
🧌 troll monster trolling
💆 massage face headache person getting massage relax relaxing salon soothe tension woman getting massage
💆‍♂️ man getting massage face headache massage relax relaxing salon soothe tension male man
💆‍♀️ woman getting massage face female massage woman
💇 haircut barber beauty hair parlor person getting haircut woman getting haircut
💇‍♂️ man getting haircut barber beauty hair haircut parlor male man
💇‍♀️ woman getting haircut female haircut woman
🚶 walking amble hike man walking pedestrian person walking saunter stride stroll swagger walk
🚶‍♂️ man walking hike male man walk
🚶‍♀️ woman walking amble hike pedestrian saunter stride stroll swagger walk walking female woman
🚶‍➡️ person walking facing right
🚶‍♀️‍➡️ woman walking facing right
🚶‍♂️‍➡️ man walking facing right
🧍 standing person person standing stand standing
🧍‍♂️ man standing male man standing
🧍‍♀️ woman standing female standing woman
🧎 kneeling person kneel kneeling knees on your knees person kneeling
🧎‍♂️ man kneeling kneeling male man
🧎‍♀️ woman kneeling female kneeling woman
🧎‍➡️ person kneeling facing right
🧎‍♀️‍➡️ woman kneeling facing right
🧎‍♂️‍➡️ man kneeling facing right
🧑‍🦯 person with probing cane accessibility blind cane
🧑‍🦯‍➡️ person with white cane facing right
👨‍🦯 man with probing cane accessibility blind man cane male
👨‍🦯‍➡️ man with white cane facing right
👩‍🦯 woman with probing cane accessibility blind woman cane female
👩‍🦯‍➡️ woman with white cane facing right
🧑‍🦼 person in motorized wheelchair accessibility wheelchair
🧑‍🦼‍➡️ person in motorized wheelchair facing right
👨‍🦼 man in motorized wheelchair accessibility man wheelchair male
👨‍🦼‍➡️ man in motorized wheelchair facing right
👩‍🦼 woman in motorized wheelchair accessibility wheelchair woman female
👩‍🦼‍➡️ woman in motorized wheelchair facing right
🧑‍🦽 person in manual wheelchair accessibility wheelchair
🧑‍🦽‍➡️ person in manual wheelchair facing right
👨‍🦽 man in manual wheelchair accessibility man wheelchair male
👨‍🦽‍➡️ man in manual wheelchair facing right
👩‍🦽 woman in manual wheelchair accessibility wheelchair woman female
👩‍🦽‍➡️ woman in manual wheelchair facing right
🏃 runner coming fast hurry man running marathon person running quick running rush speed
🏃‍♂️ man running male man marathon racing running
🏃‍♀️ woman running coming fast hurry marathon quick runner running rush speed female racing woman
🏃‍➡️ person running facing right
🏃‍♀️‍➡️ woman running facing right
🏃‍♂️‍➡️ man running facing right
💃 dancer dance dancing elegant festive flair flamenco groove let's dance salsa tango woman woman dancing female
🕺 man dancing dance dancer dancing elegant festive flair flamenco groove let's dance salsa tango woman male man
🕴️ man in business suit levitating business man suit person
👯 dancers bff bunny bunny ear dancer party partying twinsies women people with bunny ears
👯‍♂️ men with bunny ears partying bff bunny ear dancer men party partying twinsies
👯‍♀️ women with bunny ears partying bunny ear dancer partying women
🧖 person in steamy room sauna spa steam room
🧖‍♂️ man in steamy room relax sauna steam room steamy male spa
🧖‍♀️ woman in steamy room relax sauna steam room steamy female spa
🧗 person climbing climber
🧗‍♂️ man climbing climber climbing mountain rock climber male
🧗‍♀️ woman climbing climber climbing mountain rock climber female
🤺 fencer fencing sword person fencing
🏇 horse racing horse jockey racehorse racing riding sport triple crown
⛷️ skier ski snow
🏂 snowboarder ski snow snowboard sport
🏌️ golfer ball driving range golf man golfing person golfing swing
🏌️‍♂️ man golfing swing
🏌️‍♀️ woman golfing ball swing
🏄 surfer beach man surfing ocean person surfing sport surfing waves
🏄‍♂️ man surfing male man surfing
🏄‍♀️ woman surfing beach ocean person surfing sport surfer surfing waves female woman
🚣 rowboat boat cruise fishing lake man rowing boat person rowing boat river row rowing
🚣‍♂️ man rowing boat boat male man rowboat
🚣‍♀️ woman rowing boat boat cruise fishing lake river row rowboat rowing female woman
🏊 swimmer man swimming person swimming sport swim swimming
🏊‍♂️ man swimming male man swim swimmer
🏊‍♀️ woman swimming sport swim swimmer swimming female woman
⛹️ person with ball ball basketball basketball player man bouncing ball person bouncing ball
⛹️‍♂️ man bouncing ball
⛹️‍♀️ woman bouncing ball ball
🏋️ weight lifter lifter man lifting weights person lifting weights weight weightlifter workout body builder
🏋️‍♂️ man lifting weights body builder
🏋️‍♀️ woman lifting weights body builder
🚴 bicyclist bicycle bike biking cyclist man biking person biking riding sport
🚴‍♂️ man biking bicycle biking cyclist male man
🚴‍♀️ woman biking bicycle bicyclist bike biking cyclist riding sport
🚵 mountain bicyclist bicycle bicyclist bike cyclist man mountain biking mountain person mountain biking riding sport
🚵‍♂️ man mountain biking bicycle bike cyclist male man mountain
🚵‍♀️ woman mountain biking bicycle bicyclist bike cyclist mountain riding sport biking
🤸 person doing cartwheel cartwheel gymnastics person cartwheeling
🤸‍♂️ man cartwheeling cartwheel gymnastics man male
🤸‍♀️ woman cartwheeling cartwheel gymnastics woman female
🤼 wrestlers people wrestling wrestle wrestler
🤼‍♂️ man wrestling men wrestle wrestling
🤼‍♀️ woman wrestling women wrestle wrestling
🤽 water polo person playing water polo polo water
🤽‍♂️ man playing water polo man water polo
🤽‍♀️ woman playing water polo water polo woman
🤾 handball ball person playing handball
🤾‍♂️ man playing handball handball man
🤾‍♀️ woman playing handball handball woman
🤹 juggling balance juggle multitask person juggling skill
🤹‍♂️ man juggling juggle juggling man multitask
🤹‍♀️ woman juggling juggle juggling multitask woman
🧘 person in lotus position meditate meditation yoga
🧘‍♂️ man in lotus position cross legged legs crossed meditation relax yoga yogi
🧘‍♀️ woman in lotus position cross legged legs crossed meditation relax yoga yogi
🛀 bath bathtub person taking bath tub bathing
🛌 sleeping accommodation bed bedtime goodnight hotel nap night person in bed sleep tired zz zzz zzzz
🧑‍🤝‍🧑 people holding hands couple hand hold holding hands person
👭 two women holding hands bae bestfriend bestfriends bestie bff bond bonding couple dating daughters everyone friend friends friendship gay girls glbt glbtq hand hold ladies lesbian lgbt lgbtq lgbtqia queer sis sister sisters woman women
👫 man and woman holding hands bae couple dating everyone flirt friend friends hold in love man woman
👬 two men holding hands bae boys couple dating everyone friend friends gay glbt glbtq hand hold in love lgbt lgbtq lgbtqia man queer twins zodiac
💏 couplekiss anniversary babe bae couple date dating heart kiss love mwah person romance together xoxo
👩‍❤️‍💋‍👨 woman kiss man babe bae couple dating kiss love person wife wifey xoxo
👨‍❤️‍💋‍👨 man kiss man anniversary babe bae couple date dating gay heart kiss love person pride romance xoxo
👩‍❤️‍💋‍👩 woman kiss woman anniversary babe bae bisexual couple date dating gay glbt glbtq heart kiss lesbian lgbt lgbtq lgbtqia love person pride queer relationship romance together
💑 couple with heart anniversary babe bae couple dating heart kiss love love you person relationship romance together
👩‍❤️‍👨 woman heart man
👨‍❤️‍👨 man heart man anniversary babe bae bisexual couple couple with heart dating gay glbt glbtq heart kiss lgbt lgbtq lgbtqia love person pride queer relationship romance together
👩‍❤️‍👩 woman heart woman anniversary babe bae bisexual couple couple with heart dating gay glbt glbtq heart kiss lesbian lgbt lgbtq lgbtqia love person pride queer relationship romance together
👨‍👩‍👦 man woman boy
👨‍👩‍👧 man woman girl family girl man woman
👨‍👩‍👧‍👦 man woman girl boy boy family girl man woman
👨‍👩‍👦‍👦 man woman boy boy boy family man woman
👨‍👩‍👧‍👧 man woman girl girl family girl man woman
👨‍👨‍👦 man man boy bisexual boy family gay glbt glbtq lgbt lgbtq lgbtqia man queer
👨‍👨‍👧 man man girl bisexual family gay girl glbt glbtq lgbt lgbtq lgbtqia man
👨‍👨‍👧‍👦 man man girl boy bisexual boy family gay girl glbt glbtq lgbtq lgbtqia man queer
👨‍👨‍👦‍👦 man man boy boy bisexual boy family gay glbt glbtq lgbt lgbtq lgbtqia man queer
👨‍👨‍👧‍👧 man man girl girl bisexual family gay girl glbt glbtq lgbt lgbtq lgbtqia man queer
👩‍👩‍👦 woman woman boy bisexual boy family gay glbt glbtq lesbian lgbt lgbtq lgbtqia queer woman
👩‍👩‍👧 woman woman girl bisexual family gay girl glbt glbtq lesbian lgbt lgbtq lgbtqia queer woman
👩‍👩‍👧‍👦 woman woman girl boy boy family girl woman
👩‍👩‍👦‍👦 woman woman boy boy boy family woman
👩‍👩‍👧‍👧 woman woman girl girl family girl woman
👨‍👦 man boy boy family man
👨‍👦‍👦 man boy boy boy family man
👨‍👧 man girl family girl man
👨‍👧‍👦 man girl boy boy family girl man
👨‍👧‍👧 man girl girl family girl man
👩‍👦 woman boy boy family woman
👩‍👦‍👦 woman boy boy boy family woman
👩‍👧 woman girl family girl woman
👩‍👧‍👦 woman girl boy boy family girl woman
👩‍👧‍👧 woman girl girl family girl woman
🗣️ speaking head in silhouette face head silhouette speak speaking speaking head shadow shout
👤 bust in silhouette bust mysterious shadow silhouette
👥 busts in silhouette bff bust everyone friend friends people silhouette shadow
🫂 people hugging comfort embrace farewell friendship goodbye hug hugging love hello shadow thanks
👪 family child
🧑‍🧑‍🧒 family adult adult child
🧑‍🧑‍🧒‍🧒 family adult adult child child
🧑‍🧒 family adult child
🧑‍🧒‍🧒 family adult child child
👣 footprints barefoot clothing footprint omw print walk
🐵 monkey face animal banana curious george face monkey
🐒 monkey animal banana
🦍 gorilla animal
🦧 orangutan animal ape monkey
🐶 dog adorbs animal dog face face pet puppies puppy
🐕 dog2 animal animals dog dogs pet puppy
🦮 guide dog accessibility blind guide assistance dog service
🐕‍🦺 service dog accessibility assistance dog service
🐩 poodle animal dog fluffy
🐺 wolf animal face wolf face
🦊 fox face animal face fox
🦝 raccoon animal curious sly
🐱 cat animal cat face face kitten kitty pet
🐈 cat2 animal animals cat cats kitten pet kitty
🐈‍⬛ black cat animal black cat feline halloween meow kitten kitty unlucky
🦁 lion face alpha animal face leo lion lion order mane rawr roar safari strong zodiac
🐯 tiger animal big cat face predator tiger face
🐅 tiger2 animal animals big cat predator tiger zoo
🐆 leopard animal animals big cat predator zoo cheetah jaguar panther
🐴 horse animal dressage equine face farm horse face horses
🫎 moose alces animal antlers elk mammal
🫏 donkey animal burro hinny mammal mule stubborn
🐎 racehorse animal belmont stakes equestrian farm horse kentucky derby preakness racing triple crown
🦄 unicorn face face unicorn
🦓 zebra face stripe zebra
🦌 deer animal antelope elk moose reindeer
🦬 bison animal buffalo herd wisent
🐮 cow animal cow face face farm milk moo
🐂 ox animal animals bull farm taurus zodiac cow
🐃 water buffalo animal animals buffalo water zoo
🐄 cow2 animal animals cow farm milk moo
🐷 pig animal bacon face farm pig face pork wilbur piggy
🐖 pig2 animal animals bacon farm fat pig pork sow piggy
🐗 boar animal game of thrones pig piggy
🐽 pig nose animal face farm nose pig smel snout piggy
🐏 ram animal animals aries horns sheep zodiac zoo
🐑 sheep animal baa ewe farm fluffy lamb wool
🐐 goat animal animals capricorn farm milk zodiac
🐪 dromedary camel animal camel desrt dromedary hump one hump desert
🐫 camel animal bactrian desert hump two hump two hump camel
🦙 llama alpaca animal guanaco vicuña wool
🦒 giraffe face giraffe spots
🐘 elephant animal
🦣 mammoth animal woolly mammoth extinction large tusk woolly
🦏 rhinoceros animal rhino
🦛 hippopotamus animal hippo
🐭 mouse animal face mouse face
🐁 mouse2 animal animals mouse
🐀 rat animal
🐹 hamster animal face hamster face pet chinchilla gerbil guinea pig
🐰 rabbit animal bunny face pet rabbit face
🐇 rabbit2 animal animals bunny pet rabbit
🐿️ chipmunk squirrel acorn nuts
🦫 beaver animal teeth dam
🦔 hedgehog spiny
🦇 bat animal vampire
🐻 bear animal bear face face grizzly growl honey yosemite
🐻‍❄️ polar bear animal bear cold north pole arctic white
🐨 koala animal australia bear down under
🐼 panda face animal bamboo face panda bear
🦥 sloth lazy slow
🦦 otter fishing playful
🦨 skunk stink
🦘 kangaroo animal australia joey jump marsupial
🦡 badger animal honey badger pester
🐾 feet paw paw prints paws print
🦃 turkey gobble thanksgiving bird
🐔 chicken animal bird hen
🐓 rooster animal animals birds bird chicken hen
🐣 hatching chick animal baby bird chick egg hatching
🐤 baby chick animal baby bird chick
🐥 hatched chick animal baby chick front facing baby chick newborn bird front
🐦 bird animal ornithology
🐧 penguin animal antartica bird
🕊️ dove of peace bird dove fly peace
🦅 eagle animal bird
🦆 duck animal bird
🦢 swan animal bird cygnet ugly duckling
🦉 owl animal bird wise
🦤 dodo animal bird extinction large mauritius
🪶 feather bird flight light plumage
🦩 flamingo flamboyant tropical
🦚 peacock animal bird colorful ostentatious peahen pretty bird proud
🦜 parrot animal bird pirate talk
🪽 wing angelic ascend aviation fly flying heavenly mythology soar
🐦‍⬛ black bird animal beak bird black caw corvid crow raven rook
🪿 goose animal bird duck flock fowl gaggle gander geese silly
🐦‍🔥 phoenix bird fawkes fire
🐸 frog animal face frog face princess
🐊 crocodile animal animals crocodile dundee florida zoo
🐢 turtle animal terrapin tortoise turtles
🦎 lizard animal reptile
🐍 snake animal bearer ophiuchus serpent zodiac
🐲 dragon face animal dragon face fairy tale fairytale
🐉 dragon animal chinese fairy tale fairytale game of thrones knights
🦕 sauropod brachiosaurus brontosaurus dinosaur diplodocus
🦖 t rex dinosaur tyrannosaurus rex
🐳 whale animal beach face ocean spouting spouting whale
🐋 whale2 animal beach ocean whale
🐬 dolphin animal beach flipper ocean
🦭 seal animal ocean sea lion
🐟 fish animal dinner fishes fishing pisces zodiac
🐠 tropical fish animal fish fishes tropical
🐡 blowfish animal fish
🦈 shark animal fish
🐙 octopus animal creature ocean
🐚 shell animal beach conch sea shell spiral spiral shell
🪸 coral climate change reef sea
🪼 jellyfish animal aquarium jelly marine ocean plankton sea sea life sting tentacles
🐌 snail animal escargot garden nature slug
🦋 butterfly insect pretty
🐛 bug animal garden insect
🐜 ant animal garden insect
🐝 bee animal bumblebee honey honeybee insect nature spring
🪲 beetle animal bug insect
🐞 ladybug animal beetle garden insect lady beetle ladybird nature
🦗 cricket bug grasshopper insect orthoptera
🪳 cockroach animal gross insect pest roach
🕷️ spider insect
🕸️ spider web spider web
🦂 scorpion scorpio scorpius zodiac
🦟 mosquito bite disease fever insect malaria virus pest
🪰 fly animal blue bottle insect disease maggot pest rotting
🪱 worm animal earthworm annelid parasite
🦠 microbe amoeba bacteria science virus
💐 bouquet anniversary birthday date flower love plant romance
🌸 cherry blossom blossom cherry flower plant spring springtime
💮 white flower flower
🪷 lotus beauty calm flower peace serenity
🏵️ rosette plant
🌹 rose beauty elegant flower love rose plant red valentine
🥀 wilted flower dying flower wilted
🌺 hibiscus flower plant
🌻 sunflower flower outdoors plant sun
🌼 blossom buttercup dandelion flower plant
🌷 tulip blossom flower growth plant
🪻 hyacinth bloom bluebonnet flower indigo lavender lilac plant purple shrub spring violet
🌱 seedling plant sapling sprout young
🪴 potted plant decor plant pot boring grow house nurturing useless
🌲 evergreen tree christmas tree evergreen forest pine tree tree
🌳 deciduous tree deciduous forest green habitat shedding tree
🌴 palm tree beach palm plant tree tropical
🌵 cactus desert drought nature plant
🌾 ear of rice grain grains plant rice sheaf of rice ear
🌿 herb leaf plant
☘️ shamrock irish plant clover leaf three three leaf clover
🍀 four leaf clover 4 clover four irish leaf lucky plant
🍁 maple leaf falling leaf maple
🍂 fallen leaf autumn fall falling leaf
🍃 leaves blow flutter leaf leaf fluttering in wind wind
🪹 empty nest branch home nest
🪺 nest with eggs bird branch egg eggs nest
🍄 mushroom fungus mario toadstool
🍇 grapes dionyses fruit grape
🍈 melon cantaloupe fruit
🍉 watermelon fruit
🍊 tangerine citrus fruit nectarine orange vitamin c
🍋 lemon citrus fruit sour
🍋‍🟩 lime
🍌 banana fruit potassium
🍍 pineapple colada fruit pina tropical
🥭 mango food fruit shaker tropical
🍎 apple diet food fruit health red red apple ripe
🍏 green apple apple fruit green
🍐 pear fruit
🍑 peach fruit
🍒 cherries cherry fruit berries red
🍓 strawberry berry fruit
🫐 blueberries berries berry blueberry food fruit
🥝 kiwifruit food fruit kiwi
🍅 tomato food fruit vegetable
🫒 olive food
🥥 coconut palm piña colada
🥑 avocado food fruit
🍆 eggplant aubergine vegetable
🥔 potato food vegetable
🥕 carrot food vegetable
🌽 corn crops ear of corn farm maize maze ear
🌶️ hot pepper hot pepper
🫑 bell pepper food pepper capsicum vegetable
🥒 cucumber food pickle vegetable
🥬 leafy green bok choy burgers cabbage kale lettuce salad
🥦 broccoli wild cabbage
🧄 garlic flavoring
🧅 onion flavoring
🥜 peanuts food nut peanut vegetable
🫘 beans food small
🌰 chestnut almond plant
🫚 ginger root beer ginger health herb natural root spice
🫛 pea pod beans beanstalk edamame legume pea pod soybean vegetable veggie
🍄‍🟫 brown mushroom
🍞 bread carbs food grain loaf restaurant toast wheat
🥐 croissant bread crescent roll food french breakfast roll
🥖 baguette bread baguette bread food french
🫓 flatbread arepa bread food gordita lavash naan pita
🥨 pretzel convoluted twisted
🥯 bagel bakery bread breakfast schmear
🥞 pancakes crêpe food hotcake pancake breakfast
🧇 waffle breakfast indecisive iron
🧀 cheese wedge cheese
🍖 meat on bone bone meat
🍗 poultry leg bone chicken drumstick hungry leg poultry turkey
🥩 cut of meat chop lambchop meat porkchop red meat steak
🥓 bacon food meat breakfast
🍔 hamburger burger eat fast food food hungry cheeseburger
🍟 fries fast food food french french fries
🍕 pizza cheese food hungry pepperoni slice
🌭 hotdog frankfurter hot dog sausage
🥪 sandwich bread
🌮 taco mexican
🌯 burrito mexican wrap
🫔 tamale food pamonha mexican wrapped
🥙 stuffed flatbread falafel flatbread food gyro kebab stuffed pita
🧆 falafel chickpea meatball
🥚 egg food breakfast
🍳 fried egg breakfast cooking egg fry frying over easy pan restaurant sunny side up
🥘 shallow pan of food casserole food paella pan shallow
🍲 stew food pot pot of food soup
🫕 fondue cheese food ski swiss chocolate melted pot
🥣 bowl with spoon breakfast cereal congee oatmeal porridge
🥗 green salad food green salad
🍿 popcorn movie
🧈 butter dairy
🧂 salt condiment flavor mad salty shaker taste upset
🥫 canned food can
🍱 bento bento box box food
🍘 rice cracker cracker food rice
🍙 rice ball ball food japanese rice
🍚 rice cooked rice food cooked
🍛 curry curry rice food rice
🍜 ramen bowl chopsticks food noodle pho soup steaming steaming bowl
🍝 spaghetti food italian meatballs pasta restaurant
🍠 sweet potato food potato roasted roasted sweet potato sweet
🍢 oden food kebab restaurant seafood skewer stick
🍣 sushi food
🍤 fried shrimp fried prawn shrimp tempura
🍥 fish cake cake fish fish cake with swirl food pastry restaurant swirl
🥮 moon cake autumn festival yuèbǐng
🍡 dango dessert japanese skewer stick sweet
🥟 dumpling empanada gyōza jiaozi pierogi potsticker
🥠 fortune cookie prophecy
🥡 takeout box chopsticks food delivery oyster pail
🦀 crab cancer zodiac
🦞 lobster animal bisque claws red lobster seafood
🦐 shrimp food shellfish small
🦑 squid animal food molusc
🦪 oyster diving pearl
🍦 icecream cream dessert food ice cream restaurant soft ice cream soft serve sweet
🍧 shaved ice dessert ice restaurant shaved sweet
🍨 ice cream cream dessert food ice restaurant sweet
🍩 doughnut dessert donut food sweet breakfast
🍪 cookie chocolate chip dessert sweet
🎂 birthday birthday cake cake celebration dessert happy bday happy birthday pastry sweet
🍰 cake dessert pastry shortcake slice sweet
🧁 cupcake bakery dessert sprinkles sugar sweet treat
🥧 pie apple pie filling fruit meat pastry pumpkin pie slice of pie
🍫 chocolate bar bar candy chocolate halloween sweet sweet tooth dessert
🍬 candy cavities dessert halloween restaurant sweet sweet tooth wrapper
🍭 lollipop candy confectionary dessert food restaurant sweet willy wonka
🍮 custard dessert pudding sweet
🍯 honey pot barrel bear food honey honey jar honeypot jar pooh pot sweet winnie the pooh
🍼 baby bottle babies baby birth born bottle drink infant milk newborn
🥛 glass of milk drink glass milk
☕ coffee beverage cafe caffeine drink hot hot beverage hotbeverage morning starbucks steaming tea
🫖 teapot brew food tea drink pot
🍵 tea beverage cup drink oolong teacup teacup without handle
🍶 sake bar bottle cup drink restaurant beverage
🍾 champagne bar bottle bottle with popping cork cork drink popping
🍷 wine glass alcohol bar beverage booze club drink drinking drinks glass restaurant wine
🍸 cocktail alcohol bar booze club cocktail glass drink drinking drinks glass mad men martini
🍹 tropical drink alcohol bar booze club cocktail drink drinking drinks drunk mai tai party tropical tropics
🍺 beer alcohol bar beer mug booze drinking drinks octoberfest oktoberfest pint stein summer ale drink mug
🍻 beers alcohol bar beer booze bottoms up cheers clink clinking beer mugs drinking drinks drink mug
🥂 clinking glasses celebrate clink drink glass
🥃 tumbler glass glass scotch shot tumbler whiskey whisky liquor
🫗 pouring liquid accident oops pour spill water
🥤 cup with straw juice malt soda soft drink water
🧋 bubble tea boba food taiwan tea bubble milk pearl
🧃 beverage box beverage box juice juice box straw sweet
🧉 mate drink drink mate
🧊 ice cube cold ice iceberg
🥢 chopsticks hashi jeotgarak kuaizi
🍽️ knife fork plate cooking dinner eat fork fork and knife with plate knife plate
🍴 fork and knife breakfast breaky cooking delicious dinner eat feed food fork hungry knife lunch restaurant yum yummy cutlery
🥄 spoon eat tableware
🔪 hocho chef cooking kitchen knife knife tool weapon
🫙 jar empty nothing
🏺 amphora aquarius cooking jug tool weapon zodiac drink
🌍 earth africa africa earth europe globe globe showing europe africa world
🌎 earth americas americas earth globe globe showing americas world
🌏 earth asia asia australia earth globe globe showing asia australia world
🌐 globe with meridians earth globe internet meridians world worldwide web
🗺️ world map map world
🗾 japan map map of japan
🧭 compass direction magnetic navigation orienteering
🏔️ snow capped mountain cold mountain snow
⛰️ mountain
🌋 volcano eruption mountain nature
🗻 mount fuji fuji mountain nature
🏕️ camping
🏖️ beach with umbrella beach umbrella
🏜️ desert
🏝️ desert island desert island
🏞️ national park park
🏟️ stadium
🏛️ classical building classical
🏗️ building construction construction crane
🧱 bricks brick clay mortar wall
🪨 rock boulder stone tough heavy solid
🪵 wood log lumber timber
🛖 hut home shelter house roundhouse yurt
🏘️ house buildings house houses
🏚️ derelict house building derelict derelict house home house
🏠 house building country home home ranch settle down simple home suburban suburbia where the heart is
🏡 house with garden building country home garden home house ranch settle down simple home suburban suburbia where the heart is
🏢 office building city cubical job office building
🏣 post office building japanese japanese post office post
🏤 european post office building european post post office
🏥 hospital building doctor medicine
🏦 bank building
🏨 hotel building
🏩 love hotel building hotel love
🏪 convenience store 24 24 hours building convenience store
🏫 school building
🏬 department store building department store
🏭 factory building
🏯 japanese castle building castle japanese
🏰 european castle building castle european
💒 wedding chapel hitched nuptuals romance
🗼 tokyo tower tokyo tower
🗽 statue of liberty liberty new york ny nyc statue
⛪ church bless chapel christian cross religion
🕌 mosque islam masjid muslim religion
🛕 hindu temple hindu temple
🕍 synagogue jew jewish judaism religion temple
⛩️ shinto shrine religion shinto shrine
🕋 kaaba hajj islam muslim religion umrah
⛲ fountain
⛺ tent camping
🌁 foggy fog
🌃 night with stars night star
🏙️ cityscape city
🌄 sunrise over mountains morning mountain sun sunrise dawn
🌅 sunrise morning nature sun dawn
🌆 city sunset building city dusk evening sun sunset
🌇 city sunrise building dusk sun sunset dawn
🌉 bridge at night bridge night
♨️ hotsprings hot hot springs springs steaming
🎠 carousel horse carousel entertainment horse
🛝 playground slide playground playing slide sliding
🎡 ferris wheel amusement park amusementpark ferris wheel
🎢 roller coaster amusement park amusementpark coaster roller
💈 barber barber pole fresh cut haircut pole shave
🎪 circus tent circus tent
🚂 steam locomotive caboose engine locomotive railway steam train trains travel
🚃 railway car car electric railway train tram travel trolleybus train car
🚄 bullettrain side amtrak high speed train railway shinkansen speed train
🚅 bullettrain front amtrak bullet high speed train with bullet nose railway shinkansen speed train travel
🚆 train2 arrived choo choo railway train
🚇 metro subway travel
🚈 light rail arrived bart monorail railway
🚉 station bart railway train
🚊 tram bart trolleybus
🚝 monorail vehicle
🚞 mountain railway car mountain railway trip train car
🚋 train bus car tram tram car trolley trolleybus train car
🚌 bus school vehicle
🚍 oncoming bus bus cars oncoming
🚎 trolleybus bus tram trolley
🚐 minibus bus drive van vehicle
🚑 ambulance emergency vehicle
🚒 fire engine engine fire truck
🚓 police car 5 0 car cops patrol police
🚔 oncoming police car car oncoming police
🚕 taxi cab cabbie car drive uber vehicle yellow taxi
🚖 oncoming taxi cab cabbie cars drove hail a cab oncoming taxi uber yellow cab yellow taxi
🚗 car automobile driving vehicle red car
🚘 oncoming automobile automobile car cars drove oncoming vehicle
🚙 blue car car drive recreational sport utility vehicle sportutility vehicle suv
🛻 pickup truck automobile car flatbed pickup transportation truck pick up
🚚 truck car delivery delivery truck drive vehicle
🚛 articulated lorry car drive lorry move semi truck vehicle
🚜 tractor vehicle
🏎️ racing car car racing zoom race racecar
🏍️ racing motorcycle motorcycle racing
🛵 motor scooter motor scooter moped
🦽 manual wheelchair accessibility wheelchair
🦼 motorized wheelchair accessibility wheelchair
🛺 auto rickshaw tuk tuk
🚲 bike bicycle bike gang cycle cycling cyclist ride spin class spinning
🛴 scooter kick
🛹 skateboard board skate skater wheels
🛼 roller skate blades roller skates skate sport roller
🚏 busstop bus bus stop stop
🛣️ motorway highway road
🛤️ railway track railway train
🛢️ oil drum drum oil
⛽ fuelpump fuel fuel pump gas gas station gasoline pump diesel station
🛞 wheel car tire vehicle
🚨 rotating light alarm alert beacon car emergency light police police car light revolving siren
🚥 traffic light horizontal traffic light intersection light signal stop light stoplight traffic
🚦 vertical traffic light drove intersection light signal stop light stoplight traffic
🛑 octagonal sign octagonal sign stop
🚧 construction barrier
⚓ anchor ship tool
🛟 ring buoy buoy life preserver lifesaver save swim
⛵ boat sailboat sailing yacht resort sea
🛶 canoe boat
🚤 speedboat billionaire boat lake luxury millionaire summer travel
🛳️ passenger ship passenger ship
⛴️ ferry boat passenger
🛥️ motor boat boat motorboat
🚢 ship boat passenger titanic travel
✈️ airplane fly flying jet plane travel aeroplane small airplane
🛩️ small airplane aeroplane airplane plane
🛫 airplane departure aeroplane airplane check in departure departures plane
🛬 airplane arriving aeroplane airplane airplane arrival arrivals arriving landing plane
🪂 parachute hang glide parasail skydive
💺 seat chair
🚁 helicopter copter roflcopter travel vehicle
🚟 suspension railway railway suspension
🚠 mountain cableway cable gondola mountain ski lift
🚡 aerial tramway aerial cable car gondola ropeway tramway
🛰️ satellite space
🚀 rocket launch rockets space travel spaceship
🛸 flying saucer aliens extra extra terrestrial ufo
🛎️ bellhop bell bell bellhop hotel
🧳 luggage packing roller bag suitcase travel
⌛ hourglass sand time timer hourglass done
⏳ hourglass flowing sand hourglass hourglass with flowing sand hours sand timer waiting yolo
⌚ watch clock time
⏰ alarm clock alarm clock hours hrs late time waiting
⏱️ stopwatch clock time
⏲️ timer clock clock timer
🕰️ mantelpiece clock clock time
🕛 clock12 0 12 12:00 clock o’clock time twelve twelve o’clock
🕧 clock1230 12 12:30 30 clock thirty time twelve twelve thirty
🕐 clock1 0 1 1:00 clock one one o’clock o’clock time
🕜 clock130 1 1:30 30 clock one one thirty thirty time
🕑 clock2 0 2 2:00 clock o’clock time two two o’clock
🕝 clock230 2 2:30 30 clock thirty time two two thirty
🕒 clock3 0 3 3:00 clock o’clock three three o’clock time
🕞 clock330 3 30 3:30 clock thirty three three thirty time
🕓 clock4 0 4 4:00 clock four four o’clock o’clock time
🕟 clock430 30 4 4:30 clock four four thirty thirty time
🕔 clock5 0 5 5:00 clock five five o’clock o’clock time
🕠 clock530 30 5 5:30 clock five five thirty thirty time
🕕 clock6 0 6 6:00 clock o’clock six six o’clock time
🕡 clock630 30 6 6:30 clock six six thirty thirty
🕖 clock7 0 7 7:00 clock o’clock seven seven o’clock
🕢 clock730 30 7 7:30 clock seven seven thirty thirty
🕗 clock8 0 8 8:00 clock eight eight o’clock o’clock time
🕣 clock830 30 8 8:30 clock eight eight thirty thirty time
🕘 clock9 0 9 9:00 clock nine nine o’clock o’clock time
🕤 clock930 30 9 9:30 clock nine nine thirty thirty time
🕙 clock10 0 10 10:00 clock o’clock ten ten o’clock
🕥 clock1030 10 10:30 30 clock ten ten thirty thirty time
🕚 clock11 0 11 11:00 clock eleven eleven o’clock o’clock time
🕦 clock1130 11 11:30 30 clock eleven eleven thirty thirty time
🌑 new moon dark moon space
🌒 waxing crescent moon crescent dreams moon space waxing
🌓 first quarter moon moon quarter space
🌔 moon gibbous space waxing waxing gibbous moon
🌕 full moon full moon space
🌖 waning gibbous moon gibbous moon space waning
🌗 last quarter moon moon quarter space
🌘 waning crescent moon crescent moon space waning
🌙 crescent moon crescent moon ramadan space
🌚 new moon with face face moon new moon face space
🌛 first quarter moon with face face moon quarter space first quarter moon face
🌜 last quarter moon with face dreams face moon quarter last quarter moon face
🌡️ thermometer weather
☀️ sunny bright rays space sun weather
🌝 full moon with face bright face moon full
🌞 sun with face beach bright day face heat shine sun sunny sunshine weather
🪐 ringed planet saturn saturnine
⭐ star astronomy stars white medium star
🌟 star2 glittery glow glowing star night shining sparkle star win
🌠 stars falling night shooting shooting star space star
🌌 milky way space galaxy
☁️ cloud weather
⛅ partly sunny cloud cloudy sun weather sun behind cloud
⛈️ thunder cloud and rain cloud cloud with lightning and rain rain thunder thunderstorm
🌤️ mostly sunny cloud sun sun behind small cloud weather sun small cloud
🌥️ barely sunny cloud sun sun behind large cloud weather sun behind cloud
🌦️ partly sunny rain cloud rain sun sun behind rain cloud weather
🌧️ rain cloud cloud cloud with rain rain weather
🌨️ snow cloud cloud cloud with snow cold snow weather
🌩️ lightning cloud cloud with lightning weather lightning cloud
🌪️ tornado cloud weather whirlwind tornado cloud
🌫️ fog cloud weather
🌬️ wind blowing face blow cloud face wind wind face
🌀 cyclone dizzy twister typhoon weather hurricane
🌈 rainbow bisexual gay genderqueer glbt glbtq lesbian lgbt lgbtq lgbtqia nature pride queer trans transgender weather asexual intersex rain
🌂 closed umbrella rain umbrella clothing
☂️ umbrella rain
☔ umbrella with rain drops drop rain umbrella weather clothing
⛱️ umbrella on ground rain sun umbrella
⚡ zap danger electric electricity high voltage lightning messenger nature thunder thunderbolt voltage
❄️ snowflake cold snow weather ice
☃️ snowman cold snow
⛄ snowman without snow cold snow snowman
☄️ comet space
🔥 fire burn flame hot lit lit af litaf tool
💧 droplet cold comic drop nature sad sweat tear water weather
🌊 ocean kanagawa nature surf surfer surfing water water wave wave
🎃 jack o lantern halloween jack lantern pumpkin celebration
🎄 christmas tree celebration christmas tree
🎆 fireworks boom celebration entertainment yolo
🎇 sparkler boom celebration fireworks sparkle
🧨 firecracker dynamite explosive fire fireworks light pop popping spark
✨ sparkles magic sparkle star *
🎈 balloon birthday celebrate celebration
🎉 tada awesome birthday celebrate celebration excited hooray party party popper popper woohoo confetti
🎊 confetti ball ball celebrate celebration confetti party woohoo
🎋 tanabata tree banner celebration japanese tree
🎍 bamboo japanese pine pine decoration plant celebration
🎎 dolls doll festival japanese japanese dolls celebration
🎏 flags carp carp streamer streamer celebration
🎐 wind chime bell chime wind celebration
🎑 rice scene celebration ceremony moon moon viewing ceremony
🧧 red envelope gift good luck hóngbāo lai see money
🎀 ribbon celebration bow
🎁 gift birthday bow box celebration christmas present surprise wrapped wrapped gift
🎗️ reminder ribbon celebration reminder ribbon
🎟️ admission tickets admission ticket
🎫 ticket admission stub
🎖️ medal award celebration military military medal
🏆 trophy champion champs prize slay sport victory win winning award
🏅 sports medal award gold medal winner star win
🥇 first place medal first gold medal 1 1st place medal award prize win
🥈 second place medal medal second silver 2 2nd place medal award prize win
🥉 third place medal bronze medal third 3 3rd place medal award prize win
⚽ soccer ball football futbol messi ronaldo soccer ball sport
⚾ baseball ball sport
🥎 softball ball glove sports underarm
🏀 basketball ball hoop sport
🏐 volleyball ball game
🏈 football american american football ball sport super bowl
🏉 rugby football ball football rugby sport
🎾 tennis ball racquet sport
🥏 flying disc disc frisbee ultimate
🎳 bowling ball game sport strike
🏏 cricket bat and ball ball bat cricket game cricket game
🏑 field hockey stick and ball ball field field hockey game hockey stick
🏒 ice hockey stick and puck game hockey ice ice hockey puck stick
🥍 lacrosse ball goal sports stick
🏓 table tennis paddle and ball ball bat game paddle ping pong pingpong table tennis
🏸 badminton racquet and shuttlecock badminton birdie game racquet shuttlecock
🥊 boxing glove boxing glove
🥋 martial arts uniform judo karate martial arts taekwondo uniform
🥅 goal net goal net
⛳ golf flag in hole hole sport
⛸️ ice skate ice ice skating skate skating
🎣 fishing pole and fish entertainment fish fishing pole pole sport
🤿 diving mask diving scuba snorkeling
🎽 running shirt with sash athletics running running shirt sash shirt
🎿 ski skis snow sport
🛷 sled luge sledge sleigh snow toboggan
🥌 curling stone game rock
🎯 dart bull bullseye direct hit entertainment game hit target
🪀 yo yo fluctuate toy yoyo
🪁 kite fly soar
🔫 gun handgun pistol revolver tool weapon water
🎱 8ball 8 8 ball ball billiard eight game pool 8 ball
🔮 crystal ball ball crystal fairy tale fairytale fantasy fortune future magic tool
🪄 magic wand magic magician wand witch wizard
🎮 video game controller entertainment game playstation xbox
🕹️ joystick game videogame video game
🎰 slot machine casino gamble gambling game slot slots
🎲 game die dice die entertainment game
🧩 jigsaw clue interlocking piece puzzle
🧸 teddy bear bear plaything plush stuffed toy
🪅 pinata candy celebrate cinco de mayo festive mexican pinada celebration party
🪩 mirror ball ball dance disco mirror party disco ball party ball
🪆 nesting dolls babooshka baboushka babushka dolls matryoshka russian
♠️ spades card game spade spade suit card suit
♥️ hearts card emotion game heart heart suit card suit
♦️ diamonds card diamond diamond suit game card suit
♣️ clubs card club club suit game card suit
♟️ chess pawn board game chess dupe expendable red shirt
🃏 black joker card game joker wildcard
🀄 mahjong game mahjong red dragon red
🎴 flower playing cards card flower game japanese playing
🎭 performing arts actor actress art entertainment mask performing shakespeare theater theatre thesbian
🖼️ frame with picture art frame framed picture museum painting picture
🎨 art artist palette artsy arty colorful creative entertainment museum painter painting palette
🧵 thread needle sewing spool string
🪡 sewing needle needle sew thread embroidery sewing stitches sutures tailoring
🧶 yarn ball crochet knit
🪢 knot cord tie rope tangled twine twist
👓 eyeglasses clothing eye eyewear glasses
🕶️ dark sunglasses dark eye eyewear glasses sunglasses
🥽 goggles dive eye protection scuba swimming welding
🥼 lab coat clothes doctor dr experiment jacket scientist white coat
🦺 safety vest emergency safety vest
👔 necktie clothing employed serious shirt tie
👕 shirt blue casual clothes clothing collar dressed shopping t shirt tshirt weekend
👖 jeans blue casual clothes clothing denim dressed pants shopping trousers weekend
🧣 scarf bundle up cold neck
🧤 gloves hand mittens
🧥 coat brr bundle up cold jacket
🧦 socks stocking
👗 dress clothes clothing dressed fancy shopping
👘 kimono clothing comfortable
🥻 sari clothing dress
🩱 one piece swimsuit bathing suit swimsuit
🩲 briefs bathing suit one piece swimsuit underwear
🩳 shorts bathing suit pants swimsuit underwear
👙 bikini bathing suit beach clothing pool swim
👚 womans clothes blouse clothes clothing collar dress dressed lady shirt shopping woman woman’s clothes
🪭 folding hand fan clack clap cool off cooling dance fan flirt flutter hot shy
👛 purse clothes clothing coin dress fancy handbag shopping
👜 handbag bag clothes clothing dress lady purse shopping
👝 pouch bag clothes clothing clutch bag dress handbag purse
🛍️ shopping bags bag hotel shopping
🎒 school satchel backpack backpacking bag bookbag education satchel school school backpack rucksack
🩴 thong sandal beach flip flop sandal shoe beach sandals sandals thong sandals thongs zōri
👞 mans shoe brown clothes clothing feet foot kick man man’s shoe shoe shoes shopping
👟 athletic shoe athletic clothes clothing fast kick running running shoe shoe shoes shopping sneaker tennis
🥾 hiking boot backpacking boot brown shoe camping hiking outdoors shoe
🥿 womans flat shoe ballet flat comfy flat shoe flats slip on slipper
👠 high heel clothes clothing dress fashion heel heels high heeled shoe shoe shoes shopping stilletto woman
👡 sandal shoe woman woman’s sandal
🩰 ballet shoes ballet dance
👢 boot clothes clothing dress shoe shoes shopping woman woman’s boot
🪮 hair pick afro comb groom hair pick
👑 crown clothing game of thrones king lebron medieval queen royal royal family royalty win
👒 womans hat clothes clothing garden party hat hats woman woman’s hat
🎩 tophat abraham clothes clothing fancy formal hat hats lincoln magic top top hat
🎓 mortar board cap clothing education graduation graduation cap hat scholar celebration
🧢 billed cap baseball cap bent hat cap dad cap dad hat
🪖 military helmet army helmet military soldier war warrior
⛑️ helmet with white cross aid cross face hat helmet rescue worker’s helmet rescue
📿 prayer beads beads clothing necklace prayer religion rosary
💄 lipstick cosmetics date makeup
💍 ring beyonce diamond engaged engagement married romance shiny sparkling wedding
💎 gem diamond engagement gem stone jewel money romance wedding
🔇 mute muted speaker quiet silent sound speaker volume
🔈 speaker soft sound speaker low volume
🔉 sound medium speaker medium volume
🔊 loud sound high loud music sound speaker high volume
📢 loudspeaker communication loud public address publicaddress sound
📣 mega cheering megaphone sound
📯 postal horn horn post postal
🔔 bell break church sound ring
🔕 no bell bell bell with slash forbidden mute no not prohibited quiet silent sound
🎼 musical score music note score
🎵 musical note music note sound
🎶 notes music musical notes note sound
🎙️ studio microphone mic microphone music studio
🎚️ level slider level music slider
🎛️ control knobs control knobs music
🎤 microphone karaoke mic music sing sound
🎧 headphones earbud headphone sound
📻 radio entertainment tbt video
🎷 saxophone instrument music sax
🪗 accordion instrument music squeezebox
🎸 guitar instrument music strat stratocaster
🎹 musical keyboard instrument keyboard music piano
🎺 trumpet instrument music
🎻 violin instrument music stradivarius
🪕 banjo music stringed
🥁 drum with drumsticks drum drumsticks music
🪘 long drum conga drum instrument beat rhythm
🪇 maracas cha cha dance instrument music party percussion rattle shake shaker
🪈 flute band fife flautist instrument marching band music orchestra piccolo pipe recorder woodwind
📱 iphone cell communication mobile mobile phone phone telephone smartphone
📲 calling arrow build call cell communication mobile mobile phone with arrow phone receive telephone smartphone
☎️ phone telephone
📞 telephone receiver communication phone receiver telephone voip
📟 pager communication beeper
📠 fax communication fax machine
🔋 battery charged full battery
🪫 low battery battery drained low power empty
🔌 electric plug electric electricity plug
💻 computer laptop computer office pc personal laptop
🖥️ desktop computer computer desktop monitor screen
🖨️ printer computer
⌨️ keyboard computer computer keyboard
🖱️ three button mouse computer computer mouse
🖲️ trackball computer
💽 minidisc computer computer disk disk minidisk optical
💾 floppy disk computer disk floppy save
💿 cd blu ray computer disk dvd optical optical disk
📀 dvd blu ray cd computer disk optical
🧮 abacus calculation calculator
🎥 movie camera bollywood camera cinema film hollywood movie record
🎞️ film frames cinema film frames movie
📽️ film projector cinema film movie projector video blue camera
🎬 clapper action clapper board movie
📺 tv television video
📷 camera instagram photo selfie snap tbt trip video
📸 camera with flash camera flash video
📹 video camera camcorder camera tbt video
📼 vhs old school tape vcr video videocassette
🔍 mag glass lab left pointing magnifying glass magnifying science search tool
🔎 mag right contact glass lab magnifying right pointing magnifying glass science search tool
🕯️ candle light
💡 bulb comic electric idea light light bulb lightbulb
🔦 flashlight electric light tool torch
🏮 izakaya lantern bar japanese lantern light red red paper lantern restaurant
🪔 diya lamp diya lamp oil
📔 notebook with decorative cover book cover decorated education notebook school writing
📕 closed book book closed education library reading red
📖 book education fantasy knowledge library novels open open book reading
📗 green book book education fantasy green library reading closed
📘 blue book blue book education fantasy library reading closed
📙 orange book book education fantasy library orange reading closed
📚 books book education fantasy knowledge library novels reading school study stack
📓 notebook
📒 ledger notebook
📃 page with curl curl document page
📜 scroll paper
📄 page facing up document page
📰 newspaper communication news paper
🗞️ rolled up newspaper news newspaper paper rolled
📑 bookmark tabs bookmark mark marker tabs
🔖 bookmark mark
🏷️ label tag
💰 moneybag bag bank bet billion cash cash out cost dollar million money money bag paid paying pot of gold rich scrooge win
🪙 coin dollar euro gold money rich metal silver treasure
💴 yen bank banknote bill currency money note yen banknote
💵 dollar bank banknote bill currency dollar banknote money note
💶 euro 100 bank banknote bill currency euro banknote money note rich
💷 pound bank banknote bill billion cash currency money note pound banknote pounds
💸 money with wings bank banknote bill billion cash dollar fly million money note pay wings
💳 credit card bank card cash charge charge it credit money pay
🧾 receipt accounting bookkeeping evidence invoice proof
💹 chart bank chart increasing with yen currency graph growth market money rise trend upward yen
✉️ email e mail envelope letter mail
📧 e mail email letter mail
📨 incoming envelope delivering e mail email envelope incoming letter mail receive sent
📩 envelope with arrow arrow communication down e mail email envelope letter mail outgoing send sent
📤 outbox tray box email letter mail outbox sent tray
📥 inbox tray box email inbox inbox zero letter mail receive tray
📦 package box communication delivery parcel shipping
📫 mailbox closed closed mailbox with raised flag communication mail postbox
📪 mailbox closed closed closed mailbox with lowered flag lowered mail mailbox postbox
📬 mailbox with mail mail mailbox open open mailbox with raised flag postbox
📭 mailbox with no mail lowered mail mailbox open open mailbox with lowered flag postbox
📮 postbox mail mailbox
🗳️ ballot box with ballot ballot box
✏️ pencil2 pencil
✒️ black nib nib pen pen nib
🖋️ lower left fountain pen fountain fountain pen pen
🖊️ lower left ballpoint pen ballpoint pen
🖌️ lower left paintbrush paintbrush painting
🖍️ lower left crayon crayon
📝 memo communication media notes pencil paper pencil and paper write
💼 briefcase office
📁 file folder file folder
📂 open file folder file folder open
🗂️ card index dividers card dividers index
📅 date calendar
📆 calendar tear off calendar
🗒️ spiral note pad note pad spiral spiral notepad
🗓️ spiral calendar pad calendar pad spiral spiral calendar
📇 card index card index old school rolodex
📈 chart with upwards trend chart chart increasing data graph growth trend up and to the right upward
📉 chart with downwards trend chart chart decreasing data down downward graph negative trend
📊 bar chart bar chart data graph
📋 clipboard notes to do list
📌 pushpin collage pin
📍 round pushpin location map pin pushpin
📎 paperclip
🖇️ linked paperclips link paperclip
📏 straight ruler angle math ruler straight edge straightedge
📐 triangular ruler angle math ruler set slide rule triangle
✂️ scissors cut cutting paper tool
🗃️ card file box box card file
🗄️ file cabinet cabinet file filing
🗑️ wastebasket can trash
🔒 lock closed locked private padlock
🔓 unlock cracked lock open unlocked padlock
🔏 lock with ink pen ink lock locked with pen nib pen privacy padlock
🔐 closed lock with key bike lock closed key lock locked locked with key secure padlock
🔑 key keys lock major key password unlock
🗝️ old key clue key lock old
🔨 hammer home improvement repairs tool
🪓 axe chop hatchet split wood
⛏️ pick hammer mining tool
⚒️ hammer and pick hammer pick tool
🛠️ hammer and wrench hammer spanner tool wrench
🗡️ dagger knife dagger knife weapon
⚔️ crossed swords crossed swords weapon fencing sword
💣 bomb boom comic dangerous explosion hot
🪃 boomerang aboriginal weapon australia rebound repercussion
🏹 bow and arrow archer archery arrow bow sagittarius tool weapon zodiac
🛡️ shield weapon
🪚 carpentry saw cut saw tool trim carpenter lumber
🔧 wrench home improvement spanner tool
🪛 screwdriver flathead handy tool screw
🔩 nut and bolt bolt home improvement nut tool
⚙️ gear tool cog machine
🗜️ compression clamp compress tool vice
⚖️ scales balance balance scale justice libra tool weight zodiac law scale
🦯 probing cane accessibility blind white cane
🔗 link links
⛓️‍💥 broken chain break link snap
⛓️ chains chain
🪝 hook catch crook curve ensnare selling point
🧰 toolbox box chest mechanic red box tool
🧲 magnet attraction horseshoe magnetic positive negative u shape
🪜 ladder climb step ladder rung step
⚗️ alembic chemistry tool science
🧪 test tube chemist chemistry experiment lab science
🧫 petri dish bacteria biologist biology culture lab
🧬 dna biologist evolution gene genetics life
🔬 microscope experiment lab science tool
🔭 telescope contact e.t. science tool
📡 satellite antenna aliens antenna contact dish satellite science
💉 syringe doctor flu shot medicine needle shot sick tool vaccination vaccinatoins
🩸 drop of blood bleed injury lood donation medicine menstruation blood donation
💊 pill doctor drugs medicated medicine pills sick vitamin
🩹 adhesive bandage bandage
🩼 crutch help injured
🩺 stethoscope doctor heart medicine listen
🩻 x ray bones skeleton skull xray
🚪 door back door closet front door
🛗 elevator lift accessibility hoist
🪞 mirror makeup reflection reflector speculum
🪟 window frame fresh air opening transparent view
🛏️ bed hotel sleep
🛋️ couch and lamp couch hotel lamp
🪑 chair seat sit
🚽 toilet bathroom
🪠 plunger poop suction toilet force cup plumber
🚿 shower water
🛁 bathtub bath water
🪤 mouse trap cheese lure trap bait mousetrap snare
🪒 razor sharp shave
🧴 lotion bottle lotion moisturizer shampoo sunscreen
🧷 safety pin diaper punk rock
🧹 broom cleaning sweeping witch
🧺 basket farming laundry picnic
🧻 roll of paper paper towels toilet paper
🪣 bucket pail cask vat
🧼 soap bar bathing clean cleaning lather soapdish
🫧 bubbles bubble floating pearl soap
🪥 toothbrush brush clean toiletry bathroom dental hygiene teeth
🧽 sponge absorbing cleaning porous soak
🧯 fire extinguisher extinguish fire quench
🛒 shopping trolley cart shopping trolley
🚬 smoking cigarette tobacco
⚰️ coffin dead death vampire casket funeral
🪦 headstone dead memorial rip tomb tombstone cemetery grave gravestone graveyard
⚱️ funeral urn ashes death funeral urn dead
🧿 nazar amulet bead blue charm evil eye nazar talisman
🪬 hamsa fortune guide hand palm protect
🗿 moyai face moai statue stoneface travel
🪧 placard card notice plaque sign demonstration picket protest
🪪 identification card document id identification license
🏧 atm atm sign automated bank cash money teller
🚮 put litter in its place litter litter in bin sign litterbin litter bin
🚰 potable water drinking potable water
♿ wheelchair access handicap wheelchair symbol
🚹 mens lavatory man men’s room restroom wc
🚺 womens lavatory restroom wc woman women’s room
🚻 restroom lavatory wc
🚼 baby symbol baby changing
🚾 wc closet lavatory restroom water water closet
🛂 passport control control passport
🛃 customs packing
🛄 baggage claim arrived baggage bags case checked claim journey packing plane ready travel trip
🛅 left luggage baggage case locker luggage
⚠️ warning caution alert danger
🚸 children crossing child crossing pedestrian traffic
⛔ no entry do not pass fail forbidden no prohibited traffic entry not
🚫 no entry sign entry forbidden no not prohibited smoke
🚳 no bicycles bicycle bike forbidden no not prohibited
🚭 no smoking forbidden no not prohibited smoke smoking
🚯 do not litter forbidden litter no no littering not prohibited
🚱 non potable water dry non drinking non potable prohibited water
🚷 no pedestrians forbidden no not pedestrian prohibited
📵 no mobile phones cell forbidden mobile no not phone prohibited telephone
🔞 underage 18 agerestriction eighteen forbidden no no one under eighteen not prohibited age restriction
☢️ radioactive sign radioactive sign danger hazard warning
☣️ biohazard sign biohazard sign danger hazard radioactive warning
⬆️ arrow up arrow cardinal direction north up arrow up
↗️ arrow upper right arrow direction intercardinal northeast up right arrow up right
➡️ arrow right arrow cardinal direction east right arrow right
↘️ arrow lower right arrow direction down right arrow intercardinal southeast down right
⬇️ arrow down arrow cardinal direction down down arrow south down right
↙️ arrow lower left arrow direction down left arrow intercardinal southwest down left
⬅️ arrow left arrow cardinal direction left arrow west left
↖️ arrow upper left arrow direction intercardinal northwest up left arrow up left
↕️ arrow up down arrow up down arrow height up and down vertical
↔️ left right arrow arrow horizontal left and right width
↩️ leftwards arrow with hook arrow right arrow curving left return
↪️ arrow right hook arrow left arrow curving right forward
⤴️ arrow heading up arrow right arrow curving up up bend
⤵️ arrow heading down arrow down right arrow curving down down bend
🔃 arrows clockwise arrow clockwise clockwise vertical arrows refresh reload
🔄 arrows counterclockwise again anticlockwise anticlockwise arrows button arrow counterclockwise dejavu refresh rewind withershins
🔙 back arrow back arrow
🔚 end arrow end arrow
🔛 on arrow mark on! arrow
🔜 soon arrow brb omw soon arrow
🔝 top arrow homie top arrow up
🛐 place of worship pray religion worship
⚛️ atom symbol atheist atom
🕉️ om symbol hindu om religion
✡️ star of david david jewish judaism religion star start of david
☸️ wheel of dharma buddhist dharma religion wheel
☯️ yin yang difficult lives neither religion tao taoist total yang yin yinyang
✝️ latin cross christ christian cross religion christianity
☦️ orthodox cross christian cross religion
☪️ star and crescent islam muslim ramadan religion
☮️ peace symbol healing peace peaceful peace sign
🕎 menorah with nine branches candelabrum candlestick hanukkah jewish judaism menorah religion
🔯 six pointed star dotted six pointed star fortune jewish judaism star
🪯 khanda deg tegh fateh faith khalsa religion sikh sikhism
♈ aries horoscope ram zodiac
♉ taurus bull horoscope ox zodiac
♊ gemini horoscope twins zodiac
♋ cancer crab horoscope zodiac
♌ leo horoscope lion zodiac
♍ virgo horoscope zodiac
♎ libra balance horoscope justice scales zodiac
♏ scorpius horoscope scorpio scorpion zodiac
♐ sagittarius archer horoscope zodiac
♑ capricorn goat horoscope zodiac
♒ aquarius bearer horoscope water zodiac
♓ pisces fish horoscope zodiac
⛎ ophiuchus bearer serpent snake zodiac
🔀 twisted rightwards arrows arrow crossed shuffle tracks button
🔁 repeat arrow clockwise repeat button
🔂 repeat one arrow clockwise once repeat single button
▶️ arrow forward arrow play play button right triangle go right arrow
⏩ fast forward arrow double fast fast forward button forward
⏭️ black right pointing double triangle with vertical bar arrow next scene next track button nexttrack triangle next track
⏯️ black right pointing triangle with double vertical bar arrow pause play play or pause button right triangle
◀️ arrow backward arrow left reverse reverse button triangle left arrow
⏪ rewind arrow double fast reverse button reverse
⏮️ black left pointing double triangle with vertical bar arrow last track button previous scene previous track triangle
🔼 arrow up small arrow button red up button upwards button
⏫ arrow double up arrow double fast up button
🔽 arrow down small arrow button down down button red
⏬ arrow double down arrow double down fast down button
⏸️ double vertical bar double pause pause button
⏹️ black square for stop square stop stop button
⏺️ black circle for record circle record record button
⏏️ eject eject button
🎦 cinema camera film movie
🔅 low brightness brightness dim dim button low
🔆 high brightness bright bright button brightness light
📶 signal strength antenna antenna bars bar bars cell communication mobile phone signal telephone
🛜 wireless broadband computer connectivity hotspot internet network router smartphone wifi wlan
📳 vibration mode cell communication mobile mode phone telephone vibration
📴 mobile phone off cell mobile off phone telephone
♀️ female sign
♂️ male sign
⚧️ transgender symbol
✖️ heavy multiplication x multiplication multiply x cross stop
➕ heavy plus sign math plus + sign
➖ heavy minus sign math minus sign −
➗ heavy division sign division math divide sign ÷
🟰 heavy equals sign answer equal equality equals
♾️ infinity forever unbounded universal endless infinite
‼️ bangbang double exclamation mark exclamation mark punctuation ! double exclamation
⁉️ interrobang exclamation exclamation question mark mark punctuation question !?
❓ question ? mark punctuation question mark red question mark
❔ grey question ? outlined punctuation question question mark white question mark mark
❕ grey exclamation ! exclamation mark outlined punctuation white exclamation mark
❗ exclamation ! exclamation mark mark punctuation heavy exclamation mark red exclamation mark
〰️ wavy dash dash punctuation wavy wave wavey wavey dash
💱 currency exchange bank currency exchange money
💲 heavy dollar sign billion cash charge currency dollar million money pay dollars rich usd
⚕️ medical symbol aesculapius medicine staff staff of aesculapius
♻️ recycle recycling symbol green recyce reuse
⚜️ fleur de lis knights fleur
🔱 trident anchor emblem poseidon ship tool trident emblem
📛 name badge badge name
🔰 beginner chevron green japanese japanese symbol for beginner leaf tool yellow
⭕ o circle heavy large circle hollow red circle large mark red
✅ white check mark check checked checkmark complete completed done fixed tick button mark yes ✓
☑️ ballot box with check ballot box check checked off done tick check box todo
✔️ heavy check mark check checked checkmark done tick mark yes ✓
❌ x multiplication multiply cancel cross mark no ×
❎ negative squared cross mark cross mark button multiplication multiply x mark no square ×
➰ curly loop curl loop
➿ loop curl double double curly loop twist
〽️ part alternation mark mark part
✳️ eight spoked asterisk asterisk eight spoke
✴️ eight pointed black star eight pointed star star eight pointed
❇️ sparkle
©️ copyright
®️ registered reserved
™️ tm mark trade mark trademark
#️⃣ hash hashtag pound keycap
*️⃣ keycap star keycap asterisk
0️⃣ zero 0 keycap number
1️⃣ one 1 number keycap
2️⃣ two 2 number keycap
3️⃣ three 3 keycap number
4️⃣ four 4 number keycap
5️⃣ five 5 number keycap
6️⃣ six 6 number keycap
7️⃣ seven 7 number keycap
8️⃣ eight 8 number keycap
9️⃣ nine 9 number keycap
🔟 keycap ten keycap 10 keycap10 10 keycap ten
🔠 capital abcd abcd input input latin uppercase latin letters uppercase
🔡 abcd input input latin lowercase latin letters lowercase
🔢 1234 input input numbers numbers
🔣 symbols input input symbols 〒♪&% 〒♪&amp;%
🔤 abc alphabet input input latin letters latin letters
🅰️ a blood type button letter a
🆎 ab ab button blood type button ab button (blood type)
🅱️ b b button blood type button letter b
🆑 cl button cl button
🆒 cool button cool button
🆓 free button free button
ℹ️ information source i information letter i
🆔 id button id button identity
Ⓜ️ m circle circled m m in circle
🆕 new button new button
🆖 ng button ng button
🅾️ o2 blood type button o o button letter o
🆗 ok button ok button okay
🅿️ parking button p p button letter p
🆘 sos button help sos button
🆙 up button up! button mark
🆚 vs button versus vs button
🈁 koko here japanese japanese here button katakana ココ
🈂️ sa japanese japanese service charge button katakana service charge サ
🈷️ u6708 ideograph japanese japanese monthly amount button monthly amount 月
🈶 u6709 ideograph japanese japanese not free of charge button not free of charge 有
🈯 u6307 ideograph japanese japanese reserved button reserved 指
🉐 ideograph advantage bargain ideograph japanese japanese bargain button 得
🈹 u5272 discount ideograph japanese japanese discount button 割
🈚 u7121 free of charge ideograph japanese japanese free of charge button 無
🈲 u7981 ideograph japanese japanese prohibited button prohibited 禁
🉑 accept acceptable ideograph japanese japanese acceptable button 可
🈸 u7533 application ideograph japanese japanese application button 申
🈴 u5408 ideograph japanese japanese passing grade button passing grade 合
🈳 u7a7a ideograph japanese japanese vacancy button vacancy 空
㊗️ congratulations ideograph japanese japanese congratulations button 祝
㊙️ secret ideograph japanese japanese secret button 秘
🈺 u55b6 ideograph japanese japanese open for business button open for business 営
🈵 u6e80 ideograph japanese japanese no vacancy button no vacancy 満
🔴 red circle circle geometric red
🟠 large orange circle circle orange
🟡 large yellow circle circle yellow
🟢 large green circle circle green
🔵 large blue circle blue blue circle circle geometric
🟣 large purple circle circle purple
🟤 large brown circle brown circle
⚫ black circle circle geometric black
⚪ white circle circle geometric white
🟥 large red square red square
🟧 large orange square orange square
🟨 large yellow square square yellow
🟩 large green square green square brat
🟦 large blue square blue square
🟪 large purple square purple square
🟫 large brown square brown square
⬛ black large square geometric square
⬜ white large square geometric square
◼️ black medium square geometric square
◻️ white medium square geometric square
◾ black medium small square geometric square
◽ white medium small square geometric square
▪️ black small square geometric square
▫️ white small square geometric square
🔶 large orange diamond diamond geometric orange
🔷 large blue diamond blue diamond geometric
🔸 small orange diamond diamond geometric orange
🔹 small blue diamond blue diamond geometric
🔺 small red triangle geometric red red triangle pointed up
🔻 small red triangle down down geometric red red triangle pointed down
💠 diamond shape with a dot inside comic diamond diamond with a dot geometric inside
🔘 radio button button geometric radio circle
🔳 white square button button geometric outlined square
🔲 black square button button geometric square outlined
🏁 checkered flag checkered chequered chequered flag finish flag flags game nascar race racing sport win
🚩 triangular flag on post construction flag golf post triangular flag
🎌 crossed flags cross crossed japanese celebration
🏴 waving black flag black flag waving
🏳️ waving white flag waving white flag
🏳️‍🌈 rainbow flag bisexual gay genderqueer glbt glbtq lesbian lgbt lgbtq lgbtqia pride queer rainbow trans transgender asexual intersex lgbtqa questioning
🏳️‍⚧️ transgender flag equality pride trans transgender
🏴‍☠️ pirate flag jolly roger pirate plunder treasure
🇦🇨 flag ac ascension island
🇦🇩 flag ad andorra flag
🇦🇪 flag ae flag united arab emirates uae
🇦🇫 flag af afghanistan flag
🇦🇬 flag ag antigua & barbuda flag antigua barbuda
🇦🇮 flag ai anguilla flag
🇦🇱 flag al albania flag
🇦🇲 flag am armenia flag
🇦🇴 flag ao angola flag
🇦🇶 flag aq antarctica flag
🇦🇷 flag ar argentina flag
🇦🇸 flag as american samoa flag
🇦🇹 flag at austria flag
🇦🇺 flag au australia flag
🇦🇼 flag aw aruba flag
🇦🇽 flag ax flag åland islands
🇦🇿 flag az azerbaijan flag
🇧🇦 flag ba bosnia & herzegovina flag bosnia herzegovina
🇧🇧 flag bb barbados flag
🇧🇩 flag bd bangladesh flag
🇧🇪 flag be belgium flag
🇧🇫 flag bf burkina faso flag
🇧🇬 flag bg bulgaria flag
🇧🇭 flag bh bahrain flag
🇧🇮 flag bi burundi flag
🇧🇯 flag bj benin flag
🇧🇱 flag bl flag st. barthélemy st barthelemy
🇧🇲 flag bm bermuda flag
🇧🇳 flag bn brunei flag
🇧🇴 flag bo bolivia flag
🇧🇶 flag bq caribbean netherlands flag
🇧🇷 flag br brazil flag
🇧🇸 flag bs bahamas flag
🇧🇹 flag bt bhutan flag
🇧🇻 flag bv bouvet island
🇧🇼 flag bw botswana flag
🇧🇾 flag by belarus flag
🇧🇿 flag bz belize flag
🇨🇦 flag ca canada flag
🇨🇨 flag cc cocos keeling islands flag
🇨🇩 flag cd congo kinshasa democratic republic of the congo flag
🇨🇫 flag cf central african republic flag
🇨🇬 flag cg congo brazzaville flag republic of the congo
🇨🇭 flag ch flag switzerland
🇨🇮 flag ci côte d’ivoire flag
🇨🇰 flag ck cook islands flag
🇨🇱 flag cl chile flag
🇨🇲 flag cm cameroon flag
🇨🇳 cn china flag flag cn
🇨🇴 flag co colombia flag
🇨🇵 flag cp clipperton island
🇨🇷 flag cr costa rica flag
🇨🇺 flag cu cuba flag
🇨🇻 flag cv cape verde flag
🇨🇼 flag cw curaçao flag curacao
🇨🇽 flag cx christmas island flag
🇨🇾 flag cy cyprus flag
🇨🇿 flag cz czech republic flag czechia
🇩🇪 de flag germany flag de
🇩🇬 flag dg diego garcia
🇩🇯 flag dj djibouti flag
🇩🇰 flag dk denmark flag
🇩🇲 flag dm dominica flag
🇩🇴 flag do dominican republic flag
🇩🇿 flag dz algeria flag
🇪🇦 flag ea ceuta melilla
🇪🇨 flag ec ecuador flag
🇪🇪 flag ee estonia flag
🇪🇬 flag eg egypt flag
🇪🇭 flag eh flag western sahara
🇪🇷 flag er eritrea flag
🇪🇸 es flag spain flag es
🇪🇹 flag et ethiopia flag
🇪🇺 flag eu european union flag
🇫🇮 flag fi finland flag
🇫🇯 flag fj fiji flag
🇫🇰 flag fk falkland islands flag
🇫🇲 flag fm flag micronesia
🇫🇴 flag fo faroe islands flag
🇫🇷 fr flag france flag fr
🇬🇦 flag ga flag gabon
🇬🇧 gb flag uk united kingdom flag gb great britain
🇬🇩 flag gd flag grenada
🇬🇪 flag ge flag georgia
🇬🇫 flag gf flag french guiana
🇬🇬 flag gg flag guernsey
🇬🇭 flag gh flag ghana
🇬🇮 flag gi flag gibraltar
🇬🇱 flag gl flag greenland
🇬🇲 flag gm flag gambia
🇬🇳 flag gn flag guinea
🇬🇵 flag gp flag guadeloupe
🇬🇶 flag gq equatorial guinea flag
🇬🇷 flag gr flag greece
🇬🇸 flag gs flag south georgia & south sandwich islands south georgia south sandwich islands
🇬🇹 flag gt flag guatemala
🇬🇺 flag gu flag guam
🇬🇼 flag gw flag guinea bissau
🇬🇾 flag gy flag guyana
🇭🇰 flag hk flag hong kong sar china
🇭🇲 flag hm heard mcdonald islands
🇭🇳 flag hn flag honduras
🇭🇷 flag hr croatia flag
🇭🇹 flag ht flag haiti
🇭🇺 flag hu flag hungary
🇮🇨 flag ic canary islands flag
🇮🇩 flag id flag indonesia
🇮🇪 flag ie flag ireland
🇮🇱 flag il flag israel
🇮🇲 flag im flag isle of man
🇮🇳 flag in flag india
🇮🇴 flag io british indian ocean territory flag
🇮🇶 flag iq flag iraq
🇮🇷 flag ir flag iran
🇮🇸 flag is flag iceland
🇮🇹 it flag italy flag it
🇯🇪 flag je flag jersey
🇯🇲 flag jm flag jamaica
🇯🇴 flag jo flag jordan
🇯🇵 jp flag japan flag jp
🇰🇪 flag ke flag kenya
🇰🇬 flag kg flag kyrgyzstan
🇰🇭 flag kh cambodia flag
🇰🇮 flag ki flag kiribati
🇰🇲 flag km comoros flag
🇰🇳 flag kn flag st. kitts & nevis st kitts nevis
🇰🇵 flag kp flag north korea
🇰🇷 kr flag south korea flag kr
🇰🇼 flag kw flag kuwait
🇰🇾 flag ky cayman islands flag
🇰🇿 flag kz flag kazakhstan
🇱🇦 flag la flag laos
🇱🇧 flag lb flag lebanon
🇱🇨 flag lc flag st. lucia st lucia
🇱🇮 flag li flag liechtenstein
🇱🇰 flag lk flag sri lanka
🇱🇷 flag lr flag liberia
🇱🇸 flag ls flag lesotho
🇱🇹 flag lt flag lithuania
🇱🇺 flag lu flag luxembourg
🇱🇻 flag lv flag latvia
🇱🇾 flag ly flag libya
🇲🇦 flag ma flag morocco
🇲🇨 flag mc flag monaco
🇲🇩 flag md flag moldova
🇲🇪 flag me flag montenegro
🇲🇫 flag mf st martin
🇲🇬 flag mg flag madagascar
🇲🇭 flag mh flag marshall islands
🇲🇰 flag mk flag macedonia north macedonia
🇲🇱 flag ml flag mali
🇲🇲 flag mm flag myanmar burma
🇲🇳 flag mn flag mongolia
🇲🇴 flag mo flag macau sar china macao sar china
🇲🇵 flag mp flag northern mariana islands
🇲🇶 flag mq flag martinique
🇲🇷 flag mr flag mauritania
🇲🇸 flag ms flag montserrat
🇲🇹 flag mt flag malta
🇲🇺 flag mu flag mauritius
🇲🇻 flag mv flag maldives
🇲🇼 flag mw flag malawi
🇲🇽 flag mx flag mexico
🇲🇾 flag my flag malaysia
🇲🇿 flag mz flag mozambique
🇳🇦 flag na flag namibia
🇳🇨 flag nc flag new caledonia
🇳🇪 flag ne flag niger
🇳🇫 flag nf flag norfolk island
🇳🇬 flag ng flag nigeria
🇳🇮 flag ni flag nicaragua
🇳🇱 flag nl flag netherlands
🇳🇴 flag no flag norway
🇳🇵 flag np flag nepal
🇳🇷 flag nr flag nauru
🇳🇺 flag nu flag niue
🇳🇿 flag nz flag new zealand
🇴🇲 flag om flag oman
🇵🇦 flag pa flag panama
🇵🇪 flag pe flag peru
🇵🇫 flag pf flag french polynesia
🇵🇬 flag pg flag papua new guinea
🇵🇭 flag ph flag philippines
🇵🇰 flag pk flag pakistan
🇵🇱 flag pl flag poland
🇵🇲 flag pm flag st. pierre & miquelon st pierre miquelon
🇵🇳 flag pn flag pitcairn islands
🇵🇷 flag pr flag puerto rico
🇵🇸 flag ps flag palestine palestinian territories
🇵🇹 flag pt flag portugal
🇵🇼 flag pw flag palau
🇵🇾 flag py flag paraguay
🇶🇦 flag qa flag qatar
🇷🇪 flag re flag réunion
🇷🇴 flag ro flag romania
🇷🇸 flag rs flag serbia
🇷🇺 ru flag russia flag ru
🇷🇼 flag rw flag rwanda
🇸🇦 flag sa flag saudi arabia
🇸🇧 flag sb flag solomon islands
🇸🇨 flag sc flag seychelles
🇸🇩 flag sd flag sudan
🇸🇪 flag se flag sweden
🇸🇬 flag sg flag singapore
🇸🇭 flag sh flag st. helena st helena
🇸🇮 flag si flag slovenia
🇸🇯 flag sj svalbard jan mayen
🇸🇰 flag sk flag slovakia
🇸🇱 flag sl flag sierra leone
🇸🇲 flag sm flag san marino
🇸🇳 flag sn flag senegal
🇸🇴 flag so flag somalia
🇸🇷 flag sr flag suriname
🇸🇸 flag ss flag south sudan
🇸🇹 flag st flag são tomé & príncipe são tome príncipe
🇸🇻 flag sv el salvador flag
🇸🇽 flag sx flag sint maarten
🇸🇾 flag sy flag syria
🇸🇿 flag sz flag swaziland eswatini
🇹🇦 flag ta tristan da cunha
🇹🇨 flag tc flag turks & caicos islands turks caicos islands
🇹🇩 flag td chad flag
🇹🇫 flag tf flag french southern territories
🇹🇬 flag tg flag togo
🇹🇭 flag th flag thailand
🇹🇯 flag tj flag tajikistan
🇹🇰 flag tk flag tokelau
🇹🇱 flag tl flag timor leste
🇹🇲 flag tm flag turkmenistan
🇹🇳 flag tn flag tunisia
🇹🇴 flag to flag tonga
🇹🇷 flag tr flag turkey
🇹🇹 flag tt flag trinidad & tobago trinidad tobago
🇹🇻 flag tv flag tuvalu
🇹🇼 flag tw flag taiwan
🇹🇿 flag tz flag tanzania
🇺🇦 flag ua flag ukraine
🇺🇬 flag ug flag uganda
🇺🇲 flag um us outlying islands
🇺🇳 flag un united nations
🇺🇸 us flag united states usa america flag us
🇺🇾 flag uy flag uruguay
🇺🇿 flag uz flag uzbekistan
🇻🇦 flag va flag vatican city catholic
🇻🇨 flag vc flag st. vincent & grenadines st vincent grenadines
🇻🇪 flag ve flag venezuela
🇻🇬 flag vg british virgin islands flag
🇻🇮 flag vi flag u.s. virgin islands us virgin islands
🇻🇳 flag vn flag vietnam
🇻🇺 flag vu flag vanuatu
🇼🇫 flag wf flag wallis & futuna wallis futuna
🇼🇸 flag ws flag samoa
🇽🇰 flag xk flag kosovo
🇾🇪 flag ye flag yemen
🇾🇹 flag yt flag mayotte
🇿🇦 flag za flag south africa
🇿🇲 flag zm flag zambia
🇿🇼 flag zw flag zimbabwe
🏴󠁧󠁢󠁥󠁮󠁧󠁿 flag england england flag
🏴󠁧󠁢󠁳󠁣󠁴󠁿 flag scotland flag scotland
🏴󠁧󠁢󠁷󠁬󠁳󠁿 flag wales flag wales"

if [[ $# == 0 ]]; then
	echo "$emoji" | awk '{print $1}'
elif [[ $# == 1 ]]; then
	echo "$emoji" | grep -i --color=never "$@" | awk '{print $1}'
else
	exit 1
fi
```

./file_filter.py
```py

import os
import sys
import fnmatch

def get_all_files(root):
    all_files = []
    for path, _, files in os.walk(root):
        for name in files:
            all_files.append(os.path.join(path, name))
    return all_files

def filter_files(files, ignore_patterns):
    filtered_files = []
    for f in files:
        ignored = False
        re_included = False
        for pattern in ignore_patterns:
            if pattern.startswith('!'):
                if fnmatch.fnmatch(f, pattern[1:]):
                    re_included = True
            elif fnmatch.fnmatch(f, pattern):
                ignored = True
        if not ignored or re_included:
            filtered_files.append(f)
    return filtered_files

if __name__ == '__main__':
    root = sys.argv[1]
    ignore_patterns = sys.argv[2].split(',')
    all_files = get_all_files(root)
    filtered_files = filter_files(all_files, ignore_patterns)
    for f in filtered_files:
        print(f)
```

./getsong
```/getsong
#!/usr/bin/env bash
set -e
set -u
set -o pipefail

exec yt-dlp -f bestaudio -o '%(title)s.%(ext)s' "$@"
```

./getsubs
```/getsubs
#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write
# getsubs https://video.example/foo | ollama run llama3.2 "Summarize this"
import * as path from "jsr:@std/path";
import * as webvttModule from "npm:webvtt-parser";

const { WebVTTParser } = webvttModule.default;

async function getVtt(
  url: string,
  arg: "--write-sub" | "--write-auto-sub",
): Promise<null | string> {
  const tempDir = await Deno.makeTempDir();

  try {
    const cmd = new Deno.Command("yt-dlp", {
      args: [
        "--skip-download",
        arg,
        "--sub-lang",
        "en",
        "--sub-format",
        "vtt",
        "-o",
        path.join(tempDir, "%(id)s.%(ext)s"),
        url,
      ],
      stdout: "piped",
      stderr: "inherit",
    });

    const { code } = await cmd.output();
    if (code !== 0) throw new Error(`yt-dlp command failed with code ${code}`);

    for await (const entry of Deno.readDir(tempDir)) {
      if (!entry.name.endsWith(".vtt")) continue;

      const vttPath = path.join(tempDir, entry.name);
      return await Deno.readTextFile(vttPath);
    }

    return null;
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

type VttCue = { type: "text"; value: string } & {
  type: unknown;
  children?: VttCue[];
};

const getVttCueText = ({ children = [] }: Readonly<VttCue>): string => (
  children.reduce((result, child) => {
    if (child.type === "text") result += child.value;
    if (child.children) result += getVttCueText(child);
    return result;
  }, "")
);

function* removeConsecutiveDuplicates<T>(list: ReadonlyArray<T>): Iterable<T> {
  // This doesn't work if `T` includes `undefined`, but that's not relevant for
  // this script.
  let previous: undefined | T;
  for (const el of list) {
    if (el !== previous) yield el;
    previous = el;
  }
}

/**
 * Convert a VTT string to a list of lines.
 *
 * YouTube's subtitles have some weirdnesses which this function tries to
 * handle. It probably doesn't do it perfectly.
 */
function vttLines(vtt: string): Iterable<string> {
  const parser = new WebVTTParser();
  const tree = parser.parse(vtt, "metadata");

  let rawResult: string = "";
  for (const cue of tree.cues) {
    rawResult += getVttCueText(cue.tree).trim() + "\n";
  }

  const rawResultLines = rawResult
    .split(/\r?\n/g)
    .map((line) => line.trim().replace(/(?:\s+;)*/g, ""))
    .filter(Boolean);

  return removeConsecutiveDuplicates(rawResultLines);
}

async function main(): Promise<void> {
  const [url, ...rest] = Deno.args;

  if (rest.length) {
    console.error("too many args");
    Deno.exit(1);
  }

  if (!url) {
    console.error("needs a URL");
    Deno.exit(1);
  }

  const vtt = await getVtt(url, "--write-sub") ||
    await getVtt(url, "--write-auto-sub");

  if (!vtt) {
    console.error("no subs found");
    Deno.exit(1);
  }

  for (const line of vttLines(vtt)) {
    console.log(line);
  }
}

await main();
```

./httpstatus
```/httpstatus
#!/usr/bin/env bash
set -e
set -u

statuses="100 Continue
101 Switching Protocols
102 Processing
200 OK
201 Created
202 Accepted
203 Non-Authoritative Information
204 No Content
205 Reset Content
206 Partial Content
207 Multi-Status
208 Already Reported
300 Multiple Choices
301 Moved Permanently
302 Found
303 See Other
304 Not Modified
305 Use Proxy
307 Temporary Redirect
400 Bad Request
401 Unauthorized
402 Payment Required
403 Forbidden
404 Not Found
405 Method Not Allowed
406 Not Acceptable
407 Proxy Authentication Required
408 Request Timeout
409 Conflict
410 Gone
411 Length Required
412 Precondition Failed
413 Request Entity Too Large
414 Request-URI Too Large
415 Unsupported Media Type
416 Request Range Not Satisfiable
417 Expectation Failed
418 I'm a teapot
420 Blaze it
422 Unprocessable Entity
423 Locked
424 Failed Dependency
425 No code
426 Upgrade Required
428 Precondition Required
429 Too Many Requests
431 Request Header Fields Too Large
449 Retry with
500 Internal Server Error
501 Not Implemented
502 Bad Gateway
503 Service Unavailable
504 Gateway Timeout
505 HTTP Version Not Supported
506 Variant Also Negotiates
507 Insufficient Storage
509 Bandwidth Limit Exceeded
510 Not Extended
511 Network Authentication Required"

if [ $# -eq 0 ]; then
  echo "$statuses"
else
  echo "$statuses" | grep -i --color=never "$@"
fi
```

./ide_set_color
```/ide_set_color
#!/usr/bin/env node

// Minimal IDE color setter for VSCode (+ iTerm2 on macOS)
// Usage: ide_set_color #RRGGBB [--recursive|-r]

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const RECURSIVE = args.includes('--recursive') || args.includes('-r');

function printHelp() {
  console.log('Usage: ide_set_color #RRGGBB [--recursive|-r]');
  console.log('- Updates package.json "color" and VSCode color customizations');
  console.log('- On macOS, also adjusts iTerm2 background color');
  console.log('- With --recursive/-r, also updates nested packages (excludes node_modules)');
}

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}
const raw = args.find(a => /^#?[0-9A-Fa-f]{6}$/.test(a));
if (!raw) {
  console.error('Usage: ide_set_color #RRGGBB [--recursive|-r]  (use --help for details)');
  process.exit(1);
}
const HEX = raw.startsWith('#') ? raw : '#' + raw;

function findPackageJsonDirs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fs.existsSync(path.join(full, 'package.json'))) out.push(full);
      try { out.push(...findPackageJsonDirs(full)); } catch (_) {}
    }
  }
  return out;
}

function setPkgColor(repoDir) {
  const p = path.join(repoDir, 'package.json');
  if (!fs.existsSync(p)) return;
  try {
    const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
    pkg.color = HEX;
    fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
  } catch (_) {}
}

function setVSCode(repoDir) {
  const vs = path.join(repoDir, '.vscode');
  const sp = path.join(vs, 'settings.json');

  try { if (!fs.existsSync(vs)) fs.mkdirSync(vs); } catch (_) {}

  // Merge if settings.json is valid JSON; otherwise start fresh
  let current = {};
  try { current = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch (_) {}

  const wcc = current['workbench.colorCustomizations'] || {};
  wcc['activityBar.background'] = HEX;
  wcc['titleBar.activeBackground'] = HEX;
  current['workbench.colorCustomizations'] = wcc;

  try { fs.writeFileSync(sp, JSON.stringify(current, null, 2) + '\n'); } catch (_) {}
}

function setIterm2(hex) {
  if (process.platform !== 'darwin') return;
  try {
    const [r,g,b] = hex.slice(1).match(/.{2}/g).map(v => parseInt(v,16)/255);
    const script = `tell application "iTerm2" to tell current window to tell current session to set background color to {${r},${g},${b}}`;
    execSync('osascript', { input: script });
  } catch (_) {}
}

(function main(){
  const root = process.cwd();
  setPkgColor(root);
  const dirs = RECURSIVE ? findPackageJsonDirs(root) : [];
  for (const d of dirs) setPkgColor(d);
  for (const d of [root, ...dirs]) setVSCode(d);
  setIterm2(HEX);
  console.log(`Applied ${HEX} to ${1 + dirs.length} package(s) and VSCode settings`);
})();
```

./mksh
```/mksh
#!/usr/bin/env bash
set -e
set -u
set -o pipefail

if [ ! $# -eq 1 ]; then
  echo 'mksh takes one argument' 1>&2
  exit 1
elif [ -e "$1" ]; then
  echo "$1 already exists" 1>&2
  exit 1
fi

echo '#!/usr/bin/env bash
set -e
set -u
set -o pipefail

' > "$1"

chmod u+x "$1"

"$EDITOR" "$1"
```

./mvtmp
```/mvtmp
#!/bin/bash

# Path to the counter file
counter_file="/tmp/script_counter.txt"
lock_file="/tmp/script_counter.lock"

# Create lock file; exit if lock cannot be obtained
if ! shlock -f "$lock_file" -p $$; then
    echo "Failed to acquire lock."
    exit 1
fi

# Read and increment the counter
if [ -f "$counter_file" ]; then
    counter=$(<"$counter_file")
    counter=$((counter+1))
else
    counter=1
fi

# Update the counter file
echo "$counter" > "$counter_file"

# No explicit unlock needed; lock file should be removed when process exits
rm "$lock_file"

# Get current date and time with milliseconds
current_time=$(date +"%Y_%m_%d_%H_%M_%S_%3N")

# Append the counter to ensure uniqueness
current_time="${current_time}_${counter}"

# Destination directory in /tmp with timestamp and counter
destination="/tmp/$(basename "$1")_$current_time"

# Move the provided folder to the destination
if mv "$1" "$destination"; then
    echo "Successfully moved '$1' to '$destination'."
else
    echo "Failed to move '$1'. Please check if the source directory exists and you have the right permissions."
    exit 1
fi```

./notify
```/notify
#!/usr/bin/env ruby
require 'date'
require 'json'

def exec(*args)
  begin
    pid = spawn(*args)
  rescue Errno::ENOENT
    return false
  end
  return Process.wait2(pid)[1].exited?
end

def notify(title, description)
  return if exec('notify-send', '--expire-time=5000', title, description)

  js = "
  var app = Application.currentApplication()
  app.includeStandardAdditions = true
  app.displayNotification(#{JSON.generate(description)}, {
    withTitle: #{JSON.generate(title)},
  })
  "
  return if exec('osascript', '-l', 'JavaScript', '-e', js)

  $stderr.puts("can't send notifications")
  exit(1)
end

title = ARGV[0] || "Notification"
description = ARGV[1] || DateTime.now.iso8601

notify(title, description)```

./tips.md
```md
https://news.ycombinator.com/item?id=45670052```

./tryna
```/tryna
#!/usr/bin/env bash
set -u

"$@"
while [[ ! "$?" -eq 0 ]]; do
  sleep 0.5
  "$@"
done
```

./waitfor
```/waitfor
#!/usr/bin/env bash
set -e
set -u
set -o pipefail

pid="$1"

if hash caffeinate 2>/dev/null; then
  caffeinate -w "$pid"
elif hash systemd-inhibit 2>/dev/null; then
  systemd-inhibit \
    --who=waitfor \
    --why="Awaiting PID $pid" \
    tail --pid="$pid" -f /dev/null
else
  tail --pid="$pid" -f /dev/null
fi
```

