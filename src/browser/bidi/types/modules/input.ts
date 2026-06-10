import { JsInt, JsUInt } from "../generic";
import { BiDiScriptSharedReference } from "./script";

// input.ElementOrigin
export type BiDiInputElementOrigin = {
    type: "element";
    element: BiDiScriptSharedReference;
};

// input.Origin
export type BiDiInputOrigin = "viewport" | "pointer" | BiDiInputElementOrigin;

// input.PointerCommonProperties
export type BiDiInputPointerCommonProperties = {
    width?: JsUInt;
    height?: JsUInt;
    pressure?: number;
    tangentialPressure?: number;
    twist?: number;
    altitudeAngle?: number;
    azimuthAngle?: number;
};

// input.PauseAction
export type BiDiInputPauseAction = {
    type: "pause";
    duration?: JsUInt;
};

// input.KeyDownAction
export type BiDiInputKeyDownAction = {
    type: "keyDown";
    value: string;
};

// input.KeyUpAction
export type BiDiInputKeyUpAction = {
    type: "keyUp";
    value: string;
};

// input.PointerUpAction
export type BiDiInputPointerUpAction = {
    type: "pointerUp";
    button: JsUInt;
};

// input.PointerDownAction
export type BiDiInputPointerDownAction = {
    type: "pointerDown";
    button: JsUInt;
} & BiDiInputPointerCommonProperties;

// input.PointerMoveAction
export type BiDiInputPointerMoveAction = {
    type: "pointerMove";
    x: number;
    y: number;
    duration?: JsUInt;
    origin?: BiDiInputOrigin;
} & BiDiInputPointerCommonProperties;

// input.WheelScrollAction
export type BiDiInputWheelScrollAction = {
    type: "scroll";
    x: JsInt;
    y: JsInt;
    deltaX: JsInt;
    deltaY: JsInt;
    duration?: JsUInt;
    origin?: BiDiInputOrigin;
};

// input.NoneSourceAction
export type BiDiInputNoneSourceAction = BiDiInputPauseAction;

// input.KeySourceAction
export type BiDiInputKeySourceAction = BiDiInputPauseAction | BiDiInputKeyDownAction | BiDiInputKeyUpAction;

// input.PointerType
export type BiDiInputPointerType = "mouse" | "pen" | "touch";

// input.PointerParameters
export type BiDiInputPointerParameters = {
    pointerType?: BiDiInputPointerType;
};

// input.PointerSourceAction
export type BiDiInputPointerSourceAction =
    | BiDiInputPauseAction
    | BiDiInputPointerDownAction
    | BiDiInputPointerUpAction
    | BiDiInputPointerMoveAction;

// input.WheelSourceAction
export type BiDiInputWheelSourceAction = BiDiInputPauseAction | BiDiInputWheelScrollAction;

// input.NoneSourceActions
export type BiDiInputNoneSourceActions = {
    type: "none";
    id: string;
    actions: BiDiInputNoneSourceAction[];
};

// input.KeySourceActions
export type BiDiInputKeySourceActions = {
    type: "key";
    id: string;
    actions: BiDiInputKeySourceAction[];
};

// input.PointerSourceActions
export type BiDiInputPointerSourceActions = {
    type: "pointer";
    id: string;
    parameters?: BiDiInputPointerParameters;
    actions: BiDiInputPointerSourceAction[];
};

// input.WheelSourceActions
export type BiDiInputWheelSourceActions = {
    type: "wheel";
    id: string;
    actions: BiDiInputWheelSourceAction[];
};

// input.SourceActions
export type BiDiInputSourceActions =
    | BiDiInputNoneSourceActions
    | BiDiInputKeySourceActions
    | BiDiInputPointerSourceActions
    | BiDiInputWheelSourceActions;
