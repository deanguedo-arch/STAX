import {
  ProofBoundaryInputSchema,
  ProofBoundaryResultSchema,
  type EvidenceFamily,
  type ProofBoundaryInput,
  type ProofBoundaryResult
} from "./ProofBoundarySchemas.js";

type BoundaryRule = {
  verifiedScope: string[];
  unverifiedScope: string[];
  requiredNextProof: string[];
};

const RULES: Record<EvidenceFamily, BoundaryRule> = {
  docx: {
    verifiedScope: ["DOCX parsing path only"],
    unverifiedScope: ["PDF parsing", "OCR recovery", "structured recovery"],
    requiredNextProof: ["Run the focused PDF parser test or paste PDF parser command output before claiming PDF support."]
  },
  pdf: {
    verifiedScope: ["PDF parsing path only"],
    unverifiedScope: ["DOCX parsing", "OCR recovery", "structured recovery"],
    requiredNextProof: ["Run the adjacent DOCX/OCR/structured recovery command before broad parser claims."]
  },
  ocr: {
    verifiedScope: ["OCR extraction path only"],
    unverifiedScope: ["structured recovery", "non-OCR parser recovery"],
    requiredNextProof: ["Run structured recovery tests before claiming recovery behavior works."]
  },
  structured_recovery: {
    verifiedScope: ["structured recovery path only"],
    unverifiedScope: ["OCR extraction", "DOCX parsing", "PDF parsing"],
    requiredNextProof: ["Run OCR/PDF/DOCX focused tests before broad ingest claims."]
  },
  course_shell: {
    verifiedScope: ["course shell generation checks"],
    unverifiedScope: ["full e2e flow", "rendered preview", "export quality", "hosted deployment"],
    requiredNextProof: ["Run project e2e or capture rendered preview evidence before claiming the full course works."]
  },
  e2e: {
    verifiedScope: ["configured e2e scenario"],
    unverifiedScope: ["visual correctness not asserted by the e2e", "deployment outside the tested target"],
    requiredNextProof: ["Attach screenshot/checklist evidence for visual claims not covered by assertions."]
  },
  rendered_preview: {
    verifiedScope: ["rendered preview visual observation"],
    unverifiedScope: ["unit test pass", "export packaging", "deployment"],
    requiredNextProof: ["Run the relevant test/export command before claiming runtime or package success."]
  },
  fixture: {
    verifiedScope: ["fixture or golden-file shape"],
    unverifiedScope: ["rendered export", "live course behavior", "visual correctness"],
    requiredNextProof: ["Render or export the course and inspect the produced artifact before claiming rendered output."]
  },
  rendered_export: {
    verifiedScope: ["rendered export artifact"],
    unverifiedScope: ["source fixture parity", "deployment", "runtime tests"],
    requiredNextProof: ["Run fixture/parity/release checks before claiming release readiness."]
  },
  conversion: {
    verifiedScope: ["conversion command output"],
    unverifiedScope: ["validation success", "release readiness", "semantic course correctness"],
    requiredNextProof: ["Run the validate/audit command before claiming Brightspace validation success."]
  },
  validation: {
    verifiedScope: ["validation command output"],
    unverifiedScope: ["successful conversion artifact if conversion did not run", "deployment"],
    requiredNextProof: ["Run conversion/build commands when the claim depends on produced artifacts."]
  },
  build: {
    verifiedScope: ["build command output"],
    unverifiedScope: ["tests", "deployment", "runtime behavior outside build"],
    requiredNextProof: ["Run the relevant test or deploy-dry-run command before broader claims."]
  },
  deploy: {
    verifiedScope: ["deployment command output"],
    unverifiedScope: ["live environment verification unless live check output is supplied"],
    requiredNextProof: ["Capture live deployment URL/status evidence before claiming production is working."]
  },
  no_test_script: {
    verifiedScope: ["absence of a package test script"],
    unverifiedScope: ["npm test pass", "test coverage", "runtime correctness"],
    requiredNextProof: ["Use the existing build script output, such as npm run build:pages when that is the only script, or add an explicit test script before claiming tests pass."]
  },
  unknown: {
    verifiedScope: [],
    unverifiedScope: ["claim scope"],
    requiredNextProof: ["Provide command output, file evidence, or a screenshot/checklist tied to the claim."]
  }
};

export class ProofBoundaryClassifier {
  classify(input: ProofBoundaryInput): ProofBoundaryResult {
    const parsed = ProofBoundaryInputSchema.parse(input);
    const evidenceFamily = detectFamily(parsed.evidence.trim() || parsed.claim);
    const rule = RULES[evidenceFamily];
    return ProofBoundaryResultSchema.parse({
      claim: parsed.claim,
      evidenceFamily,
      verifiedScope: rule.verifiedScope,
      unverifiedScope: rule.unverifiedScope,
      requiredNextProof: rule.requiredNextProof
    });
  }
}

export function detectFamily(text: string): EvidenceFamily {
  if (/\b(no test script|only script is `?build:pages|missing test script|no package test)\b/i.test(text)) return "no_test_script";
  if (/\b(docx|\.docx)\b/i.test(text)) return "docx";
  if (/\b(pdf|\.pdf)\b/i.test(text)) return "pdf";
  if (/\bocr\b/i.test(text)) return "ocr";
  if (/\bstructured recovery|structured_recovery|recovery tests?\b/i.test(text)) return "structured_recovery";
  if (/\btest:course-shell|course shell\b/i.test(text)) return "course_shell";
  if (/\btest:e2e|e2e\b/i.test(text)) return "e2e";
  if (/\brendered preview|screenshot|visual finding|visual proof\b/i.test(text)) return "rendered_preview";
  if (/\bexports:fixtures|fixture|golden\b/i.test(text)) return "fixture";
  if (/\brendered export|export artifact|exported course\b/i.test(text)) return "rendered_export";
  if (/\bcf:convert|convert\b/i.test(text)) return "conversion";
  if (/\bcf:validate|validate|validation\b/i.test(text)) return "validation";
  if (/\bbuild:pages|npm run build|build command\b/i.test(text)) return "build";
  if (/\bdeploy|deployment|github pages|clasp push\b/i.test(text)) return "deploy";
  return "unknown";
}
