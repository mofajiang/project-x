#!/bin/bash
# 兼容包装：转发到统一管理脚本的卸载命令

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "$SCRIPT_DIR/install.sh" uninstall "$@"
