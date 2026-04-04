export function getHeaderValue(
  headers: unknown,
  name: string,
): string | undefined {
  if (!headers || typeof headers !== "object") {
    return undefined;
  }

  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(
    headers as Record<string, unknown>,
  )) {
    if (key.toLowerCase() !== target) {
      continue;
    }

    if (Array.isArray(value)) {
      return value.length ? String(value[0]) : undefined;
    }

    if (value === undefined || value === null) {
      return undefined;
    }

    return String(value);
  }

  return undefined;
}
