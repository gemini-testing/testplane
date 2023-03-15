"use strict";

exports.CoreError = require("./browser/core-error");
exports.CancelledError = require("./browser-pool/cancelled-error");
exports.ClientBridgeError = require("./browser/client-bridge/error");
exports.HeightViewportError = require("./browser/screen-shooter/viewport/coord-validator/errors/height-viewport-error");
exports.OffsetViewportError = require("./browser/screen-shooter/viewport/coord-validator/errors/offset-viewport-error");
exports.AssertViewError = require("./browser/commands/assert-view/errors/assert-view-error");
exports.ImageDiffError = require("./browser/commands/assert-view/errors/image-diff-error");
exports.NoRefImageError = require("./browser/commands/assert-view/errors/no-ref-image-error");
