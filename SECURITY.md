# 安全部署指南

## 1. 生产环境部署（最重要）

### 1.1 构建生产版本

```bash
# 设置生产环境变量
export NODE_ENV=production

# 构建生产版本（而非 nuxt dev）
npm run build

# 使用 PM2 或其他进程管理器启动
pm2 start .output/server/index.mjs --name xuenian-home
```

### 1.2 验证生产模式

```bash
curl -s https://xuenian.hellofurry.cn/ | grep -o 'buildId:"[^"]*"'
# 应输出哈希值如 buildId:"abc123..."，而不是 buildId:"dev"
```

---

## 2. Nginx 安全配置

以下是 nginx 中需要添加的安全配置：

```nginx
# ============================================================
#  基础安全配置
# ============================================================

# 隐藏 nginx 版本号
server_tokens off;

# 限制仅允许必要的 HTTP 方法
if ($request_method !~ ^(GET|POST|HEAD|OPTIONS)$) {
    return 405;
}

server {
    listen 443 ssl http2;
    server_name xuenian.hellofurry.cn;

    # ============================================================
    #  阻止开发工具端点（双重保障）
    # ============================================================
    location /__nuxt_devtools__ {
        return 404;
    }

    location /_nuxt/@vite {
        return 404;
    }

    # ============================================================
    #  反向代理到 Nuxt
    # ============================================================
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 传递客户端真实 IP
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 隐藏后端框架标识
        proxy_hide_header X-Powered-By;

        # ==========================================================
        #  安全响应头（在 nginx 层面设置，优先于应用层）
        # ==========================================================
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()" always;
        add_header Cross-Origin-Resource-Policy "same-origin" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Embedder-Policy "unsafe-none" always;
    }

    # ============================================================
    #  自定义错误页面（隐藏错误详情）
    # ============================================================
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
        internal;
    }
}
```

---

## 3. 管理后台安全建议

### 3.1 环境变量强密码

```bash
# 设置强密码（替换默认的 admin123）
export NUXT_ADMIN_PASSWORD="<生成强随机密码>"
```

### 3.2 IP 白名单（可选，最安全）

```nginx
# 在 nginx location /admin 中添加：
location /admin {
    # 仅允许特定 IP 访问
    allow 192.168.1.0/24;   # 内网
    allow 1.2.3.4;           # 你的 VPN/固定 IP
    deny all;

    proxy_pass http://127.0.0.1:3000;
    # ... 其他 proxy 配置
}
```

---

## 4. 验证清单

部署后，逐项验证以下内容：

| # | 检查项 | 验证命令 | 预期结果 |
|---|--------|----------|---------|
| 1 | buildId 非 dev | `curl -s URL \| grep buildId` | 哈希值 |
| 2 | DevTools 不可访问 | `curl -I URL/__nuxt_devtools__/client` | 404 |
| 3 | 安全响应头存在 | `curl -I URL` | 包含 CSP, HSTS, X-Frame-Options 等 |
| 4 | 无堆栈跟踪泄露 | `curl -X POST URL/api/chat -H 'Content-Type: application/json' -d '{"message":"test"}'` | 无堆栈，无 /root/ 路径 |
| 5 | 无 X-Powered-By | `curl -I URL` | 无 Nuxt 标识 |
| 6 | 无 Server 版本 | `curl -I URL` | 无 nginx 版本号 |
| 7 | PUT/DELETE 被拒绝 | `curl -X PUT URL` | 405 |
| 8 | 管理后台登录速率限制 | 连续 5 次错误密码 | 429 错误 |
| 9 | Cookie 安全属性 | 登录后查看 Set-Cookie | Secure; HttpOnly; SameSite=Lax |
