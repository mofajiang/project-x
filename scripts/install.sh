#!/bin/bash
# ============================================================
#  X-Blog 一键安装脚本
#  支持宝塔面板 / 纯 Linux 环境
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_banner() {
  echo -e "${CYAN}"
  echo '  ██╗  ██╗    ██████╗ ██╗      ██████╗  ██████╗ '
  echo '  ╚██╗██╔╝    ██╔══██╗██║     ██╔═══██╗██╔════╝ '
  echo '   ╚███╔╝     ██████╔╝██║     ██║   ██║██║  ███╗'
  echo '   ██╔██╗     ██╔══██╗██║     ██║   ██║██║   ██║'
  echo '  ██╔╝ ██╗    ██████╔╝███████╗╚██████╔╝╚██████╔╝'
  echo '  ╚═╝  ╚═╝    ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ '
  echo -e "${NC}"
  echo -e "${GREEN}  X 风格个人博客 - 一键安装脚本${NC}"
  echo -e "  ${BLUE}https://github.com/mofajiang/project-x${NC}"
  echo ''
}

step() {
  echo -e "\n${GREEN}[✓] $1${NC}"
}

info() {
  echo -e "${BLUE}[i] $1${NC}"
}

warn() {
  echo -e "${YELLOW}[!] $1${NC}"
}

error() {
  echo -e "${RED}[✗] $1${NC}"
  exit 1
}

prompt() {
  echo -e -n "${CYAN}$1${NC} "
}

# ── 检查依赖 ──────────────────────────────────────────────
check_deps() {
  step "检查系统依赖"

  if ! command -v node &>/dev/null; then
    error "未找到 Node.js，请先安装 Node.js 18+（宝塔面板：软件商店 → Node.js版本管理器）"
  fi

  NODE_VER=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
  if [ "$NODE_VER" -lt 18 ]; then
    error "Node.js 版本过低（当前 v${NODE_VER}），需要 18+"
  fi
  info "Node.js $(node -v) ✓"

  if ! command -v git &>/dev/null; then
    error "未找到 git，请先安装：apt install git 或 yum install git"
  fi
  info "Git $(git --version | awk '{print $3}') ✓"

  if ! command -v pm2 &>/dev/null; then
    warn "未找到 PM2，正在安装..."
    npm install -g pm2 --silent
    info "PM2 $(pm2 -v) 安装完成 ✓"
  else
    info "PM2 $(pm2 -v) ✓"
  fi
}

# ── 交互式配置 ────────────────────────────────────────────
collect_config() {
  step "配置安装参数"

  # 安装目录
  prompt "安装目录 [默认: /www/wwwroot/x-blog]:"
  read INSTALL_DIR
  INSTALL_DIR=${INSTALL_DIR:-/www/wwwroot/x-blog}

  # 域名（可选，仅用于显示）
  prompt "你的域名（如 example.com，仅用于生成站点 URL，留空则用 localhost）:"
  read DOMAIN
  DOMAIN=${DOMAIN:-localhost}

  # 端口
  prompt "监听端口 [默认: 3000]:"
  read APP_PORT
  APP_PORT=${APP_PORT:-3000}

  # 是否 HTTPS
  if [ "$DOMAIN" = "localhost" ]; then
    SITE_URL="http://localhost:${APP_PORT}"
  else
    prompt "是否使用 HTTPS？(y/n) [默认: y]:"
    read USE_HTTPS
    USE_HTTPS=${USE_HTTPS:-y}
    if [[ "$USE_HTTPS" =~ ^[Yy]$ ]]; then
      SITE_URL="https://${DOMAIN}"
    else
      SITE_URL="http://${DOMAIN}"
    fi
  fi

  # JWT Secret
  prompt "JWT 密钥（留空自动生成）:"
  read JWT_SECRET
  if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    info "已自动生成 JWT 密钥"
  fi

  # 管理员账号
  prompt "管理员用户名 [默认: admin]:"
  read ADMIN_USER
  ADMIN_USER=${ADMIN_USER:-admin}

  prompt "管理员密码 [默认: Admin@123456]:"
  read ADMIN_PASS
  ADMIN_PASS=${ADMIN_PASS:-Admin@123456}

  # PM2 进程名
  prompt "PM2 进程名 [默认: x-blog]:"
  read PM2_NAME
  PM2_NAME=${PM2_NAME:-x-blog}

  echo ''
  echo -e "${YELLOW}────────────────────────────────────────${NC}"
  echo -e "  安装目录：${GREEN}${INSTALL_DIR}${NC}"
  echo -e "  域名：    ${GREEN}${DOMAIN}${NC}"
  echo -e "  站点URL：  ${GREEN}${SITE_URL}${NC}"
  echo -e "  端口：    ${GREEN}${APP_PORT}${NC}"
  echo -e "  PM2名称：  ${GREEN}${PM2_NAME}${NC}"
  echo -e "  管理员：  ${GREEN}${ADMIN_USER}${NC}"
  echo -e "${YELLOW}────────────────────────────────────────${NC}"
  prompt "确认以上配置并开始安装？(y/n):"
  read CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "已取消安装。"
    exit 0
  fi
}

# ── 拉取代码 ──────────────────────────────────────────────
install_code() {
  step "下载项目代码"

  if [ -d "$INSTALL_DIR/.git" ]; then
    warn "目录已存在，执行 git pull 更新..."
    cd "$INSTALL_DIR"
    git pull origin main
  else
    mkdir -p "$(dirname $INSTALL_DIR)"
    git clone https://github.com/mofajiang/project-x.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi
}

# ── 写入 .env ─────────────────────────────────────────────
setup_env() {
  step "生成 .env 配置文件"

  DB_PATH="${INSTALL_DIR}/data/db.sqlite"
  mkdir -p "${INSTALL_DIR}/data"

  cat > "${INSTALL_DIR}/.env" <<EOF
# 数据库
DATABASE_URL="file:${DB_PATH}"

# JWT 密钥（请勿泄露）
JWT_SECRET="${JWT_SECRET}"

# 站点 URL
NEXT_PUBLIC_SITE_URL="${SITE_URL}"

# 端口（next start 使用）
PORT=${APP_PORT}
EOF

  info ".env 已写入 ${INSTALL_DIR}/.env"
}

# ── 安装依赖并构建 ────────────────────────────────────────
build_app() {
  step "安装 npm 依赖"
  cd "$INSTALL_DIR"
  npm install --production=false

  step "构建生产版本"
  npm run build
}

# ── 初始化数据库 ──────────────────────────────────────────
init_db() {
  step "初始化数据库"
  cd "$INSTALL_DIR"
  npm run db:push

  step "创建管理员账号"
  ADMIN_USER="$ADMIN_USER" ADMIN_PASS="$ADMIN_PASS" npx tsx scripts/init-admin.ts
}

# ── 启动 PM2 ──────────────────────────────────────────────
start_pm2() {
  step "启动 PM2 进程"
  cd "$INSTALL_DIR"

  # 停止旧进程（忽略报错）
  pm2 delete "$PM2_NAME" 2>/dev/null || true

  pm2 start npm --name "$PM2_NAME" -- start
  pm2 save

  # 设置开机自启
  pm2 startup 2>/dev/null | grep 'sudo' | bash 2>/dev/null || true

  info "PM2 进程已启动"
  pm2 show "$PM2_NAME"
}

# ── 生成 Nginx 配置 ───────────────────────────────────────
generate_nginx() {
  step "生成 Nginx 配置"

  NGINX_CONF="/www/server/nginx/vhost/${DOMAIN}.conf"

  # 检测宝塔路径
  if [ ! -d "/www/server/nginx" ]; then
    warn "未检测到宝塔 Nginx 路径，跳过自动写入 Nginx 配置"
    warn "请手动将以下配置复制到 Nginx vhost 配置文件"
    NGINX_CONF="/tmp/x-blog-nginx-${DOMAIN}.conf"
  fi

  cat > "$NGINX_CONF" <<NGINX
server
{
    listen 80;
    server_name ${DOMAIN};
    root /www/wwwroot/${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    location ~* /(\\..+|node_modules|\\.next)/ { return 404; }
    location ~ \\.well-known { allow all; }

    access_log  /www/wwwlogs/${DOMAIN}.log;
    error_log   /www/wwwlogs/${DOMAIN}.error.log;
}
NGINX

  info "Nginx 配置已写入：${NGINX_CONF}"

  if command -v nginx &>/dev/null; then
    nginx -t && nginx -s reload
    info "Nginx 已重载"
  fi
}

# ── 完成 ──────────────────────────────────────────────────
print_done() {
  echo ''
  echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║         🎉 安装完成！                    ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
  echo ''
  echo -e "  安装目录：  ${CYAN}${INSTALL_DIR}${NC}"
  echo -e "  监听端口：  ${CYAN}${APP_PORT}${NC}"
  echo -e "  站点 URL：  ${CYAN}${SITE_URL}${NC}"
  echo -e "  管理后台：  ${CYAN}${SITE_URL}/admin-login${NC}"
  echo -e "  管理员：    ${CYAN}${ADMIN_USER}${NC}"
  echo ''
  echo -e "${YELLOW}  ⚠ 首次登录后请立即修改登录路径和密码！${NC}"
  echo ''
  echo -e "${YELLOW}  📌 Nginx 反向代理需手动配置，请参考 README：${NC}"
  echo -e "  ${BLUE}https://github.com/mofajiang/project-x#手动部署${NC}"
  echo -e "  将以下内容加入 Nginx location 块："
  echo -e "  ${BLUE}proxy_pass http://127.0.0.1:${APP_PORT};${NC}"
  echo -e "  ${BLUE}proxy_set_header X-Forwarded-Proto \$scheme;${NC}"
  echo ''
  echo -e "  常用命令："
  echo -e "    查看状态：  ${BLUE}pm2 list${NC}"
  echo -e "    查看日志：  ${BLUE}pm2 logs ${PM2_NAME}${NC}"
  echo -e "    重启服务：  ${BLUE}pm2 restart ${PM2_NAME}${NC}"
  echo -e "    更新部署：  ${BLUE}cd ${INSTALL_DIR} && git pull && npm run build && pm2 restart ${PM2_NAME}${NC}"
  echo -e "    一键卸载：  ${BLUE}bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/uninstall.sh)${NC}"
  echo ''
}

# ── 主流程 ────────────────────────────────────────────────
main() {
  print_banner
  check_deps
  collect_config
  install_code
  setup_env
  build_app
  init_db
  start_pm2
  print_done
}

main
