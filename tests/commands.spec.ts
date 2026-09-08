import { expect, it } from 'vitest'
import { answerParts } from '../src/ui/commands.ts'
it('only offers complete single-line shell commands', () => {
  expect(answerParts('检查\n```bash\npwd\n```')[1].command).toBe('pwd')
  for (const text of ['`pwd`', '```bash\npwd', '```json\n{}\n```', '```sh\necho a\nrm x\n```', '```sh\necho \u001b[0m\n```', '```sh\nyum install <包名>\n```']) {
    expect(answerParts(text).some(p => p.command)).toBe(false)
  }
})
