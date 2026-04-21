export const exponentiallyWait = ({
    baseDelay = 500,
    attempt = 0,
    factor = 2,
    jitter = 100,
}: { baseDelay?: number; attempt?: number; factor?: number; jitter?: number } = {}): Promise<void> => {
    const delay = Math.round(baseDelay * factor ** attempt + Math.random() * jitter);

    return new Promise(resolve => setTimeout(resolve, delay).unref());
};
