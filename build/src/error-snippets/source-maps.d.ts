import { type BasicSourceMapConsumer } from "source-map";
import type { SufficientStackFrame, ResolvedFrame } from "./types";
export declare const extractSourceMaps: (fileContents: string, fileName: string) => Promise<BasicSourceMapConsumer | null>;
export declare const resolveLocationWithSourceMap: (stackFrame: SufficientStackFrame, sourceMaps: BasicSourceMapConsumer) => ResolvedFrame;
