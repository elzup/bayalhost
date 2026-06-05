#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
REPO_DIR=$( cd "$SCRIPT_DIR/.." ; pwd -P )
SITES_DIR="$REPO_DIR/sites"

project="${1:-}"
dist_dir="${2:-}"
env_file="${3:-}"

usage() {
  echo "Usage: $0 <project> <dist-dir> [env-file]" >&2
}

if [ -z "$project" ] || [ -z "$dist_dir" ]; then
  usage
  exit 1
fi

if ! [[ "$project" =~ ^[a-z0-9-]+$ ]]; then
  echo "Invalid project name: $project" >&2
  echo "Use lowercase letters, numbers, and hyphens only." >&2
  exit 1
fi

if [ ! -d "$dist_dir" ]; then
  echo "dist directory does not exist: $dist_dir" >&2
  exit 1
fi

if [ ! -f "$dist_dir/index.html" ]; then
  echo "dist directory must contain index.html: $dist_dir" >&2
  exit 1
fi

if [ -n "$env_file" ] && [ ! -f "$env_file" ]; then
  echo "env file does not exist: $env_file" >&2
  exit 1
fi

timestamp=$(date +%Y%m%d-%H%M%S)
project_dir="$SITES_DIR/$project"
release_dir="$project_dir/releases/$timestamp"

mkdir -p "$release_dir"
rsync -a --delete "$dist_dir"/ "$release_dir"/

if [ -n "$env_file" ]; then
  node "$SCRIPT_DIR/render-env.mjs" "$env_file" "$release_dir/env.js"
fi

ln -sfn "releases/$timestamp" "$project_dir/current"

echo "Deployed $project"
echo "Release: $release_dir"
echo "URL: https://$project.bayalhost"
