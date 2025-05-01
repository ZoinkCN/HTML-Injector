(function() {
    // 1. 加载 DOMPurify（需提前放入 public/js/dompurify.min.js）
    const DOMPurify = window.DOMPurify || { sanitize: (html) => html };
  
    // 2. 监听消息渲染事件
    eventSource.on('chat-message', (message) => {
      const isEnabled = window.extensions.getConfig('htmlRenderer', 'enabled');
      if (!isEnabled) return;
  
      const messageElement = document.querySelector(`[data-message-id="${message.id}"] .message-content`);
      if (!messageElement) return;
  
      // 3. 替换 ```html 代码块
      messageElement.innerHTML = messageElement.innerHTML.replace(
        /```html\n([\s\S]+?)\n```/g,
        (match, html) => {
          return `<div class="rendered-html-block">${DOMPurify.sanitize(html)}</div>`;
        }
      );
    });
  
    // 4. 初始化配置（首次加载时）
    window.extensions.registerConfig('htmlRenderer', {
      enabled: false  // 默认关闭
    });
  })();