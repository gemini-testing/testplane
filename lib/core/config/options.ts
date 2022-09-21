import _ from 'lodash';
import { section, map, option } from 'gemini-configparser';

export type SetConfig = {
    files: Array<string>;
    ignoreFiles: Array<string>;
    browsers: Array<string>;
};

export type SetsConfig = {
    [platform: string]: SetConfig;
};

export default {
    sets: map<SetsConfig, any>(section({
        files: option({
            defaultValue: [] as Array<string>,
            validate: (value): asserts value is Array<string> => {
                if (!_.isArray(value) && !_.isString(value)) {
                    throw new Error('"sets.files" must be an array or string');
                }

                if (_.isArray(value) && !_.every(value, _.isString)) {
                    throw new Error('"sets.files" must be an array of strings');
                }
            },
            map: (val: string | Array<string>): Array<string> => ([] as Array<string>).concat(val)
        }),
        ignoreFiles: option({
            defaultValue: [] as Array<string>,
            validate: (value): asserts value is Array<string> => {
                if (!_.isArray(value) || !_.every(value, _.isString)) {
                    throw new Error('"sets.ignoreFiles" must be an array of strings');
                }
            }
        }),
        browsers: option({
            defaultValue: (config): Array<string> => _.keys(config.browsers),
            validate: (value, config): asserts value is Array<string> => {
                if (!_.isArray(value)) {
                    throw new Error('"sets.browsers" must be an array');
                }

                const unknownBrowsers = _.difference(value, _.keys(config.browsers));
                if (!_.isEmpty(unknownBrowsers)) {
                    throw new Error(`Unknown browsers for "sets.browsers": ${unknownBrowsers.join(', ')}`);
                }
            }
        })
    }), {
        '': {files: [], ignoreFiles: []} // Use `all` set with default values if sets were not specified in a config
    })
};
