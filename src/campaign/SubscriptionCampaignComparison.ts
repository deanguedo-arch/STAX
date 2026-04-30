export type SubscriptionScoreEntry = {
  taskId: string;
  staxScore: number;
  chatgptScore: number;
  staxCriticalMiss: boolean;
  chatgptCriticalMiss: boolean;
  note?: string;
};

export type SubscriptionComparisonWinner = "stax" | "chatgpt" | "tie";

export type SubscriptionComparisonCase = SubscriptionScoreEntry & {
  winner: SubscriptionComparisonWinner;
};

export type SubscriptionComparisonSummary = {
  total: number;
  staxWins: number;
  chatgptWins: number;
  ties: number;
  staxCriticalMisses: number;
  chatgptCriticalMisses: number;
};

export type SubscriptionComparisonStatus =
  | "awaiting_scores"
  | "scored_no_losses"
  | "scored_with_losses";

export type SubscriptionComparisonResult = {
  status: SubscriptionComparisonStatus;
  summary: SubscriptionComparisonSummary;
  cases: SubscriptionComparisonCase[];
  notes: string[];
};

const WIN_MARGIN = 2;

function pickWinner(entry: SubscriptionScoreEntry): SubscriptionComparisonWinner {
  if (entry.staxCriticalMiss && !entry.chatgptCriticalMiss) return "chatgpt";
  if (!entry.staxCriticalMiss && entry.chatgptCriticalMiss) return "stax";

  const delta = entry.staxScore - entry.chatgptScore;
  if (delta >= WIN_MARGIN) return "stax";
  if (delta <= -WIN_MARGIN) return "chatgpt";
  return "tie";
}

export function compareSubscriptionCampaign(
  entries: SubscriptionScoreEntry[],
  expectedTaskIds?: string[]
): SubscriptionComparisonResult {
  if (entries.length === 0) {
    return {
      status: "awaiting_scores",
      summary: {
        total: 0,
        staxWins: 0,
        chatgptWins: 0,
        ties: 0,
        staxCriticalMisses: 0,
        chatgptCriticalMisses: 0
      },
      cases: [],
      notes: ["No subscription comparison scores were supplied yet."]
    };
  }

  const missingTaskIds =
    expectedTaskIds?.filter((taskId) => !entries.some((entry) => entry.taskId === taskId)) ?? [];
  const cases = entries.map((entry) => ({
    ...entry,
    winner: pickWinner(entry)
  }));

  const staxWins = cases.filter((item) => item.winner === "stax").length;
  const chatgptWins = cases.filter((item) => item.winner === "chatgpt").length;
  const ties = cases.filter((item) => item.winner === "tie").length;
  const staxCriticalMisses = cases.filter((item) => item.staxCriticalMiss).length;
  const chatgptCriticalMisses = cases.filter((item) => item.chatgptCriticalMiss).length;

  const notes: string[] = [];
  if (missingTaskIds.length > 0) {
    notes.push(`Missing scores for ${missingTaskIds.length} task(s): ${missingTaskIds.join(", ")}.`);
  }
  if (staxCriticalMisses > 0) {
    notes.push("STAX critical misses were recorded; do not promote this comparison as a quality win.");
  }
  if (chatgptCriticalMisses > 0) {
    notes.push("ChatGPT critical misses were recorded in this comparison.");
  }

  const status: SubscriptionComparisonStatus =
    missingTaskIds.length > 0
      ? "awaiting_scores"
      : chatgptWins === 0 && staxCriticalMisses === 0
        ? "scored_no_losses"
        : "scored_with_losses";

  return {
    status,
    summary: {
      total: cases.length,
      staxWins,
      chatgptWins,
      ties,
      staxCriticalMisses,
      chatgptCriticalMisses
    },
    cases,
    notes
  };
}
