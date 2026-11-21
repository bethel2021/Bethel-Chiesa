# 伯特利教会网站 · Cloudflare Pages 部署指南（方案一）

本架构采用 **Cloudflare Pages 托管纯静态前端 + 现有 Firebase（Firestore & Google Auth）后端**：
- **零服务器运维**：无需 Node.js / Express 后端，全球 CDN 边缘分发，带宽免费且不限流量。
- **保留原有数据与省流优化**：继续连接现有 Firestore 数据库（`ai-studio-bethelchurch-3b002d53-0447-4092-8ce7-29a844fab9fc`），已启用「单文档汇总快照 + 10 分钟本地缓存」。

---

## 一、Cloudflare Pages 构建配置

在 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → 连接你的 Git 仓库（或本地使用 Wrangler 上传）：

- **Framework preset**：`Vite`（或 `None`）
- **Build command**：`npm run build`
- **Build output directory**：`dist`
- **Node.js version（环境变量）**：`NODE_VERSION = 22`（推荐）

如使用命令行直接发布：
```bash
npm install
npm run build
npx wrangler pages deploy dist --project-name=bethel-church
```

---

## 二、Firebase 控制台必须配置的步骤（关键）

部署到 Cloudflare Pages 后，网站域名将变为 `*.pages.dev` 或你的自定义域名。**必须将新域名加入 Firebase 授权域名白名单**，否则后台 Google 登录会报 `auth/unauthorized-domain`：

1. 打开 [Firebase Console](https://console.firebase.google.com/)，选择项目 `dulcet-cairn-m40px`。
2. 进入 **Authentication** → **Settings** → **Authorized domains**。
3. 点击 **Add domain**，依次添加：
   - 你的 Pages 默认域名（例如 `bethel-church.pages.dev`）
   - 你的自定义域名（例如 `www.bethelchurch.org`、`bethelchurch.org`）

---

## 三、环境变量说明（可选）

代码默认优先读取 `VITE_FIREBASE_*` 环境变量；若未设置，则自动回退读取仓库中的 `firebase-applet-config.json`（Firebase Web Client Config 本身为公开客户端配置，由 Firestore Security Rules 保障数据权限安全）。

如需在 Cloudflare Pages 后台区分测试/生产环境，可在 **Settings → Environment variables** 配置：
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_FIRESTORE_DATABASE_ID`

---

## 四、已内置的 Cloudflare Pages 架构适配

1. **`public/_headers`**：
   - 设置 `Cross-Origin-Opener-Policy: same-origin-allow-popups`，确保 Firebase Google 登录弹窗正常回调。
   - 启用 `Strict-Transport-Security`、`X-Content-Type-Options: nosniff`、`Referrer-Policy` 与最小权限 `Permissions-Policy`。
   - 对 `/assets/*` 开启长期强缓存（`immutable`），对 `/index.html` 关闭强缓存确保发版即时生效。
2. **`public/_redirects` & `/admin` 路由**：
   - 配置 `/* /index.html 200` SPA 回退规则，直接访问或刷新 `https://你的域名/admin` 可直接进入同工管理后台。
3. **静态图片资产**：
   - `vite.config.ts` 构建时会自动将 `src/assets` 复制到 `dist/src/assets`，确保教会实景与牧者照片路径直接由 Cloudflare CDN 分发。

---

## 五、发布前安全检查清单

1. **Firebase Authorized domains**：确保已将 `*.pages.dev` 与自定义正式域名添加到 Firebase Authentication 授权域名白名单，并移除不再使用的测试域名。
2. **Firebase Web API Key 限制**：在 Google Cloud Console → **APIs & Services → Credentials** 中，为前端使用的 Firebase Browser API Key 添加 **HTTP referrers（网站来源）限制**（仅允许你的正式域名、`*.pages.dev` 与本地开发域名）。
3. **Firestore 安全规则与访客隐私**：所有公开模块仅允许管理员（已验证邮箱）写入；`visitor_requests` 访客留言仅允许公开创建 `pending` 状态，严禁未授权用户读取或修改。
4. **管理员权限核对**：在正式公布前，登录 `/admin` 检查「来访留言与权限」中的授权同工名录，并点击一次「同步修改内容到云端」以刷新公开快照。
5. **Cloudflare 域名与 SSL**：在 Cloudflare DNS/SSL 设置中启用 **Full (strict)** SSL 模式与强制 HTTPS 重定向。
