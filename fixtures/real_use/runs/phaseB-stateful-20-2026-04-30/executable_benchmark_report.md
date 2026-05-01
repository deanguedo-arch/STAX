## Local Problem Benchmark
Total: 20
STAXBetter: 7
ExternalBetter: 0
Ties: 13
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
- stateful_prior_run_001 (STAX): stax_better
  - STAX: 76
  - External: 59
  - Reasons: STAX 76 vs external 59.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_prior_run_002 (STAX): tie
  - STAX: 77
  - External: 74
  - Reasons: STAX 77 vs external 74.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_prior_run_003 (brightspacequizexporter): tie
  - STAX: 79
  - External: 82
  - Reasons: STAX 79 vs external 82.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_prior_run_004 (ADMISSION-APP): stax_better
  - STAX: 88
  - External: 47
  - Reasons: STAX 88 vs external 47.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: proofHonesty=1.00
- stateful_command_source_005 (STAX): tie
  - STAX: 53
  - External: 54
  - Reasons: STAX 53 vs external 54.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_command_source_006 (brightspacequizexporter): tie
  - STAX: 50
  - External: 47
  - Reasons: STAX 50 vs external 47.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: proofHonesty=1.00
- stateful_command_source_007 (canvas-helper): tie
  - STAX: 58
  - External: 55
  - Reasons: STAX 58 vs external 55.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_command_source_008 (ADMISSION-APP): stax_better
  - STAX: 86
  - External: 49
  - Reasons: STAX 86 vs external 49.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_fake_complete_009 (STAX): stax_better
  - STAX: 80
  - External: 54
  - Reasons: STAX 80 vs external 54.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_fake_complete_010 (brightspacequizexporter): tie
  - STAX: 75
  - External: 79
  - Reasons: STAX 75 vs external 79.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_fake_complete_011 (canvas-helper): tie
  - STAX: 79
  - External: 76
  - Reasons: STAX 79 vs external 76.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: commandSpecificity=1.00
- stateful_fake_complete_012 (ADMISSION-APP): stax_better
  - STAX: 85
  - External: 52
  - Reasons: STAX 85 vs external 52.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_repo_trap_013 (brightspacequizexporter): tie
  - STAX: 55
  - External: 55
  - Reasons: STAX 55 vs external 55.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_repo_trap_014 (ADMISSION-APP): stax_better
  - STAX: 81
  - External: 50
  - Reasons: STAX 81 vs external 50.; STAX strongest dimension: localSpecificity=1.00; External strongest dimension: proofHonesty=1.00
- stateful_repo_trap_015 (canvas-helper): tie
  - STAX: 53
  - External: 54
  - Reasons: STAX 53 vs external 54.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_repo_trap_016 (STAX): tie
  - STAX: 74
  - External: 81
  - Reasons: STAX 74 vs external 81.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_cleanup_017 (STAX): tie
  - STAX: 52
  - External: 53
  - Reasons: STAX 52 vs external 53.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_cleanup_018 (brightspacequizexporter): tie
  - STAX: 50
  - External: 52
  - Reasons: STAX 50 vs external 52.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_cleanup_019 (canvas-helper): tie
  - STAX: 51
  - External: 53
  - Reasons: STAX 51 vs external 53.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00
- stateful_cleanup_020 (ADMISSION-APP): stax_better
  - STAX: 85
  - External: 51
  - Reasons: STAX 85 vs external 51.; STAX strongest dimension: actualAnswer=1.00; External strongest dimension: actualAnswer=1.00

## Slice Stop Rule
Continue this slice: fix external_better/tie/no_local_basis/no_external_baseline cases, add tests, and rerun this benchmark.

## Superiority Gate
Do not stop for superiority. Continue the loop until the gaps below are closed.
- Current benchmark slice has not passed; fix slice failures before evaluating superiority.

## Proof Integrity
- No first-pass integrity gaps detected for this benchmark summary.

## Holdout Freshness
- No required holdout freshness gaps detected for this benchmark summary.
