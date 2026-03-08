#!/usr/bin/env bash
set -euo pipefail

die() { echo "FAIL: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "Missing dependency: $1"; }

need aws
need python3
need mktemp
need find

ask() {
  local prompt="$1" default="${2:-}" v
  if [[ -n "$default" ]]; then
    read -r -p "$prompt [$default]: " v
    echo "${v:-$default}"
  else
    read -r -p "$prompt: " v
    echo "$v"
  fi
}

tolower() { echo "$1" | tr '[:upper:]' '[:lower:]'; }

aws_() {
  local profile="$1"; shift
  aws --profile "$profile" --region "$region" "$@"
}

bucket_accessible() {
  local profile="$1" bucket="$2"
  aws_ "$profile" s3api head-bucket --bucket "$bucket" >/dev/null 2>&1
}

public_base_url() {
  local bucket="$1" region="$2"
  if [[ "$region" == "us-east-1" ]]; then
    echo "https://$bucket.s3.amazonaws.com"
  else
    echo "https://$bucket.s3.$region.amazonaws.com"
  fi
}

usage() {
  cat <<'EOF'
Usage:
  s3_public_sync.sh [--dry-run] [SRC_DIR]

Defaults:
  SRC_DIR defaults to current directory (.)
  --dry-run generates index preview only; does NOT sync or upload anything.

Examples:
  ./s3_public_sync.sh
  ./s3_public_sync.sh ./public
  ./s3_public_sync.sh --dry-run
  ./s3_public_sync.sh --dry-run ./public
EOF
}

main() {
  local dry_run="false"
  local src="."

  # --- args (bash 3.2 compatible) ---
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run|-n) dry_run="true"; shift ;;
      -h|--help) usage; exit 0 ;;
      --) shift; break ;;
      -*)
        die "Unknown option: $1 (use --help)"
        ;;
      *)
        src="$1"; shift ;;
    esac
  done

  [[ -d "$src" ]] || die "Not a folder: $src"

  echo "=== S3 Public Bucket Sync (no delete) + Local Index Generator ==="
  echo

  local profile region bucket prefix
  profile="$(ask "AWS profile name" "default")"
  region="$(ask "AWS region" "ap-southeast-2")"
  bucket="$(ask "Bucket name")"
  [[ -n "$bucket" ]] || die "Bucket name required."

  prefix="$(ask "Optional prefix inside bucket (blank for root)")"
  prefix="${prefix#/}"; prefix="${prefix%/}"

  echo
  echo "Summary:"
  echo "  src     : $src"
  echo "  profile : $profile"
  echo "  region  : $region"
  echo "  bucket  : $bucket"
  echo "  prefix  : ${prefix:-<root>}"
  echo "  mode    : $( [[ "$dry_run" == "true" ]] && echo "DRY RUN (index only)" || echo "SYNC + upload index" )"
  echo

  echo "DO: verify bucket is accessible"
  bucket_accessible "$profile" "$bucket" || die "Bucket not accessible (or doesn't exist): $bucket"
  echo "PASS: bucket accessible"

  local dst="s3://$bucket"
  if [[ -n "$prefix" ]]; then
    dst="s3://$bucket/$prefix"
  fi

  local tmpdir index_html
  tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/s3-index.XXXXXX")"
  index_html="$tmpdir/index.html"

  echo
  echo "DO: generate index.html from local folder"
  python3 - "$src" "$index_html" "$(public_base_url "$bucket" "$region")" "$prefix" <<'PY'
import os, sys, html, urllib.parse, datetime

src, out_file, base_url, prefix = sys.argv[1:5]

def relpaths(root):
  out = []
  for dirpath, dirnames, filenames in os.walk(root):
    dirnames.sort()
    filenames.sort()
    for fn in filenames:
      if fn == ".DS_Store":
        continue
      full = os.path.join(dirpath, fn)
      rel = os.path.relpath(full, root).replace(os.sep, "/")
      if rel == "index.html":
        continue
      out.append(rel)
  return out

files = sorted(relpaths(src), key=lambda s: s.lower())

def s3_key(rel):
  if prefix:
    p = prefix.strip("/") + "/"
    return p + rel
  return rel

def url_for(rel):
  key = s3_key(rel)
  return f"{base_url}/{urllib.parse.quote(key, safe='/')}"

now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

parts = []
parts.append("<!doctype html>")
parts.append("<html><head><meta charset='utf-8'>")
parts.append("<title>Index</title>")
parts.append("<meta name='viewport' content='width=device-width, initial-scale=1'>")
parts.append("<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px} table{border-collapse:collapse;width:100%} th,td{padding:8px 10px;border-bottom:1px solid #ddd;font-size:14px} th{text-align:left} a{word-break:break-all}</style>")
parts.append("</head><body>")
parts.append("<h1>Index</h1>")
parts.append(f"<div style='margin-bottom:12px;color:#555'>Generated {html.escape(now)}</div>")
parts.append("<table><thead><tr><th>File</th></tr></thead><tbody>")

for rel in files:
  url = url_for(rel)
  parts.append("<tr>")
  parts.append(f"<td><a href='{html.escape(url)}'>{html.escape(rel)}</a></td>")
  parts.append("</tr>")

parts.append("</tbody></table>")
parts.append("</body></html>")

open(out_file, "w", encoding="utf-8").write("\n".join(parts))

print(f"PASS: index contains {len(files)} files")
for rel in files[:50]:
  print(f"  - {rel}")
if len(files) > 50:
  print(f"  ... ({len(files)-50} more)")
print(f"PASS: wrote {out_file}")
PY

  if [[ "$dry_run" == "true" ]]; then
    echo
    echo "PASS: DRY RUN complete (no sync, no upload)"
    echo "Index file at: $index_html"
    exit 0
  fi

  echo
  echo "DO: sync folder -> $dst/ (no delete)"
  aws_ "$profile" s3 sync "$src" "$dst/"
  echo "PASS: sync complete"

  # FIX: ensure .zip objects get correct headers for browser downloads
  # - re-upload zips only (small cost for infrequent use)
  # - use --metadata-directive REPLACE so headers actually apply if object already exists
  echo
  echo "DO: ensure .zip headers (Content-Type application/zip, Content-Disposition attachment)"
  find "$src" -type f -name '*.zip' -print0 2>/dev/null | while IFS= read -r -d '' f; do
    rel="${f#$src/}"
    rel="${rel#./}"
    key="$rel"
    if [[ -n "$prefix" ]]; then
      key="$prefix/$rel"
    fi
    aws_ "$profile" s3 cp "$f" "s3://$bucket/$key" \
      --content-type application/zip \
      --content-disposition attachment \
      --metadata-directive REPLACE >/dev/null
    echo "  PASS: $rel"
  done

  echo
  echo "DO: upload generated index.html"
  aws_ "$profile" s3 cp "$index_html" "$dst/index.html"
  echo "PASS: uploaded index.html"

  echo
  echo "Public URL:"
  if [[ -n "$prefix" ]]; then
    echo "$(public_base_url "$bucket" "$region")/$prefix/index.html"
  else
    echo "$(public_base_url "$bucket" "$region")/index.html"
  fi

  rm -rf "$tmpdir"
}

main "$@"