import { MemoryStore } from "./MemoryStore.js";

export class ProjectMemory {
  constructor(private store: MemoryStore) {}

  add(text: string, tags: string[] = []) {
    return this.store.add("project", text, tags);
  }
}
