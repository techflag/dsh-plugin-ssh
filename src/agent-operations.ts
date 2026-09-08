import { Readable } from 'node:stream'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { HostStore, type SavedHost } from './host-store.ts'
import { PasswordStore } from './password-store.ts'
import { SshService, type SshSession } from './ssh-service.ts'
import { remoteExec } from './remote-exec.ts'
export interface Operation {callId:string;hostId:string;target:string;kind:string;path?:string;localPath?:string;command?:string;output:string;state:'running'|'completed'|'failed';result?:string;bytesTransferred?:number;totalBytes?:number;speedBytesPerSecond?:number}
export class AgentOperations {
  readonly records=new Map<string,Operation>()
  constructor(readonly hosts:HostStore,readonly passwords:PasswordStore,readonly service:SshService){}
  async withSession<T>(host:SavedHost,signal:AbortSignal,fn:(session:SshSession)=>Promise<T>):Promise<T>{
    if(signal.aborted)throw new Error('已停止')
    const live=[...this.service.sessions.values()].find(s=>!s.closed && s.target.host===host.host && s.target.port===host.port && s.target.username===host.username)
    if(live)return fn(live)
    const password=await this.passwords.get(host)
    if(!password||!host.fingerprint)throw new Error('请在 SSH 工作区核对指纹并保存密码后重试；私钥主机请先手动连接')
    const s=await this.service.connect({...host,password,fingerprint:host.fingerprint})
    this.service.attach(s.id,{data:()=>{},closed:()=>{}})
    try{if(signal.aborted)throw new Error('已停止');return await fn(s)}finally{this.service.close(s.id)}
  }
  async run(callId:string,hostId:string,kind:string,signal:AbortSignal,args:{command?:string;cwd?:string;path?:string;localPath?:string;workspaceRoot?:string;overwrite?:boolean;oldText?:string;newText?:string;version?:string}):Promise<string>{
    const host=await this.hosts.get(hostId)
    const record:Operation={callId,hostId,target:`${host.name} · ${host.username}@${host.host}:${host.port}`,kind,output:'',state:'running',...(args.path?{path:args.path}:{}),...(args.localPath?{localPath:args.localPath}:{}),...(args.command?{command:args.command}:{})}
    for(const [id,r] of this.records){if(this.records.size<100)break;if(r.state!=='running')this.records.delete(id)}
    if(this.records.size>=100)throw new Error('操作过多，请稍后再试')
    this.records.set(callId,record)
    try{
      let uploadSource:{path:string;size:number}|undefined
      if(kind==='upload'){
        if(!args.workspaceRoot)throw new Error('当前会话没有工作区，无法定位本地文件')
        const root=await realpath(args.workspaceRoot), candidate=resolve(root,args.localPath??''), local=await realpath(candidate)
        const within=relative(root,local)
        if(within.startsWith('..')||isAbsolute(within))throw new Error('只能上传当前工作区内的文件')
        const info=await stat(local)
        if(!info.isFile())throw new Error('只能上传普通文件')
        if(info.size>2*1024*1024*1024)throw new Error('单个文件不能超过 2 GB')
        uploadSource={path:local,size:info.size};record.totalBytes=info.size;record.bytesTransferred=0
      }
      const result=await this.withSession(host,signal,async s=>{
        if(kind==='exec')return JSON.stringify(await remoteExec(s.client,args.command!,args.cwd!,signal,text=>{record.output=(record.output+text).slice(-32000)}))
        if(kind==='read')return JSON.stringify(await this.service.readText(s.id,args.path!))
        if(kind==='upload'){
          const source=createReadStream(uploadSource!.path),hash=createHash('sha256'),started=Date.now()
          const abort=()=>source.destroy(new Error('已停止'))
          signal.addEventListener('abort',abort,{once:true})
          source.on('data',(chunk)=>hash.update(typeof chunk === 'string' ? Buffer.from(chunk) : chunk))
          try{
            await this.service.upload(s.id,args.path!,source,bytes=>{const seconds=Math.max(.001,(Date.now()-started)/1000);record.bytesTransferred=bytes;record.speedBytesPerSecond=Math.round(bytes/seconds)},args.overwrite===true)
            if(signal.aborted)throw new Error('已停止')
            return JSON.stringify({path:args.path,localPath:args.localPath,overwrite:args.overwrite===true,bytes:uploadSource!.size,sha256:hash.digest('hex'),message:args.overwrite?'文件已通过临时文件原子替换。请继续校验校验和并执行服务健康检查。':'文件已通过 SFTP 直接上传。请继续校验校验和，再执行备份、替换和服务健康检查。'})
          }finally{signal.removeEventListener('abort',abort)}
        }
        const current=await this.service.readText(s.id,args.path!)
        if(current.version!==args.version||current.text!==args.oldText)throw new Error('文件已变化，请重新读取并核对差异')
        if(signal.aborted)throw new Error('已停止，未修改文件')
        const backup=args.path+'.dsh-backup-'+randomUUID()
        await this.service.upload(s.id,backup,Readable.from([Buffer.from(current.text)]))
        await new Promise<void>((resolve,reject)=>s.sftp.chmod(backup,current.mode,e=>e?reject(e):resolve()))
        if(signal.aborted)throw new Error('已停止，原文件未修改；备份：'+backup)
        try {const saved=await this.service.saveText(s.id,args.path!,args.newText!,current.version);return JSON.stringify({backup,...saved,message:'文件已保存。尚未验证服务，请执行配置检查和健康检查。'})}
        catch(e){throw new Error(String(e)+'；备份：'+backup)}
      })
      record.state='completed';record.result=result;return JSON.stringify({hostId,target:record.target,...JSON.parse(result)})
    }catch(e){record.state='failed';record.result=String(e);throw e}
  }
}
