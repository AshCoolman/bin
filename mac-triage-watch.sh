#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/mac-triage-watch" && pwd)"

cd "$DIR"

if [ ! -x "$DIR/node_modules/.bin/jest" ]; then
  echo "Run first: cd $DIR && npm install" >&2
  exit 1
fi

JEST="$DIR/node_modules/.bin/jest"

case "${1:-check}" in
  check)
    "$JEST"
    ;;
  watch)
    "$JEST" --watch
    ;;
  update)
    "$JEST" -u
    ;;
  help)
    cat <<'EOF'
mac-triage-watch — detect changes to macOS persistence and security surfaces

COMMANDS
  check     Run all snapshot tests. Pass = nothing changed since last approval.
            Fail = something changed; an HTML diff report opens automatically.

  watch     Interactive mode (Jest watch). Use when you want to review and
            approve changes one test at a time:
              u  — update the snapshot for the focused test
              a  — update all changed snapshots (approve everything)
              q  — quit

  update    Non-interactively approve all current state as the new baseline.
            Equivalent to pressing 'a' in watch mode.

  help      Show this text.

WORKFLOW
  1. Run 'check' periodically (manually, or wired to a schedule).
     If all tests pass, nothing security-relevant has changed. Done.

  2. If tests fail, the HTML report opens showing exactly what changed —
     one named section per surface (launch agents, ports, extensions, etc).

  3. Open watch mode to review changes interactively.
     - If the change is expected (you installed something, updated a browser
       extension, etc): press 'u' on that test to approve it.
     - If the change is unexpected: investigate before approving.
     - Press 'a' once you've reviewed everything and want to accept all.

  4. After approving, 'check' will pass again until something new changes.

WHAT IS MONITORED
  - ~/Library/LaunchAgents          (files + full plist contents)
  - /Library/LaunchAgents           (files + full plist contents)
  - /Library/LaunchDaemons          (files only — hundreds of Apple-signed plists)
  - Listening TCP ports below 49152  (excludes ephemeral/dynamic ports)
  - Shell startup files              (~/.zshrc, ~/.zprofile, etc.)
  - crontab
  - Browser extensions               (Chrome, Brave, Edge — id + name)
  - macOS configuration profiles
  - System extensions
  - Gatekeeper status
  - Remote login (SSH)

SNAPSHOTS
  Stored in: ~/bin/mac-triage-watch/__snapshots__/triage.test.js.snap
  Committed to git alongside the script — treat them as your approved baseline.
EOF
    ;;
  *)
    echo "Usage: $0 {check|watch|update|help}" >&2
    exit 1
    ;;
esac
