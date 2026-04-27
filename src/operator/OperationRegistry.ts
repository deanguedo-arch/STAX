import type { OperationIntent } from "./OperationSchemas.js";

export type RegisteredOperation = {
  intent: OperationIntent;
  description: string;
  autoExecutable: boolean;
};

export class OperationRegistry {
  list(): RegisteredOperation[] {
    return [
      {
        intent: "audit_workspace",
        description: "Audit a registered workspace or the current repo with local proof.",
        autoExecutable: true
      },
      {
        intent: "judgment_digest",
        description: "Read current review items that need human judgment.",
        autoExecutable: true
      },
      {
        intent: "audit_last_proof",
        description: "Audit the last chat-linked run with proof.",
        autoExecutable: true
      },
      {
        intent: "unknown",
        description: "Fall back to normal chat or block/defer unsupported high-risk operations.",
        autoExecutable: false
      }
    ];
  }
}
