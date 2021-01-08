import React from 'react';
import ReactDOM from 'react-dom';

const APP_NAME = 'Выгрузить ссылки на вложения';

class App extends React.Component {
  constructor(props) {
    super(props);

    props.onCloseCallback(() => {
      this.onClose();
    });

    this.state = {
      peer_id: props.peer_id,
      progress: false,
      lastMessage: {},
      limitDate: 0,
      firstDate: 0,
      counters: {
        total: 0,
      },
      links: [],
    };
  }

  onClose() {
    this.closed = true;
  }

  setStatePromise(data) {
    return new Promise((resolve) => {
      this.setState(data, resolve);
    });
  }


  // region API
  static callMethod(method, data) {
    return window.API(method, data);
  }

  /**
   * Быстрая выгрузка переписки через execute
   *
   * @param {number} peer_id
   * @param {number} offset
   * @return {Promise<{batchItems: *[], nextOffset, totalCount}>}
   */
  static getHistoryWithExecute(peer_id, offset) {
    return App.callMethod("execute", {
      code: `// VKScript
        var i = 0;
        var lastResponse;
        var offset = parseInt(Args.offset);
        
        var req = {
            "peer_id": parseInt(Args.peer_id),
            "count": 200,
            "rev": 1,
            "offset": offset
        };
        var res = {
          historyBatches: []
        };
        
        while (i < 25) {
            i = i + 1;
            lastResponse = API.messages.getHistory(req);
            
            if (lastResponse.count < req.offset) {
              return res;
            }
            
            res.historyBatches.push(lastResponse.items);
            req.offset = req.offset + 200;
            res.nextOffset = req.offset;
            res.totalCount = lastResponse.count;
        }
        return res;`,
      peer_id: peer_id,
      offset: offset,
      v: '5.103',
    }).then(({ response: { historyBatches, nextOffset, totalCount } }) => {
      return {
        batchItems: [].concat(...historyBatches),
        nextOffset,
        totalCount
      };
    })
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
  static findHistoryOffset(peer_id, date) {
    if (!date) {
      return Promise.resolve(0);
    }

    return App.callMethod("execute", {
      date: date,
      peer_id: peer_id,
      code: `// VKScript
        var iterations = 23;
        
        var search_date = parseInt(Args.date);
        var req = {
          rev: 1,
          peer_id: Args.peer_id,
          offset: 0,
          count: 1
        };
        
        var history = API.messages.getHistory(req);
        var count = history.count;
        var total = history.count;
        var cur_date = history.items[0].date;
        
        if (cur_date > search_date) {
          return {
            total: total,
            count: count,
            cur_date: cur_date,
            search_date: search_date,
            diff: search_date - cur_date,
            offset: req.offset
          };
        }
        
        while (iterations > 0 && count > 200) {
          iterations = iterations - 1;
          count = parseInt(count / 2);
          req.offset = req.offset + count;
          cur_date = API.messages.getHistory(req).items[0].date;
          if (cur_date > search_date) {
            count = count * 2;
            req.offset = req.offset - count;
          }
        }
        
        cur_date = API.messages.getHistory(req).items[0].date;
        
        return {
          total: total,
          count: count,
          cur_date: cur_date,
          search_date: search_date,
          diff: search_date - cur_date,
          offset: req.offset
        };
      `
    }).then(({ response, response: { diff, offset } }) => {
      if (diff < 0) {
        throw response;
      }

      return offset;
    }).catch((error) => {
      console.error(error);
      return 0;
    });
  }

  /**
   * Быстрая выгрузка переписки через execute
   * @param {number} peer_id
   * @param {number} date
   * @param {function} onStep
   * @return {Promise<{batchItems: *[], nextOffset, totalCount}>}
   */
  async getAllHistory(peer_id, date, onStep) {
    let offset = await App.findHistoryOffset(peer_id, date);
    let count = 0;

    while ((!count || offset < count) && !this.closed) {
      const { batchItems, nextOffset, totalCount } = await App.getHistoryWithExecute(peer_id, offset);
      await onStep({ batchItems, nextOffset, totalCount });

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
  static searchMenuElement(elements) {
    elements.forEach((el) => {
      if (!el || !el.querySelector) {
        return;
      }

      const actions_selector = '._im_dialog_action_wrapper .ui_actions_menu';
      const actions_menu = el.querySelector(actions_selector) || el.closest(actions_selector);
      if (!actions_menu) {
        return;
      }

      const action_search = actions_menu.querySelector('.im-action_search');
      if (!action_search || action_search.classList.contains('vk-conv-stats')) {
        return;
      }

      const action_stat = action_search.cloneNode();

      action_stat.textContent = APP_NAME;
      action_stat.className += ' im-action_pin_unhide vk-conv-stats';
      action_stat.onclick = App.onMenuClick;

      action_search.parentElement.insertBefore(action_stat, action_search);
    })
  }

  /**
   * Ищет меню по интервалу
   */
  static initMenuSearch() {
    setInterval(() => {
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
  static onMenuClick(event) {
    const currentTarget = event.currentTarget;
    const history = currentTarget ? currentTarget.closest('.im-page-history-w') : 0;
    const message = history ? history.querySelector('[data-msgid]') : 0;
    const peer_id = message ? message.dataset.peer : 0;

    if (!peer_id) {
      alert('Invalid peer_id');
      return false;
    }

    const onCloseCallback = (onClose) => {
      if (onCloseCallback.callback) {
        onCloseCallback.callback();
      } else {
        onCloseCallback.callback = onClose
      }
    };

    const statWindow = new MessageBox({
      title: APP_NAME,
      onHide: onCloseCallback,
      width: 550,
    });

    ReactDOM.render(<App peer_id={peer_id} onCloseCallback={onCloseCallback}/>, statWindow.bodyNode);

    statWindow.setButtons().show();
    return false;
  }

  // endregion

  // region logic
  /**
   * Подсчет статистики при поступлении новой порции сообщений
   * @param batchItems
   * @param nextOffset
   * @param totalCount
   * @return {Promise<unknown>}
   */
  async onStep({ batchItems, nextOffset, totalCount }) {
    const { counters, limitDate, links } = this.state;
    const newLinks = [];
    let firstDate = this.state.firstDate;
    let lastMessage = {};

    batchItems.forEach((message) => {
      lastMessage = message;
      if (limitDate && limitDate > message.date) {
        return;
      }

      firstDate = Math.min(firstDate || message.date, message.date);
      counters.total++;

      (message.attachments || []).forEach(attachment => {
        const type = attachment.type;

        if (['sticker', 'video', 'gift', 'audio_message'].includes(type)) {
          return;
        }

        if (type === 'photo') {
          const photo = attachment.photo;
          let maxHeight = -1;
          let link = '';

          photo.sizes.forEach(sizes => {
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

        console.log(message);
      });
    });

    await this.setStatePromise({
      progress: `${nextOffset} / ${totalCount} (${~~(nextOffset / totalCount * 100)}%)`,
      counters,
      lastMessage,
      firstDate,
      links: links.concat(newLinks),
    });
  }

  /**
   * Инициализация загрузки истории переписки
   */
  loadStats() {
    const { peer_id } = this.state;
    let limitDate = 0;

    if (this.state.date) {
      const date = new Date(this.state.date);
      const timeZone = date.getTimezoneOffset() * 60;
      limitDate = date / 1000 + timeZone;
    }

    this.setStatePromise({
      progress: 'Загрузка...',
      limitDate
    }).then(() => {
      return this.getAllHistory(peer_id, limitDate, (data) => {
        return this.onStep(data);
      });
    }).then(() => {
      return this.setStatePromise({
        progress: 'Готово',
      });
    }).catch((error) => {
      console.error(error);
    })
  }
  // endregion

  // region render
  /**
   * Рендер стартового экрана
   * @return {*}
   */
  renderSettings() {
    return (
      <div className="im_stat_window">
        <div style={{ marginBottom: '6px' }}>
          Выберите стартовую дату для анализа переписки.<br/>
          Фильтрация по дате работает после загрузки всех сообщений.<br/>
          Можно сделать анализ всей переписки не указав дату.
        </div>
        <input
          type="date"
          className="dark"
          style={{
            width: '300px',
            marginRight: '9px',
          }}
          onChange={(e) => {
            const date = e.target.value;
            this.setState({ date });
          }}
        />
        <button className="flat_button" onClick={() => this.loadStats()}>Загрузить</button>
      </div>
    );
  }

  /**
   * Рендер заголовка анализа переписки
   * @return {*}
   */
  renderHeader() {
    const { progress, date, counters, lastMessage, firstDate } = this.state;
    const lostMessages = (lastMessage.conversation_message_id - counters.total) || 0;

    return (
      <div>
        Дата: {date || 'За все время'}<br/>
        Первое сообщение: {firstDate ? new Date(firstDate * 1000).toISOString() : '???'}<br/>
        Прогресс: {progress}<br/>
        Всего сообщений: {counters.total} (пропущено: {lostMessages})<br/>
      </div>
    );
  }

  renderStat() {
    const { progress } = this.state;

    return (
        <div>
          { this.renderHeader() }
          <hr/>
          { progress === 'Готово' ? this.renderLinks() : '<<< ЗАГРУЗКА >>>' }
        </div>
    )
  }

  renderLinks() {
    const { links } = this.state;
    const out = links.join('\n');
    const handleChange = () => {};

    return (
        <textarea onChange={ handleChange }
                  value={ out }
                  style={{ width: '95%', height: '200px', 'white-space': 'nowrap', 'overflow': 'auto' }}
        >
        </textarea>
    )
  }

  /**
   * Рендер приложения
   * @return {*}
   */
  render() {
    const { progress } = this.state;

    return (
      <div>
        { progress
            ? this.renderStat()
            : this.renderSettings()
        }
      </div>
    );
  }
  // endregion

}

App.initMenuSearch();
