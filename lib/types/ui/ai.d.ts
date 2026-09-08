interface AiSession {
    id: string;
    label: string;
    context: () => string;
    command: (text: string, execute: boolean) => void;
}
/** Per-SSH-session conversations; no terminal content leaves the app before Send. */
export declare function installAi(getSession: () => AiSession | undefined): {
    refresh: () => void;
};
export {};
