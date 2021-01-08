// ==UserScript==
// @name         Выгрузка ссылок на вложения
// @namespace    http://vk.com/hlvn/attachexport
// @version      1.2.1
// @description  Пользовательский скрипт для выгрузки ссылок на вложения в диалогах
// @author       Alexander Holovin
// @require      https://unpkg.com/react@16/umd/react.development.js
// @require      https://unpkg.com/react-dom@16/umd/react-dom.development.js
// @require      https://ifx.su/~va
// @match        https://vk.com/*
// @grant        GM.xmlHttpRequest
// @noframes
// @updateURL    https://raw.githubusercontent.com/Holovin/vk-attach-export/master/build/vk-attach-export.user.js
// ==/UserScript==


'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// import React from 'react';
// import ReactDOM from 'react-dom';

var APP_NAME = 'Выгрузить ссылки на вложения';

var App = function (_React$Component) {
  _inherits(App, _React$Component);

  function App(props) {
    _classCallCheck(this, App);

    var _this = _possibleConstructorReturn(this, (App.__proto__ || Object.getPrototypeOf(App)).call(this, props));

    props.onCloseCallback(function () {
      _this.onClose();
    });

    _this.state = {
      peer_id: props.peer_id,
      progress: false,
      lastMessage: {},
      limitDate: 0,
      firstDate: 0,
      counters: {
        total: 0
      },
      links: []
    };
    return _this;
  }

  _createClass(App, [{
    key: 'onClose',
    value: function onClose() {
      this.closed = true;
    }
  }, {
    key: 'setStatePromise',
    value: function setStatePromise(data) {
      var _this2 = this;

      return new Promise(function (resolve) {
        _this2.setState(data, resolve);
      });
    }

    // region API

  }, {
    key: 'getAllHistory',


    /**
     * Быстрая выгрузка переписки через execute
     * @param {number} peer_id
     * @param {number} date
     * @param {function} onStep
     * @return {Promise<{batchItems: *[], nextOffset, totalCount}>}
     */
    value: async function getAllHistory(peer_id, date, onStep) {
      var offset = await App.findHistoryOffset(peer_id, date);
      var count = 0;

      while ((!count || offset < count) && !this.closed) {
        var _ref = await App.getHistoryWithExecute(peer_id, offset),
            batchItems = _ref.batchItems,
            nextOffset = _ref.nextOffset,
            totalCount = _ref.totalCount;

        await onStep({ batchItems: batchItems, nextOffset: nextOffset, totalCount: totalCount });

        offset = nextOffset;
        count = totalCount;
      }
    }
    // endregion

    // region DOM
    /**
     * Ищет в элементах необходимое нам меню и встраивает туда новый пункт
     *
     * @param elements
     */

  }, {
    key: 'onStep',


    // endregion

    // region logic
    /**
     * Подсчет статистики при поступлении новой порции сообщений
     * @param batchItems
     * @param nextOffset
     * @param totalCount
     * @return {Promise<unknown>}
     */
    value: async function onStep(_ref2) {
      var batchItems = _ref2.batchItems,
          nextOffset = _ref2.nextOffset,
          totalCount = _ref2.totalCount;
      var _state = this.state,
          counters = _state.counters,
          limitDate = _state.limitDate,
          links = _state.links;

      var newLinks = [];
      var firstDate = this.state.firstDate;
      var lastMessage = {};

      batchItems.forEach(function (message) {
        lastMessage = message;
        if (limitDate && limitDate > message.date) {
          return;
        }

        firstDate = Math.min(firstDate || message.date, message.date);
        counters.total++;

        (message.attachments || []).forEach(function (attachment) {
          var type = attachment.type;

          if (['sticker', 'video', 'gift', 'audio_message', 'link', 'story', 'wall', 'wall_reply', 'market', 'audio', 'poll', 'podcast', 'call'].includes(type)) {
            return;
          }

          if (type === 'photo') {
            var photo = attachment.photo;
            var maxHeight = -1;
            var link = '';

            photo.sizes.forEach(function (sizes) {
              if (sizes.height > maxHeight) {
                maxHeight = sizes.height;
                link = sizes.url;
              }
            });

            if (link) {
              newLinks.push(link);
            }

            return;
          }

          if (type === 'doc') {
            var doc = attachment.doc;
            newLinks.push(doc.url);

            return;
          }

          if (type === 'graffiti') {
            var gf = attachment.graffiti;
            newLinks.push(gf.url);

            return;
          }

          console.log(attachment);
          console.log(type);
        });
      });

      await this.setStatePromise({
        progress: nextOffset + ' / ' + totalCount + ' (' + ~~(nextOffset / totalCount * 100) + '%)',
        counters: counters,
        lastMessage: lastMessage,
        firstDate: firstDate,
        links: links.concat(newLinks)
      });
    }

    /**
     * Инициализация загрузки истории переписки
     */

  }, {
    key: 'loadStats',
    value: function loadStats() {
      var _this3 = this;

      var peer_id = this.state.peer_id;

      var limitDate = 0;

      if (this.state.date) {
        var date = new Date(this.state.date);
        var timeZone = date.getTimezoneOffset() * 60;
        limitDate = date / 1000 + timeZone;
      }

      this.setStatePromise({
        progress: 'Загрузка...',
        limitDate: limitDate
      }).then(function () {
        return _this3.getAllHistory(peer_id, limitDate, function (data) {
          return _this3.onStep(data);
        });
      }).then(function () {
        return _this3.setStatePromise({
          progress: 'Готово'
        });
      }).catch(function (error) {
        console.error(error);
      });
    }
    // endregion

    // region render
    /**
     * Рендер стартового экрана
     * @return {*}
     */

  }, {
    key: 'renderSettings',
    value: function renderSettings() {
      var _this4 = this;

      return React.createElement(
        'div',
        { className: 'im_stat_window' },
        React.createElement(
          'div',
          { style: { marginBottom: '6px' } },
          '\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0443\u044E \u0434\u0430\u0442\u0443 \u0434\u043B\u044F \u0430\u043D\u0430\u043B\u0438\u0437\u0430 \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0438.',
          React.createElement('br', null),
          '\u0424\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u044F \u043F\u043E \u0434\u0430\u0442\u0435 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0432\u0441\u0435\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439.',
          React.createElement('br', null),
          '\u041C\u043E\u0436\u043D\u043E \u0441\u0434\u0435\u043B\u0430\u0442\u044C \u0430\u043D\u0430\u043B\u0438\u0437 \u0432\u0441\u0435\u0439 \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0438 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u0432 \u0434\u0430\u0442\u0443.'
        ),
        React.createElement('input', {
          type: 'date',
          className: 'dark',
          style: {
            width: '300px',
            marginRight: '9px'
          },
          onChange: function onChange(e) {
            var date = e.target.value;
            _this4.setState({ date: date });
          }
        }),
        React.createElement(
          'button',
          { className: 'flat_button', onClick: function onClick() {
              return _this4.loadStats();
            } },
          '\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C'
        )
      );
    }

    /**
     * Рендер заголовка анализа переписки
     * @return {*}
     */

  }, {
    key: 'renderHeader',
    value: function renderHeader() {
      var _state2 = this.state,
          progress = _state2.progress,
          date = _state2.date,
          counters = _state2.counters,
          lastMessage = _state2.lastMessage,
          firstDate = _state2.firstDate;

      var lostMessages = lastMessage.conversation_message_id - counters.total || 0;

      return React.createElement(
        'div',
        null,
        '\u0414\u0430\u0442\u0430: ',
        date || 'За все время',
        React.createElement('br', null),
        '\u041F\u0435\u0440\u0432\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435: ',
        firstDate ? new Date(firstDate * 1000).toISOString() : '???',
        React.createElement('br', null),
        '\u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441: ',
        progress,
        React.createElement('br', null),
        '\u0412\u0441\u0435\u0433\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439: ',
        counters.total,
        ' (\u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E: ',
        lostMessages,
        ')',
        React.createElement('br', null)
      );
    }
  }, {
    key: 'renderStat',
    value: function renderStat() {
      var progress = this.state.progress;


      return React.createElement(
        'div',
        null,
        this.renderHeader(),
        React.createElement('hr', null),
        progress === 'Готово' ? this.renderLinks() : '<<< ЗАГРУЗКА >>>'
      );
    }
  }, {
    key: 'renderLinks',
    value: function renderLinks() {
      var links = this.state.links;

      var out = links.join('\n');
      var handleChange = function handleChange() {};

      return React.createElement('textarea', { onChange: handleChange,
        value: out,
        style: { width: '95%', height: '200px', whiteSpace: 'nowrap', overflow: 'auto' }
      });
    }

    /**
     * Рендер приложения
     * @return {*}
     */

  }, {
    key: 'render',
    value: function render() {
      var progress = this.state.progress;


      return React.createElement(
        'div',
        null,
        progress ? this.renderStat() : this.renderSettings()
      );
    }
    // endregion

  }], [{
    key: 'callMethod',
    value: function callMethod(method, data) {
      return window.API(method, data);
    }

    /**
     * Быстрая выгрузка переписки через execute
     *
     * @param {number} peer_id
     * @param {number} offset
     * @return {Promise<{batchItems: *[], nextOffset, totalCount}>}
     */

  }, {
    key: 'getHistoryWithExecute',
    value: function getHistoryWithExecute(peer_id, offset) {
      return App.callMethod("execute", {
        code: '// VKScript\n        var i = 0;\n        var lastResponse;\n        var offset = parseInt(Args.offset);\n        \n        var req = {\n            "peer_id": parseInt(Args.peer_id),\n            "count": 200,\n            "rev": 1,\n            "offset": offset\n        };\n        var res = {\n          historyBatches: []\n        };\n        \n        while (i < 25) {\n            i = i + 1;\n            lastResponse = API.messages.getHistory(req);\n            \n            if (lastResponse.count < req.offset) {\n              return res;\n            }\n            \n            res.historyBatches.push(lastResponse.items);\n            req.offset = req.offset + 200;\n            res.nextOffset = req.offset;\n            res.totalCount = lastResponse.count;\n        }\n        return res;',
        peer_id: peer_id,
        offset: offset,
        v: '5.103'
      }).then(function (_ref3) {
        var _ref4;

        var _ref3$response = _ref3.response,
            historyBatches = _ref3$response.historyBatches,
            nextOffset = _ref3$response.nextOffset,
            totalCount = _ref3$response.totalCount;

        return {
          batchItems: (_ref4 = []).concat.apply(_ref4, _toConsumableArray(historyBatches)),
          nextOffset: nextOffset,
          totalCount: totalCount
        };
      });
    }

    /**
     * Ищет offset для истории с определенной даты
     * Ищет приблезительно, далее работает фильтрация по дате
     * В случае ошибки выдает 0 - и скрипт будет загружать всю историю
     *
     * @param {number} peer_id
     * @param {number} date
     * @return {Promise<number>}
     */

  }, {
    key: 'findHistoryOffset',
    value: function findHistoryOffset(peer_id, date) {
      if (!date) {
        return Promise.resolve(0);
      }

      return App.callMethod("execute", {
        date: date,
        peer_id: peer_id,
        code: '// VKScript\n        var iterations = 23;\n        \n        var search_date = parseInt(Args.date);\n        var req = {\n          rev: 1,\n          peer_id: Args.peer_id,\n          offset: 0,\n          count: 1\n        };\n        \n        var history = API.messages.getHistory(req);\n        var count = history.count;\n        var total = history.count;\n        var cur_date = history.items[0].date;\n        \n        if (cur_date > search_date) {\n          return {\n            total: total,\n            count: count,\n            cur_date: cur_date,\n            search_date: search_date,\n            diff: search_date - cur_date,\n            offset: req.offset\n          };\n        }\n        \n        while (iterations > 0 && count > 200) {\n          iterations = iterations - 1;\n          count = parseInt(count / 2);\n          req.offset = req.offset + count;\n          cur_date = API.messages.getHistory(req).items[0].date;\n          if (cur_date > search_date) {\n            count = count * 2;\n            req.offset = req.offset - count;\n          }\n        }\n        \n        cur_date = API.messages.getHistory(req).items[0].date;\n        \n        return {\n          total: total,\n          count: count,\n          cur_date: cur_date,\n          search_date: search_date,\n          diff: search_date - cur_date,\n          offset: req.offset\n        };\n      '
      }).then(function (_ref5) {
        var response = _ref5.response,
            _ref5$response = _ref5.response,
            diff = _ref5$response.diff,
            offset = _ref5$response.offset;

        if (diff < 0) {
          throw response;
        }

        return offset;
      }).catch(function (error) {
        console.error(error);
        return 0;
      });
    }
  }, {
    key: 'searchMenuElement',
    value: function searchMenuElement(elements) {
      elements.forEach(function (el) {
        if (!el || !el.querySelector) {
          return;
        }

        var actions_selector = '._im_dialog_action_wrapper .ui_actions_menu';
        var actions_menu = el.querySelector(actions_selector) || el.closest(actions_selector);
        if (!actions_menu) {
          return;
        }

        var action_search = actions_menu.querySelector('.im-action_search');
        if (!action_search || action_search.classList.contains('vk-conv-stats')) {
          return;
        }

        var action_stat = action_search.cloneNode();

        action_stat.textContent = APP_NAME;
        action_stat.className += ' im-action_pin_unhide vk-conv-stats';
        action_stat.onclick = App.onMenuClick;

        action_search.parentElement.insertBefore(action_stat, action_search);
      });
    }

    /**
     * Ищет меню по интервалу
     */

  }, {
    key: 'initMenuSearch',
    value: function initMenuSearch() {
      setInterval(function () {
        if (!/^\/im/.test(window.location.pathname)) {
          return;
        }

        App.searchMenuElement([document.body]);
      }, 1000);
    }

    /**
     * Запускает приложение по клику на пункт меню
     * @param event
     * @return {boolean}
     */

  }, {
    key: 'onMenuClick',
    value: function onMenuClick(event) {
      var currentTarget = event.currentTarget;
      var history = currentTarget ? currentTarget.closest('.im-page-history-w') : 0;
      var message = history ? history.querySelector('[data-msgid]') : 0;
      var peer_id = message ? message.dataset.peer : 0;

      if (!peer_id) {
        alert('Invalid peer_id');
        return false;
      }

      var onCloseCallback = function onCloseCallback(onClose) {
        if (onCloseCallback.callback) {
          onCloseCallback.callback();
        } else {
          onCloseCallback.callback = onClose;
        }
      };

      var statWindow = new MessageBox({
        title: APP_NAME,
        onHide: onCloseCallback,
        width: 550
      });

      ReactDOM.render(React.createElement(App, { peer_id: peer_id, onCloseCallback: onCloseCallback }), statWindow.bodyNode);

      statWindow.setButtons().show();
      return false;
    }
  }]);

  return App;
}(React.Component);

App.initMenuSearch();