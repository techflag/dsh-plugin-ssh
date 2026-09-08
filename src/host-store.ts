import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { validateTarget, type SshTarget } from './ssh-service.ts'
export interface SavedHost extends SshTarget { id:string;name:string;fingerprint?:string }
export function hostId(t:SshTarget){return createHash('sha256').update(JSON.stringify([t.host,t.port,t.username])).digest('hex').slice(0,24)}
export class HostStore {
  private queue:Promise<unknown>=Promise.resolve()
  constructor(private dir=join(process.env.DSH_HOME||join(homedir(),'.dsh'),'ssh-workbench')){}
  async list():Promise<SavedHost[]>{try{return JSON.parse(await readFile(join(this.dir,'hosts.json'),'utf8')) as SavedHost[]}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e}}
  async get(id:string){const h=(await this.list()).find(h=>h.id===id);if(!h)throw new Error('主机不存在，请在 SSH 工作区添加主机');return h}
  save(values:unknown):Promise<void>{
    const task=this.queue.then(async()=>{
      if(!Array.isArray(values)||values.length>100)throw new Error('主机列表无效')
      const hosts:SavedHost[]=values.map(t=>{
        validateTarget(t)
        if(t.fingerprint && !/^SHA256:[A-Za-z0-9+/]{43}$/.test(t.fingerprint))throw new Error('指纹无效')
        return {id:hostId(t),name:String(t.name||t.host).slice(0,100),host:t.host,port:t.port,username:t.username,...(t.fingerprint?{fingerprint:t.fingerprint}:{})}
      })
      await mkdir(this.dir,{recursive:true,mode:0o700});const temp=join(this.dir,randomUUID()+'.tmp')
      await writeFile(temp,JSON.stringify(hosts),{mode:0o600});await rename(temp,join(this.dir,'hosts.json'))
    });this.queue=task.catch(()=>{});return task
  }
}
