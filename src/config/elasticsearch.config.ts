import { ConfigService } from "@nestjs/config";
import { ElasticsearchModuleOptions } from "@nestjs/elasticsearch";

export const elasticsearchConfig = (
  configService: ConfigService,
): ElasticsearchModuleOptions | null => {
  const node = configService.get<string>("ELASTICSEARCH_NODE");

  // 如果没有配置 ES 地址，返回 null 表示不使用 ES
  if (!node) {
    return null;
  }

  return {
    node,
    auth: {
      username: configService.get<string>("ELASTICSEARCH_USERNAME") || "",
      password: configService.get<string>("ELASTICSEARCH_PASSWORD") || "",
    },
    maxRetries: 3,
    requestTimeout: 30000,
  };
};

export const ELASTICSEARCH_INDEX = {
  ARTICLES: "articles",
  USERS: "users",
};
