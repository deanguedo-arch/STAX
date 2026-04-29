import {
  CapabilityDeclarationSchema,
  CapabilityDecisionSchema,
  type CapabilityContext,
  type CapabilityDeclaration,
  type CapabilityDecision
} from "./CapabilityRegistrySchemas.js";

export class CapabilityRegistry {
  private declarations = new Map<string, CapabilityDeclaration>();

  constructor(declarations: CapabilityDeclaration[] = DEFAULT_CAPABILITIES) {
    for (const declaration of declarations) {
      const parsed = CapabilityDeclarationSchema.parse(declaration);
      this.declarations.set(parsed.capabilityId, parsed);
    }
  }

  list(): CapabilityDeclaration[] {
    return [...this.declarations.values()];
  }

  get(capabilityId: string): CapabilityDeclaration | undefined {
    return this.declarations.get(capabilityId);
  }

  decide(input: {
    capabilityId: string;
    context: CapabilityContext;
    approved?: boolean;
    artifactPath?: string;
    rollbackPlan?: string;
  }): CapabilityDecision {
    const declaration = this.declarations.get(input.capabilityId);
    if (!declaration) {
      return CapabilityDecisionSchema.parse({
        allowed: false,
        capabilityId: input.capabilityId,
        reason: "Unknown capability.",
        requiresApproval: true,
        artifactRequired: true,
        rollbackRequired: true
      });
    }

    if (!declaration.allowedContexts.includes(input.context)) {
      return decision(declaration, false, `Capability is not allowed in ${input.context} context.`);
    }
    if (!declaration.enabledByDefault && !input.approved) {
      return decision(declaration, false, "Capability is disabled by default and requires approval.");
    }
    if (declaration.requiresApproval && !input.approved) {
      return decision(declaration, false, "Capability requires explicit approval.");
    }
    if (declaration.artifactRequired && !input.artifactPath) {
      return decision(declaration, false, "Capability requires an evidence artifact path.");
    }
    if (declaration.rollbackRequired && !input.rollbackPlan) {
      return decision(declaration, false, "Capability requires a rollback plan.");
    }

    return decision(declaration, true, "Capability allowed under declared controls.");
  }
}

export const DEFAULT_CAPABILITIES: CapabilityDeclaration[] = [
  {
    capabilityId: "shell.execute",
    description: "Run a local shell command.",
    riskLevel: "critical",
    allowedContexts: ["local_stax", "sandbox"],
    requiresApproval: true,
    artifactRequired: true,
    rollbackRequired: false,
    enabledByDefault: false
  },
  {
    capabilityId: "file.write",
    description: "Write a file inside an allowed root.",
    riskLevel: "high",
    allowedContexts: ["local_stax", "sandbox"],
    requiresApproval: true,
    artifactRequired: true,
    rollbackRequired: true,
    enabledByDefault: false
  },
  {
    capabilityId: "git.mutate",
    description: "Commit, push, reset, checkout, or otherwise mutate git state.",
    riskLevel: "critical",
    allowedContexts: ["durable_state"],
    requiresApproval: true,
    artifactRequired: true,
    rollbackRequired: true,
    enabledByDefault: false
  },
  {
    capabilityId: "memory.approve",
    description: "Approve pending memory for future retrieval.",
    riskLevel: "high",
    allowedContexts: ["durable_state"],
    requiresApproval: true,
    artifactRequired: true,
    rollbackRequired: false,
    enabledByDefault: false
  },
  {
    capabilityId: "eval.run",
    description: "Run local STAX eval suites.",
    riskLevel: "medium",
    allowedContexts: ["local_stax"],
    requiresApproval: false,
    artifactRequired: true,
    rollbackRequired: false,
    enabledByDefault: true
  },
  {
    capabilityId: "sandbox.command_window",
    description: "Run exact allowlisted commands inside a verified sandbox.",
    riskLevel: "high",
    allowedContexts: ["sandbox"],
    requiresApproval: true,
    artifactRequired: true,
    rollbackRequired: false,
    enabledByDefault: false
  },
  {
    capabilityId: "sandbox.patch_window",
    description: "Apply allowlisted file patches inside a verified sandbox.",
    riskLevel: "critical",
    allowedContexts: ["sandbox"],
    requiresApproval: true,
    artifactRequired: true,
    rollbackRequired: true,
    enabledByDefault: false
  }
];

export function defaultCapabilityRegistry(): CapabilityRegistry {
  return new CapabilityRegistry();
}

function decision(
  declaration: CapabilityDeclaration,
  allowed: boolean,
  reason: string
): CapabilityDecision {
  return CapabilityDecisionSchema.parse({
    allowed,
    capabilityId: declaration.capabilityId,
    reason,
    requiresApproval: declaration.requiresApproval,
    artifactRequired: declaration.artifactRequired,
    rollbackRequired: declaration.rollbackRequired
  });
}
