import type { LlmFailure, LlmRuntime } from '@deepseek-ai/dsh-llm';
import type { SshTarget } from './ssh-service.ts';
export interface SshAiRequest {
    provider: string;
    model: string;
    question: string;
    context: string;
    history: Array<{
        role: 'user' | 'assistant';
        text: string;
    }>;
}
/** An error whose message is safe to show in the SSH workbench. */
export declare class SshAiError extends Error {
}
export declare function modelFailureMessage(failure: Pick<LlmFailure, 'code'>): string;
export declare function validateAiRequest(data: Record<string, unknown>): SshAiRequest;
/** A read-only advisory call: terminal output is data, never an executable tool instruction. */
export declare function sshAiAnswer(llm: Pick<LlmRuntime, 'stream'>, target: SshTarget, request: SshAiRequest, signal: AbortSignal): AsyncIterable<string>;
