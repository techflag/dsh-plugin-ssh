// Exercise an installed tarball with the official CLI; never use the user's DSH_HOME.
import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import assert from 'node:assert/strict'
const [cliArg, archiveArg]=process.argv.slice(2)
if(!cliArg||!archiveArg)throw new Error('Usage: node scripts/smoke-install.mjs /path/to/@deepseek-ai/dsh/lib/bin.js /path/to/plugin.tgz')
const cli=resolve(cliArg),archive=resolve(archiveArg),home=await mkdtemp(join(tmpdir(),'dsh-ssh-install-smoke-'))
const env={...process.env,DSH_HOME:home}
const run=(args)=>execFileSync(process.execPath,[cli,...args],{env,encoding:'utf8',timeout:120000,stdio:['ignore','pipe','pipe']})
let child
try{
  run(['plugin','--profile','web','add',archive,'--ignore-scripts'])
  assert.match(run(['--profile','web','--dump-config']),/dsh-plugin-ssh/)
  child=spawn(process.execPath,[cli,'web','--no-open','--port','0'],{env,stdio:['ignore','pipe','pipe']})
  const url=await new Promise((resolveUrl,reject)=>{let output='';const timeout=setTimeout(()=>reject(new Error('Harness did not announce readiness')),30000);child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Harness exited: ${code}`))});child.stderr.on('data',()=>{});child.stdout.on('data',data=>{output+=data;const match=output.match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/[^\s]*)/);if(match){clearTimeout(timeout);resolveUrl(match[1])}})})
  const origin=new URL(url).origin
  const auth=await fetch(url,{redirect:'manual'}),cookie=auth.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')
  const headers={cookie},root=await fetch(origin+'/ssh-workbench/',{headers})
  assert.equal(root.status,200);const html=await root.text();assert.match(html,/ssh-root/)
  for(const asset of html.matchAll(/(?:src|href)="(\.\/assets\/[^\"]+)"/g)){
    const res=await fetch(new URL(asset[1],origin+'/ssh-workbench/'),{headers});assert.equal(res.status,200);assert.ok((await res.arrayBuffer()).byteLength>0)
  }
  const index=await (await fetch(origin+'/',{headers})).text();assert.match(index,/dsh-plugin-ssh/)
  const post=async(path,originHeader=origin)=>fetch(origin+'/ssh-workbench/'+path,{method:'POST',headers:{...headers,origin:originHeader,'content-type':'application/json'},body:'{}'})
  assert.equal((await post('models')).status,200)
  assert.equal((await post('connect','https://untrusted.example')).status,403)
  assert.equal((await post('connect')).status,400)
  console.log('PASS: install, bundle composition, authenticated page/assets, client graph, model list, origin fence, validation')
}finally{
  if(child&&child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await Promise.race([stopped,new Promise(r=>setTimeout(r,3000))]);if(child.exitCode===null)child.kill('SIGKILL')}
  try{run(['plugin','--profile','web','remove','dsh-plugin-ssh']);assert.doesNotMatch(run(['--profile','web','--dump-config']),/name: dsh-plugin-ssh/);console.log('PASS: uninstall removes bundle')}finally{await rm(home,{recursive:true,force:true})}
}
