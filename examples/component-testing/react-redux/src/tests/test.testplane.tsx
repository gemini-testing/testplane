import { render } from "@testing-library/react";
import { Provider } from "react-redux";

import App from "../App";
import { store } from "../counter";

it("should increment counter on button click", async ({ browser }) => {
    render(
        <Provider store={store}>
            <App />
        </Provider>
    );

    await browser.$("#inc").click();
    await browser.$("#inc").click();

    await expect(browser.$(".counter")).toHaveText("Counter: 2");
});
