/**
 * 日志脱敏：把密码、token、验证码等字段替换为占位符，并限制嵌套深度与字符串长度，
 * 避免把完整请求体（含密钥或 base64 图片）打进日志。
 */

const SENSITIVE_KEY_PATTERN =
  /pass(word)?|pwd|token|secret|credential|authorization|cookie|session|captcha|verify ?code|verification ?code|sms ?code/i;

const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 500;
const REDACTED = "[REDACTED]";

function truncate(value: string): string {
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated ${value.length - MAX_STRING_LENGTH} chars]`
    : value;
}

export function sanitizeLogPayload(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return truncate(value);
  }

  if (typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }

  if (depth >= MAX_DEPTH) {
    return "[depth-limit]";
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeLogPayload(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`...[${value.length - MAX_ARRAY_ITEMS} more]`);
    }
    return items;
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? REDACTED
      : sanitizeLogPayload(item, depth + 1);
  }

  return result;
}
