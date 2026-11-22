# 2026 第二届中国 GEO 大会 · 深度复盘与交互学习站

基于 2026 年 11 月 21 日深圳「第二届中国 GEO 大会」白昼四大场次（上午①、上午②、下午①、下午②）的 4 份飞书语音逐字稿与 5 份智能纪要整理的深度复盘报告与纯静态交互学习网站。

> **隐私与内容边界说明**：原始飞书逐字稿与智能纪要文件保存在本地 `sources/` 目录中，已写入 `.gitignore`，**不会上传至公开仓库**；本站仅对外展示整理后的结构化洞察、核心数据、短原话摘录及原声时间戳跳转链接（跳转飞书妙记需具备相应空间权限）。

## 目录结构

```text
geo-conference-2026-review/
├── index.html                 # 静态单页应用入口（Hash 路由，零构建依赖）
├── REVIEW.md                  # 完整中文深度复盘 Markdown 文档
├── assets/
│   ├── data.js                # 由 build-data.mjs 生成的浏览器数据包（window.GEO_DATA）
│   ├── style.css              # 报社编辑部/会议手记风响应式样式（纯本地系统字体）
│   └── app.js                 # 前端交互、路由、全站搜索与 localStorage 打卡逻辑
├── data/
│   ├── sessions/
│   │   ├── s1.json / s1-notes.md   # 上午场①（任强、拔刀流、张新敏）
│   │   ├── s2.json / s2-notes.md   # 上午场②（戈飞、谭少青、任总）
│   │   ├── s3.json / s3-notes.md   # 下午场①（智能时代联创、艾琪、昌河、每经嘉宾、三人圆桌）
│   │   └── s4.json / s4-notes.md   # 下午场②（杨刚、高军、陈征 + 四位快分享）
│   └── synthesis.json         # 十大主题、7套方法论、6组分歧、32条数据、20自测题、15行动清单
├── scripts/
│   ├── fetch_sources.sh       # 通过 lark-cli 拉取飞书文档至 sources/
│   ├── build-data.mjs         # 合并 data/*.json 输出 assets/data.js
│   └── validate.mjs           # 校验引用完整性、时间戳格式、题库与数据量下限
└── sources/                   # （已 .gitignore）本地原始逐字稿与智能纪要
```

## 本地预览

无需安装任何依赖或打包工具：

```bash
# 方式一：本地静态服务预览（推荐）
python3 -m http.server 8765
# 浏览器访问 http://localhost:8765

# 方式二：直接用浏览器打开根目录 index.html（assets/data.js 为全局变量，支持 file:// 打开）
```

## 数据更新流程

```bash
# 1. 拉取最新飞书原文（需本地 lark-cli 已完成 user 身份授权）
bash scripts/fetch_sources.sh

# 2. 更新 data/sessions/*.json 与 data/synthesis.json 后，重新打包并校验
node scripts/build-data.mjs && node scripts/validate.mjs
```

## 免责声明

内容整理自飞书智能纪要与语音转写，可能存在人名、品牌拼写或语音识别误差，请以现场与飞书妙记原声为准。
