# TEST_PASS {#test-pass}

**sync | master | can be intercepted**

Событие `TEST_PASS` триггерится, если тест успешно прошел. Обработчик события выполняется синхронно. Также событие можно перехватить и изменить в специальном обработчике.

## Подписка на событие {#test_pass_subscription}

```javascript
testplane.on(testplane.events.TEST_PASS, (test) => {
    console.info(
        `Выполняется обработка события TEST_PASS ` +
        `для теста "${test.fullTitle()}" в браузере "${test.browserId}"…`
    );
});
```

### Параметры обработчика {#test_pass_cb_params}

В обработчик события передается инстанс теста.

## Перехват события {#test_pass_interception}

```javascript
testplane.intercept(testplane.events.TEST_PASS, ({ event, data: test }) => {
    console.info(
        `Выполняется перехват события TEST_PASS ` +
        `для теста "${test.fullTitle()}" в браузере "${test.browserId}"…`
    );
});
```

## Пример использования {#test_pass_usage}

Смотрите в качестве примера «[Сбор статистики о прогоне тестов](#usage_collecting_stats)».