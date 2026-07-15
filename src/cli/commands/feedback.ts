import {
  loadRules, findRule, draftRule, approveRule, composeAgentsRuleCandidate, composeCiRuleCandidate,
  composeRuleImpactReport, recordRuleReflection,
} from '../../runtime/rules.js'
import {
  findDetection, loadDetections, recordJudgeResult, recordDetectionWikiPage, resolveDetection,
} from '../../runtime/detections.js'
import {
  DetectionResultSchema, JudgeStatusSchema, RuleReflectionKindSchema, RuleReflectionStatusSchema,
  type DetectionRecord, type RuleKind,
} from '../../runtime/schemas.js'
import { blockRunForDetections, detectRunMonitorIssues } from '../../runtime/monitor.js'
import { activeRun, findRun } from '../../runtime/runs.js'
import { buildJudgeInputBundle } from '../../runtime/judge.js'
import { runJudgeAdapter } from '../../runtime/judge-adapter.js'
import { loadJudgePolicy, runEmbeddingAdapter, runJudgeBatch, selectJudgeCandidates } from '../../runtime/judge-policy.js'
import { buildReviewerChecklist } from '../../runtime/reviewer.js'
import { draftEvalCaseFromDetection, runEvalCases } from '../../runtime/evals.js'
import { approvalActorForCli, flagValue, type CliContext } from '../shared.js'

export function cmdRule(context: CliContext): void {
  const { root, args } = context
  const sub = args[0]
  try {
    if (sub === 'draft') {
      const kind = args[1] as RuleKind
      if (kind !== 'forbid-path' && kind !== 'forbid-pattern') {
        console.error('usage: intent rule draft <forbid-path|forbid-pattern> <pattern> "<reason>"')
        process.exit(1)
      }
      const r = draftRule(root, kind, args[2], args[3] ?? '')
      console.log(`drafted ${r.id} (${r.kind}) — activate with \`intent rule approve ${r.id}\``)
    } else if (sub === 'draft-from-detection') {
      const detectionId = args[1]
      const kind = args[2] as RuleKind
      const pattern = args[3]
      if (!detectionId || (kind !== 'forbid-path' && kind !== 'forbid-pattern') || !pattern) {
        console.error('usage: intent rule draft-from-detection <detectionId> <forbid-path|forbid-pattern> <pattern> ["reason"]')
        process.exit(1)
      }
      const detection = findDetection(root, detectionId)
      if (!detection) throw new Error(`no such detection: ${detectionId}`)
      const reason = args[4] ?? `${detection.type}: ${detection.summary}`
      const r = draftRule(root, kind, pattern, reason, { sourceDetectionId: detection.detectionId })
      console.log(`drafted ${r.id} from ${detection.detectionId} (${r.kind}) — activate with \`intent rule approve ${r.id}\``)
    } else if (sub === 'agents-candidate') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent rule agents-candidate <ruleId>')
        process.exit(1)
      }
      const rule = findRule(root, id)
      if (!rule) throw new Error(`no such rule: ${id}`)
      process.stdout.write(composeAgentsRuleCandidate(rule) + '\n')
    } else if (sub === 'ci-candidate') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent rule ci-candidate <ruleId>')
        process.exit(1)
      }
      const rule = findRule(root, id)
      if (!rule) throw new Error(`no such rule: ${id}`)
      process.stdout.write(composeCiRuleCandidate(rule) + '\n')
    } else if (sub === 'reflect') {
      const id = args[1]
      const kind = RuleReflectionKindSchema.safeParse(args[2])
      const status = RuleReflectionStatusSchema.safeParse(args[3])
      const target = args[4]
      if (!id || !kind.success || !status.success || !target) {
        console.error('usage: intent rule reflect <ruleId> <agents|ci> <candidate|applied> <target> ["evidence"]')
        process.exit(1)
      }
      const rule = recordRuleReflection(root, id, {
        kind: kind.data,
        status: status.data,
        target,
        evidence: args[5] ?? '',
      })
      console.log(`reflected ${rule.id}: ${kind.data}/${status.data} ${target}`)
    } else if (sub === 'impact') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent rule impact <ruleId>')
        process.exit(1)
      }
      const rule = findRule(root, id)
      if (!rule) throw new Error(`no such rule: ${id}`)
      process.stdout.write(composeRuleImpactReport(rule) + '\n')
    } else if (sub === 'approve') {
      const r = approveRule(root, args[1], approvalActorForCli())
      console.log(`approved ${r.id} by ${r.approvedBy}`)
    } else if (sub === 'list' || !sub) {
      for (const r of loadRules(root)) console.log(`${r.id}  [${r.status}]  ${r.kind}  /${r.pattern}/  ${r.reason}`)
    } else {
      console.error('usage: intent rule list | draft <kind> <pattern> "<reason>" | draft-from-detection <detectionId> <kind> <pattern> ["reason"] | agents-candidate <ruleId> | ci-candidate <ruleId> | reflect <ruleId> <agents|ci> <candidate|applied> <target> ["evidence"] | impact <ruleId> | approve <id>')
      process.exit(1)
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

function detectionLine(detection: DetectionRecord): string {
  const run = detection.runId ? ` (${detection.runId})` : ''
  return `${detection.detectionId} [${detection.result}] ${detection.type} ${detection.title}${run}`
}

function printDetection(detection: DetectionRecord): void {
  console.log(detectionLine(detection))
  console.log(`summary: ${detection.summary}`)
  if (detection.intentId) console.log(`intent: ${detection.intentId}`)
  if (detection.runId) console.log(`run: ${detection.runId}`)
  console.log('evidence:')
  for (const ref of detection.evidenceRefs.length > 0 ? detection.evidenceRefs : ['—']) console.log(`  - ${ref}`)
  console.log('attributes:')
  console.log(JSON.stringify(detection.attributes, null, 2))
  if (detection.resolution) console.log(`resolution: ${detection.resolution}`)
  if (detection.resolvedAt) console.log(`resolvedAt: ${detection.resolvedAt}`)
}

export function cmdDetection(context: CliContext): void {
  const { root, args } = context
  const sub = args[0]
  try {
    if (sub === 'list') {
      const detections = loadDetections(root)
      if (detections.length === 0) {
        console.log('no detections')
        return
      }
      for (const detection of detections) console.log(detectionLine(detection))
      return
    }
    if (sub === 'show') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent detection show <id>')
        process.exit(1)
      }
      const detection = findDetection(root, id)
      if (!detection) throw new Error(`no such detection: ${id}`)
      printDetection(detection)
      return
    }
    if (sub === 'resolve') {
      const [id, resultText, resolution] = [args[1], args[2], args[3]]
      const result = DetectionResultSchema.safeParse(resultText)
      if (!id || !result.success || result.data === 'candidate' || !resolution) {
        console.error('usage: intent detection resolve <id> <confirmed|dismissed> "<resolution>"')
        process.exit(1)
      }
      const detection = resolveDetection(root, id, result.data, resolution)
      console.log(`resolved ${detection.detectionId} as ${detection.result}`)
      const wiki = recordDetectionWikiPage(root, detection.detectionId)
      console.log(`wiki: ${wiki.slug} (${wiki.file})`)
      return
    }
    console.error('usage: intent detection list | show <id> | resolve <id> <confirmed|dismissed> "<resolution>"')
    process.exit(1)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

export function cmdMonitor(context: CliContext): void {
  const { root, args } = context
  const sub = args[0]
  try {
    const runId = sub === 'active' ? activeRun(root)?.runId : sub === 'run' ? args[1] : null
    if (!runId) {
      console.error('usage: intent monitor active | run <runId>')
      process.exit(1)
    }
    const run = findRun(root, runId)
    if (!run) throw new Error(`no such run: ${runId}`)
    const unique = detectRunMonitorIssues(root, run.runId)
    console.log(`monitor ${run.runId}: ${unique.length} detection(s)`)
    for (const detection of unique) console.log(`  ${detectionLine(detection)}`)
    if (unique.length > 0) {
      const updated = blockRunForDetections(root, run.runId, unique)
      if (updated) console.log(`blocked ${updated.runId}: ${updated.nextAction}`)
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

export function cmdJudge(context: CliContext): void {
  const { root, args } = context
  const sub = args[0]
  try {
    if (sub === 'policy') {
      console.log(JSON.stringify(loadJudgePolicy(root), null, 2))
      return
    }
    if (sub === 'semantic') {
      const separator = args.indexOf('--')
      if (separator < 1 || separator === args.length - 1) {
        console.error('usage: intent judge semantic [--model key] -- <embedding-command...>')
        process.exit(1)
      }
      const policy = loadJudgePolicy(root)
      const modelKey = flagValue(args, '--model') ?? policy.embeddingModelKey
      const [embeddingCommand, ...embeddingArgs] = args.slice(separator + 1)
      const result = runEmbeddingAdapter(root, modelKey, embeddingCommand, embeddingArgs, policy)
      console.log(`embedding adapter ${result.adapterInvoked ? 'ran' : 'cache hit'}: model=${modelKey}`)
      console.log(`embedded: ${result.embeddedDetectionIds.join(', ') || '—'}`)
      console.log(`cached: ${result.cachedDetectionIds.join(', ') || '—'}`)
      return
    }
    if (sub === 'queue') {
      const policy = loadJudgePolicy(root)
      const modelKey = flagValue(args, '--model') ?? policy.embeddingModelKey
      const candidates = selectJudgeCandidates(root, modelKey, policy)
      console.log(`judge queue: ${candidates.length} candidate(s), model=${modelKey}`)
      for (const candidate of candidates) {
        console.log(`  ${candidate.detectionId} similarity=${candidate.similarity.toFixed(4)} chars=${candidate.estimatedInputChars} peers=${candidate.similarDetectionIds.join(',')}`)
      }
      return
    }
    if (sub === 'batch') {
      const separator = args.indexOf('--')
      if (separator < 1 || separator === args.length - 1) {
        console.error('usage: intent judge batch [--model key] -- <judge-command...>')
        process.exit(1)
      }
      const policy = loadJudgePolicy(root)
      const modelKey = flagValue(args, '--model') ?? policy.embeddingModelKey
      const [judgeCommand, ...judgeArgs] = args.slice(separator + 1)
      const results = runJudgeBatch(root, modelKey, judgeCommand, judgeArgs, policy)
      console.log(`judge batch: ${results.length} candidate(s), model=${modelKey}`)
      for (const result of results) {
        console.log(`  ${result.detection.detectionId}: ${result.detection.judge.status}${result.cached ? ' (cached)' : ''}`)
      }
      return
    }
    if (sub === 'bundle') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent judge bundle <detectionId>')
        process.exit(1)
      }
      console.log(JSON.stringify(buildJudgeInputBundle(root, id), null, 2))
      return
    }
    if (sub === 'record') {
      const id = args[1]
      const status = JudgeStatusSchema.safeParse(args[2])
      const judgement = args[3]
      const confidenceRaw = flagValue(args, '--confidence')
      const confidence = confidenceRaw === undefined ? null : Number(confidenceRaw)
      if (!id || !status.success || status.data === 'not_run' || !judgement || (confidenceRaw !== undefined && !Number.isFinite(confidence))) {
        console.error('usage: intent judge record <detectionId> <pass|fail|uncertain> "<judgement>" [--confidence 0..1]')
        process.exit(1)
      }
      const detection = recordJudgeResult(root, id, {
        status: status.data,
        judgement,
        confidence,
      })
      console.log(`judge recorded ${detection.detectionId}: ${detection.judge.status}`)
      return
    }
    if (sub === 'run') {
      const id = args[1]
      const separator = args.indexOf('--')
      if (!id || separator !== 2 || separator === args.length - 1) {
        console.error('usage: intent judge run <detectionId> -- <command...>')
        process.exit(1)
      }
      const [judgeCommand, ...judgeArgs] = args.slice(separator + 1)
      const result = runJudgeAdapter(root, id, judgeCommand, judgeArgs)
      console.log(`judge adapter ${result.cached ? 'cached' : 'recorded'} ${result.detection.detectionId}: ${result.detection.judge.status}`)
      return
    }
    console.error('usage: intent judge policy | semantic [--model key] -- <command...> | queue [--model key] | batch [--model key] -- <command...> | bundle <detectionId> | record <detectionId> <pass|fail|uncertain> "<judgement>" [--confidence 0..1] | run <detectionId> -- <command...>')
    process.exit(1)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

export function cmdReviewer(context: CliContext): void {
  const { root, args } = context
  const sub = args[0]
  try {
    if (sub === 'checklist') {
      const runId = args[1] ?? activeRun(root)?.runId
      if (!runId) {
        console.error('usage: intent reviewer checklist [runId]')
        process.exit(1)
      }
      process.stdout.write(buildReviewerChecklist(root, runId) + '\n')
      return
    }
    console.error('usage: intent reviewer checklist [runId]')
    process.exit(1)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

export function cmdEval(context: CliContext): void {
  const { root, args } = context
  const sub = args[0]
  try {
    if (sub === 'draft-from-detection') {
      const detectionId = args[1]
      if (!detectionId) {
        console.error('usage: intent eval draft-from-detection <detectionId>')
        process.exit(1)
      }
      const evalCase = draftEvalCaseFromDetection(root, detectionId)
      console.log(`eval drafted ${evalCase.evalId} from ${detectionId}: ${evalCase.title}`)
      return
    }
    if (sub === 'run') {
      const results = runEvalCases(root, args[1])
      if (results.length === 0) {
        console.log('no evals')
        return
      }
      for (const result of results) console.log(`${result.evalId}: ${result.status} — ${result.reason}`)
      if (results.some((result) => result.status === 'failed')) process.exit(1)
      return
    }
    console.error('usage: intent eval draft-from-detection <detectionId> | run [evalId]')
    process.exit(1)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}
