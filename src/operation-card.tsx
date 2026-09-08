import { useEffect, useState } from 'react'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
export interface OpenTarget {hostId:string;path?:string}
const titles:Record<string,string>={dsh_ssh_hosts:'服务器',dsh_ssh_exec:'远程命令',dsh_ssh_read:'远程文件',dsh_ssh_edit:'配置修改',dsh_ssh_upload:'SFTP 上传'}
const buttonStyle={border:'1px solid #70816b',borderRadius:6,padding:'5px 10px',background:'transparent',color:'inherit',cursor:'pointer'}
const preStyle={whiteSpace:'pre-wrap' as const,overflowWrap:'anywhere' as const,maxHeight:280,overflow:'auto',fontSize:12,lineHeight:1.6,padding:12,background:'rgba(127,127,127,.08)',borderRadius:6}
export function OperationCard({block,toolName,callId,open}:{block:ToolCallViewProps['block'];toolName:string;callId:string;open:(target?:OpenTarget)=>void}){
  const settled='kind' in block && block.kind==='tool-result'
  const raw=settled?block.call?.argsRaw:('argsRaw' in block?block.argsRaw:'')
  let args:Record<string,string>={};try{args=JSON.parse(raw||'{}')}catch{}
  const [live,setLive]=useState<{target?:string;output?:string;state?:string;bytesTransferred?:number;totalBytes?:number;speedBytesPerSecond?:number}|null>(null)
  useEffect(()=>{
    if(settled)return
    let stopped=false,timer:ReturnType<typeof setTimeout>;const controller=new AbortController()
    const poll=async()=>{try{const r=await fetch('/ssh-workbench/operation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({callId}),signal:controller.signal});if(r.ok&&!stopped)setLive(await r.json())}catch{}finally{if(!stopped)timer=setTimeout(poll,500)}}
    void poll();return()=>{stopped=true;clearTimeout(timer);controller.abort()}
  },[callId,settled])
  const content=settled?block.content.filter((c:{type:string;text?:string})=>c.type==='text').map((c:{text?:string})=>c.text??'').join('\n'):''
  let result:Record<string,unknown>|unknown[]|undefined
  try{result=JSON.parse(content)}catch{}
  const hosts=Array.isArray(result)?result as Array<{id:string;name:string;host:string;port:number;username:string}>:undefined
  const value=result&&!Array.isArray(result)?result:undefined
  const state=!settled?(live?.state==='running'?'执行中':'等待处理'):block.isError?'失败':value?.stopped?'已停止':typeof value?.exitCode==='number'&&value.exitCode!==0?'命令失败':'已完成'
  const destination=args.hostId?{hostId:args.hostId,...(args.path?{path:args.path}:{})}:undefined
  const formatBytes=(bytes:number)=>bytes>=1024*1024*1024?(bytes/1024/1024/1024).toFixed(2)+' GB':bytes>=1024*1024?(bytes/1024/1024).toFixed(1)+' MB':bytes>=1024?(bytes/1024).toFixed(1)+' KB':bytes+' B'
  const transferred=live?.bytesTransferred??(typeof value?.bytes==='number'?value.bytes:undefined),total=live?.totalBytes??(typeof value?.bytes==='number'?value.bytes:undefined)
  const percent=typeof transferred==='number'&&typeof total==='number'&&total>0?Math.min(100,Math.round(transferred/total*100)):0
  return <section style={{border:'1px solid rgba(127,127,127,.35)',borderRadius:10,padding:14,margin:'10px 0',color:'inherit'}}>
    <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><strong>⌘ {titles[toolName]??'SSH'}</strong><span style={{fontSize:12,opacity:.7}}>{state}</span></header>
    {(live?.target||value?.target||args.hostId)&&<p style={{fontSize:12,opacity:.75}}>{String(live?.target||value?.target||args.hostId)}</p>}
    {args.cwd&&<p style={{fontSize:12}}>远程目录：{args.cwd} · 独立 Shell</p>}
    {args.command&&<pre style={preStyle}>{args.command}</pre>}
    {toolName==='dsh_ssh_upload'&&<div style={{margin:'12px 0'}}><div style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:12,marginBottom:7}}><span style={{overflow:'hidden',textOverflow:'ellipsis'}}>{args.localPath} → {args.path}</span><b>{percent}%</b></div><progress value={transferred??0} max={total||1} style={{display:'block',width:'100%',height:8,accentColor:'#78a861'}}/><div style={{display:'flex',justifyContent:'space-between',fontSize:11,opacity:.7,marginTop:6}}><span>{typeof transferred==='number'?formatBytes(transferred):'准备上传'}{typeof total==='number'?' / '+formatBytes(total):''}</span><span>{live?.speedBytesPerSecond?formatBytes(live.speedBytesPerSecond)+'/s':''}</span></div></div>}
    {args.path&&<p style={{fontFamily:'monospace',fontSize:12}}>{args.path}</p>}
    {toolName==='dsh_ssh_edit'&&<details open={!settled}><summary>查看修改前后</summary><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,minWidth:0}}><div style={{minWidth:0}}>修改前<pre style={preStyle}>{args.oldText}</pre></div><div style={{minWidth:0}}>修改后<pre style={preStyle}>{args.newText}</pre></div></div></details>}
    {hosts?hosts.map(h=><div key={h.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'10px 0',borderBottom:'1px solid rgba(127,127,127,.2)'}}><div><b>{h.name}</b><div style={{fontSize:12,opacity:.7}}>{h.username}@{h.host}:{h.port}</div></div><button style={buttonStyle} onClick={()=>open({hostId:h.id})}>打开 SSH</button></div>):<>
      {!settled&&live?.output&&<pre style={preStyle}>{live.output}</pre>}
      {settled&&<details open><summary>执行结果{value?.durationMs!==undefined?' · '+String(value.durationMs)+' ms':''}{value?.exitCode!==undefined?' · exit '+String(value.exitCode):''}</summary><pre style={preStyle}>{value?String(value.text??((value.stdout!==undefined||value.stderr!==undefined)?String(value.stdout??'')+String(value.stderr??''):JSON.stringify(value,null,2))):content}</pre></details>}
    </>}
    <div style={{display:'flex',justifyContent:'flex-end',marginTop:10}}><button style={buttonStyle} onClick={()=>open(destination)}>{args.path?'在 SSH 中打开文件':'完整 SSH 工作区 ↗'}</button></div>
  </section>
}
