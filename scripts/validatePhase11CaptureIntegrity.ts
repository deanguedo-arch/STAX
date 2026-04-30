import fs from "node:fs/promises";
import path from "node:path";
import { validatePhase11CaptureIntegrity } from "../src/campaign/Phase11CaptureIntegrity.js";

type CaptureFile = {
  campaignId: string;
  entries: Array<{ taskId: string; chatgptOutput?: string | null }>;
};

const CAPTURE_PATH = path.join(
  process.cwd(),
  "fixtures",
  "real_use",
  "phase11_subscription_capture.json"
);

async function main(): Promise<void> {
  const raw = await fs.readFile(CAPTURE_PATH, "utf8");
  const parsed = JSON.parse(raw) as CaptureFile;
  const result = validatePhase11CaptureIntegrity({
    campaignId: parsed.campaignId,
    entries: parsed.entries.map((entry) => ({
      taskId: entry.taskId,
      chatgptOutput: entry.chatgptOutput ?? null
    }))
  });

  if (!result.pass) {
    process.stdout.write(
      `${JSON.stringify(
        {
          status: "failed",
          captureFile: path.relative(process.cwd(), CAPTURE_PATH),
          issues: result.issues
        },
        null,
        2
      )}\n`
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "passed",
        captureFile: path.relative(process.cwd(), CAPTURE_PATH),
        checkedCases: parsed.entries.length
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
