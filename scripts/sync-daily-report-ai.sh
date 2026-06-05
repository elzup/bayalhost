#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
REPO_DIR=$( cd "$SCRIPT_DIR/.." ; pwd -P )
SOURCE_DIR="/Users/hiro/.ghq/github.com/elzup/daily-report-ai"
ARTIFACT_DIR="$REPO_DIR/artifacts/daily-report-ai"

if [ ! -f "$SOURCE_DIR/index.html" ]; then
  echo "daily-report-ai index.html not found: $SOURCE_DIR/index.html" >&2
  exit 1
fi

mkdir -p "$ARTIFACT_DIR"
rsync -a --delete \
  --include='index.html' \
  --include='output/***' \
  --include='reports/***' \
  --include='docs/***' \
  --exclude='*' \
  "$SOURCE_DIR"/ "$ARTIFACT_DIR"/

echo "Synced daily-report-ai artifact: $ARTIFACT_DIR"
