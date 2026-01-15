# I18N Keys 文档

本文档列出了项目中所有使用的国际化（i18n）键值，方便开发者查找和使用。

## 目录

- [错误消息 (response.error)](#错误消息-responseerror)
- [成功消息 (response.success)](#成功消息-responsesuccess)

---

## 错误消息 (response.error)

### 用户相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.error.userNotExist` | 用户不存在 | 查找用户时未找到 |
| `response.error.usernameAlreadyExists` | 用户名已存在 | 注册时用户名重复 |
| `response.error.emailAlreadyExists` | 邮箱已存在 | 注册时邮箱重复 |
| `response.error.passwordError` | 密码错误 | 登录时密码不正确 |
| `response.error.oldPasswordError` | 原密码错误 | 修改密码时原密码不正确 |
| `response.error.passwordLengthError` | 密码长度错误 | 密码长度小于6位 |
| `response.error.newPasswordSame` | 新密码与原密码相同 | 修改密码时新旧密码一致 |
| `response.error.userNoPermission` | 用户无权限 | 用户没有执行操作的权限 |

### 角色和权限

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.error.superAdminRoleNotExist` | 超级管理员角色不存在 | 系统初始化时未找到超级管理员角色 |
| `response.error.userRoleNotExist` | 普通用户角色不存在 | 注册时未找到普通用户角色 |
| `response.error.onlySuperAdminCanSpecifyRole` | 只有超级管理员可以指定角色 | 非超级管理员尝试指定角色 |

### 邀请码

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.error.inviteCodeRequired` | 邀请码必填 | 注册时未提供必需的邀请码 |
| `response.error.inviteCodeNotExist` | 邀请码不存在 | 提供的邀请码无效 |
| `response.error.inviteCodeUsed` | 邀请码已使用 | 邀请码已被使用 |
| `response.error.inviteCodeExpired` | 邀请码已过期 | 邀请码超过有效期 |

### 验证码

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.error.emailVerificationCodeRequired` | 邮箱验证码必填 | 启用邮箱验证时未提供验证码 |
| `response.error.verificationCodeExpired` | 验证码已过期 | 验证码超过有效期 |
| `response.error.verificationCodeError` | 验证码错误 | 验证码不正确 |
| `response.error.tooManyRequests` | 请求过于频繁 | 短时间内重复发送验证码 |

### Token 相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.error.refreshTokenInvalid` | 刷新令牌无效 | 刷新令牌不存在或无效 |
| `response.error.refreshTokenExpired` | 刷新令牌已过期 | 刷新令牌超过有效期 |
| `response.error.unauthorized` | 未授权 | JWT 验证失败 |
| `response.error.tokenInvalid` | 令牌无效 | Token 验证失败 |
| `response.error.userNotLogin` | 用户未登录 | 需要登录但用户未登录 |

### 关注相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.error.followSelf` | 不能关注自己 | 尝试关注自己 |
| `response.error.followed` | 已关注 | 重复关注同一用户 |
| `response.error.unfollowSelf` | 不能取关自己 | 尝试取关自己 |
| `response.error.unfollowed` | 未关注 | 取关未关注的用户 |

### 钱包相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.error.amountMustBePositive` | 金额必须大于0 | 金额验证失败 |
| `response.error.insufficientBalance` | 余额不足 | 钱包余额不足以完成操作 |
| `response.error.insufficientPoints` | 积分不足 | 积分余额不足 |

### 积分相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.error.pointsRuleNotFound` | 积分规则不存在 | 未找到指定的积分规则 |
| `response.error.pointsDailyLimitReached` | 积分每日限制已达上限 | 超过每日积分获取限制 |
| `response.error.pointsTotalLimitReached` | 积分总限制已达上限 | 超过总积分获取限制 |
| `response.error.pointsRuleCodeExists` | 积分规则代码已存在 | 创建积分规则时代码重复 |
| `response.error.pointsTaskCodeExists` | 积分任务代码已存在 | 创建积分任务时代码重复 |
| `response.error.pointsTaskNotFound` | 积分任务不存在 | 未找到指定的积分任务 |
| `response.error.pointsTaskRecordNotFound` | 积分任务记录不存在 | 未找到任务记录 |
| `response.error.pointsTaskNotCompleted` | 积分任务未完成 | 任务未完成时尝试领取奖励 |
| `response.error.pointsTaskAlreadyRewarded` | 积分任务奖励已领取 | 重复领取任务奖励 |

### 权限相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.error.permissionDenied` | 权限被拒绝 | 用户没有执行操作的权限 |

---

## 成功消息 (response.success)

### 用户相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.success.userUpdate` | 用户更新成功 | 更新用户信息 |
| `response.success.userDelete` | 用户删除成功 | 删除用户 |
| `response.success.logout` | 登出成功 | 用户登出 |
| `response.success.follow` | 关注成功 | 关注用户 |
| `response.success.unfollow` | 取关成功 | 取消关注用户 |
| `response.success.passwordResetSuccess` | 密码重置成功 | 重置密码 |
| `response.success.passwordChangeSuccess` | 密码修改成功 | 修改密码 |
| `response.success.configUpdateSuccess` | 配置更新成功 | 更新用户配置 |

### 验证码相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.success.verificationCodeSent` | 验证码发送成功 | 发送邮箱验证码 |
| `response.success.resetPasswordEmailSent` | 重置密码邮件发送成功 | 发送重置密码邮件 |
| `response.success.verificationCodeSuccess` | 验证码验证成功 | 验证码验证通过 |

### 会员相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.success.membershipExpired` | 会员已过期 | 检查会员状态时发现已过期 |
| `response.success.membershipValid` | 会员有效 | 会员状态有效 |
| `response.success.noExpiredMemberships` | 没有过期的会员 | 批量更新会员状态时无过期会员 |
| `response.success.membershipStatusUpdated` | 会员状态已更新 | 批量更新会员状态 |

### 等级经验相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.success.levelUp` | 升级成功 | 用户等级提升 |
| `response.success.experienceAdd` | 经验增加成功 | 增加经验值 |

### 标签相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.success.tagCreate` | 标签创建成功 | 创建标签 |
| `response.success.tagUpdate` | 标签更新成功 | 更新标签 |
| `response.success.tagDelete` | 标签删除成功 | 删除标签 |

### 角色相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.success.roleCreate` | 角色创建成功 | 创建角色 |
| `response.success.roleUpdate` | 角色更新成功 | 更新角色 |
| `response.success.roleDelete` | 角色删除成功 | 删除角色 |
| `response.success.permissionsAssigned` | 权限分配成功 | 为角色分配权限 |
| `response.success.roleEnabled` | 角色启用成功 | 启用角色 |
| `response.success.roleDisabled` | 角色禁用成功 | 禁用角色 |
| `response.success.roleCopied` | 角色复制成功 | 复制角色 |

### 权限相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.success.permissionCreate` | 权限创建成功 | 创建权限 |
| `response.success.permissionUpdate` | 权限更新成功 | 更新权限 |
| `response.success.permissionDelete` | 权限删除成功 | 删除权限 |

### 举报相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.success.reportDelete` | 举报删除成功 | 删除举报记录 |

### 积分相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.success.pointsAdd` | 积分增加成功 | 增加积分 |
| `response.success.pointsSpend` | 积分消费成功 | 消费积分 |
| `response.success.pointsRuleCreate` | 积分规则创建成功 | 创建积分规则 |
| `response.success.pointsRuleUpdate` | 积分规则更新成功 | 更新积分规则 |
| `response.success.pointsRuleDelete` | 积分规则删除成功 | 删除积分规则 |
| `response.success.pointsTaskCreate` | 积分任务创建成功 | 创建积分任务 |
| `response.success.pointsTaskUpdate` | 积分任务更新成功 | 更新积分任务 |
| `response.success.pointsTaskDelete` | 积分任务删除成功 | 删除积分任务 |
| `response.success.pointsTaskRewardClaimed` | 积分任务奖励领取成功 | 领取任务奖励 |

### 支付相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.success.createAlipayPayment` | 支付宝支付创建成功 | 创建支付宝支付 |
| `response.success.createWechatPayment` | 微信支付创建成功 | 创建微信支付 |
| `response.success.createEpayPayment` | 易支付创建成功 | 创建易支付 |
| `response.success.blanceDone` | 余额支付完成 | 余额支付成功 |
| `response.success.simulatePaymentSuccess` | 模拟支付成功 | 测试环境模拟支付 |
| `response.success.testEpaySignature` | 易支付签名测试成功 | 测试易支付签名 |

### 订单相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.success.orderCreate` | 订单创建成功 | 创建订单 |
| `response.success.refundSuccess` | 退款成功 | 退款处理完成 |
| `response.success.refundApplied` | 退款申请成功 | 提交退款申请 |

### 邀请相关

| Key | 描述 | 使用场景 |
|-----|------|---------|
| `response.success.inviteCreate` | 邀请创建成功 | 创建邀请 |

---

## 使用说明

### 在代码中使用

```typescript
// 错误消息
throw new NotFoundException('response.error.userNotExist');
throw new BadRequestException('response.error.insufficientBalance');

// 成功消息
return {
  success: true,
  message: 'response.success.userUpdate',
  data: updatedUser,
};
```

### 命名规范

1. **格式**: `response.{type}.{key}`
   - `type`: `error` 或 `success`
   - `key`: 驼峰命名，描述性强

2. **示例**:
   - `response.error.userNotExist` - 用户不存在错误
   - `response.success.userUpdate` - 用户更新成功

### 添加新的 i18n Key

1. 在代码中使用新的 key
2. 在对应的语言文件中添加翻译（通常在 `i18n` 或 `locales` 目录）
3. 更新本文档

### 语言文件示例

```json
{
  "response": {
    "error": {
      "userNotExist": "用户不存在",
      "insufficientBalance": "余额不足"
    },
    "success": {
      "userUpdate": "用户更新成功",
      "logout": "登出成功"
    }
  }
}
```

---

## 维护说明

- 本文档应与代码保持同步
- 添加新的 i18n key 时，请及时更新本文档
- 定期检查并清理未使用的 key
- 建议使用脚本自动扫描和更新

---

**最后更新**: 2026-01-15
