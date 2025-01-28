import { Testplane } from "../../../testplane";
import { type CommonCmdOpts } from "../../../utils/cli";
export type ListTestsCmd = typeof commander & CommonCmdOpts;
export declare const registerCmd: (cliTool: ListTestsCmd, testplane: Testplane) => void;
