import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";

(function () {
  'use strict';

  // 从扩展设置中获取设置
  const extensionName = "st-extension-example";
  const extensionSettings = extension_settings[extensionName];

  let isInjectionEnabled = extensionSettings.isInjectionEnabled || false;
  let displayMode = extensionSettings.displayMode || 1;
  let activationMode = extensionSettings.activationMode || 'all';
  let customStartFloor = extensionSettings.customStartFloor || 1;
  let customEndFloor = extensionSettings.customEndFloor || -1;

  // 全局消息监听器
  window.addEventListener('message', function (event) {
    if (event.data === 'loaded') {
      // 处理 iframe 加载完成的消息
      const iframes = document.querySelectorAll('.mes_text iframe');
      iframes.forEach(iframe => {
        if (iframe.contentWindow === event.source) {
          adjustIframeHeight(iframe);
        }
      });
    } else if (event.data.type === 'buttonClick') {
      // 处理按钮点击事件
      const buttonName = event.data.name;
      jQuery('.qr--button.menu_button').each(function () {
        if (jQuery(this).find('.qr--button-label').text().trim() === buttonName) {
          jQuery(this).click();
          return false; // 退出 each 循环
        }
      });
    } else if (event.data.type === 'textInput') {
      // 处理文本输入
      const sendTextarea = document.getElementById('send_textarea');
      if (sendTextarea) {
        sendTextarea.value = event.data.text;
        // 触发 input 事件以确保任何监听器都能捕捉到变化
        sendTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        // 如果需要，也可以触发 change 事件
        sendTextarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (event.data.type === 'sendClick') {
      // 处理发送按钮点击
      const sendButton = document.getElementById('send_but');
      if (sendButton) {
        sendButton.click();
      }
    }
  });

  // 添加一个自定义的 :contains 选择器
  jQuery.expr[':'].contains = function (a, i, m) {
    return jQuery(a).text().toUpperCase().indexOf(m[3].toUpperCase()) >= 0;
  };

  // 调整 iframe 高度的函数
  function adjustIframeHeight(iframe) {
    if (iframe.contentWindow.document.body) {
      const height = iframe.contentWindow.document.documentElement.scrollHeight;
      iframe.style.height = (height + 5) + 'px'; // 添加一些额外的高度
    }
  }

  // 主要的注入函数
  function injectHtmlCode(specificMesText = null) {
    let mesTextElements = specificMesText ? [specificMesText] : Array.from(document.getElementsByClassName('mes_text'));

    // 根据激活楼层设置筛选要处理的元素
    let targetElements;
    switch (activationMode) {
      case 'first':
        targetElements = mesTextElements.slice(0, 1);
        break;
      case 'last':
        targetElements = mesTextElements.slice(-1);
        break;
      case 'lastN':
        targetElements = mesTextElements.slice(-customEndFloor);
        break;
      case 'custom': {
        const start = customStartFloor - 1;
        const end = customEndFloor === -1 ? undefined : customEndFloor;
        targetElements = mesTextElements.slice(start, end);
        break;
      };
      default: // 'all'
        targetElements = mesTextElements;
    }

    // 注入逻辑
    for (const mesText of targetElements) {
      const codeElements = mesText.getElementsByTagName('code');

      for (const codeElement of codeElements) {
        let htmlContent = codeElement.innerText.trim();

        if (htmlContent.startsWith('<') && htmlContent.endsWith('>')) {
          // 创建一个iframe来运行HTML代码
          const iframe = document.createElement('iframe');

          // 确保每个iframe都有唯一的ID
          iframe.id = 'audio-iframe-' + Math.random().toString(36).substr(2, 9);

          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = 'none';
          iframe.style.marginTop = '10px';

          // 设置 iframe 的内容
          iframe.srcdoc = htmlContent;

          // 根据显示模式处理原代码
          if (displayMode === 2) {
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = '[原代码]';
            details.appendChild(summary);
            codeElement.parentNode.insertBefore(details, codeElement);
            details.appendChild(codeElement);
          } else if (displayMode === 3) {
            codeElement.style.display = 'none';
          }

          // 将iframe插入到code元素后面
          codeElement.parentNode.insertBefore(iframe, codeElement.parentElement.nextSibling);

          // 初始调整iframe高度
          iframe.onload = function () {
            adjustIframeHeight(iframe);
            // 再次调整高度，以防有延迟加载的内容
            setTimeout(() => adjustIframeHeight(iframe), 500);
          };

          // 监听 iframe 内容变化
          if (iframe.contentWindow) {
            const resizeObserver = new ResizeObserver(() => adjustIframeHeight(iframe));
            resizeObserver.observe(iframe.contentWindow.document.body);
          }
        }
      }
    }
  }

  // 楼层初始化设置
  document.querySelector(`input[name="display-mode"][value="${displayMode}"]`).checked = true;
  document.getElementById('activation-mode').value = activationMode;
  document.getElementById('custom-start-floor').value = customStartFloor;
  document.getElementById('custom-end-floor').value = customEndFloor;
  document.getElementById('last-n-floors').value = customEndFloor;

  if (activationMode === 'custom') {
    document.getElementById('custom-floor-settings').style.display = 'block';
  } else if (activationMode === 'lastN') {
    document.getElementById('last-n-settings').style.display = 'block';
  }


  function removeInjectedIframes() {
    const iframes = document.querySelectorAll('.mes_text iframe');
    iframes.forEach(iframe => iframe.remove());

    // 恢复原代码显示
    const codeElements = document.querySelectorAll('.mes_text code');
    codeElements.forEach(code => {
      code.style.display = '';
      const details = code.closest('details');
      if (details) {
        details.parentNode.insertBefore(code, details);
        details.remove();
      }
    });
  }

  function checkLastMesTextChange() {
    const mesTextElements = document.getElementsByClassName('mes_text');
    if (mesTextElements.length > 0) {
      const lastMesText = mesTextElements[mesTextElements.length - 1];
      const codeElement = lastMesText.querySelector('code');
      if (codeElement) {
        const currentContent = codeElement.innerText.trim();
        const injectedIframe = lastMesText.querySelector('iframe');

        // 检查是否有变化或者没有注入的iframe
        if (currentContent !== lastMesTextContent || (isInjectionEnabled && !injectedIframe)) {
          lastMesTextContent = currentContent;
          if (isInjectionEnabled) {
            // 如果已经有iframe，先移除
            if (injectedIframe) {
              injectedIframe.remove();
            }
            // 重新注入
            injectHtmlCode(lastMesText);
          }
        }
      } else {
        // 如果没有code标签，但之前有内容，清除lastMesTextContent
        if (lastMesTextContent !== '') {
          lastMesTextContent = '';
          // 如果有之前注入的iframe，移除它
          const injectedIframe = lastMesText.querySelector('iframe');
          if (injectedIframe) {
            injectedIframe.remove();
          }
        }
      }
    }
  }

  // 监听DOM变化，处理动态加载的内容
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE &&
            (node.classList.contains('mes_text') || node.querySelector('.mes_text'))) {
            if (isInjectionEnabled) {
              injectHtmlCode();
            }
            break;
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // 边缘控制面板位置
  const savedPosition = GM_getValue('edgeControlsPosition', 'top-right');
  document.getElementById('edge-controls-position').value = savedPosition;
  updateEdgeControlsPosition(savedPosition);

  // 每2秒检查一次最后一个 mes_text 的变化
  setInterval(checkLastMesTextChange, 2000);

  // 在主脚本中添加全局音频管理
  function createGlobalAudioManager() {
    let currentPlayingIframeId = null;

    window.addEventListener('message', function (event) {
      if (event.data.type === 'audioPlay') {
        const newIframeId = event.data.iframeId;

        // 如果有其他iframe在播放音频，发送停止指令
        if (currentPlayingIframeId && currentPlayingIframeId !== newIframeId) {
          document.querySelectorAll('iframe').forEach(iframe => {
            iframe.contentWindow.postMessage({
              type: 'stopAudio',
              iframeId: newIframeId
            }, '*');
          });
        }

        currentPlayingIframeId = newIframeId;
      }
    });
  }

  // 初始化设置
  document.querySelector(`input[name="display-mode"][value="${displayMode}"]`).checked = true;

  // 初始化边缘控制面板状态
  updateEdgeControlsDisplay();

  // 在脚本初始化时调用全局音频控制
  createGlobalAudioManager();
})();
