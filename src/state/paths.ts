import { join } from 'node:path'

/** Resolve the .intent/ state paths for a given project root. */
export function paths(root: string) {
  const base = join(root, '.intent')
  return {
    base,
    intentsDir: join(base, 'intents'),
    decisions: join(base, 'decisions.md'),
    learnings: join(base, 'learnings.md'),
    state: join(base, 'state.json'),
    config: join(base, 'config.json'),
    runsDir: join(base, 'runs'),
    runsLatest: join(base, 'runs', 'latest-runs.json'),
    contractsDir: join(base, 'contracts'),
    detectionsDir: join(base, 'detections'),
    detectionFile: (detectionId: string) => join(base, 'detections', `${detectionId}.json`),
    evalsDir: join(base, 'evals'),
    evalCaseFile: (evalId: string) => join(base, 'evals', `${evalId}.json`),
    rawDir: join(base, 'raw'),
    verificationResultsDir: (type: string) => join(base, 'raw', `${type}-results`),
    rawObservabilityDir: join(base, 'raw', 'observability'),
    traceDir: join(base, 'raw', 'observability', 'traces'),
    spanDir: join(base, 'raw', 'observability', 'spans'),
    handoffDir: join(base, 'handoff'),
    handoffLatest: join(base, 'handoff', 'latest.md'),
    handoffScratch: join(base, 'handoff', 'scratch.json'),
    wikiDir: join(base, 'wiki'),
    wikiIndex: join(base, 'wiki', 'index.md'),
    wikiLog: join(base, 'wiki', 'log.md'),
    wikiKnowledgeDir: join(base, 'wiki', 'knowledge'),
    wikiProblemsDir: join(base, 'wiki', 'problems'),
    rulesDir: join(base, 'rules'),
  }
}
