import temp, { AffixOptions } from 'temp';
import path from 'path';
import _ from 'lodash';

temp.track();

type TempConstructorOpts = {
    attach?: boolean;
};
type SerializedTemp = {
    dir: string;
};

class Temp {
    private _tempDir: string;

    constructor(dir: string, opts: TempConstructorOpts = {}) {
        this._tempDir = opts.attach
            ? dir
            : temp.mkdirSync({
                dir: dir && path.resolve(dir),
                prefix: '.screenshots.tmp.'
            });
    }

    path(opts: AffixOptions = {}): string {
        return temp.path(_.extend(opts, {
            dir: this._tempDir
        }));
    }

    serialize(): SerializedTemp {
        return {dir: this._tempDir};
    }
}

let tempInstance: Temp;

export default {
    init: (dir: string): void => {
        if (!tempInstance) {
            tempInstance = new Temp(dir);
        }
    },

    attach: (serializedTemp: SerializedTemp): void => {
        if (!tempInstance) {
            tempInstance = new Temp(serializedTemp.dir, {attach: true});
        }
    },

    path: (opts: AffixOptions): string => tempInstance.path(opts),
    serialize: (): SerializedTemp => tempInstance.serialize()
};
