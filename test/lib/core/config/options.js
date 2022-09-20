'use strict';

const configparser = require('gemini-configparser');
const _ = require('lodash');

const MissingOptionError = require('gemini-configparser').MissingOptionError;

const configOptions = require('lib/core/config/options');

const section = configparser.section;
const option = configparser.option;
const map = configparser.map;

describe('config.sets', () => {
    const anyObject = () => map(option({}));

    const createConfig = (opts) => {
        const options = _.extend({}, opts);
        configOptions.browsers = anyObject();
        const parser = configparser.root(section(configOptions), {envPrefix: ''});

        return parser({
            options: options,
            env: {},
            argv: []
        });
    };

    describe('files', () => {
        it('should throw an error if files are not specified', () => {
            assert.throws(() => {
                createConfig({
                    sets: {
                        someSet: {}
                    }
                });
            }, MissingOptionError);
        });

        it('should convert string to array of strings', () => {
            const config = createConfig({
                sets: {
                    someSet: {
                        files: 'some/path'
                    }
                }
            });

            assert.deepEqual(config.sets.someSet.files, ['some/path']);
        });

        it('should throw an error if files are specified as non-string array', () => {
            assert.throws(() => {
                createConfig({
                    sets: {
                        someSet: {
                            files: [100500]
                        }
                    }
                });
            }, Error, /"sets.files" must be an array of strings/);
        });

        it('should accept array with strings', () => {
            const config = createConfig({
                sets: {
                    someSet: {
                        files: [
                            'some/path',
                            'other/path'
                        ]
                    }
                }
            });

            assert.deepEqual(config.sets.someSet.files, [
                'some/path',
                'other/path'
            ]);
        });
    });

    describe('ignoreFiles', () => {
        it('should accept array with strings', () => {
            const config = createConfig({
                sets: {
                    someSet: {
                        files: ['foo'],
                        ignoreFiles: [
                            'foo/bar',
                            'baz'
                        ]
                    }
                }
            });

            assert.deepEqual(config.sets.someSet.ignoreFiles, [
                'foo/bar',
                'baz'
            ]);
        });

        describe('should throw an error', () => {
            const errorMask = /"sets.ignoreFiles" must be an array of strings/;

            it('if "ignoreFiles" is not array', () => {
                assert.throws(() => {
                    createConfig({
                        sets: {
                            someSet: {
                                files: ['foo'],
                                ignoreFiles: 100500
                            }
                        }
                    });
                }, Error, errorMask);
            });

            it('if "ignoreFiles" are specified as non-string array', () => {
                assert.throws(() => {
                    createConfig({
                        sets: {
                            someSet: {
                                files: ['foo'],
                                ignoreFiles: [100, 500]
                            }
                        }
                    });
                }, Error, errorMask);
            });
        });
    });

    describe('browsers', () => {
        it('should contain all browsers from config by default', () => {
            const config = createConfig({
                browsers: {
                    b1: {},
                    b2: {}
                },
                sets: {
                    someSet: {
                        files: ['some/path']
                    }
                }
            });

            assert.deepEqual(config.sets.someSet.browsers, ['b1', 'b2']);
        });

        it('should throw an error if browsers are not specified as array', () => {
            const config = {
                sets: {
                    someSet: {
                        files: ['some/path'],
                        browsers: 'something'
                    }
                }
            };

            assert.throws(() => createConfig(config), Error, /"sets.browsers" must be an array/);
        });

        it('should throw an error if sets contain unknown browsers', () => {
            assert.throws(() => {
                createConfig({
                    browsers: {
                        b1: {},
                        b2: {}
                    },
                    sets: {
                        someSet: {
                            files: ['some/path'],
                            browsers: ['b3']
                        }
                    }
                });
            }, Error, /Unknown browsers for "sets.browsers": b3/);
        });

        it('should use browsers which are specified in config', () => {
            const config = createConfig({
                browsers: {
                    b1: {},
                    b2: {}
                },
                sets: {
                    set1: {
                        files: ['some/path'],
                        browsers: ['b1']
                    },
                    set2: {
                        files: ['other/path'],
                        browsers: ['b2']
                    }
                }
            });

            assert.deepEqual(config.sets.set1.browsers, ['b1']);
            assert.deepEqual(config.sets.set2.browsers, ['b2']);
        });
    });

    it('should have default set with empty files and all browsers if sets are not specified', () => {
        const config = createConfig({
            browsers: {
                b1: {},
                b2: {}
            }
        });

        assert.deepEqual(config.sets, {'': {files: [], browsers: ['b1', 'b2'], ignoreFiles: []}});
    });
});
