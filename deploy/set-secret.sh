#!/bin/sh
# Asks for the Shopify client secret (not echoed) and writes it into deploy/.env.
# Run on the server: ssh -t <server> /opt/loftline-ops/deploy/set-secret.sh
set -eu
env_file="$(dirname "$0")/.env"
printf 'Client secret: '
stty -echo
read -r secret
stty echo
printf '\n'
[ -n "$secret" ] || { echo 'Nothing entered; .env not changed.'; exit 1; }
tmp="$(mktemp "$env_file.XXXXXX")"
awk -v s="$secret" 'BEGIN { done = 0 } /^SHOPIFY_API_SECRET=/ { print "SHOPIFY_API_SECRET=" s; done = 1; next } { print } END { if (!done) print "SHOPIFY_API_SECRET=" s }' "$env_file" > "$tmp"
chmod 600 "$tmp"
mv "$tmp" "$env_file"
echo 'Saved.'
