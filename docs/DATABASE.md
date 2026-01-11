# 数据库字段文档

本文档详细描述了项目中所有数据表的字段定义。

## 目录

- [用户相关](#用户相关)
  - [用户表 (user)](#用户表-user)
  - [用户配置表 (user_config)](#用户配置表-user_config)
- [权限相关](#权限相关)
  - [角色表 (role)](#角色表-role)
  - [权限表 (permission)](#权限表-permission)
- [内容相关](#内容相关)
  - [文章表 (article)](#文章表-article)
  - [评论表 (comment)](#评论表-comment)
  - [分类表 (category)](#分类表-category)
  - [标签表 (tag)](#标签表-tag)
  - [文章点赞记录表 (article_like)](#文章点赞记录表-article_like)
  - [下载资源表 (download)](#下载资源表-download)
- [交易相关](#交易相关)
  - [订单表 (order)](#订单表-order)
  - [支付记录表 (payment)](#支付记录表-payment)
- [邀请相关](#邀请相关)
  - [邀请表 (invite)](#邀请表-invite)
  - [邀请分成记录表 (invite_commission)](#邀请分成记录表-invite_commission)
- [消息相关](#消息相关)
  - [消息表 (message)](#消息表-message)
  - [消息阅读记录表 (message_read)](#消息阅读记录表-message_read)
- [其他](#其他)
  - [横幅表 (banner)](#横幅表-banner)
  - [系统配置表 (config)](#系统配置表-config)
  - [举报表 (report)](#举报表-report)

---

## 用户相关

### 用户表 (user)

用户基本信息表，存储用户账号、个人资料、统计数据等。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 用户ID（主键） |
| username | varchar | 255 | - | N | 用户名（唯一） |
| nickname | varchar | 255 | NULL | Y | 昵称（唯一） |
| password | varchar | 255 | - | N | 密码（加密存储） |
| email | varchar | 255 | NULL | Y | 邮箱（唯一） |
| phone | varchar | 255 | NULL | Y | 手机号（唯一） |
| status | enum | - | ACTIVE | N | 状态：ACTIVE-活跃，INACTIVE-非活跃，BANNED-封禁 |
| banned | datetime | - | NULL | Y | 封禁时间 |
| banReason | varchar | 255 | NULL | Y | 封禁原因 |
| avatar | text | - | NULL | Y | 头像URL |
| description | varchar | 255 | NULL | Y | 个人描述 |
| background | text | - | NULL | Y | 背景图URL |
| address | text | - | NULL | Y | 地址 |
| gender | enum | - | other | N | 性别：male-男，female-女，other-其他 |
| birthDate | datetime | - | NULL | Y | 生日 |
| articleCount | int | - | 0 | N | 文章数量 |
| followerCount | int | - | 0 | N | 粉丝数量 |
| followingCount | int | - | 0 | N | 关注数量 |
| level | tinyint | - | 0 | N | 等级 |
| experience | int | - | 0 | N | 经验值 |
| score | double | - | 0 | N | 积分 |
| wallet | double | - | 0 | N | 钱包余额 |
| membershipLevel | int | - | 0 | N | 会员等级：0-普通，1-青铜，2-白银，3-黄金，4-钻石，5-至尊 |
| membershipLevelName | varchar | 255 | 普通用户 | N | 会员等级名称 |
| membershipStatus | enum | - | INACTIVE | N | 会员状态：ACTIVE-活跃，INACTIVE-非活跃 |
| membershipStartDate | datetime | - | NULL | Y | 会员开通时间 |
| membershipEndDate | datetime | - | NULL | Y | 会员到期时间 |
| lastLoginAt | datetime | - | NULL | Y | 最后登录时间 |
| lastActiveAt | datetime | - | NULL | Y | 最后活跃时间 |
| refreshToken | varchar | 255 | NULL | Y | 刷新令牌 |
| inviterId | int | - | NULL | Y | 邀请人ID |
| inviteCode | varchar | 255 | NULL | Y | 使用的邀请码 |
| inviteEarnings | decimal | 10,2 | 0.00 | N | 邀请总收益（元） |
| inviteCount | int | - | 0 | N | 成功邀请人数 |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

**关联关系：**
- 多对多：roles (角色)
- 多对多：following (关注的用户)
- 多对多：followers (粉丝)
- 一对一：config (用户配置)
- 一对多：orders (订单)

---

### 用户配置表 (user_config)

用户个性化配置表，包含抽成比例和通知设置。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 配置ID（主键） |
| userId | int | - | - | N | 用户ID（外键） |
| articleCommissionRate | decimal | 3,2 | 0.10 | N | 文章抽成比例（0-1） |
| membershipCommissionRate | decimal | 3,2 | 0.10 | N | 会员抽成比例（0-1） |
| productCommissionRate | decimal | 3,2 | 0.10 | N | 商品抽成比例（0-1） |
| serviceCommissionRate | decimal | 3,2 | 0.10 | N | 服务抽成比例（0-1） |
| enableCustomCommission | boolean | - | false | N | 是否启用自定义抽成 |
| enableSystemNotification | boolean | - | true | N | 是否接收系统通知 |
| enableCommentNotification | boolean | - | true | N | 是否接收评论通知 |
| enableLikeNotification | boolean | - | true | N | 是否接收点赞通知 |
| enableFollowNotification | boolean | - | true | N | 是否接收关注通知 |
| enableMessageNotification | boolean | - | true | N | 是否接收私信通知 |
| enableOrderNotification | boolean | - | true | N | 是否接收订单通知 |
| enablePaymentNotification | boolean | - | true | N | 是否接收支付通知 |
| enableInviteNotification | boolean | - | true | N | 是否接收邀请通知 |
| enableEmailNotification | boolean | - | true | N | 是否接收邮件通知 |
| enableSmsNotification | boolean | - | false | N | 是否接收短信通知 |
| enablePushNotification | boolean | - | true | N | 是否接收推送通知 |
| remark | text | - | NULL | Y | 备注 |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

**关联关系：**
- 一对一：user (用户)

---

### 钱包交易记录表 (wallet_transaction)

钱包交易记录表，记录所有余额变动。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 交易记录ID（主键） |
| userId | int | - | - | N | 用户ID（外键） |
| type | enum | - | - | N | 交易类型：PAYMENT-支付，REFUND-退款，RECHARGE-充值，COMMISSION-佣金，WITHDRAW-提现，ADJUSTMENT-调整 |
| amount | decimal | 10,2 | - | N | 交易金额（正数为收入，负数为支出） |
| balanceBefore | decimal | 10,2 | - | N | 交易前余额 |
| balanceAfter | decimal | 10,2 | - | N | 交易后余额 |
| orderId | int | - | NULL | Y | 关联订单ID |
| paymentId | int | - | NULL | Y | 关联支付记录ID |
| description | text | - | - | N | 交易描述 |
| remark | text | - | NULL | Y | 备注 |
| createdAt | datetime | - | NOW | N | 创建时间 |

**关联关系：**
- 多对一：user (用户)

---

## 权限相关

### 角色表 (role)

系统角色表，用于权限管理。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 角色ID（主键） |
| name | varchar | 255 | - | N | 角色名称（唯一） |
| displayName | varchar | 255 | NULL | Y | 显示名称 |
| description | varchar | 255 | - | N | 角色描述 |
| isActive | boolean | - | true | N | 角色状态 |
| isSystem | boolean | - | false | N | 是否为系统角色 |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

**关联关系：**
- 多对多：permissions (权限)
- 多对多：users (用户)

---

### 权限表 (permission)

系统权限表，定义具体的操作权限。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 权限ID（主键） |
| name | varchar | 255 | - | N | 权限名称（唯一） |
| description | varchar | 255 | - | N | 权限描述 |

**关联关系：**
- 多对多：roles (角色)

---

## 内容相关

### 文章表 (article)

文章内容表，存储用户发布的文章。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 文章ID（主键） |
| title | varchar | 200 | - | N | 文章标题 |
| requireLogin | boolean | - | false | N | 是否需要登录后才能查看 |
| requireFollow | boolean | - | false | N | 是否仅关注后可查看 |
| requirePayment | boolean | - | false | N | 是否需要支付后才能查看 |
| requireMembership | boolean | - | false | N | 是否需要会员才能查看 |
| listRequireLogin | boolean | - | false | N | 是否仅登录后才在列表显示 |
| viewPrice | decimal | 10,2 | 0.00 | N | 查看所需支付金额（元） |
| type | enum | - | mixed | N | 文章类型：image-图片，mixed-混合 |
| content | text | - | NULL | Y | 文章内容 |
| images | text | - | NULL | Y | 文章图片（JSON数组） |
| sort | int | - | 0 | N | 排序 |
| summary | varchar | 500 | NULL | Y | 文章摘要 |
| views | int | - | 0 | N | 阅读量 |
| likes | int | - | 0 | N | 点赞数 |
| commentCount | int | - | 0 | N | 评论数 |
| status | enum | - | DRAFT | N | 状态：DRAFT-草稿，PUBLISHED-已发布，ARCHIVED-已归档，DELETED-已删除，BANNED-已封禁，REJECTED-已拒绝，PENDING-待审核 |
| cover | varchar | 255 | NULL | Y | 封面图片URL |
| authorId | int | - | NULL | Y | 作者ID（外键） |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

**关联关系：**
- 多对一：author (作者-用户)
- 多对一：category (分类)
- 多对多：tags (标签)
- 一对多：comments (评论)
- 一对多：articleLikes (点赞记录)
- 一对多：downloads (下载资源)

---

### 评论表 (comment)

文章评论表，支持多级回复。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 评论ID（主键） |
| content | text | - | - | N | 评论内容 |
| likes | int | - | 0 | N | 点赞数 |
| replyCount | int | - | 0 | N | 回复数 |
| status | enum | - | DRAFT | N | 状态：PUBLISHED-已发布，DELETED-已删除，REJECTED-已拒绝，DRAFT-草稿 |
| rootId | int | - | NULL | Y | 根评论ID（用于多级回复） |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

**关联关系：**
- 多对一：author (作者-用户)
- 多对一：article (文章)
- 多对一：parent (父评论)
- 一对多：replies (子评论)

---

### 分类表 (category)

文章分类表，支持多级分类。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 分类ID（主键） |
| name | varchar | 50 | - | N | 分类名称（唯一） |
| description | varchar | 200 | NULL | Y | 分类描述 |
| parentId | int | - | NULL | Y | 父分类ID |
| link | varchar | 200 | NULL | Y | 自定义链接 |
| avatar | text | - | NULL | Y | 分类头像URL |
| background | text | - | NULL | Y | 分类背景URL |
| cover | text | - | NULL | Y | 分类封面URL |
| sort | int | - | 0 | N | 排序 |
| status | enum | - | ENABLED | N | 分类状态：ENABLED-启用，DISABLED-禁用 |
| articleCount | int | - | 0 | N | 文章数量 |
| followCount | int | - | 0 | N | 关注数量 |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

**关联关系：**
- 多对一：parent (父分类)
- 一对多：children (子分类)

---

### 标签表 (tag)

文章标签表。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 标签ID（主键） |
| name | varchar | 50 | - | N | 标签名称（唯一） |
| description | varchar | 200 | NULL | Y | 标签描述 |
| avatar | text | - | NULL | Y | 标签头像URL |
| background | text | - | NULL | Y | 标签背景URL |
| cover | text | - | NULL | Y | 标签封面URL |
| sort | int | - | 0 | N | 排序 |
| articleCount | int | - | 0 | N | 文章数量 |
| followCount | int | - | 0 | N | 关注数量 |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

---

### 文章点赞记录表 (article_like)

文章点赞记录表，支持多种表情反应。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 点赞ID（主键） |
| articleId | int | - | - | N | 文章ID（外键） |
| userId | int | - | - | N | 用户ID（外键） |
| reactionType | enum | - | like | N | 表情类型：like-点赞，love-喜爱，haha-哈哈，wow-惊讶，sad-难过，angry-愤怒，dislike-踩 |
| createdAt | datetime | - | NOW | N | 创建时间 |

**索引：**
- 唯一索引：(articleId, userId) - 每个用户对每篇文章只能点赞一次

**关联关系：**
- 多对一：user (用户)
- 多对一：article (文章)

---

### 下载资源表 (download)

文章附带的下载资源表。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 下载资源ID（主键） |
| type | enum | - | - | N | 下载类型：baidu-百度网盘，onedrive-OneDrive，google-谷歌网盘，quark-夸克网盘，aliyun-阿里云，dropbox-Dropbox，direct-直链，lanzou-蓝奏云，mega-Mega，other-其他 |
| url | text | - | - | N | 下载链接 |
| password | varchar | 255 | NULL | Y | 提取密码 |
| extractionCode | varchar | 255 | NULL | Y | 提取码 |
| articleId | int | - | - | N | 文章ID（外键） |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

**关联关系：**
- 多对一：article (文章)

---

## 交易相关

### 订单表 (order)

订单表，记录所有类型的订单。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 订单ID（主键） |
| userId | int | - | - | N | 用户ID-买家（外键） |
| authorId | int | - | - | N | 作者ID-卖家（外键） |
| articleId | int | - | NULL | Y | 文章ID（订单类型为ARTICLE时） |
| orderNo | varchar | 255 | - | N | 订单号（唯一） |
| type | enum | - | - | N | 订单类型：MEMBERSHIP-会员充值，PRODUCT-商品购买，SERVICE-服务购买，ARTICLE-文章付费 |
| title | varchar | 255 | - | N | 订单标题 |
| amount | decimal | 10,2 | - | N | 订单金额（元） |
| paymentMethod | varchar | 255 | NULL | Y | 支付方式：ALIPAY-支付宝，WECHAT-微信，BANK-银行卡，BALANCE-余额支付 |
| paymentOrderNo | varchar | 255 | NULL | Y | 第三方支付订单号 |
| status | enum | - | PENDING | N | 订单状态：PENDING-待支付，PAID-已支付，CANCELLED-已取消，REFUNDED-已退款 |
| paidAt | datetime | - | NULL | Y | 支付时间 |
| details | json | - | NULL | Y | 订单详情（JSON格式） |
| remark | text | - | NULL | Y | 备注 |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

**关联关系：**
- 多对一：user (用户-买家)

---

### 支付记录表 (payment)

支付记录表，记录所有支付流水。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 支付记录ID（主键） |
| orderId | int | - | - | N | 订单ID（外键） |
| userId | int | - | - | N | 用户ID（外键） |
| paymentMethod | enum | - | - | N | 支付方式：ALIPAY-支付宝，WECHAT-微信，BALANCE-余额支付，EPAY-易支付 |
| amount | decimal | 10,2 | - | N | 支付金额（元） |
| thirdPartyOrderNo | varchar | 255 | NULL | Y | 第三方支付订单号 |
| status | enum | - | PENDING | N | 支付状态：PENDING-待支付，SUCCESS-支付成功，FAILED-支付失败，CANCELLED-已取消 |
| paidAt | datetime | - | NULL | Y | 支付时间 |
| details | json | - | NULL | Y | 支付详情（JSON格式） |
| errorMessage | text | - | NULL | Y | 错误信息 |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

**关联关系：**
- 多对一：order (订单)
- 多对一：user (用户)

---

## 邀请相关

### 邀请表 (invite)

邀请码表，管理用户邀请关系。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 邀请ID（主键） |
| inviterId | int | - | - | N | 邀请人ID（外键） |
| inviteeId | int | - | NULL | Y | 被邀请人ID（外键） |
| inviteCode | varchar | 255 | - | N | 邀请码（唯一） |
| status | enum | - | PENDING | N | 邀请状态：PENDING-待使用，USED-已使用，EXPIRED-已过期 |
| type | enum | - | GENERAL | N | 邀请类型：GENERAL-普通邀请，VIP-VIP邀请 |
| commissionRate | decimal | 3,2 | 0.05 | N | 邀请分成比例（0-1） |
| inviteUrl | varchar | 500 | NULL | Y | 邀请链接 |
| usedAt | datetime | - | NULL | Y | 使用时间 |
| expiredAt | datetime | - | NULL | Y | 过期时间 |
| remark | text | - | NULL | Y | 备注 |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

**关联关系：**
- 多对一：inviter (邀请人-用户)
- 多对一：invitee (被邀请人-用户)

---

### 邀请分成记录表 (invite_commission)

邀请分成记录表，记录邀请产生的收益。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 分成记录ID（主键） |
| inviteId | int | - | - | N | 邀请ID（外键） |
| inviterId | int | - | - | N | 邀请人ID（外键） |
| inviteeId | int | - | - | N | 被邀请人ID（外键） |
| orderId | int | - | - | N | 订单ID（外键） |
| orderType | enum | - | - | N | 订单类型：MEMBERSHIP-会员充值，PRODUCT-商品购买，SERVICE-服务购买，ARTICLE-文章付费 |
| orderAmount | decimal | 10,2 | - | N | 订单金额（元） |
| commissionRate | decimal | 3,2 | - | N | 分成比例（0-1） |
| commissionAmount | decimal | 10,2 | - | N | 分成金额（元） |
| status | enum | - | PENDING | N | 分成状态：PENDING-待发放，PAID-已发放，CANCELLED-已取消 |
| paidAt | datetime | - | NULL | Y | 发放时间 |
| remark | text | - | NULL | Y | 备注 |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

**关联关系：**
- 多对一：invite (邀请)
- 多对一：inviter (邀请人-用户)
- 多对一：invitee (被邀请人-用户)
- 多对一：order (订单)

---

## 消息相关

### 消息表 (message)

消息表，支持私信、系统消息和通知。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 消息ID（主键） |
| senderId | int | - | NULL | Y | 发送者ID（外键，系统消息为NULL） |
| receiverId | int | - | NULL | Y | 接收者ID（外键，广播消息为NULL） |
| content | text | - | - | N | 消息内容 |
| type | varchar | 255 | private | N | 消息类型：private-私信，system-系统消息，notification-通知 |
| isRead | boolean | - | false | N | 是否已读 |
| isBroadcast | boolean | - | false | N | 是否为广播消息 |
| title | varchar | 255 | NULL | Y | 消息标题 |
| metadata | json | - | NULL | Y | 元数据（JSON格式） |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

**关联关系：**
- 多对一：sender (发送者-用户)
- 多对一：receiver (接收者-用户)
- 一对多：readRecords (阅读记录)

---

### 消息阅读记录表 (message_read)

消息阅读记录表，用于广播消息的已读状态。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 记录ID（主键） |
| userId | int | - | - | N | 用户ID（外键） |
| messageId | int | - | - | N | 消息ID（外键） |
| createdAt | datetime | - | NOW | N | 创建时间 |

**关联关系：**
- 多对一：message (消息)
- 多对一：user (用户)

---

## 其他

### 横幅表 (banner)

网站横幅广告表。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 横幅ID（主键） |
| title | varchar | 255 | - | N | 横幅标题 |
| description | varchar | 500 | NULL | Y | 横幅描述 |
| imageUrl | varchar | 500 | - | N | 图片URL |
| linkUrl | varchar | 500 | NULL | Y | 链接URL |
| sortOrder | int | - | 0 | N | 排序 |
| status | enum | - | active | N | 状态：active-激活，inactive-未激活 |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

---

### 系统配置表 (config)

系统配置表，存储系统级配置项。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 配置ID（主键） |
| key | varchar | 255 | - | N | 配置键（唯一） |
| value | text | - | NULL | Y | 配置值 |
| description | varchar | 255 | NULL | Y | 配置描述 |
| type | varchar | 255 | string | N | 配置类型 |
| group | varchar | 255 | system | N | 配置分组 |
| public | boolean | - | false | N | 是否公开 |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

---

### 举报表 (report)

举报表，记录用户举报信息。

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 举报ID（主键） |
| type | enum | - | - | N | 举报类型：USER-用户，ARTICLE-文章，COMMENT-评论 |
| reason | text | - | - | N | 举报原因 |
| category | enum | - | - | N | 举报分类：SPAM-垃圾信息，ABUSE-辱骂攻击，INAPPROPRIATE-不当内容，COPYRIGHT-版权侵犯，OTHER-其他 |
| description | text | - | NULL | Y | 详细描述 |
| status | enum | - | PENDING | N | 处理状态：PENDING-待处理，PROCESSING-处理中，RESOLVED-已解决，REJECTED-已驳回 |
| result | text | - | NULL | Y | 处理结果 |
| reporterId | int | - | NULL | Y | 举报人ID（外键） |
| reportedUserId | int | - | NULL | Y | 被举报用户ID（外键） |
| reportedArticleId | int | - | NULL | Y | 被举报文章ID（外键） |
| reportedCommentId | int | - | NULL | Y | 被举报评论ID（外键） |
| handlerId | int | - | NULL | Y | 处理人ID（外键） |
| handledAt | datetime | - | NULL | Y | 处理时间 |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

**关联关系：**
- 多对一：reporter (举报人-用户)
- 多对一：reportedUser (被举报用户)
- 多对一：reportedArticle (被举报文章)
- 多对一：reportedComment (被举报评论)
- 多对一：handler (处理人-用户)

---

## 关联表

### user_followings

用户关注关系表（多对多中间表）。

| 字段名 | 类型 | 说明 |
|--------|------|------|
| followerId | int | 关注者ID |
| followingId | int | 被关注者ID |

---

### role_permissions

角色权限关系表（多对多中间表）。

| 字段名 | 类型 | 说明 |
|--------|------|------|
| role_id | int | 角色ID |
| permission_id | int | 权限ID |

---

## 数据类型说明

- **int**: 整数类型
- **varchar**: 可变长度字符串
- **text**: 长文本
- **datetime**: 日期时间
- **decimal(p,s)**: 定点数，p为精度，s为小数位数
- **boolean**: 布尔值
- **enum**: 枚举类型
- **json**: JSON格式数据
- **tinyint**: 小整数（-128 到 127）
- **double**: 双精度浮点数

---

## 索引说明

### 唯一索引
- user.username
- user.nickname
- user.email
- user.phone
- role.name
- permission.name
- tag.name
- category.name
- order.orderNo
- invite.inviteCode
- config.key
- article_like (articleId, userId) - 联合唯一索引

### 外键索引
所有外键字段都会自动创建索引以提高查询性能。

---

## 更新日志

- 2025-01-11: 初始版本，包含所有核心表结构
