declare global {
    // eslint-disable-next-line no-var
    var trustedTypes:
        | {
              createPolicy(name: string, rules: { createHTML: (string: string) => string }): void;
          }
        | undefined;
}

export function createDefaultTrustedTypesPolicy(): void {
    const w = window;
    if (w.trustedTypes && w.trustedTypes.createPolicy) {
        w.trustedTypes.createPolicy("default", {
            createHTML: function (string: string) {
                return string;
            }
        });
    }
}
