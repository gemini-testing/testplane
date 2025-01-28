"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../../utils/logger"));
exports.default = (browser) => {
    const { publicAPI: session } = browser;
    const clearStorage = async (storageName) => {
        try {
            await session.execute(storageName => window[storageName].clear(), storageName);
        }
        catch (e) {
            const message = e.message || "";
            if (message.startsWith(`Failed to read the '${storageName}' property from 'Window'`)) {
                logger_1.default.warn(`Couldn't clear ${storageName}: ${message}`);
            }
            else {
                throw e;
            }
        }
    };
    session.addCommand("clearSession", async function () {
        await session.deleteAllCookies();
        await clearStorage("localStorage");
        await clearStorage("sessionStorage");
    });
};
//# sourceMappingURL=clearSession.js.map