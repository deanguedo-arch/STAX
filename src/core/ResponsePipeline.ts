import type { Mode } from "../schemas/Config.js";
import { validateModeOutput, type ValidationResult } from "../utils/validators.js";

export class ResponsePipeline {
  validate(mode: Mode, output: string): ValidationResult {
    return validateModeOutput(mode, output);
  }
}
