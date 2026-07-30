@echo off
setlocal

echo.
echo ========================================
echo   Start Chrome with debug port 9222
echo ========================================
echo.
echo Close all existing Chrome windows before using this script.
echo The selector healthcheck connects to this Chrome session.
echo.

curl -s http://127.0.0.1:9222/json/version >nul 2>&1
if not errorlevel 1 (
    echo Chrome debug port 9222 is already available.
    echo Run the healthcheck from the project directory with:
    echo   node healthcheck\selector-healthcheck.js --provider wenxin
    echo.
    pause
    exit /b 0
)

set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_PATH%" (
    set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

if not exist "%CHROME_PATH%" (
    echo Chrome executable was not found.
    echo Install Chrome or update CHROME_PATH in this file.
    echo.
    pause
    exit /b 1
)

echo Starting Chrome...
start "" "%CHROME_PATH%" --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\Google\Chrome\User Data" --profile-directory="Default"

echo Waiting for debug port 9222...
timeout /t 3 /nobreak >nul

curl -s http://127.0.0.1:9222/json/version >nul 2>&1
if not errorlevel 1 (
    echo Chrome debug port 9222 is ready.
    echo Run:
    echo   node healthcheck\selector-healthcheck.js --provider wenxin
) else (
    echo Chrome opened, but debug port 9222 is unavailable.
    echo Close every Chrome process and run this script again.
)

echo.
pause
endlocal
