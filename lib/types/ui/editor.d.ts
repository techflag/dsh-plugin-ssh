export declare function installEditor(api: <T>(op: string, data: unknown) => Promise<T>, getId: () => string): {
    refresh: () => void;
    canClose: (id: string) => Promise<boolean>;
    open(id: string, path: string): Promise<void>;
};
