#!/usr/bin/env bash
set -e

echo "======================================================================"
echo "   臺南經發局工業區園區廠商水錶檢核系統 (本地主機版)"
echo "   柳科工業區 · 新吉工業區用水量與排放抄錶成果智慧檢核"
echo "======================================================================"
echo ""

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo "[錯誤] 找不到 Node.js 執行環境！"
    echo "請先前往官方網站安裝 Node.js (推薦 LTS 版本): https://nodejs.org/"
    exit 1
fi

echo "[1/3] 檢查 Node.js 版本: $(node -v)"

# 檢查 node_modules
if [ ! -d "node_modules" ]; then
    echo "[2/3] 首次執行，正在自動安裝必要套件..."
    npm install --omit=dev
else
    echo "[2/3] 相依套件已就緒。"
fi

echo "[3/3] 正在啟動伺服器: http://localhost:3000"
echo "如欲停止，請按下 Ctrl + C 終止程式。"
echo ""

# 嘗試在背景開啟瀏覽器
(sleep 2 && (xdg-open http://localhost:3000 2>/dev/null || open http://localhost:3000 2>/dev/null || true)) &

node server.mjs
