export function missingHeadings(output: string, headings: string[]): string[] {
  return headings.filter((heading) => !output.includes(heading));
}

export function sectionContent(output: string, heading: string): string {
  const start = output.indexOf(heading);
  if (start === -1) return "";
  const afterHeading = output.slice(start + heading.length);
  const nextHeading = afterHeading.search(/\n##\s+/);
  return (nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading)).trim();
}

export function sectionLines(output: string, heading: string): string[] {
  return sectionContent(output, heading)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
