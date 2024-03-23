import fs from "fs-extra";
import { WorkerEvents } from "../../../../events/index.js";

export const handleNoRefImage = async (currImg, refImg, state, { emitter }) => {
    await fs.copy(currImg.path, refImg.path);
    emitter.emit(WorkerEvents.UPDATE_REFERENCE, { state, refImg });
};
export const handleImageDiff = handleNoRefImage;
