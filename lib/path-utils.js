'use strict';

var q = require('q'),
    fs = require('q-io/fs'),
    _ = require('lodash'),
    glob = require('glob');

function getFilesByTemplate(path) {
    var deferred = q.defer();

    glob(path, function(err, files) {
        return err ? deferred.reject(err) : deferred.resolve(files);
    });

    return deferred.promise;
}

function expandPath(path) {
    return fs.stat(path)
        .then(function(stat) {
            if (!stat.isDirectory()) {
                return [path];
            }
            return fs.listTree(path, function(path) {
                return fs.extension(path) === '.js';
            });
        })
        .catch(function(e) {
            return [];
        })
        .then(function(paths) {
            return paths.map(fs.absolute.bind(fs));
        });
}

exports.expandPaths = function expandPaths(paths) {
        return _(paths)
            .map(getFilesByTemplate)
            .thru(q.all).value()
            .then(_.flatten)
            .then(function(result) {
                return _(result).map(expandPath)
                    .thru(q.all).value()
                    .then(_.flatten)
            })
};
