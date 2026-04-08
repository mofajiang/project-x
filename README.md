# X 风格个人博客

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/mofajiang/project-x?style=social)](https://github.com/mofajiang/project-x)

**基于 Next.js 14 + Tailwind CSS + SQLite 构建的 X 风格个人博客**

[示例网站](https://thisblog.me/) · [快速开始](#快速开始) · [一键部署](#一键安装) · [问题反馈](https://github.com/mofajiang/project-x/issues)

</div>

---

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [服务器部署](#服务器部署)
  - [一键安装](#一键安装)
  - [手动部署](#手动部署)
  - [更新版本](#更新版本)
  - [卸载](#卸载)
- [环境变量](#环境变量)
- [功能配置](#功能配置)
  - [邮件通知](#邮件通知)
  - [AI 审核](#ai-审核)
  - [文件存储](#文件存储)
  - [友情链接](#友情链接)
  - [文章引用语法](#文章引用语法)
- [故障排查](#故障排查)
- [目录结构](#目录结构)

---

## 功能特性

| 模块        | 功能                                                                       |
| ----------- | -------------------------------------------------------------------------- |
| 🎨 **界面** | X 风格 UI、深色/浅色主题切换、三栏布局、卡片式 Feed、响应式移动端适配      |
| 📝 **内容** | Markdown 编辑、草稿/发布管理、标签系统、封面图、首页快速发帖框             |
| 💬 **互动** | 嵌套评论、审核模式、点赞、邮件回复通知                                     |
| 🤖 **AI**   | OpenRouter/自定义 LLM 接入、评论垃圾检测、友链安全审核、可调审核强度       |
| 🔗 **友链** | 自助申请、互链验证、AI 安全检测、自动审批、右侧栏卡片展示                  |
| 🔒 **安全** | 动态登录路径、失败锁定、JWT 认证、CSP 策略、DOMPurify XSS 防护             |
| ⚙️ **管理** | 仪表盘、文章/评论/标签/站点设置、SMTP 配置、AI 模型管理                    |
| 🔍 **SEO**  | 文章 JSON-LD、站点 JSON-LD、Canonical URL、动态 OG 图、RSS、Sitemap/Robots |
| 📦 **存储** | 本地存储 / S3 兼容对象存储（Cloudflare R2、MinIO 等）/ SM.MS 图床          |
| 👤 **账号** | 显示名称与登录账号分离、认证徽章、@handle                                  |

---

## 技术栈

- **框架**：[Next.js 14](https://nextjs.org/) (App Router, ISR)
- **语言**：TypeScript 5
- **样式**：Tailwind CSS 3
- **数据库**：SQLite via [Prisma 5](https://www.prisma.io/)
- **认证**：JWT + httpOnly Cookie
- **测试**：Vitest（72 个单元测试）
- **代码质量**：ESLint + Prettier + husky

---

## 快速开始

**环境要求：** Node.js 18+

```bash
git clone https://github.com/mofajiang/project-x.git
cd project-x
npm install
cp .env.example .env
# 编辑 .env，至少配置 JWT_SECRET
npm run db:push
npx tsx scripts/init-admin.ts
npm run dev
```

访问 http://localhost:3000，使用初始化时设置的账号登录。

> ⚠️ 首次登录后请立即进入「站点设置」修改登录路径和管理员密码。

---

## 服务器部署

**环境要求：** Node.js 18+、Git、PM2、Nginx

### 一键安装

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh)
```

脚本会以交互式向导引导完成全部配置：安装目录、域名、端口、JWT 密钥、管理员账号、PM2 进程名，并自动完成拉取代码、安装依赖、构建、初始化数据库、启动服务全流程。

**直接传参（免菜单）：**

```bash
# 全新安装
bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh) install

# 升级到最新版本
bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh) update

# 卸载
bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh) uninstall

# 查看所有操作菜单
bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh) menu
```

**脚本支持的操作：**

| 命令        | 说明                                                               |
| ----------- | ------------------------------------------------------------------ |
| `install`   | 全新安装（默认）                                                   |
| `update`    | 升级：拉取代码 → 安装依赖 → 构建 → 备份数据库 → 同步 Schema → 重启 |
| `uninstall` | 卸载：停止进程 → 可选备份数据库 → 删除目录                         |
| `status`    | 查看 PM2 运行状态                                                  |
| `restart`   | 重启 PM2 进程                                                      |
| `stop`      | 停止 PM2 进程                                                      |
| `logs`      | 查看 PM2 实时日志                                                  |

### 手动部署

**1. 拉取代码**

```bash
git clone https://github.com/mofajiang/project-x.git /www/wwwroot/x-blog
cd /www/wwwroot/x-blog
```

**2. 配置环境变量**

```bash
cp .env.example .env
nano .env
```

```env
DATABASE_URL="file:./data/db.sqlite"
JWT_SECRET="your-strong-secret-here"
NEXT_PUBLIC_SITE_URL="https://yourdomain.com"
```

**3. 安装依赖并构建**

```bash
npm install
npm run build
```

**4. 初始化数据库和管理员**

```bash
npm run db:push
npx tsx scripts/init-admin.ts
```

**5. 使用 PM2 启动**

```bash
pm2 start npm --name x-blog -- start
pm2 save
pm2 startup  # 设置开机自启
```

**6. 配置 Nginx 反向代理**

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300;
    }
}
```

> ⚠️ 使用宝塔面板时，请直接编辑站点配置文件，不要使用图形化反向代理功能（会丢失 `X-Forwarded-Proto` 头导致 HTTPS 重定向循环）。

### 更新版本

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh) update
```

更新流程自动执行：`git pull` → `npm install` → `npm run build` → 备份数据库 → `npm run db:push`（同步新字段）→ `pm2 restart`

**手动更新：**

```bash
cd /www/wwwroot/x-blog
git pull origin main
npm install
npm run build
cp data/db.sqlite data/db.sqlite.bak  # 备份数据库
npm run db:push -- --accept-data-loss
pm2 restart x-blog
```

### 卸载

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/uninstall.sh)
```

卸载脚本将：停止并删除 PM2 进程 → 可选备份数据库到 `/tmp/` → 删除项目目录。

---

## 环境变量

编辑项目根目录 `.env` 文件：

### 必须配置

| 变量                   | 说明                                        | 示例                      |
| ---------------------- | ------------------------------------------- | ------------------------- |
| `DATABASE_URL`         | SQLite 数据库路径                           | `file:./data/db.sqlite`   |
| `JWT_SECRET`           | JWT 签名密钥，请使用随机强密码              | `openssl rand -base64 32` |
| `NEXT_PUBLIC_SITE_URL` | 站点公网 URL，影响 RSS/Sitemap/SEO/邮件链接 | `https://yourdomain.com`  |

> **`NEXT_PUBLIC_SITE_URL` 未设置**时，RSS、Sitemap 和 OG 图所有 URL 将使用 `http://localhost:3000`，严重影响 SEO 和分享效果。

### 可选配置

```env
# 邮件通知（不填则禁用邮件功能）
SMTP_HOST="smtp.qq.com"
SMTP_PORT="465"
SMTP_USER="your@qq.com"
SMTP_PASS="your-auth-code"
SMTP_FROM="your@qq.com"       # 可选，默认使用 SMTP_USER

# 文件存储（默认 local，可选 s3 或 smms）
STORAGE_DRIVER="local"

# S3 兼容存储（STORAGE_DRIVER=s3 时填写）
STORAGE_S3_ENDPOINT="https://<account>.r2.cloudflarestorage.com"
STORAGE_S3_REGION="auto"
STORAGE_S3_BUCKET="your-bucket"
STORAGE_S3_ACCESS_KEY_ID="your-access-key"
STORAGE_S3_SECRET_ACCESS_KEY="your-secret-key"
STORAGE_S3_PREFIX="uploads/"
STORAGE_S3_FORCE_PATH_STYLE="false"
STORAGE_PUBLIC_BASE_URL=""    # CDN 前缀，如 https://cdn.yourdomain.com

# SM.MS 图床（STORAGE_DRIVER=smms 时填写）
STORAGE_SMMS_TOKEN=""
```

---

## 功能配置

### 邮件通知

在后台「站点设置 → 邮件」或直接编辑 `.env` 配置 SMTP。配置完成后可在后台发送测试邮件验证。

| 服务商   | HOST               | PORT |
| -------- | ------------------ | ---- |
| QQ 邮箱  | smtp.qq.com        | 465  |
| 163 邮箱 | smtp.163.com       | 465  |
| Gmail    | smtp.gmail.com     | 587  |
| Outlook  | smtp.office365.com | 587  |

### AI 审核

在后台「⚙ AI 模型管理」中配置：

**接入方式：**

- **OpenRouter（推荐）**：支持 Claude、GPT-4 等多种模型，获取 API Key：https://openrouter.ai/settings/keys
- **自定义接口**：支持 Ollama、LocalAI 等本地部署的 LLM 服务

**审核强度：**

| 强度            | 拒绝阈值 | 通过阈值 | 适用场景         |
| --------------- | -------- | -------- | ---------------- |
| 🟢 宽松         | ≥ 85 分  | ≤ 20 分  | 个人博客、低流量 |
| 🟡 均衡（推荐） | ≥ 70 分  | ≤ 30 分  | 通用             |
| 🔴 严格         | ≥ 60 分  | ≤ 40 分  | 高流量、防垃圾   |

风险分数 0-100，分数越低越安全。中间分数进入人工审核队列。

### 文件存储

在后台「站点设置 → 存储」或通过环境变量配置：

- **`local`**（默认）：上传文件保存至 `public/uploads/`
- **`s3`**：兼容 S3 协议的对象存储，支持 Cloudflare R2、MinIO、阿里云 OSS 等
- **`smms`**：SM.MS 图床，填写 token 即可使用

### 友情链接

**用户申请流程：** 访问 `/links` → 点击「申请友链」→ 填写表单 → 系统验证互链 → 等待审核

**管理员操作（后台 → 友情链接）：**

- 手动批准/拒绝
- AI 安全检测（品牌安全、垃圾风险、恶意软件、内容风险四维度评分）
- 互链检查（验证对方是否已添加回链）
- 开启自动审批（AI 低风险自动通过）

### 文章引用语法

在文章 Markdown 中使用特殊语法插入引用卡片：

```
# 引用站内文章（填写文章 slug）
::quote[my-article-slug]

# 引用外部链接（自动抓取 OG 信息生成卡片）
::quote-url[https://example.com/some-article]
```

---

## 故障排查

### 构建失败：Module not found

通常是缓存污染或文件签出不完整导致，执行以下命令修复：

```bash
git checkout HEAD -- src/
rm -rf node_modules/.cache .next
npm cache clean --force
npm ci
npm run build
```

### Nginx HTTPS 重定向循环

检查 Nginx 配置中是否包含以下 header，缺少会导致 HTTPS 下无限重定向：

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
```

### PM2 常用命令

```bash
pm2 list                     # 查看所有进程状态
pm2 logs x-blog              # 实时查看日志
pm2 logs x-blog --lines 100  # 查看最近 100 行日志
pm2 restart x-blog           # 重启服务
pm2 stop x-blog              # 停止服务
```

### 数据库相关

```bash
# 同步数据库结构（新字段迁移）
npm run db:push -- --accept-data-loss

# 可视化查看数据库（开发用）
npm run db:studio
```

---

## 目录结构

```
project-x/
├── prisma/
│   └── schema.prisma          # 数据库 Schema
├── public/                    # 静态资源
├── scripts/
│   ├── init-admin.ts          # 初始化管理员账号
│   ├── install.sh             # 统一管理脚本（安装/升级/卸载/运维）
│   └── uninstall.sh           # 独立卸载脚本
└── src/
    ├── app/
    │   ├── (blog)/            # 前台博客页面
    │   ├── admin/             # 后台管理页面
    │   ├── api/               # API 路由
    │   └── [loginPath]/       # 动态登录页（隐藏路径）
    ├── components/
    │   ├── admin/             # 后台专用组件
    │   ├── blog/              # 博客组件（PostCard、评论等）
    │   ├── layout/            # 布局组件（导航、抽屉等）
    │   └── ui/                # 基础 UI 组件
    └── lib/                   # 工具库
        ├── auth.ts            # JWT 认证
        ├── constants.ts       # 全局常量
        ├── converters.ts      # 类型安全转换工具
        ├── mailer.ts          # 邮件发送
        ├── post-utils.ts      # 文章内容处理
        ├── prisma.ts          # Prisma 客户端
        ├── rate-limit.ts      # 请求频率限制
        ├── slug.ts            # Slug 处理
        └── utils.ts           # 通用工具函数
```
