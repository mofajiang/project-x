# ✕ Blog — X-Style Personal Blog

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/mofajiang/project-x?style=social)](https://github.com/mofajiang/project-x)

**A full-featured personal blog built with Next.js 14, Tailwind CSS, and SQLite — inspired by X (Twitter)'s design language.**

[Live Demo](https://thisblog.me/) · [Quick Start](#quick-start) · [One-Click Deploy](#one-click-install) · [Issues](https://github.com/mofajiang/project-x/issues)

[中文文档](./README.md)

</div>

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Deployment](#deployment)
  - [One-Click Install](#one-click-install)
  - [Manual Deployment](#manual-deployment)
  - [Upgrade](#upgrade)
  - [Uninstall](#uninstall)
- [Environment Variables](#environment-variables)
- [Feature Configuration](#feature-configuration)
  - [Email Notifications](#email-notifications)
  - [AI Moderation](#ai-moderation)
  - [File Storage](#file-storage)
  - [Friend Links](#friend-links)
  - [Article Quote Syntax](#article-quote-syntax)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### 🎨 Interface

X-style UI · Dark/Light theme toggle · Three-column layout · Card-based feed · Fully responsive

### 📝 Content

Markdown editor with live preview · Draft/Publish workflow · Tag system · Cover images · Quick-post composer on homepage · Thread support (grouped posts)

### 💬 Engagement

Nested comments · Approval queue · Likes & reposts · Email reply notifications · Guestbook with moderation · Visitor tracking with interactive map

### 🤖 AI-Powered

Multi-provider LLM support (OpenRouter / Groq / Custom API) · Comment spam detection · Friend link safety audit · Configurable moderation intensity · Model connection test with live chat preview

### 🔗 Friend Links

Self-service application · Reciprocal link verification · AI safety scanning · Auto-approval for low-risk submissions · Sidebar widget · Friend circle feed

### 📡 Content Radar

Multi-source aggregation (Google / Baidu / Sogou / Zhihu / V2EX / Lobsters / Medium / DEV.to / HN / Reddit / CSDN / Juejin / GitHub / WeChat / oschina / 36kr) · AI filtering & deduplication · Time-decay ranking · Webhook notifications · Scheduled daily digest posts

### 🔒 Security

Dynamic login path · Brute-force lockout · JWT token blacklist · CSP headers · DOMPurify XSS protection · IP validation · SSRF protection · Admin audit log

### ⚙️ Administration

Dashboard with analytics · Post / Comment / Tag management · Site settings · SMTP configuration · AI model management · Navigation editor · Right-panel widget configurator

### 🔍 SEO

JSON-LD structured data · Canonical URLs · Dynamic OG images · RSS feed · Sitemap & Robots.txt

### 📦 Storage

Local filesystem · S3-compatible object storage (Cloudflare R2, MinIO, etc.) · SM.MS image hosting

### 👤 Identity

Display name separate from login · Verified badge · @handle · Custom avatars & bios

### 🔗 Short Links

Custom short codes · Click tracking · Redirect service

---

## Tech Stack

| Layer               | Technology                                                             |
| ------------------- | ---------------------------------------------------------------------- |
| **Framework**       | [Next.js 14](https://nextjs.org/) (App Router, ISR, standalone output) |
| **Language**        | TypeScript 5                                                           |
| **Styling**         | Tailwind CSS 3                                                         |
| **Database**        | SQLite via [Prisma 5](https://www.prisma.io/)                          |
| **Authentication**  | JWT + httpOnly Cookie                                                  |
| **Testing**         | Vitest (83 tests)                                                      |
| **Code Quality**    | ESLint + Prettier + Husky + lint-staged                                |
| **Process Manager** | PM2                                                                    |

---

## Quick Start

> **Prerequisites:** Node.js 18+

```bash
# 1. Clone the repository
git clone https://github.com/mofajiang/project-x.git
cd project-x

# 2. Install dependencies (use --include=optional on Linux for Sharp image processing)
npm install --include=optional

# 3. Configure environment
cp .env.example .env
# Edit .env — at minimum, set JWT_SECRET

# 4. Initialize database
npm run db:push

# 5. Create admin account
npx tsx scripts/init-admin.ts

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> 💡 On Linux, `--include=optional` ensures the `sharp` (image optimization) and `geoip-lite` (visitor geolocation) packages are installed correctly.

---

## Deployment

### One-Click Install

```bash
curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh | bash
```

The install script handles everything: dependency installation, database setup, admin account creation, PM2 configuration, and Nginx reverse proxy setup.

### Manual Deployment

```bash
# Build for production
npm run build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

The build outputs a standalone Node.js server in `.next/standalone/` — no `node_modules` required at runtime.

### Upgrade

```bash
cd project-x
git pull
npm install --include=optional
npm run db:push
npm run build
pm2 restart x-blog
```

### Uninstall

```bash
bash scripts/uninstall.sh
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable                  | Required | Description                                              |
| ------------------------- | :------: | -------------------------------------------------------- |
| `DATABASE_URL`            |    ✅    | SQLite file path (default: `file:./data/blog.db`)        |
| `JWT_SECRET`              |    ✅    | Random string for JWT signing                            |
| `SESSION_SECRET`          |    ✅    | 32+ character random string for session encryption       |
| `NEXT_PUBLIC_SITE_URL`    |    ✅    | Your site's public URL (e.g., `https://your-domain.com`) |
| `PORT`                    |    —     | Server port (default: `3000`)                            |
| `SMTP_HOST`               |    —     | SMTP server hostname                                     |
| `SMTP_PORT`               |    —     | SMTP port                                                |
| `SMTP_USER`               |    —     | SMTP username                                            |
| `SMTP_PASS`               |    —     | SMTP password                                            |
| `SMTP_FROM`               |    —     | Sender address (defaults to `SMTP_USER`)                 |
| `STORAGE_DRIVER`          |    —     | Storage driver: `local` (default), `s3`, or `smms`       |
| `STORAGE_S3_*`            |    —     | S3-compatible storage credentials                        |
| `STORAGE_PUBLIC_BASE_URL` |    —     | CDN base URL prefix for uploaded files                   |
| `STORAGE_SMMS_TOKEN`      |    —     | SM.MS API token                                          |
| `LICENSE_SERVER_URL`      |    —     | License server URL (optional)                            |
| `LICENSE_SECRET`          |    —     | License HMAC secret (optional)                           |
| `MAXMIND_LICENSE_KEY`     |    —     | MaxMind GeoLite2 license key for offline IP geolocation  |

---

## Feature Configuration

### Email Notifications

Configure SMTP under **Admin → Site Settings → Email** or directly in `.env`. Test your configuration with the built-in test-email button.

| Provider | Host               | Port |
| -------- | ------------------ | ---- |
| QQ Mail  | smtp.qq.com        | 465  |
| 163 Mail | smtp.163.com       | 465  |
| Gmail    | smtp.gmail.com     | 587  |
| Outlook  | smtp.office365.com | 587  |

### AI Moderation

Configure providers under **Admin → AI Model Management**:

**Supported backends:**

- **OpenRouter** (recommended) — Access Claude, GPT-4, and more. Get an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
- **Groq** — Free tier, ultra-low latency. Supports Llama, Mixtral, and other open-source models
- **Custom API** — Connect Ollama, LocalAI, or any OpenAI-compatible endpoint

**Moderation levels (applies to both comments and friend links):**

| Level                 | Auto-approve | Auto-reject | Best for                      |
| --------------------- | :----------: | :---------: | ----------------------------- |
| 🟢 Lenient            |     < 30     |    ≥ 80     | Personal blogs, low traffic   |
| 🟡 Balanced (default) |     < 20     |    ≥ 70     | General use                   |
| 🔴 Strict             |     < 10     |    ≥ 60     | High traffic, spam prevention |

Risk scores range from 0–100 (lower is safer). Scores in the middle range go to manual review. Logged-in user comments bypass AI detection.

### File Storage

Configure under **Admin → Site Settings → Storage** or via environment variables:

- **`local`** (default) — Uploads saved to `public/uploads/`
- **`s3`** — S3-compatible object storage (Cloudflare R2, MinIO, Alibaba Cloud OSS, etc.)
- **`smms`** — SM.MS image hosting service

### Friend Links

**User flow:** Visit `/links` → Click "Apply" → Fill in your site details → System verifies reciprocal link → Pending review

**Admin flow (Admin → Friend Links):**

- Manual approve / reject
- AI safety scan (brand safety, spam risk, malware, content risk — four dimensions)
- Reciprocal link checker (verifies the applicant has added a backlink)
- Auto-approval toggle (low-risk submissions approved automatically)

### Article Quote Syntax

Use special Markdown syntax to embed rich reference cards in your posts:

```markdown
# Internal article (by slug)

::quote[my-article-slug]

# External link (auto-fetches OG metadata)

::quote-url[https://example.com/some-article]
```

---

## Troubleshooting

### Build fails: "Module not found"

Usually caused by cache corruption or incomplete file checkout:

```bash
git checkout HEAD -- src/
rm -rf node_modules/.cache .next
npm cache clean --force
npm ci
npm run build
```

### Nginx HTTPS redirect loop

Ensure your Nginx config includes:

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
```

### PM2 cheat sheet

```bash
pm2 list                     # Show all process statuses
pm2 logs x-blog              # Live logs
pm2 logs x-blog --lines 100  # Last 100 log lines
pm2 restart x-blog           # Restart
pm2 stop x-blog              # Stop
```

### Database

```bash
npm run db:push    # Sync schema (all columns declared in Schema — no data loss risk)
npm run db:studio  # Visual database browser (development)
```

---

## Project Structure

```
project-x/
├── ecosystem.config.js          # PM2 production config
├── next.config.js               # Next.js configuration (CSP, standalone output, etc.)
├── prisma/
│   ├── schema.prisma            # Database schema (11 models, 70+ SiteConfig fields)
│   └── data/                    # SQLite database files
├── public/                      # Static assets & uploads
├── scripts/
│   ├── init-admin.ts|mjs|cjs    # Admin account initialization
│   ├── install.sh               # One-click deployment script
│   └── uninstall.sh             # Uninstall script
└── src/
    ├── middleware.ts             # Edge middleware (JWT, CSP, rate limiting)
    ├── app/
    │   ├── (blog)/               # Public-facing pages (14 routes)
    │   ├── admin/                # Admin dashboard (13 pages)
    │   ├── api/                  # API routes (16 modules)
    │   ├── [loginPath]/          # Dynamic login path
    │   └── go/[code]/            # Short-link redirect
    ├── components/
    │   ├── admin/                # Admin-specific components (16)
    │   ├── blog/                 # Blog components — PostCard, Comments, etc. (14)
    │   ├── layout/               # Layout — Navbar, Sidebar, Drawer
    │   └── ui/                   # Reusable UI primitives
    ├── hooks/                    # Custom React hooks
    └── lib/                      # Core library (18 modules + 5 test files)
        ├── auth.ts               # JWT auth + token blacklist
        ├── ai-call.ts            # AI provider abstraction
        ├── keyword-radar.ts      # Content radar engine
        ├── storage.ts            # Storage abstraction (local/S3/SM.MS)
        ├── mailer.ts             # Email delivery
        └── ...
```

---

## Contributing

Contributions are welcome. Please open an issue to discuss proposed changes before submitting a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**✕ Blog** — Built with ❤️ by [mofajiang](https://github.com/mofajiang)

</div>
