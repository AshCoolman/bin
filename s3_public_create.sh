#!/usr/bin/env bash
set -euo pipefail

die() { echo "FAIL: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "Missing dependency: $1"; }

need aws
need mktemp

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

confirm() {
  local prompt="$1" v
  read -r -p "$prompt (y/N): " v
  v="$(tolower "${v:-}")"
  [[ "$v" == "y" || "$v" == "yes" ]]
}

aws_profile_list() {
  aws configure list-profiles 2>/dev/null || true
}

aws_() {
  local profile="$1"; shift
  aws --profile "$profile" "$@"
}

bucket_exists_and_accessible() {
  local profile="$1" bucket="$2"
  aws_ "$profile" s3api head-bucket --bucket "$bucket" >/dev/null 2>&1
}

create_bucket() {
  local profile="$1" bucket="$2" region="$3"
  if [[ "$region" == "us-east-1" ]]; then
    aws_ "$profile" s3api create-bucket --bucket "$bucket" --region "$region" >/dev/null
  else
    aws_ "$profile" s3api create-bucket \
      --bucket "$bucket" \
      --region "$region" \
      --create-bucket-configuration LocationConstraint="$region" >/dev/null
  fi
}

set_public_access_block_off() {
  local profile="$1" bucket="$2"
  aws_ "$profile" s3api put-public-access-block \
    --bucket "$bucket" \
    --public-access-block-configuration '{
      "BlockPublicAcls": false,
      "IgnorePublicAcls": false,
      "BlockPublicPolicy": false,
      "RestrictPublicBuckets": false
    }' >/dev/null
}

put_public_read_policy() {
  local profile="$1" bucket="$2"
  local policy_file
  policy_file="$(mktemp "${TMPDIR:-/tmp}/s3-public-policy.XXXXXX.json")"
  cat > "$policy_file" <<EOF
{
  "Version":"2012-10-17",
  "Statement":[
    {
      "Sid":"PublicReadGetObject",
      "Effect":"Allow",
      "Principal":"*",
      "Action":["s3:GetObject"],
      "Resource":["arn:aws:s3:::$bucket/*"]
    }
  ]
}
EOF
  aws_ "$profile" s3api put-bucket-policy --bucket "$bucket" --policy "file://$policy_file" >/dev/null
  rm -f "$policy_file"
}

enable_website_hosting() {
  local profile="$1" bucket="$2"
  aws_ "$profile" s3api put-bucket-website --bucket "$bucket" \
    --website-configuration '{"IndexDocument":{"Suffix":"index.html"},"ErrorDocument":{"Key":"error.html"}}' >/dev/null
}

main() {
  echo "=== S3 Public Bucket Creator (AWS CLI v2) ==="
  echo

  local profiles
  profiles="$(aws_profile_list)"
  if [[ -n "$profiles" ]]; then
    echo "Available AWS profiles:"
    echo "$profiles" | sed 's/^/  - /'
    echo
  fi

  local profile region bucket
  profile="$(ask "AWS profile name" "default")"
  region="$(ask "AWS region" "ap-southeast-2")"
  bucket="$(ask "Bucket name (globally unique; lowercase recommended)")"
  [[ -n "$bucket" ]] || die "Bucket name required."

  echo
  echo "Summary:"
  echo "  profile: $profile"
  echo "  region : $region"
  echo "  bucket : $bucket"
  echo "  action : create bucket + make PUBLIC READ (objects)"
  echo

  confirm "Proceed?" || die "Cancelled."

  echo
  echo "DO: verify credentials"
  aws_ "$profile" sts get-caller-identity >/dev/null || die "AWS creds not working for profile '$profile'"
  echo "PASS: creds ok"

  if bucket_exists_and_accessible "$profile" "$bucket"; then
    die "Bucket already exists and is accessible: $bucket (refusing to change it)."
  fi

  echo "DO: create bucket"
  create_bucket "$profile" "$bucket" "$region"
  bucket_exists_and_accessible "$profile" "$bucket" || die "Bucket create failed or not accessible"
  echo "PASS: bucket created"

  echo "DO: disable bucket-level Block Public Access"
  set_public_access_block_off "$profile" "$bucket"
  echo "PASS: block public access disabled (bucket-level)"

  echo "DO: attach public-read bucket policy (GetObject)"
  put_public_read_policy "$profile" "$bucket"
  echo "PASS: public-read policy attached"

  echo
  if confirm "Enable S3 Static Website Hosting (index.html/error.html routing)?"; then
    echo "DO: enable website hosting"
    enable_website_hosting "$profile" "$bucket"
    echo "PASS: website hosting enabled"
    echo "NOTE: website endpoint differs from normal object endpoint."
  else
    echo "SKIP: website hosting"
  fi

  echo
  echo "PASS: done"
  echo "Next: run s3_public_sync.sh to upload files + generate index.html"
}

main "$@"