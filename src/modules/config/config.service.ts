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
    this.eventEmitter.emit("config.updated");
    await this.cacheConfigs();
    return results;
  }

  async updateGroup(group: string, configs: any[]) {
    const results: Config[] = [];
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
        }
      }
    }
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
  async isInviteCodeRequired(): Promise<boolean> {
    const config = await this.findByKey("invite_code_required");
    return config === true;
  }

  async isInviteCodeEnabled(): Promise<boolean> {
    const config = await this.findByKey("invite_code_enabled");
    return config === true;
  }

  async getArticleApprovalRequired(): Promise<boolean> {
    const config = await this.findByKey("article_approval_required");
    return config === true;
  }

  async getInviteDefaultCommissionRate(): Promise<number> {
    const config = await this.findByKey("invite_default_commission_rate");
    return config ? Number(config) : 0.05;
  }

  async getInviteCodeExpireDays(): Promise<number> {
    const config = await this.findByKey("invite_code_expire_days");
    return config ? Number(config) : 30;
  }

  async getEmailVerificationEnabled(): Promise<boolean> {
    const config = await this.cacheManager.get("user_email_verification");
    return config === true;
  }

  private async cacheConfigs() {
    const configs = await this.configRepository.find();
    for (const config of configs) {
      this.cacheManager.set(config.key, this.parseConfigValue(config), 0);
    }
  }

  async getPublicConfigs() {
    const configs = await this.configRepository.find({
      where: { public: true },
    });
    // 取key value
    const publicConfigs = {};
    for (const config of configs) {
      publicConfigs[config.key] = this.parseConfigValue(config);
    }
    return publicConfigs;
  }

  /**
   * 获取支付配置
   */
  async getPaymentConfig() {
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

    return paymentConfig;
  }

  /**
   * 获取分成配置
   */
  async getCommissionConfig() {
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

    return commissionConfig;
  }

  /**
   * 获取广告配置
   */
  async getAdvertisementConfig() {
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

    return adConfig;
  }
}
