'use strict';

const fs = require('fs-extra');

exports.handleNoRefImage = exports.handleImageDiff = (currImg, refImg) => fs.copy(currImg.path, refImg.path);
