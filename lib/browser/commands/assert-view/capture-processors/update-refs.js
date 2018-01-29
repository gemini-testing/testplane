'use strict';

const fs = require('fs-extra');

exports.handleNoRefImage = exports.handleImageDiff = (currPath, refPath) => fs.copy(currPath, refPath);
