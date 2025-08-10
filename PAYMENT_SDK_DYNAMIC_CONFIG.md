# 支付SDK动态配置功能

## 概述

本系统实现了支付SDK的动态配置功能，支持在运行时从数据库获取配置并自动重新初始化SDK实例。当数据库中的支付配置发生变化时，系统会自动检测并重新初始化相关的支付SDK。

## 功能特性

### 🔄 动态配置管理
- **数据库配置源**: 所有支付配置存储在数据库中，支持运行时修改
- **自动检测变化**: 使用配置哈希值检测配置是否发生变化
- **智能重新初始化**: 只在配置真正变化时才重新初始化SDK

### 🚀 事件驱动架构
- **配置更新通知**: 使用 `@nestjs/event-emitter` 实现轻量级事件通知
- **自动监听**: `PaymentService` 自动监听配置更新通知
- **精确过滤**: 只处理支付相关的配置更新
- **主动获取**: 收到通知后主动从数据库获取最新配置，减少事件数据量

### 🛡️ 错误处理
- **SDK状态检查**: 在使用SDK前检查是否已正确初始化
- **优雅降级**: 配置不完整时跳过SDK初始化，不影响其他功能
- **详细日志**: 提供详细的初始化和错误日志

## 技术实现

### 1. 配置哈希检测

```typescript
private generateConfigHash(config: any): string {
  const configString = JSON.stringify({
    alipayEnabled: config.alipayEnabled,
    wechatEnabled: config.wechatEnabled,
    alipay: {
      appId: config.alipay.appId,
      gateway: config.alipay.gateway,
    },
    wechat: {
      appId: config.wechat.appId,
      mchId: config.wechat.mchId,
    },
  });
  return Buffer.from(configString).toString('base64');
}
```

### 2. SDK实例管理

```typescript
@Injectable()
export class PaymentService implements OnModuleInit {
  private alipaySdk: AlipaySdk | null = null;
  private wechatPay: WxPay | null = null;
  private lastConfigHash: string = '';

  // 获取SDK实例的方法
  private getAlipaySdk(): AlipaySdk {
    if (!this.alipaySdk) {
      throw new BadRequestException('支付宝SDK未初始化，请检查配置');
    }
    return this.alipaySdk;
  }
}
```

### 3. 事件通知机制

```typescript
@OnEvent('config.updated')
async handleConfigUpdated(payload: { group: string }) {
  // 只处理支付相关的配置更新通知
  if (payload.group === 'payment') {
    console.log('检测到支付配置更新，重新获取配置并初始化SDK');
    await this.reinitializePaymentSDKs();
  }
}
```

### 4. 配置更新通知

```typescript
// 在 ConfigService 中发送通知事件
async updateByKey(key: string, value: string) {
  const config = await this.configRepository.findOne({ where: { key } });
  if (!config) {
    throw new Error(`配置 ${key} 不存在`);
  }
  config.value = value;
  const updatedConfig = await this.configRepository.save(config);
  
  // 发送配置更新通知事件（只包含分组信息）
  this.eventEmitter.emit('config.updated', {
    group: updatedConfig.group,
  });
  
  return updatedConfig;
}
```

## 配置项

### 支付宝配置
- `payment_alipay_enabled`: 是否启用支付宝支付
- `payment_alipay_app_id`: 支付宝应用ID
- `payment_alipay_private_key`: 支付宝私钥
- `payment_alipay_public_key`: 支付宝公钥
- `payment_alipay_gateway`: 支付宝网关地址

### 微信支付配置
- `payment_wechat_enabled`: 是否启用微信支付
- `payment_wechat_app_id`: 微信支付应用ID
- `payment_wechat_mch_id`: 微信支付商户号
- `payment_wechat_api_key`: 微信支付API密钥
- `payment_wechat_private_key`: 微信支付私钥（PEM格式）
- `payment_wechat_public_key`: 微信支付公钥（PEM格式）
- `payment_wechat_serial_no`: 微信支付证书序列号

### 通用配置
- `payment_notify_url`: 支付回调地址
- `payment_return_url`: 支付返回地址

## 使用流程

### 1. 初始化阶段
```typescript
async onModuleInit() {
  await this.initializePaymentSDKs();
}
```

### 2. 配置更新流程
1. 管理员通过API更新支付配置
2. `ConfigService` 保存配置到数据库
3. 发送 `config.updated` 事件
4. `PaymentService` 监听事件并重新初始化SDK
5. 生成新的配置哈希值

### 3. 支付创建流程
1. 检查支付方式是否启用
2. 获取对应的SDK实例
3. 使用SDK创建支付订单
4. 返回支付URL或二维码

### 4. 微信支付SDK集成

#### 初始化配置
```typescript
// 微信支付SDK初始化
this.wechatPay = new WxPay({
  appid: paymentConfig.wechat.appId,
  mchid: paymentConfig.wechat.mchId,
  privateKey: Buffer.from(paymentConfig.wechat.privateKey),
  publicKey: Buffer.from(paymentConfig.wechat.publicKey),
  serial_no: paymentConfig.wechat.serialNo,
  key: paymentConfig.wechat.apiKey,
});
```

#### 创建支付订单
```typescript
// 使用微信支付SDK创建支付订单
const result = await wechatPay.transactions_native({
  description: order.title,
  out_trade_no: order.orderNo,
  amount: {
    total: Math.round(order.amount * 100), // 转换为分
  },
  notify_url: paymentConfig.notifyUrl + '/wechat',
}) as any;
```

#### 回调验证
```typescript
// 使用微信支付SDK验证回调签名
const isValid = await (wechatPay as any).verifyNotifySign(notifyData);
```

## 测试方法

### 1. 运行测试脚本
```bash
# 测试事件通知机制
node test-event-notification.js

# 测试微信支付SDK集成
node test-wechat-payment.js
```

### 2. 手动测试步骤
1. 启动应用服务器
2. 通过API更新支付配置
3. 观察服务器日志中的SDK初始化信息
4. 测试创建支付订单

### 3. 验证要点
- ✅ 配置更新后SDK自动重新初始化
- ✅ 配置未变化时跳过重新初始化
- ✅ 配置不完整时优雅降级
- ✅ 支付创建使用最新的SDK实例

## 日志示例

### 正常初始化
```
开始初始化支付SDK...
支付宝SDK初始化成功
微信支付SDK初始化成功
支付SDK初始化完成
```

### 配置更新
```
检测到支付配置更新: payment_alipay_app_id
检测到配置更新，重新初始化支付SDK...
开始初始化支付SDK...
支付宝SDK初始化成功
支付SDK初始化完成
```

### 配置不完整
```
开始初始化支付SDK...
支付宝配置不完整，跳过SDK初始化
微信支付配置不完整，跳过SDK初始化
支付SDK初始化完成
```

## 注意事项

1. **配置完整性**: 确保所有必需的配置项都已设置
2. **密钥安全**: 私钥等敏感信息应妥善保管
3. **网络环境**: 确保服务器能访问支付宝和微信的API
4. **日志监控**: 定期检查SDK初始化日志
5. **错误处理**: 配置错误时系统会抛出异常，需要及时处理

## 扩展功能

### 1. 配置验证
可以添加配置验证逻辑，确保配置的完整性和正确性。

### 2. 多环境支持
可以支持不同环境（开发、测试、生产）的配置管理。

### 3. 配置备份
可以实现配置的自动备份和恢复功能。

### 4. 监控告警
可以添加配置变化的监控和告警功能。
