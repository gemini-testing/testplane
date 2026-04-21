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
