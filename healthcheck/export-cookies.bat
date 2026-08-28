@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   AIChatMerge Cookie 导出工具
echo ========================================
echo.
echo ⚠️  请先关闭谷歌浏览器！
echo.
pause

cd /d "%~dp0"
node export-cookies.js

echo.
echo 完成！按任意键退出...
pause >nul
