export interface AnswerPart { text: string; command?: string }
/** Only complete, explicitly marked shell blocks become command actions. */
export function answerParts(text: string): AnswerPart[] {
  const parts: AnswerPart[] = []
  const pattern = /```(bash|sh|shell|zsh)\s*\n([\s\S]*?)\n```/g
  let offset = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index! > offset) parts.push({ text: text.slice(offset, match.index) })
    const command = match[2]!.trim()
    const safeInput = command.length > 0 && command.length <= 4000 && !/[\x00-\x1f\x7f-\x9f]/.test(command) && !/<[^>]+>/.test(command)
    parts.push({ text: match[2]!, command: safeInput ? command : undefined })
    offset = match.index! + match[0].length
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) })
  return parts
}
