# 桌面 AI 热点小组件实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 每天自动搜索热门 AI 工具/技巧，生成 HTML 小组件文件，配合 Rainmeter 显示在桌面右上角

**架构：** Python 脚本定时运行 → 搜索 AI 热点 → 生成 HTML → Rainmeter WebParser 读取 HTML 显示在桌面

**技术栈：** Python 3、requests、BeautifulSoup、Rainmeter

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `scripts/ai-discovery.py` | 每日 AI 热点搜索脚本 |
| `scripts/widget.html` | 生成的小组件 HTML（脚本输出） |
| `scripts/install-rainmeter.bat` | Rainmeter 安装和配置脚本 |
| `rainmeter/AIDiscovery/AIDiscovery.ini` | Rainmeter 皮肤配置 |

---

### 任务 1：创建 AI 热点搜索脚本

**文件：**
- 创建：`D:\D\cc\panelize-enhanced\scripts\ai-discovery.py`

- [ ] **步骤 1：创建脚本目录**

```bash
mkdir -p D:/D/cc/panelize-enhanced/scripts
```

- [ ] **步骤 2：编写 AI 热点搜索脚本**

```python
#!/usr/bin/env python3
"""
AI 热点每日发现脚本
搜索 Product Hunt、GitHub Trending、Hacker News 等来源的 AI 工具
输出到 widget.html 供 Rainmeter 显示
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

# 搜索来源配置
SOURCES = [
    {
        "name": "Product Hunt",
        "query": "AI tools site:producthunt.com",
        "icon": "PH"
    },
    {
        "name": "GitHub",
        "query": "trending AI projects site:github.com",
        "icon": "GH"
    },
    {
        "name": "Hacker News",
        "query": "AI tools site:news.ycombinator.com",
        "icon": "HN"
    },
    {
        "name": "少数派",
        "query": "AI 工具 site:sspai.com",
        "icon": "SS"
    },
    {
        "name": "V2EX",
        "query": "AI 工具 site:v2ex.com",
        "icon": "V2"
    }
]

OUTPUT_DIR = Path(__file__).parent
OUTPUT_FILE = OUTPUT_DIR / "widget.html"


def generate_html(items):
    """生成小组件 HTML"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    items_html = ""
    for item in items[:8]:  # 最多显示 8 条
        items_html += f"""
        <div class="item">
            <span class="tag">{item['source']}</span>
            <a href="{item['url']}" target="_blank">{item['title']}</a>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    width: 380px;
    font-family: -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif;
    background: rgba(255,255,255,0.95);
    border-radius: 12px;
    padding: 16px;
    color: #2c3e50;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  }}
  .header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid #e8e8e8;
  }}
  .header h2 {{
    font-size: 16px;
    color: #1a1a2e;
  }}
  .header .time {{
    font-size: 11px;
    color: #999;
  }}
  .item {{
    margin-bottom: 10px;
    padding: 8px;
    background: #f8f9fa;
    border-radius: 6px;
    border-left: 3px solid #3498db;
  }}
  .item a {{
    color: #2c3e50;
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    display: block;
    margin-top: 4px;
  }}
  .item a:hover {{ color: #3498db; }}
  .tag {{
    display: inline-block;
    background: #eaf2fd;
    color: #2980b9;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    font-weight: 600;
  }}
  .footer {{
    text-align: center;
    font-size: 10px;
    color: #bbb;
    margin-top: 8px;
  }}
</style>
</head>
<body>
  <div class="header">
    <h2>AI 热点发现</h2>
    <span class="time">{now}</span>
  </div>
  {items_html}
  <div class="footer">每日自动更新 | Panelize Enhanced</div>
</body>
</html>"""

    return html


def search_web(query):
    """
    搜索网页（使用 requests + 简单解析）
    实际部署时可替换为更好的搜索 API
    """
    try:
        import requests
        from urllib.parse import quote_plus

        # 使用 DuckDuckGo 搜索（无需 API key）
        url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0"
        }
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()

        # 简单解析结果
        results = []
        from html.parser import HTMLParser

        class DDGParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.in_result = False
                self.in_link = False
                self.current = {}
                self.results = []

            def handle_starttag(self, tag, attrs):
                attrs_dict = dict(attrs)
                if tag == "a" and "result__a" in attrs_dict.get("class", ""):
                    self.in_link = True
                    self.current = {"url": attrs_dict.get("href", ""), "title": ""}

            def handle_data(self, data):
                if self.in_link:
                    self.current["title"] += data.strip()

            def handle_endtag(self, tag):
                if tag == "a" and self.in_link:
                    self.in_link = False
                    if self.current.get("title") and self.current.get("url"):
                        self.results.append(self.current)
                    self.current = {}

        parser = DDGParser()
        parser.feed(resp.text)

        for r in parser.results[:2]:
            results.append(r)

        return results
    except Exception as e:
        print(f"搜索失败 [{query[:30]}...]: {e}")
        return []


def main():
    print(f"[{datetime.now()}] 开始搜索 AI 热点...")

    all_items = []
    for source in SOURCES:
        print(f"  搜索 {source['name']}...")
        results = search_web(source["query"])
        for r in results:
            r["source"] = source["icon"]
            all_items.append(r)

    # 去重
    seen = set()
    unique_items = []
    for item in all_items:
        if item["title"] not in seen:
            seen.add(item["title"])
            unique_items.append(item)

    print(f"  找到 {len(unique_items)} 条结果")

    # 生成 HTML
    html = generate_html(unique_items)
    OUTPUT_FILE.write_text(html, encoding="utf-8")
    print(f"  已生成: {OUTPUT_FILE}")

    # 保存原始数据（备用）
    data_file = OUTPUT_DIR / "ai-discovery-data.json"
    data_file.write_text(
        json.dumps(unique_items, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"  数据已保存: {data_file}")


if __name__ == "__main__":
    main()
```

- [ ] **步骤 3：安装依赖并测试运行**

```bash
cd D:/D/cc/panelize-enhanced/scripts
pip install requests beautifulsoup4
python ai-discovery.py
```

预期：生成 `scripts/widget.html` 和 `scripts/ai-discovery-data.json`

- [ ] **步骤 4：Commit**

```bash
git add scripts/ai-discovery.py
git commit -m "feat: AI 热点每日发现脚本"
```

---

### 任务 2：创建 Rainmeter 皮肤配置

**文件：**
- 创建：`D:\D\cc\rainmeter\AIDiscovery\AIDiscovery.ini`

- [ ] **步骤 1：创建 Rainmeter 目录**

```bash
mkdir -p D:/D/cc/rainmeter/AIDiscovery
```

- [ ] **步骤 2：编写 Rainmeter 皮肤配置**

```ini
[Rainmeter]
Update=600
AccurateText=1
DynamicWindowSize=1
BackgroundMode=2
SolidColor=0,0,0,1

[Metadata]
Name=AI Discovery
Author=Panelize Enhanced
Description=每日 AI 热点发现小组件

[Variables]
WidgetPath=D:\D\cc\panelize-enhanced\scripts\widget.html

[MeasureWeb]
Measure=Plugin
Plugin=WebParser
URL=file://#WidgetPath#
RegExp=(?siU)<body>(.*)</body>
StringIndex=1
UpdateRate=600

[MeterWeb]
Meter=String
MeasureName=MeasureWeb
X=0
Y=0
W=380
H=600
SolidColor=255,255,255,240
Padding=10,10,10,10
ClipString=2
FontColor=51,51,51
FontSize=12
AntiAlias=1
```

- [ ] **步骤 3：Commit**

```bash
git add rainmeter/
git commit -m "feat: Rainmeter AI 热点小组件配置"
```

---

### 任务 3：创建 Windows 定时任务

**文件：**
- 创建：`D:\D\cc\panelize-enhanced\scripts\install-task.bat`

- [ ] **步骤 1：编写定时任务安装脚本**

```bat
@echo off
echo === 安装 AI 热点每日发现定时任务 ===

:: 创建每天早上 9 点运行的定时任务
schtasks /create /tn "AIDiscovery" /tr "python D:\D\cc\panelize-enhanced\scripts\ai-discovery.py" /sc daily /st 09:00 /f

echo.
echo 定时任务已创建：每天 09:00 自动搜索 AI 热点
echo.
echo 手动运行：python D:\D\cc\panelize-enhanced\scripts\ai-discovery.py
echo.
pause
```

- [ ] **步骤 2：编写 Rainmeter 安装指引**

创建 `D:\D\cc\panelize-enhanced\scripts\README-rainmeter.md`：

```markdown
# Rainmeter 桌面小组件安装指南

## 1. 安装 Rainmeter
- 下载：https://www.rainmeter.net/
- 安装后重启电脑

## 2. 安装皮肤
- 将 `D:\D\cc\rainmeter\AIDiscovery\` 文件夹复制到：
  `C:\Users\<你的用户名>\Documents\Rainmeter\Skins\`

## 3. 加载皮肤
- 右键 Rainmeter 托盘图标 → Skins → AIDiscovery → AIDiscovery.ini
- 皮肤会显示在桌面右上角

## 4. 设置定时更新
- 运行 `D:\D\cc\panelize-enhanced\scripts\install-task.bat`
- 每天 09:00 自动更新内容

## 5. 手动更新
- 运行：`python D:\D\cc\panelize-enhanced\scripts\ai-discovery.py`
- Rainmeter 会自动刷新显示
```

- [ ] **步骤 3：Commit**

```bash
git add scripts/install-task.bat scripts/README-rainmeter.md
git commit -m "feat: 定时任务安装脚本 + Rainmeter 安装指引"
```

---

### 任务 4：壁纸设置脚本（可选）

**文件：**
- 创建：`D:\D\cc\panelize-enhanced\scripts\set-wallpaper.ps1`

- [ ] **步骤 1：编写 PowerShell 壁纸设置脚本**

```powershell
# set-wallpaper.ps1
# 将速查表 HTML 截图设为桌面壁纸

param(
    [string]$ImagePath = "D:\D\cc\claude-reference-wallpaper.png"
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Wallpaper {
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@

if (Test-Path $ImagePath) {
    [Wallpaper]::SystemParametersInfo(0x0014, 0, $ImagePath, 0x0001 | 0x0002)
    Write-Host "壁纸已设置: $ImagePath"
} else {
    Write-Host "图片不存在: $ImagePath"
    Write-Host "请先将 HTML 截图保存到此路径"
}
```

- [ ] **步骤 2：Commit**

```bash
git add scripts/set-wallpaper.ps1
git commit -m "feat: 壁纸设置 PowerShell 脚本"
```
