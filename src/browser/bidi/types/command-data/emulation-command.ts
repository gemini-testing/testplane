import { JsUInt } from "../generic";
import { BiDiBrowserUserContext } from "../modules/browser";
import { BiDiBrowsingContextBrowsingContext } from "../modules/browsing-context";

// emulation.SetForcedColorsModeThemeOverride
export type BiDiEmulationSetForcedColorsModeThemeOverrideCommand = {
    method: "emulation.setForcedColorsModeThemeOverride";
    params: BiDiEmulationSetForcedColorsModeThemeOverrideParameters;
};

// emulation.SetForcedColorsModeThemeOverrideParameters
export type BiDiEmulationSetForcedColorsModeThemeOverrideParameters = {
    theme: BiDiEmulationForcedColorsModeTheme | null;
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
};

// emulation.ForcedColorsModeTheme
export type BiDiEmulationForcedColorsModeTheme = "light" | "dark";

// emulation.SetGeolocationOverride
export type BiDiEmulationSetGeolocationOverrideCommand = {
    method: "emulation.setGeolocationOverride";
    params: BiDiEmulationSetGeolocationOverrideParameters;
};

// emulation.SetGeolocationOverrideParameters
export type BiDiEmulationSetGeolocationOverrideParameters = {
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
} & ({ coordinates: BiDiEmulationGeolocationCoordinates | null } | { error: BiDiEmulationGeolocationPositionError });

// emulation.GeolocationCoordinates
export type BiDiEmulationGeolocationCoordinates = {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
};

// emulation.GeolocationPositionError
export type BiDiEmulationGeolocationPositionError = {
    type: "positionUnavailable";
};

// emulation.SetLocaleOverride
export type BiDiEmulationSetLocaleOverrideCommand = {
    method: "emulation.setLocaleOverride";
    params: BiDiEmulationSetLocaleOverrideParameters;
};

// emulation.SetLocaleOverrideParameters
export type BiDiEmulationSetLocaleOverrideParameters = {
    locale: string | null;
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
};

// emulation.SetNetworkConditions
export type BiDiEmulationSetNetworkConditionsCommand = {
    method: "emulation.setNetworkConditions";
    params: BiDiEmulationSetNetworkConditionsParameters;
};

// emulation.SetNetworkConditionsParameters
export type BiDiEmulationSetNetworkConditionsParameters = {
    networkConditions: BiDiEmulationNetworkConditions | null;
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
};

// emulation.NetworkConditions
export type BiDiEmulationNetworkConditions = BiDiEmulationNetworkConditionsOffline;

// emulation.NetworkConditionsOffline
export type BiDiEmulationNetworkConditionsOffline = {
    type: "offline";
};

// emulation.SetScreenOrientationOverride
export type BiDiEmulationSetScreenOrientationOverrideCommand = {
    method: "emulation.setScreenOrientationOverride";
    params: BiDiEmulationSetScreenOrientationOverrideParameters;
};

// emulation.SetScreenOrientationOverrideParameters
export type BiDiEmulationSetScreenOrientationOverrideParameters = {
    screenOrientation: BiDiEmulationScreenOrientation | null;
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
};

// emulation.ScreenOrientationNatural
export type BiDiEmulationScreenOrientationNatural = "portrait" | "landscape";

// emulation.ScreenOrientationType
export type BiDiEmulationScreenOrientationType =
    | "portrait-primary"
    | "portrait-secondary"
    | "landscape-primary"
    | "landscape-secondary";

// emulation.ScreenOrientation
export type BiDiEmulationScreenOrientation = {
    natural: BiDiEmulationScreenOrientationNatural;
    type: BiDiEmulationScreenOrientationType;
};

// emulation.SetScreenSettingsOverride
export type BiDiEmulationSetScreenSettingsOverrideCommand = {
    method: "emulation.setScreenSettingsOverride";
    params: BiDiEmulationSetScreenSettingsOverrideParameters;
};

// emulation.SetScreenSettingsOverrideParameters
export type BiDiEmulationSetScreenSettingsOverrideParameters = {
    screenArea: BiDiEmulationScreenArea | null;
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
};

// emulation.ScreenArea
export type BiDiEmulationScreenArea = {
    width: JsUInt;
    height: JsUInt;
};

// emulation.SetScriptingEnabled
export type BiDiEmulationSetScriptingEnabledCommand = {
    method: "emulation.setScriptingEnabled";
    params: BiDiEmulationSetScriptingEnabledParameters;
};

// emulation.SetScriptingEnabledParameters
export type BiDiEmulationSetScriptingEnabledParameters = {
    enabled: false | null;
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
};

// emulation.SetScrollbarTypeOverride
export type BiDiEmulationSetScrollbarTypeOverrideCommand = {
    method: "emulation.setScrollbarTypeOverride";
    params: BiDiEmulationSetScrollbarTypeOverrideParameters;
};

// emulation.SetScrollbarTypeOverrideParameters
export type BiDiEmulationSetScrollbarTypeOverrideParameters = {
    scrollbarType: "classic" | "overlay" | null;
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
};

// emulation.SetTimezoneOverride
export type BiDiEmulationSetTimezoneOverrideCommand = {
    method: "emulation.setTimezoneOverride";
    params: BiDiEmulationSetTimezoneOverrideParameters;
};

// emulation.SetTimezoneOverrideParameters
export type BiDiEmulationSetTimezoneOverrideParameters = {
    timezone: string | null;
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
};

// emulation.SetTouchOverride
export type BiDiEmulationSetTouchOverrideCommand = {
    method: "emulation.setTouchOverride";
    params: BiDiEmulationSetTouchOverrideParameters;
};

// emulation.SetTouchOverrideParameters
export type BiDiEmulationSetTouchOverrideParameters = {
    maxTouchPoints: JsUInt | null;
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
};

// emulation.SetUserAgentOverride
export type BiDiEmulationSetUserAgentOverrideCommand = {
    method: "emulation.setUserAgentOverride";
    params: BiDiEmulationSetUserAgentOverrideParameters;
};

// emulation.SetUserAgentOverrideParameters
export type BiDiEmulationSetUserAgentOverrideParameters = {
    userAgent: string | null;
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
};

// EmulationCommand
export type BiDiEmulationCommand =
    | BiDiEmulationSetForcedColorsModeThemeOverrideCommand
    | BiDiEmulationSetGeolocationOverrideCommand
    | BiDiEmulationSetLocaleOverrideCommand
    | BiDiEmulationSetNetworkConditionsCommand
    | BiDiEmulationSetScreenOrientationOverrideCommand
    | BiDiEmulationSetScreenSettingsOverrideCommand
    | BiDiEmulationSetScriptingEnabledCommand
    | BiDiEmulationSetScrollbarTypeOverrideCommand
    | BiDiEmulationSetTimezoneOverrideCommand
    | BiDiEmulationSetTouchOverrideCommand
    | BiDiEmulationSetUserAgentOverrideCommand;
