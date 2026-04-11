'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPORT_PATH = path.join(
  process.env.HOME,
  '.local/state/mac-triage-watch/report.html',
);

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[\d;]*[A-Za-z]/g, '');
}

// Jest snapshot diffs indent removed lines with "  - " and added with "  + ".
// Trim and check the leading character to classify each line.
function diffToHtml(message) {
  return stripAnsi(message)
    .split('\n')
    .map(line => {
      const e = escHtml(line);
      const t = line.trimStart();
      if (t.startsWith('- ') || t === '-') return `<div class=del>${e}</div>`;
      if (t.startsWith('+ ') || t === '+') return `<div class=add>${e}</div>`;
      return `<div class=ctx>${e}</div>`;
    })
    .join('');
}

class HtmlReporter {
  onRunComplete(_contexts, results) {
    const failed = results.testResults.flatMap(suite =>
      suite.testResults
        .filter(t => t.status === 'failed')
        .map(t => ({ title: t.fullName, messages: t.failureMessages })),
    );

    if (failed.length === 0) return;

    const sections = failed.map(({ title, messages }) => `
<section>
  <h2>${escHtml(title)}</h2>
  ${messages.map(m => `<pre class=diff>${diffToHtml(m)}</pre>`).join('')}
</section>`).join('');

    const html = `<!DOCTYPE html>
<html lang=en>
<head>
<meta charset=utf-8>
<title>mac-triage diff</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font:13px/1.6 Menlo,Monaco,monospace;background:#1e1e1e;color:#d4d4d4;padding:28px}
h1{color:#9cdcfe;font-size:15px;margin-bottom:4px}
p.meta{color:#6a9955;font-size:11px;margin-bottom:28px}
section{margin-bottom:36px}
h2{color:#ce9178;font-size:13px;margin-bottom:8px}
pre.diff{background:#252526;border-radius:4px;padding:14px;overflow-x:auto;white-space:pre}
.del{background:#3d1515;color:#f48771;display:block}
.add{background:#153015;color:#89d185;display:block}
.ctx{color:#6e6e6e;display:block}
</style>
</head>
<body>
<h1>mac-triage snapshot diff</h1>
<p class=meta>${new Date().toLocaleString()} &mdash; ${failed.length} changed test${failed.length !== 1 ? 's' : ''} &mdash; run with <code>-u</code> or press <kbd>u</kbd> in watch mode to update</p>
${sections}
</body>
</html>`;

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, html);
    try { execSync(`open ${JSON.stringify(REPORT_PATH)}`); } catch { /* headless */ }
  }
}

module.exports = HtmlReporter;
