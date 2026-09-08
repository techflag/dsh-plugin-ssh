import {expect,it} from 'vitest'
import {ErrorHintTracker} from '../src/ui/error-hint.ts'
it('ignores login history and detects split, colored grep errors after a command',()=>{
 const tracker=new ErrorHintTracker()
 expect(tracker.feed('Permission denied')).toBeUndefined()
 tracker.begin()
 expect(tracker.feed('\x1b[31mUsa')).toBeUndefined()
 expect(tracker.feed('ge: grep [OPTION]... PATTERN\x1b[0m')).toContain('grep')
 tracker.begin()
 expect(tracker.feed('normal output')).toBeUndefined()
})
it('detects common failures without interpreting ordinary output as an exit status',()=>{
 const tracker=new ErrorHintTracker();tracker.begin()
 expect(tracker.feed('bash: missing: command not found')).toContain('可能')
 tracker.begin();expect(tracker.feed('0 errors, completed')).toBeUndefined()
})
