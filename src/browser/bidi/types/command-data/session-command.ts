import { BiDiEmptyParams } from "../generic";
import {
    BiDiSessionCapabilitiesRequest,
    BiDiSessionSubscribeParameters,
    BiDiSessionUnsubscribeByAttributesRequest,
    BiDiSessionUnsubscribeByIDRequest,
} from "../modules/session";

// session.Status
export type BiDiSessionStatusCommand = {
    method: "session.status";
    params: BiDiEmptyParams;
};

// session.New
export type BiDiSessionNewCommand = {
    method: "session.new";
    params: BiDiSessionNewParameters;
};

// session.NewParameters
export type BiDiSessionNewParameters = {
    capabilities: BiDiSessionCapabilitiesRequest;
};

// session.End
export type BiDiSessionEndCommand = {
    method: "session.end";
    params: BiDiEmptyParams;
};

// session.Subscribe
export type BiDiSessionSubscribeCommand = {
    method: "session.subscribe";
    params: BiDiSessionSubscribeParameters;
};

// session.Unsubscribe
export type BiDiSessionUnsubscribeCommand = {
    method: "session.unsubscribe";
    params: BiDiSessionUnsubscribeParameters;
};

// session.UnsubscribeParameters
export type BiDiSessionUnsubscribeParameters =
    | BiDiSessionUnsubscribeByAttributesRequest
    | BiDiSessionUnsubscribeByIDRequest;

// SessionCommand
export type BiDiSessionCommand =
    | BiDiSessionStatusCommand
    | BiDiSessionNewCommand
    | BiDiSessionEndCommand
    | BiDiSessionSubscribeCommand
    | BiDiSessionUnsubscribeCommand;
