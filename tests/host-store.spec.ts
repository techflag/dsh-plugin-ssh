import {it,expect} from 'vitest'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {HostStore,hostId} from '../src/host-store.ts'
it('shares persisted hosts without accepting credential fields',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ssh-hosts-'))
 try{
 const store=new HostStore(dir),host={host:'test.example',port:22,username:'test',name:'testing',password:'never-persist',privateKey:'never-persist'}
 await store.save([host]);expect((await new HostStore(dir).get(hostId(host))).name).toBe('testing')
 expect(await readFile(join(dir,'hosts.json'),'utf8')).not.toContain('never-persist')
 await expect(store.save([{...host,port:0}])).rejects.toThrow();expect(await store.list()).toHaveLength(1)
 await store.save([]);expect(await store.list()).toEqual([])
 }finally{await rm(dir,{recursive:true,force:true})}
})
