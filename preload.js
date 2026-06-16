const { contextBridge, ipcRenderer } = require('electron');

// preload.js は main.js と React の橋渡しです。
// ここで公開した関数だけが window.scheduleApi として画面側から使えます。
// セキュリティのため、ipcRenderer そのものは公開しません。
const api = {
  load: () => ipcRenderer.invoke('schedule:load'),
  saveEntry: (entry, previousDate) => ipcRenderer.invoke('schedule:save-entry', entry, previousDate),
  deleteEntry: (date) => ipcRenderer.invoke('schedule:delete-entry', date),
  getDataPath: () => ipcRenderer.invoke('schedule:get-data-path'),
  confirmDelete: (date) => ipcRenderer.invoke('schedule:confirm-delete', date),
};

// Object.freeze で API の差し替えを防ぎ、公開面を小さく保ちます。
contextBridge.exposeInMainWorld('scheduleApi', Object.freeze(api));
