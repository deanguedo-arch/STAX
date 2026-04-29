export type MemoryType =
  | "session"
  | "project"
  | "user_preference"
  | "correction"
  | "golden"
  | "example"
  | "forbidden"
  | "decision"
  | "known_failure"
  | "proven_working"
  | "unproven_claim"
  | "next_action"
  | "risk";

export type MemoryRecord = {
  id: string;
  type: MemoryType;
  scope?: "session" | "project";
  content: string;
  text: string;
  sourceRunId?: string;
  createdAt: string;
  expiresAt?: string;
  confidence: "low" | "medium" | "high";
  approved: boolean;
  approvedAt?: string;
  approvedBy?: string;
  approvalReason?: string;
  approvalSourceRunId?: string;
  neverExpireJustification?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  poisonScan: {
    status: "passed" | "flagged";
    flags: string[];
    scannedAt: string;
  };
  tags: string[];
};
