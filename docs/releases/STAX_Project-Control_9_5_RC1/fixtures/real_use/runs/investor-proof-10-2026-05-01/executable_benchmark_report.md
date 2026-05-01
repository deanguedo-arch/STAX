## Local Problem Benchmark
Total: 10
STAXBetter: 7
ExternalBetter: 0
Ties: 3
NoLocalBasis: 0
NoExternalBaseline: 0
ExpectedMismatches: 0
Confidence: promising
StopConditionMet: false
SuperiorityStatus: not_proven
ContinueLoopRequired: true
ProofIntegrityGaps: 0
HoldoutFreshnessGaps: 0

## Results
- investor_admission_sync_001 (ADMISSION-APP): stax_better
  - STAX: 86
  - External: 58
  - Reasons: STAX 86 vs external 58.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- investor_admission_contract_002 (ADMISSION-APP): stax_better
  - STAX: 69
  - External: 57
  - Reasons: STAX 69 vs external 57.; STAX strongest dimension: proofHonesty=1.00; External strongest dimension: actualAnswer=1.00
- investor_admission_avg_total_003 (ADMISSION-APP): stax_better
  - STAX: 80
  - External: 53
  - Reasons: STAX 80 vs external 53.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- investor_brightspace_dependency_004 (brightspacequizexporter): stax_better
  - STAX: 76
  - External: 47
  - Reasons: STAX 76 vs external 47.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- investor_brightspace_ingest_005 (brightspacequizexporter): tie
  - STAX: 77
  - External: 73
  - Reasons: STAX 77 vs external 73.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- investor_brightspace_fakeproof_006 (brightspacequizexporter): stax_better
  - STAX: 75
  - External: 56
  - Reasons: STAX 75 vs external 56.; STAX strongest dimension: proofHonesty=1.00; External strongest dimension: actualAnswer=1.00
- investor_canvas_visual_007 (canvas-helper): stax_better
  - STAX: 79
  - External: 57
  - Reasons: STAX 79 vs external 57.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- investor_stax_provenance_008 (STAX): tie
  - STAX: 53
  - External: 52
  - Reasons: STAX 53 vs external 52.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- investor_stax_commit_009 (STAX): tie
  - STAX: 65
  - External: 61
  - Reasons: STAX 65 vs external 61.; STAX strongest dimension: proofHonesty=1.00; External strongest dimension: actualAnswer=1.00
- investor_repo_trap_010 (ADMISSION-APP): stax_better
  - STAX: 74
  - External: 53
  - Reasons: STAX 74 vs external 53.; STAX strongest dimension: proofHonesty=1.00; External strongest dimension: actualAnswer=1.00

## Slice Stop Rule
Continue this slice: fix external_better/tie/no_local_basis/no_external_baseline cases, add tests, and rerun this benchmark.

## Superiority Gate
Do not stop for superiority. Continue the loop until the gaps below are closed.
- Current benchmark slice has not passed; fix slice failures before evaluating superiority.

## Proof Integrity
- No first-pass integrity gaps detected for this benchmark summary.

## Holdout Freshness
- No required holdout freshness gaps detected for this benchmark summary.
