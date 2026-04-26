export type ProofRedaction = {
  pattern: string;
  replacements: number;
};

export type RedactionResult = {
  text: string;
  redactions: ProofRedaction[];
};

const REDACTION_RULES: Array<{ pattern: string; regex: RegExp; replacement: string }> = [
  {
    pattern: "private_key_block",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: "[REDACTED_PRIVATE_KEY]"
  },
  {
    pattern: "bearer_token",
    regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{10,}/gi,
    replacement: "Bearer [REDACTED_TOKEN]"
  },
  {
    pattern: "openai_api_key",
    regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g,
    replacement: "[REDACTED_OPENAI_KEY]"
  },
  {
    pattern: "secret_assignment",
    regex: /^(\s*[A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSWD|COOKIE|SESSION)[A-Z0-9_]*\s*[:=]\s*)(?!\[REDACTED_).+$/gim,
    replacement: "$1[REDACTED_SECRET]"
  },
  {
    pattern: "cookie_header",
    regex: /\b(cookie|set-cookie):\s*[^\n\r]+/gi,
    replacement: "$1: [REDACTED_COOKIE]"
  }
];

export function redactProofText(input: string): RedactionResult {
  let text = input;
  const redactions: ProofRedaction[] = [];

  for (const rule of REDACTION_RULES) {
    let replacements = 0;
    text = text.replace(rule.regex, () => {
      replacements += 1;
      return rule.replacement;
    });
    if (replacements > 0) {
      redactions.push({ pattern: rule.pattern, replacements });
    }
  }

  return { text, redactions };
}
