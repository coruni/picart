# PicArt - 图片社区后端 API

基于 NestJS 框架开发的图片社区后端服务，提供用户管理、文章管理、评论系统等功能。

## 🚀 技术栈

- **框架**: NestJS 11.x
- **数据库**: MySQL 8.0+
- **ORM**: TypeORM
- **缓存**: Redis + Memory Cache
- **认证**: JWT (Access Token + Refresh Token)
- **文档**: Swagger/OpenAPI
- **验证**: class-validator + class-transformer
- **语言**: TypeScript

## 📁 项目结构

```
src/
├── config/                 # 配置文件
│   ├── database.config.ts  # 数据库配置
│   ├── jwt.config.ts       # JWT 配置
│   ├── redis.config.ts     # Redis 配置
│   ├── swagger.config.ts   # Swagger 配置
│   └── validation.config.ts # 验证配置
├── common/                 # 公共模块
│   ├── constants/          # 常量定义
│   ├── decorators/         # 自定义装饰器
│   ├── dto/               # 公共 DTO
│   ├── exceptions/        # 异常类
│   ├── filters/           # 异常过滤器
│   ├── guards/            # 守卫
│   ├── interceptors/      # 拦截器
│   ├── interfaces/        # 接口定义
│   └── utils/             # 工具类
├── modules/               # 业务模块
│   ├── user/             # 用户模块
│   ├── article/          # 文章模块
│   ├── category/         # 分类模块
│   ├── tag/              # 标签模块
│   ├── comment/          # 评论模块
│   ├── role/             # 角色模块
│   ├── permission/       # 权限模块
│   └── config/           # 配置模块
├── app.module.ts         # 主模块
├── app.controller.ts     # 主控制器
├── app.service.ts        # 主服务
└── main.ts              # 应用入口
```

## 🛠️ 安装和运行

### 环境要求

- Node.js 18+
- MySQL 8.0+
- Redis 6.0+

### 安装依赖

```bash
npm install
# 或
pnpm install
```

### 环境配置

复制 `.env.example` 为 `.env` 并配置相关环境变量：

```bash
cp .env.example .env
```

### 数据库配置

确保 MySQL 服务运行，并创建数据库：

```sql
CREATE DATABASE picart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 运行项目

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

## 📚 API 文档

启动项目后，访问 Swagger 文档：

```
http://localhost:3000/api
```

## 🔐 认证机制

项目使用 JWT 双令牌机制：

- **Access Token**: 短期令牌（1小时），用于 API 访问
- **Refresh Token**: 长期令牌（7天），用于刷新 Access Token

### 登录流程

1. 用户登录获取 Access Token 和 Refresh Token
2. 使用 Access Token 访问 API
3. Access Token 过期时，使用 Refresh Token 获取新的 Access Token
4. 退出登录时清除 Refresh Token

## 🏗️ 模块说明

### 用户模块 (User)

- 用户注册、登录、退出
- 用户信息管理
- 权限验证

### 文章模块 (Article)

- 文章 CRUD 操作
- 文章分类和标签
- 文章点赞功能

### 评论模块 (Comment)

- 评论 CRUD 操作
- 评论层级结构

### 角色权限模块 (Role & Permission)

- 基于 RBAC 的权限管理
- 角色分配和权限控制

## 🧪 测试

```bash
# 单元测试
npm run test

# 测试覆盖率
npm run test:cov

# E2E 测试
npm run test:e2e
```

## 📝 开发规范

### 代码风格

项目使用 ESLint + Prettier 进行代码规范：

```bash
# 代码格式化
npm run format

# 代码检查
npm run lint
```

### 提交规范

使用 Conventional Commits 规范：

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件
- 创建 Pull Request
