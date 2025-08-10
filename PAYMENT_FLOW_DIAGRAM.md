# 支付系统完整流程图

## 1. 文章购买支付流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant C as Controller
    participant OS as OrderService
    participant PS as PaymentService
    participant CS as CommissionService
    participant DB as Database
    participant PG as Payment Gateway

    Note over U,PG: 1. 创建订单阶段
    U->>F: 点击购买文章
    F->>C: POST /order/article
    Note right of F: {articleId: 1, remark: "购买文章"}
    C->>OS: createArticleOrder(userId, dto)
    OS->>DB: 查询文章信息
    DB-->>OS: 返回文章数据
    OS->>OS: 检查重复购买
    OS->>OS: 验证文章价格
    OS->>DB: 创建订单
    DB-->>OS: 返回订单信息
    OS-->>C: 返回订单
    C-->>F: 返回订单信息
    F-->>U: 显示订单确认页面

    Note over U,PG: 2. 创建支付阶段
    U->>F: 选择支付方式并确认
    F->>C: POST /payment/create
    Note right of F: {orderId: 1, paymentMethod: "ALIPAY"}
    C->>PS: createPayment(dto, userId)
    PS->>DB: 查询订单信息
    DB-->>PS: 返回订单数据
    PS->>PS: 验证订单状态
    PS->>PS: 检查支付方式配置
    PS->>DB: 创建支付记录
    DB-->>PS: 返回支付记录
    PS->>PS: 根据支付方式处理
    PS-->>C: 返回支付信息
    C-->>F: 返回支付URL/二维码
    F-->>U: 显示支付页面

    Note over U,PG: 3. 用户支付阶段
    alt 支付宝支付
        U->>PG: 跳转到支付宝
        PG->>U: 完成支付
        PG->>PS: POST /payment/notify/alipay
    else 微信支付
        U->>PG: 扫码支付
        PG->>U: 完成支付
        PG->>PS: POST /payment/notify/wechat
    else 余额支付
        U->>F: 确认余额支付
        F->>C: POST /payment/create
        Note right of F: {orderId: 1, paymentMethod: "BALANCE"}
        C->>PS: createPayment(dto, userId)
        PS->>PS: 检查余额并扣款
    end

    Note over U,PG: 4. 支付完成处理
    PS->>DB: 更新支付记录状态
    PS->>OS: markOrderAsPaid(orderId, paymentMethod)
    OS->>DB: 更新订单状态为PAID
    PS->>CS: handleOrderPayment(orderId, amount, type, authorId, userId)
    CS->>CS: 计算佣金分配
    CS->>DB: 更新作者钱包
    CS->>DB: 更新邀请者钱包(如果有)
    CS-->>PS: 返回佣金处理结果
    PS-->>PG: 返回支付成功响应
    PS-->>C: 返回处理结果
    C-->>F: 返回支付成功
    F-->>U: 显示支付成功页面
```

## 2. 会员充值支付流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant C as Controller
    participant OS as OrderService
    participant PS as PaymentService
    participant CS as CommissionService
    participant DB as Database
    participant PG as Payment Gateway

    Note over U,PG: 1. 创建会员订单阶段
    U->>F: 选择充值时长
    F->>C: POST /order/membership
    Note right of F: {duration: 12, remark: "充值VIP会员"}
    C->>OS: createMembershipOrder(userId, dto)
    OS->>OS: 验证充值时长
    OS->>OS: 从配置获取会员价格
    OS->>DB: 创建会员订单
    DB-->>OS: 返回订单信息
    OS-->>C: 返回订单
    C-->>F: 返回订单信息
    F-->>U: 显示会员订单确认页面

    Note over U,PG: 2. 创建支付阶段
    U->>F: 选择支付方式并确认
    F->>C: POST /payment/create
    Note right of F: {orderId: 1, paymentMethod: "WECHAT"}
    C->>PS: createPayment(dto, userId)
    PS->>DB: 查询订单信息
    DB-->>PS: 返回订单数据
    PS->>PS: 验证订单状态
    PS->>PS: 检查支付方式配置
    PS->>DB: 创建支付记录
    DB-->>PS: 返回支付记录
    PS->>PS: 根据支付方式处理
    PS-->>C: 返回支付信息
    C-->>F: 返回支付二维码
    F-->>U: 显示支付页面

    Note over U,PG: 3. 用户支付阶段
    U->>PG: 扫码支付
    PG->>U: 完成支付
    PG->>PS: POST /payment/notify/wechat

    Note over U,PG: 4. 支付完成处理
    PS->>DB: 更新支付记录状态
    PS->>OS: markOrderAsPaid(orderId, paymentMethod)
    OS->>DB: 更新订单状态为PAID
    PS->>CS: handleOrderPayment(orderId, amount, type, authorId, userId)
    CS->>CS: 计算佣金分配
    CS->>CS: 处理会员充值逻辑
    CS->>DB: 更新用户会员信息
    CS->>DB: 更新邀请者钱包(如果有)
    CS-->>PS: 返回处理结果
    PS-->>PG: 返回支付成功响应
    PS-->>C: 返回处理结果
    C-->>F: 返回支付成功
    F-->>U: 显示会员充值成功页面
```

## 2. 详细接口调用流程

### 2.1 创建文章订单

```mermaid
graph TD
    A[用户点击购买文章] --> B[前端调用 POST /order/article]
    B --> C[OrderController.createArticleOrder]
    C --> D[OrderService.createArticleOrder]
    D --> E[查询文章信息]
    E --> F{文章是否存在?}
    F -->|否| G[抛出 NotFoundException]
    F -->|是| H{文章需要付费?}
    H -->|否| I[抛出 BadRequestException]
    H -->|是| J{价格是否有效?}
    J -->|否| K[抛出 BadRequestException]
    J -->|是| L{用户是否已购买?}
    L -->|是| M[抛出 BadRequestException]
    L -->|否| N[创建订单]
    N --> O[返回订单信息]
    O --> P[前端显示订单确认页面]
```

**接口详情**:
- **URL**: `POST /order/article`
- **请求体**: `{articleId: number, remark?: string}`
- **响应**: 订单信息包含 `id`, `orderNo`, `amount`, `title` 等

### 2.2 创建支付

```mermaid
graph TD
    A[用户选择支付方式] --> B[前端调用 POST /payment/create]
    B --> C[PaymentController.createPayment]
    C --> D[PaymentService.createPayment]
    D --> E[查询订单信息]
    E --> F{订单是否存在?}
    F -->|否| G[抛出 NotFoundException]
    F -->|是| H{订单状态是否为PENDING?}
    H -->|否| I[抛出 BadRequestException]
    H -->|是| J{支付方式是否启用?}
    J -->|否| K[抛出 BadRequestException]
    J -->|是| L[创建支付记录]
    L --> M{支付方式类型}
    M -->|ALIPAY| N[createAlipayPayment]
    M -->|WECHAT| O[createWechatPayment]
    M -->|BALANCE| P[createBalancePayment]
    N --> Q[返回支付宝支付URL]
    O --> R[返回微信支付二维码]
    P --> S[直接完成支付]
```

**接口详情**:
- **URL**: `POST /payment/create`
- **请求体**: `{orderId: number, paymentMethod: string, details?: string}`
- **响应**: 根据支付方式返回不同的支付信息

### 2.3 支付回调处理

```mermaid
graph TD
    A[支付网关回调] --> B{回调类型}
    B -->|支付宝| C[POST /payment/notify/alipay]
    B -->|微信| D[POST /payment/notify/wechat]
    C --> E[PaymentService.handleAlipayNotify]
    D --> F[PaymentService.handleWechatNotify]
    E --> G[查询订单和支付记录]
    F --> G
    G --> H{支付状态}
    H -->|成功| I[更新支付记录为SUCCESS]
    H -->|失败| J[更新支付记录为FAILED]
    I --> K[调用OrderService.markOrderAsPaid]
    I --> L[调用CommissionService.handleOrderPayment]
    K --> M[更新订单状态为PAID]
    L --> N[计算并分配佣金]
    N --> O[更新用户钱包]
    O --> P[返回处理结果]
```

**接口详情**:
- **支付宝回调**: `POST /payment/notify/alipay`
- **微信回调**: `POST /payment/notify/wechat`
- **请求体**: 支付网关的原始回调数据
- **响应**: `{success: true}`

## 3. 服务间调用关系

### 3.1 支付成功时的服务调用链

```mermaid
graph LR
    A[PaymentService] --> B[OrderService.markOrderAsPaid]
    A --> C[CommissionService.handleOrderPayment]
    B --> D[Database: 更新订单状态]
    C --> E[CommissionService: 计算佣金]
    C --> F[UserService: 更新钱包]
    E --> F
    F --> G[Database: 更新用户余额]
```

### 3.2 数据流向图

```mermaid
graph TD
    A[前端请求] --> B[Controller层]
    B --> C[Service层]
    C --> D[Repository层]
    D --> E[Database]
    
    subgraph "Controller层"
        B1[OrderController]
        B2[PaymentController]
    end
    
    subgraph "Service层"
        C1[OrderService]
        C2[PaymentService]
        C3[CommissionService]
        C4[UserService]
    end
    
    subgraph "Repository层"
        D1[OrderRepository]
        D2[PaymentRepository]
        D3[UserRepository]
        D4[ArticleRepository]
    end
    
    B1 --> C1
    B2 --> C2
    C1 --> D1
    C1 --> D4
    C2 --> D2
    C2 --> C1
    C2 --> C3
    C3 --> C4
    C4 --> D3
```

## 4. 错误处理流程

```mermaid
graph TD
    A[请求开始] --> B{验证阶段}
    B --> C[参数验证]
    C --> D{验证通过?}
    D -->|否| E[返回400错误]
    D -->|是| F[业务逻辑验证]
    F --> G{业务验证通过?}
    G -->|否| H[返回业务错误]
    G -->|是| I[执行业务逻辑]
    I --> J{执行成功?}
    J -->|否| K[返回500错误]
    J -->|是| L[返回成功响应]
    
    subgraph "常见错误"
        E1[订单不存在: 404]
        E2[订单已支付: 400]
        E3[余额不足: 400]
        E4[重复购买: 400]
        E5[支付方式未启用: 400]
    end
```

## 5. 测试流程

```mermaid
sequenceDiagram
    participant T as 测试脚本
    participant C as Controller
    participant PS as PaymentService
    participant OS as OrderService

    T->>C: 1. POST /order/article
    C-->>T: 返回订单信息
    T->>C: 2. POST /payment/create
    C-->>T: 返回支付信息
    T->>C: 3. POST /payment/simulate/{id}/success
    C->>PS: simulatePaymentSuccess(paymentId)
    PS->>OS: markOrderAsPaid(orderId, paymentMethod)
    PS->>CS: handleOrderPayment(...)
    PS-->>C: 返回支付成功
    C-->>T: 返回模拟成功结果
    T->>C: 4. GET /payment/record/{id}
    C-->>T: 返回支付记录
    T->>C: 5. GET /order/{id}
    C-->>T: 返回订单状态
```

## 6. 关键接口总结

| 阶段 | 接口 | 方法 | 说明 |
|------|------|------|------|
| **订单创建** | `/order/article` | POST | 创建文章订单 |
| **支付创建** | `/payment/create` | POST | 创建支付记录 |
| **支付回调** | `/payment/notify/alipay` | POST | 支付宝回调处理 |
| **支付回调** | `/payment/notify/wechat` | POST | 微信回调处理 |
| **支付查询** | `/payment/record/{id}` | GET | 查询支付记录 |
| **订单查询** | `/order/{id}` | GET | 查询订单详情 |
| **模拟支付** | `/payment/simulate/{id}/success` | POST | 测试用支付成功 |
| **订单取消** | `/order/{id}/cancel` | PUT | 取消订单 |
| **申请退款** | `/order/{id}/refund` | POST | 申请退款 |

## 7. 状态流转图

```mermaid
stateDiagram-v2
    [*] --> PENDING: 创建订单
    PENDING --> PAID: 支付成功
    PENDING --> CANCELLED: 取消订单
    PAID --> REFUNDED: 申请退款
    CANCELLED --> [*]
    REFUNDED --> [*]
    PAID --> [*]
```

这个流程图完整展示了从用户点击购买到支付完成的每个步骤，包括所有接口调用和服务间的协作关系。
