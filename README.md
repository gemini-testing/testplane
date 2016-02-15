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
    sessionsPerBrowser: 2,
    retry: 2,

    plugins: {
        'my-cool-plugin': {
            param: 'value'
        }
    },

    specs: [
        'tests/desktop',
        'tests/touch'
    ],

    browsers: {
        chrome: {
            desiredCapabilities: {
                browserName: 'chrome'
            },
            sessionsPerBrowser: 3,
            retry: 3
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

* `desiredCapabilities` (обязательная) - Необходимые для этого браузера WebDriver [DesiredCapabilites](https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities)
* `sessionsPerBrowser` - Количество одновременно запущеных сессий для браузера с данным id. По умолчанию 1.
* `retry` - Сколько раз тест может быть перезапущен. По умолчанию 0.

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

## Плагины
e2e-runner поддерживает расширения.
Плагин представляет из себя модуль, экспортирующий одну единственную функцию. Эта функция принимает на вход два параметра:
* инстанс e2eRunner'а
* опции плагина из конфига

В момент запуска тестов плагин будет загружен и вызван с текущим инстансом e2eRunner'а и опциями конфига, соответствующими данному плагину.

Если название модуля плагина начинается с `e2e-runner-`, то в конфиге этот префикс можно опустить. Если в зависимостях есть два модуля, например `e2e-runner-some-module` и `some-module`, то приоритет отдается модулю с префиксом.

Пример.
```js
// .e2e.conf.js
...
plugins: {
    'my-cool-plugin': {
        param: 'value'
    }
}
...

// e2e-runner-my-cool-plugin/index.js
module.exports = function(e2e, opts) {
    e2e.on(e2e.events.RUNNER_START, function() {
        return setUp(e2e.config, opts.param); // config can be mutated
    });

    e2e.on(e2e.events.RUNNER_END, function() {
        return tearDown();
    });
}
```

Свойства e2eRunner'а:
* `config` - конфиг, который используется в раннере. Может быть модифицирован
* `events` - список событий, на которые можно подписаться

#### События
* `RUNNER_START` - триггерится перед запуском тестов. Обработчик может вернуть промис, тесты запустятся только после того как промис зарезолвится
* `RUNNER_END` - триггерится после завершения всех тестов. Аналогично `RUNNER_START`, обработчик может вернуть промис
* `SUITE_BEGIN` - запустился новый сьют
* `SUITE_END` - сьют завершен
* `TEST_BEGIN` - тест пошел на исполнение
* `TEST_END` - тест завершился
* `TEST_PASS` - тест пройден
* `TEST_FAIL` - тест упал
* `TEST_PENDING` - тест скипнут
* `RETRY` - тест упал, но ушел на retry
* `ERROR` - произошла какая-то ошибка не в тесте, например не поднялся браузер
* `INFO` - (зарезервировано)
* `WARNING` - (зарезервировано)
* `EXIT` - триггерится когда получен сигнал на завершение (например при нажатии на Ctrl + C). Обработчик может вернуть промис

### Прочие свойства

* `specs`(обязательный) - Массив путей до директорий с тестами.
* `grid` – URL до Selenium grid. По умолчанию `http://localhost:4444/wd/hub`
* `baseUrl` - Базовый URL тестируемой страницы. По умолчанию `localhost`
* `timeout` - Время ожидания выполнения теста. По умолчанию `60000`
* `waitTimeout` - Время ожидания события на странице. По умолчанию `10000`
* `slow` - Если время выполнения теста превышает это значение, то тест считается медленным. По умолчанию `10000`
* `debug` - Включает вывод отладочной информации в консоль. По умолчанию `false`
* `sessionsPerBrowser` - Глобальное значение опции `sessionsPerBrowser` для всех браузеров
* `retry` - Глобальное значение опции `retry` для всех браузеров

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
