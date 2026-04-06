// 根据环境变量决定是否使用 IK 分词器
const useIkAnalyzer = process.env.ELASTICSEARCH_USE_IK === "true";

// 默认使用 standard 分词器，IK 分词器需要额外安装插件
const indexAnalyzer = useIkAnalyzer ? "ik_max_word" : "standard";
const searchAnalyzer = useIkAnalyzer ? "ik_smart" : "standard";

export const articleMapping = {
  properties: {
    id: { type: "integer" },
    title: {
      type: "text",
      analyzer: indexAnalyzer,
      search_analyzer: searchAnalyzer,
      fields: {
        keyword: { type: "keyword" },
      },
    },
    content: {
      type: "text",
      analyzer: indexAnalyzer,
      search_analyzer: searchAnalyzer,
    },
    summary: {
      type: "text",
      analyzer: indexAnalyzer,
      search_analyzer: searchAnalyzer,
    },
    authorId: { type: "integer" },
    authorName: {
      type: "text",
      analyzer: indexAnalyzer,
      fields: {
        keyword: { type: "keyword" },
      },
    },
    categoryId: { type: "integer" },
    categoryName: {
      type: "text",
      analyzer: indexAnalyzer,
      fields: {
        keyword: { type: "keyword" },
      },
    },
    tags: {
      type: "text",
      analyzer: indexAnalyzer,
      fields: {
        keyword: { type: "keyword" },
      },
    },
    tagIds: { type: "integer" },
    status: { type: "keyword" },
    views: { type: "integer" },
    likes: { type: "integer" },
    commentCount: { type: "integer" },
    requireLogin: { type: "boolean" },
    requireFollow: { type: "boolean" },
    requireMembership: { type: "boolean" },
    requirePayment: { type: "boolean" },
    viewPrice: { type: "float" },
    createdAt: { type: "date" },
    updatedAt: { type: "date" },
    sort: { type: "integer" },
    type: { type: "keyword" },
  },
};

// 索引设置
export const getIndexSettings = () => {
  if (useIkAnalyzer) {
    return {
      analysis: {
        analyzer: {
          ik_max_word: {
            type: "custom",
            tokenizer: "ik_max_word",
          },
          ik_smart: {
            type: "custom",
            tokenizer: "ik_smart",
          },
        },
      },
    };
  }
  // 使用默认的 standard 分词器，无需额外配置
  return {};
};
