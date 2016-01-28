e2e-runner
===========

## Установка

```shell
npm i e2e-runner --registry http://npm.yandex-team.ru --save-dev
```

## Запуск тестов

```shell
node_modules/.bin/e2e path/to/tests --baseUrl http://yandex.ru/search --grid http://localhost:4444/wd/hub
```

## Конфигурация

**e2e-runner** настраивается с помощью конфигурационного файла. Путь к этому файлу можно задать с помощью опции `--conf`. Стандартное имя файла -  `.e2e.conf.js`.

Ниже приведён пример полного конфига. Обязательными полями являются `specs` и `browsers`.

```javascript
var command = require('path/to/command');

module.exports = {
    grid: 'http://localhost:4444/wd/hub',
    baseUrl: 'http://yandex.ru/search',
    waitTimeout: 10000,
    debug: true,

    specs: [
        'tests/desktop',
        'tests/touch'
    ],

    browsers: {
        chrome: {
            desiredCapabilities: {
                browserName: 'chrome'
            },
            sessionsPerBrowser: 3
        },

        firefox: {
            desiredCapabilities: {
                browserName: 'firefox'
            },
            sessionsPerBrowser: 10 // по умолчанию тесты запускаются в одной сессии
        }
    },

    // Дополнительная настройка mocha
    mochaOpts: {
        retries: 3
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

## Описание конфигурационного файла

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

* `desiredCapabilities` (обязательная) - Необходимые для этого браузера WebDriver [DesiredCapabilites](https://github.com/SeleniumHQ/selenium/wiki/DesireddesiredCapabilities)
* `sessionsPerBrowser` - Количество одновременно запущеных сессий для браузера с данным id. По умолчанию 1

### Подготовка webdriver-сессии к работе
Подготовка сессии к работе (например, установка специфических для пользователя команд) выполняется в секции `prepareBrowser`.
Формат секции:
```js
prepareBrowser: function(browser) {
    // do setup here
}
```

В данную функцию будет передана сессия `webdriver.io`.

### Кастомизация настройки окружения

Данные в конфиге можно изменять в зависимости от дополнительных условий в функции `prepareEnvironment`. Использование этой функции не обязательно, она для удобства.

### Прочие свойства

* `specs`(обязательный) - Массив путей до директорий с тестами.
* `grid` – URL до Selenium grid. По умолчанию `http://localhost:4444/wd/hub`
* `baseUrl` - Базовый URL тестируемой страницы. По умолчанию `localhost`
* `timeout` - Время ожидания выполнения теста. По умолчанию `60000`
* `waitTimeout` - Время ожидания события на странице. По умолчанию `10000`
* `slow` - Если время выполнения теста превышает это значение, то тест считается медленным. По умолчанию `10000`
* `debug` - Включает вывод отладочной информации в консоль. По умолчанию `false`

### Переопределение настроек

С помощью CLI можно переопределить параметры, используя следующие опции:

* `-c|--conf` - указать путь к конфигу. По умолчанию используется файл с именем `.e2e.conf.js`
* `--baseUrl` - задать базовый `url` для всех тестов
* `--wait-timeout` - время ожидания событий на странице в миллисекундах. По умолчанию 10000
* `-b|--browser` - запуск тестов в определенном браузере. Возможно задать несколько браузеров одновременно. Например,
```
node_modules/.bin/e2e -b chrome --browser firefox
```
* `-r|--reporter` - указать используемый репортер. Возможно задать несколько репортеров одновременно. Например,
```
node_modules/.bin/e2e -r flat --reporter teamcity
```
* `--debug` - включить debug-режим
