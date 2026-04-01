#!/bin/bash
# ============================================================
#  X-Blog 统一管理脚本
#  支持宝塔面板 / 纯 Linux 环境
# ============================================================

set -euo pipefail

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

ACTION="install"
if [[ $# -gt 0 && "$1" != -* ]]; then
  case "$1" in
    install|update|uninstall|status|restart|stop|logs|menu)
      ACTION="$1"
      shift || true
      ;;
  esac
fi

INSTALL_DIR="/www/wwwroot/x-blog"
DOMAIN="localhost"
APP_PORT="3000"
SITE_URL=""
JWT_SECRET=""
ADMIN_USER="admin"
ADMIN_PASS=""
PM2_NAME="x-blog"
USE_HTTPS="y"
BACKUP_PATH=""

read_env_value() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 1
  grep -E "^${key}=" "$file" | tail -n1 | cut -d= -f2-
}

extract_domain_from_url() {
  local url="$1"
  if [[ "$url" =~ ^https?://([^/:]+) ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
}

load_existing_config() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0

  local existing_port existing_site_url
  existing_port="$(read_env_value "$env_file" PORT || true)"
  existing_site_url="$(read_env_value "$env_file" NEXT_PUBLIC_SITE_URL || true)"

  if [[ -n "$existing_port" ]]; then
    APP_PORT="$existing_port"
  fi

  if [[ -n "$existing_site_url" ]]; then
    SITE_URL="$existing_site_url"
    local extracted_domain
    extracted_domain="$(extract_domain_from_url "$existing_site_url" || true)"
    if [[ -n "$extracted_domain" ]]; then
      DOMAIN="$extracted_domain"
    fi
    if [[ "$existing_site_url" == https://* ]]; then
      USE_HTTPS="y"
    else
      USE_HTTPS="n"
    fi
  fi
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
  prompt "安装目录 [默认: ${INSTALL_DIR}]:"
  read INSTALL_DIR
  INSTALL_DIR=${INSTALL_DIR:-/www/wwwroot/x-blog}

  # 域名（可选，仅用于显示）
  local default_domain
  default_domain="$DOMAIN"
  if [[ -n "$SITE_URL" ]]; then
    extracted_domain="$(extract_domain_from_url "$SITE_URL" || true)"
    if [[ -n "$extracted_domain" ]]; then
      default_domain="$extracted_domain"
    fi
  fi
  prompt "你的域名（如 example.com，仅用于生成站点 URL，留空则用 localhost） [默认: ${default_domain}]:"
  read DOMAIN
  DOMAIN=${DOMAIN:-$default_domain}

  # 端口
  prompt "监听端口 [默认: ${APP_PORT}]:"
  read APP_PORT
  APP_PORT=${APP_PORT:-3000}

  # 是否 HTTPS
  if [ "$DOMAIN" = "localhost" ]; then
    SITE_URL="http://localhost:${APP_PORT}"
  else
    prompt "是否使用 HTTPS？(y/n) [默认: ${USE_HTTPS}]:"
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
  prompt "管理员用户名 [默认: ${ADMIN_USER}]:"
  read ADMIN_USER
  ADMIN_USER=${ADMIN_USER:-admin}

  prompt "管理员密码 [默认: ${ADMIN_PASS:-Admin@123456}]:"
  read ADMIN_PASS
  ADMIN_PASS=${ADMIN_PASS:-Admin@123456}

  # PM2 进程名
  prompt "PM2 进程名 [默认: ${PM2_NAME}]:"
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
    if [[ "$ACTION" == "update" ]]; then
      error "更新模式要求安装目录已存在且包含 Git 仓库：${INSTALL_DIR}"
    fi
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

# ── 仅构建并重启（用于更新） ───────────────────────────────
update_app() {
  step "构建生产版本"
  cd "$INSTALL_DIR"
  npm run build

  step "重启 PM2 进程"
  if command -v pm2 &>/dev/null; then
    pm2 restart "$PM2_NAME"
    info "已重启：${PM2_NAME}"
  else
    error "未找到 PM2"
  fi
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

  # 显式传入端口，避免 .env 中 PORT 未被读取
  PORT=$APP_PORT pm2 start npm --name "$PM2_NAME" -- start
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
  echo -e "    更新部署：  ${BLUE}cd ${INSTALL_DIR} && git pull origin main && npm run build && pm2 restart ${PM2_NAME}${NC}"
  echo -e "    一键卸载：  ${BLUE}bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/uninstall.sh)${NC}"
  echo ''
}

sync_db() {
  step "同步数据库结构"
  cd "$INSTALL_DIR"
  npm run db:push
}

show_status() {
  step "查看 PM2 状态"
  if command -v pm2 &>/dev/null; then
    pm2 list
    pm2 show "$PM2_NAME" 2>/dev/null || warn "未找到 PM2 进程：${PM2_NAME}"
  else
    error "未找到 PM2"
  fi
}

restart_pm2_only() {
  step "重启 PM2 进程"
  if command -v pm2 &>/dev/null; then
    pm2 restart "$PM2_NAME"
    info "已重启：${PM2_NAME}"
  else
    error "未找到 PM2"
  fi
}

stop_pm2_only() {
  step "停止 PM2 进程"
  if command -v pm2 &>/dev/null; then
    pm2 stop "$PM2_NAME" 2>/dev/null || warn "进程不存在或已停止"
    info "已停止：${PM2_NAME}"
  else
    error "未找到 PM2"
  fi
}

show_logs() {
  step "查看 PM2 日志"
  if command -v pm2 &>/dev/null; then
    pm2 logs "$PM2_NAME" --lines 120
  else
    error "未找到 PM2"
  fi
}

do_uninstall() {
  step "卸载博客主程序"

  prompt "PM2 进程名 [默认: ${PM2_NAME}]:"
  read PM2_INPUT || true
  PM2_NAME=${PM2_INPUT:-$PM2_NAME}

  prompt "项目安装目录 [默认: ${INSTALL_DIR}]:"
  read INSTALL_INPUT || true
  INSTALL_DIR=${INSTALL_INPUT:-$INSTALL_DIR}

  echo ''
  warn "即将执行以下操作："
  echo "  1. 停止并删除 PM2 进程：${PM2_NAME}"
  echo "  2. 删除项目目录：${INSTALL_DIR}"
  echo ''
  prompt "确认卸载？输入 YES 继续（其他任意键取消）:"
  read CONFIRM || true

  if [ "${CONFIRM:-}" != "YES" ]; then
    echo "已取消卸载。"
    exit 0
  fi

  if command -v pm2 &>/dev/null; then
    info "停止 PM2 进程：${PM2_NAME}"
    pm2 stop "$PM2_NAME" 2>/dev/null && echo "  已停止" || warn "进程不存在或已停止"
    pm2 delete "$PM2_NAME" 2>/dev/null && echo "  已删除" || warn "进程已不存在"
    pm2 save 2>/dev/null || true
  else
    warn "未找到 PM2，跳过"
  fi

  if [ -f "${INSTALL_DIR}/data/db.sqlite" ]; then
    BACKUP_PATH="/tmp/x-blog-db-backup-$(date +%Y%m%d%H%M%S).sqlite"
    prompt "检测到数据库文件，是否备份到 ${BACKUP_PATH}？(y/n) [默认: y]:"
    read DO_BACKUP || true
    DO_BACKUP=${DO_BACKUP:-y}
    if [[ "$DO_BACKUP" =~ ^[Yy]$ ]]; then
      cp "${INSTALL_DIR}/data/db.sqlite" "$BACKUP_PATH"
      info "数据库已备份到：${BACKUP_PATH}"
    fi
  fi

  info "删除项目目录：${INSTALL_DIR}"
  if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    echo "  已删除"
  else
    warn "目录不存在，跳过"
  fi

  echo ''
  echo -e "${GREEN}卸载完成${NC}"
  echo ''
  if [ -n "${BACKUP_PATH}" ] && [ -f "${BACKUP_PATH}" ]; then
    echo -e "  数据库备份：${CYAN}${BACKUP_PATH}${NC}"
  fi
  echo -e "  如需重新安装："
  echo -e "  ${CYAN}bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh)${NC}"
  echo ''
}

print_menu() {
  print_banner
  echo "请选择操作："
  echo "  1) install   安装到生产目录"
  echo "  2) update    升级生产目录"
  echo "  3) uninstall 卸载并删除目录"
  echo "  4) status    查看 PM2 状态"
  echo "  5) restart   重启 PM2 进程"
  echo "  6) stop      停止 PM2 进程"
  echo "  7) logs      查看 PM2 日志"
  echo ''
  prompt "请输入数字 [默认: 1]:"
  read MENU_CHOICE || true
  case "${MENU_CHOICE:-1}" in
    1) ACTION="install" ;;
    2) ACTION="update" ;;
    3) ACTION="uninstall" ;;
    4) ACTION="status" ;;
    5) ACTION="restart" ;;
    6) ACTION="stop" ;;
    7) ACTION="logs" ;;
    *) ACTION="install" ;;
  esac
}

# ── 主流程 ────────────────────────────────────────────────
main() {
  case "$ACTION" in
    menu)
      print_menu
      ;;
  esac

  case "$ACTION" in
    install)
      print_banner
      check_deps
      collect_config
      install_code
      setup_env
      build_app
      init_db
      start_pm2
      print_done
      ;;
    update)
      print_banner
      check_deps
      load_existing_config "$INSTALL_DIR/.env"
      collect_config
      install_code
      update_app
      print_done
      ;;
    uninstall)
      print_banner
      do_uninstall
      ;;
    status)
      print_banner
      show_status
      ;;
    restart)
      print_banner
      restart_pm2_only
      ;;
    stop)
      print_banner
      stop_pm2_only
      ;;
    logs)
      print_banner
      show_logs
      ;;
    *)
      error "未知操作：${ACTION}"
      ;;
  esac
}

main
