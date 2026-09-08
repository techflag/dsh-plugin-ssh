import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { posix } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable, Transform, Writable } from 'node:stream'
import { Client, type ClientChannel, type SFTPWrapper } from 'ssh2'

export interface SshTarget { host: string; port: number; username: string }
export interface SshCredentials extends SshTarget { fingerprint: string; password?: string; privateKey?: string; passphrase?: string }
export interface SshFile { name: string; directory: boolean; size: number; modified: number }
export interface SshOutput { data: (data: Buffer) => void; closed: () => void }
export interface SshSession {
  id: string; target: SshTarget; client: Client; shell: ClientChannel; sftp: SFTPWrapper;
  buffered: Buffer[]; bytes: number; observer?: SshOutput; closed: boolean;
}
const LIMIT = 1024 * 1024
const EDITABLE_TEXT_LIMIT = 64 * 1024
const TEXT_PREVIEW_LIMIT = 512 * 1024
export function fingerprint(key: Buffer): string { return 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '') }
export function validateTarget(target: SshTarget): void {
  if (typeof target.host !== 'string' || !target.host.trim() || target.host.length > 253 || /[\s/\x00-\x1f]/.test(target.host)) throw new Error('主机地址无效')
  if (!Number.isInteger(target.port) || target.port < 1 || target.port > 65535) throw new Error('端口无效')
  if (typeof target.username !== 'string' || !target.username.trim() || target.username.length > 128 || /[\x00-\x1f]/.test(target.username)) throw new Error('用户名无效')
}
export function remotePath(value: string): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.includes('\0') || value.length > 4096) throw new Error('需要有效的远程绝对路径')
  return posix.normalize(value)
}
function safeFingerprint(actual: string, expected: string): boolean {
  const a = Buffer.from(actual), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
/** Generation-owned SSH sessions. Credentials are never persisted or returned. */
export class SshService {
  readonly sessions = new Map<string, SshSession>()
  private readonly pending = new Set<Client>()
  private disposed = false
  private makeClient(): Client {
    if (this.disposed) throw new Error('SSH 服务已关闭')
    if (this.pending.size + this.sessions.size >= 12) throw new Error('最多同时打开 12 个连接')
    const client = new Client(); this.pending.add(client); return client
  }
  async probe(target: SshTarget): Promise<string> {
    validateTarget(target)
    const client = this.makeClient()
    return new Promise((resolve, reject) => {
      let key = '', finished = false
      const finish = (error?: Error) => {
        if (finished) return; finished = true; this.pending.delete(client); client.destroy()
        if (key) resolve(key); else reject(error ?? new Error('未获得主机指纹'))
      }
      client.on('error', error => finish(error)); client.on('close', () => finish())
      try { client.connect({ ...target, readyTimeout: 10000, hostVerifier: (raw: Buffer) => { key = fingerprint(raw); return false } }) } catch { finish(new Error('无法连接目标主机')) }
    })
  }
  async connect(credentials: SshCredentials): Promise<SshSession> {
    validateTarget(credentials)
    if (typeof credentials.fingerprint !== 'string' || !/^SHA256:[A-Za-z0-9+/]{43}$/.test(credentials.fingerprint)) throw new Error('请先核对主机指纹')
    if (!credentials.password && !credentials.privateKey) throw new Error('请输入密码或私钥')
    const client = this.makeClient()
    return new Promise((resolve, reject) => {
      let ready = false, changed = false, settled = false
      const timeout = setTimeout(() => fail(), 20000); timeout.unref()
      const fail = () => { if (!settled) { settled = true; clearTimeout(timeout); this.pending.delete(client); client.destroy(); reject(new Error(changed ? '主机指纹不匹配，连接已阻止' : 'SSH 连接失败，请检查认证和网络')) } }
      client.on('error', () => { if (ready) { const s = [...this.sessions.values()].find(s => s.client === client); if (s) this.close(s.id) } else fail() })
      client.on('close', () => { if (!ready) fail() })
      client.on('ready', () => {
        client.shell({ term: 'xterm-256color', cols: 100, rows: 30 }, (error, shell) => {
          if (error || settled || this.disposed) { fail(); return }
          client.sftp((error, sftp) => {
            if (error || this.disposed || settled) { fail(); return }
            ready = true; settled = true; clearTimeout(timeout); this.pending.delete(client)
            const session: SshSession = { id: randomUUID(), target: { host: credentials.host, port: credentials.port, username: credentials.username }, client, shell, sftp, buffered: [], bytes: 0, closed: false }
            this.sessions.set(session.id, session)
            const output = (data: Buffer) => {
              if (session.closed) return
              if (session.observer) session.observer.data(data)
              else { session.bytes += data.length; if (session.bytes > LIMIT) { this.close(session.id); return }; session.buffered.push(Buffer.from(data)) }
            }
            shell.on('data', output); shell.stderr.on('data', output)
            sftp.on('error', () => this.close(session.id))
            shell.on('close', () => this.close(session.id)); shell.on('error', () => this.close(session.id))
            client.on('close', () => this.close(session.id))
            const timer = setTimeout(() => { if (!session.observer) this.close(session.id) }, 15000); timer.unref()
            shell.once('close', () => clearTimeout(timer))
            resolve(session)
          })
        })
      })
      try {
        client.connect({ host: credentials.host, port: credentials.port, username: credentials.username,
          ...(credentials.privateKey ? { privateKey: credentials.privateKey, ...(credentials.passphrase ? { passphrase: credentials.passphrase } : {}) } : { password: credentials.password! }),
          readyTimeout: 15000, keepaliveInterval: 15000, keepaliveCountMax: 3,
          hostVerifier: (raw: Buffer) => { changed = !safeFingerprint(fingerprint(raw), credentials.fingerprint); return !changed },
        })
      } catch { fail() }
    })
  }
  get(id: string): SshSession { const s = this.sessions.get(id); if (!s || s.closed) throw new Error('连接已关闭'); return s }
  attach(id: string, observer: SshOutput): void {
    const s = this.get(id); if (s.observer) throw new Error('终端已有连接')
    s.observer = observer; for (const b of s.buffered) observer.data(b); s.buffered = []; s.bytes = 0
  }
  write(id: string, data: string): void {
    if (typeof data !== 'string' || Buffer.byteLength(data) > 65536) throw new Error('输入过大')
    const s = this.get(id); if (s.shell.writableLength > LIMIT) { this.close(id); throw new Error('终端输入积压，连接已关闭') }; s.shell.write(data)
  }
  resize(id: string, cols: number, rows: number): void {
    if (![cols, rows].every(n => Number.isInteger(n) && n >= 2 && n <= 1000)) throw new Error('终端尺寸无效')
    this.get(id).shell.setWindow(rows, cols, 0, 0)
  }
  async list(id: string, path: string): Promise<SshFile[]> {
    const s = this.get(id), dir = remotePath(path)
    return new Promise((resolve, reject) => s.sftp.readdir(dir, (error, rows) => error ? reject(new Error('无法读取目录')) : resolve(rows.filter(r => r.filename !== '.' && r.filename !== '..').map(r => ({ name: r.filename, directory: r.attrs.isDirectory(), size: r.attrs.size, modified: r.attrs.mtime })))))
  }
  async home(id: string): Promise<string> {
    return new Promise((resolve, reject) => this.get(id).sftp.realpath('.', (error, path) => error ? reject(new Error('无法定位工作目录')) : resolve(path)))
  }
  /** Create exclusively, or replace atomically through a sibling temporary file. */
  async upload(id: string, path: string, source: Readable, onProgress?: (bytes: number) => void, overwrite = false): Promise<void> {
    const s = this.get(id), target = remotePath(path)
    const temporary = target + '.dsh-upload-' + randomUUID() + '.tmp'
    source.pause()
    let handle: Buffer
    try {
      handle = await new Promise<Buffer>((resolve, reject) => s.sftp.open(temporary, 'w', { mode: 0o600 }, (error, value) => error ? reject(error) : resolve(value)))
    } catch { throw new Error('上传失败：请检查同名文件、权限或连接') }
    let position = 0, closed = false
    const closeHandle = () => new Promise<void>(resolve => {
      if (closed) { resolve(); return }
      s.sftp.close(handle, () => { closed = true; resolve() })
    })
    const output = new Writable({
      write(chunk: Buffer, _encoding, done) {
        const data = Buffer.from(chunk), offset = position
        s.sftp.write(handle, data, 0, data.length, offset, error => {
          if (!error) position += data.length
          done(error)
        })
      },
      final(done) { s.sftp.close(handle, error => { closed = true; done(error) }) },
    })
    let bytes = 0
    const progress = new Transform({ transform(chunk: Buffer, _encoding, done) { bytes += chunk.length; onProgress?.(bytes); done(null, chunk) } })
    try { await pipeline(source, progress, output) } catch {
      await closeHandle()
      await new Promise<void>(resolve => s.sftp.unlink(temporary, () => resolve()))
      throw new Error('上传失败：请检查同名文件、权限或连接')
    }
    try {
      if (!overwrite) {
        const exists = await new Promise<boolean>(resolve => s.sftp.lstat(target, error => resolve(!error)))
        if (exists) throw new Error('目标文件已存在')
        await new Promise<void>((resolve, reject) => s.sftp.rename(temporary, target, error => error ? reject(error) : resolve()))
        return
      }
      let mode = 0o600
      try { mode = (await new Promise<import('ssh2').Stats>((resolve,reject) => s.sftp.lstat(target,(error,attrs)=>error?reject(error):resolve(attrs)))).mode & 0o777 } catch { /* New destination keeps the private default mode. */ }
      await new Promise<void>((resolve,reject) => s.sftp.chmod(temporary,mode,error=>error?reject(error):resolve()))
      await new Promise<void>((resolve,reject) => s.sftp.ext_openssh_rename(temporary,target,error=>error?reject(new Error('服务器不支持安全替换，原文件未改')):resolve()))
    } catch (error) {
      if (error instanceof Error && error.message === '目标文件已存在') throw new Error('上传失败：目标文件已存在，请确认是否替换')
      if (error instanceof Error && error.message.includes('服务器不支持安全替换')) throw error
      throw new Error('上传失败：请检查同名文件、权限或连接')
    } finally { await new Promise<void>(resolve => s.sftp.unlink(temporary,() => resolve())) }
  }
  async download(id: string, path: string, destination: Writable): Promise<void> {
    const s = this.get(id); let bytes = 0
    const limit = new Transform({ transform(chunk: Buffer, _encoding, done) { bytes += chunk.length; if (bytes > 32 * 1024 * 1024) done(new Error('下载超过 32 MB')); else done(null, chunk) } })
    await pipeline(s.sftp.createReadStream(remotePath(path)), limit, destination)
  }
  async readText(id: string, path: string): Promise<{ text: string; version: string; mode: number; size: number; editable: boolean; truncated: boolean }> {
    const s = this.get(id), target = remotePath(path)
    const attrs = await new Promise<import('ssh2').Stats>((resolve, reject) => s.sftp.lstat(target, (error, attrs) => error ? reject(new Error('无法读取文件')) : resolve(attrs)))
    if (!attrs.isFile()) throw new Error('只能预览普通文件')
    const editable = attrs.size <= EDITABLE_TEXT_LIMIT, truncated = attrs.size > TEXT_PREVIEW_LIMIT
    // Large operational logs remain useful when the editor cannot safely rewrite them. Read a
    // bounded tail and include a few overlap bytes so a multi-byte UTF-8 character can be recovered.
    const start = truncated ? Math.max(0, attrs.size - TEXT_PREVIEW_LIMIT - 4) : 0
    const chunks: Buffer[] = []; let bytes = 0
    await pipeline(s.sftp.createReadStream(target, start ? { start } : undefined), new Writable({ write(data: Buffer, _encoding, done) { bytes += data.length; if (bytes > TEXT_PREVIEW_LIMIT + 4) { done(new Error('文本预览超过上限')); return }; chunks.push(Buffer.from(data)); done() } }))
    let content = Buffer.concat(chunks)
    if (content.includes(0)) throw new Error('二进制文件请使用下载')
    let text: string
    try {
      let decoded: string | undefined
      for (let offset = 0; offset <= Math.min(4, content.length); offset++) {
        try { decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(content.subarray(offset)); break } catch { /* Try after a partial leading code point. */ }
      }
      if (decoded === undefined) throw new Error()
      text = decoded
    } catch { throw new Error('文件不是 UTF-8 编码') }
    if (truncated) {
      const firstLine = text.indexOf('\n')
      if (firstLine >= 0) text = text.slice(firstLine + 1)
      content = Buffer.from(text)
    }
    return { text, version: createHash('sha256').update(content).digest('hex'), mode: attrs.mode & 0o777, size: attrs.size, editable, truncated }
  }
  /** Check for external edits, then use the server's atomic rename extension. */
  async saveText(id: string, path: string, text: string, version: string): Promise<{ version: string }> {
    if (typeof text !== 'string' || Buffer.byteLength(text) > 65536 || typeof version !== 'string' || !/^[a-f0-9]{64}$/.test(version)) throw new Error('保存内容或文件版本无效')
    const s = this.get(id), target = remotePath(path), current = await this.readText(id,target)
    if (current.version !== version) throw new Error('远程文件已被修改，请重新打开后合并')
    const temporary = target + '.dsh-' + randomUUID() + '.tmp'
    await this.upload(id,temporary,Readable.from([Buffer.from(text)]))
    try {
      await new Promise<void>((resolve,reject) => s.sftp.chmod(temporary,current.mode,error => error ? reject(error) : resolve()))
      if ((await this.readText(id,target)).version !== version) throw new Error('远程文件已被修改，请重新打开后合并')
      await new Promise<void>((resolve,reject) => s.sftp.ext_openssh_rename(temporary,target,error => error ? reject(new Error('服务器无法原子替换文件，原文件未改')) : resolve()))
      return { version: createHash('sha256').update(text).digest('hex') }
    } finally { await new Promise<void>(resolve => s.sftp.unlink(temporary,() => resolve())) }
  }
  close(id: string): void {
    const s = this.sessions.get(id); if (!s || s.closed) return
    s.closed = true; this.sessions.delete(id); s.buffered = []; s.bytes = 0
    s.observer?.closed(); s.shell.destroy(); s.sftp.end(); s.client.destroy()
  }
  dispose(): void { this.disposed = true; for (const client of this.pending) client.destroy(); this.pending.clear(); for (const id of this.sessions.keys()) this.close(id) }
}
