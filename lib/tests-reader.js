'use strict';

var globExtra = require('glob-extra'),
    _ = require('lodash'),
    q = require('q'),
    validateUnknownBrowsers = require('./validators').validateUnknownBrowsers;

const expandJsPaths = (paths) => globExtra.expandPaths(paths, {formats: ['.js']});

module.exports = function(testPaths, browsers, config) {
    var specs = config.specs,
        configBrowsers = _.keys(config.browsers),
        browsersFromSpecs = getBrowsersFromSpecs(specs);

    validateUnknownBrowsers(browsersFromSpecs.concat(browsers), configBrowsers);

    return q.all([
        expandSpecs(specs, configBrowsers),
        expandJsPaths(testPaths)
    ])
    .spread(function(specs, testFiles) {
        return filterSpecs(specs, testFiles, browsers);
    })
    .then(assignBrowsersToTestFiles);
};

function expandSpecs(specs, configBrowsers) {
    return _(specs)
        .map(revealSpec_)
        .thru(q.all)
        .value();

    function revealSpec_(spec) {
        if (!_.isString(spec) && !_.isPlainObject(spec)) {
            throw new TypeError('config.specs must be an array of strings or/and plain objects');
        }

        var paths = _.isString(spec) ? [spec] : spec.files;

        return expandJsPaths(paths)
            .then(function(files) {
                return {
                    files: files,
                    browsers: spec.browsers ? _.intersection(spec.browsers, configBrowsers) : configBrowsers
                };
            });
    }
}

function filterSpecs(specs, testFiles, browsers) {
    return specs.map(function(spec) {
        return {
            files: filterSpec_(spec.files, testFiles),
            browsers: filterSpec_(spec.browsers, browsers)
        };
    });

    function filterSpec_(specValue, value) {
        return _.isEmpty(value) ? specValue : _.intersection(specValue, value);
    }
}

function assignBrowsersToTestFiles(specs) {
    var browsers = getBrowsersFromSpecs(specs);

    return _(browsers)
        .map(getTestFilesForBrowser_)
        .thru(_.zipObject.bind(null, browsers))
        .omit(_.isEmpty)
        .value();

    function getTestFilesForBrowser_(browser) {
        return _(specs)
            .filter(function(spec) {
                return _.contains(spec.browsers, browser);
            })
            .thru(getFilesFromSpecs)
            .value();
    }
}

function getFilesFromSpecs(specs) {
    return getDataFromSpecs(specs, 'files');
}

function getBrowsersFromSpecs(specs) {
    return getDataFromSpecs(specs, 'browsers');
}

function getDataFromSpecs(specs, prop) {
    return _(specs)
        .map(prop)
        .flatten()
        .uniq()
        .value();
}
