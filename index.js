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
  $("#isInjectionEnabled").prop("checked", extension_settings[extensionName].isInjectionEnabled);
  $("#displayMode").val(extension_settings[extensionName].displayMode);
  $("#activationMode").val(extension_settings[extensionName].activationMode);
  $("#customStartFloor").val(extension_settings[extensionName].customStartFloor);
  $("#customEndFloor").val(extension_settings[extensionName].customEndFloor);
  $("#extraHeight").val(extension_settings[extensionName].extraHeight); // 加载 extraHeight
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
  injectHtmlCode();
}

// 事件监听器
let observer;
function onEnabledChange(event) {
  const target = $(event.target);
  const key = target.attr("id");
  const value = target.prop("checked");
  saveSetting(key, value);
  // 处理 iframe 的高度
  if (value) {
    injectHtmlCode();
    observer = new DomChangeObserver.observe(elementToObserve, onMutation);
  }
  else {

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

// Check if a string is valid HTML
function isHTML(str) {
  // 先进行一些快速检查，提高性能
  if (typeof str !== 'string' || str.trim() === '') {
      return false;
  }

  // 完整的HTML文档检测
  const htmlDocRegex = /^\s*<!DOCTYPE html>|<html[\s>]|<\/html>|\<head[\s>]|<\/head>|\<body[\s>]|<\/body>/i;
  
  // HTML片段检测
  const htmlFragmentRegex = /<([a-z][a-z0-9]*)[\s>][\s\S]*<\/\1>|<([a-z][a-z0-9]*)[\s\/>]/i;
  
  // 自闭合标签检测
  const selfClosingTagRegex = /<[a-z][a-z0-9]*\s+[^>]*\/>|<(img|br|hr|input|meta|link|base)[\s>]/i;
  
  // 注释检测
  const commentRegex = /<!--[\s\S]*?-->/;
  
  // 属性检测
  const attributeRegex = /<[a-z][a-z0-9]*\s+[^>]*>/i;
  
  // 组合所有正则条件
  return htmlDocRegex.test(str) || 
         htmlFragmentRegex.test(str) || 
         selfClosingTagRegex.test(str) || 
         commentRegex.test(str) || 
         attributeRegex.test(str);
}

// 主要的注入函数
function injectHtmlCode(specificMesText = null) {
  if (!extension_settings[extensionName].isInjectionEnabled) return;
  removeInjectedIframes(specificMesText);
  const mesTextElements = specificMesText ? [specificMesText] : Array.from(elementToObserve.getElementsByClassName('mes_text'));

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
      const content = codeElement.innerText.trim();
      let targetElement = codeElement.parentElement;

      if (isHTML(content) && !targetElement.hasAttribute('injected')) {
        targetElement.setAttribute('injected', '');
        // 创建一个iframe来运行HTML代码
        const iframe = document.createElement('iframe');

        // 确保每个iframe都有唯一的ID
        iframe.id = 'audio-iframe-' + Math.random().toString(36).substring(2, 11);

        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.marginTop = '10px';

        // 设置 iframe 的内容
        iframe.srcdoc = content;

        // 根据显示模式处理原代码
        if (extension_settings[extensionName].displayMode === 2) {
          const details = document.createElement('details');
          const summary = document.createElement('summary');
          summary.textContent = '[原代码]';
          details.appendChild(summary);
          mesText.insertBefore(details, targetElement);
          details.appendChild(targetElement);
          targetElement = details;
        } else if (extension_settings[extensionName].displayMode === 3) {
          targetElement.style.display = 'none';
        }

        // 将iframe插入到code元素后面
        mesText.insertBefore(iframe, targetElement.nextSibling);

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

function removeInjectedIframes(specificMesText = null) {
  const rootElements = specificMesText ?? elementToObserve;
  const iframes = rootElements.querySelectorAll('.mes_text iframe');
  iframes.forEach(iframe => iframe.remove());

  // 恢复原代码显示
  const codeElements = elementToObserve.querySelectorAll('.mes_text pre[injected]');
  codeElements.forEach(code => {
    code.style.display = '';
    const details = code.closest('details');
    if (details) {
      details.parentNode.insertBefore(code, details);
      details.remove();
    }
    code.removeAttribute('injected');
  });
}

function onMutation(mutations) {
  if (!extension_settings[extensionName].isInjectionEnabled) return;

  const mesTextElements = Array.from(elementToObserve.getElementsByClassName('mes_text'));

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

  for (const mutation of mutations) {
    if (mutation.target.nodeType === Node.ELEMENT_NODE && // 确保是元素节点
      mutation.target.matches('div.mes_text') && mutation.type === 'childList' &&
      targetElements.includes(mutation.target)) {
      injectHtmlCode(mutation.target);
    }
  }
}

// Initialize the extension
jQuery(async () => {
  const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
  $("#extensions_settings").append(settingsHtml);

  // Bind event listeners
  $("#isInjectionEnabled").on("change", onEnabledChange);
  $("#displayMode").on("change", onSettingChange);
  $("#activationMode").on("change", onSettingChange);
  $("#customStartFloor").on("input", onSettingChange);
  $("#customEndFloor").on("input", onSettingChange);
  $("#extraHeight").on("input", onSettingChange); // 监听 extraHeight 的变化

  // Load settings
  loadSettings();
});
