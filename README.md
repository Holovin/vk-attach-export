# Выгрузка ссылок на вложения
## Установка
- Установить [Tampermonkey](https://www.tampermonkey.net/)
- Установить [Скрипт](https://raw.githubusercontent.com/Holovin/vk-attach-export/master/build/vk-attach-export.user.js)

## Структура
- build/vk-conversation-statistics.user.js - собранный скрипт для установки
- src/App.js - основной код
- src/header.user.js - заголовок для Tampermonkey
- build.js - Node.JS скрипт для сборки

## Библиотеки
- Используемые в Tampermonkey через @require:
    - [React и ReactDOM](https://ru.reactjs.org/) (через unpkg.com)
    - [Библиотека для работы с API ВКонтакте в вебе](https://ifx.su/~va) (напрямую)
- Только для сборки:
    - [Babel](https://babeljs.io/)
