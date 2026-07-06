import { findContract } from './contracts.js'
import { loadDetections } from './detections.js'
import { findRun } from './runs.js'
import type { DetectionRecord, RunState, SprintContract, VerificationEvidenceType } from './schemas.js'

function commandLine(command: string, args: string[]): string {
  return [command, ...args].join(' ')
}

function lineList(values: string[], empty: string): string[] {
  return values.length > 0 ? values.map((value) => `- [ ] ${value}`) : [`- [ ] ${empty}`]
}

function requiredChecks(run: RunState, contract: SprintContract | null): VerificationEvidenceType[] {
  return contract?.requiredChecks.length ? contract.requiredChecks : run.requiredEvidenceTypes
}

function latestEvidenceFor(run: RunState, type: VerificationEvidenceType) {
  const matches = run.evidence.filter((evidence) => evidence.type === type)
  return matches[matches.length - 1] ?? null
}

function evidenceLine(run: RunState, type: VerificationEvidenceType): string {
  const evidence = latestEvidenceFor(run, type)
  if (!evidence) return `- [ ] ${type}: missing required evidence`
  const checked = evidence.status === 'passed' ? 'x' : ' '
  return `- [${checked}] ${type}: ${evidence.status} via \`${commandLine(evidence.command, evidence.args)}\` (${evidence.logPath})`
}

function otherEvidenceLines(run: RunState, checks: VerificationEvidenceType[]): string[] {
  const required = new Set(checks)
  const extras = run.evidence.filter((evidence) => !required.has(evidence.type))
  if (extras.length === 0) return ['- [x] No optional evidence recorded.']
  return extras.map(
    (evidence) =>
      `- [${evidence.status === 'passed' ? 'x' : ' '}] ${evidence.type}: ${evidence.status} via \`${commandLine(
        evidence.command,
        evidence.args,
      )}\` (${evidence.logPath})`,
  )
}

function detectionLine(detection: DetectionRecord): string {
  const checked = detection.result === 'candidate' ? ' ' : 'x'
  return `- [${checked}] ${detection.detectionId} ${detection.result} ${detection.type}: ${detection.title}`
}

function detectionLines(detections: DetectionRecord[]): string[] {
  return detections.length > 0 ? detections.map(detectionLine) : ['- [x] No detections for this run.']
}

function runDetections(root: string, runId: string): DetectionRecord[] {
  return loadDetections(root).filter((detection) => detection.runId === runId)
}

export function buildReviewerChecklist(root: string, runId: string): string {
  const run = findRun(root, runId)
  if (!run) throw new Error(`no such run: ${runId}`)
  const contract = run.contractId ? findContract(root, run.contractId) : null
  const checks = requiredChecks(run, contract)
  const detections = runDetections(root, run.runId)

  return [
    `# Reviewer Checklist: ${run.runId}`,
    '',
    '## Run',
    `- [ ] Objective reviewed: ${run.objective}`,
    `- [ ] Status reviewed: ${run.status}`,
    `- [ ] Phase reviewed: ${run.phase}`,
    `- [ ] Intent reviewed: ${run.intentId ?? 'none'}`,
    '',
    '## Contract',
    `- [ ] Contract reviewed: ${contract?.contractId ?? 'none'}`,
    ...lineList(contract?.allowedScope ?? [], 'No allowed scope recorded.').map((line) =>
      line.replace('- [ ] ', '- [ ] Allowed scope: '),
    ),
    ...lineList(contract?.forbiddenScope ?? [], 'No forbidden scope recorded.').map((line) =>
      line.replace('- [ ] ', '- [ ] Forbidden scope: '),
    ),
    ...lineList(contract?.architectureBoundaries ?? [], 'No architecture boundaries recorded.').map((line) =>
      line.replace('- [ ] ', '- [ ] Boundary: '),
    ),
    ...lineList(contract?.definitionOfDone ?? [], 'No definition of done recorded.').map((line) =>
      line.replace('- [ ] ', '- [ ] DoD: '),
    ),
    '',
    '## Required Evidence',
    ...(checks.length > 0 ? checks.map((type) => evidenceLine(run, type)) : ['- [x] No required evidence configured.']),
    '',
    '## Optional Evidence',
    ...otherEvidenceLines(run, checks),
    '',
    '## Detections',
    ...detectionLines(detections),
  ].join('\n')
}
