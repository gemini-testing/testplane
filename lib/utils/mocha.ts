export const getTestContext = (context) => { //TODO
    return context.type === 'hook' && /^"before each"/.test(context.title)
        ? context.ctx.currentTest
        : context;
};
