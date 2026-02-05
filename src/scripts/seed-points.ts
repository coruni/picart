import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PointsService } from '../modules/points/points.service';

async function seedPoints() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const pointsService = app.get(PointsService);

  try {
    // 调用初始化方法
    await (pointsService as any).initializeSeedData();
    console.log('✅ 积分系统种子数据导入完成');
  } catch (error) {
    console.error('❌ 积分系统种子数据导入失败:', error);
  } finally {
    await app.close();
  }
}

seedPoints();