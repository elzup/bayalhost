#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
REPO_DIR=$( cd "$SCRIPT_DIR/.." ; pwd -P )
# Pass the source dir as $1, or set DAILY_REPORT_AI_DIR.
SOURCE_DIR="${1:-${DAILY_REPORT_AI_DIR:?Set DAILY_REPORT_AI_DIR or pass the source dir as the first argument}}"
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
