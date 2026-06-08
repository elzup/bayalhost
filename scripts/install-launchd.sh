#!/usr/bin/env bash
set -euo pipefail

# Install bayalhost launchd services on macOS.
#   ./scripts/install-launchd.sh [admin|all]
#     admin (default) -> admin-server only (http://admin.bayalhost:8918)
#     all             -> admin-server + Caddy (https://*.bayalhost)
#
# The plists under launchd/ are templates using a __REPO_DIR__ placeholder.
# This script substitutes the real repo path before loading them, so no
# machine-specific path is committed.

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
REPO_DIR=$(cd "$SCRIPT_DIR/.." && pwd -P)
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"

mode="${1:-admin}"

case "$mode" in
  admin) labels=("com.elzup.bayalhost-admin") ;;
  all) labels=("com.elzup.bayalhost-admin" "com.elzup.bayalhost") ;;
  *)
    echo "Usage: $0 [admin|all]" >&2
    exit 1
    ;;
esac

mkdir -p "$LAUNCH_AGENTS"

for label in "${labels[@]}"; do
  template="$REPO_DIR/launchd/$label.plist"
  target="$LAUNCH_AGENTS/$label.plist"

  if [ ! -f "$template" ]; then
    echo "Template not found: $template" >&2
    exit 1
  fi

  # Substitute the repo path into the installed copy.
  sed "s|__REPO_DIR__|$REPO_DIR|g" "$template" >"$target"

  # Reload cleanly (ignore "not loaded" on first install).
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$target"
  launchctl enable "gui/$(id -u)/$label"

  echo "Installed and enabled: $label"
done
