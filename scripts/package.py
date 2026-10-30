import os
import shutil
import zipfile
import subprocess

def main():
    print("=== 開始打包本地主機執行檔 ===")
    
    # 0. 先清除先前產生的 ZIP，避免 Vite build 將其當成 public 靜態資產複製進 dist 造成遞迴打包
    old_zip = os.path.join("public", "tainan-sewage-system-local.zip")
    if os.path.exists(old_zip):
        os.remove(old_zip)

    # 1. 執行 vite build
    print("1. 正在編譯前端資源 (vite build)...")
    subprocess.run(["npm", "run", "build"], check=True)
    
    # 2. 準備打包暫存目錄
    pkg_dir = "local-package"
    if os.path.exists(pkg_dir):
        shutil.rmtree(pkg_dir)
    os.makedirs(pkg_dir, exist_ok=True)

    # 3. 正在使用 esbuild 編譯 server.ts 為 server.mjs 並直接放入打包目錄
    print("2. 正在打包後端伺服器 (esbuild server.ts -> local-package/server.mjs)...")
    server_target = os.path.join(pkg_dir, "server.mjs")
    subprocess.run([
        "npx", "esbuild", "server.ts",
        "--bundle",
        "--platform=node",
        "--format=esm",
        "--packages=external",
        f"--outfile={server_target}"
    ], check=True)
    
    # 複製 dist 前端資產目錄到打包資料夾 (排除任何 zip 檔案)
    shutil.copytree("dist", os.path.join(pkg_dir, "dist"), ignore=shutil.ignore_patterns("*.zip"))
    
    # 寫入乾淨精簡的 package.json
    local_pkg_json = """{
  "name": "tainan-sewage-audit-system-local",
  "version": "1.0.0",
  "description": "臺南經發局工業區園區廠商水錶檢核系統 (本地主機獨立執行版)",
  "type": "module",
  "main": "server.mjs",
  "scripts": {
    "start": "node server.mjs"
  },
  "dependencies": {
    "express": "^4.21.2"
  }
}
"""
    with open(os.path.join(pkg_dir, "package.json"), "w", encoding="utf-8") as f:
        f.write(local_pkg_json)
        
    # 寫入 Windows 一鍵啟動批次檔 start-local.bat
    bat_content = """@echo off
chcp 65001 >nul
title 臺南經發局工業區園區廠商水錶檢核系統 - 本地啟動服務
cls
echo ======================================================================
echo    臺南經發局工業區園區廠商水錶檢核系統 (本地主機版)
echo    柳科工業區 · 新吉工業區用水量與排放抄錶成果智慧檢核
echo ======================================================================
echo.

REM 檢查是否安裝 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [錯誤] 找不到 Node.js 執行環境！
    echo 請先前往官網安裝 Node.js (推薦 LTS 版本): https://nodejs.org/
    echo 安裝完成後，請重新執行此檔案。
    echo.
    pause
    exit /b 1
)

echo [1/3] 檢查 Node.js 版本...
node -v

REM 檢查 node_modules 是否存在，若無則自動安裝
if not exist "node_modules" (
    echo [2/3] 首次執行，正在自動安裝必要相依套件 (只需執行一次)...
    call npm install --omit=dev
    if %errorlevel% neq 0 (
        echo [錯誤] 套件安裝失敗，請確認網路連線。
        pause
        exit /b 1
    )
) else (
    echo [2/3] 相依套件已具備。
)

echo [3/3] 正在啟動本地 Web 伺服器...
echo 系統即將在預設瀏覽器中開啟: http://localhost:3000
echo 若欲關閉系統，請直接關閉此命令提示字元視窗。
echo.

REM 稍候 2 秒後在預設瀏覽器開啟網址
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

REM 啟動 Node.js 伺服器
node server.mjs

pause
"""
    with open(os.path.join(pkg_dir, "start-local.bat"), "w", encoding="utf-8") as f:
        f.write(bat_content)
        
    # 寫入 macOS / Linux 一鍵啟動腳本 start-local.sh
    sh_content = """#!/usr/bin/env bash
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
"""
    with open(os.path.join(pkg_dir, "start-local.sh"), "w", encoding="utf-8") as f:
        f.write(sh_content)
    os.chmod(os.path.join(pkg_dir, "start-local.sh"), 0o755)

    # 寫入說明文件 README-本地執行說明.md
    readme_content = """# 臺南經發局工業區園區廠商水錶檢核系統 - 本地主機執行指南

歡迎使用「臺南經發局工業區園區廠商水錶檢核系統」本地獨立執行版。此版本已將前端靜態頁面、互動圖表、樣式與後端 API 代理整合為隨附套裝，可在任何已安裝 Node.js 的個人電腦或本機伺服器中離線/獨立運作。

---

## 快速啟動步驟

### 📋 系統基本需求
- **作業系統**：Windows 10/11、macOS 或 Linux
- **執行環境**：[Node.js](https://nodejs.org/)（建議 LTS 18.x 或 20.x 以上版本）

---

### 💻 Windows 使用者（最簡便）
1. 解壓縮此 ZIP 壓縮包至您的電腦資料夾（例如 `C:\\tainan-sewage-system`）。
2. 對著 **`start-local.bat`** 按下滑鼠右鍵選擇「開啟」或直接雙擊執行。
3. 程式將自動檢查環境、安裝必要套件，並自動為您在瀏覽器開啟 **`http://localhost:3000`**！

---

### 🍎 macOS / Linux 使用者
1. 解壓縮此 ZIP 檔案至目標資料夾。
2. 開啟終端機（Terminal），切換至該資料夾：
   ```bash
   cd /path/to/extracted-folder
   chmod +x start-local.sh
   ./start-local.sh
   ```
3. 終端機將自動啟動服務並為您開啟瀏覽器訪問 **`http://localhost:3000`**。

---

### 🛠️ 手動指令啟動方式
如果您習慣透過命令列操作：
```bash
# 1. 安裝伺服器相依套件 (僅首次需要)
npm install

# 2. 啟動伺服器
npm start
# 或直接執行:
node server.mjs
```
啟動後打開瀏覽器訪問：**http://localhost:3000**

---

## 系統核心功能與優勢
1. **即時批次爬蟲代理**：包含後端 Express API 代理，避開瀏覽器 CORS 限制，可直接連線臺南市工業區業務管理平臺。
2. **圖形驗證碼支援**：支援官方圖形驗證碼取得、帳號登入與 Bearer Token 憑證驗證。
3. **每日明細 Excel 匯出**：X 軸包含工業區、廠商名稱、水錶名稱、前 12 個月日均量、每日污水量、異常初判狀態、異常原因、累積量與污自比。
4. **無用水無排水判定**：自來水與污水量皆為 0 自動判定為正常。
"""
    with open(os.path.join(pkg_dir, "README-本地執行說明.md"), "w", encoding="utf-8") as f:
        f.write(readme_content)

    # 4. 打包為 ZIP 檔案至 public 目錄，不污染根目錄
    os.makedirs("public", exist_ok=True)
    zip_target = os.path.join("public", "tainan-sewage-system-local.zip")
    print(f"4. 正在封裝為獨立 ZIP 壓縮包 ({zip_target})...")
    with zipfile.ZipFile(zip_target, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(pkg_dir):
            for file in files:
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, pkg_dir)
                zipf.write(abs_path, rel_path)

    # 5. 清理暫存目錄
    shutil.rmtree(pkg_dir)
    print("5. 已自動清除暫存打包目錄。")
    
    file_size_kb = os.path.getsize(zip_target) / 1024
    print(f"🎉 打包完成！獨立本地安裝包已就緒: {zip_target} ({file_size_kb:.1f} KB)")

if __name__ == "__main__":
    main()
