import type { WebdriverIOQueries, WebdriverIOQueriesChainable } from '@testing-library/webdriverio'
import type * as matchers from "@testing-library/jest-dom/types/matchers";

declare global {
    // @testing-library selectors
    namespace WebdriverIO {
        interface Browser extends WebdriverIOQueries, WebdriverIOQueriesChainable<WebdriverIO.Browser> {}
        interface Element extends WebdriverIOQueries, WebdriverIOQueriesChainable<WebdriverIO.Element> {}
    }

    // @testing-library matchers
    namespace ExpectWebdriverIO {
        interface Matchers<R, T> extends matchers.TestingLibraryMatchers<R, T> {}
    }
}

// @testing-library chainable selectors
declare module 'webdriverio' {
    interface ChainablePromiseElement<T extends WebdriverIO.Element | undefined>
      extends WebdriverIOQueriesChainable<T> {}
  }
