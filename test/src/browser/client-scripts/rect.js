'use strict';

const Rect = require('src/browser/client-scripts/rect').Rect;

describe('Rect', () => {
    const rect = new Rect({
        left: 20,
        top: 10,
        width: 100,
        height: 100
    });

    describe('constructor', () => {
        it('should create instance using width/height properties', () => {
            assert.doesNotThrow(() => {
                return new Rect({
                    left: 20,
                    top: 10,
                    width: 100,
                    height: 100
                });
            });
        });

        it('should create instance using bottom/right properties', () => {
            assert.doesNotThrow(() => {
                return new Rect({
                    top: 10,
                    left: 20,
                    bottom: 100,
                    right: 100
                });
            });
        });

        it('should fail when there are no bottom/right or width/height properties', () => {
            assert.throws(() => {
                return new Rect({top: 10, left: 20});
            });
        });
    });

    describe('isRect', () => {
        it('should return false if argument is not an object', () => {
            assert.isFalse(Rect.isRect('foo'));
        });

        it('should return false if argument is null', () => {
            assert.isFalse(Rect.isRect(null));
        });

        it('should return false if argument is array', () => {
            assert.isFalse(Rect.isRect([]));
        });

        it('should return false if argument has no left property', () => {
            assert.isFalse(Rect.isRect({
                top: 1,
                width: 1,
                height: 1
            }));
        });

        it('should return false if argument has no top property', () => {
            assert.isFalse(Rect.isRect({
                left: 1,
                width: 1,
                height: 1
            }));
        });

        it('should return false if argument has no width property, but has height', () => {
            assert.isFalse(Rect.isRect({
                left: 1,
                top: 1,
                height: 1
            }));
        });

        it('should return false if argument has no height property, but has width', () => {
            assert.isFalse(Rect.isRect({
                left: 1,
                top: 1,
                width: 1
            }));
        });

        it('should return false if argument has no right property, but has bottom', () => {
            assert.isFalse(Rect.isRect({
                left: 1,
                top: 1,
                bottom: 1
            }));
        });

        it('should return false if argument has no bottom property, but has right', () => {
            assert.isFalse(Rect.isRect({
                left: 1,
                top: 1,
                right: 1
            }));
        });

        it('should return true if argument has left, top, width, height properties', () => {
            assert.isTrue(Rect.isRect({
                left: 1,
                top: 1,
                width: 1,
                height: 1
            }));
        });

        it('should return true if argument has left, top, right, bottom properties', () => {
            assert.isTrue(Rect.isRect({
                left: 1,
                top: 1,
                right: 1,
                bottom: 1
            }));
        });
    });

    describe('rectInside', () => {
        it('should return true when rect is inside', () => {
            assert.isTrue(rect.rectInside(
                new Rect({
                    left: rect.left + 10,
                    top: rect.top + 10,
                    width: rect.width - 50,
                    height: rect.height - 50
                })
            ));
        });

        it('should return false when rect is not inside', () => {
            assert.isFalse(rect.rectInside(
                new Rect({
                    left: rect.left - 5,
                    top: rect.top - 5,
                    width: rect.width,
                    height: rect.width
                })
            ));
        });

        it('should return false when rect intersects on top-left', () => {
            assert.isFalse(rect.rectInside(
                new Rect({
                    left: rect.left - 5,
                    top: rect.top + 5,
                    width: rect.width + 5,
                    height: rect.height - 5
                })
            ));
        });

        it('should return false when rect intersects on bottom-right', () => {
            assert.isFalse(new Rect({
                left: rect.left - 5,
                top: rect.top + 5,
                width: rect.width + 5,
                height: rect.height - 5
            }).rectInside(rect));
        });
    });

    describe('rectIntersects', () => {
        describe('should return true when rect', () => {
            it('intersects on left side', () => {
                assert.isTrue(rect.rectIntersects(
                    new Rect({
                        left: rect.left - 5,
                        top: rect.top + 5,
                        width: rect.width - 5,
                        height: rect.height - 5
                    })
                ));
            });

            it('intersects on top side', () => {
                assert.isTrue(rect.rectIntersects(
                    new Rect({
                        left: rect.left + 5,
                        top: rect.top + 5,
                        width: rect.width - 5,
                        height: rect.height + 5
                    })
                ));
            });

            it('intersects on right side', () => {
                assert.isTrue(rect.rectIntersects(
                    new Rect({
                        left: rect.left + 5,
                        top: rect.top + 5,
                        width: rect.width + 5,
                        height: rect.height - 5
                    })
                ));
            });

            it('intersects on bottom side', () => {
                assert.isTrue(rect.rectIntersects(
                    new Rect({
                        left: rect.left + 5,
                        top: rect.top - 5,
                        width: rect.width - 5,
                        height: rect.height - 5
                    })
                ));
            });

            it('intersects on left and right sides', () => {
                assert.isTrue(rect.rectIntersects(
                    new Rect({
                        left: rect.left - 5,
                        top: rect.top + 5,
                        width: rect.width + 5,
                        height: rect.height - 5
                    })
                ));
            });
        });

        describe('should return false when rect is near on the', () => {
            it('top', () => {
                assert.isFalse(rect.rectIntersects(
                    new Rect({
                        left: rect.left + 1,
                        top: rect.top - 1,
                        width: 1,
                        height: 1
                    })
                ));
            });

            it('left', () => {
                assert.isFalse(rect.rectIntersects(
                    new Rect({
                        left: rect.left - 1,
                        top: rect.top + 1,
                        width: 1,
                        height: 1
                    })
                ));
            });

            it('bottom', () => {
                assert.isFalse(rect.rectIntersects(
                    new Rect({
                        left: rect.left + 1,
                        top: rect.top + rect.height,
                        width: 1,
                        height: 1
                    })
                ));
            });

            it('right', () => {
                assert.isFalse(rect.rectIntersects(
                    new Rect({
                        left: rect.left + rect.width,
                        top: rect.top + 1,
                        width: 1,
                        height: 1
                    })
                ));
            });
        });
    });
});
