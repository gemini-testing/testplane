import type {Coverage} from './coverage';
import type {SerializedRect} from './rect';

export interface Page {
    captureArea: SerializedRect;
    ignoreAreas: Array<SerializedRect>;
    viewport: SerializedRect;
    documentHeight: number;
    documentWidth: number;
    coverage: Coverage;
    canHaveCaret: boolean;
    pixelRatio: number;
}
