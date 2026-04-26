import { z } from "zod";
import type { ProofRedaction } from "./ProofRedactor.js";

export const ProofEvidenceTypeSchema = z.enum([
  "trace",
  "run",
  "eval",
  "test",
  "report",
  "file",
  "command",
  "learning_event"
]);

export const EvidenceItemSchema = z.object({
  evidenceId: z.string().min(1),
  evidenceType: ProofEvidenceTypeSchema,
  path: z.string().min(1).optional(),
  command: z.string().min(1).optional(),
  summary: z.string().min(1),
  claimSupported: z.string().min(1).optional(),
  confidence: z.enum(["low", "medium", "high"])
});

export const ProofPacketSchema = z.object({
  proofPacketId: z.string().min(1),
  createdAt: z.string().min(1),
  workspace: z.string().min(1).optional(),
  threadId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  runCreatedAt: z.string().min(1).optional(),
  mode: z.string().min(1).optional(),
  boundaryMode: z.string().min(1).optional(),
  selectedAgent: z.string().min(1).optional(),
  validationStatus: z.string().min(1).optional(),
  learningEventId: z.string().min(1).optional(),
  learningQueues: z.array(z.string()),
  policiesApplied: z.array(z.string()),
  evidenceItems: z.array(EvidenceItemSchema),
  redactions: z.array(z.object({ pattern: z.string().min(1), replacements: z.number().int().nonnegative() })),
  ambiguityWarnings: z.array(z.string())
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type ProofPacket = z.infer<typeof ProofPacketSchema>;

export type ProofPacketInput = Omit<ProofPacket, "proofPacketId" | "createdAt" | "redactions" | "ambiguityWarnings"> & {
  proofPacketId?: string;
  createdAt?: string;
  redactions?: ProofRedaction[];
  ambiguityWarnings?: string[];
};

export function createProofPacket(input: ProofPacketInput): ProofPacket {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const proofPacketId =
    input.proofPacketId ??
    `proof_${createdAt.replace(/[^0-9]/g, "").slice(0, 17)}_${Math.random().toString(36).slice(2, 8)}`;

  return ProofPacketSchema.parse({
    ...input,
    proofPacketId,
    createdAt,
    learningQueues: input.learningQueues ?? [],
    policiesApplied: input.policiesApplied ?? [],
    evidenceItems: input.evidenceItems ?? [],
    redactions: input.redactions ?? [],
    ambiguityWarnings: input.ambiguityWarnings ?? []
  });
}

export function renderProofPacket(packet: ProofPacket): string {
  return [
    "## Proof Packet",
    `- ProofPacket: ${packet.proofPacketId}`,
    `- CreatedAt: ${packet.createdAt}`,
    `- Workspace: ${packet.workspace ?? "unknown"}`,
    `- Thread: ${packet.threadId ?? "unknown"}`,
    `- Run: ${packet.runId ?? "unknown"}`,
    `- RunCreatedAt: ${packet.runCreatedAt ?? "unknown"}`,
    `- Mode: ${packet.mode ?? "unknown"}`,
    `- Boundary: ${packet.boundaryMode ?? "unknown"}`,
    `- Agent: ${packet.selectedAgent ?? "unknown"}`,
    `- Validation: ${packet.validationStatus ?? "unknown"}`,
    `- LearningEvent: ${packet.learningEventId ?? "none"}`,
    `- LearningQueues: ${packet.learningQueues.join(", ") || "none"}`,
    `- PoliciesApplied: ${packet.policiesApplied.join(", ") || "none"}`,
    "",
    "## Proof Evidence Items",
    ...(packet.evidenceItems.length ? packet.evidenceItems.flatMap(renderEvidenceItem) : ["- None."]),
    "",
    "## Proof Redactions",
    ...(packet.redactions.length
      ? packet.redactions.map((redaction) => `- ${redaction.pattern}: ${redaction.replacements}`)
      : ["- None."]),
    "",
    "## Proof Ambiguity Warnings",
    ...(packet.ambiguityWarnings.length ? packet.ambiguityWarnings.map((warning) => `- ${warning}`) : ["- None."])
  ].join("\n");
}

function renderEvidenceItem(item: EvidenceItem): string[] {
  return [
    `- Evidence: ${item.evidenceId}`,
    `  Type: ${item.evidenceType}`,
    ...(item.path ? [`  Path: ${item.path}`] : []),
    ...(item.command ? [`  Command: ${item.command}`] : []),
    `  Summary: ${item.summary}`,
    ...(item.claimSupported ? [`  ClaimSupported: ${item.claimSupported}`] : []),
    `  Confidence: ${item.confidence}`
  ];
}
