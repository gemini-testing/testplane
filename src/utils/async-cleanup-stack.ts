type Cleanup = () => void | PromiseLike<void>;

// TODO: migrate to native AsyncDisposableStack when Testplane drops support for Node v22
export class AsyncCleanupStack implements AsyncDisposable {
    private callbacks: Cleanup[] = [];
    private state: "pending" | "disposed" = "pending";

    get disposed(): boolean {
        return this.state === "disposed";
    }

    defer(callback: Cleanup): void {
        this.assertPending();
        if (typeof callback !== "function") throw new TypeError("Cleanup is not callable");
        this.callbacks.push(callback);
    }

    use<T extends Disposable | AsyncDisposable | null | undefined>(resource: T): T {
        this.assertPending();

        if (resource === null || resource === undefined) return resource;

        const asyncDispose = (resource as Partial<AsyncDisposable>)[Symbol.asyncDispose];
        if (asyncDispose !== null && asyncDispose !== undefined) {
            if (typeof asyncDispose !== "function") throw new TypeError("Resource is not disposable");
            this.defer(() => asyncDispose.call(resource));
        } else {
            const syncDispose = (resource as Partial<Disposable>)[Symbol.dispose];
            if (typeof syncDispose !== "function") throw new TypeError("Resource is not disposable");
            this.defer(() => {
                syncDispose.call(resource);
            });
        }

        return resource;
    }

    adopt<T>(value: T, disposer: (value: T) => void | PromiseLike<void>): T {
        this.assertPending();
        if (typeof disposer !== "function") throw new TypeError("Cleanup is not callable");
        this.defer(() => disposer(value));
        return value;
    }

    move(): AsyncCleanupStack {
        this.assertPending();

        const next = new AsyncCleanupStack();
        next.callbacks = this.callbacks;

        this.callbacks = [];
        this.state = "disposed";

        return next;
    }

    async disposeAsync(): Promise<void> {
        if (this.disposed) return;

        this.state = "disposed";

        let error: unknown = null;
        let hasError = false;

        while (this.callbacks.length > 0) {
            try {
                await this.callbacks.pop()!();
            } catch (cause) {
                // Node 22 has the disposal symbols, but not SuppressedError.
                error = hasError ? suppress(cause, error) : cause;
                hasError = true;
            }
        }

        if (hasError) throw error;
    }

    [Symbol.asyncDispose](): Promise<void> {
        return this.disposeAsync();
    }

    private assertPending(): void {
        if (this.disposed) {
            throw new ReferenceError("Stack is already disposed");
        }
    }
}

function suppress(error: unknown, suppressed: unknown): Error {
    if (typeof SuppressedError !== "undefined") {
        return new SuppressedError(error, suppressed, "Cleanup failed");
    }
    const result = new Error("Cleanup failed");
    Object.defineProperties(result, {
        name: { value: "SuppressedError", configurable: true, writable: true },
        error: { value: error, configurable: true, writable: true },
        suppressed: { value: suppressed, configurable: true, writable: true },
    });
    return result;
}
