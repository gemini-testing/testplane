import { CoreError } from "./browser/core-error.js";
import { CancelledError } from "./browser-pool/cancelled-error.js";
import { ClientBridgeError } from "./browser/client-bridge/error.js";
import { HeightViewportError } from "./browser/screen-shooter/viewport/coord-validator/errors/height-viewport-error.js";
import { OffsetViewportError } from "./browser/screen-shooter/viewport/coord-validator/errors/offset-viewport-error.js";
import { AssertViewError } from "./browser/commands/assert-view/errors/assert-view-error.js";
import { ImageDiffError } from "./browser/commands/assert-view/errors/image-diff-error.js";
import { NoRefImageError } from "./browser/commands/assert-view/errors/no-ref-image-error.js";
import { Constructor } from "type-fest";

const Errors = {
    CoreError,
    CancelledError,
    ClientBridgeError,
    HeightViewportError,
    OffsetViewportError,
    AssertViewError,
    ImageDiffError,
    NoRefImageError,
} as const satisfies Record<string, Constructor<Error>>;

export default Errors;
