# X 风格个人博客

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![License](https://img.shields.io/github/license/mofajiang/project-x)](https://github.com/mofajiang/project-x/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/mofajiang/project-x?style=social)](https://github.com/mofajiang/project-x)
[![Last Commit](https://img.shields.io/github/last-commit/mofajiang/project-x)](https://github.com/mofajiang/project-x/commits/main)
[![Deploy](https://img.shields.io/badge/deploy-宝塔%20%2F%20PM2-green?logo=linux&logoColor=white)](#宝塔部署)

基于 Next.js 14 + Tailwind CSS + SQLite（Prisma）构建的 X(Twitter) 风格个人博客。

## 功能特性

- 🎨 X 风格 UI（深色主题、三栏布局、卡片 Feed）
- 📝 文章管理（富文本编辑、草稿/发布、标签、封面图）
- ✏️ 首页快速发布（X 风格顶部发帖框，支持 Markdown 切换，登录后显示）
- 💬 评论系统（X 风格嵌套回复 + 审核模式 + 邮件提醒）
- 🔗 引用卡片（站内文章引用 / 外部链接 OG 卡片，Feed 直接展示）
- 📬 邮件通知（评论审核通过 / 被回复时自动发邮件，后台可配置 SMTP）
- 🔒 安全登录（自定义路径 / 隐藏彩蛋 / 失败锁定）
- ⚙️ 后台管理（仪表盘、文章、评论、标签、安全、站点设置、SMTP 配置）
- 👤 显示名称（展示名与登录账号分离，可在「站点设置 → 个人资料」中单独配置）
- ✅ 认证徽章（文章作者行展示蓝色认证标识 + @账号 handle）
- 🔗 友情链接组件（右侧栏 X 风格「推荐关注」式友链卡片，可在「站点设置」中配置）
- 🌙 主题切换（深色/浅色模式，支持默认主题设置）
- 🔍 全站搜索（手机端独立搜索页，支持标题 / 摘要 / 正文模糊匹配）
- 📱 响应式设计 + 手机端底部导航栏（搜索 / 首页 / 归档 / 标签）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 修改 JWT_SECRET 等配置
```

### 3. 初始化数据库

```bash
npm run db:push
```

### 4. 创建管理员账号

```bash
npx tsx scripts/init-admin.ts
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 <http://localhost:3000>

**默认登录地址:** <http://localhost:3000/admin-login>  
**默认账号:** admin  
**默认密码:** Admin@123456

> ⚠️ 首次登录后请立即在「安全设置」中修改登录路径和密码！

## 显示名称配置

登录账号（用于身份验证）与展示名称（显示在文章 / Feed 中）相互独立：

- 在后台「站点设置 → 个人资料」中分别设置「显示名称」和「账号 @handle」
- 首页 Feed、文章详情页、标签页均显示蓝色认证徽章和 @handle
- 留空显示名称时自动回退显示登录账号名

## 邮件通知配置（可选）

在后台「站点设置 → 📧 邮件通知」中填写 SMTP 信息，或直接编辑 `.env`：

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your@qq.com
SMTP_PASS=your-auth-code
SMTP_FROM=your@qq.com   # 可选
```

常见服务商：

| 服务商 | HOST | PORT |
|--------|------|------|
| QQ 邮箱 | smtp.qq.com | 465 |
| 163 邮箱 | smtp.163.com | 465 |
| Gmail | smtp.gmail.com | 587 |

配置后重启服务生效，可在后台点击「发测试邮件」验证。

## 文章引用语法

在文章编辑器中使用特殊语法插入引用卡片，首页 Feed 和详情页均可展示：

```
# 引用站内文章
::quote[文章-slug]

# 引用外部链接（自动抓取 OG 信息）
::quote-url[https://example.com]
```

## 宝塔部署

```bash
npm install
npm run build
pm2 start npm --name "myblog" -- start
```

## 目录结构

```
src/
├── app/
│   ├── (blog)/          # 前台博客页面
│   ├── admin/           # 后台管理页面
│   ├── api/
│   │   ├── admin/       # 后台 API（config / comments / smtp ...）
│   │   ├── comments/    # 评论提交
│   │   ├── og-preview/  # OG 信息抓取（含内存缓存）
│   │   ├── search/      # 全文搜索 API（标题 / 摘要 / 正文）
│   │   └── ...          # 其他 API
│   ├── (blog)/search/   # 手机端全屏搜索页
│   └── [loginPath]/     # 动态登录页
├── components/
│   ├── blog/
│   │   ├── PostCard.tsx         # Feed 卡片（含引用卡片渲染、认证徽章）
│   │   ├── QuickPost.tsx        # 首页快速发帖框（登录后展示）
│   │   ├── CommentSection.tsx   # X 风格评论（头像竖线 + 内联回复）
│   │   ├── QuoteCard.tsx        # 引用卡片组件
│   │   └── MarkdownRenderer.tsx # Markdown 渲染
│   ├── layout/
│   │   ├── MobileTabBar.tsx     # 手机端底部导航栏（含搜索入口）
│   │   └── ...                  # 其他布局组件
│   └── admin/           # 后台组件
└── lib/
    ├── mailer.ts        # 邮件发送工具（nodemailer）
    ├── db-migrate.ts    # 自动数据库迁移
    └── ...              # 其他工具库
prisma/
└── schema.prisma        # 数据库 Schema
scripts/
└── init-admin.ts        # 初始化管理员
```

