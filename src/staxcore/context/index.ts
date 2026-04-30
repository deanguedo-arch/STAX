export function attachContext<T>(
  data: T,
  context: Record<string, unknown> = {}
): { data: T; context: Record<string, unknown> } {
  return { data, context };
}
