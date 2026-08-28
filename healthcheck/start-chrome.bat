@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   启动 Chrome (带调试端口 9222)
echo ========================================
echo.
echo 如果 Chrome 已打开，请先关闭它。
echo 此脚本会启动一个带远程调试功能的 Chrome。
echo 你正常使用浏览器即可，健康检查脚本会通过
echo 调试端口连接到你的 Chrome 来检测选择器。
echo.

:: 检查 Chrome 是否已在运行 (端口 9222)
curl -s http://127.0.0.1:9222/json/version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Chrome 调试端口已开启，无需重复启动。
    echo    直接运行: node selector-healthcheck.js
    pause
    exit /b
)

:: 启动 Chrome
set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME_PATH% (
    set CHROME_PATH="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

echo 正在启动 Chrome...
start "" %CHROME_PATH% --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\Google\Chrome\User Data" --profile-directory="Default"

echo.
echo Chrome 已启动。等待调试端口就绪...
timeout /t 3 /nobreak >nul

curl -s http://127.0.0.1:9222/json/version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ 调试端口就绪！
    echo.
    echo 现在可以运行:
    echo   cd healthcheck
    echo   node selector-healthcheck.js
) else (
    echo ⚠️  端口未就绪，请确认 Chrome 已正常启动。
    echo    如果 Chrome 打开了但端口不可用，可能有其他 Chrome 实例在运行。
    echo    请关闭所有 Chrome 窗口后重试。
)

echo.
pause
