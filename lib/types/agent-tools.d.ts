import type { Context } from '@deepseek-ai/cordis';
import type { AgentOperations } from './agent-operations.ts';
export declare const AGENT_TOOLS: readonly ["dsh_ssh_hosts", "dsh_ssh_exec", "dsh_ssh_read", "dsh_ssh_edit", "dsh_ssh_upload"];
export declare function installAgentTools(ctx: Context, operations: AgentOperations): void;
