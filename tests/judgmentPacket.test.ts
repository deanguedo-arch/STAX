import { describe, expect, it } from "vitest";
import { JudgmentPacketBuilder } from "../src/review/JudgmentPacket.js";

describe("JudgmentPacket", () => {
  const builder = new JudgmentPacketBuilder();

  it("creates approval packet for sync repo decisions", () => {
    const packet = builder.build({
      decisionNeeded: "Approve workspace sync?",
      options: ["approve sync", "defer sync"],
      evidenceAvailable: ["git status clean"],
      riskIfApproved: "May update local working copy.",
      riskIfRejected: "Repo may stay stale."
    });

    expect(packet.requiresHumanApproval).toBe(true);
    expect(packet.recommendedOption).toBe("approve sync");
  });

  it("does not self-approve promotions", () => {
    const packet = builder.build({
      decisionNeeded: "Promote eval candidate?",
      options: ["approve promotion", "defer promotion"],
      evidenceMissing: ["regression eval output"]
    });

    expect(packet.requiresHumanApproval).toBe(true);
    expect(packet.recommendedOption).toBe("defer promotion");
  });

  it("marks irreversible source mutation decisions", () => {
    const packet = builder.build({
      decisionNeeded: "Apply sandbox patch?",
      options: ["approve apply", "reject apply"],
      irreversible: true,
      evidenceAvailable: ["sandbox diff"]
    });

    expect(packet.irreversible).toBe(true);
  });
});
