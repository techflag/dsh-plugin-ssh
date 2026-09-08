import type { Client } from 'ssh2';
export interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    durationMs: number;
    stopped: boolean;
    truncated: boolean;
}
/** A separate SSH exec channel never shares the user's interactive shell state. No retries. */
export declare function remoteExec(client: Client, command: string, cwd: string, signal: AbortSignal, onOutput?: (text: string) => void, timeoutMs?: number): Promise<ExecResult>;
