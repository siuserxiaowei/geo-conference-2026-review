# 2026 第二届中国 GEO 大会 · 深度复盘与交互学习站

基于 2026 年 11 月 21–22 日深圳「第二届中国 GEO 大会」官网（`hui.ailingdaoli.com`）Day 1 + Day 2 两天议程、7 场飞书语音逐字稿与 8 份智能纪要、开源社区[两天 21.7 万字完整精校逐字稿](https://github.com/renzheng0415/china-geo-conference-2026)与[任之初 X 精华长文+漫画图谱](https://x.com/zen3634421/status/2124502492272808241)、8 张飞书总结导图、18 张分主题配图、140 张享像派现场实拍照片、**6 份已上线嘉宾完整课件**、**4 本 PDF 学习手册与三色皮书**及 **参会学习报告一键生成器**整理的深度复盘报告与纯静态交互学习网站。

> **隐私与内容边界说明**：原始飞书逐字稿与智能纪要文件保存在本地 `sources/` 目录中，已写入 `.gitignore`，**不会上传至公开仓库**；本站仅对外展示整理后的结构化洞察、导图图集、论证脉络、核心数据、短原话摘录及原声时间戳跳转链接（跳转飞书妙记需具备相应空间权限）。

## 目录结构

```text
geo-conference-2026-review/
├── index.html                 # 静态单页应用入口（Hash 路由，含全屏看图 Lightbox）
├── REVIEW.md                  # 完整中文深度复盘 Markdown 文档（含 5 张飞书总结导图）
├── assets/
│   ├── data.js                # 由 build-data.mjs 生成的浏览器数据包（window.GEO_DATA）
│   ├── style.css              # 报社编辑部/会议手记风响应式样式（含论证脉络、CSS 导图、图集与 PPT 课件位样式）
│   ├── app.js                 # 前端交互、路由、Day 1/2 筛选、CSS 观点导图、PPT 课件位、Lightbox 与打卡逻辑
│   ├── img/                   # 8 张飞书 AI 总结导图（wb-s1..s7）+ 18 张 AI 生成配图（fig-*.png）
│   ├── photos/                # 140 张两天现场直拍照片（享像派照片直播，含 thumb/ 缩略图）
│   ├── ppt/                   # PPT 课件存放目录（按 <talkId>/ 分目录存放图片或 PDF，见内附 README）
│   ├── docs/                  # 4 本大会核心 PDF（底层方法论学习手册 + GEO 白皮书 / 蓝皮书 / 红皮书）
│   ├── tools/                 # 离线互动复盘工具（参会学习报告生成器 geo-learning-report.html）
│   └── contact/               # 作者微信二维码
├── data/
│   ├── agenda.json            # 官网 Day 1 + Day 2 两天权威议程时段表（30 个时段，含现场变动说明）
│   ├── media.json             # 26 张导图与配图映射索引（sessionId / talkId）
│   ├── photos.json            # 140 张现场照片索引（talkId、kind、PPT 原文 slideText、摄影署名）
│   ├── ppt.json               # 全站 28 讲/单元 + 2 场实操课 PPT 课件位索引（已上线 5 份完整课件）
│   ├── day2-summary.json      # Day 2 总览、六大主题、跨日联动、数据墙与金句汇总
│   ├── sessions/
│   │   ├── s1–s4.json / -notes.md  # Day 1（11/21）四大场次共 18 讲
│   │   └── s5–s7.json / -notes.md  # Day 2（11/22）三大场次共 10 单元（含中午实战答疑与拔刀刘实操课）
│   └── synthesis.json         # Day 1 十大主题、7套方法论、6组分歧、32条数据、20自测题、15行动清单与全站 ASR 纠错表
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

## PPT 课件位补充方式

全站 28 个讲者/实操单元均已预留「PPT 课件」区块（由 `data/ppt.json` 统一管理）。目前已上线 **6 份完整课件**：
- **谭少卿（`s2-tanshaoqing`）**：在线 PPT（含 7 分钟真机录屏）+「GEO 内容生产线」工作台
- **艾奇先生（`s3-2`）**：26 页完整 PDF + 站内逐页高清预览
- **苍何（`s3-3`）**：42 页实战避坑版完整 PDF + 站内逐页高清预览
- **AJ（`s5-aj`）**：72 页 HTML 在线课件 + `aaaaaaaj.com` + WaytoAGI 社区知识库
- **冷洪利 / 光头牛哥（`s5-lenghongli`）**：52 页豆包视频矩阵完整 PDF + 站内逐页高清预览
- **岚叔（`s6-lanshu`）**：《GEO 的下一程：如何赢得 AI Agent 的选择 · 现场极简版》在线互动课件（`lanshuagent.com/geofenxiang/`）

后续获得更多嘉宾授权后：
1. 将导出的每页图片或 PDF 放入 `assets/ppt/<talkId>/`（或直接填写在线查看 `url`）；
2. 编辑 `data/ppt.json`，将对应 `<talkId>` 的 `status` 改为 `"ready"` 并补充 `title` / `pages` / `pdf` / `url`；
3. 运行 `node scripts/build-data.mjs && node scripts/validate.mjs` 即可生效。

## 作者与联系

- **整理制作**：siuser小伟
- **X / Twitter**：[@_HIT_SZ_](https://x.com/_HIT_SZ_)
- **微信**：`siuserxiaowei`

<img src="assets/contact/wechat-qrcode.jpg" width="160" alt="siuser小伟的微信二维码">

## 免责声明

内容基于官网议程并整理自飞书智能纪要与语音转写，可能存在个别口播数字或产品拼写识别误差，请以现场与飞书妙记原声为准。
