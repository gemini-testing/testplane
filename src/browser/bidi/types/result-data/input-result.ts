import { BiDiEmptyResult } from "../generic";

// input.PerformActionsResult
export type BiDiInputPerformActionsResult = BiDiEmptyResult;

// input.ReleaseActionsResult
export type BiDiInputReleaseActionsResult = BiDiEmptyResult;

// input.SetFilesResult
export type BiDiInputSetFilesResult = BiDiEmptyResult;

// InputResult
export type BiDiInputResult = BiDiInputPerformActionsResult | BiDiInputReleaseActionsResult | BiDiInputSetFilesResult;
