# 模块

```mermaid
graph LR
    %% 主应用层
    subgraph "应用入口"
        Main["main.ts<br/>应用启动"]
        App["app.module.ts<br/>根模块"]
        AppController["app.controller.ts<br/>根控制器"]
        AppService["app.service.ts<br/>根服务"]
    end

    %% 配置层
    subgraph "配置管理"
        Config["config/<br/>配置文件"]
        JWT["jwt.config.ts<br/>JWT配置"]
        Logger["logger.config.ts<br/>日志配置"]
        Swagger["swagger.config.ts<br/>API文档配置"]
        Validation["validation.config.ts<br/>验证配置"]
    end

    %% 公共模块
    subgraph "公共模块"
        Common["common.module.ts<br/>公共模块"]
        
        subgraph "装饰器"
            Decorators["permissions.decorator.ts<br/>权限装饰器"]
        end
        
        subgraph "守卫"
            Guards["permission.guard.ts<br/>权限守卫"]
        end
        
        subgraph "拦截器"
            Interceptors["logging.interceptor.ts<br/>日志拦截器<br/>transform.interceptor.ts<br/>响应转换拦截器"]
        end
        
        subgraph "过滤器"
            Filters["http-exception.filter.ts<br/>异常过滤器"]
        end
        
        subgraph "工具类"
            Utils["cache.util.ts<br/>缓存工具<br/>jwt.util.ts<br/>JWT工具<br/>logger.util.ts<br/>日志工具<br/>permission.util.ts<br/>权限工具"]
        end
    end

    %% 业务模块
    subgraph "业务模块"
        
        subgraph "用户模块"
            UserModule["user.module.ts"]
            UserController["user.controller.ts<br/>用户管理<br/>登录认证<br/>钱包操作"]
            UserService["user.service.ts"]
            UserEntity["user.entity.ts<br/>用户实体"]
            UserConfig["user-config.entity.ts<br/>用户配置"]
            JWTStrategy["jwt.strategy.ts<br/>JWT策略"]
        end
        
        subgraph "文章模块"
            ArticleModule["article.module.ts"]
            ArticleController["article.controller.ts<br/>文章CRUD<br/>点赞/表情回复"]
            ArticleService["article.service.ts"]
            ArticleEntity["article.entity.ts<br/>文章实体"]
            ArticleLike["article-like.entity.ts<br/>文章点赞/表情"]
        end
        
        subgraph "分类模块"
            CategoryModule["category.module.ts"]
            CategoryController["category.controller.ts"]
            CategoryService["category.service.ts"]
            CategoryEntity["category.entity.ts"]
        end
        
        subgraph "标签模块"
            TagModule["tag.module.ts"]
            TagController["tag.controller.ts"]
            TagService["tag.service.ts"]
            TagEntity["tag.entity.ts"]
        end
        
        subgraph "评论模块"
            CommentModule["comment.module.ts"]
            CommentController["comment.controller.ts"]
            CommentService["comment.service.ts"]
            CommentEntity["comment.entity.ts"]
        end
        
        subgraph "权限模块"
            PermissionModule["permission.module.ts"]
            PermissionController["permission.controller.ts"]
            PermissionService["permission.service.ts"]
            PermissionEntity["permission.entity.ts"]
        end
        
        subgraph "角色模块"
            RoleModule["role.module.ts"]
            RoleController["role.controller.ts"]
            RoleService["role.service.ts"]
            RoleEntity["role.entity.ts"]
        end
        
        subgraph "订单模块"
            OrderModule["order.module.ts"]
            OrderController["order.controller.ts"]
            OrderService["order.service.ts"]
            OrderEntity["order.entity.ts"]
        end
        
        subgraph "配置模块"
            ConfigModule["config.module.ts"]
            ConfigController["config.controller.ts"]
            ConfigService["config.service.ts<br/>佣金配置"]
            ConfigEntity["config.entity.ts"]
        end
    end

    %% 连接关系
    Main --> App
    App --> Common
    App --> UserModule
    App --> ArticleModule
    App --> CategoryModule
    App --> TagModule
    App --> CommentModule
    App --> PermissionModule
    App --> RoleModule
    App --> OrderModule
    App --> ConfigModule
    
    Config --> JWT
    Config --> Logger
    Config --> Swagger
    Config --> Validation
    
    Common --> Decorators
    Common --> Guards
    Common --> Interceptors
    Common --> Filters
    Common --> Utils
    
    UserModule --> UserController
    UserController --> UserService
    UserService --> UserEntity
    UserService --> UserConfig
    UserModule --> JWTStrategy
    
    ArticleModule --> ArticleController
    ArticleController --> ArticleService
    ArticleService --> ArticleEntity
    ArticleService --> ArticleLike
    
    CategoryModule --> CategoryController
    CategoryController --> CategoryService
    CategoryService --> CategoryEntity
    
    TagModule --> TagController
    TagController --> TagService
    TagService --> TagEntity
    
    CommentModule --> CommentController
    CommentController --> CommentService
    CommentService --> CommentEntity
    
    PermissionModule --> PermissionController
    PermissionController --> PermissionService
    PermissionService --> PermissionEntity
    
    RoleModule --> RoleController
    RoleController --> RoleService
    RoleService --> RoleEntity
    
    OrderModule --> OrderController
    OrderController --> OrderService
    OrderService --> OrderEntity
    
    ConfigModule --> ConfigController
    ConfigController --> ConfigService
    ConfigService --> ConfigEntity

    %% 样式
    classDef moduleStyle fill:#1976d2,stroke:#0d47a1,stroke-width:2px,color:#ffffff
    classDef controllerStyle fill:#7b1fa2,stroke:#4a148c,stroke-width:2px,color:#ffffff
    classDef serviceStyle fill:#388e3c,stroke:#1b5e20,stroke-width:2px,color:#ffffff
    classDef entityStyle fill:#f57c00,stroke:#e65100,stroke-width:2px,color:#ffffff
    classDef configStyle fill:#c2185b,stroke:#880e4f,stroke-width:2px,color:#ffffff
    classDef commonStyle fill:#689f38,stroke:#33691e,stroke-width:2px,color:#ffffff

    class UserModule,ArticleModule,CategoryModule,TagModule,CommentModule,PermissionModule,RoleModule,OrderModule,ConfigModule moduleStyle
    class UserController,ArticleController,CategoryController,TagController,CommentController,PermissionController,RoleController,OrderController,ConfigController controllerStyle
    class UserService,ArticleService,CategoryService,TagService,CommentService,PermissionService,RoleService,OrderService,ConfigService serviceStyle
    class UserEntity,ArticleEntity,CategoryEntity,TagEntity,CommentEntity,PermissionEntity,RoleEntity,OrderEntity,ConfigEntity,UserConfig,ArticleLike entityStyle
    class Config,JWT,Logger,Swagger,Validation configStyle
    class Common,Decorators,Guards,Interceptors,Filters,Utils commonStyle
