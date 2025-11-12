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

