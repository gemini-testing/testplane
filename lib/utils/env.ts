export const parseCommaSeparatedValue = (name: string): Array<string> => {
    const value = process.env[name];

    return value ? value.split(/, */) : [];
};
