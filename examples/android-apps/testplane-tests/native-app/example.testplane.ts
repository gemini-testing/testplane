const openAlarmViewSelector = 'android=new UiSelector().resourceId("com.google.android.deskclock:id/tab_menu_alarm")';
const addAlarmBtnSelector = 'android=new UiSelector().resourceId("com.google.android.deskclock:id/fab")';
const chooseHourSelector = 'android=new UiSelector().text("12")';
const choosePmSelector = 'android=new UiSelector().resourceId("com.google.android.deskclock:id/material_clock_period_pm_button")';
const acceptAlarmBtnSelector = 'android=new UiSelector().resourceId("com.google.android.deskclock:id/material_timepicker_ok_button")';
const createdAlarmTimeSelector = 'android=new UiSelector().text("12:00 PM")';

describe("native, clock app", () => {
    it("should set the alarm for 12 pm", async ({browser}) => {
        await browser.$(openAlarmViewSelector).click();
        await browser.$(addAlarmBtnSelector).click();
        await browser.$(chooseHourSelector).click();
        await browser.$(choosePmSelector).click();
        await browser.$(acceptAlarmBtnSelector).click();

        await expect(browser.$(createdAlarmTimeSelector)).toBeExisting();
    });
});
