/**
 * 从 HTML 正文提取纯文本摘要。
 *
 * 处理流程：
 * 1. 移除 script / style
 * 2. 表情图片先替换为占位符，正文转纯文本后还原
 * 3. 裁剪到指定长度并追加省略号
 */
export function extractHtmlSummary(
  html?: string,
  maxLength: number = 180,
): string {
  if (!html || typeof html !== "string") {
    return "";
  }

  const cleanedHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .trim();

  if (!cleanedHtml) {
    return "";
  }

  const emojiImgs: string[] = [];
  const withEmojiPlaceholders = cleanedHtml.replace(/<img\b[^>]*>/gi, (tag) => {
    const classMatch = tag.match(/\bclass\s*=\s*["']([^"']*)["']/i);
    const classNames = classMatch?.[1] || "";
    if (!/\bql-emoji-embed__img\b/.test(classNames)) {
      return " ";
    }

    const index = emojiImgs.push(tag) - 1;
    return ` __EMOJI_${index}__ `;
  });

  const plainText = withEmojiPlaceholders
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  if (!plainText) {
    return "";
  }

  const cropped =
    plainText.length > maxLength
      ? `${plainText.slice(0, maxLength).trim()}...`
      : plainText;

  return cropped.replace(/__EMOJI_(\d+)__/g, (_, indexText: string) => {
    const index = Number(indexText);
    return emojiImgs[index] || "";
  });
}
