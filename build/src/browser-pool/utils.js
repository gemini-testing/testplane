"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCompositeBrowserId = void 0;
const buildCompositeBrowserId = (browserId, version) => version ? `${browserId}.${version}` : browserId;
exports.buildCompositeBrowserId = buildCompositeBrowserId;
//# sourceMappingURL=utils.js.map