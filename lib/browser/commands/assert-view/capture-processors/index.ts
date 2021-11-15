import * as RuntimeConfig from '../../../../config/runtime-config';

import assertRefs from './assert-refs';
import updateRefs from './update-refs';

export const getCaptureProcessors = () => RuntimeConfig.getInstance().updateRefs ? updateRefs : assertRefs;
