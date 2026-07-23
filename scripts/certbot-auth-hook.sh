#!/bin/bash
# ============================================================
#  Certbot manual 模式 HTTP-01 验证钩子（auth hook）
#  作用：把 ACME 挑战文件写入 webroot，并验证其可被外部访问，
#        供 Let's Encrypt 校验域名所有权
#  使用：certbot --manual --preferred-challenges http \
#          --manual-auth-hook 本脚本 --manual-cleanup-hook 清理脚本
# ============================================================

# certbot 注入的环境变量：挑战令牌与对应的验证内容
TOKEN="$CERTBOT_TOKEN"
VALIDATION="$CERTBOT_VALIDATION"
WEBROOT="/var/www/xuenian.online/.well-known/acme-challenge"

# 写入挑战文件（nginx 需将 /.well-known/acme-challenge/ 指向该目录）
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

# 等待数秒，给 Let's Encrypt 留出来站校验的时间
sleep 5
