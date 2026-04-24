export function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

export function extractSection(input: string, heading: string): string {
  const marker = `## ${heading}`;
  const start = input.indexOf(marker);
  if (start === -1) {
    return "";
  }

  const rest = input.slice(start + marker.length);
  const next = rest.search(/\n##\s+/);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}
