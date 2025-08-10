# 支付流程快速参考

## 🚀 完整支付流程概览

```
用户操作 → 前端请求 → 后端处理 → 支付网关 → 回调处理 → 完成
```

## 📋 详细步骤

### 文章购买流程

#### 第1步：创建订单
```
用户点击购买文章
    ↓
POST /order/article
    ↓
OrderService.createArticleOrder()
    ↓
验证文章 → 检查重复购买 → 创建订单
    ↓
返回订单信息 (包含 orderId, amount)
```

#### 第2步：创建支付
```
用户选择支付方式
    ↓
POST /payment/create
    ↓
PaymentService.createPayment()
    ↓
验证订单 → 检查支付配置 → 创建支付记录
    ↓
根据支付方式处理：
├── ALIPAY: 返回支付URL
├── WECHAT: 返回二维码
└── BALANCE: 直接扣款完成
```

#### 第3步：用户支付
```
支付宝/微信支付：
用户完成支付 → 支付网关回调 → POST /payment/notify/*

余额支付：
直接扣款 → 立即完成
```

#### 第4步：支付完成处理
```
支付成功回调
    ↓
PaymentService.handle*Notify()
    ↓
更新支付记录状态
    ↓
OrderService.markOrderAsPaid() → 更新订单状态
    ↓
CommissionService.handleOrderPayment() → 分配佣金
    ↓
更新用户钱包
    ↓
返回成功响应
```

### 会员充值流程

#### 第1步：创建会员订单
```
用户选择充值时长
    ↓
POST /order/membership
    ↓
OrderService.createMembershipOrder()
    ↓
验证充值时长 → 从配置获取价格 → 创建订单
    ↓
返回订单信息 (包含 orderId, amount)
```

#### 第2步：创建支付
```
用户选择支付方式
    ↓
POST /payment/create
    ↓
PaymentService.createPayment()
    ↓
验证订单 → 检查支付配置 → 创建支付记录
    ↓
根据支付方式处理
```

#### 第3步：用户支付
```
支付宝/微信支付：
用户完成支付 → 支付网关回调 → POST /payment/notify/*

余额支付：
直接扣款 → 立即完成
```

#### 第4步：支付完成处理
```
支付成功回调
    ↓
PaymentService.handle*Notify()
    ↓
更新支付记录状态
    ↓
OrderService.markOrderAsPaid() → 更新订单状态
    ↓
CommissionService.handleOrderPayment() → 分配佣金 + 处理会员充值
    ↓
更新用户会员信息
    ↓
返回成功响应
```

## 🔗 关键接口调用

| 步骤 | 接口 | 请求体 | 响应 |
|------|------|--------|------|
| **1. 创建文章订单** | `POST /order/article` | `{articleId: 1}` | `{id: 1, orderNo: "ORDER123", amount: 10}` |
| **1. 创建会员订单** | `POST /order/membership` | `{duration: 12}` | `{id: 1, orderNo: "ORDER123", amount: 238.8}` |
| **2. 创建支付** | `POST /payment/create` | `{orderId: 1, paymentMethod: "ALIPAY", returnUrl: "..."}` | `{paymentId: 1, paymentUrl: "..."}` |
| **3. 支付回调** | `POST /payment/notify/alipay` | 支付宝原始数据 | `{success: true}` |
| **4. 查询结果** | `GET /payment/record/1` | - | 支付记录详情 |

## 🎯 服务职责分工

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   OrderService  │    │ PaymentService  │    │CommissionService│
│                 │    │                 │    │                 │
│ • 创建订单      │    │ • 创建支付      │    │ • 计算佣金      │
│ • 更新订单状态  │◄───┤ • 处理回调      │◄───┤ • 分配佣金      │
│ • 订单验证      │    │ • 支付记录管理  │    │ • 更新钱包      │
│ • 会员充值      │    │                 │    │ • 处理会员充值  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## ⚡ 快速测试流程

### 文章购买测试
```bash
# 1. 创建文章订单
curl -X POST /order/article \
  -H "Authorization: Bearer TOKEN" \
  -d '{"articleId": 1}'

# 2. 创建支付
curl -X POST /payment/create \
  -H "Authorization: Bearer TOKEN" \
  -d '{"orderId": 1, "paymentMethod": "ALIPAY"}'

# 3. 模拟支付成功
curl -X POST /payment/simulate/1/success \
  -H "Authorization: Bearer TOKEN"

# 4. 查询结果
curl -X GET /payment/record/1 \
  -H "Authorization: Bearer TOKEN"
```

### 会员充值测试
```bash
# 1. 创建会员订单
curl -X POST /order/membership \
  -H "Authorization: Bearer TOKEN" \
  -d '{"duration": 12}'

# 2. 创建支付
curl -X POST /payment/create \
  -H "Authorization: Bearer TOKEN" \
  -d '{"orderId": 1, "paymentMethod": "WECHAT"}'

# 3. 模拟支付成功
curl -X POST /payment/simulate/1/success \
  -H "Authorization: Bearer TOKEN"

# 4. 查询结果
curl -X GET /payment/record/1 \
  -H "Authorization: Bearer TOKEN"
```

## 🚨 常见错误处理

| 错误情况 | 错误码 | 处理方式 |
|----------|--------|----------|
| 文章不存在 | 404 | 检查 articleId 是否正确 |
| 重复购买 | 400 | 检查用户是否已购买过 |
| 订单已支付 | 400 | 检查订单状态 |
| 余额不足 | 400 | 提示用户充值 |
| 支付方式未启用 | 400 | 检查支付配置 |
| 充值时长无效 | 400 | 检查 duration (1-120个月) |

## 📊 状态流转

```
PENDING (待支付)
    ↓ 支付成功
PAID (已支付)
    ↓ 申请退款
REFUNDED (已退款)

PENDING (待支付)
    ↓ 取消订单
CANCELLED (已取消)
```

## 🏆 会员价格

| 项目 | 价格 | 说明 |
|------|------|------|
| VIP会员 | ¥19.9/月 | 可在后台配置中调整价格 |

## 🔧 配置要点

1. **支付配置**: 在 `config` 表中设置支付参数
2. **佣金配置**: 设置邀请者、平台、作者分成比例
3. **回调地址**: 配置公网可访问的回调URL
4. **证书配置**: 微信支付需要配置证书文件
5. **会员配置**: 设置会员价格和名称
   - `membership_price`: 会员月价格（默认19.9元）
   - `membership_name`: 会员名称（默认VIP会员）
   - `membership_enabled`: 是否启用会员功能

## 📝 注意事项

- ✅ 前端不发送支付金额，从订单中获取
- ✅ 支付成功后自动处理佣金分配
- ✅ 支持防重复购买机制
- ✅ 完整的错误处理和状态管理
- ✅ 支持订单取消和退款功能
- ✅ 会员充值自动延长到期时间
- ✅ 会员价格可在后台配置中调整
- ✅ 支持邀请分成机制
