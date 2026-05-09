# ✕ Blog — X 风格个人博客

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/mofajiang/project-x?style=social)](https://github.com/mofajiang/project-x)

**基于 Next.js 14 + Tailwind CSS + SQLite 构建的 X 风格全功能个人博客**

[示例网站](https://thisblog.me/) · [快速开始](#快速开始) · [一键部署](#一键安装) · [问题反馈](https://github.com/mofajiang/project-x/issues)

[English Version](./README_EN.md)

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
- [项目结构](#项目结构)
- [参与贡献](#参与贡献)
- [开源协议](#开源协议)

---

## 功能特性

| 模块        | 核心功能                                                      |
| ----------- | ------------------------------------------------------------- |
| 🎨 **界面** | X 风格 UI、暗/亮主题切换、三栏布局、响应式适配                |
| 📝 **内容** | Markdown 编辑器、草稿/发布、标签系统、封面图、Thread 帖子分组 |
| 💬 **互动** | 嵌套评论、审核模式、点赞转发、邮件通知、留言板、访客地图      |
| 🤖 **AI**   | OpenRouter / Groq / 自定义 LLM、垃圾检测、友链审核、可调强度  |
| 🔗 **友链** | 自助申请、互链验证、AI 安全扫描、自动审批、友圈 Feed          |
| 📡 **雷达** | 16 源聚合、AI 筛选去重、时效排序、Webhook、定时日报           |
| 🔒 **安全** | 动态登录路径、失败锁定、JWT 黑名单、CSP、XSS/SSRF 防护        |
| ⚙️ **管理** | 仪表盘、文章/评论/标签管理、站点设置、SMTP、AI 模型配置       |
| 🔍 **SEO**  | JSON-LD、Canonical URL、动态 OG 图、RSS、Sitemap              |
| 📦 **存储** | 本地 / S3 兼容（R2、MinIO、OSS）/ SM.MS 图床                  |
| 👤 **身份** | 显示名分离、认证徽章、@handle、头像与简介                     |
| 🔗 **短链** | 自定义短码、点击统计、跳转服务                                |

---

## 技术栈

| 层级         | 技术                                                                  |
| ------------ | --------------------------------------------------------------------- |
| **框架**     | [Next.js 14](https://nextjs.org/)（App Router、ISR、standalone 输出） |
| **语言**     | TypeScript 5                                                          |
| **样式**     | Tailwind CSS 3                                                        |
| **数据库**   | SQLite via [Prisma 5](https://www.prisma.io/)                         |
| **认证**     | JWT + httpOnly Cookie                                                 |
| **测试**     | Vitest（83 个测试）                                                   |
| **代码质量** | ESLint + Prettier + Husky + lint-staged                               |
| **进程管理** | PM2                                                                   |

---

## 快速开始

> **环境要求：** Node.js 18+

```bash
# 1. 克隆仓库
git clone https://github.com/mofajiang/project-x.git
cd project-x

# 2. 安装依赖（Linux 环境需加 --include=optional 以确保 Sharp 图片处理正常）
npm install --include=optional

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，至少配置 JWT_SECRET

# 4. 初始化数据库
npm run db:push

# 5. 创建管理员账号
npx tsx scripts/init-admin.ts

# 6. 启动开发服务器
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

> 💡 Linux 环境下 `--include=optional` 确保 `sharp`（图片优化）和 `geoip-lite`（访客地理定位）正确安装。

---

## 服务器部署

### 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh | bash
```

安装脚本自动处理：依赖安装、数据库初始化、管理员创建、PM2 配置、Nginx 反向代理。

### 手动部署

```bash
# 生产构建
npm run build

# 使用 PM2 启动
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

构建产物为 `.next/standalone/` 下的独立 Node.js 服务端，无需 `node_modules` 即可运行。

### 更新版本

```bash
cd project-x
git pull
npm install --include=optional
npm run db:push
npm run build
pm2 restart x-blog
```

### 卸载

```bash
bash scripts/uninstall.sh
```

---

## 环境变量

复制 `.env.example` 为 `.env` 并填写：

| 变量                      | 必填 | 说明                                           |
| ------------------------- | :--: | ---------------------------------------------- |
| `DATABASE_URL`            |  ✅  | SQLite 文件路径（默认：`file:./data/blog.db`） |
| `JWT_SECRET`              |  ✅  | JWT 签名密钥（随机长字符串）                   |
| `SESSION_SECRET`          |  ✅  | Session 密钥（32 位以上）                      |
| `NEXT_PUBLIC_SITE_URL`    |  ✅  | 网站公开域名（如 `https://your-domain.com`）   |
| `PORT`                    |  —   | 服务端口（默认 `3000`）                        |
| `SMTP_HOST`               |  —   | SMTP 服务器地址                                |
| `SMTP_PORT`               |  —   | SMTP 端口                                      |
| `SMTP_USER`               |  —   | SMTP 用户名                                    |
| `SMTP_PASS`               |  —   | SMTP 密码                                      |
| `SMTP_FROM`               |  —   | 发件人地址（默认同 `SMTP_USER`）               |
| `STORAGE_DRIVER`          |  —   | 存储驱动：`local`（默认）、`s3` 或 `smms`      |
| `STORAGE_S3_*`            |  —   | S3 兼容存储凭证                                |
| `STORAGE_PUBLIC_BASE_URL` |  —   | CDN 公网访问前缀                               |
| `STORAGE_SMMS_TOKEN`      |  —   | SM.MS API Token                                |
| `LICENSE_SERVER_URL`      |  —   | License 服务器地址（可选）                     |
| `LICENSE_SECRET`          |  —   | License HMAC 密钥（可选）                      |
| `MAXMIND_LICENSE_KEY`     |  —   | MaxMind GeoLite2 离线库 License Key            |

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
- **Groq**：免费额度、超低延迟，支持 Llama、Mixtral 等开源模型
- **自定义接口**：支持 Ollama、LocalAI 等任何 OpenAI 兼容端点

**审核强度（评论与友链统一阈值）：**

| 强度            | 自动通过 | 自动拒绝 | 适用场景         |
| --------------- | :------: | :------: | ---------------- |
| 🟢 宽松         |   < 30   |   ≥ 80   | 个人博客、低流量 |
| 🟡 均衡（推荐） |   < 20   |   ≥ 70   | 通用             |
| 🔴 严格         |   < 10   |   ≥ 60   | 高流量、防垃圾   |

风险分数 0–100，分数越低越安全。中间分数进入人工审核队列。已登录用户评论直接放行，不触发 AI 检测。

### 文件存储

在后台「站点设置 → 存储」或通过环境变量配置：

- **`local`**（默认）：上传文件保存至 `public/uploads/`
- **`s3`**：兼容 S3 协议的对象存储，支持 Cloudflare R2、MinIO、阿里云 OSS 等
- **`smms`**：SM.MS 图床，填写 token 即可使用

### 友情链接

**用户申请流程：** 访问 `/links` → 点击「申请友链」→ 填写表单 → 系统验证互链 → 等待审核

**管理员操作（后台 → 友情链接）：**

- 手动批准 / 拒绝
- AI 安全检测（品牌安全、垃圾风险、恶意软件、内容风险四维度评分）
- 互链检查（验证对方是否已添加回链）
- 开启自动审批（AI 低风险自动通过）

### 文章引用语法

在文章 Markdown 中使用特殊语法插入引用卡片：

```markdown
# 引用站内文章（填写文章 slug）

::quote[my-article-slug]

# 引用外部链接（自动抓取 OG 信息生成卡片）

::quote-url[https://example.com/some-article]
```

---

## 故障排查

### 构建失败：Module not found

通常是缓存污染或文件签出不完整导致：

```bash
git checkout HEAD -- src/
rm -rf node_modules/.cache .next
npm cache clean --force
npm ci
npm run build
```

### Nginx HTTPS 重定向循环

检查 Nginx 配置中是否包含以下 header：

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
npm run db:push    # 同步数据库结构（所有列已在 Schema 中声明，无数据丢失风险）
npm run db:studio  # 可视化查看数据库（开发用）
```

---

## 项目结构

```
project-x/
├── ecosystem.config.js          # PM2 生产配置
├── next.config.js               # Next.js 配置（CSP、standalone 输出等）
├── prisma/
│   ├── schema.prisma            # 数据库 Schema（11 个模型、70+ SiteConfig 字段）
│   └── data/                    # SQLite 数据库文件
├── public/                      # 静态资源与上传文件
├── scripts/
│   ├── init-admin.ts|mjs|cjs    # 管理员账号初始化
│   ├── install.sh               # 一键部署脚本
│   └── uninstall.sh             # 卸载脚本
└── src/
    ├── middleware.ts             # Edge 中间件（JWT、CSP、频率限制）
    ├── app/
    │   ├── (blog)/               # 前台博客页面（14 个路由）
    │   ├── admin/                # 后台管理页面（13 个页面）
    │   ├── api/                  # API 路由（16 个模块）
    │   ├── [loginPath]/          # 动态登录路径
    │   └── go/[code]/            # 短链接跳转
    ├── components/
    │   ├── admin/                # 后台专用组件（16 个）
    │   ├── blog/                 # 博客组件 — PostCard、评论等（14 个）
    │   ├── layout/               # 布局组件 — 导航栏、侧边栏、抽屉
    │   └── ui/                   # 可复用基础 UI 组件
    ├── hooks/                    # 自定义 React Hooks
    └── lib/                      # 核心工具库（18 个模块 + 5 个测试文件）
        ├── auth.ts               # JWT 认证 + Token 黑名单
        ├── ai-call.ts            # AI 供应商抽象层
        ├── keyword-radar.ts      # 内容雷达引擎
        ├── storage.ts            # 存储抽象层（local/S3/SM.MS）
        ├── mailer.ts             # 邮件发送
        └── ...
```

---

## 参与贡献

欢迎提交贡献。请在提交 Pull Request 前先开 Issue 讨论改动方案：

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feature/amazing-feature`）
3. 提交改动（`git commit -m 'feat: 添加某某功能'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 创建 Pull Request

---

## 开源协议

本项目基于 MIT License 开源 — 详见 [LICENSE](LICENSE) 文件。

---

<div align="center">

**✕ Blog** — 由 [mofajiang](https://github.com/mofajiang) 用 ❤️ 构建

</div>
