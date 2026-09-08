import { type SshTarget } from './ssh-service.ts';
export interface SavedHost extends SshTarget {
    id: string;
    name: string;
    fingerprint?: string;
}
export declare function hostId(t: SshTarget): string;
export declare class HostStore {
    private dir;
    private queue;
    constructor(dir?: string);
    list(): Promise<SavedHost[]>;
    get(id: string): Promise<SavedHost>;
    save(values: unknown): Promise<void>;
}
