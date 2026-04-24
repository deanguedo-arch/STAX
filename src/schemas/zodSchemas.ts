import { z } from "zod";

export const RaxModeSchema = z.enum([
  "intake",
  "analysis",
  "planning",
  "audit",
  "stax_fitness",
  "code_review",
  "teaching",
  "general_chat"
]);

export const DetailLevelSchema = z.enum([
  "minimal",
  "brief",
  "standard",
  "deep",
  "surgical"
]);

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);

export const RiskScoreSchema = z.object({
  intent: z.number(),
  harm: z.number(),
  actionability: z.number(),
  privacy: z.number(),
  exploitation: z.number(),
  regulatedAdvice: z.number(),
  systemIntegrity: z.number(),
  total: z.number(),
  labels: z.array(z.string())
});

export const ModeDetectionSchema = z.object({
  mode: RaxModeSchema,
  confidence: z.number(),
  matchedTerms: z.array(z.string()),
  fallbackUsed: z.boolean()
});

export const IntentClassificationSchema = z.object({
  intent: z.enum(["extract", "analyze", "plan", "audit", "teach", "chat"]),
  confidence: z.number(),
  matchedTerms: z.array(z.string())
});

export const BoundaryDecisionSchema = z.object({
  mode: z.enum(["allow", "constrain", "refuse", "redirect"]),
  reason: z.string(),
  allowedDetailLevel: DetailLevelSchema
});

export const PolicyBundleSchema = z.object({
  policiesApplied: z.array(z.string()),
  compiledSystemPrompt: z.string(),
  outputContract: z.string(),
  forbiddenBehaviors: z.array(z.string()),
  requiredBehaviors: z.array(z.string())
});

export const MessageSchema = z.object({
  role: z.enum(["system", "developer", "user", "assistant", "tool"]),
  content: z.string(),
  name: z.string().optional()
});

export const CompleteRequestSchema = z.object({
  system: z.string().optional(),
  messages: z.array(MessageSchema),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  seed: z.number().optional(),
  maxTokens: z.number().optional(),
  timeoutMs: z.number().optional()
});

export const CompleteResponseSchema = z.object({
  text: z.string(),
  raw: z.unknown().optional(),
  usage: z.object({ totalTokens: z.number().optional() }).optional()
});

export const ClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  source: z.enum([
    "user_input",
    "retrieved_memory",
    "retrieved_example",
    "retrieved_file",
    "model_inference"
  ]),
  confidence: ConfidenceSchema,
  evidence: z.string().optional()
});

export const AgentResultSchema = z.object({
  agent: z.string(),
  output: z.string(),
  confidence: ConfidenceSchema,
  claims: z.array(ClaimSchema).optional(),
  errors: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const CriticReviewSchema = z.object({
  pass: z.boolean(),
  issuesFound: z.array(z.string()),
  requiredFixes: z.array(z.string()),
  policyViolations: z.array(z.string()),
  schemaIssues: z.array(z.string()),
  confidence: ConfidenceSchema
});

export const SignalUnitSchema = z.object({
  id: z.string(),
  type: z.string(),
  source: z.string(),
  timestamp: z.string().optional(),
  rawInput: z.string(),
  observedFact: z.string(),
  inference: z.string().optional(),
  confidence: ConfidenceSchema
});

export const StaxFitnessOutputSchema = z.object({
  signalUnits: z.array(SignalUnitSchema),
  timeline: z.array(z.string()),
  patternCandidates: z.array(z.string()),
  deviations: z.array(z.string()),
  unknowns: z.array(z.string()),
  confidenceSummary: ConfidenceSchema
});

export const PlannerOutputSchema = z.object({
  objective: z.string(),
  assumptions: z.array(z.string()).default([]),
  plan: z.array(z.string()),
  filesToCreateOrModify: z.array(z.string()).default([]),
  tests: z.array(z.string()),
  risks: z.array(z.string()).default([]),
  doneCriteria: z.array(z.string()).default([])
});

export const EvalCaseSchema = z.object({
  id: z.string(),
  mode: RaxModeSchema,
  input: z.string(),
  expectedProperties: z.array(z.string()),
  forbiddenPatterns: z.array(z.string()),
  requiredSections: z.array(z.string()),
  critical: z.boolean(),
  tags: z.array(z.string())
});

export const CorrectionErrorTypeSchema = z.enum([
  "assumption_error",
  "missing_signal",
  "bad_routing",
  "over_refusal",
  "under_refusal",
  "format_drift",
  "hallucination",
  "weak_plan",
  "wrong_tone",
  "missing_uncertainty",
  "schema_failure"
]);

export const CorrectionItemSchema = z.object({
  correctionId: z.string(),
  runId: z.string(),
  createdAt: z.string(),
  originalOutput: z.string(),
  correctedOutput: z.string(),
  reason: z.string(),
  errorType: CorrectionErrorTypeSchema,
  policyViolated: z.string().optional(),
  tags: z.array(z.string()),
  approved: z.boolean(),
  promoteToEval: z.boolean(),
  promoteToTraining: z.boolean()
});

export const MemoryItemSchema = z.object({
  id: z.string(),
  type: z.enum([
    "session",
    "project",
    "user_preference",
    "correction",
    "golden",
    "example",
    "forbidden"
  ]),
  content: z.string(),
  sourceRunId: z.string().optional(),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  confidence: ConfidenceSchema,
  approved: z.boolean(),
  tags: z.array(z.string())
});

export const ToolCallSchema = z.object({
  id: z.string(),
  tool: z.string(),
  input: z.unknown(),
  reason: z.string(),
  allowed: z.boolean(),
  resultSummary: z.string().optional(),
  error: z.string().optional()
});

export const RunTraceSchema = z.object({
  runId: z.string(),
  createdAt: z.string(),
  runtimeVersion: z.string(),
  provider: z.string(),
  model: z.string(),
  criticModel: z.string(),
  temperature: z.number(),
  criticTemperature: z.number(),
  topP: z.number(),
  seed: z.number(),
  mode: RaxModeSchema,
  modeConfidence: z.number(),
  boundaryMode: z.enum(["allow", "constrain", "refuse", "redirect"]),
  selectedAgent: z.string(),
  policiesApplied: z.array(z.string()),
  criticPasses: z.number(),
  repairPasses: z.number(),
  formatterPasses: z.number(),
  schemaRetries: z.number(),
  latencyMs: z.number(),
  toolCalls: z.array(ToolCallSchema),
  errors: z.array(z.string())
});

export const RaxOutputSchema = z.object({
  runId: z.string(),
  mode: z.enum(["allow", "constrain", "refuse", "redirect"]),
  taskMode: z.union([RaxModeSchema, z.literal("boundary")]),
  agent: z.string(),
  risk: RiskScoreSchema,
  output: z.string(),
  validation: z.object({
    valid: z.boolean(),
    issues: z.array(z.string())
  }),
  createdAt: z.string()
});
