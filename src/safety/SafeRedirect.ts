export function safeRedirect(reason: string): string {
  return [
    "I can't help with that request as stated.",
    `Reason: ${reason}.`,
    "I can help with a safer version: high-level explanation, prevention, detection, planning, or non-actionable education."
  ].join("\n");
}
