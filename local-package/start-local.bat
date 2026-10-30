@echo off
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

REM 稍候 1.5 秒後在預設瀏覽器開啟網址
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

REM 啟動 Node.js 伺服器
node server.mjs

pause
