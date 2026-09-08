import { confirmAction } from './confirm.ts'
import { installEditorSplit } from './editor-split.ts'
interface Document { path: string; text: string; saved: string; version: string; busy: boolean }
export function installEditor(api: <T>(op:string,data:unknown)=>Promise<T>, getId:()=>string) {
  const documents=new Map<string,Document>()
  const panel=document.createElement('div');panel.className='editor-panel';panel.hidden=true
  panel.innerHTML='<div class="editor-toolbar"><span></span><button data-save>保存</button><button data-close>×</button></div><textarea spellcheck="false" aria-label="远程文件内容"></textarea><small role="status"></small>'
  document.getElementById('terminals')!.prepend(panel)
  const layout = installEditorSplit(panel)
  const input=panel.querySelector('textarea')!, label=panel.querySelector('span')!, status=panel.querySelector('small')!,save=panel.querySelector<HTMLButtonElement>('[data-save]')!
  let generation=0
  const canClose=async(id:string)=>{const d=documents.get(id);return !d || (!d.busy && (d.text===d.saved || await confirmAction('放弃 '+d.path+' 的未保存修改？')))}
  function refresh(){const d=documents.get(getId());panel.hidden=!d;layout();if(!d)return;input.value=d.text;input.disabled=d.busy;label.textContent=d.path+(d.text!==d.saved?' ●':'');save.disabled=d.busy||d.text===d.saved;status.textContent=''}
  input.oninput=()=>{const d=documents.get(getId());if(d){d.text=input.value;label.textContent=d.path+(d.text!==d.saved?' ●':'');save.disabled=d.busy||d.text===d.saved}}
  panel.querySelector<HTMLButtonElement>('[data-close]')!.onclick=async()=>{if(await canClose(getId())){documents.delete(getId());++generation;refresh()}}
  save.onclick=async()=>{const id=getId(),d=documents.get(id);if(!d||d.busy)return;d.busy=true;refresh();try{const result=await api<{version:string}>('save-text',{id,path:d.path,text:d.text,version:d.version});d.version=result.version;d.saved=d.text;d.busy=false;if(id===getId()){refresh();status.textContent='已保存'}}catch(error){d.busy=false;if(id===getId()){refresh();status.textContent=String(error)}}}
  input.onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='s'){e.preventDefault();save.click()}}
  window.addEventListener('beforeunload',event=>{if([...documents.values()].some(d=>d.text!==d.saved)){event.preventDefault();event.returnValue=''}})
  return {refresh,canClose,async open(id:string,path:string){if(!(await canClose(id)))return;const current=++generation;try{const result=await api<{text:string;version:string}>('read-text',{id,path});if(current!==generation)return;documents.set(id,{path,text:result.text,saved:result.text,version:result.version,busy:false});if(id===getId())refresh()}catch(error){throw error}}}
}
