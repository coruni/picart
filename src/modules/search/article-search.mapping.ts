export const articleMapping = {
  properties: {
    id: { type: "integer" },
    title: {
      type: "text",
      analyzer: "ik_max_word",
      search_analyzer: "ik_smart",
      fields: {
        keyword: { type: "keyword" },
      },
    },
    content: {
      type: "text",
      analyzer: "ik_max_word",
      search_analyzer: "ik_smart",
    },
    summary: {
      type: "text",
      analyzer: "ik_max_word",
      search_analyzer: "ik_smart",
    },
    authorId: { type: "integer" },
    authorName: {
      type: "text",
      analyzer: "ik_max_word",
      fields: {
        keyword: { type: "keyword" },
      },
    },
    categoryId: { type: "integer" },
    categoryName: {
      type: "text",
      analyzer: "ik_max_word",
      fields: {
        keyword: { type: "keyword" },
      },
    },
    tags: {
      type: "text",
      analyzer: "ik_max_word",
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
