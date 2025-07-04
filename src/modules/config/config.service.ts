import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateConfigDto } from './dto/create-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { Config } from './entities/config.entity';
import { PermissionService } from '../permission/permission.service';
import { RoleService } from '../role/role.service';

@Injectable()
export class ConfigService implements OnModuleInit {
  public initPromise: Promise<void>;

  constructor(
    @InjectRepository(Config)
    private configRepository: Repository<Config>,
    private permissionService: PermissionService,
    private roleService: RoleService,
  ) {
    this.initPromise = Promise.resolve();
  }

  async onModuleInit() {
    this.initPromise = this.initializeDatabase();
    await this.initPromise;
  }

  public async initializeDatabase() {
    try {
      // 等待权限和角色服务初始化完成
      await this.permissionService.initPromise;
      await this.roleService.onModuleInit();

      // 初始化系统配置
      await this.initializeSystemConfigs();
    } catch {
      // 不抛出错误，避免阻止应用启动
    }
  }

  private async initializeSystemConfigs() {
    const defaultConfigs = [
      {
        key: 'site_name',
        value: 'PicArt 图片社区',
        description: '网站名称',
        type: 'string',
        group: 'site',
      },
      {
        key: 'site_description',
        value: '一个分享图片和创意的社区平台',
        description: '网站描述',
        type: 'string',
        group: 'site',
      },
      {
        key: 'site_keywords',
        value: '图片,社区,创意,分享',
        description: '网站关键词',
        type: 'string',
        group: 'site',
      },
      {
        key: 'site_logo',
        value: '/images/logo.png',
        description: '网站Logo',
        type: 'string',
        group: 'site',
      },
      {
        key: 'site_favicon',
        value: '/images/favicon.ico',
        description: '网站图标',
        type: 'string',
        group: 'site',
      },
      {
        key: 'user_registration_enabled',
        value: 'true',
        description: '是否允许用户注册',
        type: 'boolean',
        group: 'user',
      },
      {
        key: 'user_email_verification',
        value: 'false',
        description: '是否需要邮箱验证',
        type: 'boolean',
        group: 'user',
      },
      {
        key: 'max_upload_size',
        value: '10485760',
        description: '最大上传文件大小（字节）',
        type: 'number',
        group: 'upload',
      },
      {
        key: 'allowed_file_types',
        value: 'image/jpeg,image/png,image/gif,image/webp',
        description: '允许上传的文件类型',
        type: 'string',
        group: 'upload',
      },
      {
        key: 'default_page_size',
        value: '10',
        description: '默认分页大小',
        type: 'number',
        group: 'system',
      },
      {
        key: 'max_page_size',
        value: '100',
        description: '最大分页大小',
        type: 'number',
        group: 'system',
      },
      {
        key: 'comment_approval_required',
        value: 'false',
        description: '评论是否需要审核',
        type: 'boolean',
        group: 'content',
      },
      {
        key: 'article_approval_required',
        value: 'false',
        description: '文章是否需要审核',
        type: 'boolean',
        group: 'content',
      },
      {
        key: 'maintenance_mode',
        value: 'false',
        description: '维护模式',
        type: 'boolean',
        group: 'system',
      },
      {
        key: 'maintenance_message',
        value: '系统维护中，请稍后再试',
        description: '维护模式消息',
        type: 'string',
        group: 'system',
      },
    ];

    for (const config of defaultConfigs) {
      try {
        const existingConfig = await this.configRepository.findOne({
          where: { key: config.key },
        });

        if (!existingConfig) {
          await this.configRepository.save(config);
        }
      } catch {
        // 继续处理其他配置，不中断整个初始化过程
      }
    }
  }

  async create(createConfigDto: CreateConfigDto) {
    const config = this.configRepository.create(createConfigDto);
    const savedConfig = await this.configRepository.save(config);
    return savedConfig;
  }

  async findAll() {
    return this.configRepository.find({
      order: { group: 'ASC', key: 'ASC' },
    });
  }

  async findByGroup(group: string) {
    return this.configRepository.find({
      where: { group },
      order: { key: 'ASC' },
    });
  }

  async findOne(id: number) {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new Error('配置不存在');
    }
    return config;
  }

  async findByKey(key: string) {
    const config = await this.configRepository.findOne({ where: { key } });
    if (!config) {
      return null;
    }
    return this.parseConfigValue(config);
  }

  async update(id: number, updateConfigDto: UpdateConfigDto) {
    const config = await this.findOne(id);
    Object.assign(config, updateConfigDto);
    const updatedConfig = await this.configRepository.save(config);
    return updatedConfig;
  }

  async updateByKey(key: string, value: string) {
    const config = await this.configRepository.findOne({ where: { key } });
    if (!config) {
      throw new Error(`配置 ${key} 不存在`);
    }
    config.value = value;
    const updatedConfig = await this.configRepository.save(config);
    return updatedConfig;
  }

  async remove(id: number) {
    const config = await this.findOne(id);
    await this.configRepository.remove(config);
    return { success: true };
  }

  private parseConfigValue(config: Config): unknown {
    switch (config.type) {
      case 'boolean':
        return config.value === 'true';
      case 'number':
        return parseInt(config.value, 10);
      case 'json':
        return JSON.parse(config.value);
      default:
        return config.value;
    }
  }

  // 获取系统配置的便捷方法
  async getSiteName(): Promise<string> {
    const config = await this.findByKey('site_name');
    return (config as string) || 'PicArt 图片社区';
  }

  async isUserRegistrationEnabled(): Promise<boolean> {
    const config = await this.findByKey('user_registration_enabled');
    return (config as boolean) !== false;
  }

  async isMaintenanceMode(): Promise<boolean> {
    const config = await this.findByKey('maintenance_mode');
    return (config as boolean) === true;
  }

  async getMaintenanceMessage(): Promise<string> {
    const config = await this.findByKey('maintenance_message');
    return (config as string) || '系统维护中，请稍后再试';
  }

  async getMaxUploadSize(): Promise<number> {
    const config = await this.findByKey('max_upload_size');
    return (config as number) || 10485760;
  }

  async getAllowedFileTypes(): Promise<string[]> {
    const config = await this.findByKey('allowed_file_types');
    return config ? (config as string).split(',') : ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  }
}
