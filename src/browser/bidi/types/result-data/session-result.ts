import { BiDiEmptyResult } from "../generic";
import {
    BiDiSessionProxyConfiguration,
    BiDiSessionSubscription,
    BiDiSessionUserPromptHandler,
} from "../modules/session";

// session.StatusResult
export type BiDiSessionStatusResult = {
    ready: boolean;
    message: string;
};

// session.NewResult
export type BiDiSessionNewResult = {
    sessionId: string;
    capabilities: {
        acceptInsecureCerts: boolean;
        browserName: string;
        browserVersion: string;
        platformName: string;
        setWindowRect: boolean;
        userAgent: string;
        proxy?: BiDiSessionProxyConfiguration;
        unhandledPromptBehavior?: BiDiSessionUserPromptHandler;
        webSocketUrl?: string;
    };
};

// session.EndResult
export type BiDiSessionEndResult = BiDiEmptyResult;

// session.SubscribeResult
export type BiDiSessionSubscribeResult = {
    subscription: BiDiSessionSubscription;
};

// session.UnsubscribeResult
export type BiDiSessionUnsubscribeResult = BiDiEmptyResult;

// SessionResult
export type BiDiSessionResult =
    | BiDiSessionStatusResult
    | BiDiSessionNewResult
    | BiDiSessionEndResult
    | BiDiSessionSubscribeResult
    | BiDiSessionUnsubscribeResult;
