import { type SshTarget } from './ssh-service.ts';
/** Local encryption; the per-user key is permission protected, not an OS keychain. */
export declare class PasswordStore {
    private dir;
    constructor(dir?: string);
    private file;
    private key;
    get(target: SshTarget): Promise<string | undefined>;
    set(target: SshTarget, password: string): Promise<void>;
    remove(target: SshTarget): Promise<void>;
}
