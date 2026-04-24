export function createRunId(): string {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const random = Math.random().toString(36).slice(2, 8);
  return `run-${now}-${random}`;
}
