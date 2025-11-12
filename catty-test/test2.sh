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
