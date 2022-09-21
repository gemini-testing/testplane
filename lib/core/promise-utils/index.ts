import Bluebird from 'bluebird';

export const waitForResults = async <T>(promises: Array<Bluebird<T>>): Promise<Array<T>> => {
    const res = await Promise.all(promises.map((p) => p.reflect()));
    const firstRejection = res.find((v) => v.isRejected());

    return firstRejection ? Promise.reject(firstRejection.reason()) : res.map((r) => r.value());
};
