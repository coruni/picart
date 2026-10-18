# 上传图片水印

## 功能说明

上传图片时，按以下规则决定是否添加水印：

1. 全局配置 `UPLOAD_WATERMARK_ENABLED=true`；
2. 当前用户 `user_config.watermarkEnabled = true`（默认 `true`）；
3. 上传场景不是头像（`scene !== "avatar"`）。

水印文字默认取用户昵称（`{nickname}`），没有昵称时回退到用户名。文字通过 `fontkit` 解析字体轮廓并转换为 SVG 路径，再交给 `sharp` 合成，**不依赖服务器系统字体**，因此在 Docker 等精简环境中也能正常渲染。

水印直接写入源文件（保持原格式），所以：

- `upload.url` 指向的主图带水印；
- 后续生成的 `original` 和所有 `thumbnails` 都带水印；
- 带水印与不带水印的文件使用不同的去重键，不会互相复用。

以下情况会跳过去水印并记录 warning：

- 动图（GIF/WebP 多帧），避免破坏动画；
- 不支持的格式（如 HEIC/HEIF）；
- 字体文件缺失或加载失败。

## 数据库变更

项目未使用迁移目录，请手动执行（或在测试环境临时开启 `DB_SYNC=true`）：

```sql
ALTER TABLE user_config
  ADD COLUMN watermarkEnabled tinyint(1) NOT NULL DEFAULT 1
  COMMENT '上传图片是否添加水印';

ALTER TABLE uploads
  ADD COLUMN watermarked tinyint(1) NOT NULL DEFAULT 0
  COMMENT '是否已添加水印';
```

## 全局配置

见 `.env.example` 中的「图片水印配置」一节：

```env
UPLOAD_WATERMARK_ENABLED=true
UPLOAD_WATERMARK_FONT_PATH=assets/fonts/NotoSansSC-Regular.woff2
UPLOAD_WATERMARK_TEXT={nickname}
UPLOAD_WATERMARK_COLOR=#FFFFFF
UPLOAD_WATERMARK_OPACITY=0.55
UPLOAD_WATERMARK_FONT_SIZE_RATIO=0.035
UPLOAD_WATERMARK_MIN_FONT_SIZE=14
UPLOAD_WATERMARK_MAX_FONT_SIZE=72
UPLOAD_WATERMARK_MARGIN=16
UPLOAD_WATERMARK_POSITION=bottom-right
```

`UPLOAD_WATERMARK_TEXT` 支持 `{nickname}`、`{username}`、`{id}`。

字体文件位于 `assets/fonts/NotoSansSC-Regular.woff2`，部署时需要一并拷贝（也可以通过 `UPLOAD_WATERMARK_FONT_PATH` 指向绝对路径）。字体需要覆盖用户昵称可能出现的字符；当前内置字体覆盖常用简体中文与拉丁字符。

## 用户开关

用户可通过 `PATCH /user/config`（更新个人配置）提交：

```json
{ "watermarkEnabled": false }
```

也可以通过 `GET /user/config` 读取当前配置。关闭后，该用户之后上传的图片不再添加水印。开关变更会立即清除认证用户缓存，下一次上传即生效。

## 上传接口

### 后端中转上传

`POST /upload/file`，`multipart/form-data` 增加可选字段：

```text
scene=avatar
```

- 默认 `image`，会按用户设置添加水印；
- 上传头像建议直接使用 `POST /upload/avatar`，该接口固定为 `avatar` 场景，不会添加水印；
- 使用 `/upload/file` 上传头像时必须传 `scene=avatar`；
- `scene` 可选值：`avatar`、`image`、`other`。

### S3 直传

`POST /upload/presign` 与 `POST /upload/confirm` 都支持可选字段 `scene`，两个接口需要传相同的值。确认上传后，后端会：

1. 下载 S3 原对象到临时目录；
2. 添加水印后覆盖回原 S3 Key，因此 `upload.url` 指向的文件也是带水印的；
3. 继续生成压缩原图与缩略图。

因此 S3 直传路径产生的水印是**异步**的：`/upload/confirm` 返回时处理可能尚未完成。

> 注意：头像上传请传 `scene=avatar`。如果头像先以默认场景上传且已被加上水印，后续修改资料时无法自动去除水印，需要重新上传原图。
