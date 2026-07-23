#!/bin/bash
# ============================================================
#  Certbot manual 模式 HTTP-01 清理钩子（cleanup hook）
#  作用：验证结束后删除 ACME 挑战文件
# ============================================================
rm -f "/var/www/xuenian.online/.well-known/acme-challenge/$CERTBOT_TOKEN"
echo "=== Cleanup hook: removed $CERTBOT_TOKEN ==="
