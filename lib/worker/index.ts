import HermioneFacade from './hermione-facade';

const hermioneFacade = HermioneFacade.create();
hermioneFacade.init();

export const runTest = (fullTitle: string, options) => {
    return hermioneFacade.runTest(fullTitle, options);
};
