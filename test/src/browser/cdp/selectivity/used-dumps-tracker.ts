import { UsedDumpsTracker } from "src/browser/cdp/selectivity/used-dumps-tracker";

describe("UsedDumpsTracker", () => {
    let tracker: UsedDumpsTracker;

    beforeEach(() => {
        tracker = new UsedDumpsTracker();
    });

    describe("trackUsed", () => {
        it("should track a dump for a given path", () => {
            tracker.trackUsed("dump-1", "/path/a");

            assert.isTrue(tracker.wasUsed("dump-1", "/path/a"));
        });

        it("should track multiple dumps for the same path", () => {
            tracker.trackUsed("dump-1", "/path/a");
            tracker.trackUsed("dump-2", "/path/a");

            assert.isTrue(tracker.wasUsed("dump-1", "/path/a"));
            assert.isTrue(tracker.wasUsed("dump-2", "/path/a"));
        });

        it("should track dumps for different paths independently", () => {
            tracker.trackUsed("dump-1", "/path/a");
            tracker.trackUsed("dump-2", "/path/b");

            assert.isTrue(tracker.wasUsed("dump-1", "/path/a"));
            assert.isFalse(tracker.wasUsed("dump-2", "/path/a"));
            assert.isTrue(tracker.wasUsed("dump-2", "/path/b"));
            assert.isFalse(tracker.wasUsed("dump-1", "/path/b"));
        });
    });

    describe("usedDumpsFor", () => {
        it("should return false for unknown path", () => {
            assert.isFalse(tracker.usedDumpsFor("/unknown"));
        });

        it("should return true after tracking a dump", () => {
            tracker.trackUsed("dump-1", "/path/a");

            assert.isTrue(tracker.usedDumpsFor("/path/a"));
        });
    });

    describe("wasUsed", () => {
        it("should return false for unknown path", () => {
            assert.isFalse(tracker.wasUsed("dump-1", "/unknown"));
        });

        it("should return false for untracked dump", () => {
            tracker.trackUsed("dump-1", "/path/a");

            assert.isFalse(tracker.wasUsed("dump-2", "/path/a"));
        });

        it("should return true for tracked dump", () => {
            tracker.trackUsed("dump-1", "/path/a");

            assert.isTrue(tracker.wasUsed("dump-1", "/path/a"));
        });
    });
});
