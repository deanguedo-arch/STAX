import type { ValidationResult } from "../utils/validators.js";
import { StrategicDecisionGate } from "../strategy/StrategicDecisionGate.js";

export class StrategicDeliberationValidator {
  validate(output: string): ValidationResult {
    return new StrategicDecisionGate().validate(output);
  }
}
