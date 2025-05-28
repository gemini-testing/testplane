import { render } from '@testing-library/react';
import App from "../App";

it('should check if the link exists', async ({ browser }) => {
    render(<App />);

    const linkElement = await browser.$("=Learn React");

    await expect(linkElement).toBeDisplayed();

    await browser.pause(5000);
});
