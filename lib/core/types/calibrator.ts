export type Features = {
    needsCompatLib: boolean;
    pixelRatio: number;
    innerWidth: number;
};

export type CalibrationResult = Features & {
    top: number;
    left: number;
    usePixelRatio: boolean;
};
