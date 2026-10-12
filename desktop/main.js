const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const path = require("path");

/** Live hub — installer stays current without rebuilding for every site update. */
const HUB_URL = process.env.MYGAMES_URL || "https://icedragon1st.github.io/";

const HUB_HOSTS = new Set([
  "icedragon1st.github.io"
]);

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0b1220",
    title: "My Games",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(HUB_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedInApp(url) && isHubUrl(url)) {
      return { action: "allow" };
    }
    shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedInApp(url)) return;
    event.preventDefault();
    shell.openExternal(url).catch(() => {});
  });

  mainWindow.webContents.on("did-fail-load", (_e, errorCode, _err, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    // Ignore aborted loads (e.g. redirect cancel)
    if (errorCode === -3) return;
    mainWindow
      .loadFile(path.join(__dirname, "offline.html"), {
        query: { url: HUB_URL }
      })
      .catch(() => {});
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: "My Games",
      submenu: [
        {
          label: "Reload hub",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow?.loadURL(HUB_URL)
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
        { role: "togglefullscreen" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "resetZoom" },
        { type: "separator" },
        { role: "toggleDevTools" }
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
