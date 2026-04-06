# X 风格个人博客

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![Stars](https://img.shields.io/github/stars/mofajiang/project-x?style=social)](https://github.com/mofajiang/project-x)
[![Last Commit](https://img.shields.io/github/last-commit/mofajiang/project-x)](https://github.com/mofajiang/project-x/commits/main)

示例网站：https://thisblog.me/

基于 Next.js 14 + Tailwind CSS + SQLite（Prisma）构建的 X 风格个人博客系统，支持文章发布、Markdown 编辑、评论审核、邮件提醒、后台管理、站点个性化配置，以及 RSS 订阅、Sitemap/Robots 和文章级 SEO 元数据。

---

## 目录

- [功能特性](#功能特性)
- [本地开发](#本地开发)
- [服务器部署](#服务器部署)
  - [一键安装](#一键安装)
  - [手动部署](#手动部署)
  - [更新与卸载](#更新与卸载)
- [功能配置](#功能配置)
- [故障排查](#故障排查)
- [目录结构](#目录结构)

---

## 功能特性

- 🎨 X 风格 UI：深色主题、三栏布局、卡片式 Feed
- 📝 文章管理：富文本编辑、草稿、发布、标签、封面图
- ✏️ 快速发布：首页顶部发帖框，支持 Markdown 切换
- 💬 评论系统：嵌套回复、审核模式、邮件通知
- 🤖 AI 审核：OpenRouter 智能评分，自动判定垃圾评论与高风险内容
- 🔗 引用卡片：支持站内文章引用和外部链接 OG 卡片
- 📬 邮件通知：评论审核、回复提醒、SMTP 配置
- 🔒 安全登录：动态登录路径、失败锁定、隐藏彩蛋
- ⚙️ 后台管理：仪表盘、文章、评论、标签、站点设置、SMTP
- 👤 显示名称：作者名称与登录账号分离，可独立设置
- ✅ 认证徽章：文章作者展示认证标识和 handle
- 🔗 友情链接：右侧栏友链卡片展示
- 🌙 主题切换：深色 / 浅色模式支持
- 🔍 全站搜索：标题、摘要、正文模糊搜索
- � RSS 订阅：自动生成 /feed.xml
- 🧭 Sitemap / Robots：/sitemap.xml 与 /robots.txt
- �📱 响应式：手机端底部导航与适配样式

---

## 本地开发

```bash
npm install
cp .env.example .env
# 编辑 .env，配置 JWT_SECRET、NEXT_PUBLIC_SITE_URL 等
npm run db:push
npx tsx scripts/init-admin.ts
npm run dev
```

访问：http://localhost:3000

> ⚠️ 首次登录后请及时修改登录路径和管理员密码。

---

## 服务器部署

**环境要求：** Node.js 18+、Git、PM2、Nginx

### 一键安装

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh)
```

该脚本会自动完成依赖安装、配置生成、构建、数据库初始化、PM2 启动和 Nginx 配置。

### 手动部署

1. 拉取代码

```bash
git clone https://github.com/mofajiang/project-x.git /www/wwwroot/yourdomain.com/project-x
cd /www/wwwroot/yourdomain.com/project-x
```

2. 创建环境变量

```bash
cp .env.example .env
nano .env
```

示例：

```env
DATABASE_URL="file:./data/db.sqlite"
JWT_SECRET="your-strong-secret-here"
NEXT_PUBLIC_SITE_URL="https://yourdomain.com"
```

3. 安装依赖并构建

```bash
npm install
npm run build
```

4. 初始化数据库和管理员

```bash
npm run db:push
npx tsx scripts/init-admin.ts
```

5. PM2 启动

```bash
pm2 start npm --name x-blog -- start
pm2 save
pm2 startup
```

### 更新与卸载

**更新：**

```bash
cd /www/wwwroot/yourdomain.com/project-x
git pull origin main
npm run build
pm2 restart x-blog
```

**卸载：**

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/uninstall.sh)
```

---

## 功能配置

### 显示名称与认证徽章

在后台「站点设置 → 个人资料」中配置：
- **显示名称**：显示在文章、Feed 中的名字（留空则显示登录账号名）
- **账号 @handle**：认证徽章旁边的 handle

### 邮件通知

编辑 `.env` 或在后台配置 SMTP：

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your@qq.com
SMTP_PASS=your-auth-code
SMTP_FROM=your@qq.com
```

推荐配置：

| 服务商 | HOST | PORT |
|--------|------|------|
| QQ 邮箱 | smtp.qq.com | 465 |
| 163 邮箱 | smtp.163.com | 465 |
| Gmail | smtp.gmail.com | 587 |

配置完成后，保存设置并测试发送邮件。

### AI 评论审核

如果启用 AI 审核功能，系统会使用 OpenRouter 对评论内容进行智能评分，并自动标记垃圾评论、低质量评论或高风险评论。

后台「站点设置」中可配置 OpenRouter API Key 与模型，支持自定义审核阈值。

### 文章引用语法

```
# 引用站内文章（填写文章 slug）
::quote[article-slug]

# 引用外部链接（自动抓取 OG 信息）
::quote-url[https://example.com]
```

---

## 故障排查

### 构建失败：Module not found

如果构建时出现 `Module not found: Can't resolve '@/lib/utils'` 等错误，通常是由于缓存污染或文件签出不完整。

**快速修复：**

```bash
# 方法 1：自动修复脚本（推荐）
chmod +x fix-build.sh
./fix-build.sh

# 方法 2：手动修复
git checkout HEAD -- src/lib/utils.ts src/components/admin/MarkdownEditor.tsx src/components/ui/IMEInput.tsx src/hooks/useIMEInput.ts src/hooks/useTheme.ts
rm -rf node_modules/.cache .next
npm cache clean --force
npm ci
npm run build
pm2 restart x-blog
```

### PM2 日志查看

```bash
# 查看最近 50 行日志
pm2 logs x-blog --lines 50

# 实时查看日志
pm2 logs x-blog

# 查看错误日志
pm2 logs x-blog err
```

### Nginx 反向代理问题

若 HTTPS 下出现重定向循环，检查 Nginx 配置是否包含：

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
```

不要使用宝塔的图形化反向代理功能，直接编辑配置文件。

---

## 目录结构

```
src/
├── app/
│   ├── (blog)/          # 前台博客页面
│   ├── admin/           # 后台管理页面
│   ├── api/             # API 路由
│   └── [loginPath]/     # 动态登录页
├── components/
│   ├── blog/            # 博客组件（PostCard、QuickPost、评论等）
│   ├── layout/          # 布局组件（导航栏、手机端底栏等）
│   ├── admin/           # 后台组件
│   └── ui/              # UI 基础组件（IMEInput 等）
└── lib/                 # 工具库（auth、prisma、mailer、utils 等）
prisma/
└── schema.prisma        # 数据库 Schema
scripts/
├── init-admin.ts        # 初始化管理员
├── install.sh           # 统一管理脚本（install/update/uninstall/status/restart/stop/logs/menu）
└── uninstall.sh         # 兼容包装脚本（转发到 install.sh uninstall）
```

