import { Readable, Writable } from 'node:stream';
import { Client, type ClientChannel, type SFTPWrapper } from 'ssh2';
export interface SshTarget {
    host: string;
    port: number;
    username: string;
}
export interface SshCredentials extends SshTarget {
    fingerprint: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
}
export interface SshFile {
    name: string;
    directory: boolean;
    size: number;
    modified: number;
}
export interface SshOutput {
    data: (data: Buffer) => void;
    closed: () => void;
}
export interface SshSession {
    id: string;
    target: SshTarget;
    client: Client;
    shell: ClientChannel;
    sftp: SFTPWrapper;
    buffered: Buffer[];
    bytes: number;
    observer?: SshOutput;
    closed: boolean;
}
export declare function fingerprint(key: Buffer): string;
export declare function validateTarget(target: SshTarget): void;
export declare function remotePath(value: string): string;
/** Generation-owned SSH sessions. Credentials are never persisted or returned. */
export declare class SshService {
    readonly sessions: Map<string, SshSession>;
    private readonly pending;
    private disposed;
    private makeClient;
    probe(target: SshTarget): Promise<string>;
    connect(credentials: SshCredentials): Promise<SshSession>;
    get(id: string): SshSession;
    attach(id: string, observer: SshOutput): void;
    write(id: string, data: string): void;
    resize(id: string, cols: number, rows: number): void;
    list(id: string, path: string): Promise<SshFile[]>;
    home(id: string): Promise<string>;
    /** Create exclusively, or replace atomically through a sibling temporary file. */
    upload(id: string, path: string, source: Readable, onProgress?: (bytes: number) => void, overwrite?: boolean): Promise<void>;
    download(id: string, path: string, destination: Writable): Promise<void>;
    readText(id: string, path: string): Promise<{
        text: string;
        version: string;
        mode: number;
    }>;
    /** Check for external edits, then use the server's atomic rename extension. */
    saveText(id: string, path: string, text: string, version: string): Promise<{
        version: string;
    }>;
    close(id: string): void;
    dispose(): void;
}
