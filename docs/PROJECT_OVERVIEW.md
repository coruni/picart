# 项目概览

## 项目简介

这是一个基于 NestJS 的内容管理平台，支持用户发布文章、评论互动、会员系统、支付功能、邀请分成等完整的社区功能。

## 技术栈

### 后端框架
- **NestJS** 11.x - 渐进式 Node.js 框架
- **TypeScript** 5.x - 类型安全的 JavaScript 超集
- **TypeORM** 0.3.x - ORM 框架
- **MySQL** - 关系型数据库

### 核心依赖
- **@nestjs/jwt** - JWT 认证
- **@nestjs/cache-manager** - 缓存管理
- **@nestjs/swagger** - API 文档
- **@nestjs/websockets** - WebSocket 支持
- **@nestjs/event-emitter** - 事件系统
- **@nestjs-modules/mailer** - 邮件服务
- **bcrypt** - 密码加密
- **class-validator** - 数据验证
- **class-transformer** - 数据转换

### 第三方服务
- **AWS S3** - 文件存储
- **Redis** - 缓存和会话
- **支付宝 SDK** - 支付宝支付
- **微信支付 SDK** - 微信支付
- **Socket.IO** - 实时通信

## 项目结构

```
src/
├── common/                 # 公共模块
│   ├── constants/         # 常量定义
│   ├── decorators/        # 自定义装饰器
│   ├── dto/              # 公共 DTO
│   ├── exceptions/       # 自定义异常
│   ├── filters/          # 异常过滤器
│   ├── guards/           # 守卫
│   ├── interceptors/     # 拦截器
│   ├── interfaces/       # 接口定义
│   ├── services/         # 公共服务
│   └── utils/            # 工具函数
├── config/                # 配置文件
│   ├── cache.config.ts   # 缓存配置
│   ├── database.config.ts # 数据库配置
│   ├── jwt.config.ts     # JWT 配置
│   ├── logger.config.ts  # 日志配置
│   ├── mailer.config.ts  # 邮件配置
│   ├── multer.config.ts  # 文件上传配置
│   ├── swagger.config.ts # API 文档配置
│   └── validation.config.ts # 验证配置
├── modules/               # 业务模块
│   ├── article/          # 文章模块
│   ├── banner/           # 横幅模块
│   ├── category/         # 分类模块
│   ├── comment/          # 评论模块
│   ├── config/           # 系统配置模块
│   ├── invite/           # 邀请模块
│   ├── message/          # 消息模块
│   ├── order/            # 订单模块
│   ├── payment/          # 支付模块
│   ├── permission/       # 权限模块
│   ├── report/           # 举报模块
│   ├── role/             # 角色模块
│   ├── tag/              # 标签模块
│   ├── upload/           # 上传模块
│   └── user/             # 用户模块
├── app.module.ts         # 根模块
└── main.ts               # 应用入口
```

## 核心功能模块

### 1. 用户系统 (User)
- 用户注册、登录、认证
- 用户资料管理
- 关注/粉丝系统
- 会员等级系统
- 用户配置（抽成比例、通知设置）
- 钱包和积分系统

### 2. 内容管理 (Article/Comment)
- 文章发布、编辑、删除
- 文章分类和标签
- 文章状态管理（草稿、发布、归档、封禁）
- 付费文章功能
- 评论系统（支持多级回复）
- 点赞和表情反应
- 下载资源管理

### 3. 权限管理 (Role/Permission)
- 基于角色的访问控制 (RBAC)
- 角色管理
- 权限管理
- 用户角色分配

### 4. 交易系统 (Order/Payment)
- 订单管理（会员、商品、服务、文章）
- 多种支付方式（支付宝、微信、余额）
- 支付流水记录
- 订单状态管理

### 5. 邀请系统 (Invite)
- 邀请码生成
- 邀请关系管理
- 邀请分成计算
- 分成记录和发放

### 6. 消息系统 (Message)
- 私信功能
- 系统消息
- 通知推送
- 广播消息
- WebSocket 实时通信

### 7. 举报系统 (Report)
- 举报用户、文章、评论
- 举报分类管理
- 举报处理流程
- 举报统计

### 8. 文件上传 (Upload)
- 本地文件上传
- AWS S3 云存储
- 文件类型验证
- 文件大小限制

### 9. 系统配置 (Config)
- 系统级配置管理
- 配置分组
- 公开/私有配置

### 10. 横幅管理 (Banner)
- 横幅广告管理
- 排序和状态控制

## 数据库设计

项目使用 MySQL 数据库，包含以下核心表：

- **用户相关**: user, user_config, user_followings
- **权限相关**: role, permission, role_permissions
- **内容相关**: article, comment, category, tag, article_like, download
- **交易相关**: order, payment
- **邀请相关**: invite, invite_commission
- **消息相关**: message, message_read
- **其他**: banner, config, report

详细的数据库字段定义请参考 [DATABASE.md](./DATABASE.md)

## API 文档

项目集成了 Swagger API 文档，启动项目后访问：
```
http://localhost:3000/api/docs
```

## 环境变量

项目使用 `.env` 文件管理环境变量，主要配置项：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_DATABASE=database_name

# JWT 配置
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# 邮件配置
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=your_email
MAIL_PASSWORD=your_password

# AWS S3 配置
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_bucket_name

# 支付配置
ALIPAY_APP_ID=your_app_id
ALIPAY_PRIVATE_KEY=your_private_key
WECHAT_APP_ID=your_app_id
WECHAT_MCH_ID=your_mch_id
```

## 启动项目

### 开发环境
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 生产环境
```bash
# 构建项目
npm run build

# 启动生产服务器
npm run start:prod
```

## 开发规范

### 代码风格
- 使用 ESLint 进行代码检查
- 使用 Prettier 进行代码格式化
- 遵循 TypeScript 最佳实践

### 提交规范
- 使用 Husky 进行 Git Hooks 管理
- 使用 lint-staged 进行提交前检查

### 模块开发规范
每个业务模块应包含：
- `entities/` - 实体定义
- `dto/` - 数据传输对象
- `*.controller.ts` - 控制器
- `*.service.ts` - 服务层
- `*.module.ts` - 模块定义
- `README.md` - 模块文档（可选）

## 安全特性

- JWT 认证和授权
- 密码 bcrypt 加密
- CORS 跨域配置
- 请求速率限制
- SQL 注入防护（TypeORM）
- XSS 防护
- 数据验证（class-validator）

## 性能优化

- Redis 缓存
- 数据库索引优化
- 分页查询
- 懒加载关联
- 压缩中间件

## 日志系统

使用 Winston 进行日志管理：
- 按日期分割日志文件
- 不同级别的日志记录
- 错误日志单独存储

## 测试

```bash
# 单元测试
npm run test

# 端到端测试
npm run test:e2e

# 测试覆盖率
npm run test:cov
```

## 部署建议

### Docker 部署
建议使用 Docker Compose 部署，包含：
- NestJS 应用容器
- MySQL 容器
- Redis 容器
- Nginx 反向代理

### 云服务部署
- 应用服务：AWS EC2, 阿里云 ECS
- 数据库：AWS RDS, 阿里云 RDS
- 缓存：AWS ElastiCache, 阿里云 Redis
- 文件存储：AWS S3, 阿里云 OSS

## 维护和监控

- 使用 PM2 进行进程管理
- 配置健康检查端点
- 日志监控和告警
- 性能监控（APM）

## 许可证

UNLICENSED

## 联系方式

如有问题，请联系开发团队。
