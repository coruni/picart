import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateConfigDto } from "./dto/create-config.dto";
import { UpdateConfigDto } from "./dto/update-config.dto";
import { Config } from "./entities/config.entity";
import { PermissionService } from "../permission/permission.service";
import { RoleService } from "../role/role.service";
import { ListUtil } from "../../common/utils/list.util";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Inject } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class ConfigService implements OnModuleInit {
  public initPromise: Promise<void>;

  constructor(
    @InjectRepository(Config)
    private configRepository: Repository<Config>,
    private permissionService: PermissionService,
    private roleService: RoleService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private eventEmitter: EventEmitter2,
  ) {
    this.initPromise = this.initializeDatabase();
  }

  async onModuleInit() {
    this.initPromise = this.initializeDatabase();
    await this.initPromise;
    await this.cacheConfigs();
    await this.getPublicConfigs(true);
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
        key: "site_name",
        value: "PicArt 图片社区",
        description: "网站名称",
        type: "string",
        group: "site",
        public: true,
      },
      {
        key: "site_subtitle",
        value: "PicArt 图片社区",
        description: "网站副标题",
        type: "string",
        group: "site",
        public: true,
      },
      {
        key: "site_description",
        value: "一个分享图片和创意的社区平台",
        description: "网站描述",
        type: "string",
        group: "site",
        public: true,
      },
      {
        key: "site_keywords",
        value: "图片,社区,创意,分享",
        description: "网站关键词",
        type: "string",
        group: "site",
        public: true,
      },
      {
        key: "site_logo",
        value: "/images/logo.png",
        description: "网站Logo",
        type: "string",
        group: "site",
        public: true,
      },
      {
        key: "site_favicon",
        value: "/images/favicon.ico",
        description: "网站图标",
        type: "string",
        group: "site",
        public: true,
      },
      {
        key: "site_layout",
        value: "grid",
        description: "网站布局样式",
        type: "string",
        group: "site",
        public: true,
      },
      {
        key: "site_mail",
        value: "contact@example.com",
        description: "网站隐私邮箱",
        type: "string",
        group: "site",
        public: true,
      },
      {
        key: "user_registration_enabled",
        value: "true",
        description: "是否允许用户注册",
        type: "boolean",
        group: "user",
        public: true,
      },
      {
        key: "user_email_verification",
        value: "false",
        description: "是否需要邮箱验证",
        type: "boolean",
        group: "user",
        public: true,
      },
      {
        key: "comment_approval_required",
        value: "false",
        description: "评论是否需要审核",
        type: "boolean",
        group: "content",
        public: true,
      },
      {
        key: "article_approval_required",
        value: "false",
        description: "文章是否需要审核",
        type: "boolean",
        group: "content",
        public: true,
      },
      {
        key: "article_free_images_count",
        value: "3",
        description: "需要权限的文章默认展示的免费图片数量",
        type: "number",
        group: "content",
        public: true,
      },
      {
        key: "maintenance_mode",
        value: "false",
        description: "维护模式",
        type: "boolean",
        group: "system",
        public: true,
      },
      {
        key: "maintenance_message",
        value: "系统维护中，请稍后再试",
        description: "维护模式消息",
        type: "string",
        group: "system",
        public: true,
      },
      {
        key: "invite_code_required",
        value: "false",
        description: "注册时是否必须填写邀请码",
        type: "boolean",
        group: "invite",
        public: true,
      },
      {
        key: "invite_code_enabled",
        value: "true",
        description: "是否启用邀请码功能",
        type: "boolean",
        group: "invite",
        public: true,
      },
      {
        key: "invite_default_commission_rate",
        value: "0.05",
        description: "默认邀请分成比例",
        type: "number",
        group: "invite",
      },
      {
        key: "invite_code_expire_days",
        value: "30",
        description: "邀请码默认过期天数（0表示永不过期）",
        type: "number",
        group: "invite",
      },
      // 支付配置
      {
        key: "payment_alipay_enabled",
        value: "true",
        description: "是否启用支付宝支付",
        type: "boolean",
        group: "payment",
        public: true,
      },
      {
        key: "payment_wechat_enabled",
        value: "true",
        description: "是否启用微信支付",
        type: "boolean",
        group: "payment",
        public: true,
      },
      {
        key: "payment_alipay_app_id",
        value: "",
        description: "支付宝应用ID",
        type: "string",
        group: "payment",
      },
      {
        key: "payment_alipay_private_key",
        value: "",
        description: "支付宝私钥",
        type: "string",
        group: "payment",
      },
      {
        key: "payment_alipay_public_key",
        value: "",
        description: "支付宝公钥",
        type: "string",
        group: "payment",
      },
      {
        key: "payment_alipay_gateway",
        value: "https://openapi.alipay.com/gateway.do",
        description: "支付宝网关地址",
        type: "string",
        group: "payment",
      },
      {
        key: "payment_wechat_app_id",
        value: "",
        description: "微信支付应用ID",
        type: "string",
        group: "payment",
      },
      {
        key: "payment_wechat_mch_id",
        value: "",
        description: "微信支付商户号",
        type: "string",
        group: "payment",
      },
      {
        key: "payment_wechat_api_key",
        value: "",
        description: "微信支付API密钥",
        type: "string",
        group: "payment",
      },
      {
        key: "payment_wechat_private_key",
        value: "",
        description: "微信支付私钥",
        type: "string",
        group: "payment",
      },
      {
        key: "payment_wechat_serial_no",
        value: "",
        description: "微信支付证书序列号",
        type: "string",
        group: "payment",
      },
      {
        key: "payment_wechat_public_key",
        value: "",
        description: "微信支付公钥",
        type: "string",
        group: "payment",
      },
      // 易支付配置
      {
        key: "payment_epay_enabled",
        value: "false",
        description: "是否启用易支付",
        type: "boolean",
        group: "payment",
        public: true,
      },
      {
        key: "payment_epay_app_id",
        value: "",
        description: "易支付应用ID",
        type: "string",
        group: "payment",
      },
      {
        key: "payment_epay_app_key",
        value: "",
        description: "易支付应用密钥",
        type: "string",
        group: "payment",
      },
      {
        key: "payment_epay_gateway",
        value: "https://pay.example.com",
        description: "易支付网关地址",
        type: "string",
        group: "payment",
      },
      {
        key: "payment_epay_notify_url",
        value: "",
        description: "易支付回调通知地址",
        type: "string",
        group: "payment",
      },
      // 易支付各支付方式开关
      {
        key: "payment_epay_wxpay_enabled",
        value: "false",
        description: "是否启用易支付微信支付",
        type: "boolean",
        group: "payment",
        public: true,
      },
      {
        key: "payment_epay_alipay_enabled",
        value: "false",
        description: "是否启用易支付支付宝",
        type: "boolean",
        group: "payment",
        public: true,
      },
      {
        key: "payment_epay_usdt_enabled",
        value: "false",
        description: "是否启用易支付USDT",
        type: "boolean",
        group: "payment",
        public: true,
      },
      {
        key: "payment_notify_url",
        value: "https://your-domain.com/api/payment/notify",
        description: "支付回调通知地址",
        type: "string",
        group: "payment",
      },
      {
        key: "payment_return_url",
        value: "https://your-domain.com/payment/result",
        description: "支付完成返回地址",
        type: "string",
        group: "payment",
      },
      // 分成配置
      {
        key: "commission_inviter_rate",
        value: "0.05",
        description: "邀请者分成比例",
        type: "number",
        group: "commission",
      },
      {
        key: "commission_platform_rate",
        value: "0.1",
        description: "平台分成比例",
        type: "number",
        group: "commission",
      },
      {
        key: "commission_author_rate",
        value: "0.85",
        description: "作者分成比例",
        type: "number",
        group: "commission",
      },
      // 会员配置
      {
        key: "membership_price",
        value: "19.9",
        description: "会员月价格（元）",
        type: "number",
        group: "membership",
        public: true,
      },
      {
        key: "membership_price_1m",
        value: "19.9",
        description: "会员-1个月价格（元）",
        type: "number",
        group: "membership",
        public: true,
      },
      {
        key: "membership_price_3m",
        value: "59.7",
        description: "会员-季度（3个月）价格（元）",
        type: "number",
        group: "membership",
        public: true,
      },
      {
        key: "membership_price_6m",
        value: "119.4",
        description: "会员-半年（6个月）价格（元）",
        type: "number",
        group: "membership",
        public: true,
      },
      {
        key: "membership_price_12m",
        value: "238.8",
        description: "会员-年（12个月）价格（元）",
        type: "number",
        group: "membership",
        public: true,
      },
      {
        key: "membership_price_lifetime",
        value: "999",
        description: "会员-永久价格（元）",
        type: "number",
        group: "membership",
        public: true,
      },
      {
        key: "membership_name",
        value: "VIP会员",
        description: "会员名称",
        type: "string",
        group: "membership",
        public: true,
      },
      {
        key: "membership_enabled",
        value: "true",
        description: "是否启用会员功能",
        type: "boolean",
        group: "membership",
        public: true,
      },
      // 广告配置
      {
        key: "ad_homepage_enabled",
        value: "false",
        description: "是否启用首页广告",
        type: "boolean",
        group: "advertisement",
        public: true,
      },
      {
        key: "ad_homepage_content",
        value: "",
        description: "首页广告内容（支持HTML）",
        type: "string",
        group: "advertisement",
        public: true,
      },
      {
        key: "ad_homepage_position",
        value: "top",
        description: "首页广告位置（top/bottom/sidebar）",
        type: "string",
        group: "advertisement",
        public: true,
      },
      {
        key: "ad_article_top_enabled",
        value: "false",
        description: "是否启用文章顶部广告",
        type: "boolean",
        group: "advertisement",
        public: true,
      },
      {
        key: "ad_article_top_content",
        value: "",
        description: "文章顶部广告内容（支持HTML）",
        type: "string",
        group: "advertisement",
        public: true,
      },
      {
        key: "ad_article_bottom_enabled",
        value: "false",
        description: "是否启用文章底部广告",
        type: "boolean",
        group: "advertisement",
        public: true,
      },
      {
        key: "ad_article_bottom_content",
        value: "",
        description: "文章底部广告内容（支持HTML）",
        type: "string",
        group: "advertisement",
        public: true,
      },
      {
        key: "ad_global_enabled",
        value: "false",
        description: "是否启用全局广告",
        type: "boolean",
        group: "advertisement",
        public: true,
      },
      {
        key: "ad_global_content",
        value: "",
        description: "全局广告内容（支持HTML）",
        type: "string",
        group: "advertisement",
        public: true,
      },
      {
        key: "ad_global_position",
        value: "fixed-bottom",
        description: "全局广告位置（fixed-top/fixed-bottom/floating）",
        type: "string",
        group: "advertisement",
        public: true,
      },
      {
        key: "ad_global_style",
        value: "background: #f8f9fa; padding: 10px; text-align: center;",
        description: "全局广告样式（CSS）",
        type: "string",
        group: "advertisement",
        public: true,
      },
      {
        key: "seo_long_tail_keywords",
        value: "高清图片下载,免费图片素材,摄影技巧分享,创意设计灵感,图片社交平台,唯美图片欣赏",
        description: "SEO长尾关键词（逗号分隔）",
        type: "string",
        group: "seo",
        public: true,
      },
      {
        key: "seo_home_keywords",
        value: "图片社区,摄影作品,设计灵感,高清图片,创意分享",
        description: "首页专属关键词",
        type: "string",
        group: "seo",
        public: true,
      },
      {
        key: "seo_author_page_keywords",
        value: "摄影师,设计师,艺术家,创作者,作品展示",
        description: "作者页面关键词",
        type: "string",
        group: "seo",
        public: true,
      },
      {
        key: "seo_article_page_keywords",
        value: "摄影教程,设计文章,创作心得,图片故事,技巧分享",
        description: "文章页面关键词",
        type: "string",
        group: "seo",
        public: true,
      },
      // APP配置
      {
        key: "app_name",
        value: "PicArt",
        description: "APP名称",
        type: "string",
        group: "app",
        public: true,
      },
      {
        key: "app_version",
        value: "1.0.0",
        description: "APP版本号",
        type: "string",
        group: "app",
        public: true,
      },
      {
        key: "app_ios_version",
        value: "1.0.0",
        description: "iOS APP最新版本",
        type: "string",
        group: "app",
        public: true,
      },
      {
        key: "app_android_version",
        value: "1.0.0",
        description: "Android APP最新版本",
        type: "string",
        group: "app",
        public: true,
      },
      {
        key: "app_ios_download_url",
        value: "",
        description: "iOS APP下载地址",
        type: "string",
        group: "app",
        public: true,
      },
      {
        key: "app_android_download_url",
        value: "",
        description: "Android APP下载地址",
        type: "string",
        group: "app",
        public: true,
      },
      {
        key: "app_force_update",
        value: "false",
        description: "是否强制更新",
        type: "boolean",
        group: "app",
        public: true,
      },
      {
        key: "app_ios_force_update_version",
        value: "",
        description: "iOS强制更新版本号",
        type: "string",
        group: "app",
        public: true,
      },
      {
        key: "app_android_force_update_version",
        value: "",
        description: "Android强制更新版本号",
        type: "string",
        group: "app",
        public: true,
      },
      {
        key: "app_update_message",
        value: "发现新版本，请更新",
        description: "更新提示消息",
        type: "string",
        group: "app",
        public: true,
      },
      {
        key: "app_maintenance",
        value: "false",
        description: "APP维护模式",
        type: "boolean",
        group: "app",
        public: true,
      },
      {
        key: "app_maintenance_message",
        value: "APP维护中，请稍后再试",
        description: "APP维护提示消息",
        type: "string",
        group: "app",
        public: true,
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
    return {
      success: true,
      message: "response.success.configCreate",
      data: savedConfig,
    };
  }

  async findAll() {
    const data = await this.configRepository.find({
      order: { group: "ASC", key: "ASC" },
    });
    return ListUtil.buildSimpleList(data);
  }

  async findByGroup(group: string) {
    const data = await this.configRepository.find({
      where: { group },
      order: { key: "ASC" },
    });
    return ListUtil.buildSimpleList(data);
  }

  async findOne(id: number) {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new Error("配置不存在");
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
    
    // 刷新缓存
    await this.refreshConfigCache(updatedConfig.key);
    // 如果更新的是公共配置，也刷新公共配置缓存
    if (updatedConfig.public) {
      await this.cacheManager.del('public_configs');
    }
    
    return {
      success: true,
      message: "response.success.configUpdate",
      data: updatedConfig,
    };
  }

  async updateByKey(key: string, value: string) {
    const config = await this.configRepository.findOne({ where: { key } });
    if (!config) {
      throw new Error(`配置 ${key} 不存在`);
    }
    config.value = value;
    const updatedConfig = await this.configRepository.save(config);

    // 刷新缓存
    await this.refreshConfigCache(key);
    // 如果更新的是公共配置，也刷新公共配置缓存
    if (updatedConfig.public) {
      await this.cacheManager.del('public_configs');
    }

    // 发送配置更新通知事件
    this.eventEmitter.emit("config.updated", {
      group: updatedConfig.group,
    });

    return {
      success: true,
      message: "response.success.configUpdate",
      data: updatedConfig,
    };
  }

  async remove(id: number) {
    const config = await this.findOne(id);
    await this.configRepository.remove(config);
    return { success: true, message: "response.success.configDelete" };
  }

  async updateAll(configs: any[]) {
    const results: Config[] = [];
    for (const config of configs) {
      if (config.id) {
        const updatedConfig = await this.update(config.id, config);
        results.push(updatedConfig.data);
      }
    }
    await this.cacheConfigs();
    this.eventEmitter.emit("config.updated");

    return results;
  }

  async updateGroup(group: string, configs: any[]) {
    const results: Config[] = [];
    let hasPublicConfig = false;
    
    for (const config of configs) {
      if (config.key) {
        const existingConfig = await this.configRepository.findOne({
          where: { key: config.key, group },
        });
        if (existingConfig) {
          Object.assign(existingConfig, config);
          const updatedConfig =
            await this.configRepository.save(existingConfig);
          results.push(updatedConfig);
          
          // 刷新单个配置缓存
          await this.refreshConfigCache(config.key);
          
          // 标记是否有公共配置更新
          if (updatedConfig.public) {
            hasPublicConfig = true;
          }
        }
      }
    }
    
    // 根据分组刷新对应的配置缓存
    switch (group) {
      case 'payment':
        await this.cacheManager.del('payment_config');
        break;
      case 'commission':
        await this.cacheManager.del('commission_config');
        break;
      case 'advertisement':
        await this.cacheManager.del('advertisement_config');
        break;
      case 'app':
        await this.cacheManager.del('app_config');
        break;
      case 'site':
      case 'user':
      case 'content':
      case 'system':
      case 'invite':
      case 'seo':
      case 'app':
        // 这些分组的配置可能影响公共配置
        if (hasPublicConfig) {
          await this.cacheManager.del('public_configs');
        }
        break;
    }
    
    // 发送配置更新事件
    this.eventEmitter.emit("config.updated", { group });
    
    return results;
  }

  private parseConfigValue(config: Config): unknown {
    switch (config.type) {
      case "boolean":
        return config.value === "true";
      case "number":
        return parseInt(config.value, 10);
      case "json":
        return JSON.parse(config.value);
      default:
        return config.value;
    }
  }

  // 保留邀请码相关的便捷方法，因为用户服务中需要使用
  async isInviteCodeRequired(forceRefresh: boolean = false): Promise<boolean> {
    const config = await this.getCachedConfig("invite_code_required", false, forceRefresh);
    return config === true;
  }

  async isInviteCodeEnabled(forceRefresh: boolean = false): Promise<boolean> {
    const config = await this.getCachedConfig("invite_code_enabled", true, forceRefresh);
    return config === true;
  }

  /**
   * 从缓存获取配置值，如果不存在则从数据库获取并缓存
   * @param key 配置键
   * @param defaultValue 默认值
   * @param forceRefresh 是否强制刷新缓存（实时性要求高的场景）
   */
  private async getCachedConfig<T>(key: string, defaultValue: T, forceRefresh: boolean = false): Promise<T> {
    // 如果不需要强制刷新，先尝试从缓存获取
    if (!forceRefresh) {
      const cachedValue = await this.cacheManager.get(key);
      if (cachedValue !== undefined && cachedValue !== null) {
        return cachedValue as T;
      }
    }

    // 从数据库获取
    const config = await this.configRepository.findOne({ where: { key } });
    if (config) {
      const value = this.parseConfigValue(config);
      // 缓存配置，TTL 设置为 0（永不过期），因为我们会手动管理缓存
      await this.cacheManager.set(key, value, 0);
      return value as T;
    }

    // 返回默认值并缓存
    await this.cacheManager.set(key, defaultValue, 0);
    return defaultValue;
  }

  /**
   * 刷新指定配置的缓存
   */
  async refreshConfigCache(key: string): Promise<void> {
    const config = await this.configRepository.findOne({ where: { key } });
    if (config) {
      const value = this.parseConfigValue(config);
      await this.cacheManager.set(key, value, 0);
    }
  }

  /**
   * 刷新所有配置缓存
   */
  async refreshAllConfigCache(): Promise<void> {
    await this.cacheConfigs();
  }

  async getArticleApprovalRequired(forceRefresh: boolean = false): Promise<boolean> {
    const config = await this.getCachedConfig("article_approval_required", false, forceRefresh);
    return config === true;
  }

  async getArticleFreeImagesCount(forceRefresh: boolean = false): Promise<number> {
    const config = await this.getCachedConfig("article_free_images_count", "3", forceRefresh);
    return config ? Number(config) : 3;
  }

  async getInviteDefaultCommissionRate(forceRefresh: boolean = false): Promise<number> {
    const config = await this.getCachedConfig("invite_default_commission_rate", "0.05", forceRefresh);
    return config ? Number(config) : 0.05;
  }

  async getInviteCodeExpireDays(forceRefresh: boolean = false): Promise<number> {
    const config = await this.getCachedConfig("invite_code_expire_days", "30", forceRefresh);
    return config ? Number(config) : 30;
  }

  async getEmailVerificationEnabled(forceRefresh: boolean = false): Promise<boolean> {
    const config = await this.getCachedConfig("user_email_verification", false, forceRefresh);
    return config === true;
  }

  async getSiteMail(forceRefresh: boolean = false): Promise<string> {
    const config = await this.getCachedConfig("site_mail", "contact@example.com", forceRefresh);
    return config as string;
  }

  private async cacheConfigs() {
    const configs = await this.configRepository.find();
    for (const config of configs) {
      this.cacheManager.set(config.key, this.parseConfigValue(config), 0);
    }
  }

  /**
   * 获取所有公共配置（带缓存）
   * @param forceRefresh 是否强制刷新缓存
   */
  async getPublicConfigs(forceRefresh: boolean = false) {
    const cacheKey = 'public_configs';
    
    // 如果不需要强制刷新，先尝试从缓存获取
    if (!forceRefresh) {
      const cachedConfigs = await this.cacheManager.get(cacheKey);
      if (cachedConfigs) {
        return cachedConfigs;
      }
    }

    // 从数据库获取
    const configs = await this.configRepository.find({
      where: { public: true },
    });
    
    // 取key value
    const publicConfigs = {};
    for (const config of configs) {
      publicConfigs[config.key] = this.parseConfigValue(config);
    }
    
    // 缓存结果
    await this.cacheManager.set(cacheKey, publicConfigs, 0);
    
    return publicConfigs;
  }

  /**
   * 获取支付配置
   */
  /**
   * 获取支付配置（带缓存）
   * @param forceRefresh 是否强制刷新缓存
   */
  async getPaymentConfig(forceRefresh: boolean = false): Promise<{
    alipayEnabled: boolean;
    wechatEnabled: boolean;
    epayEnabled: boolean;
    alipay: {
      appId: string;
      privateKey: string;
      publicKey: string;
      gateway: string;
    };
    wechat: {
      appId: string;
      mchId: string;
      apiKey: string;
      privateKey: string;
      serialNo: string;
      publicKey: string;
    };
    epay: {
      appId: string;
      appKey: string;
      gateway: string;
      notifyUrl: string;
      wxpayEnabled: boolean;
      alipayEnabled: boolean;
      usdtEnabled: boolean;
    };
    notifyUrl: string;
    returnUrl: string;
  }> {
    const cacheKey = 'payment_config';
    
    // 如果不需要强制刷新，先尝试从缓存获取
    if (!forceRefresh) {
      const cachedConfig = await this.cacheManager.get(cacheKey);
      if (cachedConfig) {
        return cachedConfig as any;
      }
    }

    const configs = await this.configRepository.find({
      where: { group: "payment" },
    });

    const paymentConfig = {
      alipayEnabled: false,
      wechatEnabled: false,
      epayEnabled: false,
      alipay: {
        appId: "",
        privateKey: "",
        publicKey: "",
        gateway: "https://openapi.alipay.com/gateway.do",
      },
      wechat: {
        appId: "",
        mchId: "",
        apiKey: "",
        privateKey: "",
        serialNo: "",
        publicKey: "",
      },
      epay: {
        appId: "",
        appKey: "",
        gateway: "https://pay.example.com",
        notifyUrl: "",
        wxpayEnabled: false,
        alipayEnabled: false,
        usdtEnabled: false,
      },
      notifyUrl: "",
      returnUrl: "",
    };

    configs.forEach((config) => {
      const value = this.parseConfigValue(config);
      switch (config.key) {
        case "payment_alipay_enabled":
          paymentConfig.alipayEnabled = value as boolean;
          break;
        case "payment_wechat_enabled":
          paymentConfig.wechatEnabled = value as boolean;
          break;
        case "payment_epay_enabled":
          paymentConfig.epayEnabled = value as boolean;
          break;
        case "payment_alipay_app_id":
          paymentConfig.alipay.appId = value as string;
          break;
        case "payment_alipay_private_key":
          paymentConfig.alipay.privateKey = value as string;
          break;
        case "payment_alipay_public_key":
          paymentConfig.alipay.publicKey = value as string;
          break;
        case "payment_alipay_gateway":
          paymentConfig.alipay.gateway = value as string;
          break;
        case "payment_wechat_app_id":
          paymentConfig.wechat.appId = value as string;
          break;
        case "payment_wechat_mch_id":
          paymentConfig.wechat.mchId = value as string;
          break;
        case "payment_wechat_api_key":
          paymentConfig.wechat.apiKey = value as string;
          break;
        case "payment_wechat_private_key":
          paymentConfig.wechat.privateKey = value as string;
          break;
        case "payment_wechat_serial_no":
          paymentConfig.wechat.serialNo = value as string;
          break;
        case "payment_wechat_public_key":
          paymentConfig.wechat.publicKey = value as string;
          break;
        case "payment_epay_app_id":
          paymentConfig.epay.appId = value as string;
          break;
        case "payment_epay_app_key":
          paymentConfig.epay.appKey = value as string;
          break;
        case "payment_epay_gateway":
          paymentConfig.epay.gateway = value as string;
          break;
        case "payment_epay_notify_url":
          paymentConfig.epay.notifyUrl = value as string;
          break;
        case "payment_epay_wxpay_enabled":
          paymentConfig.epay.wxpayEnabled = value as boolean;
          break;
        case "payment_epay_alipay_enabled":
          paymentConfig.epay.alipayEnabled = value as boolean;
          break;
        case "payment_epay_usdt_enabled":
          paymentConfig.epay.usdtEnabled = value as boolean;
          break;
        case "payment_notify_url":
          paymentConfig.notifyUrl = value as string;
          break;
        case "payment_return_url":
          paymentConfig.returnUrl = value as string;
          break;
      }
    });

    // 缓存结果
    await this.cacheManager.set(cacheKey, paymentConfig, 0);

    return paymentConfig;
  }

  /**
   * 获取分成配置（带缓存）
   * @param forceRefresh 是否强制刷新缓存
   */
  async getCommissionConfig(forceRefresh: boolean = false) {
    const cacheKey = 'commission_config';
    
    // 如果不需要强制刷新，先尝试从缓存获取
    if (!forceRefresh) {
      const cachedConfig = await this.cacheManager.get(cacheKey);
      if (cachedConfig) {
        return cachedConfig;
      }
    }

    const configs = await this.configRepository.find({
      where: { group: "commission" },
    });

    const commissionConfig = {
      inviterRate: 0.05,
      platformRate: 0.1,
      authorRate: 0.85,
    };

    configs.forEach((config) => {
      const value = this.parseConfigValue(config);
      switch (config.key) {
        case "commission_inviter_rate":
          commissionConfig.inviterRate = value as number;
          break;
        case "commission_platform_rate":
          commissionConfig.platformRate = value as number;
          break;
        case "commission_author_rate":
          commissionConfig.authorRate = value as number;
          break;
      }
    });

    // 缓存结果
    await this.cacheManager.set(cacheKey, commissionConfig, 0);

    return commissionConfig;
  }

  /**
   * 获取广告配置（带缓存）
   * @param forceRefresh 是否强制刷新缓存（内部使用，不对外暴露）
   */
  async getAdvertisementConfig(forceRefresh: boolean = false) {
    const cacheKey = 'advertisement_config';
    
    // 如果不需要强制刷新，先尝试从缓存获取
    if (!forceRefresh) {
      const cachedConfig = await this.cacheManager.get(cacheKey);
      if (cachedConfig) {
        return cachedConfig;
      }
    }

    const configs = await this.configRepository.find({
      where: { group: "advertisement" },
    });

    const adConfig = {
      homepage: {
        enabled: false,
        content: "",
        position: "top",
      },
      articleTop: {
        enabled: false,
        content: "",
      },
      articleBottom: {
        enabled: false,
        content: "",
      },
      global: {
        enabled: false,
        content: "",
        position: "fixed-bottom",
        style: "background: #f8f9fa; padding: 10px; text-align: center;",
      },
    };

    configs.forEach((config) => {
      const value = this.parseConfigValue(config);
      switch (config.key) {
        case "ad_homepage_enabled":
          adConfig.homepage.enabled = value as boolean;
          break;
        case "ad_homepage_content":
          adConfig.homepage.content = value as string;
          break;
        case "ad_homepage_position":
          adConfig.homepage.position = value as string;
          break;
        case "ad_article_top_enabled":
          adConfig.articleTop.enabled = value as boolean;
          break;
        case "ad_article_top_content":
          adConfig.articleTop.content = value as string;
          break;
        case "ad_article_bottom_enabled":
          adConfig.articleBottom.enabled = value as boolean;
          break;
        case "ad_article_bottom_content":
          adConfig.articleBottom.content = value as string;
          break;
        case "ad_global_enabled":
          adConfig.global.enabled = value as boolean;
          break;
        case "ad_global_content":
          adConfig.global.content = value as string;
          break;
        case "ad_global_position":
          adConfig.global.position = value as string;
          break;
        case "ad_global_style":
          adConfig.global.style = value as string;
          break;
      }
    });

    // 缓存结果
    await this.cacheManager.set(cacheKey, adConfig, 0);

    return adConfig;
  }

  /**
   * 获取APP配置（带缓存）
   * @param forceRefresh 是否强制刷新缓存
   */
  async getAppConfig(forceRefresh: boolean = false) {
    const cacheKey = 'app_config';
    
    // 如果不需要强制刷新，先尝试从缓存获取
    if (!forceRefresh) {
      const cachedConfig = await this.cacheManager.get(cacheKey);
      if (cachedConfig) {
        return cachedConfig;
      }
    }

    const configs = await this.configRepository.find({
      where: { group: "app" },
    });

    const appConfig = {
      name: "PicArt",
      version: "1.0.0",
      ios: {
        version: "1.0.0",
        downloadUrl: "",
        forceUpdateVersion: "",
      },
      android: {
        version: "1.0.0",
        downloadUrl: "",
        forceUpdateVersion: "",
      },
      forceUpdate: false,
      updateMessage: "发现新版本，请更新",
      maintenance: false,
      maintenanceMessage: "APP维护中，请稍后再试",
    };

    configs.forEach((config) => {
      const value = this.parseConfigValue(config);
      switch (config.key) {
        case "app_name":
          appConfig.name = value as string;
          break;
        case "app_version":
          appConfig.version = value as string;
          break;
        case "app_ios_version":
          appConfig.ios.version = value as string;
          break;
        case "app_android_version":
          appConfig.android.version = value as string;
          break;
        case "app_ios_download_url":
          appConfig.ios.downloadUrl = value as string;
          break;
        case "app_android_download_url":
          appConfig.android.downloadUrl = value as string;
          break;
        case "app_force_update":
          appConfig.forceUpdate = value as boolean;
          break;
        case "app_ios_force_update_version":
          appConfig.ios.forceUpdateVersion = value as string;
          break;
        case "app_android_force_update_version":
          appConfig.android.forceUpdateVersion = value as string;
          break;
        case "app_update_message":
          appConfig.updateMessage = value as string;
          break;
        case "app_maintenance":
          appConfig.maintenance = value as boolean;
          break;
        case "app_maintenance_message":
          appConfig.maintenanceMessage = value as string;
          break;
      }
    });

    // 缓存结果
    await this.cacheManager.set(cacheKey, appConfig, 0);

    return appConfig;
  }
}
