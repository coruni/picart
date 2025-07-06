# 邀请系统说明

## 概述

本系统实现了用户邀请功能，支持邀请码生成、使用和分成机制。当被邀请用户产生购买或开通会员时，邀请者可以获得相应的分成收益。

## 功能特性

### 1. 邀请码管理
- 生成唯一邀请码
- 设置邀请码类型（普通邀请、VIP邀请）
- 设置邀请分成比例
- 设置邀请码过期时间
- 邀请码状态管理（待使用、已使用、已过期）

### 2. 邀请分成机制
- 被邀请用户产生购买时，邀请者获得分成
- 支持不同类型订单的分成（文章、会员、商品、服务）
- 分成比例可配置（默认5%）
- 分成记录详细追踪

### 3. 邀请统计
- 邀请人数统计
- 邀请收益统计
- 分成记录查询
- 收益历史记录

## 数据库设计

### Invite 表（邀请表）
```sql
CREATE TABLE invite (
  id INT PRIMARY KEY AUTO_INCREMENT,
  inviter_id INT NOT NULL COMMENT '邀请人ID',
  invitee_id INT NULL COMMENT '被邀请人ID',
  invite_code VARCHAR(255) UNIQUE NOT NULL COMMENT '邀请码',
  status ENUM('PENDING', 'USED', 'EXPIRED') DEFAULT 'PENDING' COMMENT '邀请状态',
  type ENUM('GENERAL', 'VIP') DEFAULT 'GENERAL' COMMENT '邀请类型',
  commission_rate DECIMAL(3,2) DEFAULT 0.05 COMMENT '邀请分成比例',
  invite_url VARCHAR(500) NULL COMMENT '邀请链接',
  used_at DATETIME NULL COMMENT '使用时间',
  expired_at DATETIME NULL COMMENT '过期时间',
  remark TEXT NULL COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### InviteCommission 表（邀请分成记录表）
```sql
CREATE TABLE invite_commission (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invite_id INT NOT NULL COMMENT '邀请ID',
  inviter_id INT NOT NULL COMMENT '邀请人ID',
  invitee_id INT NOT NULL COMMENT '被邀请人ID',
  order_id INT NOT NULL COMMENT '订单ID',
  order_type ENUM('MEMBERSHIP', 'PRODUCT', 'SERVICE', 'ARTICLE') NOT NULL COMMENT '订单类型',
  order_amount DECIMAL(10,2) NOT NULL COMMENT '订单金额',
  commission_rate DECIMAL(3,2) NOT NULL COMMENT '分成比例',
  commission_amount DECIMAL(10,2) NOT NULL COMMENT '分成金额',
  status ENUM('PENDING', 'PAID', 'CANCELLED') DEFAULT 'PENDING' COMMENT '分成状态',
  paid_at DATETIME NULL COMMENT '发放时间',
  remark TEXT NULL COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### User 表（用户表新增字段）
```sql
-- 用户表中新增的邀请相关字段
ALTER TABLE user ADD COLUMN inviter_id INT NULL COMMENT '邀请人ID';
ALTER TABLE user ADD COLUMN invite_code VARCHAR(255) NULL COMMENT '使用的邀请码';
ALTER TABLE user ADD COLUMN invite_earnings DECIMAL(10,2) DEFAULT 0.00 COMMENT '邀请总收益';
ALTER TABLE user ADD COLUMN invite_count INT DEFAULT 0 COMMENT '成功邀请人数';
```

## API 接口

### 邀请码管理

#### 创建邀请码
```http
POST /invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "GENERAL",
  "commissionRate": 0.05,
  "expiredAt": "2024-12-31T23:59:59Z",
  "remark": "普通邀请"
}
```

#### 使用邀请码
```http
POST /invite/use
Authorization: Bearer <token>
Content-Type: application/json

{
  "inviteCode": "INV123456789"
}
```

#### 获取我的邀请列表
```http
GET /invite/my?page=1&limit=10
Authorization: Bearer <token>
```

#### 获取邀请详情
```http
GET /invite/{id}
Authorization: Bearer <token>
```

### 邀请统计

#### 获取邀请统计信息
```http
GET /invite/stats
Authorization: Bearer <token>
```

#### 获取邀请收益记录
```http
GET /invite/earnings?page=1&limit=10
Authorization: Bearer <token>
```

## 使用示例

### 1. 创建邀请码
```javascript
// 用户创建邀请码
const invite = await fetch('/invite', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'GENERAL',
    commissionRate: 0.05,  // 5%分成
    expiredAt: '2024-12-31T23:59:59Z',
    remark: '邀请好友注册'
  })
});

// 返回结果
{
  "id": 1,
  "inviteCode": "INV1234567890",
  "inviteUrl": "http://localhost:3000/register?invite=INV1234567890",
  "type": "GENERAL",
  "commissionRate": 0.05,
  "status": "PENDING",
  "createdAt": "2024-01-01T12:00:00Z"
}
```

### 2. 使用邀请码
```javascript
// 新用户使用邀请码
const result = await fetch('/invite/use', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + newUserToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    inviteCode: 'INV1234567890'
  })
});

// 返回结果
{
  "success": true,
  "message": "邀请码使用成功"
}
```

### 3. 产生分成（自动触发）
```javascript
// 被邀请用户购买会员或商品时，系统自动处理分成
const order = await fetch('/order', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + inviteeToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'MEMBERSHIP',
    amount: 100,
    authorId: 1,
    details: {
      membershipLevel: 1,
      duration: 30
    }
  })
});

// 支付订单
const payment = await fetch('/order/1/pay', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + inviteeToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    paymentMethod: 'wallet'
  })
});

// 支付结果（包含邀请分成信息）
{
  "order": {
    "id": 1,
    "status": "PAID",
    "amount": 100
  },
  "commission": {
    "commissionAmount": 10,
    "commissionRate": 0.1,
    "userAmount": 90
  },
  "inviteCommission": {
    "id": 1,
    "commissionAmount": 5,
    "commissionRate": 0.05,
    "status": "PAID"
  }
}
```

### 4. 查看邀请收益
```javascript
// 获取邀请统计
const stats = await fetch('/invite/stats', {
  headers: { 'Authorization': 'Bearer ' + token }
});

// 返回结果
{
  "inviteCount": 10,           // 邀请人数
  "totalEarnings": 500.00,     // 总收益
  "thisMonthEarnings": 150.00, // 本月收益
  "userInviteEarnings": 500.00 // 用户邀请总收益
}

// 获取收益记录
const earnings = await fetch('/invite/earnings?page=1&limit=10', {
  headers: { 'Authorization': 'Bearer ' + token }
});

// 返回结果
{
  "data": [
    {
      "id": 1,
      "orderType": "MEMBERSHIP",
      "orderAmount": 100,
      "commissionAmount": 5,
      "commissionRate": 0.05,
      "status": "PAID",
      "paidAt": "2024-01-01T12:00:00Z",
      "invitee": {
        "id": 2,
        "username": "invitee",
        "nickname": "被邀请用户"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

## 业务逻辑

### 邀请流程
1. 用户创建邀请码
2. 分享邀请链接给好友
3. 好友通过邀请链接注册并使用邀请码
4. 系统记录邀请关系
5. 被邀请用户产生购买时，系统自动计算分成
6. 分成金额直接添加到邀请者钱包

### 分成计算
```javascript
// 分成金额 = 订单金额 × 邀请分成比例
const inviteCommissionAmount = orderAmount * inviteCommissionRate;

// 邀请者钱包增加
inviter.wallet += inviteCommissionAmount;
inviter.inviteEarnings += inviteCommissionAmount;
```

### 分成触发条件
- 被邀请用户必须已使用邀请码
- 订单必须支付成功
- 邀请关系必须有效（邀请码状态为USED）

## 注意事项

1. 邀请码具有唯一性，不能重复
2. 用户只能使用一次邀请码
3. 不能使用自己的邀请码
4. 邀请分成在订单支付完成时自动处理
5. 分成比例可以在创建邀请码时自定义
6. 邀请码可以设置过期时间
7. 分成记录会详细记录每笔分成的来源和金额
8. 邀请收益直接添加到用户钱包，可用于消费或提现

## 扩展功能

### 多级邀请
可以扩展为多级邀请系统，支持二级、三级邀请分成。

### 邀请奖励
可以为邀请者和被邀请者设置注册奖励、首次购买奖励等。

### 邀请排行榜
可以添加邀请排行榜功能，展示邀请人数最多的用户。

### 邀请活动
可以设置限时邀请活动，提高邀请分成比例或额外奖励。 