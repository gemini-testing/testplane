'use strict';

const path = require('path');
const chai = require('chai');

global.sinon = require('sinon');
global.assert = chai.assert;

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
sinon.assert.expose(chai.assert, {prefix: ''});

require('app-module-path').addPath(path.resolve(__dirname, '..'));
