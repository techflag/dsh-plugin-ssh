import {it,expect} from 'vitest'
import type {Context} from '@deepseek-ai/cordis'
import type {ToolDefinition} from '@deepseek-ai/dsh-tools'
import {installAgentTools} from '../src/agent-tools.ts'
import type {AgentOperations} from '../src/agent-operations.ts'
it('registers unique SSH tools and preserves the Harness permission decision',async()=>{
 const tools:ToolDefinition[]=[]
 let pre:Function=()=>{}
 const ctx={tools:{register:(tool:ToolDefinition)=>{tools.push(tool);return()=>{}}},sessions:{get:()=>undefined},effect:(f:Function)=>f(),on:(_event:string,f:Function)=>{pre=f}}
 installAgentTools(ctx as unknown as Context,{hosts:{get:async()=>({name:'test',host:'127.0.0.1',port:22,username:'test'})}} as unknown as AgentOperations)
 expect(tools.map(t=>t.name)).toEqual(['dsh_ssh_hosts','dsh_ssh_exec','dsh_ssh_read','dsh_ssh_edit','dsh_ssh_upload'])
 for(const name of ['dsh_ssh_exec','dsh_ssh_read','dsh_ssh_edit','dsh_ssh_upload'])expect(await pre({name,arguments:{hostId:'test'}},async()=>({kind:'allow'}))).toEqual({kind:'allow'})
 expect((await pre({name:'dsh_ssh_edit',arguments:{hostId:'test'}},async()=>({kind:'ask',reason:'宿主要求确认'}))).reason).toContain('宿主要求确认；SSH 操作：test')
 expect(await pre({name:'dsh_ssh_exec',arguments:{}},async()=>({kind:'deny',reason:'policy'}))).toEqual({kind:'deny',reason:'policy'})
 expect(await pre({name:'unrelated'},async()=>({kind:'allow'}))).toEqual({kind:'allow'})
})
