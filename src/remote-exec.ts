import type { Client, ClientChannel } from 'ssh2'
export interface ExecResult { stdout:string;stderr:string;exitCode:number|null;durationMs:number;stopped:boolean;truncated:boolean }
/** A separate SSH exec channel never shares the user's interactive shell state. No retries. */
export function remoteExec(client:Client,command:string,cwd:string,signal:AbortSignal,onOutput?:(text:string)=>void,timeoutMs=60000):Promise<ExecResult>{
  if(!command.trim()||command.length>16000||command.includes('\0')||!cwd.startsWith('/')||/[\x00-\x1f]/.test(cwd))throw new Error('命令或远程目录无效')
  if(signal.aborted)throw new Error('已停止')
  const quote=(s:string)=>"'"+s.replace(/'/g,"'\\''")+"'"
  return new Promise((resolve,reject)=>{
    const started=Date.now();let channel:ClientChannel|undefined,stdout='',stderr='',exitCode:number|null=null,stopped=false,truncated=false,done=false,size=0
    const timer=setTimeout(stop,timeoutMs)
    const finish=(error?:Error)=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',stop);client.off('close',lost);if(error)reject(error);else resolve({stdout,stderr,exitCode,durationMs:Date.now()-started,stopped,truncated})}
    function stop(){stopped=true;if(channel){channel.signal('TERM');channel.close();channel.destroy()}finish()}
    const lost=()=>finish(new Error('SSH 连接中断，执行结果未知；不会自动重试'))
    signal.addEventListener('abort',stop,{once:true});client.once('close',lost)
    client.exec(`cd -- ${quote(cwd)} || exit;\n${command}`, (error,stream)=>{
      if(done){stream?.destroy();return}
      if(error){finish(new Error('无法启动远程命令'));return}channel=stream
      const collect=(data:Buffer,isError:boolean)=>{const remaining=128*1024-size;if(remaining<=0){truncated=true;stop();return}const bytes=data.subarray(0,remaining);size+=bytes.length;const text=bytes.toString('utf8');if(isError)stderr+=text;else stdout+=text;onOutput?.(text);if(data.length>remaining){truncated=true;stop()}}
      stream.on('data',(b:Buffer)=>collect(b,false));stream.stderr.on('data',(b:Buffer)=>collect(b,true))
      stream.on('exit',(code:number|null)=>{exitCode=code});stream.on('close',()=>finish());stream.on('error',()=>finish(new Error('命令通道中断，执行结果未知')))
    })
  })
}
