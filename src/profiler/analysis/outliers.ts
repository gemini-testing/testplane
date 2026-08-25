interface OutlierResult<T> {
    item: T;
    measurement: number;
}

// Median absolute deviation is the median distance from the median value.
// For a normal distribution, it is about 0.6745 of the standard deviation.
// 1 / 0.6745 is about 1.4826, so this factor puts both measures on the same scale.
const MEDIAN_ABSOLUTE_DEVIATION_SCALE = 1.4826;

// The fallback uses a common rule: the 75th percentile plus 1.5 interquartile ranges.
const INTERQUARTILE_RANGE_MULTIPLIER = 1.5;

export const findRobustOutliers = <T>(
    items: T[],
    getMeasurement: (item: T) => number,
    deviationMultiplier = 3,
): OutlierResult<T>[] => {
    if (items.length < 8) {
        return [];
    }

    const sortedMeasurements = items
        .map(getMeasurement)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
    if (sortedMeasurements.length < 8) {
        return [];
    }

    const median = valueAtPercentile(sortedMeasurements, 0.5);
    const absoluteDeviationsFromMedian = sortedMeasurements
        .map(measurement => Math.abs(measurement - median))
        .sort((a, b) => a - b);
    const medianAbsoluteDeviation = valueAtPercentile(absoluteDeviationsFromMedian, 0.5);
    const outlierThreshold =
        medianAbsoluteDeviation > 0
            ? median + deviationMultiplier * MEDIAN_ABSOLUTE_DEVIATION_SCALE * medianAbsoluteDeviation
            : valueAtPercentile(sortedMeasurements, 0.75) +
              INTERQUARTILE_RANGE_MULTIPLIER * interquartileRange(sortedMeasurements);
    const maximumOutlierCount = Math.max(3, Math.ceil(items.length * 0.1));

    return items
        .map(item => ({ item, measurement: getMeasurement(item) }))
        .filter(candidate => candidate.measurement > outlierThreshold)
        .sort((left, right) => right.measurement - left.measurement)
        .slice(0, maximumOutlierCount);
};

function valueAtPercentile(sortedValues: number[], percentile: number): number {
    if (!sortedValues.length) {
        return 0;
    }

    return sortedValues[Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * percentile))];
}

function interquartileRange(sortedValues: number[]): number {
    // The interquartile range is the distance from the 25th to the 75th percentile.
    // It measures the spread of the middle half of the values.
    return valueAtPercentile(sortedValues, 0.75) - valueAtPercentile(sortedValues, 0.25);
}
