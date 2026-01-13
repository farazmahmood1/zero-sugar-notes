import { app, BrowserWindow } from 'electron'
import path from 'node:path'

// CommonJS Shim NOT needed in true CJS, but we need to ensure this compiles to CJS.
// If valid CJS, __dirname is available globally (in Electron Main).
// but in TS with 'moduleResolution' it might complain.
// We will use standard Require for koffi.
const koffi = require('koffi')

// Native Windows API for Privacy
// WDA_EXCLUDEFROMCAPTURE = 0x00000011
let SetWindowDisplayAffinity: any = null;
let GetLastError: any = null;

try {
  const user32 = koffi.load('user32.dll');
  const kernel32 = koffi.load('kernel32.dll');

  SetWindowDisplayAffinity = user32.func('__stdcall', 'SetWindowDisplayAffinity', 'bool', ['void *', 'uint32']);
  GetLastError = kernel32.func('__stdcall', 'GetLastError', 'uint32', []);
} catch (e) {
  console.error('Failed to load native libraries:', e);
}

// The built directory structure
process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 300,
    height: 300,
    minHeight: 100,
    minWidth: 100,
    frame: false,
    transparent: true,
    backgroundColor: '#fff7d1', // Set opaque background
    alwaysOnTop: true,
    show: false, // Don't show immediately, wait for ready-to-show
    hasShadow: true,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Apply Privacy Mode when (mostly) ready
  win.once('ready-to-show', () => {
    win?.show();

    if (SetWindowDisplayAffinity && win && GetLastError) {
      try {
        const hwndBuffer = win.getNativeWindowHandle();
        const WDA_EXCLUDEFROMCAPTURE = 0x00000011;

        // Electron returns a Buffer. We need the actual pointer value (int64)
        // Koffi can accept a number/bigint as a pointer address if type is 'void *'
        let hwnd;
        if (hwndBuffer.length === 8) {
          hwnd = hwndBuffer.readBigInt64LE(0);
        } else {
          hwnd = hwndBuffer.readInt32LE(0);
        }

        console.log(`[Privacy] HWND Buffer Len: ${hwndBuffer.length}, Value: ${hwnd}`);

        // Try setting affinity
        const success = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);

        if (success) {
          console.log(`[Privacy] SetWindowDisplayAffinity(0x11) SUCCESS. Window should be invisible to capture.`);
        } else {
          const errorCode = GetLastError();
          console.error(`[Privacy] SetWindowDisplayAffinity FAILED. Error Code: ${errorCode}`);
        }
      } catch (err) {
        console.error('[Privacy] Exception while setting affinity:', err);
      }
    }
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
