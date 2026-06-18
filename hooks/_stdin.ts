/** Read all of stdin and JSON.parse it. Returns {} on empty/invalid. */
export async function readStdinJson(): Promise<Record<string, any>> {
  const chunks: Buffer[] = []
  for await (const c of process.stdin) chunks.push(c as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}
