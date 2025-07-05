# 抽成系统说明

## 概述

本系统支持全局抽成配置和用户单独抽成配置，适用于文章、会员、商品、服务等多种业务场景。抽成在订单支付完成时自动处理，无需手动计算。

## 功能特性

### 1. 全局抽成配置
- 在 `config` 模块中配置全局抽成比例
- 支持文章、会员、商品、服务四种类型的抽成
- 默认抽成比例为 10%

### 2. 用户单独抽成配置
- 在 `user-config` 表中配置用户个人抽成比例
- 可选择是否启用自定义抽成
- 不启用时使用全局配置

### 3. 抽成计算
- 在订单支付完成时自动计算抽成金额和用户实际收入
- 自动更新用户钱包余额
- 返回详细的抽成信息

### 4. 钱包系统
- 用户钱包余额管理
- 支持充值和提现
- 支付时自动扣除钱包余额
- 收入自动增加到作者钱包

## 数据库设计

### Config 表（全局配置）
```sql
-- 全局抽成配置示例
INSERT INTO config (key, value, group, type, description) VALUES
('article_commission_rate', '0.1', 'commission', 'number', '文章抽成比例'),
('membership_commission_rate', '0.1', 'commission', 'number', '会员抽成比例'),
('product_commission_rate', '0.1', 'commission', 'number', '商品抽成比例'),
('service_commission_rate', '0.1', 'commission', 'number', '服务抽成比例');
```

### UserConfig 表（用户配置）
```sql
CREATE TABLE user_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  article_commission_rate DECIMAL(3,2) DEFAULT 0.10,
  membership_commission_rate DECIMAL(3,2) DEFAULT 0.10,
  product_commission_rate DECIMAL(3,2) DEFAULT 0.10,
  service_commission_rate DECIMAL(3,2) DEFAULT 0.10,
  enable_custom_commission BOOLEAN DEFAULT FALSE,
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### User 表（用户钱包）
```sql
-- 用户表中的钱包字段
wallet DECIMAL(10,2) DEFAULT 0.00 COMMENT '钱包余额'
```

## API 接口

### 全局抽成配置

#### 获取全局抽成配置
```http
GET /config/commission/global
Authorization: Bearer <token>
```

#### 设置全局抽成配置
```http
POST /config/commission/global
Authorization: Bearer <token>
Content-Type: application/json

{
  "articleCommissionRate": 0.1,
  "membershipCommissionRate": 0.15,
  "productCommissionRate": 0.12,
  "serviceCommissionRate": 0.08
}
```

### 用户抽成配置

#### 获取用户抽成配置
```http
GET /user/commission/config
Authorization: Bearer <token>
```

#### 设置用户抽成配置
```http
POST /user/commission/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "articleCommissionRate": 0.08,
  "membershipCommissionRate": 0.12,
  "productCommissionRate": 0.10,
  "serviceCommissionRate": 0.05,
  "enableCustomCommission": true,
  "remark": "VIP用户优惠抽成"
}
```

#### 计算抽成金额
```http
POST /user/commission/calculate
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 100,
  "type": "article"
}
```

### 订单创建
```http
POST /order
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "ARTICLE",
  "amount": 100,
  "authorId": 456,
  "targetId": 123,
  "details": {
    "articleId": 123,
    "title": "文章标题"
  }
}
```

### 订单支付
```http
POST /order/{id}/pay
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentMethod": "wallet"
}
```

### 钱包管理
```http
# 获取钱包余额
GET /user/wallet
Authorization: Bearer <token>

# 钱包充值
POST /user/wallet/recharge
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 100,
  "paymentMethod": "alipay"
}

# 钱包提现
POST /user/wallet/withdraw
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 50,
  "bankInfo": {
    "bankName": "中国银行",
    "accountNo": "1234567890"
  }
}
```

## 使用示例

### 1. 设置全局抽成配置
```javascript
// 管理员设置全局抽成
const globalConfig = {
  articleCommissionRate: 0.1,    // 文章抽成10%
  membershipCommissionRate: 0.15, // 会员抽成15%
  productCommissionRate: 0.12,    // 商品抽成12%
  serviceCommissionRate: 0.08     // 服务抽成8%
};

await fetch('/config/commission/global', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(globalConfig)
});
```

### 2. 用户设置个人抽成配置
```javascript
// 用户设置个人抽成
const userConfig = {
  articleCommissionRate: 0.08,    // 个人文章抽成8%
  enableCustomCommission: true,   // 启用自定义抽成
  remark: 'VIP用户优惠'
};

await fetch('/user/commission/config', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + userToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(userConfig)
});
```

### 3. 计算抽成金额
```javascript
// 计算抽成
const result = await fetch('/user/commission/calculate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 100,
    type: 'article'
  })
});

// 返回结果
{
  "commissionAmount": 8,      // 抽成金额
  "commissionRate": 0.08,     // 抽成比例
  "userAmount": 92,           // 用户实际收入
  "configType": "user"        // 配置类型（user/global）
}
```

### 4. 创建订单
```javascript
// 创建订单
const order = await fetch('/order', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'ARTICLE',
    amount: 100,
    authorId: 456,
    targetId: 123,
    details: {
      articleId: 123,
      title: '付费文章'
    }
  })
});
```

### 5. 支付订单（自动处理抽成）
```javascript
// 支付订单
const payment = await fetch('/order/1/pay', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    paymentMethod: 'wallet'
  })
});

// 支付结果
{
  "order": {
    "id": 1,
    "status": "PAID",
    "amount": 100,
    "paidAt": "2024-01-01T12:00:00Z"
  },
  "commission": {
    "commissionAmount": 8,
    "commissionRate": 0.08,
    "userAmount": 92,
    "configType": "user"
  },
  "authorWallet": 192,  // 作者钱包余额
  "buyerWallet": 50     // 买家钱包余额
}
```

### 6. 钱包管理
```javascript
// 获取钱包余额
const wallet = await fetch('/user/wallet', {
  headers: { 'Authorization': 'Bearer ' + token }
});

// 钱包充值
const recharge = await fetch('/user/wallet/recharge', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 100,
    paymentMethod: 'alipay'
  })
});

// 钱包提现
const withdraw = await fetch('/user/wallet/withdraw', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 50,
    bankInfo: {
      bankName: '中国银行',
      accountNo: '1234567890'
    }
  })
});
```

## 业务逻辑

### 支付流程
1. 用户创建订单（状态：PENDING）
2. 用户支付订单（调用支付接口）
3. 系统自动计算抽成
4. 扣除买家钱包余额
5. 增加作者钱包余额（扣除抽成）
6. 更新订单状态为已支付

### 抽成计算优先级
1. 如果用户启用了自定义抽成（`enableCustomCommission: true`），使用用户配置
2. 否则使用全局配置
3. 如果都没有配置，使用默认值（10%）

### 抽成类型
- `article`: 文章付费
- `membership`: 会员订阅
- `product`: 商品购买
- `service`: 服务付费

### 计算规则
```javascript
// 抽成金额 = 订单金额 × 抽成比例
const commissionAmount = amount * commissionRate;

// 用户实际收入 = 订单金额 - 抽成金额
const userAmount = amount * (1 - commissionRate);

// 钱包更新
buyer.wallet -= orderAmount;        // 买家钱包扣除
author.wallet += userAmount;        // 作者钱包增加（扣除抽成）
```

## 注意事项

1. 抽成比例必须在 0-1 之间（0% - 100%）
2. 用户配置优先级高于全局配置
3. 抽成在订单支付完成时自动处理，无需手动计算
4. 抽成配置修改不影响已创建的订单
5. 钱包余额不足时无法支付订单
6. 建议定期备份抽成配置和钱包数据
7. 提现功能需要额外的审核流程（当前版本仅记录申请） 