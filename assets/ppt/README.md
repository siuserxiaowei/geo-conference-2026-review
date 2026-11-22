# PPT 课件存放说明

本目录用于存放 2026 第二届中国 GEO 大会（Day 1 & Day 2）各场次讲者的授权 PPT 课件图片或 PDF 文件。

## 上传与启用流程

1. 按讲者 `talkId`（见 [`data/ppt.json`](../../data/ppt.json)）建立子目录，例如：`assets/ppt/s5-aj/`。
2. 将 PPT 每一页导出为图片（推荐 `.jpg` / `.png`，长边 1600px 左右，按 `01.jpg`、`02.jpg` 顺序命名）或放入完整 `.pdf`。
3. 打开 [`data/ppt.json`](../../data/ppt.json)，将对应 `talkId` 的状态从 `"pending"` 改为 `"ready"`，并填写字段：

```json
"s5-aj": {
  "status": "ready",
  "title": "WaytoGrowth 海外营销增长策略（完整课件）",
  "pages": [
    "assets/ppt/s5-aj/01.jpg",
    "assets/ppt/s5-aj/02.jpg"
  ],
  "pdf": "assets/ppt/s5-aj/slides.pdf",
  "url": "https://..."
}
```

4. 执行 `node scripts/build-data.mjs && node scripts/validate.mjs`，页面「PPT 课件」区块即会自动从占位态切换为可点击放大的缩略图网格 / PDF 下载入口。
