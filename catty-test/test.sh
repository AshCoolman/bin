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
rm output.txt