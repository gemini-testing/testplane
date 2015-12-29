e2e-runner
===========

## Установка

```shell
npm i e2e-runner --registry http://npm.yandex-team.ru --save-dev
```

## Запуск тестов

```shell
e2e-runner path/to/config --baseUrl http://yandex.ru/search --grid http://localhost:4444/wd/hub
```

## Конфигурация

**e2e-runner** конфигурируется с помощью конфигурационного файла. Путь к этому файлу обязателен и должен передаваться первым аргументом.
Опции `grid`, `baseUrl`, `timeout`, `waitTimeout`, `slow`, `debug` могут быть переопределены cli-опциями с соответствующими именами

Ниже приведён пример полного конфига. Обязательными полями являются `specs`, `browsers`, `prepareEnvironment`

```javascript
var command = require('path/to/command');

module.exports = {
    grid: 'http://localhost:4444/wd/hub',
    baseUrl: 'http://yandex.ru/search',
    timeout: 10000,
    waitTimeout: 10000,
    slow: 6000,
    debug: true,

    specs: [
        'tests/desktop',
        'tests/touch'
    ],

    browsers: {
        chrome: {
            capabilities: {
                browserName: 'chrome'
            },
            sessionsPerBrowser: 3
        },

        firefox: {
            capabilities: {
                browserName: 'firefox'
            },
            sessionsPerBrowser: 10 // will be 1 if not set
        }
    },

    prepareBrowser: function (browser) {
        browser.addCommand('command', command);
    },

    // Кастомизация окружения
    prepareEnvironment: function() {
        if (process.env.desktop) {
            this.specs = ['tests/desktop'];
        }
    }
};
```

## Описание опций

### Настройки браузеров

Браузеры, в которых необходимо запускать тесты, настраиваются в секции `browsers`. 
Формат секции:
```js
browsers: {
    <browser_id> {
        <setting>:<value>
        <setting>:<value>
    }
}
```
Значение `<browser-id>` используется в отчёте для идентификации браузера.
Доступные настройки браузера:

* `capabilities` (обязательная) - Необходимые для этого браузера WebDriver [DesiredCapabilites](https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities) 
* `sessionsPerBrowser` - Количество одновременно запущеных сессий для браузера с данным id. По умолчанию 1

### Подготовка webdriver-сессии к работе
Подготовка сессии к работе (например установка специфических для пользователя команд) выполняется в секции `prepareBrowser`.
Формат секции:
```js
prepareBrowser: function(browser) {
    // do setup here
}
```

В данную функцию будет передана сессия `webdriver.io`.

### Кастомизация настройки окружения

Данные в конфиге можно изменять в зависимости от дополнительных условий в функции `prepareEnvironment`. Использование этой функции не обязательно, она для удобства.

### Прочие опции

* `specs`(обязательный) - Массив путей до директорий с тестами.
* `grid` – URL до Selenium grid. По умолчанию `http://localhost:4444/wd/hub`
* `baseUrl` - Базовый URL тестируемой страницы. По умолчанию `localhost`
* `timeout` - Время ожидания выполнения теста. По умолчанию `60000`
* `waitTimeout` - Время ожидания события на странице. По умолчанию `10000`
* `slow` - Если время выполнения теста превышает это значение, то тест считается медленным. По умолчанию `10000`
* `debug` - Включает вывод отладочной информации в консоль. По умолчанию `false`
