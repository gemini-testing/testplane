'use strict';

const SetsBuilder = require('gemini-core').SetsBuilder;

const DEFAULT_DIR = require('../package').name;

exports.reveal = (sets, opts) => {
    return SetsBuilder
        .create(sets, {defaultDir: DEFAULT_DIR})
        .useSets(opts.sets)
        .useFiles(opts.paths)
        .useBrowsers(opts.browsers)
        .build(process.cwd())
        .then((setCollection) => setCollection.groupByBrowser());
};
