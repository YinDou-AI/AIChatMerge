@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   设置 Windows 计划任务
echo ========================================
echo.
echo 将创建一个计划任务:
echo   - 每天 10:00 运行选择器健康检查
echo   - 仅在 Chrome 开启时生效（通过 CDP 端口检测）
echo   - Chrome 未运行时自动跳过
echo.

:: 创建一个包装脚本，先检测 Chrome 是否可用
set SCRIPT_DIR=%~dp0
set CHECK_SCRIPT=%SCRIPT_DIR%run-if-chrome-open.bat

(
echo @echo off
echo :: 先检查 Chrome 调试端口是否可用
echo curl -s http://127.0.0.1:9222/json/version ^>nul 2^>^&1
echo if %%errorlevel%% neq 0 exit /b 0
echo.
echo :: Chrome 在线，运行检测
echo cd /d "%SCRIPT_DIR%"
echo node selector-healthcheck.js ^> "%SCRIPT_DIR%data\last-run.log" 2^>^&1
) > "%CHECK_SCRIPT%"

echo 已创建包装脚本: %CHECK_SCRIPT%
echo.

:: 创建计划任务
schtasks /create /tn "AIChatMerge-SelectorCheck" /tr "\"%CHECK_SCRIPT%\"" /sc daily /st 10:00 /f

if %errorlevel% equ 0 (
    echo ✅ 计划任务创建成功！
    echo.
    echo 任务名称: AIChatMerge-SelectorCheck
    echo 运行时间: 每天 10:00
    echo 逻辑: Chrome 开着就检测，没开就跳过
    echo.
    echo 手动测试:
    echo   1. 先运行 start-chrome.bat 启动 Chrome
    echo   2. 运行: cd healthcheck ^&^& node selector-healthcheck.js
    echo.
    echo 查看/删除任务:
    echo   schtasks /query /tn "AIChatMerge-SelectorCheck"
    echo   schtasks /delete /tn "AIChatMerge-SelectorCheck" /f
) else (
    echo ❌ 创建失败，请以管理员身份运行此脚本。
)

echo.
pause
