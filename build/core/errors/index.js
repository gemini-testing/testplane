"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OffsetViewportError = exports.HeightViewportError = exports.ClientBridgeError = exports.CancelledError = exports.CoreError = void 0;
var core_error_1 = require("./core-error");
Object.defineProperty(exports, "CoreError", { enumerable: true, get: function () { return __importDefault(core_error_1).default; } });
var cancelled_error_1 = require("./cancelled-error");
Object.defineProperty(exports, "CancelledError", { enumerable: true, get: function () { return __importDefault(cancelled_error_1).default; } });
var client_bridge_error_1 = require("./client-bridge-error");
Object.defineProperty(exports, "ClientBridgeError", { enumerable: true, get: function () { return __importDefault(client_bridge_error_1).default; } });
var height_viewport_error_1 = require("../screen-shooter/viewport/coord-validator/errors/height-viewport-error");
Object.defineProperty(exports, "HeightViewportError", { enumerable: true, get: function () { return __importDefault(height_viewport_error_1).default; } });
var offset_viewport_error_1 = require("../screen-shooter/viewport/coord-validator/errors/offset-viewport-error");
Object.defineProperty(exports, "OffsetViewportError", { enumerable: true, get: function () { return __importDefault(offset_viewport_error_1).default; } });
