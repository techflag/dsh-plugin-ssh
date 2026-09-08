/** A focusable in-page confirmation works in embedded Harness webviews too. */
export function confirmAction(message:string):Promise<boolean>{
  return new Promise(resolve=>{
    const previous=document.activeElement as HTMLElement|null,dialog=document.createElement('dialog')
    dialog.setAttribute('aria-label','确认操作')
    const title=document.createElement('h2');title.textContent='确认操作'
    const body=document.createElement('p');body.textContent=message
    const actions=document.createElement('div');actions.className='buttons'
    const cancel=document.createElement('button');cancel.textContent='取消'
    const confirm=document.createElement('button');confirm.textContent='确认';confirm.className='primary'
    let finished=false
    const finish=(accepted:boolean)=>{if(finished)return;finished=true;dialog.close();dialog.remove();previous?.focus();resolve(accepted)}
    cancel.onclick=()=>finish(false);confirm.onclick=()=>finish(true)
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false)})
    actions.append(cancel,confirm);dialog.append(title,body,actions);document.body.append(dialog);dialog.showModal();cancel.focus()
  })
}
