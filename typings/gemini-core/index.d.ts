declare namespace GeminiCore {
    export interface AsyncEmitter extends NodeJS.EventEmitter {
        emitAndWait(event: string, ...args: Array<unknown>): Promise<Array<unknown>>;
    }
}
