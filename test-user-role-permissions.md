# 用户创建角色权限控制测试

## 功能说明

创建用户时，只有超级管理员可以指定用户角色，其他用户（包括普通管理员）创建的用户默认只能拥有普通用户角色。

## 测试场景

### 1. 普通注册（无当前用户）
```bash
POST /user/register
{
  "username": "newuser",
  "password": "123456",
  "nickname": "新用户",
  "email": "newuser@example.com"
}
```
**结果**：用户被创建，自动分配普通用户角色（user）

### 2. 普通管理员创建用户（不指定角色）
```bash
POST /user
Authorization: Bearer <admin_token>
{
  "username": "testuser1",
  "password": "123456",
  "nickname": "测试用户1",
  "email": "test1@example.com"
}
```
**结果**：用户被创建，自动分配普通用户角色（user）

### 3. 普通管理员创建用户（尝试指定角色）
```bash
POST /user
Authorization: Bearer <admin_token>
{
  "username": "testuser2",
  "password": "123456",
  "nickname": "测试用户2",
  "email": "test2@example.com",
  "roleIds": [1, 2]  # 尝试指定角色
}
```
**结果**：返回 403 错误 - "只有超级管理员可以指定用户角色"

### 4. 超级管理员创建用户（指定角色）
```bash
POST /user
Authorization: Bearer <super_admin_token>
{
  "username": "adminuser",
  "password": "123456",
  "nickname": "管理员用户",
  "email": "admin@example.com",
  "roleIds": [1, 2]  # 指定角色
}
```
**结果**：用户被创建，分配指定的角色

### 5. 超级管理员创建用户（不指定角色）
```bash
POST /user
Authorization: Bearer <super_admin_token>
{
  "username": "normaluser",
  "password": "123456",
  "nickname": "普通用户",
  "email": "normal@example.com"
}
```
**结果**：用户被创建，自动分配普通用户角色（user）

## 权限检查逻辑

1. **第一个用户**：自动分配超级管理员角色
2. **普通注册**：自动分配普通用户角色
3. **管理员创建用户**：
   - 如果不指定 `roleIds`：自动分配普通用户角色
   - 如果指定 `roleIds`：检查是否为超级管理员
     - 是超级管理员：分配指定角色
     - 不是超级管理员：返回权限错误

## 日志记录

- 普通注册：记录 `register` 操作
- 管理员创建用户：记录 `create_user` 操作，包含创建的用户ID、用户名和分配的角色

## 注意事项

1. 只有超级管理员（super-admin）可以指定用户角色
2. 普通管理员（admin）创建的用户默认只能是普通用户
3. 角色权限检查基于用户角色名称和权限
4. 所有操作都会记录详细的日志信息 