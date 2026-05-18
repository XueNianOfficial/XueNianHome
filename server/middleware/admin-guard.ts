/**
 * ============================================================
 *  管理后台服务端认证中间件
 *  拦截 /admin 页面请求，未登录用户仅返回最小化登录页
 *  防止管理面板 JS/CSS 暴露给未认证用户
 * ============================================================
 */
import { getCurrentUser } from '../utils/admin-auth'
/** 最小化登录页 HTML（不含管理组件） */
const LOGIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理后台 · 雪年</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f0f0f;color:#e0e0e0;display:flex;justify-content:center;align-items:center;min-height:100vh}
    .login-card{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:40px;width:100%;max-width:380px;text-align:center}
    .login-card h2{font-size:1.5rem;margin-bottom:8px;color:#fff}
    .login-desc{color:#888;margin-bottom:24px;font-size:.9rem}
    .login-form{display:flex;flex-direction:column;gap:12px}
    .login-input{padding:10px 14px;border:1px solid #444;border-radius:8px;background:#0f0f0f;color:#e0e0e0;font-size:1rem;outline:none;transition:border-color .2s}
    .login-input:focus{border-color:#6c63ff}
    .login-error{color:#ef4444;font-size:.85rem;min-height:1.2em}
    .login-btn{padding:10px;border:none;border-radius:8px;background:#6c63ff;color:#fff;font-size:1rem;cursor:pointer;transition:opacity .2s}
    .login-btn:disabled{opacity:.5;cursor:not-allowed}
    .login-btn:not(:disabled):hover{opacity:.9}
  </style>
</head>
<body>
  <div class="login-card">
    <h2>&#x1f510; 管理后台</h2>
    <p class="login-desc">请输入管理员账号和密码</p>
    <form id="loginForm" class="login-form">
      <input id="username" type="text" placeholder="用户名" class="login-input" autocomplete="username" required>
      <input id="password" type="password" placeholder="密码" class="login-input" autocomplete="current-password" required>
      <p id="loginError" class="login-error"></p>
      <button id="loginBtn" type="submit" class="login-btn">登录</button>
    </form>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit',async function(e){e.preventDefault();var u=document.getElementById('username').value.trim(),p=document.getElementById('password').value,btn=document.getElementById('loginBtn'),err=document.getElementById('loginError');if(!u||!p)return;btn.disabled=true;btn.textContent='验证中...';err.textContent='';try{var res=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});if(res.ok){window.location.reload()}else{var data=await res.json();err.textContent=data.message||'登录失败'}}catch(ex){err.textContent='网络错误，请重试'}finally{btn.disabled=false;btn.textContent='登录'}});
  </script>
</body>
</html>`

export default defineEventHandler((event) => {
  // 仅拦截 admin 页面（非 API 请求）
  const path = event.path
  if (path !== '/admin' && !path.startsWith('/admin/')) return

  // 允许 API 请求通过（它们有自己的鉴权）
  if (path.startsWith('/api/')) return

  // 仅拦截 GET 请求（页面加载）
  if (event.method !== 'GET') return

  // 检查登录状态
  const user = getCurrentUser(event)

  if (!user) {
    // 未登录：返回最小化登录页（不含管理组件 JS/CSS）
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    setHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
    return LOGIN_HTML
  }

  // 已登录：正常放行，由 Nuxt 渲染完整管理面板
})
