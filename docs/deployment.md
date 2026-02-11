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

在项目 **Settings** → **Environment Variables** 中添加：

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | 由 Neon 集成自动注入 | - |
| `NEXTAUTH_URL` | 生产域名 | `https://xxx.vercel.app` |
| `NEXTAUTH_SECRET` | 随机密钥 | `openssl rand -base64 32` 生成 |
| `GOOGLE_CLIENT_ID` | Google OAuth（可选） | 从 Google Cloud Console 获取 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth（可选） | 同上 |

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

## 首次部署后

1. 部署完成后，访问 `https://<project>.vercel.app`
2. 将 `NEXTAUTH_URL` 更新为实际生产域名
3. 若使用 Google 登录，需在 Google Cloud Console 的 OAuth 凭据中添加授权重定向 URI：`https://<project>.vercel.app/api/auth/callback/google`
