# 项目文档索引

欢迎查阅项目文档！本目录包含了项目的完整技术文档。

## 📖 文档列表

### 1. [项目概览 (PROJECT_OVERVIEW.md)](./PROJECT_OVERVIEW.md)

项目的整体介绍，包括：
- 项目简介和技术栈
- 项目结构说明
- 核心功能模块介绍
- 环境配置指南
- 开发规范
- 部署建议

**适合人群**: 新加入项目的开发者、项目管理者

---

### 2. [数据库设计 (DATABASE.md)](./DATABASE.md)

完整的数据库设计文档，包括：
- 所有数据表的字段定义
- 字段类型、长度、默认值说明
- 表关联关系
- 索引设计
- 数据类型说明

**适合人群**: 后端开发者、数据库管理员、需要了解数据结构的前端开发者

**包含的表**:
- 用户相关: user, user_config, user_followings
- 权限相关: role, permission, role_permissions
- 内容相关: article, comment, category, tag, article_like, download
- 交易相关: order, payment
- 邀请相关: invite, invite_commission
- 消息相关: message, message_read
- 其他: banner, config, report

---

### 3. [API 接口概览 (API_OVERVIEW.md)](./API_OVERVIEW.md)

所有 API 接口的快速参考文档，包括：
- 接口列表（按模块分类）
- 请求方法和路径
- 认证要求
- 通用响应格式
- 错误码说明
- WebSocket 接口
- 文件上传说明

**适合人群**: 前端开发者、接口测试人员、第三方集成开发者

**包含的模块**:
- 用户模块 (User)
- 角色模块 (Role)
- 权限模块 (Permission)
- 文章模块 (Article)
- 评论模块 (Comment)
- 分类模块 (Category)
- 标签模块 (Tag)
- 订单模块 (Order)
- 支付模块 (Payment)
- 邀请模块 (Invite)
- 消息模块 (Message)
- 举报模块 (Report)
- 横幅模块 (Banner)
- 系统配置模块 (Config)
- 上传模块 (Upload)

---

### 4. [字段快速参考 (FIELD_REFERENCE.md)](./FIELD_REFERENCE.md)

数据库字段的快速查询参考，包括：
- 所有枚举类型的值和说明
- 常用字段说明（时间、金额、比例、计数等）
- 索引字段列表
- 必填字段 vs 可选字段
- 字段长度限制
- 默认值参考
- 关联关系速查
- 特殊字段说明
- 数据验证规则

**适合人群**: 所有开发者，特别是需要快速查询字段含义和枚举值的场景

---

### 5. [支付安全修复 (PAYMENT_SECURITY_FIX.md)](./PAYMENT_SECURITY_FIX.md)

支付系统安全问题的修复说明，包括：
- 修复的安全问题（余额为负、并发冲突等）
- 技术实现方案（事务、悲观锁）
- 钱包服务的使用方法
- 测试建议
- 性能影响分析

**适合人群**: 后端开发者、系统架构师、安全审计人员

---

### 6. [装饰品系统测试指南 (DECORATION_INTEGRATION_TEST.md)](./DECORATION_INTEGRATION_TEST.md)

装饰品系统的完整集成测试指南，包括：
- 功能测试流程（购买、使用、赠送、活动等）
- 事件系统测试（点赞、评论自动更新进度）
- 边界情况测试
- 性能测试建议
- 数据库验证
- 故障恢复测试

**适合人群**: 测试人员、后端开发者、QA 工程师

---

### 7. [更新日志 (CHANGELOG.md)](./CHANGELOG.md)

项目的更新历史和变更记录，包括：
- 功能新增和改进
- 数据库变更
- API 变更
- 已知问题
- 待办事项

**适合人群**: 所有项目成员，了解项目演进历史

---

## 🔍 快速查找

### 按角色查找

#### 新手开发者
1. 先阅读 [项目概览](./PROJECT_OVERVIEW.md) 了解项目整体架构
2. 查看 [数据库设计](./DATABASE.md) 了解数据结构
3. 参考 [API 接口概览](./API_OVERVIEW.md) 开始开发

#### 前端开发者
1. 直接查看 [API 接口概览](./API_OVERVIEW.md) 了解可用接口
2. 需要时参考 [数据库设计](./DATABASE.md) 了解数据结构

#### 后端开发者
1. 查看 [项目概览](./PROJECT_OVERVIEW.md) 了解技术栈和架构
2. 详细阅读 [数据库设计](./DATABASE.md) 了解表结构
3. 参考各模块的 README 文件了解具体实现

#### 测试人员
1. 查看 [API 接口概览](./API_OVERVIEW.md) 了解接口列表
2. 参考 Swagger 文档进行接口测试

#### 项目管理者
1. 阅读 [项目概览](./PROJECT_OVERVIEW.md) 了解项目全貌
2. 查看各模块功能说明

---

## 📝 模块文档

除了上述核心文档，部分模块还有独立的详细文档：

- [举报模块](../src/modules/report/README.md) - 举报功能的详细说明
- [装饰品模块](../src/modules/decoration/README.md) - 装饰品系统（头像框、评论气泡）的详细说明

---

## 🔄 文档更新

文档会随着项目的发展持续更新。如果发现文档有误或需要补充，请：

1. 提交 Issue 说明问题
2. 直接提交 PR 修改文档
3. 联系项目维护者

---

## 📌 重要提示

### 环境变量配置

所有敏感信息（如数据库密码、API 密钥等）都应该通过环境变量配置，不要硬编码在代码中。

参考项目根目录的 `.env.example` 文件创建你的 `.env` 文件。

### API 版本

当前 API 版本为 v1，所有接口都在根路径下。未来如果有版本升级，会通过 URL 前缀区分。

### Swagger 文档

除了本文档，项目还集成了 Swagger API 文档，启动项目后访问：
```
http://localhost:3000/api/docs
```

Swagger 文档提供了：
- 交互式 API 测试
- 实时的接口定义
- 请求/响应示例
- 在线调试功能

---

## 🛠️ 开发工具推荐

### API 测试
- Postman - API 测试工具
- Insomnia - API 测试工具
- Swagger UI - 内置的 API 文档和测试工具

### 数据库管理
- MySQL Workbench - MySQL 官方工具
- DBeaver - 通用数据库管理工具
- Navicat - 商业数据库管理工具

### Redis 管理
- Redis Desktop Manager
- RedisInsight - Redis 官方工具

### 代码编辑器
- VS Code - 推荐安装以下插件：
  - ESLint
  - Prettier
  - TypeScript
  - REST Client

---

## 📞 获取帮助

如果在使用文档过程中遇到问题：

1. 查看项目的 [README.md](../README.md)
2. 搜索项目的 Issues
3. 提交新的 Issue
4. 联系项目维护者

---

## 📅 更新日志

- 2025-01-11: 装饰品系统事件集成完成
  - 添加点赞和评论事件触发
  - 完善装饰品活动进度自动追踪
  - 新增装饰品系统集成测试指南
- 2025-01-11: 支付安全修复
  - 修复余额为负的问题
  - 新增钱包服务和交易记录系统
  - 完善退款逻辑
- 2025-01-11: 创建文档索引，完善项目文档体系
  - 新增项目概览文档
  - 新增数据库设计文档
  - 新增 API 接口概览文档
  - 完善举报模块文档

---

**祝你开发愉快！** 🎉
