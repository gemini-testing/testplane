import * as RuntimeConfig from "../../../../config/runtime-config.js";
import assertRefs from "./assert-refs.js";
import updateRefs from "./update-refs.js";

export const getCaptureProcessors = () => (RuntimeConfig.getInstance().updateRefs ? updateRefs : assertRefs);
