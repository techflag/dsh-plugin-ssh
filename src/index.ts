import { HostStore } from './host-store.ts'
import { AgentOperations } from './agent-operations.ts'
import { installAgentTools } from './agent-tools.ts'
import { PasswordStore } from './password-store.ts'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-session'
import { SshAiError, sshAiAnswer, validateAiRequest } from './ssh-ai.ts'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename } from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'
import { SshService, type SshCredentials, type SshTarget } from './ssh-service.ts'

export const name = 'dsh-ssh'
export const inject = ['webServer', 'connection', 'llm', 'tools', 'sessions']
const ROOT = '/ssh-workbench'
const MAX_BODY = 128 * 1024
/** Additional local-only fence: no SSH proxy exposed when Harness enables LAN browsing. */
export function sshRequestAllowed(req: IncomingMessage, port: number, write: boolean): boolean {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) return false
  const expected = `http://127.0.0.1:${port}`
  if (req.headers.host !== `127.0.0.1:${port}`) return false
  return !write || req.headers.origin === expected
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new Error('需要 JSON 请求')
  const chunks: Buffer[] = []; let bytes = 0
  for await (const data of req) { const b = Buffer.from(data); bytes += b.length; if (bytes > MAX_BODY) throw new Error('请求过大'); chunks.push(b) }
  const result: unknown = JSON.parse(Buffer.concat(chunks).toString())
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('请求无效')
  return result as Record<string, unknown>
}
function json(res: ServerResponse, code: number, data: unknown): void { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)) }
/** Installable Host plugin using the existing authenticated carrier. */
export function apply(ctx: Context): void {
  if (typeof ctx.connection.requestRejection !== 'function') throw new Error('DSH SSH requires DeepSeek Harness 0.1.2-rc.1 or newer')
  const service = new SshService()
  const passwords = new PasswordStore()
  const hosts = new HostStore()
  const operations = new AgentOperations(hosts,passwords,service)
  installAgentTools(ctx,operations)
  const aiCalls = new Map<string, AbortController>()
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024, perMessageDeflate: false })
  ctx.effect(() => () => { for (const call of aiCalls.values()) call.abort(); service.dispose(); for (const client of sockets.clients) client.terminate(); sockets.close() }, 'ssh: generation cleanup')
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: ROOT, handler: async (req, res) => {
    if (!sshRequestAllowed(req, ctx.webServer.port, req.method !== 'GET') || ctx.connection.requestRejection(req) !== undefined) { json(res, 403, { error: '访问被拒绝' }); return }
    res.setHeader('x-content-type-options', 'nosniff')
    const url = new URL(req.url ?? ROOT, `http://127.0.0.1:${ctx.webServer.port}`)
    try {
      if (req.method === 'GET' && url.pathname === ROOT) { res.writeHead(302, { location: ROOT + '/' }); res.end(); return }
      if (req.method === 'GET' && (url.pathname === ROOT || url.pathname === ROOT + '/')) {
        res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'")
        res.setHeader('content-type', 'text/html; charset=utf-8'); res.setHeader('cache-control', 'no-store')
        res.end(await readFile(new URL('./ui/index.html', import.meta.url))); return
      }
      if (req.method === 'GET' && url.pathname.startsWith(ROOT + '/assets/')) {
        const file = url.pathname.slice((ROOT + '/assets/').length)
        if (!/^[A-Za-z0-9_.-]+\.(js|css)$/.test(file)) { json(res, 404, { error: '资源不存在' }); return }
        res.setHeader('content-type', file.endsWith('.js') ? 'application/javascript' : 'text/css')
        res.end(await readFile(new URL('./ui/assets/' + file, import.meta.url))); return
      }
      if (req.method !== 'POST') { json(res, 405, { error: '请求方式无效' }); return }
      if (url.pathname === ROOT + '/upload') {
        await service.upload(url.searchParams.get('id') ?? '', url.searchParams.get('path') ?? '', req, undefined, url.searchParams.get('overwrite') === '1')
        json(res, 200, { ok: true }); return
      }
      const data = await body(req)
      if(url.pathname===ROOT+'/hosts'){json(res,200,await hosts.list());return}
      if(url.pathname===ROOT+'/hosts-save'){await hosts.save(data.hosts);json(res,200,{ok:true});return}
      if(url.pathname===ROOT+'/operation'){json(res,200,operations.records.get(String(data.callId))??null);return}
      if (url.pathname === ROOT + '/password-status') { json(res,200,{saved:!!await passwords.get(data as unknown as SshTarget)});return }
      if (url.pathname === ROOT + '/password-save') { await passwords.set(data as unknown as SshTarget,data.password as string);json(res,200,{ok:true});return }
      if (url.pathname === ROOT + '/password-delete') { await passwords.remove(data as unknown as SshTarget);json(res,200,{ok:true});return }
      if (url.pathname === ROOT + '/probe') { json(res, 200, { fingerprint: await service.probe(data as unknown as SshTarget) }); return }
      if (url.pathname === ROOT + '/connect') {
        const credentials = {...data} as unknown as SshCredentials
        if(data.useSavedPassword===true && !credentials.password && !credentials.privateKey) {
          credentials.password=await passwords.get(credentials)
          if(!credentials.password)throw new Error('未保存密码，请编辑主机并填写密码')
        }
        const s = await service.connect(credentials)
        let path: string
        try { path = await service.home(s.id) } catch { service.close(s.id); throw new Error('无法打开 SFTP 工作目录') }
        json(res, 200, { id: s.id, target: s.target, path }); return
      }
      if (url.pathname === ROOT + '/models') {
        const providers = ctx.llm.listProviders()
        const models = await Promise.all(providers.map(async p => ({ ...p, models: await ctx.llm.listModels(p.id).catch(() => []) })))
        json(res, 200, models); return
      }
      const id = typeof data.id === 'string' ? data.id : ''
      if (url.pathname === ROOT + '/close') { aiCalls.get(id)?.abort(); service.close(id); json(res, 200, { ok: true }); return }
      if (url.pathname === ROOT + '/ai') {
        const session = service.get(id), request = validateAiRequest(data)
        if (aiCalls.has(id)) throw new Error('当前会话已有 AI 请求')
        const call = new AbortController(); aiCalls.set(id, call)
        const timer = setTimeout(() => call.abort(), 120000); timer.unref()
        const abort = () => call.abort(); res.once('close', abort); session.shell.once('close', abort)
        res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' })
        try {
          let size = 0
          for await (const text of sshAiAnswer(ctx.llm, session.target, request, call.signal)) {
            if (call.signal.aborted || res.destroyed) break
            size += text.length
            if (size > 64000 || res.writableLength > 256 * 1024) { call.abort(); throw new Error('AI 输出超限') }
            res.write(JSON.stringify({ text }) + '\n')
          }
          if (!res.destroyed) res.end(JSON.stringify(call.signal.aborted ? { error: '请求已停止或超时' } : { done: true }) + '\n')
        } catch (error) { if (!res.destroyed) res.end(JSON.stringify({ error: error instanceof SshAiError ? error.message : 'AI 请求失败，请检查模型服务配置或网络' }) + '\n') }
        finally { clearTimeout(timer); res.off('close',abort); session.shell.off('close',abort); aiCalls.delete(id) }
        return
      }
      if (url.pathname === ROOT + '/read-text') { json(res,200,await service.readText(id,data.path as string)); return }
      if (url.pathname === ROOT + '/save-text') { json(res,200,await service.saveText(id,data.path as string,data.text as string,data.version as string)); return }
      if (url.pathname === ROOT + '/list') { json(res, 200, await service.list(id, data.path as string)); return }
      if (url.pathname === ROOT + '/download') {
        const path = data.path as string
        if (typeof path !== 'string') throw new Error('文件路径无效')
        res.setHeader('content-type', 'application/octet-stream')
        res.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(basename(path))}`)
        await service.download(id, path, res); return
      }
      json(res, 404, { error: '操作不存在' })
    } catch (error) {
      if (!res.headersSent && !res.destroyed) json(res, 400, { error: error instanceof Error && !('code' in error) ? error.message : '操作失败，请检查路径和连接' })
      else res.destroy()
    }
  } }), 'ssh: HTTP routes')
  ctx.effect(() => ctx.webServer.registerUpgrade({ path: ROOT + '/terminal', handler: (req, socket, head) => {
    if (!sshRequestAllowed(req, ctx.webServer.port, true) || ctx.connection.requestRejection(req) !== undefined) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return }
    const id = new URL(req.url ?? '', 'http://127.0.0.1').searchParams.get('id') ?? ''
    try { if (service.get(id).observer) throw new Error('already attached') } catch { socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return }
    sockets.handleUpgrade(req, socket, head, ws => {
      ws.on('error', () => service.close(id)); ws.on('close', () => service.close(id))
      ws.on('message', (message, binary) => {
        try {
          if (binary) throw new Error('invalid input')
          const value = JSON.parse(message.toString()) as { type: string; data: string; cols: number; rows: number }
          if (value.type === 'input') service.write(id, value.data)
          else if (value.type === 'resize') service.resize(id, value.cols, value.rows)
          else throw new Error('invalid message')
        } catch { ws.close(1008, 'invalid terminal message') }
      })
      service.attach(id, {
        data: data => { if (ws.bufferedAmount > 1024 * 1024) { ws.close(1009, 'terminal output backlog'); service.close(id) } else if (ws.readyState === WebSocket.OPEN) ws.send(data) },
        closed: () => { if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'SSH closed') },
      })
    })
  } }), 'ssh: terminal upgrade')
}
