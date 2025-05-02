// The main script for the extension
// The following are examples of some basic extension functionality

// Import necessary modules
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { DomChangeObserver } from "./DomChangeObserver.js";

// Extension configuration
const extensionName = "HTML-Injector";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const defaultSettings = {
  isInjectionEnabled: false,
  displayMode: 1,
  activationMode: 'all',
  customStartFloor: 1,
  customEndFloor: -1,
  extraHeight: 5, // 添加 extraHeight 的默认值
};
const elementToObserve = document.querySelector("#chat");

// Load extension settings
async function loadSettings() {
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  }

  // Update UI with settings
  $("#is_injection_enabled").prop("checked", extension_settings[extensionName].isInjectionEnabled);
  $("#display_mode").val(extension_settings[extensionName].displayMode);
  $("#activation_mode").val(extension_settings[extensionName].activationMode);
  $("#custom_start_floor").val(extension_settings[extensionName].customStartFloor);
  $("#custom_end_floor").val(extension_settings[extensionName].customEndFloor);
  $("#extra_height").val(extension_settings[extensionName].extraHeight); // 加载 extraHeight
}

// Save a specific setting
function saveSetting(key, value) {
  extension_settings[extensionName][key] = value;
  saveSettingsDebounced();
}

// Event listener for setting changes
function onSettingChange(event) {
  const target = $(event.target);
  const key = target.attr("id");
  const value = target.is(":checkbox") ? target.prop("checked") : parseFloat(target.val());
  saveSetting(key, value);
}

// 事件监听器
let observer;
function onEnabledChange(event) {
  const target = $(event.target);
  const key = target.attr("id");
  const value = target.prop("checked");
  saveSetting(key, value);
  injectHtmlCode();
  // 处理 iframe 的高度
  if (value) {
    observer = new DomChangeObserver.observe(elementToObserve, onMutation);
  }
  else {
    removeInjectedIframes();

    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }
}

// Adjust iframe height
function adjustIframeHeight(iframe) {
  const extraHeight = extension_settings[extensionName].extraHeight || 5; // 使用设置中的 extraHeight
  if (iframe.contentWindow.document.body) {
    const height = iframe.contentWindow.document.documentElement.scrollHeight;
    iframe.style.height = (height + extraHeight) + 'px';
  }
}

// 主要的注入函数
function injectHtmlCode(specificMesText = null) {
  const mesTextElements = specificMesText ? [specificMesText] : Array.from(document.getElementsByClassName('mes_text'));

  // 根据激活楼层设置筛选要处理的元素
  let targetElements;
  switch (extension_settings[extensionName].activationMode) {
    case 'first':
      targetElements = mesTextElements.slice(0, 1);
      break;
    case 'last':
      targetElements = mesTextElements.slice(-1);
      break;
    case 'lastN':
      targetElements = mesTextElements.slice(-extension_settings[extensionName].customEndFloor);
      break;
    case 'custom': {
      const start = extension_settings[extensionName].customStartFloor - 1;
      const end = extension_settings[extensionName].customEndFloor === -1 ? undefined : extension_settings[extensionName].customEndFloor;
      targetElements = mesTextElements.slice(start, end);
      break;
    }
    default: // 'all'
      targetElements = mesTextElements;
  }

  // 注入逻辑
  for (const mesText of targetElements) {
    const codeElements = mesText.getElementsByTagName('code');

    for (const codeElement of codeElements) {
      const htmlContent = codeElement.innerText.trim();

      if (htmlContent.startsWith('<') && htmlContent.endsWith('>')) {
        // 创建一个iframe来运行HTML代码
        const iframe = document.createElement('iframe');

        // 确保每个iframe都有唯一的ID
        iframe.id = 'audio-iframe-' + Math.random().toString(36).substring(2, 11);

        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.marginTop = '10px';

        // 设置 iframe 的内容
        iframe.srcdoc = htmlContent;

        // 根据显示模式处理原代码
        if (extension_settings[extensionName].displayMode === 2) {
          const details = document.createElement('details');
          const summary = document.createElement('summary');
          summary.textContent = '[原代码]';
          details.appendChild(summary);
          codeElement.parentNode.insertBefore(details, codeElement);
          details.appendChild(codeElement);
        } else if (extension_settings[extensionName].displayMode === 3) {
          codeElement.style.display = 'none';
        }

        // 将iframe插入到code元素后面
        const nodeToInsert = codeElement.parentNode.parentNode;
        nodeToInsert.insertBefore(iframe, codeElement.parentElement.nextSibling);

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

function removeInjectedIframes() {
  const iframes = elementToObserve.querySelectorAll('.mes_text iframe');
  iframes.forEach(iframe => iframe.remove());

  // 恢复原代码显示
  const codeElements = elementToObserve.querySelectorAll('.mes_text code');
  codeElements.forEach(code => {
    code.style.display = '';
    const details = code.closest('details');
    if (details) {
      details.parentNode.insertBefore(code, details);
      details.remove();
    }
  });
}

function onMutation(mutations) {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE &&
          (node.classList.contains('mes_text') || node.querySelector('.mes_text'))) {
          if (extension_settings[extensionName].isInjectionEnabled) {
            injectHtmlCode();
          }
          break;
        }
      }
    }
  }
}

// Initialize the extension
jQuery(async () => {
  const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
  $("#extensions_settings").append(settingsHtml);

  // Bind event listeners
  $("#is_injection_enabled").on("change", onEnabledChange);
  $("#display_mode").on("change", onSettingChange);
  $("#activation_mode").on("change", onSettingChange);
  $("#custom_start_floor").on("input", onSettingChange);
  $("#custom_end_floor").on("input", onSettingChange);
  $("#extra_height").on("input", onSettingChange); // 监听 extraHeight 的变化

  // Load settings
  loadSettings();
});
