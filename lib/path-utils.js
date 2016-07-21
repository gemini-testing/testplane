'use strict';

const q = require('q');
const qfs = require('q-io/fs');
const _ = require('lodash');
const glob = require('glob');

const getFilesByTemplate = (path) => {
    return q.Promise((resolve, reject) => {
        return glob(path, (err, files) => err ? reject(err) : resolve(files));
    });
};

const listJsFiles = (path) => {
    return qfs.listTree(path, (path) => qfs.extension(path) === '.js');
};

const expandPath = (path) => {
    return qfs.stat(path)
        .then((stat) => stat.isDirectory() ? listJsFiles(path) : [path])
        .catch((e) => {
            return [];
        })
        .then((paths) => paths.map((path) => qfs.absolute(path)));
};

const processPaths = (paths, handler) => {
    return _(paths)
        .map(handler)
        .thru(q.all).value()
        .then(_.flatten);
};

exports.expandPaths = (paths) => {
    return processPaths(paths, getFilesByTemplate)
        .then((result) => processPaths(result, expandPath));
};
