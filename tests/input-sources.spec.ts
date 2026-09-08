import {expect,it,vi} from 'vitest'
import {createSshInputSources,serializeHost} from '../src/input-sources.ts'

const host={id:'a'.repeat(24),name:'生产机',host:'10.0.0.1',port:22,username:'deploy'}

it('registers a structured server reference and an ssh launcher command',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify([host]),{status:200})))
  const open=vi.fn(),[reference,legacy,command]=createSshInputSources(open)
  const candidates=await reference!.candidates({sessionId:'session' as never},{query:'生产',position:'inline',drilled:false,signal:new AbortController().signal})
  expect(candidates).toEqual([{name:'生产机',description:'deploy@10.0.0.1:22',value:host.id}])
  expect(reference!.onPick({candidate:candidates[0]!,session:{sessionId:'session' as never},position:'inline',via:'menu',action:'pick',span:{start:0,end:4,draftRev:1}})).toEqual({insert:{source:'服务器',ref:host.id,label:'生产机',clipboardText:'@服务器/生产机'}})
  expect(await legacy!.codec!.serialize(host.id,new AbortController().signal)).toContain('deploy@10.0.0.1:22')
  expect(serializeHost(host)).toContain('"hostId":"aaaaaaaaaaaaaaaaaaaaaaaa"')
  expect(serializeHost(host)).toContain('dsh_ssh_upload')
  expect(serializeHost(host)).toContain('不要上传到公网临时文件服务')
  expect(command!.matchSpace?.({sessionId:'session' as never},'/ssh')).toEqual({text:''})
  expect(open).toHaveBeenCalledOnce()
  vi.unstubAllGlobals()
})
