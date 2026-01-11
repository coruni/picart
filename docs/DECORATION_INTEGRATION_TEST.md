# 装饰品系统集成测试指南

本文档提供装饰品系统的完整测试流程，验证所有功能是否正常工作。

## 前置条件

1. 系统已启动并运行
2. 已有测试用户账号（至少2个，用于测试赠送功能）
3. 已创建测试文章（用于点赞和评论）

## 测试流程

### 1. 创建装饰品

#### 1.1 创建可购买的头像框

```bash
POST /decoration
Content-Type: application/json
Authorization: Bearer {admin_token}

{
  "name": "金色头像框",
  "type": "AVATAR_FRAME",
  "description": "华丽的金色头像框",
  "imageUrl": "https://example.com/gold-frame.png",
  "rarity": "EPIC",
  "obtainMethod": "PURCHASE",
  "isPurchasable": true,
  "price": 99.00,
  "isPermanent": false,
  "validDays": 30,
  "status": "ACTIVE"
}
```

**预期结果**: 返回创建成功，记录装饰品ID（例如：decorationId = 1）

#### 1.2 创建可购买的评论气泡

```bash
POST /decoration
Content-Type: application/json
Authorization: Bearer {admin_token}

{
  "name": "粉色气泡",
  "type": "COMMENT_BUBBLE",
  "description": "可爱的粉色评论气泡",
  "imageUrl": "https://example.com/pink-bubble.png",
  "rarity": "RARE",
  "obtainMethod": "PURCHASE",
  "isPurchasable": true,
  "price": 49.00,
  "isPermanent": true,
  "status": "ACTIVE"
}
```

**预期结果**: 返回创建成功，记录装饰品ID（例如：decorationId = 2）

### 2. 创建活动

#### 2.1 创建点赞活动

```bash
POST /decoration/activity
Content-Type: application/json
Authorization: Bearer {admin_token}

{
  "name": "点赞10次送头像框",
  "description": "点赞文章10次即可获得限时头像框",
  "type": "LIKE",
  "decorationId": 1,
  "requiredLikes": 10,
  "requiredComments": 0,
  "requiredShares": 0,
  "requiredSignInDays": 0,
  "isPermanent": false,
  "validDays": 7,
  "status": "ACTIVE"
}
```

**预期结果**: 返回创建成功，记录活动ID（例如：activityId = 1）

#### 2.2 创建评论活动

```bash
POST /decoration/activity
Content-Type: application/json
Authorization: Bearer {admin_token}

{
  "name": "评论5次送气泡",
  "description": "发表评论5次即可获得永久评论气泡",
  "type": "COMMENT",
  "decorationId": 2,
  "requiredLikes": 0,
  "requiredComments": 5,
  "requiredShares": 0,
  "requiredSignInDays": 0,
  "isPermanent": true,
  "status": "ACTIVE"
}
```

**预期结果**: 返回创建成功，记录活动ID（例如：activityId = 2）

### 3. 测试购买功能

#### 3.1 查看装饰品列表

```bash
GET /decoration?type=AVATAR_FRAME&status=ACTIVE
Authorization: Bearer {user_token}
```

**预期结果**: 返回装饰品列表，包含刚创建的金色头像框

#### 3.2 购买装饰品

```bash
POST /decoration/purchase
Content-Type: application/json
Authorization: Bearer {user_token}

{
  "decorationId": 1
}
```

**预期结果**: 
- 返回购买成功
- 用户余额减少 99.00
- 创建钱包交易记录
- 创建用户装饰品记录

#### 3.3 验证余额扣除

```bash
GET /user/wallet/balance
Authorization: Bearer {user_token}
```

**预期结果**: 余额减少 99.00

#### 3.4 验证交易记录

```bash
GET /user/wallet/transactions
Authorization: Bearer {user_token}
```

**预期结果**: 有一条类型为 PAYMENT 的交易记录，金额为 -99.00

### 4. 测试使用装饰品

#### 4.1 查看我的装饰品

```bash
GET /decoration/user/my
Authorization: Bearer {user_token}
```

**预期结果**: 返回用户拥有的装饰品列表，包含刚购买的头像框

#### 4.2 使用装饰品

```bash
POST /decoration/use/1
Authorization: Bearer {user_token}
```

**预期结果**: 
- 返回装备成功
- 装饰品的 isUsing 字段变为 true

#### 4.3 查看当前使用的装饰品

```bash
GET /decoration/user/current/decorations
Authorization: Bearer {user_token}
```

**预期结果**: 
```json
{
  "avatarFrame": {
    "id": 1,
    "decoration": {
      "name": "金色头像框",
      "imageUrl": "https://example.com/gold-frame.png"
    }
  },
  "commentBubble": null
}
```

### 5. 测试活动进度追踪

#### 5.1 查看初始活动进度

```bash
GET /decoration/activity/progress/my
Authorization: Bearer {user_token}
```

**预期结果**: 返回空数组或初始进度（如果已有点赞/评论）

#### 5.2 点赞文章（触发事件）

```bash
POST /article/{articleId}/like
Authorization: Bearer {user_token}
```

**重复执行**: 点赞不同的文章 10 次

**预期结果**: 每次点赞后，点赞活动进度自动增加

#### 5.3 查看点赞活动进度

```bash
GET /decoration/activity/progress/my
Authorization: Bearer {user_token}
```

**预期结果**: 
```json
[
  {
    "id": 1,
    "activityId": 1,
    "currentLikes": 10,
    "currentComments": 0,
    "isCompleted": true,
    "isRewarded": false,
    "completedAt": "2025-01-11T10:30:00.000Z"
  }
]
```

#### 5.4 发表评论（触发事件）

```bash
POST /comment
Content-Type: application/json
Authorization: Bearer {user_token}

{
  "articleId": 1,
  "content": "测试评论内容"
}
```

**重复执行**: 发表 5 条评论

**预期结果**: 每次评论后，评论活动进度自动增加

#### 5.5 查看评论活动进度

```bash
GET /decoration/activity/progress/my
Authorization: Bearer {user_token}
```

**预期结果**: 
```json
[
  {
    "id": 1,
    "activityId": 1,
    "currentLikes": 10,
    "isCompleted": true,
    "isRewarded": false
  },
  {
    "id": 2,
    "activityId": 2,
    "currentComments": 5,
    "isCompleted": true,
    "isRewarded": false
  }
]
```

### 6. 测试领取活动奖励

#### 6.1 领取点赞活动奖励

```bash
POST /decoration/activity/claim/1
Authorization: Bearer {user_token}
```

**预期结果**: 
- 返回领取成功
- 创建用户装饰品记录
- 进度标记为已领取（isRewarded = true）
- 活动完成人数 +1

#### 6.2 领取评论活动奖励

```bash
POST /decoration/activity/claim/2
Authorization: Bearer {user_token}
```

**预期结果**: 
- 返回领取成功
- 创建用户装饰品记录（永久）

#### 6.3 验证装饰品已获得

```bash
GET /decoration/user/my
Authorization: Bearer {user_token}
```

**预期结果**: 返回3个装饰品（1个购买的 + 2个活动奖励）

### 7. 测试赠送功能

#### 7.1 赠送装饰品

```bash
POST /decoration/gift
Content-Type: application/json
Authorization: Bearer {user_token}

{
  "toUserId": 2,
  "decorationId": 1,
  "message": "送你一个头像框"
}
```

**预期结果**: 
- 返回赠送成功
- 接收者获得装饰品
- 赠送者的装饰品不会消失

#### 7.2 验证接收者收到装饰品

```bash
GET /decoration/user/my
Authorization: Bearer {user2_token}
```

**预期结果**: 接收者的装饰品列表中有赠送的头像框

### 8. 测试过期清理

#### 8.1 清理过期装饰品

```bash
POST /decoration/clean-expired
Authorization: Bearer {admin_token}
```

**预期结果**: 
- 返回清理成功
- 显示清理的装饰品数量
- 过期且正在使用的装饰品被取消使用

### 9. 测试边界情况

#### 9.1 重复购买

```bash
POST /decoration/purchase
Content-Type: application/json
Authorization: Bearer {user_token}

{
  "decorationId": 1
}
```

**预期结果**: 返回错误 "您已拥有该装饰品"

#### 9.2 余额不足

```bash
POST /decoration/purchase
Content-Type: application/json
Authorization: Bearer {user_token}

{
  "decorationId": 999
}
```

**预期结果**: 返回错误 "余额不足"

#### 9.3 重复领取奖励

```bash
POST /decoration/activity/claim/1
Authorization: Bearer {user_token}
```

**预期结果**: 返回错误 "奖励已领取"

#### 9.4 未完成活动领取奖励

创建新用户，直接尝试领取：

```bash
POST /decoration/activity/claim/1
Authorization: Bearer {new_user_token}
```

**预期结果**: 返回错误 "活动未完成" 或 "未参与该活动"

## 验证清单

- [ ] 装饰品创建成功
- [ ] 活动创建成功
- [ ] 购买装饰品成功，余额正确扣除
- [ ] 钱包交易记录正确创建
- [ ] 装饰品可以正常使用和取消使用
- [ ] 点赞文章自动更新活动进度
- [ ] 发表评论自动更新活动进度
- [ ] 活动完成后可以领取奖励
- [ ] 领取奖励后获得装饰品
- [ ] 赠送功能正常工作
- [ ] 过期装饰品自动清理
- [ ] 边界情况正确处理（重复购买、余额不足等）

## 数据库验证

### 检查装饰品表

```sql
SELECT * FROM decoration;
```

**预期**: 有2条记录（金色头像框和粉色气泡）

### 检查用户装饰品表

```sql
SELECT * FROM user_decoration WHERE userId = {test_user_id};
```

**预期**: 有3条记录（1个购买 + 2个活动奖励）

### 检查活动表

```sql
SELECT * FROM decoration_activity;
```

**预期**: 有2条记录（点赞活动和评论活动）

### 检查活动进度表

```sql
SELECT * FROM user_activity_progress WHERE userId = {test_user_id};
```

**预期**: 有2条记录，都已完成且已领取

### 检查钱包交易表

```sql
SELECT * FROM wallet_transaction WHERE userId = {test_user_id};
```

**预期**: 有1条 PAYMENT 类型的记录，金额为 -99.00

## 性能测试

### 并发点赞测试

使用工具（如 Apache Bench 或 k6）模拟多个用户同时点赞：

```bash
# 100个并发请求
ab -n 100 -c 10 -H "Authorization: Bearer {token}" \
   -p like.json -T application/json \
   http://localhost:3000/article/1/like
```

**预期**: 
- 所有请求成功
- 活动进度正确累加
- 无数据库死锁或并发问题

### 并发购买测试

模拟多个用户同时购买装饰品：

```bash
# 50个并发请求
ab -n 50 -c 5 -H "Authorization: Bearer {token}" \
   -p purchase.json -T application/json \
   http://localhost:3000/decoration/purchase
```

**预期**: 
- 余额扣除正确
- 无重复购买
- 无余额为负的情况

## 故障恢复测试

### 事件处理失败

1. 临时停止装饰品服务
2. 执行点赞操作
3. 重启装饰品服务

**预期**: 点赞操作成功，但活动进度未更新（事件处理失败不影响主业务）

### 数据库事务回滚

1. 模拟余额不足的情况
2. 尝试购买装饰品

**预期**: 
- 返回错误
- 余额未扣除
- 未创建用户装饰品记录
- 未创建钱包交易记录

## 监控指标

建议监控以下指标：

1. **装饰品购买成功率**: 应接近 100%
2. **事件处理延迟**: 应小于 100ms
3. **活动进度更新成功率**: 应接近 100%
4. **余额扣除准确性**: 应为 100%
5. **并发购买冲突率**: 应为 0%

## 常见问题

### Q: 点赞后活动进度没有更新？

A: 检查以下几点：
1. 活动状态是否为 ACTIVE
2. 活动类型是否为 LIKE
3. 事件是否正确触发（查看日志）
4. DecorationEventService 是否正常运行

### Q: 购买装饰品后余额没有扣除？

A: 检查：
1. WalletService 是否正常工作
2. 数据库事务是否提交
3. 查看错误日志

### Q: 装饰品显示已过期但还在使用？

A: 执行清理命令：
```bash
POST /decoration/clean-expired
```

---

**测试完成日期**: 2025-01-11
**测试版本**: v1.4.0
