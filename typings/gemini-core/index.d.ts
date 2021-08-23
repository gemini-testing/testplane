declare namespace GeminiCore {
    export class AsyncEmitter extends NodeJS.EventEmitter {
        emitAndWait(event: string, ...args: Array<unknown>): Promise<Array<unknown>>;
    }
}
