# JWT 认证修复说明

## 问题描述

使用 Bearer Token 访问 API 时出现 "User not authenticated" 错误。

## 问题原因

JWT 策略中使用了缓存来验证 token，但是生成 token 时没有将 token 存储到缓存中，导致验证失败。

## 修复内容

### 1. 修改 JwtUtil 类
- 添加了缓存管理器参数
- 生成 token 时自动存储到缓存
- 添加了清除 token 缓存的方法

### 2. 修改 UserService
- 注入缓存管理器
- 修改 login 和 refreshToken 方法为异步
- logout 时清除缓存中的 token

### 3. 修改 UserModule
- 导入 CacheModule

## 测试步骤

### 1. 重新登录获取新 token
```bash
POST /user/login
{
  "username": "mapleme",
  "password": "123456"
}
```

### 2. 使用新 token 访问 API
```bash
GET /api/v1/category
Authorization: Bearer <new_token>
```

## 缓存机制

- **Access Token**: 存储在 `user:{userId}:token`，1小时过期
- **Refresh Token**: 存储在 `user:{userId}:refresh`，7天过期
- **登出时**: 自动清除缓存中的 token

## 注意事项

1. 需要重新登录获取新的 token
2. 旧的 token 将无法使用
3. 确保 Redis 缓存服务正常运行 