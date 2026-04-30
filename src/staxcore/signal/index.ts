import type { Signal, ValidatedEvent } from "../types/index.js";
import { createId } from "../shared/index.js";

export function generateSignals(events: ValidatedEvent[]): Signal[] {
  return events.map((event) => ({
    id: createId("signal"),
    type: event.state === "VALIDATED" ? "recurrence" : "conflict",
    description:
      event.state === "VALIDATED"
        ? `Validated event available: ${event.claim}`
        : `Rejected/conflicted event: ${event.claim}`,
    sourceValidationIds: [event.id],
    provisional: event.state !== "VALIDATED"
  }));
}
