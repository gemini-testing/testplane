import { render } from '@testing-library/react';
import App from "../App";

it('should render react button', async ({ browser }) => {
    render(<App />);

    const linkElement = await browser.$("=Learn React");

    await expect(linkElement).toBeDisplayed();

    await browser.pause(5000);
});
