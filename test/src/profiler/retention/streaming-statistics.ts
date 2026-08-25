import { StreamingStatistics, type StatisticsSnapshot } from "src/profiler/retention/streaming-statistics";

describe("profiler/retention/streaming-statistics", () => {
    const randomFor = (seed: number): (() => number) => {
        let state = seed;
        return (): number => {
            state = (state * 1664525 + 1013904223) % 2 ** 32;
            return state / 2 ** 32;
        };
    };
    const snapshot = (value: number, count: number): StatisticsSnapshot => ({
        count,
        sum: value * count,
        min: value,
        max: value,
        mean: value,
        variance: 0,
        p50: value,
        p95: value,
        samples: Array(Math.min(256, count)).fill(value),
    });

    it("should weight merged reservoirs by the represented observation counts", () => {
        const statistics = new StreamingStatistics(256, randomFor(1));

        statistics.merge(snapshot(0, 10_000));
        statistics.merge(snapshot(100, 10_000));

        const merged = statistics.snapshot();
        const highSamples = merged.samples!.filter(value => value === 100).length;
        assert.deepInclude(merged, { count: 20_000, sum: 1_000_000, mean: 50, p95: 100 });
        assert.isAtLeast(highSamples, 96);
        assert.isAtMost(highSamples, 160);
    });

    it("should preserve imbalanced fragment proportions in merged percentiles", () => {
        let highSamples = 0;
        let incorrectP95 = 0;

        for (let seed = 1; seed <= 200; seed += 1) {
            const statistics = new StreamingStatistics(256, randomFor(seed));
            statistics.merge(snapshot(0, 10_000));
            statistics.merge(snapshot(100, 200));

            const merged = statistics.snapshot();
            highSamples += merged.samples!.filter(value => value === 100).length;
            incorrectP95 += Number(merged.p95 === 100);
        }

        assert.closeTo(highSamples / 200, (200 / 10_200) * 256, 1);
        assert.isAtMost(incorrectP95, 1);
    });

    it("should reject add arithmetic overflow without mutating statistics", () => {
        const sumStatistics = new StreamingStatistics();
        assert.isTrue(sumStatistics.add(Number.MAX_VALUE));
        const beforeSumOverflow = sumStatistics.snapshot();

        assert.isFalse(sumStatistics.add(Number.MAX_VALUE));
        assert.deepEqual(sumStatistics.snapshot(), beforeSumOverflow);

        const varianceStatistics = new StreamingStatistics();
        assert.isTrue(varianceStatistics.add(0));
        const beforeVarianceOverflow = varianceStatistics.snapshot();

        assert.isFalse(varianceStatistics.add(Number.MAX_VALUE));
        assert.deepEqual(varianceStatistics.snapshot(), beforeVarianceOverflow);
    });

    it("should reject merge count, sum and variance overflow without partial mutation", () => {
        const countStatistics = new StreamingStatistics();
        assert.isTrue(countStatistics.merge(snapshot(0, Number.MAX_SAFE_INTEGER)));
        const beforeCountOverflow = countStatistics.snapshot();
        assert.isFalse(countStatistics.merge(snapshot(0, 1)));
        assert.deepEqual(countStatistics.snapshot(), beforeCountOverflow);

        const sumStatistics = new StreamingStatistics();
        assert.isTrue(sumStatistics.merge(snapshot(Number.MAX_VALUE, 1)));
        const beforeSumOverflow = sumStatistics.snapshot();
        assert.isFalse(sumStatistics.merge(snapshot(Number.MAX_VALUE, 1)));
        assert.deepEqual(sumStatistics.snapshot(), beforeSumOverflow);

        const varianceStatistics = new StreamingStatistics();
        assert.isTrue(varianceStatistics.merge(snapshot(0, 1)));
        const beforeVarianceOverflow = varianceStatistics.snapshot();
        assert.isFalse(varianceStatistics.merge(snapshot(Number.MAX_VALUE, 1)));
        assert.deepEqual(varianceStatistics.snapshot(), beforeVarianceOverflow);
    });

    it("should merge representable high-variance snapshots without intermediate overflow", () => {
        const value = 1.8e154;
        const mergedStatistics = new StreamingStatistics();
        const addedStatistics = new StreamingStatistics();

        assert.isTrue(mergedStatistics.merge(snapshot(0, 1)));
        assert.isTrue(mergedStatistics.merge(snapshot(value, 1)));
        assert.isTrue(addedStatistics.add(0));
        assert.isTrue(addedStatistics.add(value));

        const merged = mergedStatistics.snapshot();
        const added = addedStatistics.snapshot();
        assert.deepInclude(merged, { count: 2, sum: value, min: 0, max: value, mean: value / 2 });
        assert.isFinite(merged.variance);
        assert.closeTo(merged.variance, added.variance, added.variance * 1e-12);
    });
});
