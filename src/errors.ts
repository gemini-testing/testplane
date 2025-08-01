import { CoreError } from "./browser/core-error";
import { CancelledError } from "./browser-pool/cancelled-error";
import { ClientBridgeError } from "./browser/client-bridge/error";
import { HeightViewportError } from "./browser/screen-shooter/viewport/coord-validator/errors/height-viewport-error";
import { OffsetViewportError } from "./browser/screen-shooter/viewport/coord-validator/errors/offset-viewport-error";
import { AssertViewError } from "./browser/commands/assert-view/errors/assert-view-error";
import { ImageDiffError } from "./browser/commands/assert-view/errors/image-diff-error";
import { NoRefImageError } from "./browser/commands/assert-view/errors/no-ref-image-error";
import { TestplaneInternalError } from "./errors/testplane-internal-error";
import { AbortOnReconnectError } from "./errors/abort-on-reconnect-error";
import type { Constructor } from "type-fest";

const Errors = {
    CoreError,
    CancelledError,
    ClientBridgeError,
    HeightViewportError,
    OffsetViewportError,
    AssertViewError,
    ImageDiffError,
    NoRefImageError,
    TestplaneInternalError,
    AbortOnReconnectError,
} as const satisfies Record<string, Constructor<Error>>;

export default Errors;
