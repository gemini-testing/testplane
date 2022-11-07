exports.initReporters = async (rawReporters, runner) => {
    await Promise.all([].concat(rawReporters).map((rawReporter) => applyReporter(rawReporter, runner)));
};
const reporterHandlers = [
    {
        isMatched: (rawReporter) => typeof rawReporter === 'string' && isJSON(rawReporter),
        initReporter: (rawReporter) => initReporter(getReporterDefinition(rawReporter, JSON.parse))
    },
    {
        isMatched: (rawReporter) => typeof rawReporter === 'string',
        initReporter: (rawReporter) => initReporter({ ...getReporterDefinition(rawReporter), type: rawReporter })
    },
    {
        isMatched: (rawReporter) => typeof rawReporter === 'object',
        initReporter: (rawReporter) => initReporter(getReporterDefinition(rawReporter, (v) => v))
    },
    {
        isMatched: (rawReporter) => typeof rawReporter === 'function',
        initReporter: (rawReporter) => {
            validateReporter(rawReporter);
            return rawReporter.create(getReporterDefinition(rawReporter));
        }
    },
    {
        isMatched: () => true,
        initReporter: (rawReporter) => {
            throw new TypeError(`Specified reporter must be a string, object or function, but got: "${typeof rawReporter}"`);
        }
    }
];
async function applyReporter(rawReporter, runner) {
    for (const handler of reporterHandlers) {
        if (!handler.isMatched(rawReporter)) {
            continue;
        }
        const reporter = await handler.initReporter(rawReporter);
        if (typeof reporter.attachRunner !== 'function') {
            throw new TypeError('Initialized reporter must have an "attachRunner" function for subscribe on test result events');
        }
        return reporter.attachRunner(runner);
    }
}
function initReporter(reporter) {
    let Reporter;
    try {
        Reporter = require(`./${reporter.type}`);
    }
    catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
            throw new Error(`No such reporter: "${reporter.type}"`);
        }
        throw e;
    }
    validateReporter(Reporter);
    return Reporter.create(reporter);
}
function getReporterDefinition(rawReporter, parser) {
    if (!parser) {
        return { type: null, path: null };
    }
    const { type, path } = parser(rawReporter);
    if (!type) {
        const strRawReporter = typeof rawReporter !== 'string' ? JSON.stringify(rawReporter) : rawReporter;
        throw new Error(`Failed to find required "type" field in reporter definition: "${strRawReporter}"`);
    }
    return { type, path };
}
function validateReporter(Reporter) {
    if (typeof Reporter !== 'function') {
        throw new TypeError(`Imported reporter must be a function, but got: "${typeof Reporter}"`);
    }
    if (typeof Reporter.create !== 'function') {
        throw new TypeError('Imported reporter must have a "create" function for initialization');
    }
}
function isJSON(str) {
    try {
        JSON.parse(str);
    }
    catch (e) {
        return false;
    }
    return true;
}
