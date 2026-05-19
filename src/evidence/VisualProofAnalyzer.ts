import fs from "node:fs/promises";
import path from "node:path";
import {
  VisualProofAnalyzerInputSchema,
  VisualProofFixtureFileSchema,
  type ParsedVisualProofAnalyzerInput,
  type VisualProofAnalyzerInput,
  type VisualProofAnalyzerResult,
  type VisualProofFixtureCase,
  type VisualProofFindingId
} from "./VisualProofAnalyzerSchemas.js";

type Finding = VisualProofAnalyzerResult["findings"][number];

export function analyzeVisualProof(input: VisualProofAnalyzerInput): VisualProofAnalyzerResult {
  const parsed = VisualProofAnalyzerInputSchema.parse(input);
  const findings: Finding[] = [];
  const text = `${parsed.description}\n${parsed.checklistItems.join("\n")}`.toLowerCase();
  const taskText = parsed.task.toLowerCase();
  const hasVisualFiles = parsed.changedFiles.some((file) => /\.(css|scss|sass|less|html|tsx|jsx|vue|svelte)$/i.test(file) || file.includes("/workspace/"));
  const hasScreenshot = parsed.source === "rendered_screenshot" || /\bscreenshot\b/.test(text);
  const hasChecklist = parsed.source === "manual_visual_checklist" || parsed.checklistItems.length > 0 || /\bvisual checklist\b/.test(text);
  const hasTrace = parsed.source === "playwright_trace" || /\bplaywright\b/.test(text);
  const mentionsWrongPage = /\bwrong page|wrong state|unrelated screen|marketing home\b/.test(text);
  const mentionsMobile = /\bmobile|responsive|desktop width|tablet\b/.test(text);
  const mentionsAccessibility = /\baccessibility|a11y|axe|screen reader\b/.test(text);
  const claimsAccessibility =
    /\baccessibility|a11y|axe|screen reader\b/.test(taskText) ||
    /\baccessibility|a11y|axe|screen reader\b/.test(text);

  if (!hasScreenshot && !hasChecklist && !hasTrace) {
    findings.push(finding("missing_visual_artifact", "critical", "No screenshot, checklist, or visual trace artifact was supplied."));
  } else {
    if (hasScreenshot) findings.push(finding("screenshot_present", "info", "A screenshot artifact is present."));
    if (hasChecklist) findings.push(finding("visual_checklist_present", "info", "A visual checklist artifact is present."));
    if (hasTrace) findings.push(finding("playwright_trace_present", "info", "A Playwright visual trace artifact is present."));
  }

  if (parsed.evidenceRequiredAfter && parsed.capturedAt && parsed.capturedAt < parsed.evidenceRequiredAfter) {
    findings.push(finding("stale_visual_artifact", "warning", "The visual artifact is older than the required proof window."));
  }

  if (parsed.expectedPage && !text.includes(parsed.expectedPage.toLowerCase())) {
    findings.push(finding("wrong_page_or_state", "warning", "The supplied visual artifact does not name the expected page or target area."));
  } else if (parsed.expectedState && !text.includes(parsed.expectedState.toLowerCase())) {
    findings.push(finding("wrong_page_or_state", "warning", "The supplied visual artifact does not describe the expected UI state."));
  } else if (mentionsWrongPage) {
    findings.push(finding("wrong_page_or_state", "warning", "The supplied visual artifact appears to show the wrong page or state."));
  }

  if (hasVisualFiles && !mentionsMobile) {
    findings.push(finding("mobile_responsive_unchecked", "warning", "The visual proof does not mention mobile or responsive coverage."));
  }

  if (claimsAccessibility && !mentionsAccessibility) {
    findings.push(finding("accessibility_unchecked", "warning", "The visual proof does not mention any accessibility check."));
  }

  const hasCritical = findings.some((finding) => finding.severity === "critical");
  const hasWarnings = findings.some((finding) => finding.severity === "warning");
  const verdict = hasCritical ? "reject" : hasWarnings ? "provisional" : "accept";

  return {
    verdict,
    findings,
    supportsVisualClaim: verdict === "accept"
  };
}

export async function loadVisualProofFixtureCases(rootDir = process.cwd()): Promise<VisualProofFixtureCase[]> {
  const fixtureDir = path.join(rootDir, "fixtures", "visual_proof");
  const files = (await fs.readdir(fixtureDir))
    .filter((file) => file.startsWith("visual_proof_") && file.endsWith(".json"))
    .sort();
  const cases: VisualProofFixtureCase[] = [];
  for (const filename of files) {
    const raw = JSON.parse(await fs.readFile(path.join(fixtureDir, filename), "utf8")) as unknown;
    cases.push(...VisualProofFixtureFileSchema.parse(raw).cases);
  }
  return cases;
}

function finding(id: VisualProofFindingId, severity: Finding["severity"], message: string): Finding {
  return { id, severity, message };
}
