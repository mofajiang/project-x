#!/bin/bash
# ============================================================
#  X-Blog 一键卸载脚本
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

prompt() { echo -e -n "${CYAN}$1${NC} "; }
warn()   { echo -e "${YELLOW}[!] $1${NC}"; }
info()   { echo -e "${GREEN}[✓] $1${NC}"; }
error()  { echo -e "${RED}[✗] $1${NC}"; exit 1; }

echo -e "${RED}  ⚠  X-Blog 卸载脚本 - 此操作不可逆！${NC}"
echo ''

# ── 收集信息 ──────────────────────────────────────────────
prompt "PM2 进程名 [默认: x-blog]:"
read PM2_NAME
PM2_NAME=${PM2_NAME:-x-blog}

prompt "项目安装目录 [默认: /www/wwwroot/x-blog]:"
read INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-/www/wwwroot/x-blog}

prompt "域名（用于删除 Nginx 配置，留空跳过）:"
read DOMAIN

echo ''
warn "即将执行以下操作："
echo "  1. 停止并删除 PM2 进程：${PM2_NAME}"
echo "  2. 删除项目目录：${INSTALL_DIR}"
if [ -n "$DOMAIN" ]; then
echo "  3. 删除 Nginx 配置：/www/server/nginx/vhost/${DOMAIN}.conf"
fi
echo ''
prompt "确认卸载？输入 YES 继续（其他任意键取消）:"
read CONFIRM

if [ "$CONFIRM" != "YES" ]; then
  echo "已取消卸载。"
  exit 0
fi

# ── 停止 PM2 进程 ─────────────────────────────────────────
echo ''
info "停止 PM2 进程：${PM2_NAME}"
if command -v pm2 &>/dev/null; then
  pm2 stop "$PM2_NAME" 2>/dev/null && echo "  已停止" || warn "进程不存在或已停止"
  pm2 delete "$PM2_NAME" 2>/dev/null && echo "  已删除" || warn "进程已不存在"
  pm2 save 2>/dev/null || true
else
  warn "未找到 PM2，跳过"
fi

# ── 备份数据库（可选） ────────────────────────────────────
if [ -f "${INSTALL_DIR}/data/db.sqlite" ]; then
  BACKUP_PATH="/tmp/x-blog-db-backup-$(date +%Y%m%d%H%M%S).sqlite"
  prompt "检测到数据库文件，是否备份到 ${BACKUP_PATH}？(y/n) [默认: y]:"
  read DO_BACKUP
  DO_BACKUP=${DO_BACKUP:-y}
  if [[ "$DO_BACKUP" =~ ^[Yy]$ ]]; then
    cp "${INSTALL_DIR}/data/db.sqlite" "$BACKUP_PATH"
    info "数据库已备份到：${BACKUP_PATH}"
  fi
fi

# ── 删除项目目录 ──────────────────────────────────────────
info "删除项目目录：${INSTALL_DIR}"
if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  echo "  已删除"
else
  warn "目录不存在，跳过"
fi

# ── 删除 Nginx 配置 ───────────────────────────────────────
if [ -n "$DOMAIN" ]; then
  NGINX_CONF="/www/server/nginx/vhost/${DOMAIN}.conf"
  info "删除 Nginx 配置：${NGINX_CONF}"
  if [ -f "$NGINX_CONF" ]; then
    rm -f "$NGINX_CONF"
    echo "  已删除"
    if command -v nginx &>/dev/null; then
      nginx -t && nginx -s reload
      echo "  Nginx 已重载"
    fi
  else
    warn "配置文件不存在，跳过"
  fi
fi

# ── 完成 ──────────────────────────────────────────────────
echo ''
echo -e "${GREEN}卸载完成${NC}"
echo ''
if [ -n "$BACKUP_PATH" ] && [ -f "$BACKUP_PATH" ]; then
  echo -e "  数据库备份：${CYAN}${BACKUP_PATH}${NC}"
fi
echo -e "  如需重新安装："
echo -e "  ${CYAN}bash <(curl -fsSL https://raw.githubusercontent.com/mofajiang/project-x/main/scripts/install.sh)${NC}"
echo ''
