import { Module, DynamicModule } from "@nestjs/common";
import { ElasticsearchModule } from "@nestjs/elasticsearch";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SearchService } from "./search.service";
import { SearchSyncService } from "./search-sync.service";
import { SearchController } from "./search.controller";
import { elasticsearchConfig } from "../../config/elasticsearch.config";
import { Article } from "../article/entities/article.entity";

@Module({})
export class SearchModule {
  static forRoot(): DynamicModule {
    return {
      module: SearchModule,
      imports: [
        TypeOrmModule.forFeature([Article]),
        ElasticsearchModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => {
            const config = elasticsearchConfig(configService);
            // 如果没有配置 ES，返回一个无效配置，服务会处理这种情况
            return config || { node: "http://localhost:9200" };
          },
          inject: [ConfigService],
        }),
      ],
      controllers: [SearchController],
      providers: [SearchService, SearchSyncService],
      exports: [SearchService],
    };
  }
}
