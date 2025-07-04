import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

export const databaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: configService.get('DB_HOST') || 'localhost',
  port: parseInt(configService.get('DB_PORT') || '3306'),
  username: configService.get('DB_USERNAME') || 'root',
  password: configService.get('DB_PASSWORD') || '',
  database: configService.get('DB_DATABASE') || 'nest_db',
  entities: [path.join(__dirname, '../**/*.entity{.ts,.js}')],
  autoLoadEntities: true,
  insecureAuth: true,
  synchronize: configService.get('DB_SYNC') || false,
  logging: configService.get('DB_LOGGING') || false,
});
