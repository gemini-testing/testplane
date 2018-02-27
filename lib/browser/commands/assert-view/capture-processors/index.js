'use strict';

const RuntimeConfig = require('../../../../config/runtime-config');

const assertRefs = require('./assert-refs');
const updateRefs = require('./update-refs');

exports.getCaptureProcessors = () => RuntimeConfig.getInstance().updateRefs ? updateRefs : assertRefs;
