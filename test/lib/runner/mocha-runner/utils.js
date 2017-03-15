'use strict';

const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;

function mkRunnableStub(opts) {
    opts = _.defaults(opts || {}, {
        title: 'default-title',
        parent: null,
        fn: _.noop
    });

    return _.defaults(opts, {
        fullTitle: () => opts.parent ? _.compact([opts.parent.fullTitle(), opts.title]).join(' ') : opts.title
    });
}

function mkSuiteStub(opts) {
    opts = opts || {};

    return mkRunnableStub(_.extend(new EventEmitter(), {
        enableTimeouts: sinon.stub(),
        beforeAll: sinon.stub(),
        afterAll: sinon.stub(),
        tests: [{}],
        ctx: {},
        title: opts.title,
        parent: opts.parent
    }));
}

/*
 * Create mocha suite tree from simple description
 * @example
 * mkTree({
 *     someSuite: ['Test1', 'Test2'],
 *     otherSuite: {
 *         nextSuite: ['Test3']
 *     }
 * });
 *
 * {
 *     parent: null,
 *     title: '',
 *     suites: [
 *         {
 *             title: 'someSuite',
 *             tests: [
 *                 {title: 'Test1'},
 *                 {title: 'Test2'}
 *             ]
 *         },
 *         {
 *             title: 'otherSuite',
 *             suites: [
 *                 {
 *                     title: 'nextSuite',
 *                     tests: [
 *                         {title: 'Test3'}
 *                     ]
 *                 }
 *             ],
 *             tests: []
 *         },
 *     ],
 *     tests: [],
 *     ...
 * }
 */
const mkTree = (sceleton, parent) => {
    const suite = mkRunnableStub({
        title: '',
        parent: parent || null,
        suites: [],
        tests: []
    });

    if (_.isArray(sceleton)) {
        return _.extend(suite, {
            tests: sceleton.map((title) => mkRunnableStub({title, parent: suite}))
        });
    }

    return _.extend(suite, {
        suites: _.map(sceleton, (value, key) => _.extend(mkTree(value, suite), {title: key}))
    });
};

/*
 * Convert mocha tree to plain object
 * (reverse mkTree function)
 */
const treeToObj = (tree) => {
    if (!_.isEmpty(tree.tests)) {
        return {[tree.title]: _.map(tree.tests, 'title')};
    }

    const valuePieces = tree.suites.map(treeToObj);
    const value = _.merge.apply(null, valuePieces) || {};
    return tree.parent ? {[tree.title]: value} : value;
};

exports.mkRunnableStub = mkRunnableStub;
exports.mkSuiteStub = mkSuiteStub;
exports.mkTree = mkTree;
exports.treeToObj = treeToObj;
