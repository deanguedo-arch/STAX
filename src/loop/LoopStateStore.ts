import {
  LoopStateSnapshotSchema,
  type LoopStateSnapshot
} from "./SandboxLoopSchemas.js";

export class LoopStateStore {
  private snapshots: LoopStateSnapshot[] = [];

  record(snapshot: LoopStateSnapshot): LoopStateSnapshot {
    const parsed = LoopStateSnapshotSchema.parse(snapshot);
    this.snapshots.push(parsed);
    return parsed;
  }

  list(): LoopStateSnapshot[] {
    return [...this.snapshots];
  }
}
