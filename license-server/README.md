# License Server

独立部署的授权验证服务器，用于控制哪些域名可以使用 project-x 主题。

## 目录结构

```
license-server/
├── app/
│   ├── layout.tsx          # 根布局
│   ├── page.tsx            # Web 管理 UI
│   └── api/
│       ├── verify/route.ts # 授权验证 API
│       ├── domains/route.ts# 域名管理 CRUD API
│       └── logs/route.ts   # 访问日志 API
├── data/                   # 运行时数据（自动创建）
│   ├── domains.json        # 授权域名列表
│   └── logs.json           # 访问日志
├── .env.example
└── package.json
```

## 部署方式

### Vercel（推荐）

```bash
cd license-server
npm install
vercel deploy
```

> ⚠️ Vercel 无持久文件系统，建议替换为 Vercel KV 或 PlanetScale 存储域名数据。

### 宝塔 / VPS

```bash
cd license-server
npm install && npm run build
pm2 start npm --name license-server -- start
```

## 环境变量

复制 `.env.example` 为 `.env`：

```env
LICENSE_SECRET=（与博客端相同的密钥，必须保密）
ADMIN_KEY=（Web UI 登录密码）
```

## Web 管理界面

访问 `https://your-license-server/` 即可打开管理界面：

- 🔑 密钥登录（`ADMIN_KEY`）
- 📋 查看/添加/撤销授权域名
- 🧪 测试任意域名是否已授权
- 📊 查看最近 500 条验证日志

## 博客端配置

在博客 `.env` 中填写：

```env
LICENSE_SERVER_URL=https://your-license-server.vercel.app
LICENSE_SECRET=（与服务器相同的密钥）
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/verify` | 博客端调用，验证域名授权 |
| GET | `/api/verify` | 健康检查 |
| GET | `/api/domains` | 获取域名列表（需 Admin Key）|
| POST | `/api/domains` | 添加授权域名（需 Admin Key）|
| DELETE | `/api/domains` | 撤销授权（需 Admin Key）|
| GET | `/api/logs` | 获取访问日志（需 Admin Key）|
