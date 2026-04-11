'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

jest.setTimeout(60_000);

const HOME = os.homedir();

function run(cmd, timeoutMs = 15_000) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: timeoutMs }).trim();
  } catch {
    return '';
  }
}

// Sorted list of plist filenames in a directory.
function launchFiles(dir) {
  if (!fs.existsSync(dir)) return '(not present)';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.plist')).sort();
  return files.join('\n') || '(empty)';
}

// Full plutil -p dump for each plist in a directory, sorted by filename.
// Only used for user-writable locations where persistence is most likely.
function plistContents(dir) {
  if (!fs.existsSync(dir)) return '(not present)';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.plist')).sort();
  if (files.length === 0) return '(empty)';
  return files.map(f => {
    const p = path.join(dir, f);
    const out = run(`plutil -p ${JSON.stringify(p)}`);
    return `=== ${f} ===\n${out}`;
  }).join('\n\n');
}

// Listening services, port < 49152 only (exclude ephemeral rapportd etc).
// Format: port (padded) | command | address  — sorted by port.
function listeningPorts() {
  const out = run('lsof -nP -iTCP -sTCP:LISTEN');
  if (!out) return '(none)';
  const entries = out.split('\n').slice(1).flatMap(line => {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0];
    const addr = parts[8] ?? '';
    const port = parseInt(addr.split(':').pop() ?? '', 10);
    if (isNaN(port) || port >= 49152) return [];
    return [`${String(port).padStart(5)}  ${cmd}  ${addr}`];
  });
  return [...new Set(entries)].sort().join('\n') || '(none below 49152)';
}

// Shell startup files — first 240 lines each, clearly delimited.
function shellStartup() {
  const candidates = [
    '.zshrc', '.zprofile', '.zlogin', '.zlogout',
    '.bash_profile', '.bashrc', '.profile',
  ].map(f => path.join(HOME, f)).filter(p => fs.existsSync(p));
  if (candidates.length === 0) return '(none found)';
  return candidates.map(p => {
    const content = fs.readFileSync(p, 'utf8').split('\n').slice(0, 240).join('\n');
    return `=== ${p} ===\n${content}`;
  }).join('\n\n');
}

// Browser extensions: one line per extension — browser | id | name from manifest.json.
function browserExtensions() {
  const profiles = [
    ['Chrome', `${HOME}/Library/Application Support/Google/Chrome/Default/Extensions`],
    ['Chrome', `${HOME}/Library/Application Support/Google/Chrome/Profile 1/Extensions`],
    ['Brave',  `${HOME}/Library/Application Support/BraveSoftware/Brave-Browser/Default/Extensions`],
    ['Edge',   `${HOME}/Library/Application Support/Microsoft Edge/Default/Extensions`],
  ];
  const lines = [];
  for (const [browser, base] of profiles) {
    if (!fs.existsSync(base)) continue;
    for (const id of fs.readdirSync(base).sort()) {
      let name = id;
      try {
        const idDir = path.join(base, id);
        for (const ver of fs.readdirSync(idDir).sort()) {
          const mf = path.join(idDir, ver, 'manifest.json');
          if (fs.existsSync(mf)) {
            name = JSON.parse(fs.readFileSync(mf, 'utf8')).name ?? id;
            break;
          }
        }
      } catch { /* unreadable extension dir — show id only */ }
      lines.push(`${browser}  |  ${id}  |  ${name}`);
    }
  }
  return lines.join('\n') || '(none)';
}

describe('mac-triage', () => {
  // ── Launch agents / daemons ────────────────────────────────────────────────

  test('launch agents — user (files)', () => {
    expect(launchFiles(`${HOME}/Library/LaunchAgents`)).toMatchSnapshot();
  });

  test('launch agents — user (contents)', () => {
    expect(plistContents(`${HOME}/Library/LaunchAgents`)).toMatchSnapshot();
  });

  test('launch agents — system (files)', () => {
    expect(launchFiles('/Library/LaunchAgents')).toMatchSnapshot();
  });

  test('launch agents — system (contents)', () => {
    expect(plistContents('/Library/LaunchAgents')).toMatchSnapshot();
  });

  // File list only for system daemons — hundreds of Apple-signed plists,
  // contents are noise; presence of a new file is the signal.
  test('launch daemons — system (files)', () => {
    expect(launchFiles('/Library/LaunchDaemons')).toMatchSnapshot();
  });

  // ── Network ───────────────────────────────────────────────────────────────

  test('listening ports (registered, <49152)', () => {
    expect(listeningPorts()).toMatchSnapshot();
  });

  // ── Shell & env ───────────────────────────────────────────────────────────

  test('shell startup files', () => {
    expect(shellStartup()).toMatchSnapshot();
  });

  test('crontab', () => {
    expect(run('crontab -l') || '(empty)').toMatchSnapshot();
  });

  // ── Browser ───────────────────────────────────────────────────────────────

  test('browser extensions', () => {
    expect(browserExtensions()).toMatchSnapshot();
  });

  // ── macOS security surface ────────────────────────────────────────────────

  test('profiles', () => {
    expect(run('profiles list', 10_000) || '(unavailable or none)').toMatchSnapshot();
  });

  test('system extensions', () => {
    expect(run('systemextensionsctl list', 10_000) || '(unavailable)').toMatchSnapshot();
  });

  test('gatekeeper status', () => {
    expect(run('spctl --status') || '(unavailable)').toMatchSnapshot();
  });

  test('remote login', () => {
    expect(run('systemsetup -getremotelogin', 10_000) || '(unavailable)').toMatchSnapshot();
  });
});
