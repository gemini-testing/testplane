'use strict';

exports.getTestContext = (context) => {
    return context.type === 'hook' && /^"before each"/.test(context.title)
        ? context.ctx.currentTest
        : context;
};
