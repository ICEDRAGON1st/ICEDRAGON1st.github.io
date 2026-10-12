const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("MyGamesToolbar", {
  refresh: () => ipcRenderer.send("hub-refresh"),
  home: () => ipcRenderer.send("hub-home")
});
