const { app, BrowserWindow, session, shell, dialog, ipcMain } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

app.commandLine.appendSwitch("disable-http-cache");

const ROOT = path.join(__dirname, "..");
const APP_URL = "http://127.0.0.1:5500/Website/index.html";
const API_URL = "http://127.0.0.1:5000/session";
const FRONTEND_URL = "http://127.0.0.1:5500/";
const CONNECTION_REFUSED = -102;
const MAX_WAIT_ATTEMPTS = 120;

const LOADING_PAGE = "data:text/html;charset=utf-8," + encodeURIComponent(
    "<body style='margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0F0F0F;color:#ffc800;font-family:sans-serif'><h1>Starting Tev...</h1></body>"
);

const servers = [];
let cookiesFlushed = false;

function startServer(args, folder) {
    const bundledExe = path.join(ROOT, "AI", "tev-server.exe");
    const useExe = fs.existsSync(bundledExe);

    const child = useExe
        ? spawn(bundledExe, [], { cwd: folder, stdio: "inherit" })
        : spawn("python", args, { cwd: folder, stdio: "inherit" });

    child.on("error", error => console.error("Could not start server:", error.message));
    servers.push(child);
}

function stopServers() {
    for (const child of servers) {
        if (process.platform === "win32") {
            try {
                spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
            } catch (error) {
                console.error("Failed to kill server process:", error);
            }
        } else {
            try {
                child.kill("SIGKILL");
            } catch (error) {
                console.error("Failed to kill server process:", error);
            }
        }
    }

    servers.length = 0;
}

ipcMain.handle("dialog:open-directory", async () => {
    const result = await dialog.showOpenDialog({
        properties: ["openDirectory"]
    });

    if (result.canceled) {
        return null;
    }

    return result.filePaths[0];
});

function isUp(url) {
    return new Promise(resolve => {
        const request = http.get(url, response => {
            response.resume();
            resolve(true);
        });

        request.on("error", () => resolve(false));
        request.setTimeout(1000, () => {
            request.destroy();
            resolve(false);
        });
    });
}

async function waitFor(url) {
    for (let attempt = 0; attempt < MAX_WAIT_ATTEMPTS; attempt++) {
        if (await isUp(url)) {
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

function openExternal(url) {
    if (url.startsWith("https://") || url.startsWith("http://")) {
        shell.openExternal(url);
    }
}

function isQuitShortcut(input) {
    return input.type === "keyDown" && input.key === "Escape";
}

function createWindow() {
    const window = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: "#0F0F0F",
        icon: path.join(ROOT, "Resources", "Favicon.png"),
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    window.maximize();
    window.show();

    window.setMenuBarVisibility(false);
    window.loadURL(LOADING_PAGE);

    window.webContents.setWindowOpenHandler(({ url }) => {
        openExternal(url);
        return { action: "deny" };
    });

    window.webContents.on("will-navigate", (event, url) => {
        if (new URL(url).origin !== new URL(APP_URL).origin) {
            event.preventDefault();
            openExternal(url);
        }
    });

    window.webContents.on("did-fail-load", (event, errorCode, description, url, isMainFrame) => {
        if (isMainFrame && errorCode === CONNECTION_REFUSED) {
            setTimeout(() => window.loadURL(APP_URL), 1500);
        }
    });

    window.webContents.on("before-input-event", (event, input) => {
        if (isQuitShortcut(input)) {
            event.preventDefault();
            app.quit();
        }
    });

    return window;
}

app.whenReady().then(async () => {
    startServer(["server.py"], path.join(ROOT, "AI"));
    startServer(["-m", "http.server", "5500", "--bind", "127.0.0.1"], ROOT);

    const window = createWindow();

    await Promise.all([waitFor(API_URL), waitFor(FRONTEND_URL)]);
    window.loadURL(APP_URL);
});

app.on("before-quit", event => {
    stopServers();

    if (cookiesFlushed) {
        return;
    }

    event.preventDefault();
    cookiesFlushed = true;
    session.defaultSession.cookies.flushStore().finally(() => app.quit());
});

app.on("window-all-closed", () => {
    app.quit();
});