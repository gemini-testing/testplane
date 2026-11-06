import type ts from "typescript";

export type Binding = ts.Symbol | string;
export type FunctionNode = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration;
export type ValueKind = "unknown" | "context" | "browser" | "element" | "elements" | "array" | "action" | "function";
export interface Value {
    kind: ValueKind;
    promises: Set<ts.CallExpression>;
    items?: Value[];
    fn?: FunctionNode;
}
export interface State {
    bindings: Map<Binding, Value>;
    pending: Set<ts.CallExpression>;
}
export interface Exit {
    kind: "return" | "throw" | "break" | "continue";
    state: State;
    value?: Value;
}
export interface Flow {
    normal?: State;
    exits: Exit[];
}

export const value = (kind: ValueKind = "unknown"): Value => ({ kind, promises: new Set() });
export const clone = (state: State): State => ({ bindings: new Map(state.bindings), pending: new Set(state.pending) });
export const allPromises = (v: Value): Set<ts.CallExpression> =>
    new Set([...v.promises, ...(v.items ?? []).flatMap(item => [...allPromises(item)])]);
export const consume = (state: State, v: Value, deep = false): void => {
    (deep ? allPromises(v) : v.promises).forEach(p => state.pending.delete(p));
};

const same = (a: Value, b: Value): boolean =>
    a.kind === b.kind &&
    a.fn === b.fn &&
    a.promises.size === b.promises.size &&
    [...a.promises].every(p => b.promises.has(p)) &&
    ((!a.items && !b.items) ||
        Boolean(
            a.items && b.items && a.items.length === b.items.length && a.items.every((v, i) => same(v, b.items![i])),
        ));

export function merge(states: Array<State | undefined>): State | undefined {
    const present = states.filter((s): s is State => Boolean(s));
    if (!present.length) return undefined;
    const result = clone(present[0]);
    for (const state of present.slice(1)) {
        state.pending.forEach(p => result.pending.add(p));
        for (const key of new Set([...result.bindings.keys(), ...state.bindings.keys()])) {
            const a = result.bindings.get(key) ?? value();
            const b = state.bindings.get(key) ?? value();
            if (!same(a, b)) {
                // Correlated/mutable aliases require relational analysis. Do not guess their ownership.
                consume(result, a, true);
                consume(result, b, true);
                result.bindings.set(key, value());
            }
        }
    }
    return result;
}
