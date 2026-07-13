import type { RawEdit } from './change-extract.js'

export interface EditRegion {
  regionStartLine: number
  regionEndLine: number
  regionBucket: number
  regionKey: string
}

function lineCount(text: string): number {
  return text.length === 0 ? 1 : text.split(/\r?\n/).length
}

/** Locate an edit before it is applied using its removed-text anchor. */
export function locateEditRegion(fileContent: string, edit: RawEdit, bucketSize = 20): EditRegion | null {
  if (edit.isNewFile) {
    return {
      regionStartLine: 1,
      regionEndLine: Math.max(1, lineCount(edit.newText)),
      regionBucket: 0,
      regionKey: `${edit.path}:0`,
    }
  }
  if (!edit.oldText) return null
  const offset = fileContent.indexOf(edit.oldText)
  if (offset < 0) return null
  const regionStartLine = fileContent.slice(0, offset).split(/\r?\n/).length
  const regionEndLine = regionStartLine + lineCount(edit.oldText) - 1
  const regionBucket = Math.floor((regionStartLine - 1) / bucketSize)
  return {
    regionStartLine,
    regionEndLine,
    regionBucket,
    regionKey: `${edit.path}:${regionBucket}`,
  }
}
