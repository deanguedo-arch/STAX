import { MemoryStore } from "./MemoryStore.js";

export class Retrieval {
  constructor(private store: MemoryStore) {}

  async retrieve(query: string, limit = 5): Promise<string[]> {
    const records = await this.store.search(query);
    return records.slice(0, limit).map((record) => record.text);
  }
}
