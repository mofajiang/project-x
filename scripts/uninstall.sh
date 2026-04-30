<<<<<<< Updated upstream
#!/usr/bin/env bash
# ============================================================
#  X-Blog 独立卸载脚本
#  用法: bash uninstall.sh [--pm2 <name>] [--dir <path>] [--yes]
#  --pm2 <name>  PM2 进程名（默认 x-blog）
#  --dir <path>  项目目录（默认 /www/wwwroot/x-blog）
#  --yes         跳过确认（非交互式环境）
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "  ${BLUE}[i] $1${NC}"; }
warn()  { echo -e "  ${YELLOW}[!] $1${NC}"; }
error() { echo -e "\n${RED}[✗] $1${NC}"; exit 1; }
step()  { echo -e "\n${GREEN}[✓] $1${NC}"; }

# ── 参数解析 ──────────────────────────────────────────────
PM2_NAME="x-blog"
INSTALL_DIR="/www/wwwroot/x-blog"
AUTO_YES=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pm2)  PM2_NAME="$2";    shift 2 ;;
    --dir)  INSTALL_DIR="$2"; shift 2 ;;
    --yes)  AUTO_YES=true;    shift   ;;
    -h|--help)
      echo "用法: bash uninstall.sh [--pm2 <name>] [--dir <path>] [--yes]"
      exit 0
      ;;
    *) echo "未知参数：$1"; exit 1 ;;
  esac
done

# ── 尝试从 .env 读取默认值 ────────────────────────────────
read_env_value() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  grep -E "^${key}=" "$file" 2>/dev/null | tail -n1 | sed 's/^[^=]*=//;s/^"//;s/"$//'
}

ENV_FILE="${INSTALL_DIR}/.env"
if [[ -f "$ENV_FILE" ]]; then
  existing_port="$(read_env_value "$ENV_FILE" PORT || true)"
  [[ -n "${existing_port:-}" ]] && info "从 .env 读取到端口：${existing_port}"
fi

# ── Banner ────────────────────────────────────────────────
echo -e "${CYAN}"
echo '  ██╗  ██╗    ██████╗ ██╗      ██████╗  ██████╗ '
echo '  ╚██╗██╔╝    ██╔══██╗██║     ██╔═══██╗██╔════╝ '
echo '   ╚███╔╝     ██████╔╝██║     ██║   ██║██║  ███╗'
echo '   ██╔██╗     ██╔══██╗██║     ██║   ██║██║   ██║'
echo '  ██╔╝ ██╗    ██████╔╝███████╗╚██████╔╝╚██████╔╝'
echo '  ╚═╝  ╚═╝    ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ '
echo -e "${NC}"
echo -e "${RED}${BOLD}  X-Blog 卸载脚本${NC}"
echo ''

# ── 交互式确认（非 --yes 模式） ───────────────────────────
if [[ "$AUTO_YES" == false ]]; then
  # PM2 进程名
  echo -e -n "  ${CYAN}${BOLD}PM2 进程名 [${PM2_NAME}]: ${NC}"
  read -r input_pm2 || true
  PM2_NAME="${input_pm2:-$PM2_NAME}"

  # 安装目录
  echo -e -n "  ${CYAN}${BOLD}项目安装目录 [${INSTALL_DIR}]: ${NC}"
  read -r input_dir || true
  INSTALL_DIR="${input_dir:-$INSTALL_DIR}"

  echo ''
  echo -e "  ${YELLOW}即将执行以下操作：${NC}"
  echo -e "    1. 停止并删除 PM2 进程：${RED}${PM2_NAME}${NC}"
  echo -e "    2. 删除项目目录：${RED}${INSTALL_DIR}${NC}"
  echo ''
  echo -e -n "  ${CYAN}${BOLD}确认卸载？输入 ${RED}YES${CYAN} 继续（其他任意键取消）: ${NC}"
  read -r confirm || true

  [[ "${confirm:-}" == "YES" ]] || { echo "已取消卸载。"; exit 0; }
fi

BACKUP_PATH=""

# ── 步骤 1：停止并删除 PM2 进程 ───────────────────────────
step "停止 PM2 进程"
if command -v pm2 &>/dev/null; then
  if pm2 describe "$PM2_NAME" &>/dev/null; then
    pm2 stop   "$PM2_NAME" 2>/dev/null && info "进程已停止：${PM2_NAME}" || warn "停止失败，可能已停止"
    pm2 delete "$PM2_NAME" 2>/dev/null && info "进程已删除：${PM2_NAME}" || warn "删除失败"
    pm2 save 2>/dev/null || true
  else
    warn "未找到 PM2 进程：${PM2_NAME}，跳过"
  fi
else
  warn "未安装 PM2，跳过进程清理"
fi

# ── 步骤 2：可选备份数据库 ────────────────────────────────
step "检查数据库"
DB_FILE="${INSTALL_DIR}/data/db.sqlite"

if [[ -f "$DB_FILE" ]]; then
	BACKUP_PATH="$HOME/x-blog-db-backup-$(date +%Y%m%d_%H%M%S).sqlite"

  if [[ "$AUTO_YES" == true ]]; then
    # 非交互模式：自动备份
    cp "$DB_FILE" "$BACKUP_PATH"
    info "数据库已自动备份：${BACKUP_PATH}"
  else
    echo -e -n "  ${CYAN}${BOLD}检测到数据库，是否备份到 ${BACKUP_PATH}？(Y/n): ${NC}"
    read -r do_backup || true
    do_backup="${do_backup:-y}"
    if [[ "$do_backup" =~ ^[Yy]$ ]]; then
      cp "$DB_FILE" "$BACKUP_PATH"
      info "数据库已备份：${BACKUP_PATH}"
    else
      BACKUP_PATH=""
      warn "已跳过数据库备份，数据将随目录一起删除"
    fi
  fi
else
  info "未找到数据库文件，跳过备份"
fi

# ── 步骤 3：删除项目目录 ──────────────────────────────────
step "删除项目目录"
if [[ -d "$INSTALL_DIR" ]]; then
  rm -rf "$INSTALL_DIR"
  info "目录已删除：${INSTALL_DIR}"
else
  warn "目录不存在，跳过：${INSTALL_DIR}"
fi

# ── 完成 ──────────────────────────────────────────────────
echo ''
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       ✅  卸载完成！                      ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ''

[[ -n "${BACKUP_PATH:-}" && -f "${BACKUP_PATH:-/nonexistent}" ]] && \
  echo -e "  数据库备份：${CYAN}${BACKUP_PATH}${NC}"

echo ''
echo -e "  如需重新安装："
echo -e "  ${CYAN}bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh)${NC}"
echo ''
=======
#!/usr/bin/env bash
# ============================================================
#  X-Blog 独立卸载脚本
#  用法: bash uninstall.sh [--pm2 <name>] [--dir <path>] [--yes]
#  --pm2 <name>  PM2 进程名（默认 x-blog）
#  --dir <path>  项目目录（默认 /www/wwwroot/x-blog）
#  --yes         跳过确认（非交互式环境）
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "  ${BLUE}[i] $1${NC}"; }
warn()  { echo -e "  ${YELLOW}[!] $1${NC}"; }
error() { echo -e "\n${RED}[✗] $1${NC}"; exit 1; }
step()  { echo -e "\n${GREEN}[✓] $1${NC}"; }

# ── 参数解析 ──────────────────────────────────────────────
PM2_NAME="x-blog"
INSTALL_DIR="/www/wwwroot/x-blog"
AUTO_YES=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pm2)  PM2_NAME="$2";    shift 2 ;;
    --dir)  INSTALL_DIR="$2"; shift 2 ;;
    --yes)  AUTO_YES=true;    shift   ;;
    -h|--help)
      echo "用法: bash uninstall.sh [--pm2 <name>] [--dir <path>] [--yes]"
      exit 0
      ;;
    *) echo "未知参数：$1"; exit 1 ;;
  esac
done

# ── 尝试从 .env 读取默认值 ────────────────────────────────
read_env_value() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  grep -E "^${key}=" "$file" 2>/dev/null | tail -n1 | sed 's/^[^=]*=//;s/^"//;s/"$//'
}

ENV_FILE="${INSTALL_DIR}/.env"
if [[ -f "$ENV_FILE" ]]; then
  existing_port="$(read_env_value "$ENV_FILE" PORT || true)"
  [[ -n "${existing_port:-}" ]] && info "从 .env 读取到端口：${existing_port}"
fi

# ── Banner ────────────────────────────────────────────────
echo -e "${CYAN}"
echo '  ██╗  ██╗    ██████╗ ██╗      ██████╗  ██████╗ '
echo '  ╚██╗██╔╝    ██╔══██╗██║     ██╔═══██╗██╔════╝ '
echo '   ╚███╔╝     ██████╔╝██║     ██║   ██║██║  ███╗'
echo '   ██╔██╗     ██╔══██╗██║     ██║   ██║██║   ██║'
echo '  ██╔╝ ██╗    ██████╔╝███████╗╚██████╔╝╚██████╔╝'
echo '  ╚═╝  ╚═╝    ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ '
echo -e "${NC}"
echo -e "${RED}${BOLD}  X-Blog 卸载脚本${NC}"
echo ''

# ── 交互式确认（非 --yes 模式） ───────────────────────────
if [[ "$AUTO_YES" == false ]]; then
  # PM2 进程名
  echo -e -n "  ${CYAN}${BOLD}PM2 进程名 [${PM2_NAME}]: ${NC}"
  read -r input_pm2 || true
  PM2_NAME="${input_pm2:-$PM2_NAME}"

  # 安装目录
  echo -e -n "  ${CYAN}${BOLD}项目安装目录 [${INSTALL_DIR}]: ${NC}"
  read -r input_dir || true
  INSTALL_DIR="${input_dir:-$INSTALL_DIR}"

  echo ''
  echo -e "  ${YELLOW}即将执行以下操作：${NC}"
  echo -e "    1. 停止并删除 PM2 进程：${RED}${PM2_NAME}${NC}"
  echo -e "    2. 删除项目目录：${RED}${INSTALL_DIR}${NC}"
  echo ''
  echo -e -n "  ${CYAN}${BOLD}确认卸载？输入 ${RED}YES${CYAN} 继续（其他任意键取消）: ${NC}"
  read -r confirm || true

  [[ "${confirm:-}" == "YES" ]] || { echo "已取消卸载。"; exit 0; }
fi

BACKUP_PATH=""

# ── 步骤 1：停止并删除 PM2 进程 ───────────────────────────
step "停止 PM2 进程"
if command -v pm2 &>/dev/null; then
  if pm2 describe "$PM2_NAME" &>/dev/null; then
    pm2 stop   "$PM2_NAME" 2>/dev/null && info "进程已停止：${PM2_NAME}" || warn "停止失败，可能已停止"
    pm2 delete "$PM2_NAME" 2>/dev/null && info "进程已删除：${PM2_NAME}" || warn "删除失败"
    pm2 save 2>/dev/null || true
  else
    warn "未找到 PM2 进程：${PM2_NAME}，跳过"
  fi
else
  warn "未安装 PM2，跳过进程清理"
fi

# ── 步骤 2：可选备份数据库 ────────────────────────────────
step "检查数据库"
DB_FILE="${INSTALL_DIR}/data/db.sqlite"

if [[ -f "$DB_FILE" ]]; then
  BACKUP_PATH="/tmp/x-blog-db-$(date +%Y%m%d_%H%M%S).sqlite"

  if [[ "$AUTO_YES" == true ]]; then
    # 非交互模式：自动备份
    cp "$DB_FILE" "$BACKUP_PATH"
    info "数据库已自动备份：${BACKUP_PATH}"
  else
    echo -e -n "  ${CYAN}${BOLD}检测到数据库，是否备份到 ${BACKUP_PATH}？(Y/n): ${NC}"
    read -r do_backup || true
    do_backup="${do_backup:-y}"
    if [[ "$do_backup" =~ ^[Yy]$ ]]; then
      cp "$DB_FILE" "$BACKUP_PATH"
      info "数据库已备份：${BACKUP_PATH}"
    else
      BACKUP_PATH=""
      warn "已跳过数据库备份，数据将随目录一起删除"
    fi
  fi
else
  info "未找到数据库文件，跳过备份"
fi

# ── 步骤 3：删除项目目录 ──────────────────────────────────
step "删除项目目录"
if [[ -d "$INSTALL_DIR" ]]; then
  rm -rf "$INSTALL_DIR"
  info "目录已删除：${INSTALL_DIR}"
else
  warn "目录不存在，跳过：${INSTALL_DIR}"
fi

# ── 完成 ──────────────────────────────────────────────────
echo ''
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       ✅  卸载完成！                      ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ''

[[ -n "${BACKUP_PATH:-}" && -f "${BACKUP_PATH:-/nonexistent}" ]] && \
  echo -e "  数据库备份：${CYAN}${BACKUP_PATH}${NC}"

echo ''
echo -e "  如需重新安装："
echo -e "  ${CYAN}bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh)${NC}"
echo ''
>>>>>>> Stashed changes
