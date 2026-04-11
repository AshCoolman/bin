#!/usr/bin/env bash
set -euo pipefail

trap 'echo "FATAL: line $LINENO" >&2' ERR

RED=$'\033[1;31m'
YELLOW=$'\033[1;33m'
GREEN=$'\033[1;32m'
CYAN=$'\033[1;36m'
RESET=$'\033[0m'

BAD_COUNT=0
REVIEW_COUNT=0
PASS_COUNT=0

REPORT_DIR="${TMPDIR:-/tmp}/mac-triage-$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="$REPORT_DIR/report.txt"
mkdir -p "$REPORT_DIR"

have() { command -v "$1" >/dev/null 2>&1; }

say() { printf '%s\n' "$*" | tee -a "$REPORT_FILE"; }
section() { printf '\n%s== %s ==%s\n' "$CYAN" "$1" "$RESET" | tee -a "$REPORT_FILE"; }
pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf '%sPASS%s %s\n' "$GREEN" "$RESET" "$1" | tee -a "$REPORT_FILE"; }
review() { REVIEW_COUNT=$((REVIEW_COUNT + 1)); printf '%sREVIEW%s %s\n' "$YELLOW" "$RESET" "$1" | tee -a "$REPORT_FILE"; }
bad() { BAD_COUNT=$((BAD_COUNT + 1)); printf '%sBAD%s %s\n' "$RED" "$RESET" "$1" | tee -a "$REPORT_FILE"; }

write_cmd() {
  local name="$1"
  shift
  local out="$REPORT_DIR/$name.txt"
  {
    printf '$ %q' "$1"
    shift || true
    for arg in "$@"; do printf ' %q' "$arg"; done
    printf '\n\n'
    "$@" 2>&1
  } >"$out" || true
  say "wrote: $out"
}

contains_any() {
  local file="$1"
  shift
  local hit=1
  for p in "$@"; do
    if grep -Eiq "$p" "$file"; then
      hit=0
      break
    fi
  done
  return "$hit"
}

section "BASIC"
write_cmd basic uname -a
write_cmd sw_vers sw_vers
write_cmd whoami whoami
write_cmd date date
pass "Captured host basics"

section "RECENT APPS"
RECENT_APPS="$REPORT_DIR/recent_apps.txt"
{
  echo "/Applications"
  find /Applications -maxdepth 1 -mindepth 1 -type d -mtime -30 2>/dev/null | sort
  echo
  echo "$HOME/Applications"
  find "$HOME/Applications" -maxdepth 1 -mindepth 1 -type d -mtime -30 2>/dev/null | sort || true
} >"$RECENT_APPS"

say "wrote: $RECENT_APPS"

RECENT_APP_COUNT="$(grep -Ec '^/' "$RECENT_APPS" || true)"
if [ "${RECENT_APP_COUNT:-0}" -gt 0 ]; then
  review "Apps changed in last 30 days. Inspect signatures/notarization for anything unfamiliar."
else
  pass "No app directories changed in last 30 days in standard locations"
fi

section "LOGIN ITEMS / BACKGROUND ITEMS"
say "Manual check required:"
say "  System Settings > General > Login Items"
review "Manual review required for Login Items / Allow in the Background"

section "PROFILES"
if have profiles; then
  write_cmd profiles_status profiles status -type enrollment
  write_cmd profiles_list profiles list
  if grep -Eiq 'There are no configuration profiles installed|no configuration profiles' "$REPORT_DIR/profiles_list.txt"; then
    pass "No configuration profiles reported"
  else
    review "Profiles present. On a personal Mac, unknown profiles are high-signal."
  fi
else
  review "'profiles' command not available"
fi

section "LAUNCH AGENTS / DAEMONS"
for d in \
  "$HOME/Library/LaunchAgents" \
  "/Library/LaunchAgents" \
  "/Library/LaunchDaemons"
do
  name="$(echo "$d" | sed 's#/#_#g' | sed 's#^_##')"
  if [ -d "$d" ]; then
    write_cmd "ls_${name}" ls -la "$d"
    write_cmd "find_${name}_recent" find "$d" -type f -mtime -30
  else
    say "missing: $d"
  fi
done

SUSPECT_PLISTS="$REPORT_DIR/suspect_plists.txt"
: >"$SUSPECT_PLISTS"
for d in \
  "$HOME/Library/LaunchAgents" \
  "/Library/LaunchAgents" \
  "/Library/LaunchDaemons"
do
  [ -d "$d" ] || continue
  find "$d" -type f -name '*.plist' -print0 2>/dev/null |
    while IFS= read -r -d '' f; do
      plutil -p "$f" 2>/dev/null >"$REPORT_DIR/$(basename "$f").plutil.txt" || true
      if contains_any "$REPORT_DIR/$(basename "$f").plutil.txt" \
        'Application Support' \
        '/tmp/' \
        '/private/tmp/' \
        '/Users/.*/Library/' \
        'curl ' \
        'wget ' \
        'osascript' \
        'bash -c' \
        'sh -c' \
        'python' \
        'perl' \
        'zsh -c' \
        'open -a' \
        'LaunchOnlyOnce'
      then
        echo "$f" >>"$SUSPECT_PLISTS"
      fi
    done
done

if [ -s "$SUSPECT_PLISTS" ]; then
  bad "Suspicious LaunchAgent/Daemon patterns found. Review $SUSPECT_PLISTS"
else
  pass "No obvious suspicious patterns in LaunchAgent/Daemon plists"
fi

section "APPLICATION SUPPORT RECENT FILES"
write_cmd app_support_recent find "$HOME/Library/Application Support" "/Library/Application Support" -type f -mtime -14
RECENT_SUPPORT_COUNT="$(grep -Ec '^/' "$REPORT_DIR/app_support_recent.txt" || true)"
if [ "${RECENT_SUPPORT_COUNT:-0}" -gt 200 ]; then
  review "Large volume of recent Application Support changes"
else
  pass "Recent Application Support churn not unusually high"
fi

section "RUNNING PROCESSES"
write_cmd ps_aux ps aux
write_cmd lsof_net lsof -nP -iTCP -sTCP:LISTEN
write_cmd launchctl_gui sh -c 'launchctl print "gui/$(id -u)" 2>/dev/null | grep -E "label = |program = |path =" || true'

SUSPECT_PROCS="$REPORT_DIR/suspect_processes.txt"
grep -Ei \
  'teamviewer|anydesk|rustdesk|screenconnect|connectwise|logmein|splashtop|parsecd|vnc|ngrok|tailscale|tor|frpc|frps|cloudflared|python.*http|osascript|curl|wget' \
  "$REPORT_DIR/ps_aux.txt" >"$SUSPECT_PROCS" || true

if [ -s "$SUSPECT_PROCS" ]; then
  review "Processes worth reviewing found: $SUSPECT_PROCS"
else
  pass "No obvious suspicious process names matched"
fi

section "SHELL STARTUP FILES"
SHELL_DUMP="$REPORT_DIR/shell_startup.txt"
: >"$SHELL_DUMP"
for f in \
  "$HOME/.zshrc" "$HOME/.zprofile" "$HOME/.zlogin" "$HOME/.zlogout" \
  "$HOME/.bash_profile" "$HOME/.bashrc" "$HOME/.profile"
do
  if [ -f "$f" ]; then
    {
      echo "===== $f ====="
      sed -n '1,240p' "$f"
      echo
    } >>"$SHELL_DUMP"
  fi
done
say "wrote: $SHELL_DUMP"

if [ -s "$SHELL_DUMP" ]; then
  if grep -Eiq 'curl |wget |osascript|base64|python|perl|ruby|nc |ncat |bash -c|sh -c' "$SHELL_DUMP"; then
    review "Shell startup files contain patterns worth reviewing"
  else
    pass "No obvious suspicious shell startup patterns matched"
  fi
else
  pass "No standard shell startup files found"
fi

section "CRON / AT"
write_cmd crontab sh -c 'crontab -l || true'
if have atq; then
  write_cmd atq atq
fi
if grep -Eiq '[^[:space:]]' "$REPORT_DIR/crontab.txt"; then
  review "User crontab present. Confirm every entry is yours."
else
  pass "No user crontab"
fi

section "BROWSER EXTENSIONS"
BROWSER_EXT="$REPORT_DIR/browser_extensions.txt"
: >"$BROWSER_EXT"

for d in \
  "$HOME/Library/Application Support/Google/Chrome/Default/Extensions" \
  "$HOME/Library/Application Support/Google/Chrome/Profile 1/Extensions" \
  "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/Default/Extensions" \
  "$HOME/Library/Application Support/Microsoft Edge/Default/Extensions" \
  "$HOME/Library/Containers/com.apple.Safari/Data/Library/Safari/AppExtensions"
do
  if [ -d "$d" ]; then
    {
      echo "===== $d ====="
      find "$d" -maxdepth 3 -mindepth 1 2>/dev/null | sort
      echo
    } >>"$BROWSER_EXT"
  fi
done

say "wrote: $BROWSER_EXT"
if [ -s "$BROWSER_EXT" ]; then
  review "Browser extensions present. Unknown extensions are a real risk."
else
  pass "No extension directories found in standard paths"
fi

section "PRIVACY / TCC MANUAL CHECK"
say "Manual check required:"
say "  System Settings > Privacy & Security"
say "Check these panes for anything unknown:"
say "  - Full Disk Access"
say "  - Accessibility"
say "  - Input Monitoring"
say "  - Screen Recording"
say "  - Automation"
review "Manual TCC permission review required"

section "REMOTE ACCESS / SHARING"
if have systemsetup; then
  write_cmd remote_login systemsetup -getremotelogin
  if grep -Eiq 'On' "$REPORT_DIR/remote_login.txt"; then
    review "Remote Login (SSH) is ON. If unexpected, disable it."
  else
    pass "Remote Login (SSH) is OFF"
  fi
else
  review "'systemsetup' unavailable for Remote Login check"
fi

write_cmd sharing_launchd sh -c 'launchctl print-disabled system 2>/dev/null | grep -Ei "screensharing|remotemanagement|ssh|ARDAgent" || true'
if grep -Eiq '=> false' "$REPORT_DIR/sharing_launchd.txt"; then
  review "One or more remote access / sharing services appear enabled"
else
  pass "No obvious enabled remote access launchd entries matched"
fi

section "GATEKEEPER / XPROTECT"
if have spctl; then
  write_cmd spctl_status spctl --status
  if grep -Eiq 'assessments enabled' "$REPORT_DIR/spctl_status.txt"; then
    pass "Gatekeeper assessments enabled"
  else
    review "Gatekeeper assessments not clearly enabled"
  fi
fi

section "SYSTEM EXTENSIONS"
if have systemextensionsctl; then
  write_cmd system_extensions systemextensionsctl list
  if grep -Eiq '[[:alnum:]]+\.[[:alnum:]]+' "$REPORT_DIR/system_extensions.txt"; then
    review "System extensions present. Verify any non-Apple entries."
  else
    pass "No third-party system extensions obvious"
  fi
else
  review "'systemextensionsctl' unavailable"
fi

section "CODESIGN SAMPLE FOR RECENT APPS"
RECENT_APPS_PATHS="$(grep '^/' "$RECENT_APPS" || true)"
if [ -n "$RECENT_APPS_PATHS" ]; then
  CODESIGN_OUT="$REPORT_DIR/recent_app_codesign.txt"
  : >"$CODESIGN_OUT"
  while IFS= read -r app; do
    [ -d "$app" ] || continue
    {
      echo "===== $app ====="
      codesign -dv --verbose=4 "$app" 2>&1 || true
      spctl -a -vv "$app" 2>&1 || true
      echo
    } >>"$CODESIGN_OUT"
  done <<<"$RECENT_APPS_PATHS"
  say "wrote: $CODESIGN_OUT"
  review "Review recent app signatures/notarization if any app is unfamiliar"
else
  pass "No recent apps to codesign-sample"
fi

section "SUMMARY"
say "Report dir: $REPORT_DIR"
say "Report file: $REPORT_FILE"
say
say "Counts:"
say "  PASS   $PASS_COUNT"
say "  REVIEW $REVIEW_COUNT"
say "  BAD    $BAD_COUNT"
say

if [ "$BAD_COUNT" -gt 0 ]; then
  bad "At least one high-signal finding. Do not use this Mac for logins until reviewed."
elif [ "$REVIEW_COUNT" -gt 0 ]; then
  review "No hard proof of malware, but there are items to inspect."
else
  pass "No obvious findings from this triage pass."
fi

section "NEXT ACTIONS"
say "1. Read the BAD and REVIEW lines first"
say "2. Inspect unknown Login Items / Background Items in System Settings"
say "3. Inspect unknown Profiles"
say "4. Inspect unknown Full Disk Access / Accessibility / Screen Recording permissions"
say "5. Inspect any suspicious LaunchAgents/Daemons and recent apps"
say "6. If anything looks wrong, isolate and wipe this Mac"