import type { Context } from '@deepseek-ai/cordis';
import type { IncomingMessage } from 'node:http';
export declare const name = "dsh-ssh";
export declare const inject: string[];
/** Additional local-only fence: no SSH proxy exposed when Harness enables LAN browsing. */
export declare function sshRequestAllowed(req: IncomingMessage, port: number, write: boolean): boolean;
/** Installable Host plugin using the existing authenticated carrier. */
export declare function apply(ctx: Context): void;
