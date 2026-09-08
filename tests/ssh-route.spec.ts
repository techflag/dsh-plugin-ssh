import { describe, expect, it } from 'vitest'
import { PassThrough } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute, WebUpgradeRoute } from '@deepseek-ai/dsh-host-webserver'
import { apply } from '../src/index.ts'

function fixture(rejection?: number) {
  let route: WebRoute | undefined, upgrade: WebUpgradeRoute | undefined
  const cleanup: Array<() => void> = []
  const ctx = {
    tools: { register: () => () => {} }, on: () => () => {},
    webServer: { port: 43120, register: (r: WebRoute) => { route = r; return () => {} }, registerUpgrade: (r: WebUpgradeRoute) => { upgrade = r; return () => {} } },
    connection: { requestRejection: () => rejection },
    effect: (fn: () => (() => void)) => { cleanup.push(fn()) },
  }
  apply(ctx as unknown as Context)
  return { route: route!, upgrade: upgrade!, dispose: () => cleanup.reverse().forEach(fn => fn()) }
}
async function request(f: ReturnType<typeof fixture>, path: string, method: string, value?: unknown, origin = 'http://127.0.0.1:43120') {
  const req = new PassThrough() as unknown as IncomingMessage
  Object.assign(req, { url: path, method, headers: { host: '127.0.0.1:43120', origin, 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' } })
  const result = { code: 200, headers: {} as Record<string, string>, text: '' }
  const res = { headersSent: false, destroyed: false, setHeader: (k: string, v: string) => { result.headers[k] = v }, writeHead: (n: number, headers?: Record<string,string>) => { result.code = n; Object.assign(result.headers, headers) }, end: (v?: string | Buffer) => { result.text = String(v ?? '') } } as unknown as ServerResponse
  req.push(value === undefined ? null : JSON.stringify(value)); if(value !== undefined) req.push(null)
  await f.route.handler(req, res); return result
}
describe('authenticated SSH carrier', () => {
  it('rejects unauthenticated and cross-origin actions before connecting', async () => {
    const denied = fixture(401), allowed = fixture()
    try {
      expect((await request(denied,'/ssh-workbench/probe','POST',{})).code).toBe(403)
      expect((await request(allowed,'/ssh-workbench/probe','POST',{},'https://evil.example')).code).toBe(403)
      expect((await request(allowed,'/ssh-workbench/connect','POST',{})).code).toBe(400)
    } finally { denied.dispose(); allowed.dispose() }
  })
  it('redirects the asset base and rejects resource traversal and unsupported methods', async () => {
    const f=fixture()
    try {
      const redirect=await request(f,'/ssh-workbench','GET');expect(redirect.code).toBe(302);expect(redirect.headers.location).toBe('/ssh-workbench/')
      expect((await request(f,'/ssh-workbench/','GET')).text).toContain('ssh-root')
      expect((await request(f,'/ssh-workbench/assets/foo%2fbar.js','GET')).code).toBe(404)
      expect((await request(f,'/ssh-workbench/list','GET')).code).toBe(405)
      expect((await request(f,'/ssh-workbench/list','POST',{id:'unknown',path:'/'})).code).toBe(400)
    } finally { f.dispose() }
  })
})
