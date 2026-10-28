const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tevApp", {
    isDesktop: true,
    selectFolder: () => ipcRenderer.invoke("dialog:open-directory")
});