# 字体资源

## NotoSansSC-Regular.woff2

- 字体：Noto Sans SC（Regular）
- 来源：`@fontsource/noto-sans-sc` 的 `noto-sans-sc-chinese-simplified-400-normal.woff2`
- 许可证：SIL Open Font License 1.1

用于上传图片水印。`WatermarkService` 通过 `fontkit` 将文字转换为 SVG 路径，
不依赖服务器系统字体，因此 Docker 等精简环境无需额外安装字体。

如需替换字体，可通过环境变量 `UPLOAD_WATERMARK_FONT_PATH` 指向其他
TTF/OTF/WOFF/WOFF2 文件（相对路径基于项目根目录）。
