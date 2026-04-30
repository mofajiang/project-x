<<<<<<< Updated upstream
#!/usr/bin/env bash
# ============================================================
#  X-Blog 统一管理脚本 v2
#  用法: bash install.sh [install|update|uninstall|status|restart|stop|logs|menu]
#  支持宝塔面板 / 纯 Linux 环境
# ============================================================

set -euo pipefail

# ── 颜色 ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── 日志函数 ──────────────────────────────────────────────
print_banner() {
  echo -e "${CYAN}"
  echo '  ██╗  ██╗    ██████╗ ██╗      ██████╗  ██████╗ '
  echo '  ╚██╗██╔╝    ██╔══██╗██║     ██╔═══██╗██╔════╝ '
  echo '   ╚███╔╝     ██████╔╝██║     ██║   ██║██║  ███╗'
  echo '   ██╔██╗     ██╔══██╗██║     ██║   ██║██║   ██║'
  echo '  ██╔╝ ██╗    ██████╔╝███████╗╚██████╔╝╚██████╔╝'
  echo '  ╚═╝  ╚═╝    ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ '
  echo -e "${NC}"
  echo -e "${GREEN}${BOLD}  X 风格个人博客 - 一键管理脚本${NC}"
  echo -e "  ${BLUE}https://github.com/mofajiang/project-x${NC}"
  echo ''
}

step()  { echo -e "\n${GREEN}[✓] $1${NC}"; }
info()  { echo -e "  ${BLUE}[i] $1${NC}"; }
warn()  { echo -e "  ${YELLOW}[!] $1${NC}"; }
error() { echo -e "\n${RED}[✗] $1${NC}"; exit 1; }

prompt() {
  echo -e -n "  ${CYAN}${BOLD}$1${NC} "
}

# ── 解析动作参数 ──────────────────────────────────────────
ACTION="menu"
if [[ $# -gt 0 && "$1" != -* ]]; then
  case "$1" in
    install|update|uninstall|status|restart|stop|logs|menu)
      ACTION="$1"
      shift || true
      ;;
    *)
      echo -e "${RED}未知操作：$1${NC}"
      echo "用法: bash install.sh [install|update|uninstall|status|restart|stop|logs|menu]"
      exit 1
      ;;
  esac
fi

# ── 全局配置变量 ──────────────────────────────────────────
REPO_URL="https://github.com/mofajiang/project-x.git"
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

# ── 工具函数 ──────────────────────────────────────────────
read_env_value() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  grep -E "^${key}=" "$file" 2>/dev/null | tail -n1 | sed 's/^[^=]*=//;s/^"//;s/"$//'
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
  local existing_pm2
  existing_pm2="$(read_env_value "$env_file" PM2_NAME || true)"

  [[ -n "$existing_port" ]]    && APP_PORT="$existing_port"
  [[ -n "$existing_pm2" ]]     && PM2_NAME="$existing_pm2"

  if [[ -n "$existing_site_url" ]]; then
    SITE_URL="$existing_site_url"
    local extracted_domain
    extracted_domain="$(extract_domain_from_url "$existing_site_url" || true)"
    [[ -n "$extracted_domain" ]] && DOMAIN="$extracted_domain"
    [[ "$existing_site_url" == https://* ]] && USE_HTTPS="y" || USE_HTTPS="n"
  fi
}

gen_jwt_secret() {
  openssl rand -base64 48 2>/dev/null \
    || tr -dc 'A-Za-z0-9!@#$%^&*' < /dev/urandom | head -c 48
}

# ── 检查系统依赖 ──────────────────────────────────────────
check_deps() {
  step "检查系统依赖"

  if ! command -v node &>/dev/null; then
    error "未找到 Node.js，请先安装 Node.js 18+\n  宝塔面板：软件商店 → Node.js版本管理器\n  手动安装：https://nodejs.org"
  fi

  local node_ver
  node_ver=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
  [[ "$node_ver" -ge 18 ]] || error "Node.js 版本过低（当前 v${node_ver}），需要 18+"
  info "Node.js $(node -v) ✓"

  if ! command -v git &>/dev/null; then
    error "未找到 git，请先安装：\n  Ubuntu/Debian: apt install git\n  CentOS/RHEL:   yum install git"
  fi
  info "Git $(git --version | awk '{print $3}') ✓"

  if ! command -v pm2 &>/dev/null; then
    warn "未找到 PM2，正在全局安装..."
    npm install -g pm2 --silent || error "PM2 安装失败，请手动执行：npm install -g pm2"
    info "PM2 $(pm2 -v) 安装完成 ✓"
  else
    info "PM2 $(pm2 -v) ✓"
  fi
}

# ── 交互式安装配置 ────────────────────────────────────────
collect_config() {
  step "配置安装参数"
  echo -e "  ${YELLOW}（直接回车使用括号内默认值）${NC}\n"

  # 安装目录
  prompt "安装目录 [${INSTALL_DIR}]:"
  read -r input_dir || true
  INSTALL_DIR="${input_dir:-$INSTALL_DIR}"

  # 域名
  prompt "站点域名（留空则用 localhost）[${DOMAIN}]:"
  read -r input_domain || true
  DOMAIN="${input_domain:-$DOMAIN}"

  # 端口
  prompt "监听端口 [${APP_PORT}]:"
  read -r input_port || true
  APP_PORT="${input_port:-$APP_PORT}"
  # 验证端口是否为数字
  [[ "$APP_PORT" =~ ^[0-9]+$ ]] || error "端口必须为数字：${APP_PORT}"

  # HTTPS
  if [[ "$DOMAIN" == "localhost" ]]; then
    SITE_URL="http://localhost:${APP_PORT}"
  else
    prompt "是否使用 HTTPS？(y/n) [${USE_HTTPS}]:"
    read -r input_https || true
    USE_HTTPS="${input_https:-$USE_HTTPS}"
    if [[ "$USE_HTTPS" =~ ^[Yy]$ ]]; then
      SITE_URL="https://${DOMAIN}"
    else
      SITE_URL="http://${DOMAIN}"
    fi
  fi

  # JWT 密钥
  prompt "JWT 密钥（留空自动生成）:"
  read -r input_jwt || true
  if [[ -z "$input_jwt" ]]; then
    JWT_SECRET="$(gen_jwt_secret)"
    info "已自动生成安全 JWT 密钥"
  else
    JWT_SECRET="$input_jwt"
  fi

  # 管理员账号
  prompt "管理员用户名 [${ADMIN_USER}]:"
  read -r input_user || true
  ADMIN_USER="${input_user:-$ADMIN_USER}"

  local default_pass="${ADMIN_PASS:-Admin@123456}"
  prompt "管理员密码 [${default_pass}]:"
  read -r input_pass || true
  ADMIN_PASS="${input_pass:-$default_pass}"

  # PM2 进程名
  prompt "PM2 进程名 [${PM2_NAME}]:"
  read -r input_pm2 || true
  PM2_NAME="${input_pm2:-$PM2_NAME}"

  # 确认
  echo ''
  echo -e "${YELLOW}  ────────────────────────────────────────${NC}"
  echo -e "  安装目录：  ${GREEN}${INSTALL_DIR}${NC}"
  echo -e "  站点 URL：  ${GREEN}${SITE_URL}${NC}"
  echo -e "  监听端口：  ${GREEN}${APP_PORT}${NC}"
  echo -e "  PM2 进程名：${GREEN}${PM2_NAME}${NC}"
  echo -e "  管理员：    ${GREEN}${ADMIN_USER}${NC}"
  echo -e "${YELLOW}  ────────────────────────────────────────${NC}"
  echo ''
  prompt "确认以上配置并开始安装？(y/N):"
  read -r confirm || true
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "已取消安装。"
    exit 0
  fi
}

# ── 拉取代码 ──────────────────────────────────────────────
install_code() {
  step "下载项目代码"

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    warn "目录已存在 Git 仓库，执行 git pull 更新..."
    cd "$INSTALL_DIR"
    git pull origin main
  else
    [[ "$ACTION" == "update" ]] && error "更新模式要求目录已存在 Git 仓库：${INSTALL_DIR}"
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi
}

# ── 写入 .env ─────────────────────────────────────────────
setup_env() {
  step "生成 .env 配置文件"

  local db_path="${INSTALL_DIR}/data/db.sqlite"
  mkdir -p "${INSTALL_DIR}/data"

  # 保留已存在的 SMTP / STORAGE 配置
  local existing_env="${INSTALL_DIR}/.env"
  local smtp_block="" storage_block=""
  if [[ -f "$existing_env" ]]; then
    smtp_block="$(grep -E '^SMTP_' "$existing_env" 2>/dev/null | sed 's/^//' || true)"
    storage_block="$(grep -E '^STORAGE_' "$existing_env" 2>/dev/null | sed 's/^//' || true)"
  fi

  cat > "${INSTALL_DIR}/.env" <<EOF
# ── 数据库 ────────────────────────────────────────────────
DATABASE_URL="file:${db_path}"

# ── 认证 ──────────────────────────────────────────────────
JWT_SECRET="${JWT_SECRET}"
SESSION_SECRET="${JWT_SECRET}"

# ── 站点 ──────────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL="${SITE_URL}"
PORT=${APP_PORT}
EOF

  if [[ -n "$smtp_block" ]]; then
    echo '' >> "${INSTALL_DIR}/.env"
    echo '# ── 邮件（保留原配置）────────────────────────────────────' >> "${INSTALL_DIR}/.env"
    echo "$smtp_block" >> "${INSTALL_DIR}/.env"
  fi

  if [[ -n "$storage_block" ]]; then
    echo '' >> "${INSTALL_DIR}/.env"
    echo '# ── 存储（保留原配置）────────────────────────────────────' >> "${INSTALL_DIR}/.env"
    echo "$storage_block" >> "${INSTALL_DIR}/.env"
  fi

  info ".env 已写入 ${INSTALL_DIR}/.env"
}

# ── 安装依赖并构建 ────────────────────────────────────────
build_app() {
  cd "$INSTALL_DIR"

  step "安装 npm 依赖"
  npm install --production=false

  step "构建生产版本"
  npm run build
}

# ── 备份数据库 ────────────────────────────────────────────
backup_db() {
  local db_file="${INSTALL_DIR}/data/db.sqlite"
  if [[ -f "$db_file" ]]; then
    local backup_file="${INSTALL_DIR}/data/db.sqlite.bak.$(date +%Y%m%d_%H%M%S)"
    cp "$db_file" "$backup_file"
    info "数据库已备份：${backup_file}"
  fi
}

# ── 同步数据库 Schema ─────────────────────────────────────
sync_db_schema() {
	cd "$INSTALL_DIR"
	step "同步数据库结构"
	if npm run db:push; then
		info "数据库结构已同步"
	else
		warn "db:push 失败，可能存在数据冲突"
		echo -e -n " ${CYAN}${BOLD}是否允许数据丢失重新同步？(y/N): ${NC}"
		read -r confirm_loss || true
		if [[ "${confirm_loss}" =~ ^[Yy]$ ]]; then
			npm run db:push -- --accept-data-loss
			info "数据库结构已同步（允许数据丢失）"
		else
			error "数据库结构同步已取消"
		fi
	fi
}

# ── 更新流程（不含交互式配置） ────────────────────────────
update_app() {
  build_app
  backup_db
  sync_db_schema

  step "重启 PM2 进程"
  if command -v pm2 &>/dev/null; then
    if pm2 describe "$PM2_NAME" &>/dev/null; then
      pm2 restart "$PM2_NAME"
    else
      PORT=$APP_PORT pm2 start npm --name "$PM2_NAME" -- start
    fi
    pm2 save
    info "已重启：${PM2_NAME}"
  else
    error "未找到 PM2"
  fi
}

# ── 初始化数据库和管理员 ──────────────────────────────────
init_db() {
  cd "$INSTALL_DIR"

  step "初始化数据库"
  npm run db:push

  step "创建管理员账号"
	ADMIN_USERNAME="$ADMIN_USER" ADMIN_PASSWORD="$ADMIN_PASS" npx tsx scripts/init-admin.ts \
    || warn "管理员账号创建失败（账号可能已存在），请手动执行：npx tsx scripts/init-admin.ts"
}

# ── 启动 PM2 ──────────────────────────────────────────────
start_pm2() {
  step "启动 PM2 进程"
  cd "$INSTALL_DIR"

  # 删除同名旧进程
  pm2 delete "$PM2_NAME" 2>/dev/null || true

  PORT=$APP_PORT pm2 start npm --name "$PM2_NAME" -- start
  pm2 save

  # 设置开机自启（忽略非 root 环境报错）
  if pm2 startup 2>/dev/null | grep -q 'sudo'; then
    pm2 startup 2>/dev/null | grep 'sudo' | bash 2>/dev/null || \
      warn "开机自启设置失败，请手动执行：pm2 startup && pm2 save"
  fi

  info "PM2 进程已启动"
  pm2 show "$PM2_NAME"
}

# ── 生成 Nginx 配置 ───────────────────────────────────────
generate_nginx() {
  [[ "$DOMAIN" == "localhost" ]] && return 0

  step "生成 Nginx 反向代理配置"

  local nginx_conf
  if [[ -d "/www/server/nginx/vhost" ]]; then
    nginx_conf="/www/server/nginx/vhost/${DOMAIN}.conf"
  else
    nginx_conf="/tmp/x-blog-nginx-${DOMAIN}.conf"
    warn "未检测到宝塔环境，Nginx 配置已输出到：${nginx_conf}"
    warn "请手动将内容复制到你的 Nginx vhost 配置中"
  fi

  cat > "$nginx_conf" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    location / {
        proxy_pass          http://127.0.0.1:${APP_PORT};
        proxy_set_header    Host              \$host;
        proxy_set_header    X-Real-IP         \$remote_addr;
        proxy_set_header    X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto \$scheme;
        proxy_http_version  1.1;
        proxy_set_header    Upgrade           \$http_upgrade;
        proxy_set_header    Connection        "upgrade";
        proxy_read_timeout  300;
        proxy_connect_timeout 300;
    }

    # 禁止访问敏感目录
    location ~* ^/(\.git|\.env|node_modules|\.next)(/|$) {
        return 404;
    }

    location ~ \.well-known { allow all; }

    access_log  /www/wwwlogs/${DOMAIN}.log;
    error_log   /www/wwwlogs/${DOMAIN}.error.log;
}
NGINX

  info "Nginx 配置已写入：${nginx_conf}"

  if command -v nginx &>/dev/null; then
    if nginx -t 2>/dev/null; then
      nginx -s reload && info "Nginx 已重载"
    else
      warn "Nginx 配置语法检查失败，请手动执行：nginx -t && nginx -s reload"
    fi
  fi
}

# ── 安装完成提示 ──────────────────────────────────────────
print_done() {
  local admin_path="${SITE_URL}/admin-login"

  echo ''
  echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║       🎉  安装完成！                      ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
  echo ''
  echo -e "  站点 URL：  ${CYAN}${SITE_URL}${NC}"
  echo -e "  管理后台：  ${CYAN}${admin_path}${NC}"
  echo -e "  管理员：    ${CYAN}${ADMIN_USER}${NC}"
  echo -e "  安装目录：  ${CYAN}${INSTALL_DIR}${NC}"
  echo -e "  监听端口：  ${CYAN}${APP_PORT}${NC}"
  echo ''
  echo -e "${YELLOW}  ⚠  首次登录后请立即修改登录路径和管理员密码！${NC}"
  echo ''

  if [[ "$DOMAIN" != "localhost" ]]; then
    echo -e "${YELLOW}  ⚠  Nginx 反向代理配置已生成，如未自动加载请手动配置。${NC}"
    echo -e "     确保包含：${BLUE}proxy_set_header X-Forwarded-Proto \$scheme;${NC}"
    echo ''
  fi

  echo -e "  ${BOLD}常用命令：${NC}"
  echo -e "    查看状态：  ${BLUE}pm2 list${NC}"
  echo -e "    查看日志：  ${BLUE}pm2 logs ${PM2_NAME}${NC}"
  echo -e "    重启服务：  ${BLUE}pm2 restart ${PM2_NAME}${NC}"
  echo -e "    一键升级：  ${BLUE}bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh) update${NC}"
  echo -e "    一键卸载：  ${BLUE}bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/uninstall.sh)${NC}"
  echo ''
}

# ── 运维操作 ──────────────────────────────────────────────
show_status() {
  step "PM2 进程状态"
  if command -v pm2 &>/dev/null; then
    pm2 list
    pm2 show "$PM2_NAME" 2>/dev/null || warn "未找到进程：${PM2_NAME}"
  else
    error "未找到 PM2"
  fi
}

restart_pm2_only() {
  step "重启 PM2 进程：${PM2_NAME}"
  command -v pm2 &>/dev/null || error "未找到 PM2"
  pm2 restart "$PM2_NAME" || error "进程 ${PM2_NAME} 不存在，请先安装"
  info "已重启：${PM2_NAME}"
}

stop_pm2_only() {
  step "停止 PM2 进程：${PM2_NAME}"
  command -v pm2 &>/dev/null || error "未找到 PM2"
  pm2 stop "$PM2_NAME" 2>/dev/null || warn "进程不存在或已停止"
  info "已停止：${PM2_NAME}"
}

show_logs() {
  step "PM2 日志（最近 120 行，Ctrl+C 退出）"
  command -v pm2 &>/dev/null || error "未找到 PM2"
  pm2 logs "$PM2_NAME" --lines 120
}

# ── 卸载 ──────────────────────────────────────────────────
do_uninstall() {
  step "卸载 X-Blog"

  prompt "PM2 进程名 [${PM2_NAME}]:"
  read -r input_pm2 || true
  PM2_NAME="${input_pm2:-$PM2_NAME}"

  prompt "项目安装目录 [${INSTALL_DIR}]:"
  read -r input_dir || true
  INSTALL_DIR="${input_dir:-$INSTALL_DIR}"

  echo ''
  echo -e "  ${YELLOW}即将执行以下操作：${NC}"
  echo -e "    1. 停止并删除 PM2 进程：${RED}${PM2_NAME}${NC}"
  echo -e "    2. 删除项目目录：${RED}${INSTALL_DIR}${NC}"
  echo ''
  prompt "确认卸载？输入 ${RED}YES${NC} 继续（其他任意键取消）:"
  read -r confirm || true

  [[ "${confirm:-}" == "YES" ]] || { echo "已取消卸载。"; exit 0; }

  # 停止并删除 PM2 进程
  if command -v pm2 &>/dev/null; then
    pm2 stop   "$PM2_NAME" 2>/dev/null && info "PM2 进程已停止" || warn "进程不存在或已停止"
    pm2 delete "$PM2_NAME" 2>/dev/null && info "PM2 进程已删除" || true
    pm2 save 2>/dev/null || true
  else
    warn "未找到 PM2，跳过进程清理"
  fi

  # 备份数据库
  local db_file="${INSTALL_DIR}/data/db.sqlite"
  if [[ -f "$db_file" ]]; then
    BACKUP_PATH="/tmp/x-blog-db-$(date +%Y%m%d_%H%M%S).sqlite"
    prompt "检测到数据库，是否备份到 ${BACKUP_PATH}？(Y/n):"
    read -r do_backup || true
    do_backup="${do_backup:-y}"
    if [[ "$do_backup" =~ ^[Yy]$ ]]; then
      cp "$db_file" "$BACKUP_PATH"
      info "数据库已备份：${BACKUP_PATH}"
    fi
  fi

  # 删除目录
  if [[ -d "$INSTALL_DIR" ]]; then
    rm -rf "$INSTALL_DIR"
    info "目录已删除：${INSTALL_DIR}"
  else
    warn "目录不存在，跳过：${INSTALL_DIR}"
  fi

  echo ''
  echo -e "${GREEN}卸载完成${NC}"
  [[ -n "${BACKUP_PATH:-}" && -f "${BACKUP_PATH:-/nonexistent}" ]] && \
    echo -e "  数据库备份：${CYAN}${BACKUP_PATH}${NC}"
  echo ''
  echo -e "  如需重新安装："
  echo -e "  ${CYAN}bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh)${NC}"
  echo ''
}

# ── 操作菜单 ──────────────────────────────────────────────
print_menu() {
  print_banner
  echo -e "  请选择操作："
  echo ''
  echo -e "    ${GREEN}1)${NC} install   全新安装"
  echo -e "    ${GREEN}2)${NC} update    升级（拉取代码+构建+数据库迁移+重启）"
  echo -e "    ${GREEN}3)${NC} uninstall 卸载并删除目录"
  echo -e "    ${BLUE}4)${NC} status    查看 PM2 状态"
  echo -e "    ${BLUE}5)${NC} restart   重启 PM2 进程"
  echo -e "    ${BLUE}6)${NC} stop      停止 PM2 进程"
  echo -e "    ${BLUE}7)${NC} logs      查看 PM2 日志"
  echo ''
  prompt "请输入数字 [默认: 1]:"
  read -r choice || true
  case "${choice:-1}" in
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
  # 菜单模式先选择再执行
  if [[ "$ACTION" == "menu" ]]; then
    print_menu
  fi

  case "$ACTION" in
    # ──────────── 全新安装 ─────────────────────────────
    install)
      print_banner
      check_deps
      collect_config
      install_code
      setup_env
      build_app
      init_db
      start_pm2
      generate_nginx
      print_done
      ;;

    # ──────────── 升级更新 ─────────────────────────────
    update)
      print_banner
      check_deps

      prompt "项目安装目录 [${INSTALL_DIR}]:"
      read -r input_dir || true
      INSTALL_DIR="${input_dir:-$INSTALL_DIR}"

      [[ -d "$INSTALL_DIR/.git" ]] || \
        error "目录 ${INSTALL_DIR} 不存在或不是 Git 仓库，请使用 install 命令"

      load_existing_config "${INSTALL_DIR}/.env"

      prompt "PM2 进程名 [${PM2_NAME}]:"
      read -r input_pm2 || true
      PM2_NAME="${input_pm2:-$PM2_NAME}"

      step "拉取最新代码"
      cd "$INSTALL_DIR"
      git pull origin main

      update_app

      echo ''
      echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
      echo -e "${GREEN}║       🎉  升级完成！                      ║${NC}"
      echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
      echo ''
      echo -e "  站点 URL：  ${CYAN}${SITE_URL:-（读取自 .env）}${NC}"
      echo -e "  PM2 进程："
      pm2 show "$PM2_NAME" 2>/dev/null | grep -E 'name|status|restarts|uptime' || \
        pm2 list
      echo ''
      ;;

    # ──────────── 卸载 ─────────────────────────────────
    uninstall)
      print_banner
      do_uninstall
      ;;

    # ──────────── 运维操作 ─────────────────────────────
    status)
      print_banner

      prompt "PM2 进程名 [${PM2_NAME}]:"
      read -r input_pm2 || true
      PM2_NAME="${input_pm2:-$PM2_NAME}"

      show_status
      ;;
    restart)
      print_banner

      prompt "PM2 进程名 [${PM2_NAME}]:"
      read -r input_pm2 || true
      PM2_NAME="${input_pm2:-$PM2_NAME}"

      restart_pm2_only
      ;;
    stop)
      print_banner

      prompt "PM2 进程名 [${PM2_NAME}]:"
      read -r input_pm2 || true
      PM2_NAME="${input_pm2:-$PM2_NAME}"

      stop_pm2_only
      ;;
    logs)
      print_banner

      prompt "PM2 进程名 [${PM2_NAME}]:"
      read -r input_pm2 || true
      PM2_NAME="${input_pm2:-$PM2_NAME}"

      show_logs
      ;;

    *)
      error "未知操作：${ACTION}"
      ;;
  esac
}

main
=======
#!/usr/bin/env bash
# ============================================================
#  X-Blog 统一管理脚本 v2
#  用法: bash install.sh [install|update|uninstall|status|restart|stop|logs|menu]
#  支持宝塔面板 / 纯 Linux 环境
# ============================================================

set -euo pipefail

# ── 颜色 ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── 日志函数 ──────────────────────────────────────────────
print_banner() {
  echo -e "${CYAN}"
  echo '  ██╗  ██╗    ██████╗ ██╗      ██████╗  ██████╗ '
  echo '  ╚██╗██╔╝    ██╔══██╗██║     ██╔═══██╗██╔════╝ '
  echo '   ╚███╔╝     ██████╔╝██║     ██║   ██║██║  ███╗'
  echo '   ██╔██╗     ██╔══██╗██║     ██║   ██║██║   ██║'
  echo '  ██╔╝ ██╗    ██████╔╝███████╗╚██████╔╝╚██████╔╝'
  echo '  ╚═╝  ╚═╝    ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ '
  echo -e "${NC}"
  echo -e "${GREEN}${BOLD}  X 风格个人博客 - 一键管理脚本${NC}"
  echo -e "  ${BLUE}https://github.com/mofajiang/project-x${NC}"
  echo ''
}

step()  { echo -e "\n${GREEN}[✓] $1${NC}"; }
info()  { echo -e "  ${BLUE}[i] $1${NC}"; }
warn()  { echo -e "  ${YELLOW}[!] $1${NC}"; }
error() { echo -e "\n${RED}[✗] $1${NC}"; exit 1; }

prompt() {
  echo -e -n "  ${CYAN}${BOLD}$1${NC} "
}

# ── 解析动作参数 ──────────────────────────────────────────
ACTION="menu"
if [[ $# -gt 0 && "$1" != -* ]]; then
  case "$1" in
    install|update|uninstall|status|restart|stop|logs|menu)
      ACTION="$1"
      shift || true
      ;;
    *)
      echo -e "${RED}未知操作：$1${NC}"
      echo "用法: bash install.sh [install|update|uninstall|status|restart|stop|logs|menu]"
      exit 1
      ;;
  esac
fi

# ── 全局配置变量 ──────────────────────────────────────────
REPO_URL="https://github.com/mofajiang/project-x.git"
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

# ── 工具函数 ──────────────────────────────────────────────
read_env_value() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  grep -E "^${key}=" "$file" 2>/dev/null | tail -n1 | sed 's/^[^=]*=//;s/^"//;s/"$//'
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
  local existing_pm2
  existing_pm2="$(read_env_value "$env_file" PM2_NAME || true)"

  [[ -n "$existing_port" ]]    && APP_PORT="$existing_port"
  [[ -n "$existing_pm2" ]]     && PM2_NAME="$existing_pm2"

  if [[ -n "$existing_site_url" ]]; then
    SITE_URL="$existing_site_url"
    local extracted_domain
    extracted_domain="$(extract_domain_from_url "$existing_site_url" || true)"
    [[ -n "$extracted_domain" ]] && DOMAIN="$extracted_domain"
    [[ "$existing_site_url" == https://* ]] && USE_HTTPS="y" || USE_HTTPS="n"
  fi
}

gen_jwt_secret() {
  openssl rand -base64 48 2>/dev/null \
    || tr -dc 'A-Za-z0-9!@#$%^&*' < /dev/urandom | head -c 48
}

# ── 检查系统依赖 ──────────────────────────────────────────
check_deps() {
  step "检查系统依赖"

  if ! command -v node &>/dev/null; then
    error "未找到 Node.js，请先安装 Node.js 18+\n  宝塔面板：软件商店 → Node.js版本管理器\n  手动安装：https://nodejs.org"
  fi

  local node_ver
  node_ver=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
  [[ "$node_ver" -ge 18 ]] || error "Node.js 版本过低（当前 v${node_ver}），需要 18+"
  info "Node.js $(node -v) ✓"

  if ! command -v git &>/dev/null; then
    error "未找到 git，请先安装：\n  Ubuntu/Debian: apt install git\n  CentOS/RHEL:   yum install git"
  fi
  info "Git $(git --version | awk '{print $3}') ✓"

  if ! command -v pm2 &>/dev/null; then
    warn "未找到 PM2，正在全局安装..."
    npm install -g pm2 --silent || error "PM2 安装失败，请手动执行：npm install -g pm2"
    info "PM2 $(pm2 -v) 安装完成 ✓"
  else
    info "PM2 $(pm2 -v) ✓"
  fi
}

# ── 交互式安装配置 ────────────────────────────────────────
collect_config() {
  step "配置安装参数"
  echo -e "  ${YELLOW}（直接回车使用括号内默认值）${NC}\n"

  # 安装目录
  prompt "安装目录 [${INSTALL_DIR}]:"
  read -r input_dir || true
  INSTALL_DIR="${input_dir:-$INSTALL_DIR}"

  # 域名
  prompt "站点域名（留空则用 localhost）[${DOMAIN}]:"
  read -r input_domain || true
  DOMAIN="${input_domain:-$DOMAIN}"

  # 端口
  prompt "监听端口 [${APP_PORT}]:"
  read -r input_port || true
  APP_PORT="${input_port:-$APP_PORT}"
  # 验证端口是否为数字
  [[ "$APP_PORT" =~ ^[0-9]+$ ]] || error "端口必须为数字：${APP_PORT}"

  # HTTPS
  if [[ "$DOMAIN" == "localhost" ]]; then
    SITE_URL="http://localhost:${APP_PORT}"
  else
    prompt "是否使用 HTTPS？(y/n) [${USE_HTTPS}]:"
    read -r input_https || true
    USE_HTTPS="${input_https:-$USE_HTTPS}"
    if [[ "$USE_HTTPS" =~ ^[Yy]$ ]]; then
      SITE_URL="https://${DOMAIN}"
    else
      SITE_URL="http://${DOMAIN}"
    fi
  fi

  # JWT 密钥
  prompt "JWT 密钥（留空自动生成）:"
  read -r input_jwt || true
  if [[ -z "$input_jwt" ]]; then
    JWT_SECRET="$(gen_jwt_secret)"
    info "已自动生成安全 JWT 密钥"
  else
    JWT_SECRET="$input_jwt"
  fi

  # 管理员账号
  prompt "管理员用户名 [${ADMIN_USER}]:"
  read -r input_user || true
  ADMIN_USER="${input_user:-$ADMIN_USER}"

  local default_pass="${ADMIN_PASS:-Admin@123456}"
  prompt "管理员密码 [${default_pass}]:"
  read -r input_pass || true
  ADMIN_PASS="${input_pass:-$default_pass}"

  # PM2 进程名
  prompt "PM2 进程名 [${PM2_NAME}]:"
  read -r input_pm2 || true
  PM2_NAME="${input_pm2:-$PM2_NAME}"

  # 确认
  echo ''
  echo -e "${YELLOW}  ────────────────────────────────────────${NC}"
  echo -e "  安装目录：  ${GREEN}${INSTALL_DIR}${NC}"
  echo -e "  站点 URL：  ${GREEN}${SITE_URL}${NC}"
  echo -e "  监听端口：  ${GREEN}${APP_PORT}${NC}"
  echo -e "  PM2 进程名：${GREEN}${PM2_NAME}${NC}"
  echo -e "  管理员：    ${GREEN}${ADMIN_USER}${NC}"
  echo -e "${YELLOW}  ────────────────────────────────────────${NC}"
  echo ''
  prompt "确认以上配置并开始安装？(y/N):"
  read -r confirm || true
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "已取消安装。"
    exit 0
  fi
}

# ── 拉取代码 ──────────────────────────────────────────────
install_code() {
  step "下载项目代码"

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    warn "目录已存在 Git 仓库，执行 git pull 更新..."
    cd "$INSTALL_DIR"
    git pull origin main
  else
    [[ "$ACTION" == "update" ]] && error "更新模式要求目录已存在 Git 仓库：${INSTALL_DIR}"
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi
}

# ── 写入 .env ─────────────────────────────────────────────
setup_env() {
  step "生成 .env 配置文件"

  local db_path="${INSTALL_DIR}/data/db.sqlite"
  mkdir -p "${INSTALL_DIR}/data"

  # 保留已存在的 SMTP / STORAGE 配置
  local existing_env="${INSTALL_DIR}/.env"
  local smtp_block="" storage_block=""
  if [[ -f "$existing_env" ]]; then
    smtp_block="$(grep -E '^SMTP_' "$existing_env" 2>/dev/null | sed 's/^//' || true)"
    storage_block="$(grep -E '^STORAGE_' "$existing_env" 2>/dev/null | sed 's/^//' || true)"
  fi

  cat > "${INSTALL_DIR}/.env" <<EOF
# ── 数据库 ────────────────────────────────────────────────
DATABASE_URL="file:${db_path}"

# ── 认证 ──────────────────────────────────────────────────
JWT_SECRET="${JWT_SECRET}"
SESSION_SECRET="${JWT_SECRET}"

# ── 站点 ──────────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL="${SITE_URL}"
PORT=${APP_PORT}
EOF

  if [[ -n "$smtp_block" ]]; then
    echo '' >> "${INSTALL_DIR}/.env"
    echo '# ── 邮件（保留原配置）────────────────────────────────────' >> "${INSTALL_DIR}/.env"
    echo "$smtp_block" >> "${INSTALL_DIR}/.env"
  fi

  if [[ -n "$storage_block" ]]; then
    echo '' >> "${INSTALL_DIR}/.env"
    echo '# ── 存储（保留原配置）────────────────────────────────────' >> "${INSTALL_DIR}/.env"
    echo "$storage_block" >> "${INSTALL_DIR}/.env"
  fi

  info ".env 已写入 ${INSTALL_DIR}/.env"
}

# ── 安装依赖并构建 ────────────────────────────────────────
build_app() {
  cd "$INSTALL_DIR"

  step "安装 npm 依赖"
  npm install --production=false

  step "构建生产版本"
  npm run build
}

# ── 备份数据库 ────────────────────────────────────────────
backup_db() {
  local db_file="${INSTALL_DIR}/data/db.sqlite"
  if [[ -f "$db_file" ]]; then
    local backup_file="${INSTALL_DIR}/data/db.sqlite.bak.$(date +%Y%m%d_%H%M%S)"
    cp "$db_file" "$backup_file"
    info "数据库已备份：${backup_file}"
  fi
}

# ── 同步数据库 Schema ─────────────────────────────────────
sync_db_schema() {
  cd "$INSTALL_DIR"
  step "同步数据库结构（新增字段）"
  npm run db:push -- --accept-data-loss
  info "数据库结构已同步"
}

# ── 更新流程（不含交互式配置） ────────────────────────────
update_app() {
  build_app
  backup_db
  sync_db_schema

  step "重启 PM2 进程"
  if command -v pm2 &>/dev/null; then
    if pm2 describe "$PM2_NAME" &>/dev/null; then
      pm2 restart "$PM2_NAME"
    else
      PORT=$APP_PORT pm2 start npm --name "$PM2_NAME" -- start
    fi
    pm2 save
    info "已重启：${PM2_NAME}"
  else
    error "未找到 PM2"
  fi
}

# ── 初始化数据库和管理员 ──────────────────────────────────
init_db() {
  cd "$INSTALL_DIR"

  step "初始化数据库"
  npm run db:push

  step "创建管理员账号"
  ADMIN_USER="$ADMIN_USER" ADMIN_PASS="$ADMIN_PASS" npx tsx scripts/init-admin.ts \
    || warn "管理员账号创建失败（账号可能已存在），请手动执行：npx tsx scripts/init-admin.ts"
}

# ── 启动 PM2 ──────────────────────────────────────────────
start_pm2() {
  step "启动 PM2 进程"
  cd "$INSTALL_DIR"

  # 删除同名旧进程
  pm2 delete "$PM2_NAME" 2>/dev/null || true

  PORT=$APP_PORT pm2 start npm --name "$PM2_NAME" -- start
  pm2 save

  # 设置开机自启（忽略非 root 环境报错）
  if pm2 startup 2>/dev/null | grep -q 'sudo'; then
    pm2 startup 2>/dev/null | grep 'sudo' | bash 2>/dev/null || \
      warn "开机自启设置失败，请手动执行：pm2 startup && pm2 save"
  fi

  info "PM2 进程已启动"
  pm2 show "$PM2_NAME"
}

# ── 生成 Nginx 配置 ───────────────────────────────────────
generate_nginx() {
  [[ "$DOMAIN" == "localhost" ]] && return 0

  step "生成 Nginx 反向代理配置"

  local nginx_conf
  if [[ -d "/www/server/nginx/vhost" ]]; then
    nginx_conf="/www/server/nginx/vhost/${DOMAIN}.conf"
  else
    nginx_conf="/tmp/x-blog-nginx-${DOMAIN}.conf"
    warn "未检测到宝塔环境，Nginx 配置已输出到：${nginx_conf}"
    warn "请手动将内容复制到你的 Nginx vhost 配置中"
  fi

  cat > "$nginx_conf" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    location / {
        proxy_pass          http://127.0.0.1:${APP_PORT};
        proxy_set_header    Host              \$host;
        proxy_set_header    X-Real-IP         \$remote_addr;
        proxy_set_header    X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto \$scheme;
        proxy_http_version  1.1;
        proxy_set_header    Upgrade           \$http_upgrade;
        proxy_set_header    Connection        "upgrade";
        proxy_read_timeout  300;
        proxy_connect_timeout 300;
    }

    # 禁止访问敏感目录
    location ~* ^/(\.git|\.env|node_modules|\.next)(/|$) {
        return 404;
    }

    location ~ \.well-known { allow all; }

    access_log  /www/wwwlogs/${DOMAIN}.log;
    error_log   /www/wwwlogs/${DOMAIN}.error.log;
}
NGINX

  info "Nginx 配置已写入：${nginx_conf}"

  if command -v nginx &>/dev/null; then
    if nginx -t 2>/dev/null; then
      nginx -s reload && info "Nginx 已重载"
    else
      warn "Nginx 配置语法检查失败，请手动执行：nginx -t && nginx -s reload"
    fi
  fi
}

# ── 安装完成提示 ──────────────────────────────────────────
print_done() {
  local admin_path="${SITE_URL}/admin-login"

  echo ''
  echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║       🎉  安装完成！                      ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
  echo ''
  echo -e "  站点 URL：  ${CYAN}${SITE_URL}${NC}"
  echo -e "  管理后台：  ${CYAN}${admin_path}${NC}"
  echo -e "  管理员：    ${CYAN}${ADMIN_USER}${NC}"
  echo -e "  安装目录：  ${CYAN}${INSTALL_DIR}${NC}"
  echo -e "  监听端口：  ${CYAN}${APP_PORT}${NC}"
  echo ''
  echo -e "${YELLOW}  ⚠  首次登录后请立即修改登录路径和管理员密码！${NC}"
  echo ''

  if [[ "$DOMAIN" != "localhost" ]]; then
    echo -e "${YELLOW}  ⚠  Nginx 反向代理配置已生成，如未自动加载请手动配置。${NC}"
    echo -e "     确保包含：${BLUE}proxy_set_header X-Forwarded-Proto \$scheme;${NC}"
    echo ''
  fi

  echo -e "  ${BOLD}常用命令：${NC}"
  echo -e "    查看状态：  ${BLUE}pm2 list${NC}"
  echo -e "    查看日志：  ${BLUE}pm2 logs ${PM2_NAME}${NC}"
  echo -e "    重启服务：  ${BLUE}pm2 restart ${PM2_NAME}${NC}"
  echo -e "    一键升级：  ${BLUE}bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh) update${NC}"
  echo -e "    一键卸载：  ${BLUE}bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/uninstall.sh)${NC}"
  echo ''
}

# ── 运维操作 ──────────────────────────────────────────────
show_status() {
  step "PM2 进程状态"
  if command -v pm2 &>/dev/null; then
    pm2 list
    pm2 show "$PM2_NAME" 2>/dev/null || warn "未找到进程：${PM2_NAME}"
  else
    error "未找到 PM2"
  fi
}

restart_pm2_only() {
  step "重启 PM2 进程：${PM2_NAME}"
  command -v pm2 &>/dev/null || error "未找到 PM2"
  pm2 restart "$PM2_NAME" || error "进程 ${PM2_NAME} 不存在，请先安装"
  info "已重启：${PM2_NAME}"
}

stop_pm2_only() {
  step "停止 PM2 进程：${PM2_NAME}"
  command -v pm2 &>/dev/null || error "未找到 PM2"
  pm2 stop "$PM2_NAME" 2>/dev/null || warn "进程不存在或已停止"
  info "已停止：${PM2_NAME}"
}

show_logs() {
  step "PM2 日志（最近 120 行，Ctrl+C 退出）"
  command -v pm2 &>/dev/null || error "未找到 PM2"
  pm2 logs "$PM2_NAME" --lines 120
}

# ── 卸载 ──────────────────────────────────────────────────
do_uninstall() {
  step "卸载 X-Blog"

  prompt "PM2 进程名 [${PM2_NAME}]:"
  read -r input_pm2 || true
  PM2_NAME="${input_pm2:-$PM2_NAME}"

  prompt "项目安装目录 [${INSTALL_DIR}]:"
  read -r input_dir || true
  INSTALL_DIR="${input_dir:-$INSTALL_DIR}"

  echo ''
  echo -e "  ${YELLOW}即将执行以下操作：${NC}"
  echo -e "    1. 停止并删除 PM2 进程：${RED}${PM2_NAME}${NC}"
  echo -e "    2. 删除项目目录：${RED}${INSTALL_DIR}${NC}"
  echo ''
  prompt "确认卸载？输入 ${RED}YES${NC} 继续（其他任意键取消）:"
  read -r confirm || true

  [[ "${confirm:-}" == "YES" ]] || { echo "已取消卸载。"; exit 0; }

  # 停止并删除 PM2 进程
  if command -v pm2 &>/dev/null; then
    pm2 stop   "$PM2_NAME" 2>/dev/null && info "PM2 进程已停止" || warn "进程不存在或已停止"
    pm2 delete "$PM2_NAME" 2>/dev/null && info "PM2 进程已删除" || true
    pm2 save 2>/dev/null || true
  else
    warn "未找到 PM2，跳过进程清理"
  fi

  # 备份数据库
  local db_file="${INSTALL_DIR}/data/db.sqlite"
  if [[ -f "$db_file" ]]; then
    BACKUP_PATH="/tmp/x-blog-db-$(date +%Y%m%d_%H%M%S).sqlite"
    prompt "检测到数据库，是否备份到 ${BACKUP_PATH}？(Y/n):"
    read -r do_backup || true
    do_backup="${do_backup:-y}"
    if [[ "$do_backup" =~ ^[Yy]$ ]]; then
      cp "$db_file" "$BACKUP_PATH"
      info "数据库已备份：${BACKUP_PATH}"
    fi
  fi

  # 删除目录
  if [[ -d "$INSTALL_DIR" ]]; then
    rm -rf "$INSTALL_DIR"
    info "目录已删除：${INSTALL_DIR}"
  else
    warn "目录不存在，跳过：${INSTALL_DIR}"
  fi

  echo ''
  echo -e "${GREEN}卸载完成${NC}"
  [[ -n "${BACKUP_PATH:-}" && -f "${BACKUP_PATH:-/nonexistent}" ]] && \
    echo -e "  数据库备份：${CYAN}${BACKUP_PATH}${NC}"
  echo ''
  echo -e "  如需重新安装："
  echo -e "  ${CYAN}bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh)${NC}"
  echo ''
}

# ── 操作菜单 ──────────────────────────────────────────────
print_menu() {
  print_banner
  echo -e "  请选择操作："
  echo ''
  echo -e "    ${GREEN}1)${NC} install   全新安装"
  echo -e "    ${GREEN}2)${NC} update    升级（拉取代码+构建+数据库迁移+重启）"
  echo -e "    ${GREEN}3)${NC} uninstall 卸载并删除目录"
  echo -e "    ${BLUE}4)${NC} status    查看 PM2 状态"
  echo -e "    ${BLUE}5)${NC} restart   重启 PM2 进程"
  echo -e "    ${BLUE}6)${NC} stop      停止 PM2 进程"
  echo -e "    ${BLUE}7)${NC} logs      查看 PM2 日志"
  echo ''
  prompt "请输入数字 [默认: 1]:"
  read -r choice || true
  case "${choice:-1}" in
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
  # 菜单模式先选择再执行
  if [[ "$ACTION" == "menu" ]]; then
    print_menu
  fi

  case "$ACTION" in
    # ──────────── 全新安装 ─────────────────────────────
    install)
      print_banner
      check_deps
      collect_config
      install_code
      setup_env
      build_app
      init_db
      start_pm2
      generate_nginx
      print_done
      ;;

    # ──────────── 升级更新 ─────────────────────────────
    update)
      print_banner
      check_deps

      prompt "项目安装目录 [${INSTALL_DIR}]:"
      read -r input_dir || true
      INSTALL_DIR="${input_dir:-$INSTALL_DIR}"

      [[ -d "$INSTALL_DIR/.git" ]] || \
        error "目录 ${INSTALL_DIR} 不存在或不是 Git 仓库，请使用 install 命令"

      load_existing_config "${INSTALL_DIR}/.env"

      prompt "PM2 进程名 [${PM2_NAME}]:"
      read -r input_pm2 || true
      PM2_NAME="${input_pm2:-$PM2_NAME}"

      step "拉取最新代码"
      cd "$INSTALL_DIR"
      git pull origin main

      update_app

      echo ''
      echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
      echo -e "${GREEN}║       🎉  升级完成！                      ║${NC}"
      echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
      echo ''
      echo -e "  站点 URL：  ${CYAN}${SITE_URL:-（读取自 .env）}${NC}"
      echo -e "  PM2 进程："
      pm2 show "$PM2_NAME" 2>/dev/null | grep -E 'name|status|restarts|uptime' || \
        pm2 list
      echo ''
      ;;

    # ──────────── 卸载 ─────────────────────────────────
    uninstall)
      print_banner
      do_uninstall
      ;;

    # ──────────── 运维操作 ─────────────────────────────
    status)
      print_banner

      prompt "PM2 进程名 [${PM2_NAME}]:"
      read -r input_pm2 || true
      PM2_NAME="${input_pm2:-$PM2_NAME}"

      show_status
      ;;
    restart)
      print_banner

      prompt "PM2 进程名 [${PM2_NAME}]:"
      read -r input_pm2 || true
      PM2_NAME="${input_pm2:-$PM2_NAME}"

      restart_pm2_only
      ;;
    stop)
      print_banner

      prompt "PM2 进程名 [${PM2_NAME}]:"
      read -r input_pm2 || true
      PM2_NAME="${input_pm2:-$PM2_NAME}"

      stop_pm2_only
      ;;
    logs)
      print_banner

      prompt "PM2 进程名 [${PM2_NAME}]:"
      read -r input_pm2 || true
      PM2_NAME="${input_pm2:-$PM2_NAME}"

      show_logs
      ;;

    *)
      error "未知操作：${ACTION}"
      ;;
  esac
}

main
>>>>>>> Stashed changes
