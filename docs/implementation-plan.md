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
- **Market**：id, eventCacheId, siteId, sectionId, externalId, title, closeTime, volume, liquidity, outcomes（JSON）, raw（JSON）, fetchedAt。与 EventCache 双向映射：事件可查其市场，市场可查其事件。用于与「更新最近市场」返回结果对比（以 externalId 为 Key）。

多平台扩展：通过 `Site.adapterKey` 路由到不同 **Adapter**。

## 3. 可执行单元（按开发顺序）

| 序号 | 单元           | 范围                                               | 状态   |
|------|----------------|----------------------------------------------------|--------|
| 1    | 初始化         | Next.js、Tailwind、Prisma、`.env.example`          | Done   |
| 2    | Auth 后端      | NextAuth、Google + Credentials、`lib/auth.ts`      | Done   |
| 3    | Auth 前端      | `/login`、`/register`、`components/auth/`           | Done   |
| 4    | 仪表盘骨架     | 布局、导航、鉴权中间件                              | Done   |
| 5    | Sites API      | `GET/POST/PUT/DELETE /api/sites`                   | Done   |
| 6    | Sites 页面     | `/sites` 列表、`/sites/new`、`/sites/[id]/edit`    | Done   |
| 7    | Kalshi 适配器  | `lib/adapters/types.ts`、`lib/adapters/kalshi.ts`  | Done   |
| 8    | Sections API   | `GET/POST /api/sections`                           | Done   |
| 9    | Sections UI    | 站点编辑页中板块勾选区块                            | Done   |
| 10   | Events API     | `GET /api/sites/[siteId]/events`                   | Done   |
| 11   | Events 表格页  | `/events`、TanStack Table                          | Done   |

**依赖关系：** 1 → 2→3、4 → 5→6 → 7 → 8→9 → 10 → 11

**单元 1 状态（Done）**  
已搭建 Next.js（App Router）、Tailwind v4（PostCSS + `globals.css`）、Prisma（PostgreSQL，`schema.prisma` 含 User/Account/Session/Site/Section/EventCache）、`lib/db.ts` 单例、`.env.example`（DATABASE_URL 与后续 Auth/加密占位）。

**单元 2 状态（Done）**  
已安装 next-auth@4、@next-auth/prisma-adapter、bcryptjs；新增 `lib/auth.ts`（PrismaAdapter、Google + Credentials、database session、session callback 写入 user.id）、`app/api/auth/[...nextauth]/route.ts`；Schema 增加 User.image、Session.id 以兼容适配器；`.env.example` 中 NextAuth 变量已启用。

**单元 3 状态（Done）**  
已新增 `components/auth/LoginForm.tsx`（邮箱/密码 + Google 登录）、`components/auth/RegisterForm.tsx`（开放注册）、`app/(auth)/login`、`app/(auth)/register`；`app/api/auth/register`（bcrypt 哈希密码）；`components/providers.tsx`（SessionProvider）；布局中已包裹 Providers。

**单元 4 状态（Done）**  
已创建 `app/(dashboard)/layout.tsx`（`getServerSession` 鉴权，未登录重定向 `/login`）、`components/dashboard/DashboardNav.tsx`（站点管理、事件市场导航 + 退出登录）；`/sites`、`/sites/new`、`/sites/[id]/edit`、`/events` 占位页；根页及 Auth 布局：已登录访问 `/` 或 `/login`/`/register` 时重定向 `/sites`。

**单元 5 状态（Done）**  
已新增 `lib/encryption.ts`（AES-256-GCM 加解密，ENCRYPTION_KEY 可选）；`app/api/sites/route.ts`（GET 列表、POST 创建）；`app/api/sites/[siteId]/route.ts`（GET 单条、PUT 更新、DELETE 删除）。凭证加密存储，仅返回 hasCredentials 标志；adapterKey 校验为 kalshi。

**单元 6 状态（Done）**  
已新增 `components/sites/SiteForm.tsx`（新增/编辑表单）、`components/sites/SiteList.tsx`（列表与删除）；`/sites` 服务端拉取列表、`/sites/new` 与 `/sites/[id]/edit` 表单页；编辑时凭证留空则不修改。

**单元 7 状态（Done）**  
已新增 `lib/adapters/types.ts`（Adapter 接口、SectionInput、EventMarketInput）、`lib/adapters/kalshi.ts`（getSections、getEventsAndMarkets）、`lib/adapters/index.ts`（适配器注册表）；Kalshi 以 category=Politics 拉取板块，以 series_ticker + status=open 拉取事件与市场，liquidity 转为美元存储。

**单元 8 状态（Done）**  
已新增 `app/api/sections/route.ts`：GET 支持 `?siteId=xxx` 返回该站点的板块列表；POST body `{ siteId }` 从 adapter 拉取板块并 upsert 到 DB，移除适配器不再返回的旧板块。

**单元 9 状态（Done）**  
已新增 `components/sites/SectionSelector.tsx`、`app/api/sections/[sectionId]/route.ts`（PATCH 更新 enabled）；Section 模型增加 `enabled` 字段；站点编辑页 `/sites/[id]/edit` 集成板块勾选区块，支持“从平台同步”与勾选保存。

**单元 10 状态（Done）**  
已新增 `app/api/sites/[siteId]/events/route.ts`（GET）；调用 Adapter 拉取事件、upsert 到 EventCache、返回 JSON；支持可选 `?sectionIds=id1,id2` 过滤板块；EventMarketInput 增加 `sectionExternalId` 以关联板块。

**单元 11 状态（Done）**  
已安装 @tanstack/react-table；新增 `components/events-table/EventsTable.tsx`（TanStack Table 表格）、`components/events-table/EventsPageContent.tsx`（站点/板块筛选、刷新、表格容器）；`/events` 页支持选择站点、可选板块过滤、点击刷新拉取事件，表格展示标题、板块、结束日期、交易量、流动性、价格/概率、刷新时间，支持排序与全局搜索。

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
