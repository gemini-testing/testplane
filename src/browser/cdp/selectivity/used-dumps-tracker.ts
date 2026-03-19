import { once } from "lodash";

export class UsedDumpsTracker {
    private _usedDumpsPerSelectivityRoot: Record<string, Set<string>> = {};

    trackUsed(dumpId: string, testDependenciesPath: string): void {
        this._usedDumpsPerSelectivityRoot[testDependenciesPath] ||= new Set();
        this._usedDumpsPerSelectivityRoot[testDependenciesPath].add(dumpId);
    }

    usedDumpsFor(testDependenciesPath: string): boolean {
        if (!this._usedDumpsPerSelectivityRoot[testDependenciesPath]) {
            return false;
        }

        return Boolean(this._usedDumpsPerSelectivityRoot[testDependenciesPath].size);
    }

    wasUsed(dumpId: string, testDependenciesPath: string): boolean {
        return this._usedDumpsPerSelectivityRoot[testDependenciesPath]?.has(dumpId) || false;
    }
}

export const getUsedDumpsTracker = once(() => new UsedDumpsTracker());
