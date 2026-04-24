export class ContextWindow {
  constructor(private maxItems = 12) {}

  trim(context: string[]): string[] {
    return context.slice(-this.maxItems);
  }
}
