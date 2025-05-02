
const DomChangeObserver = (function () {
  // 私有方法：创建MutationObserver
  function createMutationObserver(target, callback, options) {
    try {
      const observer = new MutationObserver(function (mutations) {
        callback(mutations);
      });
      observer.observe(target, options);
      return {
        disconnect: function () {
          observer.disconnect();
        }
      };
    } catch (e) {
      return null;
    }
  }

  // 私有方法：创建Mutation Events监听（旧浏览器）
  function createMutationEventsObserver(target, callback) {
    if (typeof target.addEventListener !== 'function') {
      return null;
    }

    const events = [
      'DOMSubtreeModified',
      'DOMNodeInserted',
      'DOMNodeRemoved',
      'DOMAttrModified',
      'DOMCharacterDataModified'
    ];

    const handler = function (event) {
      const fakeMutation = {
        type: event.type,
        target: event.target,
        addedNodes: event.type === 'DOMNodeInserted' ? [event.target] : [],
        removedNodes: event.type === 'DOMNodeRemoved' ? [event.target] : [],
        attributeName: event.attrName || null,
        oldValue: event.prevValue || null
      };
      callback([fakeMutation]);
    };

    events.forEach(function (event) {
      target.addEventListener(event, handler, false);
    });

    return {
      disconnect: function () {
        events.forEach(function (event) {
          target.removeEventListener(event, handler, false);
        });
      }
    };
  }

  // 私有方法：创建IE属性变化监听（IE6-8）
  function createIePropertyObserver(target, callback) {
    if (typeof target.attachEvent !== 'function') {
      return null;
    }

    const handler = function () {
      const fakeMutation = {
        type: 'propertychange',
        target: target,
        attributeName: window.event.propertyName
      };
      callback([fakeMutation]);
    };

    target.attachEvent('onpropertychange', handler);

    return {
      disconnect: function () {
        target.detachEvent('onpropertychange', handler);
      }
    };
  }

  // 私有方法：创建轮询检查（最终降级方案）
  function createPollingObserver(target, callback) {
    let lastHTML = target.innerHTML;
    let lastOuterHTML = target.outerHTML;
    const interval = 500; // 每500ms检查一次

    const timer = setInterval(function () {
      if (target.innerHTML !== lastHTML || target.outerHTML !== lastOuterHTML) {
        lastHTML = target.innerHTML;
        lastOuterHTML = target.outerHTML;
        callback([{
          type: 'polling',
          target: target
        }]);
      }
    }, interval);

    return {
      disconnect: function () {
        clearInterval(timer);
      }
    };
  }

  // 公开API
  return {
    observe: function (target, callback, options = {}) {
      // 默认配置
      const defaultOptions = {
        attributes: true,
        attributeOldValue: true,
        characterData: true,
        childList: true,
        subtree: true
      };

      // 合并配置
      options = Object.assign({}, defaultOptions, options);

      // 尝试使用MutationObserver
      const observer = createMutationObserver(target, callback, options) ||
        createMutationEventsObserver(target, callback) ||
        createIePropertyObserver(target, callback) ||
        createPollingObserver(target, callback);

      return observer;
    },

    observeMultiple: function (selector, callback, options = {}) {
      const elements = document.querySelectorAll(selector);
      const observers = [];

      // 监测现有元素
      elements.forEach(function (element) {
        const observer = this.observe(element, function (mutations) {
          callback(element, mutations);
        }, options);
        observers.push(observer);
      }.bind(this));

      // 在现代浏览器中监测新添加的元素
      if (typeof MutationObserver !== 'undefined') {
        const globalObserver = new MutationObserver(function (mutations) {
          mutations.forEach(function (mutation) {
            if (mutation.addedNodes) {
              mutation.addedNodes.forEach(function (node) {
                if (node.nodeType === 1 && node.matches(selector)) {
                  const observer = this.observe(node, function (mutations) {
                    callback(node, mutations);
                  }, options);
                  observers.push(observer);
                }
              }.bind(this));
            }
          }.bind(this));
        }.bind(this));

        globalObserver.observe(document.body, {
          childList: true,
          subtree: true
        });

        observers.push({
          disconnect: function () {
            globalObserver.disconnect();
          }
        });
      }

      return {
        disconnect: function () {
          observers.forEach(function (observer) {
            observer.disconnect();
          });
        }
      };
    }
  };
})();

export {DomChangeObserver};