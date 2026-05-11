export type SidecarCommandRiskCategory =
  | "destructive_filesystem"
  | "destructive_git"
  | "remote_publish"
  | "package_publish"
  | "dependency_install_scripts"
  | "infrastructure_mutation"
  | "shell_execution"
  | "remote_code_execution"
  | "secret_or_clipboard_exposure";

export type SidecarCommandRiskLevel =
  | "safe"
  | "caution"
  | "dangerous"
  | "forbidden_by_default";

export type SidecarCommandRiskClassification = {
  dangerous: boolean;
  level: SidecarCommandRiskLevel;
  categories: SidecarCommandRiskCategory[];
  reasons: string[];
};

export function isDangerousSidecarCommand(command: string[]): boolean {
  return classifySidecarCommandRisk(command).dangerous;
}

export function classifyDangerousSidecarCommand(command: string[]): SidecarCommandRiskClassification {
  return classifySidecarCommandRisk(command);
}

export function classifySidecarCommandRisk(command: string[]): SidecarCommandRiskClassification {
  const joined = command.join(" ");
  const executable = (command[0] ?? "").toLowerCase();
  const args = command.slice(1).map((arg) => arg.toLowerCase());
  const reasons: string[] = [];
  const categories: SidecarCommandRiskCategory[] = [];
  const add = (category: SidecarCommandRiskCategory, reason: string) => {
    if (!categories.includes(category)) categories.push(category);
    reasons.push(reason);
  };

  if (/\brm\s+-rf\b/i.test(joined) || /\brm\s+.*-[a-z]*r[a-z]*f/i.test(joined)) {
    add("destructive_filesystem", "recursive force deletion can destroy repo or local files");
  }
  if (executable === "git" && args[0] === "push") {
    add("destructive_git", "git push mutates the remote repository");
  }
  if (executable === "git" && args[0] === "reset" && args.includes("--hard")) {
    add("destructive_git", "git reset --hard discards local work");
  }
  if (executable === "git" && args[0] === "clean" && args.some((arg) => /f/.test(arg)) && args.some((arg) => /d/.test(arg))) {
    add("destructive_git", "git clean -fd removes untracked files");
  }
  if (/\b(deploy|sync)\b/i.test(joined) || /\b(firebase|vercel)\s+deploy\b/i.test(joined)) {
    add("remote_publish", "deploy/sync commands mutate external systems");
  }
  if (/\b(npm|pnpm|yarn)\s+publish\b/i.test(joined) || /\bgh\s+release\b/i.test(joined) || /\bdocker\s+push\b/i.test(joined)) {
    add("package_publish", "publish/release commands mutate package, release, or image registries");
  }
  if (isDependencyInstallCommand(executable, args)) {
    add("dependency_install_scripts", "dependency install commands can run lifecycle scripts and mutate dependency state");
  }
  if (/\b(kubectl|helm)\s+(apply|delete|replace|patch|scale|rollout)\b/i.test(joined) || /\bterraform\s+(apply|destroy)\b/i.test(joined)) {
    add("infrastructure_mutation", "infrastructure commands can mutate live environments");
  }
  if (/\b(aws|gcloud|az)\s+.*\b(delete|put|create|update|deploy|sync|publish)\b/i.test(joined)) {
    add("infrastructure_mutation", "cloud provider mutation commands require explicit approval");
  }
  if (["sh", "bash", "zsh", "fish"].includes(executable) && (args.includes("-c") || args.some((arg) => arg.endsWith(".sh")))) {
    add("shell_execution", "shell execution can hide compound or injected commands");
  }
  if (/\b(curl|wget)\b.*\|\s*(sh|bash|zsh|fish)\b/i.test(joined)) {
    add("remote_code_execution", "remote code piped into a shell is not safe command evidence");
  }
  if (executable === "env" || executable === "printenv" || executable === "pbpaste" || executable === "pbcopy") {
    add("secret_or_clipboard_exposure", "environment or clipboard output can expose secrets");
  }
  if (/\b(cat|less|more|tail|head)\b\s+(?:.*\s)?(?:\.env|[^\s]+\/\.env)(?:\b|$)/i.test(joined) || /\bsecurity\s+find-/i.test(joined)) {
    add("secret_or_clipboard_exposure", "secret-store or .env reads require explicit approval");
  }

  return {
    dangerous: categories.length > 0,
    level: riskLevelForCategories(categories),
    categories,
    reasons
  };
}

function riskLevelForCategories(categories: SidecarCommandRiskCategory[]): SidecarCommandRiskLevel {
  if (categories.length === 0) return "safe";
  if (categories.some((category) => category === "remote_code_execution" || category === "secret_or_clipboard_exposure")) {
    return "forbidden_by_default";
  }
  if (categories.some((category) => category === "destructive_filesystem" || category === "destructive_git" || category === "remote_publish" || category === "package_publish" || category === "infrastructure_mutation")) {
    return "dangerous";
  }
  return "caution";
}

function isDependencyInstallCommand(executable: string, args: string[]): boolean {
  if (executable === "npm") {
    return ["install", "i", "ci"].includes(args[0] ?? "") && !args.includes("--ignore-scripts");
  }
  if (executable === "pnpm") {
    return ["install", "i", "add"].includes(args[0] ?? "") && !args.includes("--ignore-scripts");
  }
  if (executable === "yarn") {
    return (args.length === 0 || ["install", "add"].includes(args[0] ?? "")) && !args.includes("--ignore-scripts");
  }
  if (executable === "npx") return !args.includes("--no-install");
  return false;
}
