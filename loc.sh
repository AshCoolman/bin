#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

if [[ ! -d "$ROOT" ]]; then
  echo "error: not a directory: $ROOT" >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

files_list="$tmpdir/files.txt"
stats_tsv="$tmpdir/stats.tsv"

cd "$ROOT"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -c core.quotepath=off ls-files -z \
    | while IFS= read -r -d '' f; do
        [[ -f "$f" ]] && printf '%s\0' "$f"
      done > "$files_list"
else
  find . \
    -type f \
    ! -path '*/.git/*' \
    ! -path '*/node_modules/*' \
    ! -path '*/dist/*' \
    ! -path '*/build/*' \
    ! -path '*/coverage/*' \
    ! -path '*/target/*' \
    ! -path '*/.next/*' \
    ! -path '*/.turbo/*' \
    ! -path '*/.cache/*' \
    -print0 > "$files_list"
fi

cat > "$tmpdir/parser.awk" <<'AWK'
function trim(s) {
  sub(/^[[:space:]]+/, "", s)
  sub(/[[:space:]]+$/, "", s)
  return s
}

BEGIN {
  blank = 0
  comment = 0
  code = 0
  in_block = 0
}

{
  line = $0
  stripped = trim(line)

  if (stripped == "") {
    blank++
    next
  }

  if (mode == "hash") {
    if (stripped ~ /^#/) comment++
    else code++
    next
  }

  if (mode == "sql") {
    if (in_block) {
      comment++
      if (line ~ /\*\//) in_block = 0
      next
    }
    if (stripped ~ /^--/) {
      comment++
      next
    }
    if (line ~ /^[[:space:]]*\/\*/) {
      comment++
      if (line !~ /\*\//) in_block = 1
      next
    }
    code++
    next
  }

  if (mode == "slash") {
    if (in_block) {
      comment++
      if (line ~ /\*\//) in_block = 0
      next
    }
    if (stripped ~ /^\/\//) {
      comment++
      next
    }
    if (line ~ /^[[:space:]]*\/\*/) {
      comment++
      if (line !~ /\*\//) in_block = 1
      next
    }
    code++
    next
  }

  if (mode == "html") {
    if (in_block) {
      comment++
      if (line ~ /-->/) in_block = 0
      next
    }
    if (line ~ /^[[:space:]]*<!--/) {
      comment++
      if (line !~ /-->/) in_block = 1
      next
    }
    code++
    next
  }

  if (mode == "lua") {
    if (in_block) {
      comment++
      if (line ~ /\]\]/) in_block = 0
      next
    }
    if (stripped ~ /^--\[\[/) {
      comment++
      if (line !~ /\]\]/) in_block = 1
      next
    }
    if (stripped ~ /^--/) {
      comment++
      next
    }
    code++
    next
  }

  if (mode == "hs") {
    if (in_block) {
      comment++
      if (line ~ /-\}/) in_block = 0
      next
    }
    if (stripped ~ /^\{\-/) {
      comment++
      if (line !~ /-\}/) in_block = 1
      next
    }
    if (stripped ~ /^--/) {
      comment++
      next
    }
    code++
    next
  }

  code++
}

END {
  printf "%d\t%d\t%d\n", blank, comment, code
}
AWK

detect_lang() {
  local file="$1"

  if [[ "$(file -b --mime-type "$file" 2>/dev/null)" != text/* ]]; then
    echo ""
    return
  fi

  local base ext
  base="$(basename "$file")"
  ext="${base##*.}"
  [[ "$base" == "$ext" ]] && ext=""

  case "$base" in
    Dockerfile|Containerfile) echo "Dockerfile|hash"; return ;;
    Makefile|GNUmakefile|makefile) echo "Makefile|hash"; return ;;
    CMakeLists.txt) echo "CMake|hash"; return ;;
    .bashrc|.bash_profile|.zshrc|.profile|.gitignore|.dockerignore|.eslintignore|.prettierignore) echo "Config|hash"; return ;;
  esac

  case "$ext" in
    sh|bash|zsh|ksh) echo "Shell|hash" ;;
    py|pyw) echo "Python|hash" ;;
    rb) echo "Ruby|hash" ;;
    pl|pm) echo "Perl|hash" ;;
    yaml|yml) echo "YAML|hash" ;;
    toml) echo "TOML|hash" ;;
    ini|conf|cfg|properties) echo "Config|hash" ;;
    mk) echo "Makefile|hash" ;;

    ts|tsx) echo "TypeScript|slash" ;;
    js|mjs|cjs|jsx|mdx) echo "JavaScript|slash" ;;
    java) echo "Java|slash" ;;
    c|h) echo "C|slash" ;;
    cc|cpp|cxx|hpp) echo "C++|slash" ;;
    cs) echo "C#|slash" ;;
    go) echo "Go|slash" ;;
    rs) echo "Rust|slash" ;;
    swift) echo "Swift|slash" ;;
    kt|kts) echo "Kotlin|slash" ;;
    scala) echo "Scala|slash" ;;
    groovy) echo "Groovy|slash" ;;
    dart) echo "Dart|slash" ;;
    css) echo "CSS|slash" ;;
    php) echo "PHP|slash" ;;
    sql) echo "SQL|sql" ;;
    html|htm|xml|svg|vue|svelte) echo "Markup|html" ;;
    lua) echo "Lua|lua" ;;
    hs) echo "Haskell|hs" ;;
    tf|hcl) echo "Terraform|hash" ;;
    graphql|gql) echo "GraphQL|hash" ;;

    md|markdown|txt|rst|adoc) echo "Text|text" ;;
    json) echo "JSON|text" ;;
    lock) echo "Lockfile|text" ;;
    *) echo "" ;;
  esac
}

export tmpdir
export -f detect_lang

process_file() {
  local file="$1"
  local meta lang mode blank comment code lines
  meta="$(detect_lang "$file" || true)"
  [[ -z "$meta" ]] && return
  lang="${meta%%|*}"
  mode="${meta##*|}"
  if [[ "$mode" == "text" ]]; then
    lines="$(wc -l < "$file" | tr -d ' ')"
    printf "%s\t%s\t1\t0\t0\t%s\n" "$lang" "$mode" "$lines"
    return
  fi
  IFS=$'\t' read -r blank comment code < <(awk -v mode="$mode" -f "$tmpdir/parser.awk" "$file")
  printf "%s\t%s\t1\t%s\t%s\t%s\n" "$lang" "$mode" "$blank" "$comment" "$code"
}
export -f process_file

{
  printf "language\tmode\tfiles\tblank\tcomment\tcode\n"
  local_cpu="$(nproc 2>/dev/null || sysctl -n hw.logicalcpu 2>/dev/null || echo 4)"
  xargs -0 -P"$local_cpu" -I{} bash -c 'process_file "$@"' _ {} < "$files_list"
} > "$stats_tsv"

awk -F'\t' '
NR == 1 { next }
{
  lang = $1; m = $2
  files[lang] += $3
  blank[lang] += $4
  comment[lang] += $5
  code[lang]  += $6
  lang_mode[lang] = m

  mf[m] += $3; mb[m] += $4; mc[m] += $5; mcode[m] += $6

  total_files += $3
  total_blank += $4
  total_comment += $5
  total_code += $6
}
END {
  # friendly group labels, ordered by typical importance
  split("slash,hash,html,sql,lua,hs,text", gorder, ",")
  split("Source,Script,Markup,SQL,Lua,Haskell,Text", glabel, ",")
  ng = 7
  for (i = 1; i <= ng; i++) label[gorder[i]] = glabel[i]

  # collect languages per mode, sorted by code desc within each group
  for (k in files) {
    m = lang_mode[k]
    gc = ++gcount[m]
    gmembers[m, gc] = k
  }
  for (m in gcount) {
    for (i = 1; i <= gcount[m]; i++) {
      for (j = i + 1; j <= gcount[m]; j++) {
        a = gmembers[m, i]; b = gmembers[m, j]
        if (code[b] > code[a]) {
          gmembers[m, i] = b; gmembers[m, j] = a
        }
      }
    }
  }

  fmt  = "%-14s %8d %10d %10d %10d\n"
  hdr  = "%-14s %8s %10s %10s %10s\n"
  sep  = "--------------"

  printf hdr, "Language", "Files", "Blank", "Comment", "Code"
  printf hdr, sep, "--------", "----------", "----------", "----------"

  for (gi = 1; gi <= ng; gi++) {
    m = gorder[gi]
    if (!(m in gcount)) continue

    lbl = (m in label) ? label[m] : m
    printf "\n  [%s]\n", lbl

    for (i = 1; i <= gcount[m]; i++) {
      k = gmembers[m, i]
      printf fmt, k, files[k], blank[k], comment[k], code[k]
    }
    printf fmt, "  subtotal", mf[m], mb[m], mc[m], mcode[m]
  }

  printf hdr, sep, "--------", "----------", "----------", "----------"
  printf fmt, "Total", total_files, total_blank, total_comment, total_code
}
' "$stats_tsv"