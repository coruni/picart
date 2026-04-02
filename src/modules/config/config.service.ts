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
    const sitePrivacyPolicyDefault = `# 隐私政策

最近更新：请填写实际日期
生效日期：请填写实际日期

欢迎使用 PicArt。我们重视你的个人信息和隐私保护。本隐私政策用于说明你在使用本平台产品与服务时，我们如何收集、使用、存储、共享和保护你的个人信息。

## 一、我们收集的信息

根据你使用的功能范围，我们可能收集以下信息：

### 1. 你主动提供的信息

- 注册或登录时提交的信息，例如用户名、邮箱地址、密码。
- 你发布内容时提交的信息，例如文章、评论、图片、合集、个人简介与头像。
- 你联系客服、提交反馈、举报或申诉时提供的信息。

### 2. 使用服务过程中产生的信息

- 账号信息，例如用户编号、角色、权限、登录状态。
- 设备与日志信息，例如 IP 地址、浏览器信息、设备标识、访问时间、访问页面、操作记录、错误日志。
- 互动信息，例如点赞、收藏、关注、评论、私信、购买、订单与支付状态。

### 3. 第三方服务产生的信息

当你使用第三方登录、支付、对象存储、邮件或其他第三方能力时，相关服务提供方可能会依据其服务流程向我们返回必要的结果信息，例如支付结果、第三方账户标识或回调状态。

## 二、我们如何使用信息

我们可能将收集的信息用于以下用途：

- 提供、维护和优化平台服务。
- 完成账号注册、登录验证、身份识别与安全校验。
- 展示你主动公开发布的内容。
- 处理订单、支付、退款、结算与售后请求。
- 用于消息通知、客服支持、违规处理、申诉处理与系统公告。
- 保障平台与用户账号安全，识别异常行为、作弊、滥用或攻击行为。
- 满足法律法规要求或监管义务。

## 三、信息共享、转让与公开披露

除以下情况外，我们不会向无关第三方共享你的个人信息：

- 取得你的明确同意或授权。
- 为完成支付、通知、存储、登录、风控等必要服务而与合作服务商共享必要信息。
- 根据法律法规、司法机关、行政机关或监管部门要求提供。
- 为保护平台、用户或公众的人身、财产和其他合法权益，在法律允许范围内进行提供。

## 四、信息存储与保护

- 我们会采取合理、必要的技术和管理措施保护你的信息安全。
- 你的信息将存储于平台自有系统或受托服务商提供的基础设施中。
- 我们仅在实现服务目的所必需的期限内保留相关信息，法律法规另有要求的除外。

## 五、你的权利

在适用法律允许的范围内，你通常享有以下权利：

- 查询和访问你的个人信息。
- 更正或补充你的个人信息。
- 删除你主动发布的部分内容或申请注销账号。
- 撤回部分授权或关闭相关功能。
- 对个人信息处理规则提出意见、投诉或申诉。

## 六、未成年人保护

如你为未成年人，请在监护人指导下使用本平台服务。若相关法律法规对未成年人个人信息保护有特别规定，我们将依照其要求处理。

## 七、本政策的更新

我们可能根据业务变化、产品调整或法律法规要求更新本政策。更新后版本将通过站内页面或合理方式进行展示。若法律要求，我们会在必要时征求你的同意。

## 八、联系方式

如你对本隐私政策有任何疑问、意见或投诉，请通过以下方式联系我们：

- 联系邮箱：请填写真实联系邮箱
- 平台名称：请填写真实主体名称
- 联系地址：请填写真实联系地址（如适用）
`;

    const siteTermsOfServiceDefault = `# 服务条款

最近更新：请填写实际日期
生效日期：请填写实际日期

欢迎使用 PicArt。本服务条款用于说明你访问、注册、登录和使用本平台产品与服务时应当遵守的规则。你在注册、登录或继续使用本服务前，应当认真阅读并理解本条款。

## 一、协议范围

本条款适用于 PicArt 平台网站、应用程序、接口及其相关服务。若平台针对特定功能另有单独规则、活动说明、付费协议或补充条款，该等规则与本条款共同构成服务协议的一部分。

## 二、账号注册与使用

- 你应当保证注册信息真实、准确、完整，并及时更新。
- 你应当妥善保管账号、密码及登录凭证，并对账号下发生的行为承担责任。
- 你不得以任何方式盗用他人账号，或通过程序化、批量化、异常手段注册、登录或使用平台。
- 平台有权根据运营与安全需要，对异常账号采取验证、限制、冻结或其他必要措施。

## 三、用户内容

- 你发布、上传、评论、收藏、转载或以其他方式提交的内容，应当具有合法来源并不侵犯他人合法权益。
- 你应确保内容不包含违法违规、侵权、色情低俗、暴力恐怖、侮辱诽谤、恶意营销、恶意代码或其他不当信息。
- 在法律允许及服务实现所必需的范围内，你授权平台对你公开发布的内容进行存储、展示、传播、处理和必要的技术适配。

## 四、平台规则

你不得利用平台从事以下行为：

- 违反法律法规、公共秩序或公序良俗的行为。
- 侵犯他人知识产权、肖像权、名誉权、隐私权等合法权益。
- 发布垃圾信息、虚假信息、诈骗信息或恶意引流内容。
- 干扰、破坏、攻击平台系统、安全机制或正常运营秩序。
- 逆向工程、爬虫抓取、批量采集、绕过权限、恶意调用接口，或进行其他未经授权的技术行为。

平台有权依据法律法规及平台规则，对违规内容或违规账号采取删除、屏蔽、限流、禁言、封禁、终止服务等措施。

## 五、知识产权

- 平台自身的程序、页面设计、标识、文案、技术资料及相关内容，其知识产权归平台或相关权利人所有。
- 用户内容的权利归属以法律规定、实际授权及具体业务规则为准。
- 未经权利人许可，任何人不得擅自复制、传播、修改、出售或以其他方式使用受保护内容。

## 六、付费服务

如平台提供会员、文章购买、虚拟权益或其他付费服务，你应根据页面说明完成支付并遵守对应规则。具体价格、权益范围、生效方式、退款规则以当时页面展示及相关协议为准。

## 七、服务变更、中断与终止

平台可根据业务安排、合规要求、系统维护或安全治理需要，对全部或部分服务进行调整、升级、中断或终止。平台会在合理范围内尽量提前通知，但法律法规另有规定或紧急情形除外。

## 八、免责声明

- 平台将尽合理努力保障服务稳定与安全，但不对因不可抗力、网络故障、第三方原因、系统维护或超出合理控制范围的情形承担责任。
- 用户应对其发布内容、交易决策、外部跳转及自行判断行为负责。
- 法律法规另有强制性规定的，从其规定。

## 九、责任限制

在适用法律允许的最大范围内，平台对间接损失、后续损失、预期利益损失或因第三方原因导致的损失不承担责任。若法律要求平台承担责任，责任范围以法律明确规定及实际可证明损失为限。

## 十、适用法律与争议解决

本条款的订立、执行与解释适用平台运营主体所在地相关法律。因使用本服务引起的争议，双方应优先协商解决；协商不成的，可向有管辖权的人民法院或约定的争议解决机构处理。

## 十一、联系方式

如你对本条款有疑问，请通过以下方式联系我们：

- 联系邮箱：请填写真实联系邮箱
- 平台名称：请填写真实主体名称
- 联系地址：请填写真实联系地址（如适用）
`;

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
        key: "site_separator",
        value: "|",
        description: "站点分隔符",
        type: "string",
        group: "site",
        public: true,
      },
      {
        key: "site_privacy_policy",
        value: sitePrivacyPolicyDefault,
        description: "隐私政策链接",
        type: "string",
        group: "site",
        public: true,
      },
      {
        key: "site_terms_of_service",
        value: siteTermsOfServiceDefault,
        description: "服务条款链接",
        type: "string",
        group: "site",
        public: true,
      },
      {
        key: "site_contact",
        value:
          '<div class="site-contact">' +
          '<p>开发者邮箱：<a href="mailto:mineimc@outlook.com">mineimc@outlook.com</a></p>' +
          '<p>ICP备案号：<span>待补充真实备案号</span></p>' +
          '<p>' +
          '<a href="/" target="_blank" rel="noopener noreferrer">官网首页</a> | ' +
          '<a href="/about" target="_blank" rel="noopener noreferrer">关于我们</a> | ' +
          '<a href="/privacy" target="_blank" rel="noopener noreferrer">隐私政策</a> | ' +
          '<a href="/terms" target="_blank" rel="noopener noreferrer">服务条款</a>' +
          '</p>' +
          '</div>',
        description: "站点联系方式（可用于 HTML）",
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
        value:
          "高清图片下载,免费图片素材,摄影技巧分享,创意设计灵感,图片社交平台,唯美图片欣赏",
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
      // 收藏夹配置
      {
        key: "favorite_max_free_count",
        value: "6",
        description: "免费收藏夹最大数量",
        type: "number",
        group: "favorite",
        public: true,
      },
      {
        key: "favorite_create_cost",
        value: "10",
        description: "创建收藏夹所需积分（超出免费数量后）",
        type: "number",
        group: "favorite",
        public: true,
      },
      // Telegram 下载配置
      {
        key: "telegram_bot_token",
        value: "",
        description: "Telegram Bot Token",
        type: "string",
        group: "telegram",
      },
      {
        key: "telegram_proxy_enabled",
        value: "false",
        description: "是否启用 Telegram 反代",
        type: "boolean",
        group: "telegram",
        public: true,
      },
      {
        key: "telegram_proxy_url",
        value: "",
        description: "Telegram API 反代地址（如 https://api.example.com）",
        type: "string",
        group: "telegram",
        public: true,
      },
      {
        key: "telegram_forward_chat_id",
        value: "",
        description:
          "Telegram 转发频道ID（用于处理消息链接，Bot需有管理员权限）",
        type: "string",
        group: "telegram",
      },
    ];

    await this.configRepository.delete([
      { key: "site_privacy_policy_url" },
      { key: "site_terms_of_service_url" },
    ]);

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
      await this.cacheManager.del("public_configs");
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
      await this.cacheManager.del("public_configs");
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
      case "payment":
        await this.cacheManager.del("payment_config");
        break;
      case "commission":
        await this.cacheManager.del("commission_config");
        break;
      case "advertisement":
        await this.cacheManager.del("advertisement_config");
        break;
      case "app":
        await this.cacheManager.del("app_config");
        break;
      case "favorite":
        // 收藏夹配置更新时刷新缓存
        await this.refreshConfigCache("favorite_max_free_count");
        await this.refreshConfigCache("favorite_create_cost");
        break;
      case "site":
      case "user":
      case "content":
      case "system":
      case "invite":
      case "seo":
      case "app":
      case "favorite":
        // 这些分组的配置可能影响公共配置
        if (hasPublicConfig) {
          await this.cacheManager.del("public_configs");
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
    const config = await this.getCachedConfig(
      "invite_code_required",
      false,
      forceRefresh,
    );
    return config === true;
  }

  async isInviteCodeEnabled(forceRefresh: boolean = false): Promise<boolean> {
    const config = await this.getCachedConfig(
      "invite_code_enabled",
      true,
      forceRefresh,
    );
    return config === true;
  }

  /**
   * 从缓存获取配置值，如果不存在则从数据库获取并缓存
   * @param key 配置键
   * @param defaultValue 默认值
   * @param forceRefresh 是否强制刷新缓存（实时性要求高的场景）
   */
  async getCachedConfig<T>(
    key: string,
    defaultValue: T,
    forceRefresh: boolean = false,
  ): Promise<T> {
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

  async getArticleApprovalRequired(
    forceRefresh: boolean = false,
  ): Promise<boolean> {
    const config = await this.getCachedConfig(
      "article_approval_required",
      false,
      forceRefresh,
    );
    return config === true;
  }

  async getArticleFreeImagesCount(
    forceRefresh: boolean = false,
  ): Promise<number> {
    const config = await this.getCachedConfig(
      "article_free_images_count",
      "3",
      forceRefresh,
    );
    return config ? Number(config) : 3;
  }

  async getInviteDefaultCommissionRate(
    forceRefresh: boolean = false,
  ): Promise<number> {
    const config = await this.getCachedConfig(
      "invite_default_commission_rate",
      "0.05",
      forceRefresh,
    );
    return config ? Number(config) : 0.05;
  }

  async getInviteCodeExpireDays(
    forceRefresh: boolean = false,
  ): Promise<number> {
    const config = await this.getCachedConfig(
      "invite_code_expire_days",
      "30",
      forceRefresh,
    );
    return config ? Number(config) : 30;
  }

  async getEmailVerificationEnabled(
    forceRefresh: boolean = false,
  ): Promise<boolean> {
    const config = await this.getCachedConfig(
      "user_email_verification",
      false,
      forceRefresh,
    );
    return config === true;
  }

  async getSiteMail(forceRefresh: boolean = false): Promise<string> {
    const config = await this.getCachedConfig(
      "site_mail",
      "contact@example.com",
      forceRefresh,
    );
    return config as string;
  }

  async getSiteContact(forceRefresh: boolean = false): Promise<string> {
    const config = await this.getCachedConfig(
      "site_contact",
      "",
      forceRefresh,
    );
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
    const cacheKey = "public_configs";

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
    const cacheKey = "payment_config";

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
    const cacheKey = "commission_config";

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
    const cacheKey = "advertisement_config";

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
    const cacheKey = "app_config";

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

  /**
   * 获取 Telegram 配置（带缓存）
   * @param forceRefresh 是否强制刷新缓存
   */
  async getTelegramConfig(forceRefresh: boolean = false) {
    const cacheKey = "telegram_config";

    // 如果不需要强制刷新，先尝试从缓存获取
    if (!forceRefresh) {
      const cachedConfig = await this.cacheManager.get(cacheKey);
      if (cachedConfig) {
        return cachedConfig as {
          botToken: string;
          proxyEnabled: boolean;
          proxyUrl: string;
          forwardChatId: string;
        };
      }
    }

    const botToken = await this.getCachedConfig(
      "telegram_bot_token",
      "",
      forceRefresh,
    );
    const proxyEnabled = await this.getCachedConfig(
      "telegram_proxy_enabled",
      false,
      forceRefresh,
    );
    const proxyUrl = await this.getCachedConfig(
      "telegram_proxy_url",
      "",
      forceRefresh,
    );
    const forwardChatId = await this.getCachedConfig(
      "telegram_forward_chat_id",
      "",
      forceRefresh,
    );

    const telegramConfig = {
      botToken,
      proxyEnabled,
      proxyUrl,
      forwardChatId,
    };

    // 缓存结果
    await this.cacheManager.set(cacheKey, telegramConfig, 0);

    return telegramConfig;
  }
}
