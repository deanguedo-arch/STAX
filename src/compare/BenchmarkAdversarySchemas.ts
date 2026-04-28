import { z } from "zod";

export const BenchmarkAdversaryMutationKindSchema = z.enum([
  "irrelevant_file_names",
  "irrelevant_commands",
  "proof_slogans",
  "remove_backticks",
  "fake_local_evidence",
  "vague_command",
  "remove_repo_name"
]);

export const BenchmarkAdversaryInputSchema = z.object({
  task: z.string().min(1),
  localEvidence: z.string().default(""),
  cleanAnswer: z.string().min(1),
  garbageAnswer: z.string().optional()
});

export const BenchmarkAdversaryMutationResultSchema = z.object({
  mutationKind: BenchmarkAdversaryMutationKindSchema,
  answer: z.string(),
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  reason: z.string()
});

export const BenchmarkAdversaryResultSchema = z.object({
  cleanScore: z.number().min(0).max(100),
  garbageScore: z.number().min(0).max(100).optional(),
  passed: z.boolean(),
  blockingReasons: z.array(z.string()),
  mutations: z.array(BenchmarkAdversaryMutationResultSchema)
});

export type BenchmarkAdversaryInput = z.input<typeof BenchmarkAdversaryInputSchema>;
export type BenchmarkAdversaryResult = z.infer<typeof BenchmarkAdversaryResultSchema>;
