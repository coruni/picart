# 成就勋章防重复创建机制

## 问题

在多用户并发完成同一成就时，可能会导致为同一个成就创建多个勋章装饰品。

## 解决方案

### 1. 数据库层面 - 唯一约束

在 `decoration` 表中添加 `achievementId` 字段，并设置唯一约束：

```typescript
@Column({ 
  type: 'int', 
  nullable: true, 
  unique: true, 
  comment: '关联成就ID（成就勋章专用）' 
})
achievementId: number | null;
```

**优点：**
- 数据库级别保证唯一性
- 即使并发创建也不会产生重复数据
- 性能最优

### 2. 应用层面 - 多重查找机制

```typescript
private async grantAchievementBadge(userId: number, achievement: Achievement) {
  let decoration: Decoration | null = null;

  // 第一步：通过 achievementId 查找（最可靠）
  decoration = await this.decorationRepository.findOne({
    where: { 
      achievementId: achievement.id,
      type: 'ACHIEVEMENT_BADGE',
    },
  });

  // 第二步：通过成就的 rewardDecorationId 查找（兼容旧数据）
  if (!decoration && achievement.rewardDecorationId) {
    decoration = await this.decorationRepository.findOne({
      where: { id: achievement.rewardDecorationId },
    });
  }

  // 第三步：创建新勋章（带并发处理）
  if (!decoration) {
    try {
      decoration = await this.decorationRepository.save({
        // ... 勋章数据
        achievementId: achievement.id, // 关键：设置成就ID
      });
    } catch (error: any) {
      // 捕获唯一约束冲突
      if (error.code === 'ER_DUP_ENTRY' || error.code === '23505') {
        // 重新查询已创建的勋章
        decoration = await this.decorationRepository.findOne({
          where: { achievementId: achievement.id },
        });
      }
    }
  }
}
```

## 防重复机制详解

### 查找优先级

1. **achievementId 查找** (最优先)
   - 通过成就ID直接查找
   - 利用唯一索引，查询速度快
   - 保证一对一关系

2. **rewardDecorationId 查找** (兼容性)
   - 兼容旧数据
   - 成就表中已记录的装饰品ID
   - 避免重复创建

3. **创建新勋章** (最后手段)
   - 只在确实不存在时创建
   - 设置 achievementId 确保唯一性
   - 捕获并发冲突异常

### 并发处理

```
用户A完成成就 ─┐
                ├─> 同时查询装饰品（都不存在）
用户B完成成就 ─┘
                │
                ├─> 用户A创建装饰品（成功）
                │   achievementId = 1
                │
                └─> 用户B创建装饰品（失败）
                    唯一约束冲突
                    │
                    └─> 重新查询（找到用户A创建的）
```

### 错误码说明

- `ER_DUP_ENTRY`: MySQL 唯一约束冲突
- `23505`: PostgreSQL 唯一约束冲突

## 数据一致性保证

### 成就 ↔ 装饰品 关联

```typescript
// 创建装饰品后，更新成就的 rewardDecorationId
achievement.rewardDecorationId = decoration.id;
await this.achievementRepository.save(achievement);
```

**好处：**
1. 双向关联，查询更灵活
2. 成就表可以快速找到对应勋章
3. 装饰品表可以反查对应成就

### 用户装饰品去重

```typescript
// 检查用户是否已拥有该装饰品
const existingUserDecoration = await this.userDecorationRepository.findOne({
  where: { userId, decorationId: decoration.id },
});

if (!existingUserDecoration) {
  // 只在不存在时才创建
  await this.userDecorationRepository.save({...});
}
```

## 测试场景

### 1. 单用户完成成就

```
用户完成成就
  ↓
查询装饰品（不存在）
  ↓
创建装饰品
  ↓
添加到用户装饰品库
  ✓ 成功
```

### 2. 多用户并发完成同一成就

```
用户A、B同时完成成就
  ↓
都查询装饰品（都不存在）
  ↓
用户A创建装饰品（成功）
用户B创建装饰品（唯一约束冲突）
  ↓
用户B重新查询（找到A创建的）
  ↓
A、B都添加到各自装饰品库
  ✓ 成功，只创建了一个装饰品
```

### 3. 用户重复完成成就

```
用户完成成就（第一次）
  ↓
创建装饰品并添加
  ✓ 成功

用户再次触发成就事件（第二次）
  ↓
查询装饰品（已存在）
  ↓
检查用户装饰品（已拥有）
  ↓
跳过创建
  ✓ 不会重复添加
```

## 数据库迁移

如果已有数据，需要执行迁移：

```sql
-- 1. 添加 achievementId 字段
ALTER TABLE decoration 
ADD COLUMN achievementId INT NULL 
COMMENT '关联成就ID（成就勋章专用）';

-- 2. 添加唯一索引
ALTER TABLE decoration 
ADD UNIQUE INDEX idx_achievement_id (achievementId);

-- 3. 更新现有成就勋章数据
UPDATE decoration d
INNER JOIN achievement a ON a.rewardDecorationId = d.id
SET d.achievementId = a.id
WHERE d.type = 'ACHIEVEMENT_BADGE';
```

## 监控建议

### 1. 日志记录

```typescript
// 记录勋章创建
console.log(`为成就 ${achievement.id} 创建勋章装饰品 ${decoration.id}`);

// 记录并发冲突
console.warn(`成就 ${achievement.id} 勋章创建冲突，使用已存在的装饰品`);

// 记录异常情况
console.error(`无法为成就 ${achievement.id} 创建或查找装饰品`);
```

### 2. 数据一致性检查

定期检查：
- 每个成就是否只对应一个勋章
- 每个勋章是否正确关联成就
- 用户装饰品是否有重复

```sql
-- 检查重复勋章
SELECT achievementId, COUNT(*) as count
FROM decoration
WHERE type = 'ACHIEVEMENT_BADGE' AND achievementId IS NOT NULL
GROUP BY achievementId
HAVING count > 1;

-- 检查未关联的勋章
SELECT * FROM decoration
WHERE type = 'ACHIEVEMENT_BADGE' AND achievementId IS NULL;
```

## 总结

通过以下机制确保勋章不会重复创建：

✅ **数据库唯一约束** - 最可靠的防护
✅ **多重查找机制** - 避免不必要的创建
✅ **并发冲突处理** - 优雅处理竞态条件
✅ **用户装饰品去重** - 防止重复添加
✅ **双向关联** - 保证数据一致性

这套机制可以在高并发场景下保证数据的唯一性和一致性。
