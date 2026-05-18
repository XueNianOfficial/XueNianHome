#!/bin/bash
# Certbot manual auth hook for HTTP-01 challenge
# Creates the challenge file and verifies it's accessible

TOKEN="$CERTBOT_TOKEN"
VALIDATION="$CERTBOT_VALIDATION"
WEBROOT="/var/www/xuenian.online/.well-known/acme-challenge"

mkdir -p "$WEBROOT"
echo "$VALIDATION" > "$WEBROOT/$TOKEN"
chmod 644 "$WEBROOT/$TOKEN"

echo "=== Auth hook: wrote $TOKEN ($(wc -c < "$WEBROOT/$TOKEN") bytes) ==="
echo "=== Verification from local ==="
curl -s "http://localhost/.well-known/acme-challenge/$TOKEN" -H "Host: xuenian.online" | head -c 50
echo ""
echo "=== Verification from external ==="
curl -s "http://xuenian.online/.well-known/acme-challenge/$TOKEN" | head -c 50
echo ""
echo "=== Size check ==="
curl -s -o /dev/null -w "size_download: %{size_download}\n" "http://xuenian.online/.well-known/acme-challenge/$TOKEN"

# Give LE time to validate
sleep 5
