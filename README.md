# 2026 第二届中国 GEO 大会 · 深度复盘与交互学习站

基于 2026 年 11 月 21 日深圳「第二届中国 GEO 大会」官网（`hui.ailingdaoli.com`）Day 1 议程与白昼四大场次（上午①、上午②、下午①、下午②）的 4 份飞书语音逐字稿、5 份智能纪要、5 张总结导图与 11 张配图整理的深度复盘报告与纯静态交互学习网站。

> **隐私与内容边界说明**：原始飞书逐字稿与智能纪要文件保存在本地 `sources/` 目录中，已写入 `.gitignore`，**不会上传至公开仓库**；本站仅对外展示整理后的结构化洞察、导图图集、论证脉络、核心数据、短原话摘录及原声时间戳跳转链接（跳转飞书妙记需具备相应空间权限）。

## 目录结构

```text
geo-conference-2026-review/
├── index.html                 # 静态单页应用入口（Hash 路由，含全屏看图 Lightbox）
├── REVIEW.md                  # 完整中文深度复盘 Markdown 文档（含 5 张飞书总结导图）
├── assets/
│   ├── data.js                # 由 build-data.mjs 生成的浏览器数据包（window.GEO_DATA）
│   ├── style.css              # 报社编辑部/会议手记风响应式样式（含论证脉络、CSS 导图与图集样式）
│   ├── app.js                 # 前端交互、路由、CSS 观点导图、Lightbox 看图、全站搜索与打卡逻辑
│   ├── img/                   # 5 张飞书 AI 总结导图（wb-*.jpg）+ 11 张 AI 生成配图（fig-*.png）
│   └── photos/                # 88 张现场直拍照片（享像派照片直播，含 thumb/ 缩略图）
├── data/
│   ├── agenda.json            # 官网 Day 1（2026-11-21）权威议程时段表（16 个时段）
│   ├── media.json             # 16 张导图与配图映射索引（sessionId / talkId）
│   ├── photos.json            # 现场照片索引（talkId、kind、PPT 原文 slideText、摄影署名）
│   ├── sessions/
│   │   ├── s1.json / s1-notes.md   # 上午场①（姚金刚·乔向阳先导课、任强、拔刀刘、张栖铭）
│   │   ├── s2.json / s2-notes.md   # 上午场②（哥飞、谭少卿、张伟方）
│   │   ├── s3.json / s3-notes.md   # 下午场①（刘树勋、艾奇先生、苍何、岳琦、吕推/张莹莹/安美奇圆桌）
│   │   └── s4.json / s4-notes.md   # 下午场②（杨攀、高军、陈峥 + 周小乔/福波/周小鸟/杭州张总快分享）
│   └── synthesis.json         # 十大主题、7套方法论、6组分歧、32条数据、20自测题、15行动清单
├── scripts/
│   ├── fetch_sources.sh       # 通过 lark-cli 拉取飞书文档至 sources/
│   ├── build-data.mjs         # 合并 data/*.json 输出 assets/data.js
│   └── validate.mjs           # 校验引用完整性、官方名单、论证脉络、图集与题库下限
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

# 2. 更新 data/*.json 后，重新打包并校验
node scripts/build-data.mjs && node scripts/validate.mjs
```

## 作者与联系

- **整理制作**：siuser小伟
- **X / Twitter**：[@_HIT_SZ_](https://x.com/_HIT_SZ_)
- **微信**：`siuserxiaowei`

<img src="assets/contact/wechat-qrcode.jpg" width="160" alt="siuser小伟的微信二维码">

## 免责声明

内容基于官网议程并整理自飞书智能纪要与语音转写，可能存在个别口播数字或产品拼写识别误差，请以现场与飞书妙记原声为准。
