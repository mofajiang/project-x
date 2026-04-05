# X 风格个人博客

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![Stars](https://img.shields.io/github/stars/mofajiang/project-x?style=social)](https://github.com/mofajiang/project-x)
[![Last Commit](https://img.shields.io/github/last-commit/mofajiang/project-x)](https://github.com/mofajiang/project-x/commits/main)

基于 Next.js 14 + Tailwind CSS + SQLite（Prisma）构建的 X(Twitter) 风格个人博客。

---

## 目录

- [功能特性](#功能特性)
- [本地开发](#本地开发)
- [服务器部署](#服务器部署)
  - [一键安装](#一键安装)
  - [手动部署](#手动部署)
  - [更新与卸载](#更新与卸载)
- [功能配置](#功能配置)
- [目录结构](#目录结构)

---

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
- 🔗 友情链接（右侧栏 X 风格「推荐关注」式友链卡片）
- 🌙 主题切换（深色/浅色模式，支持默认主题设置）
- 🔍 全站搜索（支持标题 / 摘要 / 正文模糊匹配）
- 📱 响应式设计 + 手机端底部导航栏

---

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，修改 JWT_SECRET 等

# 3. 初始化数据库
npm run db:push

# 4. 创建管理员账号
npx tsx scripts/init-admin.ts

# 5. 启动开发服务器
npm run dev
```

访问 http://localhost:3000

| 项目 | 值 |
|------|----|
| 登录地址 | http://localhost:3000/admin-login |
| 默认账号 | admin |
| 默认密码 | Admin@123456 |

> ⚠️ 首次登录后请立即在「安全设置」中修改登录路径和密码！

---

## 服务器部署

**环境要求：** Node.js 18+、Git、PM2、Nginx

### 一键安装

在服务器终端执行，脚本会交互式引导完成所有配置。该脚本也支持 `update` / `uninstall` / `status` / `restart` / `stop` / `logs` / `menu` 等子命令：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh)
```

自动完成：依赖检查 → 配置收集 → 拉取代码 → 生成 `.env` → 构建 → 初始化数据库 → PM2 启动 → Nginx 配置。

### 手动部署

**1. 拉取代码**

```bash
git clone https://github.com/mofajiang/project-x.git /www/wwwroot/yourdomain.com/project-x
cd /www/wwwroot/yourdomain.com/project-x
```

**2. 配置 `.env`**

```bash
cp .env.example .env && nano .env
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

**5. PM2 启动**

```bash
pm2 start npm --name x-blog -- start
pm2 save && pm2 startup
```

### 更新与卸载

**更新：**

```bash
cd /www/wwwroot/yourdomain.com/project-x
git pull origin main && npm run build && pm2 restart x-blog
```

**一键卸载：**

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/uninstall.sh)
```

等价于执行统一脚本的卸载命令：`bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh) uninstall`。

卸载前会提示备份数据库，并自动清理 PM2 进程和项目目录。

**常用 PM2 命令：**

```bash
pm2 list                     # 查看进程状态
pm2 logs x-blog             # 查看实时日志
pm2 logs x-blog --lines 50  # 查看最近50行
pm2 restart x-blog          # 重启
pm2 stop x-blog             # 停止
```

---

## 功能配置

### 显示名称与认证徽章

在后台「站点设置 → 个人资料」中配置：
- **显示名称**：显示在文章、Feed 中的名字（留空则显示登录账号名）
- **账号 @handle**：认证徽章旁边的 handle

### 邮件通知（可选）

在后台「站点设置 → 📧 邮件通知」中配置，或直接编辑 `.env`：

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your@qq.com
SMTP_PASS=your-auth-code
SMTP_FROM=your@qq.com
```

| 服务商 | HOST | PORT |
|--------|------|------|
| QQ 邮箱 | smtp.qq.com | 465 |
| 163 邮箱 | smtp.163.com | 465 |
| Gmail | smtp.gmail.com | 587 |

配置后重启服务生效，可在后台点击「发测试邮件」验证。

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

