import { BIDIEmitter } from "../emitter";
import type { BIDIConnection } from "../connection";
import type {
    BiDiInputFileDialogInfo,
    BiDiInputPerformActionsParameters,
    BiDiInputPerformActionsResult,
    BiDiInputReleaseActionsParameters,
    BiDiInputReleaseActionsResult,
    BiDiInputSetFilesParameters,
    BiDiInputSetFilesResult,
} from "../types";

export interface BiDiInputEvents {
    fileDialogOpened: BiDiInputFileDialogInfo;
}

/** @link https://www.w3.org/TR/webdriver-bidi/#module-input */
export class BiDiInput extends BIDIEmitter<BiDiInputEvents> {
    private readonly _connection: BIDIConnection;

    public constructor(connection: BIDIConnection) {
        super();

        this._connection = connection;
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-input-performActions
     */
    async performActions(params: BiDiInputPerformActionsParameters): Promise<BiDiInputPerformActionsResult> {
        return this._connection.request("input.performActions", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-input-releaseActions
     */
    async releaseActions(params: BiDiInputReleaseActionsParameters): Promise<BiDiInputReleaseActionsResult> {
        return this._connection.request("input.releaseActions", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-input-setFiles
     */
    async setFiles(params: BiDiInputSetFilesParameters): Promise<BiDiInputSetFilesResult> {
        return this._connection.request("input.setFiles", params);
    }
}
