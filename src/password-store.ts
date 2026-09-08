import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { validateTarget, type SshTarget } from './ssh-service.ts'
/** Local encryption; the per-user key is permission protected, not an OS keychain. */
export class PasswordStore {
  constructor(private dir = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'ssh-credentials')) {}
  private file(target: SshTarget) { validateTarget(target);return join(this.dir, createHash('sha256').update(JSON.stringify([target.host,target.port,target.username])).digest('hex')+'.enc') }
  private async key() {
    await mkdir(this.dir,{recursive:true,mode:0o700})
    const path=join(this.dir,'key')
    try { await writeFile(path,randomBytes(32),{flag:'wx',mode:0o600}) } catch(error) { if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error }
    return readFile(path)
  }
  async get(target:SshTarget):Promise<string|undefined> {
    let data:Buffer
    try {data=await readFile(this.file(target))} catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error}
    const decipher=createDecipheriv('aes-256-gcm',await this.key(),data.subarray(0,12));decipher.setAuthTag(data.subarray(12,28))
    return Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8')
  }
  async set(target:SshTarget,password:string) {
    if(typeof password!=='string' || !password || password.length>16000)throw new Error('密码无效')
    const file=this.file(target),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',await this.key(),iv)
    const encrypted=Buffer.concat([cipher.update(password,'utf8'),cipher.final()])
    const temp=file+'.'+randomBytes(8).toString('hex')
    try{await writeFile(temp,Buffer.concat([iv,cipher.getAuthTag(),encrypted]),{mode:0o600,flag:'wx'});await rename(temp,file)}finally{await unlink(temp).catch(()=>{})}
  }
  async remove(target:SshTarget){try{await unlink(this.file(target))}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}}
}
