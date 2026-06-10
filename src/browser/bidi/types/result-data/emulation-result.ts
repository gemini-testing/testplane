import { BiDiEmptyResult } from "../generic";

// emulation.SetForcedColorsModeThemeOverrideResult
export type BiDiEmulationSetForcedColorsModeThemeOverrideResult = BiDiEmptyResult;

// emulation.SetGeolocationOverrideResult
export type BiDiEmulationSetGeolocationOverrideResult = BiDiEmptyResult;

// emulation.SetLocaleOverrideResult
export type BiDiEmulationSetLocaleOverrideResult = BiDiEmptyResult;

// emulation.SetNetworkConditionsResult
export type BiDiEmulationSetNetworkConditionsResult = BiDiEmptyResult;

// emulation.SetScreenOrientationOverrideResult
export type BiDiEmulationSetScreenOrientationOverrideResult = BiDiEmptyResult;

// emulation.SetScreenSettingsOverrideResult
export type BiDiEmulationSetScreenSettingsOverrideResult = BiDiEmptyResult;

// emulation.SetScriptingEnabledResult
export type BiDiEmulationSetScriptingEnabledResult = BiDiEmptyResult;

// emulation.SetScrollbarTypeOverrideResult
export type BiDiEmulationSetScrollbarTypeOverrideResult = BiDiEmptyResult;

// emulation.SetTimezoneOverrideResult
export type BiDiEmulationSetTimezoneOverrideResult = BiDiEmptyResult;

// emulation.SetTouchOverrideResult
export type BiDiEmulationSetTouchOverrideResult = BiDiEmptyResult;

// emulation.SetUserAgentOverrideResult
export type BiDiEmulationSetUserAgentOverrideResult = BiDiEmptyResult;

// EmulationResult
export type BiDiEmulationResult =
    | BiDiEmulationSetForcedColorsModeThemeOverrideResult
    | BiDiEmulationSetGeolocationOverrideResult
    | BiDiEmulationSetLocaleOverrideResult
    | BiDiEmulationSetScreenOrientationOverrideResult
    | BiDiEmulationSetScriptingEnabledResult
    | BiDiEmulationSetScrollbarTypeOverrideResult
    | BiDiEmulationSetTimezoneOverrideResult
    | BiDiEmulationSetTouchOverrideResult
    | BiDiEmulationSetUserAgentOverrideResult;
