# PicArt - 图片社区后端 API

基于 NestJS 框架开发的图片社区后端服务，提供用户管理、文章管理、评论系统、实时消息等功能。

## 🚀 技术栈

- **框架**: NestJS 11.x
- **数据库**: MySQL 8.0+
- **ORM**: TypeORM
- **缓存**: Redis + Memory Cache
- **认证**: JWT (Access Token + Refresh Token)
- **实时通信**: Socket.io (WebSocket)
- **文档**: Swagger/OpenAPI
- **验证**: class-validator + class-transformer
- **语言**: TypeScript
- **包管理器**: pnpm

## 📁 项目结构

```
src/
├── config/                 # 配置文件
│   ├── database.config.ts  # 数据库配置
│   ├── jwt.config.ts       # JWT 配置
│   ├── cache.config.ts     # 缓存配置
│   ├── logger.config.ts    # 日志配置
│   ├── mailer.config.ts    # 邮件配置
│   ├── multer.config.ts    # 文件上传配置
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
│   ├── services/          # 公共服务
│   └── utils/             # 工具类
├── modules/               # 业务模块
│   ├── user/             # 用户模块
│   ├── article/          # 文章模块
│   ├── category/         # 分类模块
│   ├── tag/              # 标签模块
│   ├── comment/          # 评论模块
│   ├── message/          # 消息模块 (WebSocket)
│   ├── role/             # 角色模块
│   ├── permission/       # 权限模块
│   ├── config/           # 配置模块
│   ├── invite/           # 邀请模块
│   ├── order/            # 订单模块
│   └── upload/           # 文件上传模块
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
- pnpm 8.0+

### 安装 pnpm

如果还没有安装 pnpm，请先安装：

```bash
# 使用 npm 安装
npm install -g pnpm

# 或使用其他方式
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

### 安装依赖

```bash
pnpm install
```

### 环境配置

复制 `.env.example` 为 `.env` 并配置相关环境变量：

```bash
cp .env.example .env
```


### 运行项目

```bash
# 开发模式
pnpm run start:dev

# 生产模式
pnpm run build
pnpm run start:prod

# 调试模式
pnpm run start:debug
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

## 🌐 WebSocket 实时通信

项目支持 WebSocket 实时通信，主要用于消息系统：

### 连接方式

```javascript
// 客户端连接示例
const socket = io('http://localhost:3000', {
  auth: {
    token: 'Bearer your-jwt-token'
  }
});
```

### 支持的事件

- `join` - 加入房间
- `leave` - 离开房间
- `sendMessage` - 发送消息
- `getHistory` - 获取历史消息
- `readMessage` - 标记消息已读
- `getProfile` - 获取用户信息

## 🏗️ 模块说明

### 用户模块 (User)

- 用户注册、登录、退出
- 用户信息管理
- 权限验证
- 设备管理

### 文章模块 (Article)

- 文章 CRUD 操作
- 文章分类和标签
- 文章点赞功能
- 文章权限控制

### 评论模块 (Comment)

- 评论 CRUD 操作
- 评论层级结构

### 消息模块 (Message)

- 实时消息发送
- 消息历史记录
- 消息已读状态

### 角色权限模块 (Role & Permission)

- 基于 RBAC 的权限管理
- 角色分配和权限控制

### 文件上传模块 (Upload)

- 图片上传
- 文件管理
- 存储配置

## 🧪 测试

```bash
# 单元测试
pnpm run test

# 测试覆盖率
pnpm run test:cov

# E2E 测试
pnpm run test:e2e

# 测试监听模式
pnpm run test:watch
```

## 📝 开发规范

### 代码风格

项目使用 ESLint + Prettier 进行代码规范：

```bash
# 代码格式化
pnpm run format

# 代码检查
pnpm run lint

# 代码检查和修复
pnpm run lint:fix
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

## 📦 可用的脚本命令

```bash
# 开发相关
pnpm run start:dev      # 开发模式启动
pnpm run start:debug    # 调试模式启动
pnpm run start:prod     # 生产模式启动

# 构建相关
pnpm run build          # 构建项目
pnpm run build:webpack  # Webpack 构建

# 测试相关
pnpm run test           # 运行测试
pnpm run test:watch     # 监听模式测试
pnpm run test:cov       # 测试覆盖率
pnpm run test:debug     # 调试模式测试
pnpm run test:e2e       # E2E 测试

# 代码质量
pnpm run lint           # 代码检查
pnpm run lint:fix       # 代码检查和修复
pnpm run format         # 代码格式化

# 数据库相关
pnpm run migration:generate  # 生成迁移文件
pnpm run migration:run       # 运行迁移
pnpm run migration:revert    # 回滚迁移
```

## 🔧 环境变量配置

创建 `.env` 文件并配置以下环境变量：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=picart

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT 配置
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

# 邮件配置
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=your_email@example.com
MAIL_PASS=your_email_password

# 文件上传配置
UPLOAD_DEST=./uploads
MAX_FILE_SIZE=5242880

# 应用配置
PORT=3000
NODE_ENV=development
```

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

## 🚀 快速开始

```bash
# 1. 克隆项目
git clone <repository-url>
cd picart

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 4. 启动数据库和 Redis

# 5. 运行迁移
pnpm run migration:run

# 6. 启动开发服务器
pnpm run start:dev

# 7. 访问 API 文档
# http://localhost:3000/api
```
