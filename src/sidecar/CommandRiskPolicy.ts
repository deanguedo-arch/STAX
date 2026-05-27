export type SidecarCommandRiskCategory =
  | "destructive_filesystem"
  | "destructive_git"
  | "release_boundary"
  | "remote_publish"
  | "package_publish"
  | "dependency_install_scripts"
  | "infrastructure_mutation"
  | "shell_execution"
  | "remote_code_execution"
  | "secret_or_clipboard_exposure"
  | "privilege_escalation"
  | "system_destruction"
  | "credential_store"
  | "network_exfiltration";

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
    if (args.includes("--tags") || args.includes("--follow-tags")) {
      add("release_boundary", "pushing tags can publish release markers to the remote repository");
    }
  }
  if (executable === "git" && args[0] === "tag") {
    add("release_boundary", "git tag creates or mutates release markers");
  }
  if (executable === "git" && args[0] === "reset" && args.includes("--hard")) {
    add("destructive_git", "git reset --hard discards local work");
  }
  if (executable === "git" && args[0] === "clean" && args.some((arg) => /f/.test(arg)) && args.some((arg) => /d/.test(arg))) {
    add("destructive_git", "git clean -fd removes untracked files");
  }
  if (/\b(deploy|sync)\b/i.test(joined) || /\b(sync_all|sync_programs|publish_data_to_sheets)\b/i.test(joined) || /\b(firebase|vercel)\s+deploy\b/i.test(joined)) {
    add("remote_publish", "deploy/sync commands mutate external systems");
  }
  if (/\b(npm|pnpm|yarn)\s+version\b/i.test(joined) || /\bnpm\s+run\s+release\b/i.test(joined)) {
    add("release_boundary", "version or release scripts can create release artifacts or tags");
  }
  if (/\b(npm|pnpm|yarn)\s+publish\b/i.test(joined) || /\bgh\s+release\b/i.test(joined) || /\bdocker\s+push\b/i.test(joined)) {
    add("package_publish", "publish/release commands mutate package, release, or image registries");
    if (/\bgh\s+release\b/i.test(joined)) add("release_boundary", "GitHub release commands publish release artifacts");
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
  if (executable === "sudo" || /\bsudo\b/i.test(joined)) {
    add("privilege_escalation", "sudo/privileged commands are outside safe proof collection");
  }
  if (/\bchmod\s+-?R?\s*(777|ugo\+rwx)\b/i.test(joined) || /\bchown\s+-R\b/i.test(joined)) {
    add("privilege_escalation", "recursive permission or ownership mutation can weaken local security");
  }
  if (/\b(dd|mkfs|fdisk)\b/i.test(joined) || /\bdiskutil\s+erase/i.test(joined) || /\bformat\s+[A-Z]:/i.test(joined)) {
    add("system_destruction", "disk formatting or raw block commands can destroy system data");
  }
  if (/\b(gh|git)\s+auth\s+token\b/i.test(joined) || /\bgit\s+credential\b/i.test(joined) || /\b(op|pass)\s+(read|show)\b/i.test(joined)) {
    add("credential_store", "credential-store reads can expose private tokens");
  }
  if (/\b(scp|rsync)\b.*:/i.test(joined) || /\bcurl\b.*(?:\s|^)(-d|--data|--data-binary|-F|--form|--upload-file)(?:\s|=|$)/i.test(joined)) {
    add("network_exfiltration", "network upload/exfiltration commands require explicit approval");
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
  if (categories.some((category) => category === "remote_code_execution" || category === "secret_or_clipboard_exposure" || category === "privilege_escalation" || category === "system_destruction" || category === "credential_store" || category === "network_exfiltration")) {
    return "forbidden_by_default";
  }
  if (categories.some((category) => category === "destructive_filesystem" || category === "destructive_git" || category === "release_boundary" || category === "remote_publish" || category === "package_publish" || category === "infrastructure_mutation")) {
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
