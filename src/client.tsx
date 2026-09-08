import type {} from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { createSshInputSources } from './input-sources.ts'
import { OperationCard, type OpenTarget } from './operation-card.tsx'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { useEffect, useRef, useSyncExternalStore } from 'react'

export const inject = ['slots','inputTriggers']

/** Additive slots: the existing Harness root and conversation stay mounted. */
export function apply(ctx: Context): void {
  let visible=false, mounted=false, handoffContext=''
  const listeners=new Set<()=>void>()
  let pending:OpenTarget|undefined,frameWindow:Window|null=null
  const send=()=>{if(pending&&frameWindow){frameWindow.postMessage({type:'dsh-ssh-open-host',...pending},location.origin);pending=undefined}}
  const open=(target?:OpenTarget)=>{pending=target;visible=true;mounted=true;for(const fn of listeners)fn();send()}
  const close=()=>{visible=false;for(const fn of listeners)fn()}
  const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}}
  function Launcher(){return <button type="button" onClick={()=>open()} title="SSH 工作区" style={{padding:'8px 12px',cursor:'pointer',border:'1px solid currentColor',borderRadius:6,background:'transparent',color:'inherit'}}>⌘ SSH</button>}
  function Surface(){
    const active=useSyncExternalStore(subscribe,()=>visible,()=>false),frame=useRef<HTMLIFrameElement>(null)
    useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==frame.current?.contentWindow)return;if(event.data?.type==='dsh-ssh-handoff' && typeof event.data.text==='string'){handoffContext=event.data.text.slice(-26000);close();return}if(event.data?.type==='dsh-ssh-close'||event.data?.type==='dsh-ssh-model-settings')close()};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)},[])
    return mounted?<div hidden={!active} style={{position:'fixed',inset:0,zIndex:1000,background:'#141819'}}><iframe ref={frame} onLoad={()=>{frameWindow=frame.current?.contentWindow??null;send()}} title="DSH SSH 工作区" src="/ssh-workbench/" style={{display:'block',width:'100%',height:'100%',border:0}} /></div>:null
  }
  function HandoffDock(props:PropsRuntime<'conversation.input.dock'>){
    const context=useSyncExternalStore(subscribe,()=>handoffContext,()=>handoffContext)
    const input=props.useInput(s=>s)
    if(!context)return null
    const add=()=>{if(input.phase!=='plain'||input.occurrences.length)return;props.inputActions.setDraft(`${input.draft.trimEnd()}\n${context}\n`.trimStart());handoffContext='';for(const fn of listeners)fn()}
    return <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'8px 11px',border:'1px solid color-mix(in srgb, currentColor 16%, transparent)',borderRadius:9,fontSize:12}}><span>SSH 输出已准备好，可加入当前问题</span><div style={{display:'flex',gap:6}}><button type="button" onClick={add}>加入</button><button type="button" aria-label="忽略 SSH 输出" onClick={()=>{handoffContext='';for(const fn of listeners)fn()}}>×</button></div></div>
  }
  for(const source of createSshInputSources(open))ctx.effect(()=>ctx.inputTriggers.registerSource(source),`ssh: ${source.trigger}${source.name}`)
  ctx.slots.inject('conversation.input.dock',()=>ctx.slots.register({name:'conversation.input.dock',id:'dsh-ssh'},HandoffDock))
  for(const name of ['dsh_ssh_hosts','dsh_ssh_exec','dsh_ssh_read','dsh_ssh_edit','dsh_ssh_upload']) {
    ctx.slots.inject('tool.call.toolview',()=>ctx.slots.register({name:'tool.call.toolview',key:name},(props:ToolCallViewProps)=><OperationCard block={props.block} toolName={props.toolName} callId={props.callId} open={open}/>))
  }
  ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'dsh-ssh'},Launcher))
  ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'dsh-ssh'},Surface))
  ctx.effect(()=>{const key=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='s'){event.preventDefault();open()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},'ssh: shortcut')
}
