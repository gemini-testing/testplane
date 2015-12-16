'use strict';

var chai = require('chai');

global.sinon = require('sinon');
global.assert = chai.assert;

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
sinon.assert.expose(chai.assert, {prefix: ''});
