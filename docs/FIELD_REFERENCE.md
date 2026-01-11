# 字段快速参考

本文档提供所有数据表字段的快速查询参考。

## 枚举类型速查

### 用户状态 (user.status)
- `ACTIVE` - 活跃
- `INACTIVE` - 非活跃
- `BANNED` - 封禁

### 性别 (user.gender)
- `male` - 男
- `female` - 女
- `other` - 其他

### 会员状态 (user.membershipStatus)
- `ACTIVE` - 活跃
- `INACTIVE` - 非活跃

### 会员等级 (user.membershipLevel)
- `0` - 普通用户
- `1` - 青铜会员
- `2` - 白银会员
- `3` - 黄金会员
- `4` - 钻石会员
- `5` - 至尊会员

### 文章类型 (article.type)
- `image` - 图片
- `mixed` - 混合

### 文章状态 (article.status)
- `DRAFT` - 草稿
- `PUBLISHED` - 已发布
- `ARCHIVED` - 已归档
- `DELETED` - 已删除
- `BANNED` - 已封禁
- `REJECTED` - 已拒绝
- `PENDING` - 待审核

### 评论状态 (comment.status)
- `PUBLISHED` - 已发布
- `DELETED` - 已删除
- `REJECTED` - 已拒绝
- `DRAFT` - 草稿

### 分类状态 (category.status)
- `ENABLED` - 启用
- `DISABLED` - 禁用

### 表情类型 (article_like.reactionType)
- `like` - 点赞
- `love` - 喜爱
- `haha` - 哈哈
- `wow` - 惊讶
- `sad` - 难过
- `angry` - 愤怒
- `dislike` - 踩

### 下载类型 (download.type)
- `baidu` - 百度网盘
- `onedrive` - OneDrive
- `google` - 谷歌网盘
- `quark` - 夸克网盘
- `aliyun` - 阿里云
- `dropbox` - Dropbox
- `direct` - 直链下载
- `lanzou` - 蓝奏云
- `mega` - Mega
- `other` - 其他

### 订单类型 (order.type)
- `MEMBERSHIP` - 会员充值
- `PRODUCT` - 商品购买
- `SERVICE` - 服务购买
- `ARTICLE` - 文章付费

### 订单状态 (order.status)
- `PENDING` - 待支付
- `PAID` - 已支付
- `CANCELLED` - 已取消
- `REFUNDED` - 已退款

### 支付方式 (payment.paymentMethod)
- `ALIPAY` - 支付宝
- `WECHAT` - 微信
- `BALANCE` - 余额支付
- `EPAY` - 易支付

### 支付状态 (payment.status)
- `PENDING` - 待支付
- `SUCCESS` - 支付成功
- `FAILED` - 支付失败
- `CANCELLED` - 已取消

### 邀请状态 (invite.status)
- `PENDING` - 待使用
- `USED` - 已使用
- `EXPIRED` - 已过期

### 邀请类型 (invite.type)
- `GENERAL` - 普通邀请
- `VIP` - VIP邀请

### 分成状态 (invite_commission.status)
- `PENDING` - 待发放
- `PAID` - 已发放
- `CANCELLED` - 已取消

### 消息类型 (message.type)
- `private` - 私信
- `system` - 系统消息
- `notification` - 通知

### 横幅状态 (banner.status)
- `active` - 激活
- `inactive` - 未激活

### 举报类型 (report.type)
- `USER` - 用户
- `ARTICLE` - 文章
- `COMMENT` - 评论

### 举报分类 (report.category)
- `SPAM` - 垃圾信息
- `ABUSE` - 辱骂攻击
- `INAPPROPRIATE` - 不当内容
- `COPYRIGHT` - 版权侵犯
- `OTHER` - 其他

### 举报状态 (report.status)
- `PENDING` - 待处理
- `PROCESSING` - 处理中
- `RESOLVED` - 已解决
- `REJECTED` - 已驳回

### 钱包交易类型 (wallet_transaction.type)
- `PAYMENT` - 支付
- `REFUND` - 退款
- `RECHARGE` - 充值
- `COMMISSION` - 佣金
- `WITHDRAW` - 提现
- `ADJUSTMENT` - 调整

---

## 常用字段说明

### 时间字段
- `createdAt` - 创建时间（自动生成）
- `updatedAt` - 更新时间（自动更新）
- `deletedAt` - 软删除时间（如果使用软删除）

### 金额字段
所有金额字段统一使用 `decimal(10,2)` 类型，单位为元（人民币）。

示例：
- `user.wallet` - 钱包余额
- `order.amount` - 订单金额
- `payment.amount` - 支付金额
- `invite_commission.commissionAmount` - 分成金额

### 比例字段
所有比例字段统一使用 `decimal(3,2)` 类型，取值范围 0-1。

示例：
- `user_config.articleCommissionRate` - 文章抽成比例（0.1 表示 10%）
- `invite.commissionRate` - 邀请分成比例（0.05 表示 5%）

### 计数字段
所有计数字段统一使用 `int` 类型，默认值为 0。

示例：
- `user.articleCount` - 文章数量
- `user.followerCount` - 粉丝数量
- `article.views` - 阅读量
- `article.likes` - 点赞数

### 状态字段
大多数状态字段使用 `enum` 类型，具体值见上方枚举类型速查。

### 外键字段
外键字段命名规则：`{关联表名}Id`

示例：
- `article.authorId` - 作者ID（关联 user 表）
- `comment.articleId` - 文章ID（关联 article 表）
- `order.userId` - 用户ID（关联 user 表）

---

## 索引字段

### 唯一索引字段
这些字段在数据库中有唯一约束：

- `user.username` - 用户名
- `user.nickname` - 昵称
- `user.email` - 邮箱
- `user.phone` - 手机号
- `role.name` - 角色名称
- `permission.name` - 权限名称
- `tag.name` - 标签名称
- `category.name` - 分类名称
- `order.orderNo` - 订单号
- `invite.inviteCode` - 邀请码
- `config.key` - 配置键

### 联合唯一索引
- `article_like (articleId, userId)` - 每个用户对每篇文章只能点赞一次

---

## 必填字段 vs 可选字段

### 用户表 (user) 必填字段
- `username` - 用户名
- `password` - 密码

### 文章表 (article) 必填字段
- `title` - 文章标题
- `authorId` - 作者ID

### 订单表 (order) 必填字段
- `userId` - 用户ID
- `authorId` - 作者ID
- `orderNo` - 订单号
- `type` - 订单类型
- `title` - 订单标题
- `amount` - 订单金额

### 举报表 (report) 必填字段
- `type` - 举报类型
- `reason` - 举报原因
- `category` - 举报分类

---

## 字段长度限制

### 短文本字段 (varchar)
- 50: 标签名称、分类名称
- 200: 文章标题、描述
- 255: 用户名、邮箱、手机号等
- 500: 摘要、链接

### 长文本字段 (text)
- 文章内容
- 评论内容
- 消息内容
- 详细描述
- 图片URL（可能很长）

---

## 默认值参考

### 数值类型默认值
- 计数器：`0`
- 金额：`0.00`
- 比例：`0.10` (10%)
- 排序：`0`

### 布尔类型默认值
- 状态开关：通常为 `true`（启用）
- 权限开关：通常为 `false`（关闭）

### 枚举类型默认值
- 用户状态：`ACTIVE`
- 订单状态：`PENDING`
- 支付状态：`PENDING`
- 会员状态：`INACTIVE`

---

## 关联关系速查

### 一对一关系
- `user` ↔ `user_config` (用户 ↔ 用户配置)

### 一对多关系
- `user` → `article` (用户 → 文章)
- `user` → `order` (用户 → 订单)
- `article` → `comment` (文章 → 评论)
- `article` → `download` (文章 → 下载资源)
- `comment` → `comment` (评论 → 子评论)
- `category` → `category` (分类 → 子分类)

### 多对多关系
- `user` ↔ `role` (用户 ↔ 角色)
- `role` ↔ `permission` (角色 ↔ 权限)
- `user` ↔ `user` (用户 ↔ 关注/粉丝)
- `article` ↔ `tag` (文章 ↔ 标签)

---

## 特殊字段说明

### JSON 字段
以下字段存储 JSON 格式数据：
- `order.details` - 订单详情
- `payment.details` - 支付详情
- `message.metadata` - 消息元数据

### 数组字段
以下字段存储数组数据（通常序列化为 JSON）：
- `article.images` - 文章图片数组

### 加密字段
以下字段需要加密存储：
- `user.password` - 使用 bcrypt 加密

### 令牌字段
以下字段存储认证令牌：
- `user.refreshToken` - JWT 刷新令牌

---

## 数据验证规则

### 邮箱格式
- 必须符合标准邮箱格式
- 示例：`user@example.com`

### 手机号格式
- 中国大陆手机号：11位数字
- 示例：`13800138000`

### 密码强度
- 最小长度：6位
- 建议：包含大小写字母、数字和特殊字符

### 金额范围
- 最小值：0.00
- 最大值：99999999.99

### 比例范围
- 最小值：0.00 (0%)
- 最大值：1.00 (100%)

---

## 更新日志

- 2025-01-11: 创建字段快速参考文档
