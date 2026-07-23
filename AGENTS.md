# AGENTS.md

> 本文件面向 AI 编码代理，介绍本项目的架构、命令与开发约定。
> 项目文档与代码注释以中文为主，请保持这一语言习惯。

## 项目概览

**雪年个人网站（XueNianHome）**—— furry 角色「雪年 XueNian」的个人网站，包含首页、博客、画廊、友链、AI 聊天和管理后台。

- **技术栈**：Nuxt 4（`^4.4.5`）+ Vue 3（`<script setup lang="ts">`）+ Nitro 服务端，TypeScript 全栈
- **渲染模式**：SSR，Nitro 预设为 `node-server`（构建产物 `.output/server/index.mjs`）
- **持久化**：无数据库。博客为 `content/blog/*.md`（YAML frontmatter），其余数据为 `server/data/*.json`（聊天记录、AI 设置、管理员账号、友链、画廊元数据）
- **AI 聊天**：服务端代理 OpenAI 兼容 API（OpenAI / Azure / Ollama），支持 SSE 流式响应、多预设、多模态（图片）输入；API Key 仅存服务端；配置画图密钥后 AI 可通过 `[DRAW]提示词[/DRAW]` 标记自主画图，前端识别后自动调 `/api/chat/draw` 出图插入会话
- **Markdown 渲染**：`markdown-it`（`html: false`，禁原始 HTML 防 XSS），内存缓存 5 分钟 TTL
- 无 Pinia（状态用 composables 内的模块级 `ref` 单例，见 `app/composables/`）、无 Tailwind（原生 CSS 变量 + scoped 样式）、无 UI 组件库

## 目录结构

```
app/                    # 前端（Nuxt 4 的 srcDir 为 app/）
  pages/                # 路由页面：index, blog/[slug], gallery, friends, chat, admin
                        # [...slug].vue 为 404 捕获页（内嵌小恐龙游戏 DinoGame）
  components/           # 按域分组：admin/ blog/ chat/ common/ game/ home/
                        #   common/AppToast.vue 全局通知；admin/AdminConfirm.vue 确认弹窗；
                        #   chat/ 下 ChatWindow 为编排层，ChatInput/ChatWelcome/ChatSessionList 为子组件；
                        #   common/CursorGlow.vue 鼠标光晕 + Canvas 丝带拖尾、
                        #   common/ScrollReveal.vue 多方向滚动揭示（up/down/left/right/zoom）；
                        #   home/ 下 HeroSection（视差立绘）、HomeStats、HomeLatestPosts、
                        #   HomeGalleryPreview、HomeSocialLinks 等首页内容区组件
  composables/          # useChat.ts（聊天状态）, useTheme.ts（亮/暗主题）, useToast.ts（全局通知）,
                        # useParallax.ts（滚动视差，共享 rAF，首页 Hero 光晕/装饰元素使用）
  layouts/default.vue   # 默认布局（AppHeader + 页脚 + 主题 + AppToast 全局通知）
  plugins/csrf.client.ts# 用 Proxy 包装全局 $fetch，自动给变更请求附加 CSRF 头
  data/                 # 静态前端数据（friends.ts 作为 /api/friends 的回退, social.ts）
  types/index.ts        # 全站 TypeScript 类型（BlogPost, ChatMessage, GalleryImage 等）
  assets/css/main.css   # 设计系统：CSS 变量定义亮/暗双主题（主色 #4A90D9），含语义色/
                        # 间距/字号/阴影/圆角/z-index 令牌与 .btn/.input/.badge 等工具类

server/                 # Nitro 后端
  api/                  # 文件路由（xxx.get.ts / xxx.post.ts / xxx.delete.ts）
    chat.post.ts        #   POST /api/chat（SSE 流式或 JSON，先过 csrfProtection）
                        #   支持会话级 enableThinking/enableSearch/customSystemPrompt（服务端 resolveChatOptions 校验）
    chat/upload.post.ts #   聊天图片上传；chat/history.* 聊天记录读写
    chat/draw.post.ts   #   AI 画图（内存限速 5次/60s/IP，火山方舟 images/generations，结果落盘 images/chat/）
    presets.get.ts      #   公开：AI 预设名称/能力标记（不含密钥）
                        #   另下发 default 三能力、imageGenEnabled、promptTemplates
    blog/ friends.get.ts gallery/  # 公开只读接口
    admin/              #   管理接口：login/logout/check + blog/gallery/chat/friends/settings CRUD
                        #   + logs（系统日志：list/detail/delete，查看 AI 请求完整内容与 API 输出）
  routes/images/        # 自定义图片路由（含路径遍历防护）
  middleware/           # security.ts（全局：HTTP 方法白名单 + 安全头 + CSRF Cookie + 去指纹）
                        # ipx-guard.ts（阻止 IPX 远程 URL 代理，防 SSRF）
                        # admin-guard.ts（/admin 未登录时只返回最小化登录页 HTML）
  plugins/              # chat-cleanup（聊天定时清理）、error-sanitizer（生产净化错误）、
                        # remove-fingerprint（去框架指纹）
  utils/                # 服务端工具（Nitro 自动导入）：
                        #   ai.ts（OpenAI 兼容调用/流式；thinking 深度思考解析 reasoning_content、
                        #   Responses API web_search 联网搜索非流式+切片伪流式、generateImage 画图；
                        #   预设字段/能力回退默认配置（OR 语义）、注入 [DRAW] 自主画图标记协议）、
                        #   settings.ts（AI 设置存储：预设三能力 supportsThinking/supportsWebSearch/
                        #   allowCustomSystemPrompt、imageGen 画图配置、promptTemplates 提示词模板）
                        #   admin-auth.ts（会话 + 登录限速）、admin-accounts.ts（scrypt 账号）
                        #   csrf.ts（Double-Submit Cookie）、chat-storage.ts（7 天过期）
                        #   markdown.ts（博客解析 + 缓存）、image-dir.ts（图片目录探测）
                        #   friends-storage.ts（友链 JSON）、gallery-meta.ts（画廊元数据 JSON）
                        #   request-log.ts（AI 请求系统日志：JSONL 按天落盘 server/data/logs/，
                        #   脱敏 base64/密钥字段，7 天自动清理，仅管理后台可见）
  data/                 # 运行时 JSON 数据（已 gitignore，勿提交）

content/blog/           # 博客 Markdown（YAML frontmatter，已 gitignore）
public/images/          # 图片资源（已 gitignore），含 stickers/ 表情包子目录
scripts/
  admin-accounts.mjs    # 管理员账号 CLI（直接操作 JSON，因 Nitro 自动导入不可用于纯 Node）
  certbot-*.sh          # 证书续期 hooks（HTTP-01 webroot）
nuxt.config.ts          # Nuxt/Nitro 配置（runtimeConfig、安全相关注释详尽）
SECURITY.md             # 安全部署指南：nginx 配置 + 上线验证清单（必读）
.env.example            # 环境变量模板
```

## 构建与运行命令

```bash
npm install            # 安装（postinstall 自动执行 nuxt prepare）
npm run dev            # 开发服务器，端口 3000，host 0.0.0.0
npm run build          # 生产构建 → .output/
npm run preview        # 本地预览生产构建
node .output/server/index.mjs   # 直接运行生产服务器

# 管理员账号管理（交互式 CLI）
npm run admin:add      # 创建账号
npm run admin:list     # 列出账号
npm run admin:delete   # 删除账号
npm run admin:passwd   # 修改密码
```

注意：本项目**未配置 ESLint / Prettier / 任何测试框架**，无 `npm test` / `npm run lint`。验证改动的方式是 `npm run build`（会过 Nuxt 的构建与类型生成）+ 启动后手动/ curl 测试接口。修改代码后至少应确保 `npm run build` 成功。

## 环境变量（见 .env.example）

- `NUXT_AI_API_KEY` / `NUXT_AI_API_BASE_URL` / `NUXT_AI_MODEL`：默认 AI 配置（OpenAI 兼容格式）
- `NUXT_AI_PRESETS`：JSON 数组字符串，多 AI 预设（含可选 `systemPrompt`、`supportsVision`、`supportsAudio`、`supportsThinking`、`supportsWebSearch`、`allowCustomSystemPrompt`）
- `NUXT_PUBLIC_AI_PRESET_NAMES`：公开预设名称列表（可选）
- `NUXT_IMAGE_API_KEY` / `NUXT_IMAGE_API_BASE_URL` / `NUXT_IMAGE_MODEL`：AI 画图配置（火山方舟 images/generations，默认模型 `doubao-seedream-5-0-lite-260128`，模型 ID 日期后缀以控制台为准）
- `NUXT_ADMIN_PASSWORD`：旧版单密码配置，仅用于首次启动时向账号文件迁移
- `.env` 与 `.env.*` 已被 gitignore（`.env.example` 除外），切勿提交真实密钥

**配置优先级**：`server/data/ai-settings.json`（管理后台热更新）> 环境变量（`runtimeConfig`）。

**AI 预设继承**：命名预设留空的字段（apiKey/baseUrl/model/systemPrompt）回退到默认配置；能力标记按 OR 合并（全局开启=所有预设获得该能力，预设内也可单独开启）。注意不能用 `??` 合并能力标记——管理后台 UI 会把显式 false 存入 JSON，`??` 会让它永久挡住全局开关。

## 代码风格与约定

- **语言**：注释、文档、用户可见的报错/提示字符串一律使用**中文**；标识符用英文
- **注释风格**：文件顶部使用横幅注释块：
  ```ts
  /**
   * ============================================================
   *  模块名 - 功能说明
   *  - 要点 1
   * ============================================================
   */
  ```
- **Vue**：SFC 三段式（template → `<script setup lang="ts">` → `<style scoped>`）；样式使用 `main.css` 中的 CSS 变量（如 `var(--color-accent)`），不要硬编码颜色；组件按域放在 `components/<domain>/` 下
- **API 响应**：成功返回 `{ success: true, data: ... }`；错误用 `throw createError({ statusCode, message })`，`message` 用中文
- **服务端自动导入**：`server/utils/` 下的函数、Nitro 的 `defineEventHandler`/`readBody`/`createError` 等由 Nitro 自动导入，无需显式 import；但这些自动导入在纯 Node 脚本（`scripts/`）中不可用
- **新 API 端点约定**：
  - 管理接口放 `server/api/admin/`，**第一行调用 `requireAuth(event)`**（见 `server/utils/admin-auth.ts`）
  - 所有状态变更请求（POST/PUT/DELETE）需调用 `csrfProtection(event)`（GET/HEAD/OPTIONS 自动跳过）
  - 公开接口也要校验请求方法与请求体格式
- **文件存储**：写 `server/data/` 前确保目录存在（`mkdirSync(..., { recursive: true })`）；用户提供的 ID 拼路径前必须过滤字符（参考 `chat-storage.ts` 的 `getUserFilePath` 防路径遍历）
- **图片目录**：用 `server/utils/image-dir.ts` 的 `getPublicImagesDir()`，它会自动区分 `.output/public/images`（生产）与 `public/images`（开发）
- **博客**：文章为 `content/blog/{slug}.md`，frontmatter 字段 `title/date/description/cover/tags/draft`；保存/删除后必须调用 `clearBlogCache(slug)` 使 5 分钟缓存失效
- **友链**：页面优先从 `/api/friends`（读 `server/data/friends.json`）获取，失败时回退到 `app/data/friends.ts` 静态数据
- **类型**：共享类型集中在 `app/types/index.ts`，服务端 `utils/markdown.ts` 等处保持同名字段一致

## 测试说明

项目没有自动化测试。验证方式：

1. `npm run build` 必须通过（这是唯一的静态保障）
2. `npm run dev` 或 preview 后手动验证页面与 API
3. 安全相关改动对照 `SECURITY.md` 第 4 节「验证清单」逐项 curl 验证（buildId、DevTools 404、安全响应头、无堆栈泄露、登录限速 429、Cookie 属性等）

## 安全注意事项

本项目安全要求较高，改动时不得削弱以下机制：

- **密钥不出服务端**：AI API Key 只在 `server/` 内使用；`/api/presets` 只暴露预设名称/能力标记（如 `supportsVision`）
- **CSRF**：Double-Submit Cookie（`csrf_token` cookie + `x-csrf-token` 头，常量时间比较）；客户端由 `app/plugins/csrf.client.ts` 自动附加
- **会话**：内存 session（24h，重启失效）+ `admin_token` cookie（httpOnly、生产 secure、sameSite=lax）；登录限速按 IP+用户名（15 分钟内 5 次失败，锁定 15 分钟）
- **密码**：scrypt 哈希（格式 `scrypt:<salt>:<hash>`），`timingSafeEqual` 比较；生产环境不会自动创建默认账号（需 `npm run admin:add`）
- **HTTP 方法白名单**：仅 GET/POST/HEAD/OPTIONS，其余 405（`server/middleware/security.ts`）
- **生产错误净化**：`server/plugins/error-sanitizer.ts` 删除 stack/url 等字段，5xx 统一为通用消息
- **SSRF 双重防护**：`ipx-guard.ts` 中间件 + `nuxt.config.ts` 的 `routeRules` 重定向
- **XSS**：markdown-it `html: false`；AI 输出经 `stripAngleBrackets` 过滤标签（`server/utils/ai.ts` 与 `app/composables/useChat.ts` 各有一份）
- 新增上传功能需限制文件类型/大小，文件名须重新生成（参考现有 upload 接口）
- **系统日志**：AI 聊天/画图请求经 `server/utils/request-log.ts` 落盘（含完整消息与 API 输出），仅供管理后台排障；日志已脱敏（base64 替换、密钥类字段隐藏、超长截断），新增埋点必须复用 `logRequest` 且不得记录 API Key

## 部署流程（详见 SECURITY.md）

1. `export NODE_ENV=production`（DevTools 仅在非生产启用，HSTS 仅生产下发）
2. `npm run build`
3. `pm2 start .output/server/index.mjs --name xuenian-home`
4. nginx 反向代理到 `127.0.0.1:3000`，安全响应头/方法限制/错误页按 `SECURITY.md` 第 2 节配置；`client_max_body_size` 需与 Nitro `maxRequestBodySize`（50mb）协调
5. TLS 证书用 certbot manual 模式 + `scripts/certbot-*.sh` hooks
6. 首次部署后运行 `npm run admin:add` 创建管理员账号，并按 `SECURITY.md` 验证清单逐项检查

部署验证：`curl -s <url> | grep buildId` 应输出哈希而非 `"dev"`。

## 易踩的坑

- 全局 CSS 必须在 `nuxt.config.ts` 的 `css` 中引入，仅在 `app.vue` 里 `import` 可能在生产构建被 tree-shake
- `content/blog/`、`public/images/`、`server/data/` 均已 gitignore——部署机器上的这些内容是独立数据，不要用 git 同步
- `scripts/admin-accounts.mjs` 与 `server/utils/admin-accounts.ts` 是两份平行实现（注释中已注明需保持同步），改密码哈希逻辑时两边都要改
- Nitro 自动导入（`defineEventHandler`、`useRuntimeConfig` 等）只在 Nitro 构建上下文有效，纯 Node 脚本不可用
- session 存内存，多实例部署/重启会导致全部管理员掉线，这是预期行为
