"use strict";

const manifest = require("../package.json");
const previews = new Set();

for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, spec] of Object.entries(manifest[field] || {})) {
        if (/^(?:https?:)?\/\/pkg\.pr\.new\//i.test(spec)) {
            previews.add(name);
        }
    }
}

if (previews.size) {
    console.error(
        `Replace PR previews with released npm versions before publishing Testplane: ${[...previews].join(", ")}`,
    );
    process.exitCode = 1;
}
