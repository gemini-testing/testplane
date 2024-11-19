// TODO: use @vitest/spy when migrate to esm

/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-use-before-define */
import type { SpyInternalImpl } from "tinyspy";
import * as tinyspy from "tinyspy";

interface MockResultReturn<T> {
    type: "return";
    /**
     * The value that was returned from the function. If function returned a Promise, then this will be a resolved value.
     */
    value: T;
}
interface MockResultIncomplete {
    type: "incomplete";
    value: undefined;
}
interface MockResultThrow {
    type: "throw";
    /**
     * An error that was thrown during function execution.
     */
    value: any;
}

interface MockSettledResultFulfilled<T> {
    type: "fulfilled";
    value: T;
}

interface MockSettledResultRejected {
    type: "rejected";
    value: any;
}

export type MockResult<T> = MockResultReturn<T> | MockResultThrow | MockResultIncomplete;
export type MockSettledResult<T> = MockSettledResultFulfilled<T> | MockSettledResultRejected;

export interface MockContext<T extends Procedure> {
    /**
     * This is an array containing all arguments for each call. One item of the array is the arguments of that call.
     *
     * @example
     * const fn = vi.fn()
     *
     * fn('arg1', 'arg2')
     * fn('arg3')
     *
     * fn.mock.calls === [
     *   ['arg1', 'arg2'], // first call
     *   ['arg3'], // second call
     * ]
     */
    calls: Parameters<T>[];
    /**
     * This is an array containing all instances that were instantiated when mock was called with a `new` keyword. Note that this is an actual context (`this`) of the function, not a return value.
     */
    instances: ReturnType<T>[];
    /**
     * An array of `this` values that were used during each call to the mock function.
     */
    contexts: ThisParameterType<T>[];
    /**
     * The order of mock's execution. This returns an array of numbers which are shared between all defined mocks.
     *
     * @example
     * const fn1 = vi.fn()
     * const fn2 = vi.fn()
     *
     * fn1()
     * fn2()
     * fn1()
     *
     * fn1.mock.invocationCallOrder === [1, 3]
     * fn2.mock.invocationCallOrder === [2]
     */
    invocationCallOrder: number[];
    /**
     * This is an array containing all values that were `returned` from the function.
     *
     * The `value` property contains the returned value or thrown error. If the function returned a `Promise`, then `result` will always be `'return'` even if the promise was rejected.
     *
     * @example
     * const fn = vi.fn()
     *   .mockReturnValueOnce('result')
     *   .mockImplementationOnce(() => { throw new Error('thrown error') })
     *
     * const result = fn()
     *
     * try {
     *   fn()
     * }
     * catch {}
     *
     * fn.mock.results === [
     *   {
     *     type: 'return',
     *     value: 'result',
     *   },
     *   {
     *     type: 'throw',
     *     value: Error,
     *   },
     * ]
     */
    results: MockResult<ReturnType<T>>[];
    /**
     * An array containing all values that were `resolved` or `rejected` from the function.
     *
     * This array will be empty if the function was never resolved or rejected.
     *
     * @example
     * const fn = vi.fn().mockResolvedValueOnce('result')
     *
     * const result = fn()
     *
     * fn.mock.settledResults === []
     * fn.mock.results === [
     *   {
     *     type: 'return',
     *     value: Promise<'result'>,
     *   },
     * ]
     *
     * await result
     *
     * fn.mock.settledResults === [
     *   {
     *     type: 'fulfilled',
     *     value: 'result',
     *   },
     * ]
     */
    settledResults: MockSettledResult<Awaited<ReturnType<T>>>[];
    /**
     * This contains the arguments of the last call. If spy wasn't called, will return `undefined`.
     */
    lastCall: Parameters<T> | undefined;
}

type Procedure = (...args: any[]) => any;
// pick a single function type from function overloads, unions, etc...
type NormalizedPrecedure<T extends Procedure> = (...args: Parameters<T>) => ReturnType<T>;

type Methods<T> = keyof {
    [K in keyof T as T[K] extends Procedure ? K : never]: T[K];
};
type Properties<T> = {
    [K in keyof T]: T[K] extends Procedure ? never : K;
}[keyof T] &
    (string | symbol);
type Classes<T> = {
    [K in keyof T]: T[K] extends new (...args: any[]) => any ? K : never;
}[keyof T] &
    (string | symbol);

/*
cf. https://typescript-eslint.io/rules/method-signature-style/

Typescript assignability is different between
  { foo: (f: T) => U } (this is "method-signature-style")
and
  { foo(f: T): U }

Jest uses the latter for `MockInstance.mockImplementation` etc... and it allows assignment such as:
  const boolFn: Jest.Mock<() => boolean> = jest.fn<() => true>(() => true)
*/
export interface MockInstance<T extends Procedure = Procedure> {
    /**
     * Use it to return the name given to mock with method `.mockName(name)`.
     */
    getMockName(): string;
    /**
     * Sets internal mock name. Useful to see the name of the mock if an assertion fails.
     */
    mockName(n: string): this;
    /**
     * Current context of the mock. It stores information about all invocation calls, instances, and results.
     */
    mock: MockContext<T>;
    /**
     * Clears all information about every call. After calling it, all properties on `.mock` will return an empty state. This method does not reset implementations.
     *
     * It is useful if you need to clean up mock between different assertions.
     */
    mockClear(): this;
    /**
     * Does what `mockClear` does and makes inner implementation an empty function (returning `undefined` when invoked). This also resets all "once" implementations.
     *
     * This is useful when you want to completely reset a mock to the default state.
     */
    mockReset(): this;
    /**
     * Does what `mockReset` does and restores inner implementation to the original function.
     *
     * Note that restoring mock from `vi.fn()` will set implementation to an empty function that returns `undefined`. Restoring a `vi.fn(impl)` will restore implementation to `impl`.
     */
    mockRestore(): void;
    /**
     * Returns current mock implementation if there is one.
     *
     * If mock was created with `vi.fn`, it will consider passed down method as a mock implementation.
     *
     * If mock was created with `vi.spyOn`, it will return `undefined` unless a custom implementation was provided.
     */
    getMockImplementation(): NormalizedPrecedure<T> | undefined;
    /**
     * Accepts a function that will be used as an implementation of the mock.
     * @example
     * const increment = vi.fn().mockImplementation(count => count + 1);
     * expect(increment(3)).toBe(4);
     */
    mockImplementation(fn: NormalizedPrecedure<T>): this;
    /**
     * Accepts a function that will be used as a mock implementation during the next call. Can be chained so that multiple function calls produce different results.
     * @example
     * const fn = vi.fn(count => count).mockImplementationOnce(count => count + 1);
     * expect(fn(3)).toBe(4);
     * expect(fn(3)).toBe(3);
     */
    mockImplementationOnce(fn: NormalizedPrecedure<T>): this;
    /**
     * Overrides the original mock implementation temporarily while the callback is being executed.
     * @example
     * const myMockFn = vi.fn(() => 'original')
     *
     * myMockFn.withImplementation(() => 'temp', () => {
     *   myMockFn() // 'temp'
     * })
     *
     * myMockFn() // 'original'
     */
    withImplementation<T2>(
        fn: NormalizedPrecedure<T>,
        cb: () => T2,
    ): T2 extends Promise<unknown> ? Promise<this> : this;

    /**
     * Use this if you need to return `this` context from the method without invoking actual implementation.
     */
    mockReturnThis(): this;
    /**
     * Accepts a value that will be returned whenever the mock function is called.
     */
    mockReturnValue(obj: ReturnType<T>): this;
    /**
     * Accepts a value that will be returned during the next function call. If chained, every consecutive call will return the specified value.
     *
     * When there are no more `mockReturnValueOnce` values to use, mock will fallback to the previously defined implementation if there is one.
     * @example
     * const myMockFn = vi
     *   .fn()
     *   .mockReturnValue('default')
     *   .mockReturnValueOnce('first call')
     *   .mockReturnValueOnce('second call')
     *
     * // 'first call', 'second call', 'default'
     * console.log(myMockFn(), myMockFn(), myMockFn())
     */
    mockReturnValueOnce(obj: ReturnType<T>): this;
    /**
     * Accepts a value that will be resolved when async function is called.
     * @example
     * const asyncMock = vi.fn().mockResolvedValue(42)
     * asyncMock() // Promise<42>
     */
    mockResolvedValue(obj: Awaited<ReturnType<T>>): this;
    /**
     * Accepts a value that will be resolved during the next function call. If chained, every consecutive call will resolve specified value.
     * @example
     * const myMockFn = vi
     *   .fn()
     *   .mockResolvedValue('default')
     *   .mockResolvedValueOnce('first call')
     *   .mockResolvedValueOnce('second call')
     *
     * // Promise<'first call'>, Promise<'second call'>, Promise<'default'>
     * console.log(myMockFn(), myMockFn(), myMockFn())
     */
    mockResolvedValueOnce(obj: Awaited<ReturnType<T>>): this;
    /**
     * Accepts an error that will be rejected when async function is called.
     * @example
     * const asyncMock = vi.fn().mockRejectedValue(new Error('Async error'))
     * await asyncMock() // throws 'Async error'
     */
    mockRejectedValue(obj: any): this;
    /**
     * Accepts a value that will be rejected during the next function call. If chained, every consecutive call will reject specified value.
     * @example
     * const asyncMock = vi
     *   .fn()
     *   .mockResolvedValueOnce('first call')
     *   .mockRejectedValueOnce(new Error('Async error'))
     *
     * await asyncMock() // first call
     * await asyncMock() // throws "Async error"
     */
    mockRejectedValueOnce(obj: any): this;
}

export interface Mock<T extends Procedure = Procedure> extends MockInstance<T> {
    new (...args: Parameters<T>): ReturnType<T>;
    (...args: Parameters<T>): ReturnType<T>;
}

type PartialMaybePromise<T> = T extends Promise<Awaited<T>> ? Promise<Partial<Awaited<T>>> : Partial<T>;

export interface PartialMock<T extends Procedure = Procedure>
    extends MockInstance<(...args: Parameters<T>) => PartialMaybePromise<ReturnType<T>>> {
    new (...args: Parameters<T>): ReturnType<T>;
    (...args: Parameters<T>): ReturnType<T>;
}

export type MaybeMockedConstructor<T> = T extends new (...args: Array<any>) => infer R
    ? Mock<(...args: ConstructorParameters<T>) => R>
    : T;
export type MockedFunction<T extends Procedure> = Mock<T> & {
    [K in keyof T]: T[K];
};
export type PartiallyMockedFunction<T extends Procedure> = PartialMock<T> & {
    [K in keyof T]: T[K];
};
export type MockedFunctionDeep<T extends Procedure> = Mock<T> & MockedObjectDeep<T>;
export type PartiallyMockedFunctionDeep<T extends Procedure> = PartialMock<T> & MockedObjectDeep<T>;
export type MockedObject<T> = MaybeMockedConstructor<T> & {
    [K in Methods<T>]: T[K] extends Procedure ? MockedFunction<T[K]> : T[K];
} & { [K in Properties<T>]: T[K] };
export type MockedObjectDeep<T> = MaybeMockedConstructor<T> & {
    [K in Methods<T>]: T[K] extends Procedure ? MockedFunctionDeep<T[K]> : T[K];
    // eslint-disable-next-line no-use-before-define
} & { [K in Properties<T>]: MaybeMockedDeep<T[K]> };

export type MaybeMockedDeep<T> = T extends Procedure
    ? MockedFunctionDeep<T>
    : T extends object
    ? MockedObjectDeep<T>
    : T;

export type MaybePartiallyMockedDeep<T> = T extends Procedure
    ? PartiallyMockedFunctionDeep<T>
    : T extends object
    ? MockedObjectDeep<T>
    : T;

export type MaybeMocked<T> = T extends Procedure ? MockedFunction<T> : T extends object ? MockedObject<T> : T;

export type MaybePartiallyMocked<T> = T extends Procedure
    ? PartiallyMockedFunction<T>
    : T extends object
    ? MockedObject<T>
    : T;

interface Constructable {
    new (...args: any[]): any;
}

export type MockedClass<T extends Constructable> = MockInstance<
    (...args: ConstructorParameters<T>) => InstanceType<T>
> & {
    prototype: T extends { prototype: any } ? Mocked<T["prototype"]> : never;
} & T;

export type Mocked<T> = {
    [P in keyof T]: T[P] extends Procedure ? MockInstance<T[P]> : T[P] extends Constructable ? MockedClass<T[P]> : T[P];
} & T;

export const mocks: Set<MockInstance> = new Set();

export function isMockFunction(fn: any): fn is MockInstance {
    return typeof fn === "function" && "_isMockFunction" in fn && fn._isMockFunction;
}

export function spyOn<T, S extends Properties<Required<T>>>(
    obj: T,
    methodName: S,
    accessType: "get",
): MockInstance<() => T[S]>;
export function spyOn<T, G extends Properties<Required<T>>>(
    obj: T,
    methodName: G,
    accessType: "set",
): MockInstance<(arg: T[G]) => void>;
export function spyOn<T, M extends Classes<Required<T>> | Methods<Required<T>>>(
    obj: T,
    methodName: M,
): Required<T>[M] extends { new (...args: infer A): infer R }
    ? MockInstance<(this: R, ...args: A) => R>
    : T[M] extends Procedure
    ? MockInstance<T[M]>
    : never;
export function spyOn<T, K extends keyof T>(obj: T, method: K, accessType?: "get" | "set"): MockInstance {
    const dictionary = {
        get: "getter",
        set: "setter",
    } as const;
    const objMethod = accessType ? { [dictionary[accessType]]: method } : method;

    const stub = tinyspy.internalSpyOn(obj, objMethod as any);

    return enhanceSpy(stub) as MockInstance;
}

let callOrder = 0;

function enhanceSpy<T extends Procedure>(spy: SpyInternalImpl<Parameters<T>, ReturnType<T>>): MockInstance<T> {
    type TArgs = Parameters<T>;
    type TReturns = ReturnType<T>;

    const stub = spy as unknown as MockInstance<T>;

    let implementation: T | undefined;

    let instances: any[] = [];
    let contexts: any[] = [];
    let invocations: number[] = [];

    const state = tinyspy.getInternalState(spy);

    const mockContext: MockContext<T> = {
        get calls() {
            return state.calls;
        },
        get contexts() {
            return contexts;
        },
        get instances() {
            return instances;
        },
        get invocationCallOrder() {
            return invocations;
        },
        get results() {
            return state.results.map(([callType, value]) => {
                const type = callType === "error" ? ("throw" as const) : ("return" as const);
                return { type, value };
            });
        },
        get settledResults() {
            return state.resolves.map(([callType, value]) => {
                const type = callType === "error" ? ("rejected" as const) : ("fulfilled" as const);
                return { type, value };
            });
        },
        get lastCall() {
            return state.calls[state.calls.length - 1];
        },
    };

    let onceImplementations: ((...args: TArgs) => TReturns)[] = [];
    let implementationChangedTemporarily = false;

    function mockCall(this: unknown, ...args: any) {
        instances.push(this);
        contexts.push(this);
        invocations.push(++callOrder);
        const impl = implementationChangedTemporarily
            ? implementation!
            : onceImplementations.shift() || implementation || state.getOriginal() || (() => {});
        return impl.apply(this, args);
    }

    let name: string = (stub as any).name;

    stub.getMockName = () => name || "vi.fn()";
    stub.mockName = n => {
        name = n;
        return stub;
    };

    stub.mockClear = () => {
        state.reset();
        instances = [];
        contexts = [];
        invocations = [];
        return stub;
    };

    stub.mockReset = () => {
        stub.mockClear();
        implementation = (() => undefined) as T;
        onceImplementations = [];
        return stub;
    };

    stub.mockRestore = () => {
        stub.mockReset();
        state.restore();
        implementation = undefined;
        return stub;
    };

    stub.getMockImplementation = () => implementation;
    stub.mockImplementation = (fn: T) => {
        implementation = fn;
        state.willCall(mockCall);
        return stub;
    };

    stub.mockImplementationOnce = (fn: T) => {
        onceImplementations.push(fn);
        return stub;
    };

    function withImplementation(fn: T, cb: () => void): MockInstance<T>;
    function withImplementation(fn: T, cb: () => Promise<void>): Promise<MockInstance<T>>;
    function withImplementation(fn: T, cb: () => void | Promise<void>): MockInstance<T> | Promise<MockInstance<T>> {
        const originalImplementation = implementation;

        implementation = fn;
        state.willCall(mockCall);
        implementationChangedTemporarily = true;

        const reset = () => {
            implementation = originalImplementation;
            implementationChangedTemporarily = false;
        };

        const result = cb();

        if (result instanceof Promise) {
            return result.then(() => {
                reset();
                return stub;
            });
        }

        reset();

        return stub;
    }

    stub.withImplementation = withImplementation;

    stub.mockReturnThis = () =>
        stub.mockImplementation(function (this: TReturns) {
            return this;
        } as any);

    stub.mockReturnValue = (val: TReturns) => stub.mockImplementation((() => val) as any);
    stub.mockReturnValueOnce = (val: TReturns) => stub.mockImplementationOnce((() => val) as any);

    stub.mockResolvedValue = (val: Awaited<TReturns>) =>
        stub.mockImplementation((() => Promise.resolve(val as TReturns)) as any);

    stub.mockResolvedValueOnce = (val: Awaited<TReturns>) =>
        stub.mockImplementationOnce((() => Promise.resolve(val as TReturns)) as any);

    stub.mockRejectedValue = (val: unknown) => stub.mockImplementation((() => Promise.reject(val)) as any);

    stub.mockRejectedValueOnce = (val: unknown) => stub.mockImplementationOnce((() => Promise.reject(val)) as any);

    Object.defineProperty(stub, "mock", {
        get: () => mockContext,
    });

    state.willCall(mockCall);

    mocks.add(stub);

    return stub as any;
}

export function fn<T extends Procedure = Procedure>(implementation?: T): Mock<T> {
    const enhancedSpy = enhanceSpy(
        tinyspy.internalSpyOn(
            {
                spy: implementation || (function () {} as T),
            },
            "spy",
        ),
    );
    if (implementation) {
        enhancedSpy.mockImplementation(implementation);
    }

    return enhancedSpy as any;
}
