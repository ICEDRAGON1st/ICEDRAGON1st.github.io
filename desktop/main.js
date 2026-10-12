const { app, BrowserWindow, BrowserView, shell, Menu, dialog, ipcMain } = require("electron");
const path = require("path");

/** Live hub — installer stays current without rebuilding for every site update. */
const HUB_URL = process.env.MYGAMES_URL || "https://icedragon1st.github.io/";
const TOOLBAR_H = 44;

const HUB_HOSTS = new Set(["icedragon1st.github.io"]);

/** Auth / API hosts that must stay in-app (Discord login, Supabase, etc.). */
const IN_APP_HOSTS = new Set([
  ...HUB_HOSTS,
  "discord.com",
  "www.discord.com",
  "discordapp.com",
  "cdn.discordapp.com",
  "clkamsflzyvdcepvelks.supabase.co",
  "accounts.google.com",
  "github.com",
  "githubusercontent.com"
]);

let mainWindow = null;
let toolbarView = null;
let hubView = null;

function isAllowedInApp(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (IN_APP_HOSTS.has(host)) return true;
    for (const allowed of IN_APP_HOSTS) {
      if (host.endsWith(`.${allowed}`)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isHubUrl(url) {
  try {
    const u = new URL(url);
    return HUB_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function layoutViews() {
  if (!mainWindow || !toolbarView || !hubView) return;
  const [width, height] = mainWindow.getContentSize();
  toolbarView.setBounds({ x: 0, y: 0, width, height: TOOLBAR_H });
  hubView.setBounds({
    x: 0,
    y: TOOLBAR_H,
    width,
    height: Math.max(100, height - TOOLBAR_H)
  });
}

function refreshHub({ home = false } = {}) {
  if (!hubView) return;
  if (home) {
    hubView.webContents.loadURL(HUB_URL);
    return;
  }
  const url = hubView.webContents.getURL() || "";
  if (!url || url.startsWith("file:")) {
    hubView.webContents.loadURL(HUB_URL);
    return;
  }
  hubView.webContents.reloadIgnoringCache();
}

function wireHubNavigation(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedInApp(url) && isHubUrl(url)) {
      return { action: "allow" };
    }
    shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    if (isAllowedInApp(url)) return;
    event.preventDefault();
    shell.openExternal(url).catch(() => {});
  });

  contents.on("did-fail-load", (_e, errorCode, _err, _validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (errorCode === -3) return;
    hubView.webContents
      .loadFile(path.join(__dirname, "offline.html"), {
        query: { url: HUB_URL }
      })
      .catch(() => {});
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0b1220",
    title: "My Games",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    show: false
  });

  mainWindow.setMenuBarVisibility(false);

  toolbarView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, "toolbar-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  hubView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  mainWindow.addBrowserView(toolbarView);
  mainWindow.addBrowserView(hubView);
  layoutViews();

  toolbarView.webContents.loadFile(path.join(__dirname, "toolbar.html"));
  wireHubNavigation(hubView.webContents);
  hubView.webContents.loadURL(HUB_URL);

  mainWindow.on("resize", layoutViews);
  mainWindow.once("ready-to-show", () => {
    layoutViews();
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    toolbarView = null;
    hubView = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: "My Games",
      submenu: [
        {
          label: "Refresh",
          accelerator: "CmdOrCtrl+R",
          click: () => refreshHub()
        },
        {
          label: "Hard refresh",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () => refreshHub()
        },
        {
          label: "Home",
          accelerator: "Alt+Home",
          click: () => refreshHub({ home: true })
        },
        {
          label: "Open in browser",
          click: () => shell.openExternal(HUB_URL)
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: "Alt+F4",
          click: () => app.quit()
        }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Reload",
          accelerator: "F5",
          click: () => refreshHub()
        },
        { role: "togglefullscreen" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "resetZoom" },
        { type: "separator" },
        {
          label: "Toggle Developer Tools",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => hubView?.webContents.openDevTools({ mode: "detach" })
        }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About My Games",
          click: () => {
            dialog.showMessageBox({
              type: "info",
              title: "My Games",
              message: "My Games",
              detail:
                "Desktop app for ICE_DRAGON's game hub.\nLoads the live site so updates appear without reinstalling.\n\nhttps://icedragon1st.github.io/"
            });
          }
        },
        {
          label: "Discord",
          click: () => shell.openExternal("https://discord.gg/6NHYfPwAwg")
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.on("hub-refresh", () => refreshHub());
ipcMain.on("hub-home", () => refreshHub({ home: true }));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    buildMenu();
    createWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
