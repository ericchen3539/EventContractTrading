# 事件期货交易辅助网站 — 实现计划

> 从零搭建：Google/邮箱登录、添加外部站点及凭证、选择板块、拉取并表格化展示可下注事件与市场信息；先对接 1 个示范平台（Kalshi）并预留多平台扩展架构。

## 1. 技术选型

| 层级     | 技术                                        | 说明 |
|----------|---------------------------------------------|------|
| 全栈框架 | **Next.js 14** (App Router)                 | 前后端一体、API Routes、便于部署 |
| 数据库   | **PostgreSQL** + Prisma                    | 用户、站点、凭证、板块、缓存事件 |
| 认证     | **NextAuth.js**                            | Google OAuth + Credentials（邮箱注册/登录） |
| 前端 UI  | **Tailwind CSS** + 表格组件（如 TanStack Table） | 简洁表格展示事件与市场 |
| 示范平台 | **Kalshi**                                 | 有公开 API，先做 1 个适配器；读板块/事件无需用户在该站登录 |

- **注册**：开放用户注册（无邀请制）。
- 凭证存储：若某平台需登录才可读数据，密码用 **加密后存库**（如 AES-256-GCM）；Kalshi 读板块与事件无需该站登录信息。

## 2. 数据模型（核心）

- **User**：id, email, name, emailVerified（不需要 image）
- **Account / Session**：NextAuth 标准表
- **Site**：id, userId, baseUrl, name, loginUsername（加密，可选）、loginPassword（加密，可选）, adapterKey（如 `kalshi`）, createdAt
- **Section**：id, siteId, externalId, name, urlOrSlug
- **EventCache**：id, siteId, sectionId, externalId, title, description, endDate, volume, liquidity, outcomes（JSON）, raw（JSON）, fetchedAt

多平台扩展：通过 `Site.adapterKey` 路由到不同 **Adapter**。

## 3. 可执行单元（按开发顺序）

| 序号 | 单元           | 范围                                               |
|------|----------------|----------------------------------------------------|
| 1    | 初始化         | Next.js、Tailwind、Prisma、`.env.example`          |
| 2    | Auth 后端      | NextAuth、Google + Credentials、`lib/auth.ts`      |
| 3    | Auth 前端      | `/login`、`/register`、`components/auth/`           |
| 4    | 仪表盘骨架     | 布局、导航、鉴权中间件                              |
| 5    | Sites API      | `GET/POST/PUT/DELETE /api/sites`                   |
| 6    | Sites 页面     | `/sites` 列表、`/sites/new`、`/sites/[id]/edit`    |
| 7    | Kalshi 适配器  | `lib/adapters/types.ts`、`lib/adapters/kalshi.ts`  |
| 8    | Sections API   | `GET/POST /api/sections`                           |
| 9    | Sections UI    | 站点编辑页中板块勾选区块                            |
| 10   | Events API     | `GET /api/sites/[siteId]/events`                   |
| 11   | Events 表格页  | `/events`、TanStack Table                          |

**依赖关系：** 1 → 2→3、4 → 5→6 → 7 → 8→9 → 10 → 11

## 4. 文件结构（建议）

```
/app
  /api/auth/[...nextauth]
  /api/sites/route.ts, /api/sites/[siteId]/route.ts, /api/sites/[siteId]/events/route.ts
  /api/sections/route.ts
  /(auth)/login, /register
  /(dashboard)/sites, /sites/new, /sites/[id]/edit
  /(dashboard)/events
/components
  /auth, /sites, /events-table
/lib
  /auth.ts, /db.ts, /encryption.ts
  /adapters/types.ts, /adapters/kalshi.ts
/prisma
  schema.prisma
```

## 5. 交付与验收要点

- 可用 Google 或邮箱开放注册/登录；用户信息不包含 image。
- 可添加一个站点（Kalshi），读板块不需要用户在该站的登录信息；可选填该站登录名/密码留作后续扩展。
- 板块选择以 **政治板块** 为示范；可拉取该板块「当前可下注事件与市场」并在页面上以表格形式完整、易读展示。
- 凭证若存储则加密；仅登录用户可看到自己的站点与数据。

---

完整版（含 Mermaid 图、单元细化、安全与合规等）见：`.cursor/plans/事件期货交易辅助网站_1b3f47f5.plan.md`
