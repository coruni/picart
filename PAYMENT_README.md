# 支付系统集成文档

## 系统架构

本支付系统采用模块化设计，明确划分了各个服务的职责：

- **OrderService**: 负责订单生命周期管理
- **PaymentService**: 负责支付流程处理  
- **CommissionService**: 负责佣金计算和分配
- **UserService**: 负责用户信息管理
- **ConfigService**: 负责系统配置管理

详细的服务职责分工请参考 [SERVICE_RESPONSIBILITIES.md](./SERVICE_RESPONSIBILITIES.md)

## 功能概述

本支付系统集成了支付宝、微信支付和余额支付三种支付方式，支持文章付费阅读和会员充值等场景。系统采用订单-支付分离的设计，确保数据安全性和业务逻辑的清晰性。

## 核心特性

- **多种支付方式**: 支持支付宝、微信支付、余额支付
- **订单管理**: 完整的订单生命周期管理
- **佣金分配**: 自动处理邀请者、作者、平台三方分成
- **配置化管理**: 支付参数和佣金比例可通过后台配置
- **安全验证**: 支付回调签名验证（生产环境）
- **防重复购买**: 防止用户重复购买同一篇文章
- **会员充值**: 支持5个等级的会员充值，自动处理会员权益

## 佣金机制

系统采用三方分成机制：

- **邀请者分成**: 5% (0.05)
- **平台分成**: 10% (0.1)  
- **作者分成**: 85% (0.85) - 自动计算剩余部分

## 配置说明

### 支付配置

在 `config` 表中配置以下参数：

```sql
-- 支付宝配置
INSERT INTO config (group, key, value, description) VALUES
('payment', 'payment_alipay_enabled', 'true', '支付宝支付是否启用'),
('payment', 'payment_alipay_app_id', 'your_app_id', '支付宝应用ID'),
('payment', 'payment_alipay_private_key', 'your_private_key', '支付宝私钥'),
('payment', 'payment_alipay_public_key', 'alipay_public_key', '支付宝公钥'),
('payment', 'payment_alipay_gateway', 'https://openapi.alipay.com/gateway.do', '支付宝网关地址'),
('payment', 'payment_notify_url', 'https://your-domain.com/payment/notify/alipay', '支付回调地址'),
('payment', 'payment_return_url', 'https://your-domain.com/payment/return', '支付返回地址');

-- 微信支付配置
INSERT INTO config (group, key, value, description) VALUES
('payment', 'payment_wechat_enabled', 'true', '微信支付是否启用'),
('payment', 'payment_wechat_app_id', 'your_app_id', '微信应用ID'),
('payment', 'payment_wechat_mch_id', 'your_mch_id', '微信商户号'),
('payment', 'payment_wechat_key', 'your_key', '微信支付密钥'),
('payment', 'payment_wechat_cert_path', '/path/to/cert.pem', '微信证书路径'),
('payment', 'payment_wechat_key_path', '/path/to/key.pem', '微信私钥路径');

-- 佣金配置
INSERT INTO config (group, key, value, description) VALUES
('commission', 'commission_inviter_rate', '0.05', '邀请者分成比例'),
('commission', 'commission_platform_rate', '0.1', '平台分成比例'),
('commission', 'commission_author_rate', '0.85', '作者分成比例');

-- 会员配置
INSERT INTO config (group, key, value, description) VALUES
('membership', 'membership_price', '19.9', '会员月价格（元）'),
('membership', 'membership_name', 'VIP会员', '会员名称'),
('membership', 'membership_enabled', 'true', '是否启用会员功能');
```

## API 接口

### 订单相关

#### 创建文章订单
```http
POST /order/article
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "articleId": 1,
  "remark": "购买文章"
}
```

**响应示例:**
```json
{
  "id": 1,
  "orderNo": "ORDER1234567890123",
  "userId": 1,
  "authorId": 2,
  "articleId": 1,
  "type": "ARTICLE",
  "title": "购买文章：示例文章标题",
  "amount": 10.00,
  "status": "PENDING",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### 创建会员充值订单
```http
POST /order/membership
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "duration": 12,
  "remark": "充值VIP会员一年"
}
```

**响应示例:**
```json
{
  "id": 1,
  "orderNo": "ORDER1234567890123",
  "userId": 1,
  "authorId": 1,
  "type": "MEMBERSHIP",
  "title": "充值VIP会员 12个月",
  "amount": 238.80,
  "status": "PENDING",
  "details": {
    "membershipLevel": 1,
    "membershipName": "VIP会员",
    "duration": 12,
    "basePrice": 19.9,
    "totalAmount": 238.80
  },
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### 获取待支付订单
```http
GET /order/pending
Authorization: Bearer <jwt_token>
```

#### 取消订单
```http
PUT /order/{id}/cancel
Authorization: Bearer <jwt_token>
```

#### 申请退款
```http
POST /order/{id}/refund
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "reason": "退款原因"
}
```

### 支付相关

#### 创建支付
```http
POST /payment/create
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "orderId": 1,
  "paymentMethod": "ALIPAY",
  "returnUrl": "https://your-domain.com/payment/success"
}
```

**重要说明**: 
- 前端不再需要发送 `amount` 字段，系统会自动从订单中获取金额，确保数据安全性
- `returnUrl` 为可选参数，用于指定支付完成后的跳转地址。如果不提供，将使用系统配置中的默认地址

**响应示例:**
```json
{
  "paymentId": 1,
  "paymentUrl": "https://openapi.alipay.com/gateway.do?out_trade_no=ORDER1234567890123&total_amount=10.00&subject=购买文章：示例文章标题",
  "paymentMethod": "ALIPAY",
  "message": "请跳转到支付宝完成支付"
}
```

#### 查询支付记录
```http
GET /payment/record/{id}
Authorization: Bearer <jwt_token>
```

#### 查询订单支付记录
```http
GET /payment/order/{orderId}
Authorization: Bearer <jwt_token>
```

#### 查询用户支付记录
```http
GET /payment/user?page=1&limit=10
Authorization: Bearer <jwt_token>
```

### 支付回调（无需认证）

#### 支付宝回调
```http
POST /payment/notify/alipay
Content-Type: application/x-www-form-urlencoded

trade_no=2024010122001234567890&out_trade_no=ORDER1234567890123&trade_status=TRADE_SUCCESS&total_amount=10.00
```

#### 微信支付回调
```http
POST /payment/notify/wechat
Content-Type: application/xml

<xml>
  <transaction_id>4200001234567890</transaction_id>
  <out_trade_no>ORDER1234567890123</out_trade_no>
  <result_code>SUCCESS</result_code>
  <total_fee>1000</total_fee>
</xml>
```

### 测试接口

#### 模拟支付成功
```http
POST /payment/simulate/{id}/success
Authorization: Bearer <jwt_token>
```

## 支付流程

### 标准支付流程

1. **创建订单**: 前端调用 `/order/article` 创建文章订单
2. **创建支付**: 前端调用 `/payment/create` 创建支付记录
3. **用户支付**: 用户通过支付宝/微信完成支付
4. **支付回调**: 支付平台回调 `/payment/notify/*` 接口
5. **订单完成**: 系统自动更新订单状态并分配佣金

### 会员充值流程

1. **创建会员订单**: 前端调用 `/order/membership` 创建会员充值订单
2. **创建支付**: 前端调用 `/payment/create` 创建支付记录
3. **用户支付**: 用户通过支付宝/微信完成支付
4. **支付回调**: 支付平台回调 `/payment/notify/*` 接口
5. **订单完成**: 系统自动更新订单状态、分配佣金并处理会员权益

### 余额支付流程

1. **创建订单**: 同上
2. **创建支付**: 调用 `/payment/create` 选择 `BALANCE` 支付方式
3. **自动扣款**: 系统自动扣除用户余额并完成订单

## 数据库表结构

### 订单表 (order)
```sql
CREATE TABLE `order` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL COMMENT '用户ID（买家）',
  `authorId` int NOT NULL COMMENT '作者ID（卖家）',
  `articleId` int DEFAULT NULL COMMENT '文章ID（当订单类型为ARTICLE时）',
  `orderNo` varchar(255) NOT NULL COMMENT '订单号',
  `type` enum('MEMBERSHIP','PRODUCT','SERVICE','ARTICLE') NOT NULL COMMENT '订单类型',
  `title` varchar(255) NOT NULL COMMENT '订单标题',
  `amount` decimal(10,2) NOT NULL COMMENT '订单金额（元）',
  `paymentMethod` varchar(255) DEFAULT NULL COMMENT '支付方式',
  `status` enum('PENDING','PAID','CANCELLED','REFUNDED') DEFAULT 'PENDING' COMMENT '订单状态',
  `paidAt` datetime DEFAULT NULL COMMENT '支付时间',
  `details` json DEFAULT NULL COMMENT '订单详情',
  `remark` text COMMENT '备注',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `orderNo` (`orderNo`)
);
```

### 支付记录表 (payment_record)
```sql
CREATE TABLE `payment_record` (
  `id` int NOT NULL AUTO_INCREMENT,
  `orderId` int NOT NULL COMMENT '订单ID',
  `userId` int NOT NULL COMMENT '用户ID',
  `paymentMethod` enum('ALIPAY','WECHAT','BALANCE') NOT NULL COMMENT '支付方式',
  `amount` decimal(10,2) NOT NULL COMMENT '支付金额（元）',
  `thirdPartyOrderNo` varchar(255) DEFAULT NULL COMMENT '第三方支付订单号',
  `status` enum('PENDING','SUCCESS','FAILED','CANCELLED') DEFAULT 'PENDING' COMMENT '支付状态',
  `paidAt` datetime DEFAULT NULL COMMENT '支付时间',
  `details` json DEFAULT NULL COMMENT '支付详情',
  `errorMessage` text COMMENT '错误信息',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`orderId`),
  KEY `idx_user_id` (`userId`)
);
```

## 注意事项

### 安全性
1. **金额验证**: 前端不再发送支付金额，系统从订单中获取，防止金额篡改
2. **订单验证**: 支付时验证订单存在性和状态
3. **用户验证**: 确保用户只能为自己的订单创建支付
4. **防重复**: 防止用户重复购买同一篇文章

### 业务逻辑
1. **订单状态**: 订单状态变更需要严格按照 PENDING → PAID → REFUNDED 流程
2. **佣金计算**: 佣金在支付完成后自动计算并分配到各方钱包
3. **余额检查**: 余额支付前需要检查用户余额是否充足
4. **会员权益**: 会员充值成功后自动更新用户会员等级和到期时间
5. **会员配置**: 会员价格和名称可在后台配置中调整

### 配置管理
1. **支付开关**: 可以通过配置控制各支付方式的启用状态
2. **佣金比例**: 佣金比例可通过后台配置，支持动态调整
3. **回调地址**: 支付回调地址需要配置为公网可访问的地址
4. **会员配置**: 会员价格、名称和启用状态可在后台配置中调整

## 测试建议

### 功能测试
1. 测试各种支付方式的完整流程
2. 测试订单取消和退款功能
3. 测试重复购买防护
4. 测试余额不足的情况

### 安全测试
1. 测试金额篡改防护
2. 测试订单权限验证
3. 测试支付回调签名验证

### 性能测试
1. 测试并发支付场景
2. 测试大量订单查询性能
3. 测试佣金计算性能

## 扩展建议

### 功能扩展
1. **分期支付**: 支持订单分期付款
2. **优惠券**: 集成优惠券系统
3. **积分支付**: 支持积分抵扣
4. **发票管理**: 添加发票开具功能

### 技术扩展
1. **支付统计**: 添加支付数据统计和分析
2. **风控系统**: 集成支付风控检测
3. **多币种**: 支持多币种支付
4. **国际化**: 支持多语言支付界面

## 故障排查

### 常见问题
1. **支付失败**: 检查支付配置是否正确
2. **回调失败**: 检查回调地址是否可访问
3. **佣金计算错误**: 检查佣金配置是否正确
4. **订单状态异常**: 检查订单状态变更逻辑

### 日志查看
- 支付相关日志: `payment.log`
- 订单相关日志: `order.log`
- 佣金相关日志: `commission.log`
