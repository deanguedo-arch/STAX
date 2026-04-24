import { MemoryStore } from "./MemoryStore.js";

export class SessionMemory {
  constructor(private store: MemoryStore) {}

  add(text: string, tags: string[] = []) {
    return this.store.add("session", text, tags);
  }
}
