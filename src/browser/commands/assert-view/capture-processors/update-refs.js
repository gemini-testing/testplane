"use strict";

const fs = require("fs-extra");
const { WorkerEvents } = require("../../../../events");

exports.handleNoRefImage = exports.handleImageDiff = async (currImg, refImg, state, { emitter }) => {
    await fs.copy(currImg.path, refImg.path);
    emitter.emit(WorkerEvents.UPDATE_REFERENCE, { state, refImg });
};
