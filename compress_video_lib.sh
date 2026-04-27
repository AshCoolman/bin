# compress_video_lib.sh
# Sourced by compress_video. Pure helpers + shared state.
# Not executable on its own.

# --- error / dependency helpers -------------------------------------------

_cvlib_err() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

_cvlib_need() {
  command -v "$1" >/dev/null 2>&1 || _cvlib_err "Missing dependency: $1"
}

# $1=list (encoders|filters)  — echoes one name per line
_cvlib_ff_list_names() {
  case "$1" in
    encoders)
      ffmpeg -hide_banner -v error -encoders \
        | awk 'NF>=2 && $1 !~ /Encoders:|------/ {print $2}'
      ;;
    filters)
      ffmpeg -hide_banner -v error -filters \
        | awk 'NF>=2 && $1 !~ /Filters:|------/ {print $2}'
      ;;
    *) _cvlib_err "_cvlib_ff_list_names: unknown list '$1'";;
  esac
}

# $1=list  $2=name — returns 0 if ffmpeg exposes it
_cvlib_ff_has() {
  _cvlib_ff_list_names "$1" | grep -Fxq "$2"
}

# --- validation -----------------------------------------------------------

_cvlib_is_number() {
  [[ "$1" =~ ^[0-9]+([.][0-9]+)?$ ]]
}

_cvlib_require_positive() {
  local val="$1" name="$2"
  _cvlib_is_number "$val" || _cvlib_err "$name must be a number"
  (( $(echo "$val > 0" | bc -l) )) || _cvlib_err "$name must be > 0"
}

# --- target-spec DSL ------------------------------------------------------
#
# Parse a size/quality target. Echoes "<mode> <value>" where mode ∈ mb|pct|br.
# Suffixes are case-insensitive. Value may be a decimal.
#   10mb → "mb 10"      absolute target file size in megabytes
#   10%  → "pct 10"     percent of source file size
#   15br → "br 15"      target video bitrate in Mbps
_cvlib_parse_target() {
  local spec="$1"
  [[ -n "$spec" ]] || _cvlib_err "target required"
  local lower
  lower="$(printf '%s' "$spec" | tr '[:upper:]' '[:lower:]')"

  local num mode
  if [[ "$lower" =~ ^([0-9]+(\.[0-9]+)?)mb$ ]]; then
    mode="mb"; num="${BASH_REMATCH[1]}"
  elif [[ "$lower" =~ ^([0-9]+(\.[0-9]+)?)%$ ]]; then
    mode="pct"; num="${BASH_REMATCH[1]}"
  elif [[ "$lower" =~ ^([0-9]+(\.[0-9]+)?)br$ ]]; then
    mode="br"; num="${BASH_REMATCH[1]}"
  else
    _cvlib_err "bad target '$spec' — expected e.g. 10mb, 10%, or 15br"
  fi
  (( $(echo "$num > 0" | bc -l) )) || _cvlib_err "target must be > 0 (got '$spec')"
  printf '%s %s\n' "$mode" "$num"
}

# --- file helpers ---------------------------------------------------------

# stat is non-portable between macOS and Linux; try both.
_cvlib_file_size_bytes() {
  local f="$1" bytes=""
  if bytes=$(stat -f%z "$f" 2>/dev/null); then
    printf '%s' "$bytes"; return 0
  fi
  if bytes=$(stat -c%s "$f" 2>/dev/null); then
    printf '%s' "$bytes"; return 0
  fi
  _cvlib_err "stat failed for: $f"
}

_cvlib_is_video_ext() {
  local ext="${1##*.}"
  [[ "$ext" == "$1" ]] && return 1
  ext="$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"
  case "$ext" in
    mp4|mov|mkv|avi|m4v|webm) return 0;;
    *) return 1;;
  esac
}

# --- output naming --------------------------------------------------------

# mb / pct modes — unchanged from pre-refactor format.
# $1=input  $2=max_mb  $3=speed  $4=match(0|1)
_cvlib_output_name_size() {
  local input="$1" max_mb="$2" speed="$3" match="$4"
  local suffix=""
  [[ "$match" -eq 1 ]] && suffix="_match"
  printf '%s\n' "${input%.*}_max${max_mb}MB_${speed}x${suffix}.mp4"
}

# br mode — new naming format.
# $1=input  $2=mbps  $3=speed  $4=match(0|1)
_cvlib_output_name_bitrate() {
  local input="$1" mbps="$2" speed="$3" match="$4"
  local suffix=""
  [[ "$match" -eq 1 ]] && suffix="_match"
  printf '%s\n' "${input%.*}_${mbps}mbps_${speed}x${suffix}.mp4"
}

# True for files that look like either naming convention above.
_cvlib_is_compressed_output() {
  local base
  base="$(basename "$1")"
  [[ "$base" =~ _max[0-9]+(\.[0-9]+)?MB_[0-9]+(\.[0-9]+)?x(_match)?\.mp4$ ]] && return 0
  [[ "$base" =~ _[0-9]+(\.[0-9]+)?mbps_[0-9]+(\.[0-9]+)?x(_match)?\.mp4$ ]] && return 0
  return 1
}

# --- pure math: bitrate budgeting -----------------------------------------
#
# Single-pass VBV-locked CBR. These numbers are identical to the pre-refactor
# script — preserved byte-for-byte via the same bc expressions.
#
# Echoes "VIDEO_KBPS BUF_KBPS".
# $1=duration $2=speed $3=max_mb $4=audio_kbps $5=headroom $6=min_kbps
_cvlib_compute_bitrate_for_size() {
  local duration="$1" speed="$2" max_mb="$3"
  local audio_kbps="$4" headroom="$5" min_kbps="$6"

  local out_dur target_kbps safe_total_kbps video_kbps buf_kbps
  out_dur=$(echo "scale=6; $duration / $speed" | bc -l)
  target_kbps=$(echo "$max_mb*1024*1024*8 / $out_dur / 1000" | bc -l)
  safe_total_kbps=$(echo "$target_kbps * $headroom" | bc -l)
  video_kbps=$(echo "$safe_total_kbps - $audio_kbps" | bc -l | awk '{printf "%.0f",$0}')
  (( video_kbps < min_kbps )) && video_kbps=$min_kbps
  buf_kbps=$(( video_kbps * 2 ))
  printf '%s %s\n' "$video_kbps" "$buf_kbps"
}

# Echoes "VIDEO_KBPS BUF_KBPS" from a direct Mbps target.
# $1=mbps
_cvlib_compute_bitrate_for_br() {
  local mbps="$1"
  local video_kbps buf_kbps
  video_kbps=$(echo "$mbps * 1000" | bc -l | awk '{printf "%.0f",$0}')
  buf_kbps=$(( video_kbps * 2 ))
  printf '%s %s\n' "$video_kbps" "$buf_kbps"
}

# --- filter builders ------------------------------------------------------

# Echoes the atempo chain for a given speed (empty if speed == 1).
# ffmpeg's atempo filter is limited to [0.5, 2.0] per instance, hence chaining.
# $1=speed
_cvlib_build_audio_filter() {
  local speed="$1"
  (( $(echo "$speed != 1" | bc -l) )) || { printf ''; return 0; }

  local factor="$speed"
  local -a atempo_filters=()
  while (( $(echo "$factor > 2.0" | bc -l) )); do
    atempo_filters+=("atempo=2.0")
    factor=$(echo "$factor / 2.0" | bc -l)
  done
  while (( $(echo "$factor < 0.5" | bc -l) )); do
    atempo_filters+=("atempo=0.5")
    factor=$(echo "$factor / 0.5" | bc -l)
  done
  atempo_filters+=("atempo=$factor")
  (IFS=,; printf '%s\n' "${atempo_filters[*]}")
}

# Echoes the -vf string.
# $1=speed  $2=match(0|1)  $3=scale_factor  $4=target_fps  $5=unsharp_params
_cvlib_build_video_filter() {
  local speed="$1" match="$2" scale="$3" target_fps="$4" unsharp="$5"
  local vf="setpts=PTS/${speed}"
  [[ "$match" -ne 1 ]] && vf+=",fps=${target_fps}"
  vf+=",scale=trunc(iw*${scale}/2)*2:trunc(ih*${scale}/2)*2,unsharp=${unsharp}"
  printf '%s\n' "$vf"
}

# Echoes the sync-mode flags for --match (empty otherwise).
# $1=match(0|1)
_cvlib_detect_sync_args() {
  local match="$1"
  [[ "$match" -eq 1 ]] || { printf ''; return 0; }
  if ffmpeg -hide_banner -h full 2>/dev/null | grep -Fq "fps_mode"; then
    printf '%s\n' "-fps_mode passthrough"
  else
    printf '%s\n' "-vsync 0"
  fi
}
