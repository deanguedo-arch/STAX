export function frameOutput<T>(data: T): { frame: "neutral"; data: T } {
  return { frame: "neutral", data };
}
