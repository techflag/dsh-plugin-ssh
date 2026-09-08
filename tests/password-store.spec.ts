import { expect,it } from 'vitest'
import { mkdtemp,rm,readdir,readFile,stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PasswordStore } from '../src/password-store.ts'
it('persists encrypted passwords by endpoint and user, supports replacement and removal',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ssh-vault-test-')),target={host:'example.test',port:22,username:'test'}
 try {
  const store=new PasswordStore(dir)
  expect(await store.get(target)).toBeUndefined()
  await store.set(target,'test-secret-123')
  expect(await new PasswordStore(dir).get(target)).toBe('test-secret-123')
  expect(await store.get({...target,username:'other'})).toBeUndefined()
  expect(await store.get({...target,port:2222})).toBeUndefined()
  for(const file of await readdir(dir)) {
   expect((await readFile(join(dir,file))).includes(Buffer.from('test-secret-123'))).toBe(false)
   if(process.platform!=='win32')expect((await stat(join(dir,file))).mode & 0o777).toBe(0o600)
  }
  await store.set(target,'replacement');expect(await store.get(target)).toBe('replacement')
  await store.remove(target);await store.remove(target);expect(await store.get(target)).toBeUndefined()
 } finally{await rm(dir,{recursive:true,force:true})}
})
