# 积分系统重构总结

## 重构内容

### 1. 合并实体
- **删除**: `PointsRule` 和 `PointsTask` 实体
- **新增**: `PointsActivity` 实体，统一管理积分规则和任务

### 2. 实体字段对比

#### PointsActivity（新）
```typescript
{
  id: number;
  code: string;                    // 活动代码
  name: string;                    // 活动名称
  description: string;             // 活动描述
  type: 'INSTANT' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONCE';  // 活动类型
  rewardPoints: number;            // 奖励积分
  targetCount: number;             // 目标数量
  dailyLimit: number;              // 每日限制次数
  totalLimit: number;              // 总限制次数
  validDays: number;               // 积分有效期
  icon: string;                    // 活动图标
  link: string;                    // 跳转链接
  isActive: boolean;               // 是否启用
  sort: number;                    // 排序
}
```

#### 原 PointsRule（已删除）
```typescript
{
  id, code, name, description,
  points,                          // → rewardPoints
  dailyLimit, totalLimit, validDays,
  isActive, sort
}
```

#### 原 PointsTask（已删除）
```typescript
{
  id, code, name, description,
  type,                           // 保留
  rewardPoints,                   // 保留
  targetCount,                    // 保留
  icon, link,                     // 保留
  isActive, sort                  // 保留
}
```

### 3. 活动类型说明

- **INSTANT**: 即时积分奖励（原 PointsRule 的功能）
  - 如：点赞、评论、发文章等立即获得积分
  - 支持每日限制和总限制
  
- **DAILY/WEEKLY/MONTHLY/ONCE**: 周期性任务（原 PointsTask 的功能）
  - 如：每日签到、每周发3篇文章等
  - 需要完成目标数量才能领取奖励

### 4. 种子数据更新

**文件**: `src/modules/points/points-activities.seed.ts`

包含14个预设活动：
- 7个即时积分活动（原规则）
- 4个周期性任务（原任务）

### 5. API 接口更新

#### 新接口结构
```
GET    /points/activities          # 获取活动列表
GET    /points/activities/:id      # 获取活动详情
POST   /points/activities          # 创建活动
PATCH  /points/activities/:id      # 更新活动
DELETE /points/activities/:id      # 删除活动
POST   /points/activities/:id/claim # 领取任务奖励
```

#### 删除的接口
```
/points/rules/*     # 积分规则管理接口
/points/tasks/*     # 积分任务管理接口
```

### 6. 数据库变更

#### 新增表
- `points_activity` - 积分活动表

#### 删除表
- `points_rule` - 积分规则表
- `points_task` - 积分任务表

#### 修改表
- `points_task_record` - 任务记录表
  - `task` 关联改为指向 `PointsActivity`
- `user` - 用户表
  - 新增 `points` 字段（int，默认0）

### 7. 服务方法更新

#### 保留方法
- `addPoints()` - 增加积分
- `spendPoints()` - 消费积分
- `addPointsByRule()` - 根据活动增加积分（内部逻辑更新）
- `getTransactions()` - 获取交易记录
- `getBalance()` - 获取积分余额

#### 新增方法
- `createActivity()` - 创建活动
- `findAllActivities()` - 获取活动列表
- `findOneActivity()` - 获取活动详情
- `updateActivity()` - 更新活动
- `removeActivity()` - 删除活动
- `updateTaskProgress()` - 更新任务进度
- `claimTaskReward()` - 领取任务奖励

#### 删除方法
- `createRule()`, `findAllRules()`, `updateRule()`, `removeRule()`
- `createTask()`, `findAllTasks()`, `updateTask()`, `removeTask()`

### 8. 自动初始化

应用启动时会自动初始化种子数据，包括：
- 即时积分活动（每日登录、发文章、评论等）
- 周期性任务（每日签到任务、每周发文任务等）

### 9. 向后兼容

- `addPointsByRule(activityCode)` 方法保持不变，内部改为查询 `PointsActivity`
- 事件监听器（如 `points-event.service.ts`）无需修改
- 积分交易记录格式保持不变

## 迁移建议

1. **数据迁移**: 需要将现有的 `points_rule` 和 `points_task` 数据迁移到 `points_activity`
2. **前端更新**: 更新管理界面的 API 调用
3. **测试**: 重点测试积分获取和任务完成流程

## 优势

1. **统一管理**: 一个实体管理所有积分相关活动
2. **减少重复**: 消除了规则和任务之间的重复字段
3. **灵活配置**: 通过 `type` 字段区分不同类型的积分活动
4. **易于扩展**: 新增活动类型只需扩展 `type` 枚举