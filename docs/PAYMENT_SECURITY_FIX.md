# 支付安全修复文档

## 修复概述

本次修复解决了支付系统中的多个潜在安全问题，特别是余额支付相关的问题。

## 修复的问题

### 1. 余额为负的问题

**问题描述**:
- 原代码在扣除余额时没有使用数据库事务
- 如果扣款后出现错误，余额无法回滚
- 没有二次检查余额是否会变为负数
- 存在并发扣款的风险

**修复方案**:
- 使用数据库事务确保操作的原子性
- 使用悲观锁（`pessimistic_write`）防止并发问题
- 添加余额充足性检查
- 添加二次检查确保余额不会为负

**修复代码位置**: `src/modules/payment/payment.service.ts` - `createBalancePayment` 方法

### 2. 缺少余额变动记录

**问题描述**:
- 原系统没有记录余额变动历史
- 无法追踪用户余额的变化
- 出现问题时难以排查

**修复方案**:
- 创建 `WalletTransaction` 实体记录所有余额变动
- 创建 `WalletService` 统一管理余额操作
- 每次余额变动都记录交易前后的余额
- 支持查询交易记录和统计

**新增文件**:
- `src/modules/user/entities/wallet-transaction.entity.ts` - 钱包交易记录实体
- `src/modules/user/wallet.service.ts` - 钱包服务

### 3. 退款逻辑不完整

**问题描述**:
- 原退款逻辑只更新订单状态
- 余额支付的订单退款时没有返还余额
- 没有记录退款详情

**修复方案**:
- 使用事务处理退款操作
- 余额支付的订单自动退款到用户余额
- 记录详细的退款信息（金额、时间、方式等）
- 其他支付方式标记为待人工处理

**修复代码位置**: `src/modules/order/order.service.ts` - `requestRefund` 方法

### 4. 并发安全问题

**问题描述**:
- 多个支付请求可能同时扣款
- 可能导致余额被重复扣除

**修复方案**:
- 使用数据库悲观锁（`FOR UPDATE`）
- 确保同一时间只有一个事务能修改用户余额

## 新增功能

### 1. 钱包服务 (WalletService)

提供统一的余额管理接口：

```typescript
// 扣除余额
await walletService.deductBalance(
  userId,
  amount,
  'PAYMENT',
  '购买文章',
  orderId,
  paymentId
);

// 增加余额
await walletService.addBalance(
  userId,
  amount,
  'REFUND',
  '订单退款',
  orderId
);

// 查询余额
const balance = await walletService.getBalance(userId);

// 查询交易记录
const transactions = await walletService.getTransactions(userId, page, limit);

// 查询余额统计
const statistics = await walletService.getBalanceStatistics(userId);
```

### 2. 钱包交易记录表

新增 `wallet_transaction` 表记录所有余额变动：

| 字段 | 说明 |
|------|------|
| id | 交易记录ID |
| userId | 用户ID |
| type | 交易类型（支付、退款、充值、佣金、提现、调整） |
| amount | 交易金额（正数为收入，负数为支出） |
| balanceBefore | 交易前余额 |
| balanceAfter | 交易后余额 |
| orderId | 关联订单ID |
| paymentId | 关联支付记录ID |
| description | 交易描述 |
| remark | 备注 |
| createdAt | 创建时间 |

### 3. 用户钱包接口

新增三个用户钱包相关接口：

```
GET /user/wallet/balance - 获取钱包余额
GET /user/wallet/transactions - 获取交易记录
GET /user/wallet/statistics - 获取余额统计
```

## 技术细节

### 1. 数据库事务

使用 TypeORM 的 QueryRunner 实现事务：

```typescript
const queryRunner = this.userRepository.manager.connection.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  // 执行数据库操作
  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw error;
} finally {
  await queryRunner.release();
}
```

### 2. 悲观锁

使用悲观写锁防止并发问题：

```typescript
const user = await queryRunner.manager.findOne(User, {
  where: { id: userId },
  lock: { mode: 'pessimistic_write' },
});
```

这确保在事务期间，其他事务无法读取或修改该用户记录。

### 3. 余额检查

双重检查确保余额充足：

```typescript
// 第一次检查
if (user.wallet < order.amount) {
  throw new BadRequestException("余额不足");
}

// 计算新余额
const newBalance = user.wallet - order.amount;

// 第二次检查
if (newBalance < 0) {
  throw new BadRequestException("余额不足");
}
```

## 测试建议

### 1. 并发测试

使用多个并发请求测试余额扣除：

```bash
# 使用 Apache Bench 或类似工具
ab -n 100 -c 10 -p payment.json -T application/json \
  http://localhost:3000/payment/create
```

预期结果：
- 所有请求都能正确处理
- 余额不会为负
- 交易记录完整

### 2. 事务回滚测试

模拟支付过程中的错误：

```typescript
// 在支付成功后、佣金分配前抛出错误
// 验证余额是否正确回滚
```

预期结果：
- 余额回滚到原始值
- 支付记录标记为失败
- 订单状态保持为待支付

### 3. 退款测试

测试不同支付方式的退款：

```bash
# 余额支付退款
POST /order/:id/refund
{
  "reason": "测试退款"
}
```

预期结果：
- 余额支付：余额立即返还
- 其他支付：订单标记为待退款
- 交易记录正确记录

## 性能影响

### 1. 悲观锁的影响

- 悲观锁会降低并发性能
- 但确保了数据一致性
- 对于支付场景，安全性优先于性能

### 2. 事务的影响

- 事务增加了数据库开销
- 但确保了操作的原子性
- 建议：
  - 保持事务尽可能短
  - 佣金分配等耗时操作在事务外执行

### 3. 交易记录的影响

- 每次余额变动都会插入一条记录
- 建议：
  - 定期归档历史记录
  - 为 userId 和 createdAt 添加索引

## 数据库迁移

需要创建新表：

```sql
CREATE TABLE `wallet_transaction` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL COMMENT '用户ID',
  `type` enum('PAYMENT','REFUND','RECHARGE','COMMISSION','WITHDRAW','ADJUSTMENT') NOT NULL COMMENT '交易类型',
  `amount` decimal(10,2) NOT NULL COMMENT '交易金额',
  `balanceBefore` decimal(10,2) NOT NULL COMMENT '交易前余额',
  `balanceAfter` decimal(10,2) NOT NULL COMMENT '交易后余额',
  `orderId` int DEFAULT NULL COMMENT '关联订单ID',
  `paymentId` int DEFAULT NULL COMMENT '关联支付记录ID',
  `description` text NOT NULL COMMENT '交易描述',
  `remark` text COMMENT '备注',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `IDX_wallet_transaction_userId` (`userId`),
  KEY `IDX_wallet_transaction_createdAt` (`createdAt`),
  KEY `IDX_wallet_transaction_orderId` (`orderId`),
  KEY `IDX_wallet_transaction_paymentId` (`paymentId`),
  CONSTRAINT `FK_wallet_transaction_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钱包交易记录表';
```

## 监控建议

### 1. 余额异常监控

监控以下指标：
- 余额为负的用户数量（应该为 0）
- 余额变动异常（单次变动过大）
- 交易记录与实际余额不符

### 2. 事务失败监控

监控：
- 事务回滚次数
- 支付失败原因统计
- 并发冲突次数

### 3. 性能监控

监控：
- 支付接口响应时间
- 数据库锁等待时间
- 事务执行时间

## 回滚方案

如果新版本出现问题，可以：

1. 回滚代码到旧版本
2. 保留 `wallet_transaction` 表（不影响旧代码）
3. 手动处理期间产生的交易记录

## 后续优化建议

### 1. 异步处理

将佣金分配等非关键操作改为异步：
- 使用消息队列（如 Redis、RabbitMQ）
- 减少事务持有时间
- 提高并发性能

### 2. 读写分离

对于查询操作：
- 使用只读副本
- 减轻主库压力
- 提高查询性能

### 3. 缓存优化

缓存用户余额：
- 使用 Redis 缓存
- 设置合理的过期时间
- 注意缓存一致性

## 总结

本次修复主要解决了：
1. ✅ 余额为负的问题
2. ✅ 缺少余额变动记录
3. ✅ 退款逻辑不完整
4. ✅ 并发安全问题

新增功能：
1. ✅ 钱包服务 (WalletService)
2. ✅ 钱包交易记录表
3. ✅ 用户钱包接口

确保了支付系统的：
- **安全性** - 使用事务和锁机制
- **可追溯性** - 完整的交易记录
- **一致性** - 余额与记录一致
- **可靠性** - 错误自动回滚

---

**更新日期**: 2025-01-11
**版本**: v1.0.0
