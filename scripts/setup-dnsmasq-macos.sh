#!/usr/bin/env bash
set -euo pipefail

DNSMASQ_CONF_DIR="/opt/homebrew/etc/dnsmasq.d"
DNSMASQ_MAIN_CONF="/opt/homebrew/etc/dnsmasq.conf"
DNSMASQ_CONF="$DNSMASQ_CONF_DIR/bayalhost.conf"
RESOLVER_DIR="/etc/resolver"
RESOLVER_CONF="$RESOLVER_DIR/bayalhost"

if ! command -v dnsmasq >/dev/null 2>&1; then
  echo "dnsmasq is not installed. Install it with: brew install dnsmasq" >&2
  exit 1
fi

mkdir -p "$DNSMASQ_CONF_DIR"
touch "$DNSMASQ_MAIN_CONF"

if ! grep -q '^conf-dir=/opt/homebrew/etc/dnsmasq.d/,*.conf$' "$DNSMASQ_MAIN_CONF"; then
  printf '\nconf-dir=/opt/homebrew/etc/dnsmasq.d/,*.conf\n' >> "$DNSMASQ_MAIN_CONF"
fi

if ! grep -q '^listen-address=127.0.0.1$' "$DNSMASQ_MAIN_CONF"; then
  printf 'listen-address=127.0.0.1\n' >> "$DNSMASQ_MAIN_CONF"
fi

sed -i '' '/^port=/d' "$DNSMASQ_MAIN_CONF"

cat > "$DNSMASQ_CONF" <<'EOF'
address=/.bayalhost/127.0.0.1
EOF

sudo mkdir -p "$RESOLVER_DIR"
printf 'nameserver 127.0.0.1\n' | sudo tee "$RESOLVER_CONF" >/dev/null

brew services stop dnsmasq >/dev/null 2>&1 || true
sudo brew services restart dnsmasq

echo "Configured *.bayalhost -> 127.0.0.1"
echo "Verify direct dnsmasq with: dig @127.0.0.1 comemiru.bayalhost +short"
echo "Verify macOS resolver with: dscacheutil -q host -a name comemiru.bayalhost"
