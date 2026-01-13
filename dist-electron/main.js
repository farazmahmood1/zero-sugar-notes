"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const path = require("node:path");
const koffi = require("koffi");
let SetWindowDisplayAffinity = null;
let GetLastError = null;
try {
  const user32 = koffi.load("user32.dll");
  const kernel32 = koffi.load("kernel32.dll");
  SetWindowDisplayAffinity = user32.func("__stdcall", "SetWindowDisplayAffinity", "bool", ["void *", "uint32"]);
  GetLastError = kernel32.func("__stdcall", "GetLastError", "uint32", []);
} catch (e) {
  console.error("Failed to load native libraries:", e);
}
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new electron.BrowserWindow({
    width: 300,
    height: 300,
    minHeight: 100,
    minWidth: 100,
    frame: false,
    transparent: true,
    backgroundColor: "#fff7d1",
    // Set opaque background
    alwaysOnTop: true,
    show: false,
    // Don't show immediately, wait for ready-to-show
    hasShadow: true,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs")
    }
  });
  win.once("ready-to-show", () => {
    win == null ? void 0 : win.show();
    if (SetWindowDisplayAffinity && win && GetLastError) {
      try {
        const hwndBuffer = win.getNativeWindowHandle();
        const WDA_EXCLUDEFROMCAPTURE = 17;
        let hwnd;
        if (hwndBuffer.length === 8) {
          hwnd = hwndBuffer.readBigInt64LE(0);
        } else {
          hwnd = hwndBuffer.readInt32LE(0);
        }
        console.log(`[Privacy] HWND Buffer Len: ${hwndBuffer.length}, Value: ${hwnd}`);
        const success = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
        if (success) {
          console.log(`[Privacy] SetWindowDisplayAffinity(0x11) SUCCESS. Window should be invisible to capture.`);
        } else {
          const errorCode = GetLastError();
          console.error(`[Privacy] SetWindowDisplayAffinity FAILED. Error Code: ${errorCode}`);
        }
      } catch (err) {
        console.error("[Privacy] Exception while setting affinity:", err);
      }
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
    win = null;
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
electron.app.whenReady().then(createWindow);
exports.MAIN_DIST = MAIN_DIST;
exports.RENDERER_DIST = RENDERER_DIST;
exports.VITE_DEV_SERVER_URL = VITE_DEV_SERVER_URL;
