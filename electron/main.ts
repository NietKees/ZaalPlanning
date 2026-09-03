import { app, BrowserWindow, protocol, net } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import started from "electron-squirrel-startup";
import "./backend/router";
import { initBackupScheduler } from "./backend/routes/backup";

if (started) {
  app.quit();
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,
    title: "Plan Zaalhuur",
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.js"),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.on("did-frame-finish-load", () => {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    });
  } else {
    // 1. Load root "/" (NOT "/index.html") so SvelteKit matches the "/" route
    mainWindow.loadURL("app://-/");
  }
};

app.on("ready", () => {
  // 2. Intercept app:// requests and map them cleanly to built files
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    let requestPath = url.pathname;

    // Map root "/" or empty paths to index.html on disk
    if (requestPath === "/" || requestPath === "") {
      requestPath = "/index.html";
    }
    // If navigating to a directory route like /clients/, map to /clients/index.html
    else if (requestPath.endsWith("/")) {
      requestPath += "index.html";
    }

    const filePath = path.join(
        app.getAppPath(),
        ".vite",
        "renderer",
        MAIN_WINDOW_VITE_NAME,
        requestPath
    );

    return net.fetch(pathToFileURL(filePath).href);
  });

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  initBackupScheduler();
});