import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('PicArt API')
  .setDescription('PicArt 图片社区 API 文档')
  .setVersion('1.0')
  .addBearerAuth()
  .addTag('用户管理', '用户注册、登录、权限管理')
  .addTag('文章管理', '文章的增删改查')
  .addTag('分类管理', '文章分类管理')
  .addTag('标签管理', '文章标签管理')
  .addTag('评论管理', '文章评论管理')
  .addTag('角色权限', '角色和权限管理')
  .addTag('系统配置', '系统配置管理')
  .build();
