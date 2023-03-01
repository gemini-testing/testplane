import "chai-as-promised";
import Assert = Chai.Assert; // eslint-disable-line no-undef

declare global {
    const assert: typeof import("chai").assert & Assert;
}
