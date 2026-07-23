export interface StatisticsSnapshot {
    /** Number of values represented by this snapshot. */
    count: number;
    /** Sum of all represented values. */
    sum: number;
    /** Smallest represented value. */
    min: number;
    /** Largest represented value. */
    max: number;
    /** Arithmetic average of all represented values. */
    mean: number;
    /** Sample variance, calculated with `count - 1` as the divisor. */
    variance: number;
    /** Estimated median from `samples`: about half of the observations are at or below it. */
    p50?: number;
    /** Estimated 95th percentile from `samples`: about 95% of the observations are at or below it. */
    p95?: number;
    /** Bounded random sample used to estimate percentiles without retaining every value. */
    samples?: number[];
}

export const DEFAULT_STATISTICS_RESERVOIR_SIZE = 256;

export class StreamingStatistics {
    private _count = 0;
    private _sum = 0;
    private _min = Infinity;
    private _max = -Infinity;
    private _mean = 0;
    private _m2 = 0;
    private readonly _reservoir: number[] = [];

    constructor(
        private readonly _reservoirSize = DEFAULT_STATISTICS_RESERVOIR_SIZE,
        private readonly _random: () => number = Math.random,
    ) {}

    add(value: number): boolean {
        if (!Number.isFinite(value)) {
            return false;
        }

        const nextCount = this._count + 1;
        const nextSum = this._sum + value;
        const delta = value - this._mean;
        const nextMean = this._mean + delta / nextCount;
        const deviation = value - nextMean;
        const m2Increment = delta * deviation;
        const nextM2 = this._m2 + m2Increment;

        if (
            !Number.isSafeInteger(nextCount) ||
            !Number.isFinite(nextSum) ||
            !Number.isFinite(delta) ||
            !Number.isFinite(nextMean) ||
            !Number.isFinite(deviation) ||
            !Number.isFinite(m2Increment) ||
            !Number.isFinite(nextM2) ||
            nextM2 < 0
        ) {
            return false;
        }

        const nextReservoir = this._reservoirAfterAdd(value, nextCount);
        this._count = nextCount;
        this._sum = nextSum;
        this._min = Math.min(this._min, value);
        this._max = Math.max(this._max, value);
        this._mean = nextMean;
        this._m2 = nextM2;
        this._reservoir.splice(0, this._reservoir.length, ...nextReservoir);
        return true;
    }

    merge(snapshot: StatisticsSnapshot): boolean {
        const { count, sum, min, max, mean, variance } = snapshot;
        if (
            !Number.isSafeInteger(count) ||
            count < 0 ||
            !Number.isFinite(sum) ||
            !Number.isFinite(min) ||
            !Number.isFinite(max) ||
            !Number.isFinite(mean) ||
            !Number.isFinite(variance) ||
            variance < 0
        ) {
            return false;
        }
        if (!count) {
            return true;
        }

        const previousCount = this._count;
        const incomingM2 = variance * (count - 1);
        if (!Number.isFinite(incomingM2)) {
            return false;
        }

        let nextCount = count;
        let nextSum = sum;
        let nextMin = min;
        let nextMax = max;
        let nextMean = mean;
        let nextM2 = incomingM2;
        if (previousCount) {
            nextCount = previousCount + count;
            nextSum = this._sum + sum;
            const delta = mean - this._mean;
            const meanIncrement = delta * (count / nextCount);
            nextMean = this._mean + meanIncrement;
            const crossWeight = (previousCount / nextCount) * count;
            const weightedDelta = Math.abs(delta) * Math.sqrt(crossWeight);
            const crossM2 = weightedDelta * weightedDelta;
            const combinedM2 = this._m2 + incomingM2;
            nextM2 = combinedM2 + crossM2;
            nextMin = Math.min(this._min, min);
            nextMax = Math.max(this._max, max);

            if (
                !Number.isSafeInteger(nextCount) ||
                !Number.isFinite(nextSum) ||
                !Number.isFinite(delta) ||
                !Number.isFinite(meanIncrement) ||
                !Number.isFinite(nextMean) ||
                !Number.isFinite(crossWeight) ||
                !Number.isFinite(weightedDelta) ||
                !Number.isFinite(crossM2) ||
                !Number.isFinite(combinedM2) ||
                !Number.isFinite(nextM2) ||
                nextM2 < 0
            ) {
                return false;
            }
        } else {
            if (!Number.isSafeInteger(nextCount) || !Number.isFinite(nextM2) || nextM2 < 0) {
                return false;
            }
        }

        const samplesDescriptor = Object.getOwnPropertyDescriptor(snapshot, "samples");
        const samples = samplesDescriptor && "value" in samplesDescriptor ? samplesDescriptor.value : [];
        const nextReservoir = this._mergedReservoir(samples ?? [], previousCount, count, nextCount);
        this._count = nextCount;
        this._sum = nextSum;
        this._min = nextMin;
        this._max = nextMax;
        this._mean = nextMean;
        this._m2 = nextM2;
        this._reservoir.splice(0, this._reservoir.length, ...nextReservoir);
        return true;
    }

    snapshot(): StatisticsSnapshot {
        const sorted = [...this._reservoir].sort((a, b) => a - b);

        return {
            count: this._count,
            sum: this._sum,
            min: this._count ? this._min : 0,
            max: this._count ? this._max : 0,
            mean: this._count ? this._mean : 0,
            variance: this._count > 1 ? this._m2 / (this._count - 1) : 0,
            p50: quantile(sorted, 0.5),
            p95: quantile(sorted, 0.95),
            samples: sorted,
        };
    }

    private _reservoirAfterAdd(value: number, count: number): number[] {
        const reservoir = [...this._reservoir];
        if (reservoir.length < this._reservoirSize) {
            reservoir.push(value);
            return reservoir;
        }

        const index = Math.floor(this._random() * Math.max(1, count));
        if (index < this._reservoirSize) {
            reservoir[index] = value;
        }
        return reservoir;
    }

    private _mergedReservoir(
        samples: number[],
        previousCount: number,
        incomingCount: number,
        nextCount: number,
    ): number[] {
        const reservoir = [...this._reservoir];
        const incoming = samples.filter(Number.isFinite);
        if (!incoming.length || this._reservoirSize <= 0) {
            return reservoir;
        }

        const targetSize = Math.min(this._reservoirSize, nextCount);
        if (reservoir.length + incoming.length <= targetSize) {
            reservoir.push(...incoming);
            return reservoir;
        }

        // A uniform reservoir over both populations contains a hypergeometric number of incoming observations.
        const incomingSize = drawHypergeometric(incomingCount, previousCount, targetSize, this._random);
        const previous = takeRandom(reservoir, targetSize - incomingSize, this._random);
        const selectedIncoming = takeRandom(incoming, incomingSize, this._random);
        return [...previous, ...selectedIncoming];
    }
}

function drawHypergeometric(successes: number, failures: number, draws: number, random: () => number): number {
    let selected = 0;
    for (let draw = 0; draw < draws; draw += 1) {
        if (random() < successes / (successes + failures)) {
            selected += 1;
            successes -= 1;
        } else {
            failures -= 1;
        }
    }
    return selected;
}

function takeRandom<T>(values: T[], count: number, random: () => number): T[] {
    const shuffled = [...values];
    const size = Math.min(count, shuffled.length);
    for (let index = 0; index < size; index += 1) {
        const selected = index + Math.floor(random() * (shuffled.length - index));
        [shuffled[index], shuffled[selected]] = [shuffled[selected], shuffled[index]];
    }
    return shuffled.slice(0, size);
}

function quantile(values: number[], percentile: number): number | undefined {
    if (!values.length) {
        return;
    }

    return values[Math.min(values.length - 1, Math.floor((values.length - 1) * percentile))];
}
