export const exponentiallyWait = ({
    baseDelay = 500,
    attempt = 0,
    factor = 2,
    jitter = 100,
}: { baseDelay?: number; attempt?: number; factor?: number; jitter?: number } = {}): Promise<void> => {
    const delay = Math.round(baseDelay * factor ** attempt + Math.random() * jitter);

    return new Promise(resolve => setTimeout(resolve, delay).unref());
};

export const extractRequestIdFromBrokenResponse = (message: string): number | null => {
    const idStartMarker = '{"id":';

    if (!message.startsWith(idStartMarker)) {
        return null;
    }

    const idEndPosition = message.indexOf(",");

    if (idEndPosition === -1) {
        return null;
    }

    const idPart = message.slice(idStartMarker.length, idEndPosition);
    const requestId = Number(idPart);

    return isNaN(requestId) ? null : requestId;
};
