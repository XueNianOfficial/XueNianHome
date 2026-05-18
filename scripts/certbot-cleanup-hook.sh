#!/bin/bash
# Certbot manual cleanup hook
rm -f "/var/www/xuenian.online/.well-known/acme-challenge/$CERTBOT_TOKEN"
echo "=== Cleanup hook: removed $CERTBOT_TOKEN ==="
