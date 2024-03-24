import HermioneFacade from "./hermione-facade.js";

const hermioneFacade = HermioneFacade.create();
hermioneFacade.init();

export const runTest = (fullTitle, options) => {
    return hermioneFacade.runTest(fullTitle, options);
};
