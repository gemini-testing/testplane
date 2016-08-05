'use strict';

const q = require('q');
const qfs = require('q-io/fs');
const _ = require('lodash');
const glob = require('glob');

const getFilesByMask = (path) => {
    return q.Promise((resolve, reject) => {
        return glob(path, (error, matchedPaths) => {
            if (_.isEmpty(matchedPaths)) {
                throw new Error('Cannot find files by mask ' + path);
            }

            return error ? reject(error) : resolve(matchedPaths);
        });
    });
};

const listJsFiles = (path) => {
    return qfs.listTree(path)
        .then((paths) => paths.filter((path) => qfs.extension(path) === '.js'));
};

const expandPath = (path) => {
    return qfs.stat(path)
        .then((stat) => stat.isDirectory() ? listJsFiles(path) : [path])
        .then((paths) => paths.map((path) => qfs.absolute(path)));
};

const processPaths = (paths, callback) => {
    return _(paths)
        .map(callback)
        .thru(q.all).value()
        .then(_.flatten)
        .then(_.uniq);
};

exports.expandPaths = (paths) => {
    return processPaths(paths, getFilesByMask)
        .then((matchedPaths) => processPaths(matchedPaths, expandPath));
};
