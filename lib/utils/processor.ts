type Callback = (err?: Error | null, res?: any) => void;

export default async (module: string, methodName: string, args: Array<any>, cb: Callback) => {
    try {
        const result = await require(module)[methodName](...args);
        cb(null, result);
    } catch (e: any) {
        cb(e);
    }
};
