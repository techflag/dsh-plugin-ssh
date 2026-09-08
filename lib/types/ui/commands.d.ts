export interface AnswerPart {
    text: string;
    command?: string;
}
/** Only complete, explicitly marked shell blocks become command actions. */
export declare function answerParts(text: string): AnswerPart[];
