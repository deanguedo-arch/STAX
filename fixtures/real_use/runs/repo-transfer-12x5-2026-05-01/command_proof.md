# Repo Transfer Command Proof: repo-transfer-12x5-2026-05-01

## Summary
- git_status: exit 0, expected 0
- capture_hygiene: exit 0, expected 0
- comparison_integrity_expected_fail: exit 1, expected 1
- score_run_expected_fail: exit 1, expected 1

## Commands
### git_status

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `git status --short`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-02T14:13:26.152Z
- Finished at: 2026-05-02T14:13:26.173Z

Stdout tail:

```text
M docs/REPO_TRANSFER_TRIAL_RESULTS.md
 M package.json
 M src/campaign/CaptureValidation.ts
 M src/campaign/ComparisonIntegrity.ts
 M src/campaign/Phase11CaptureIntegrity.ts
 M src/repoTransfer/RepoTransferRun.ts
 M tests/comparisonIntegrity.test.ts
 M tests/phase11CaptureIntegrity.test.ts
 M tests/repoTransferTrial.test.ts
?? docs/REPO_TRANSFER_RC2A_HYGIENE_REPORT.md
?? docs/releases/STAX_Project-Control_9_5_RC2a.tar.gz
?? docs/releases/STAX_Project-Control_9_5_RC2a.zip
?? docs/releases/STAX_Project-Control_9_5_RC2a/
?? fixtures/real_use/runs/repo-transfer-12x5-2026-05-01/capture_hygiene_issues.json
?? fixtures/real_use/runs/repo-transfer-12x5-2026-05-01/capture_hygiene_report.md
?? fixtures/real_use/runs/repo-transfer-12x5-2026-05-01/command_proof.json
?? fixtures/real_use/runs/repo-transfer-12x5-2026-05-01/command_proof.md
?? fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/
?? scripts/recordRepoTransferCommandProof.ts
?? scripts/repoTransferCaptureHygiene.ts
```

Stderr tail:

```text
(empty)
```

### capture_hygiene

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run repo-transfer:capture-hygiene -- --run repo-transfer-12x5-2026-05-01`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-02T14:13:26.173Z
- Finished at: 2026-05-02T14:13:26.449Z

Stdout tail:

```text
> rax@0.1.0 repo-transfer:capture-hygiene
> tsx scripts/repoTransferCaptureHygiene.ts --run repo-transfer-12x5-2026-05-01

{
  "status": "recapture_required",
  "runId": "repo-transfer-12x5-2026-05-01",
  "generatedAt": "2026-05-02T14:13:26.441Z",
  "invalidCaptureOutputs": 42,
  "contaminatedCaptureOutputs": 42,
  "missingCaptureOutputs": 0,
  "invalidCaseCount": 42,
  "contaminatedCaseCount": 42,
  "issues": [
    {
      "taskId": "microsoft_playwright_1_onboarding",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "microsoft_playwright_1_fake_complete",
      "source": "chatgpt",
      "issues": [
        "ui_capture_text"
      ]
    },
    {
      "taskId": "microsoft_playwright_1_bounded_prompt",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "microsoft_playwright_1_proof_gap",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "vitejs_vite_2_onboarding",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "vitejs_vite_2_bounded_prompt",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "vitejs_vite_2_proof_gap",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt",
        "ui_capture_text"
      ]
    },
    {
      "taskId": "pytest_dev_pytest_3_onboarding",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "pytest_dev_pytest_3_bounded_prompt",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "pytest_dev_pytest_3_proof_gap",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "django_django_4_onboarding",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "django_django_4_bounded_prompt",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "django_django_4_proof_gap",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "rust_lang_rust_clippy_5_onboarding",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "rust_lang_rust_clippy_5_bounded_prompt",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "rust_lang_rust_clippy_5_proof_gap",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "tokio_rs_tokio_6_onboarding",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "tokio_rs_tokio_6_bounded_prompt",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "tokio_rs_tokio_6_proof_gap",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "kubernetes_kubernetes_7_onboarding",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "kubernetes_kubernetes_7_bounded_prompt",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "kubernetes_kubernetes_7_proof_gap",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "hashicorp_terraform_8_onboarding",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "hashicorp_terraform_8_bounded_prompt",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "hashicorp_terraform_8_proof_gap",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "rails_rails_9_onboarding",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "rails_rails_9_bounded_prompt",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "rails_rails_9_proof_gap",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "laravel_framework_10_onboarding",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt"
      ]
    },
    {
      "taskId": "laravel_framework_10_script_exists",
      "source": "chatgpt",
      "issues": [
        "ui_capture_text"
      ]
    },
    {
      "taskId": "laravel_framework_10_bounded_prompt",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt",
        "ui_capture_text"
      ]
    },
    {
      "taskId": "laravel_framework_10_proof_gap",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt",
        "ui_capture_text"
      ]
    },
    {
      "taskId": "storybookjs_storybook_11_onboarding",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt",
        "ui_capture_text",
        "wrong_repo_contamination"
      ]
    },
    {
      "taskId": "storybookjs_storybook_11_fake_complete",
      "source": "chatgpt",
      "issues": [
        "ui_capture_text"
      ]
    },
    {
      "taskId": "storybookjs_storybook_11_script_exists",
      "source": "chatgpt",
      "issues": [
        "ui_capture_text"
      ]
    },
    {
      "taskId": "storybookjs_storybook_11_bounded_prompt",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt",
        "ui_capture_text"
      ]
    },
    {
      "taskId": "storybookjs_storybook_11_proof_gap",
      "source": "chatgpt",
      "issues": [
        "ui_capture_text"
      ]
    },
    {
      "taskId": "dbt_labs_dbt_core_12_onboarding",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt",
        "ui_capture_text",
        "wrong_repo_contamination"
      ]
    },
    {
      "taskId": "dbt_labs_dbt_core_12_fake_complete",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt",
        "ui_capture_text",
        "wrong_repo_contamination"
      ]
    },
    {
      "taskId": "dbt_labs_dbt_core_12_script_exists",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt",
        "ui_capture_text"
      ]
    },
    {
      "taskId": "dbt_labs_dbt_core_12_bounded_prompt",
      "source": "chatgpt",
      "issues": [
        "embedded_benchmark_prompt",
        "ui_capture_text"
      ]
    },
    {
      "taskId": "dbt_labs_dbt_core_12_proof_gap",
      "source": "chatgpt",
      "issues": [
        "ui_capture_text"
      ]
    }
  ]
}
```

Stderr tail:

```text
(empty)
```

### comparison_integrity_expected_fail

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run campaign:integrity -- --run repo-transfer-12x5-2026-05-01`
- Exit code: 1
- Expected exit code: 1
- Started at: 2026-05-02T14:13:26.449Z
- Finished at: 2026-05-02T14:13:26.626Z

Stdout tail:

```text
> rax@0.1.0 campaign:integrity
> tsx scripts/campaignIntegrity.ts --run repo-transfer-12x5-2026-05-01

{
  "status": "failed",
  "runId": "repo-transfer-12x5-2026-05-01",
  "runDir": "fixtures/real_use/runs/repo-transfer-12x5-2026-05-01",
  "summary": {
    "total": 60,
    "staxWins": 60,
    "chatgptWins": 0,
    "ties": 0,
    "staxCriticalMisses": 0,
    "chatgptCriticalMisses": 0
  },
  "issues": [
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task microsoft_playwright_1_onboarding: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task microsoft_playwright_1_fake_complete: STAX [none], ChatGPT [ui_capture_text]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task microsoft_playwright_1_bounded_prompt: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task microsoft_playwright_1_proof_gap: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task vitejs_vite_2_onboarding: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task vitejs_vite_2_bounded_prompt: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task vitejs_vite_2_proof_gap: STAX [none], ChatGPT [embedded_benchmark_prompt, ui_capture_text]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task pytest_dev_pytest_3_onboarding: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task pytest_dev_pytest_3_bounded_prompt: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task pytest_dev_pytest_3_proof_gap: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task django_django_4_onboarding: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task django_django_4_bounded_prompt: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task django_django_4_proof_gap: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task rust_lang_rust_clippy_5_onboarding: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task rust_lang_rust_clippy_5_bounded_prompt: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task rust_lang_rust_clippy_5_proof_gap: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task tokio_rs_tokio_6_onboarding: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task tokio_rs_tokio_6_bounded_prompt: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task tokio_rs_tokio_6_proof_gap: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task kubernetes_kubernetes_7_onboarding: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task kubernetes_kubernetes_7_bounded_prompt: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task kubernetes_kubernetes_7_proof_gap: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task hashicorp_terraform_8_onboarding: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task hashicorp_terraform_8_bounded_prompt: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task hashicorp_terraform_8_proof_gap: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task rails_rails_9_onboarding: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task rails_rails_9_bounded_prompt: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task rails_rails_9_proof_gap: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task laravel_framework_10_onboarding: STAX [none], ChatGPT [embedded_benchmark_prompt]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task laravel_framework_10_script_exists: STAX [none], ChatGPT [ui_capture_text]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task laravel_framework_10_bounded_prompt: STAX [none], ChatGPT [embedded_benchmark_prompt, ui_capture_text]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task laravel_framework_10_proof_gap: STAX [none], ChatGPT [embedded_benchmark_prompt, ui_capture_text]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task storybookjs_storybook_11_onboarding: STAX [none], ChatGPT [embedded_benchmark_prompt, ui_capture_text, wrong_repo_contamination]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task storybookjs_storybook_11_fake_complete: STAX [none], ChatGPT [ui_capture_text]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task storybookjs_storybook_11_script_exists: STAX [none], ChatGPT [ui_capture_text]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task storybookjs_storybook_11_bounded_prompt: STAX [none], ChatGPT [embedded_benchmark_prompt, ui_capture_text]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task storybookjs_storybook_11_proof_gap: STAX [none], ChatGPT [ui_capture_text]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task dbt_labs_dbt_core_12_onboarding: STAX [none], ChatGPT [embedded_benchmark_prompt, ui_capture_text, wrong_repo_contamination]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task dbt_labs_dbt_core_12_fake_complete: STAX [none], ChatGPT [embedded_benchmark_prompt, ui_capture_text, wrong_repo_contamination]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task dbt_labs_dbt_core_12_script_exists: STAX [none], ChatGPT [embedded_benchmark_prompt, ui_capture_text]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task dbt_labs_dbt_core_12_bounded_prompt: STAX [none], ChatGPT [embedded_benchmark_prompt, ui_capture_text]"
    },
    {
      "code": "corrupted_capture",
      "message": "Corrupted capture text found in task dbt_labs_dbt_core_12_proof_gap: STAX [none], ChatGPT [ui_capture_text]"
    }
  ]
}
```

Stderr tail:

```text
(empty)
```

### score_run_expected_fail

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run repo-transfer:score-run -- --run repo-transfer-12x5-2026-05-01`
- Exit code: 1
- Expected exit code: 1
- Started at: 2026-05-02T14:13:26.626Z
- Finished at: 2026-05-02T14:13:26.896Z

Stdout tail:

```text
> rax@0.1.0 repo-transfer:score-run
> tsx scripts/scoreRepoTransferRun.ts --run repo-transfer-12x5-2026-05-01
```

Stderr tail:

```text
/Users/deanguedo/Documents/GitHub/STAX/src/repoTransfer/RepoTransferRun.ts:227
    throw new Error(
          ^

Error: Cannot score repo-transfer run repo-transfer-12x5-2026-05-01: 42 invalid capture outputs require recapture.
microsoft_playwright_1_onboarding/chatgpt: embedded_benchmark_prompt
microsoft_playwright_1_fake_complete/chatgpt: ui_capture_text
microsoft_playwright_1_bounded_prompt/chatgpt: embedded_benchmark_prompt
microsoft_playwright_1_proof_gap/chatgpt: embedded_benchmark_prompt
vitejs_vite_2_onboarding/chatgpt: embedded_benchmark_prompt
vitejs_vite_2_bounded_prompt/chatgpt: embedded_benchmark_prompt
vitejs_vite_2_proof_gap/chatgpt: embedded_benchmark_prompt, ui_capture_text
pytest_dev_pytest_3_onboarding/chatgpt: embedded_benchmark_prompt
pytest_dev_pytest_3_bounded_prompt/chatgpt: embedded_benchmark_prompt
pytest_dev_pytest_3_proof_gap/chatgpt: embedded_benchmark_prompt
django_django_4_onboarding/chatgpt: embedded_benchmark_prompt
django_django_4_bounded_prompt/chatgpt: embedded_benchmark_prompt
django_django_4_proof_gap/chatgpt: embedded_benchmark_prompt
rust_lang_rust_clippy_5_onboarding/chatgpt: embedded_benchmark_prompt
rust_lang_rust_clippy_5_bounded_prompt/chatgpt: embedded_benchmark_prompt
rust_lang_rust_clippy_5_proof_gap/chatgpt: embedded_benchmark_prompt
tokio_rs_tokio_6_onboarding/chatgpt: embedded_benchmark_prompt
tokio_rs_tokio_6_bounded_prompt/chatgpt: embedded_benchmark_prompt
tokio_rs_tokio_6_proof_gap/chatgpt: embedded_benchmark_prompt
kubernetes_kubernetes_7_onboarding/chatgpt: embedded_benchmark_prompt
kubernetes_kubernetes_7_bounded_prompt/chatgpt: embedded_benchmark_prompt
kubernetes_kubernetes_7_proof_gap/chatgpt: embedded_benchmark_prompt
hashicorp_terraform_8_onboarding/chatgpt: embedded_benchmark_prompt
hashicorp_terraform_8_bounded_prompt/chatgpt: embedded_benchmark_prompt
hashicorp_terraform_8_proof_gap/chatgpt: embedded_benchmark_prompt
rails_rails_9_onboarding/chatgpt: embedded_benchmark_prompt
rails_rails_9_bounded_prompt/chatgpt: embedded_benchmark_prompt
rails_rails_9_proof_gap/chatgpt: embedded_benchmark_prompt
laravel_framework_10_onboarding/chatgpt: embedded_benchmark_prompt
laravel_framework_10_script_exists/chatgpt: ui_capture_text
laravel_framework_10_bounded_prompt/chatgpt: embedded_benchmark_prompt, ui_capture_text
laravel_framework_10_proof_gap/chatgpt: embedded_benchmark_prompt, ui_capture_text
storybookjs_storybook_11_onboarding/chatgpt: embedded_benchmark_prompt, ui_capture_text, wrong_repo_contamination
storybookjs_storybook_11_fake_complete/chatgpt: ui_capture_text
storybookjs_storybook_11_script_exists/chatgpt: ui_capture_text
storybookjs_storybook_11_bounded_prompt/chatgpt: embedded_benchmark_prompt, ui_capture_text
storybookjs_storybook_11_proof_gap/chatgpt: ui_capture_text
dbt_labs_dbt_core_12_onboarding/chatgpt: embedded_benchmark_prompt, ui_capture_text, wrong_repo_contamination
dbt_labs_dbt_core_12_fake_complete/chatgpt: embedded_benchmark_prompt, ui_capture_text, wrong_repo_contamination
dbt_labs_dbt_core_12_script_exists/chatgpt: embedded_benchmark_prompt, ui_capture_text
dbt_labs_dbt_core_12_bounded_prompt/chatgpt: embedded_benchmark_prompt, ui_capture_text
dbt_labs_dbt_core_12_proof_gap/chatgpt: ui_capture_text
    at scoreRepoTransferRun (/Users/deanguedo/Documents/GitHub/STAX/src/repoTransfer/RepoTransferRun.ts:227:11)
    at async <anonymous> (/Users/deanguedo/Documents/GitHub/STAX/scripts/scoreRepoTransferRun.ts:15:17)

Node.js v24.14.0
```

