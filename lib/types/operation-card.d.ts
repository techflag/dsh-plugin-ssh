import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
export interface OpenTarget {
    hostId: string;
    path?: string;
}
export declare function OperationCard({ block, toolName, callId, open }: {
    block: ToolCallViewProps['block'];
    toolName: string;
    callId: string;
    open: (target?: OpenTarget) => void;
}): import("react").JSX.Element;
