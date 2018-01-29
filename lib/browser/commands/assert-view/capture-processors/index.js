'use strict';

const RuntimeConfig = require('../../../../config/runtime-config');

const assertRefsMode = require('./assert-refs');
const updateRefsMode = require('./update-refs');

exports.getCaptureProcessors = () => RuntimeConfig.getInstance().updateRefs ? updateRefsMode : assertRefsMode;
