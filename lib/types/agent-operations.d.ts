import { HostStore, type SavedHost } from './host-store.ts';
import { PasswordStore } from './password-store.ts';
import { SshService, type SshSession } from './ssh-service.ts';
export interface Operation {
    callId: string;
    hostId: string;
    target: string;
    kind: string;
    path?: string;
    localPath?: string;
    command?: string;
    output: string;
    state: 'running' | 'completed' | 'failed';
    result?: string;
    bytesTransferred?: number;
    totalBytes?: number;
    speedBytesPerSecond?: number;
}
export declare class AgentOperations {
    readonly hosts: HostStore;
    readonly passwords: PasswordStore;
    readonly service: SshService;
    readonly records: Map<string, Operation>;
    constructor(hosts: HostStore, passwords: PasswordStore, service: SshService);
    withSession<T>(host: SavedHost, signal: AbortSignal, fn: (session: SshSession) => Promise<T>): Promise<T>;
    run(callId: string, hostId: string, kind: string, signal: AbortSignal, args: {
        command?: string;
        cwd?: string;
        path?: string;
        localPath?: string;
        workspaceRoot?: string;
        overwrite?: boolean;
        oldText?: string;
        newText?: string;
        version?: string;
    }): Promise<string>;
}
