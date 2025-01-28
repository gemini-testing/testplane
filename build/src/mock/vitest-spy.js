"use strict";
// TODO: use @vitest/spy when migrate to esm
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fn = exports.spyOn = exports.isMockFunction = exports.mocks = void 0;
const tinyspy = __importStar(require("tinyspy"));
exports.mocks = new Set();
function isMockFunction(fn) {
    return typeof fn === "function" && "_isMockFunction" in fn && fn._isMockFunction;
}
exports.isMockFunction = isMockFunction;
function spyOn(obj, method, accessType) {
    const dictionary = {
        get: "getter",
        set: "setter",
    };
    const objMethod = accessType ? { [dictionary[accessType]]: method } : method;
    const stub = tinyspy.internalSpyOn(obj, objMethod);
    return enhanceSpy(stub);
}
exports.spyOn = spyOn;
let callOrder = 0;
function enhanceSpy(spy) {
    const stub = spy;
    let implementation;
    let instances = [];
    let contexts = [];
    let invocations = [];
    const state = tinyspy.getInternalState(spy);
    const mockContext = {
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
                const type = callType === "error" ? "throw" : "return";
                return { type, value };
            });
        },
        get settledResults() {
            return state.resolves.map(([callType, value]) => {
                const type = callType === "error" ? "rejected" : "fulfilled";
                return { type, value };
            });
        },
        get lastCall() {
            return state.calls[state.calls.length - 1];
        },
    };
    let onceImplementations = [];
    let implementationChangedTemporarily = false;
    function mockCall(...args) {
        instances.push(this);
        contexts.push(this);
        invocations.push(++callOrder);
        const impl = implementationChangedTemporarily
            ? implementation
            : onceImplementations.shift() || implementation || state.getOriginal() || (() => { });
        return impl.apply(this, args);
    }
    let name = stub.name;
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
        implementation = (() => undefined);
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
    stub.mockImplementation = (fn) => {
        implementation = fn;
        state.willCall(mockCall);
        return stub;
    };
    stub.mockImplementationOnce = (fn) => {
        onceImplementations.push(fn);
        return stub;
    };
    function withImplementation(fn, cb) {
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
    stub.mockReturnThis = () => stub.mockImplementation(function () {
        return this;
    });
    stub.mockReturnValue = (val) => stub.mockImplementation((() => val));
    stub.mockReturnValueOnce = (val) => stub.mockImplementationOnce((() => val));
    stub.mockResolvedValue = (val) => stub.mockImplementation((() => Promise.resolve(val)));
    stub.mockResolvedValueOnce = (val) => stub.mockImplementationOnce((() => Promise.resolve(val)));
    stub.mockRejectedValue = (val) => stub.mockImplementation((() => Promise.reject(val)));
    stub.mockRejectedValueOnce = (val) => stub.mockImplementationOnce((() => Promise.reject(val)));
    Object.defineProperty(stub, "mock", {
        get: () => mockContext,
    });
    state.willCall(mockCall);
    exports.mocks.add(stub);
    return stub;
}
function fn(implementation) {
    const enhancedSpy = enhanceSpy(tinyspy.internalSpyOn({
        spy: implementation || function () { },
    }, "spy"));
    if (implementation) {
        enhancedSpy.mockImplementation(implementation);
    }
    return enhancedSpy;
}
exports.fn = fn;
//# sourceMappingURL=vitest-spy.js.map