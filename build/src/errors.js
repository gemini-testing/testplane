"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_error_1 = require("./browser/core-error");
const cancelled_error_1 = require("./browser-pool/cancelled-error");
const error_1 = require("./browser/client-bridge/error");
const height_viewport_error_1 = require("./browser/screen-shooter/viewport/coord-validator/errors/height-viewport-error");
const offset_viewport_error_1 = require("./browser/screen-shooter/viewport/coord-validator/errors/offset-viewport-error");
const assert_view_error_1 = require("./browser/commands/assert-view/errors/assert-view-error");
const image_diff_error_1 = require("./browser/commands/assert-view/errors/image-diff-error");
const no_ref_image_error_1 = require("./browser/commands/assert-view/errors/no-ref-image-error");
const Errors = {
    CoreError: core_error_1.CoreError,
    CancelledError: cancelled_error_1.CancelledError,
    ClientBridgeError: error_1.ClientBridgeError,
    HeightViewportError: height_viewport_error_1.HeightViewportError,
    OffsetViewportError: offset_viewport_error_1.OffsetViewportError,
    AssertViewError: assert_view_error_1.AssertViewError,
    ImageDiffError: image_diff_error_1.ImageDiffError,
    NoRefImageError: no_ref_image_error_1.NoRefImageError,
};
exports.default = Errors;
//# sourceMappingURL=errors.js.map