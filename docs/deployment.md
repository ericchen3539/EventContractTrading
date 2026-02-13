# Vercel 部署指南

> **说明**：Vercel Postgres 已于 2024 年 12 月停止服务，现使用 **Neon**（Vercel 官方推荐迁移目标）作为 PostgreSQL 数据库。

## 前置条件

- Vercel 账号
- GitHub 仓库（或本地 `vercel` CLI 登录）

## 部署步骤

### 1. 登录 Vercel

```bash
npx vercel login
```

### 2. 在 Vercel 创建项目并添加 Neon

1. 打开 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 **Add New** → **Project**
3. 导入本仓库（Git 连接或 CLI 导入）
4. **在首次部署前**，进入 [Vercel Marketplace - Neon](https://vercel.com/marketplace/neon) → **Install**
5. 选择 **Create New Neon Account**，创建数据库并关联到本项目
6. Neon 会自动注入 `DATABASE_URL` 环境变量

### 3. 配置环境变量

在项目 **Settings** → **Environment Variables** 中添加（**Production 必须全部配置**）：

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | 由 Neon 集成自动注入 | - |
| `NEXTAUTH_URL` | 生产域名（必填） | `https://event-contract-trading.vercel.app` |
| `NEXTAUTH_SECRET` | 随机密钥（必填） | `openssl rand -base64 32` 生成 |
| `GOOGLE_CLIENT_ID` | Google OAuth（Sign in with Google 必需） | 见下方「Google 登录配置」 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth（同上） | 同上 |
| `RESEND_API_KEY` | Resend API Key（邮箱验证、忘记密码必需） | 从 [resend.com](https://resend.com) 获取 |
| `EMAIL_FROM` | 发件人邮箱（同上） | `noreply@ycjy.io`（需在 Resend 验证域名）。**若收不到邮件**：先用 `onboarding@resend.dev` 测试（无需验证），或在 [Resend Domains](https://resend.com/domains) 完成 SPF/DKIM 验证 |

> **若出现 "Application error: a server-side exception"**：通常是 `NEXTAUTH_SECRET` 或 `NEXTAUTH_URL` 未配置。在 Vercel Dashboard → Project → Settings → Environment Variables 中确认 Production 环境已设置上述变量，然后 Redeploy。

### 3.1 Google 登录配置（Sign in with Google）

1. 打开 [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. 点击 **Create Credentials** → **OAuth client ID**
3. 若提示先配置 OAuth 同意屏幕：Application type 选 **External**，填写应用名称、支持邮箱，保存
4. Application type 选 **Web application**，Name 自定（如 `Event Contract Trading`）
5. **Authorized redirect URIs** 中添加：
   - 本地：`http://localhost:3000/api/auth/callback/google`
   - 生产：`https://<your-project>.vercel.app/api/auth/callback/google`（替换为实际域名）
6. 点击 **Create**，复制 **Client ID** 和 **Client Secret**
7. 填入 `.env.local`（本地）或 Vercel 环境变量（生产）

### 4. 部署

**方式 A：通过 Git 推送**

```bash
git push origin main
```

Vercel 会自动检测推送并部署。

**方式 B：通过 CLI**

```bash
npx vercel --prod
```

首次部署时，CLI 会提示关联项目或创建新项目。

## 构建流程

- `postinstall`: `prisma generate` — 生成 Prisma Client
- `build`: `prisma migrate deploy && next build` — 执行数据库迁移并构建 Next.js

## 计划说明

- **事件市场刷新**：Kalshi 拉取大量事件，需较长执行时间。**Pro 计划**下 `/api/sites/[siteId]/events` 已配置 `maxDuration=300s`（5 分钟）。Hobby 计划限于 10s，可能超时。
- 建议使用 Pro 计划以获得完整事件拉取能力。

## 首次部署后

1. 部署完成后，访问 `https://<project>.vercel.app`
2. 将 `NEXTAUTH_URL` 更新为实际生产域名
3. Google 登录：若尚未配置，参考上方「3.1 Google 登录配置」，在 OAuth 凭据中补充生产域名重定向 URI
