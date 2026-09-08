type Side = 'left' | 'right';
interface ResizablePanel {
    panel: HTMLElement;
    side: Side;
    key: string;
    minimum: number;
    maximum: number;
    defaultWidth: number;
    visible: () => boolean;
}
/** Pointer and keyboard accessible horizontal panel resizing with local preference storage. */
export declare function installPanelSplits(container: HTMLElement, panels: ResizablePanel[]): void;
export {};
