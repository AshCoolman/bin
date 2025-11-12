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
