import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client';
import type { OpenTarget } from './operation-card.tsx';
export interface InputHost {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
}
export declare function serializeHost(host: InputHost): string;
export declare function createSshInputSources(open: (target?: OpenTarget) => void): readonly InputTriggerSource[];
