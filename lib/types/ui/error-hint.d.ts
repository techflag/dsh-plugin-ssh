/** Local heuristics only: no model request and no claim about an exit code. */
export declare class ErrorHintTracker {
    private output;
    private armed;
    private published;
    begin(): void;
    context(): string;
    feed(chunk: string): string | undefined;
}
