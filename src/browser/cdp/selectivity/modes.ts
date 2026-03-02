import { SelectivityMode, type SelectivityModeValue } from "../../../config/types";

export const selectivityIsDisabled = (mode: SelectivityModeValue): boolean => mode === SelectivityMode.Disabled;
export const selectivityShouldWrite = (mode: SelectivityModeValue): boolean =>
    mode === SelectivityMode.Enabled || mode === SelectivityMode.WriteOnly;
export const selectivityShouldRead = (mode: SelectivityModeValue): boolean =>
    mode === SelectivityMode.Enabled || mode === SelectivityMode.ReadOnly;
