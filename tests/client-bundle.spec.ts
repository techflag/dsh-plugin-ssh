import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { createRequire } from 'node:module'

it('waits for host-owned slots before adding entries and emits a Harness factory', () => {
  let plugin: { apply:(ctx:unknown)=>void } | undefined
  const require=createRequire(import.meta.url), waiting:Array<()=>unknown>=[],registered:string[]=[],cleanups:Array<()=>void>=[]
  const window={__ModuleLoader__:{load:(entry:{id:string;factory:(require:NodeJS.Require)=>unknown})=>{expect(entry.id).toBe('dsh-plugin-ssh');plugin=entry.factory(require) as typeof plugin}},addEventListener:()=>{},removeEventListener:()=>{}}
  runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window})
  plugin!.apply({inputTriggers:{registerSource:()=>()=>{}},slots:{inject:(_key:string,fn:()=>unknown)=>waiting.push(fn),register:({id,name}:{id:string;name:string})=>{if(name!=='tool.call.toolview')expect(id).toBe('dsh-ssh');registered.push(name);return()=>{registered.splice(registered.indexOf(name),1)}}},effect:(fn:()=>()=>void)=>cleanups.push(fn())})
  expect(registered).toEqual([])
  for(const apply of waiting.values())cleanups.push(apply() as ()=>void)
  expect(registered).toEqual(['conversation.input.dock',...Array(5).fill('tool.call.toolview'),'sidebar.footer.action','shell.overlay'])
  cleanups.reverse().forEach(fn=>fn())
  expect(registered).toEqual([])
})
