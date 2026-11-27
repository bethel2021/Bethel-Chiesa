# 伯特利教会网站 · Cloudflare Pages + D1 部署指南

本架构仅使用 **Cloudflare Pages + Pages Functions + D1（SQLite 数据库）**，无需创建或绑定 R2 存储桶，并保留 **Firebase Auth（Google 登录）** 作为后台同工身份认证：
- **彻底告别 Firestore 每日 5 万读取配额**：Cloudflare D1 免费版提供每日 **500 万行读取 / 10 万行写入**与 **5 GB 免费存储**。
- **全能单数据库架构**：教会图文内容、访客留言、同工权限、去重访客 IP 统计，以及压缩优化后的图片（以安全二进制分片方式存入 `media_files` / `media_chunks` 表，并通过 `/api/media/<key>` 配合边缘强缓存极速分发）全部统一存于 D1。
- **内置一键数据迁移工具**：支持从旧版 Firestore 一键导入所有教会图文内容、历史图片、管理员权限名录、来访留言及去重访客 IP 统计。

---

## 一、创建 Cloudflare D1 数据库

在本地终端（或 Cloudflare Dashboard Web 控制台）执行以下命令创建 D1 数据库：

```bash
# 1. 登录 Cloudflare（如尚未登录）
npx wrangler login

# 2. 创建 D1 数据库
npx wrangler d1 create bethel-church-db

# 3. 执行数据库建表迁移（首次部署也可跳过，后端首次收到请求时会自动建表）
npx wrangler d1 migrations apply bethel-church-db --remote
```

---

## 二、Cloudflare Pages 构建与 D1 绑定配置

在 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → 连接你的 Git 仓库（或使用 `npx wrangler pages deploy dist`）：

1. **构建配置**：
   - **Framework preset**：`Vite`（或 `None`）
   - **Build command**：`npm run build`
   - **Build output directory**：`dist`
   - **Node.js version**：仓库根目录已包含 `.node-version`（`22`），Cloudflare Pages 会自动选用 Node 22。

2. **绑定 D1 数据库（⚠️ 唯一必须的绑定）**：
   进入你的 Pages 项目 → **Settings** → **Bindings**（或 **Functions → Bindings**）：
   - 添加 **D1 database** 绑定：
     - **Variable name（变量名）**：`DB`
     - **D1 database**：选择 `bethel-church-db`
   *(说明：仓库根目录已刻意移除 `wrangler.toml`，以确保 Cloudflare 控制台中的 Bindings 与环境变量按钮处于可编辑状态；新增绑定后需重新触发一次部署才会生效。)*

3. **如使用本地命令行直接部署**：
   ```bash
   npm install
   npm run build
   npx wrangler pages deploy dist --project-name=bethel-church
   ```

---

## 三、Firebase 控制台配置（Google 登录白名单）

后台继续使用 Google 账号登录（由服务端调用 Firebase Auth 校验 ID Token）。部署到 Cloudflare Pages 后，**必须将新域名加入 Firebase 授权域名白名单**，否则登录会报 `auth/unauthorized-domain`：

1. 打开 [Firebase Console](https://console.firebase.google.com/)，选择项目 `dulcet-cairn-m40px`。
2. 进入 **Authentication** → **Settings** → **Authorized domains**。
3. 点击 **Add domain**，依次添加：
   - 你的 Pages 默认域名（例如 `bethel-church.pages.dev`）
   - 你的自定义正式域名（例如 `www.bethelchurch.org`、`bethelchurch.org`）

---

## 四、环境变量设置（可选）

在 Cloudflare Pages 的 **Settings → Environment variables**（建议 Production 与 Preview 均配置）中可按需添加：

- **访客 IP 哈希盐值（建议配置）**：
  - `VISITOR_IP_SALT`：任意长随机字符串，用于服务端对访客 IP 进行 SHA-256 脱敏哈希。
- **新访客留言自动发邮件提醒（Resend API）**：
  - `RESEND_API_KEY`（Resend API 密钥）
  - `VISITOR_NOTIFY_TO`（可选，接收提醒的同工邮箱，多个以英文逗号分隔；留空则默认发往数据库内的主管理员邮箱）
  - `VISITOR_NOTIFY_FROM`（可选，发件人地址；未绑定发信域名时可留空，默认 `onboarding@resend.dev`）
- **Firebase Auth 客户端覆盖配置（可选）**：
  - 若留空则自动读取仓库中的 `firebase-applet-config.json`；如需覆盖可配置 `VITE_FIREBASE_API_KEY`、`VITE_FIREBASE_AUTH_DOMAIN`、`VITE_FIREBASE_PROJECT_ID`、`VITE_FIREBASE_APP_ID`、`VITE_FIREBASE_FIRESTORE_DATABASE_ID` 等。

---

## 五、上线后一键迁移旧版 Firestore 数据

完成上述部署与 D1 绑定后：

1. 使用主管理员账号（`chinarenzhian@gmail.com`）打开 `https://你的域名/admin` 并完成 Google 登录。
2. 在后台顶部提示条或「后台总览与同步」模块中点击 **「从旧版 Firestore 一键导入」**。
3. 系统将在浏览器端拉取旧版 Firestore 中的全部数据与 `media://` 分片图片，全部统一写入 Cloudflare D1 数据库（含图片转存、教会信息、讲台同工、周间事工、精彩瞬间、家事公告、来访留言、管理员权限与去重访客 IP 记录）。
4. 迁移完成后刷新公开首页，即可确认所有内容与图片均正常加载。
