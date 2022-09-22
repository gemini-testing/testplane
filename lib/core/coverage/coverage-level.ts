export enum CoverageValue {
    FULL = 'full',
    PARTIAL = 'partial',
    NONE = 'none'
}

export const FULL = CoverageValue.FULL;
export const PARTIAL = CoverageValue.PARTIAL;
export const NONE = CoverageValue.NONE;

export function merge(oldValue: CoverageValue = CoverageValue.NONE, newValue: CoverageValue): CoverageValue {
    if (oldValue === CoverageValue.FULL || newValue === CoverageValue.FULL) {
        return CoverageValue.FULL;
    }

    if (oldValue === CoverageValue.PARTIAL || newValue === CoverageValue.PARTIAL) {
        return CoverageValue.PARTIAL;
    }

    return CoverageValue.NONE;
}
