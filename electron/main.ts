import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

// CommonJS Shim NOT needed in true CJS, but we need to ensure this compiles to CJS.
// If valid CJS, __dirname is available globally (in Electron Main).
// but in TS with 'moduleResolution' it might complain.
// We will use standard Require for koffi.
const koffi = require('koffi')

// Native Windows API for Privacy
// WDA_EXCLUDEFROMCAPTURE = 0x00000011
let SetWindowDisplayAffinity: any = null;
let GetLastError: any = null;
let notesListWindowId: number | null = null;

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

function createWindow() {
  const win = new BrowserWindow({
    width: 320,
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
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Apply Privacy Mode when (mostly) ready
  win.once('ready-to-show', () => {
    win.show();

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
    win.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  win.on('closed', () => {
    if (notesListWindowId === win.id) {
      notesListWindowId = null;
    }
  });
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()
  console.log('[Main] App Ready, Window Created');

  // IPC Handlers for Notes
  const notesFile = path.join(app.getPath('userData'), 'notes.json');

  function getNotes() {
    try {
      if (fs.existsSync(notesFile)) {
        const data = fs.readFileSync(notesFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to read notes:', e);
    }
    return [];
  }

  function saveNotes(notes: any[]) {
    try {
      fs.writeFileSync(notesFile, JSON.stringify(notes, null, 2));
    } catch (e) {
      console.error('Failed to save notes:', e);
    }
  }

  ipcMain.handle('get-notes', () => {
    return getNotes();
  });

  ipcMain.handle('save-note', (_event, note) => {
    const notes = getNotes();
    const index = notes.findIndex((n: any) => n.id === note.id);
    if (index !== -1) {
      notes[index] = { ...notes[index], ...note, updatedAt: new Date().toISOString() };
    } else {
      notes.unshift({ ...note, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    saveNotes(notes);
    // Notify all windows to update list? For now just return success
    return true;
  });

  ipcMain.handle('delete-note', (_event, noteId) => {
    let notes = getNotes();
    notes = notes.filter((n: any) => n.id !== noteId);
    saveNotes(notes);
    return true;
  });

  ipcMain.handle('request-notes-list-view', (event) => {
    // If a window is already registered as the notes list
    if (notesListWindowId !== null) {
      const existingWin = BrowserWindow.fromId(notesListWindowId);
      if (existingWin) {
        // If the requester is already the notes list, allow it (idempotent)
        if (existingWin.id === event.sender.id) {
          return { allowed: true };
        }
        // Otherwise, focus the existing one and deny the request
        if (existingWin.isMinimized()) existingWin.restore();
        existingWin.show();
        existingWin.focus();
        // Blink the window to draw attention
        existingWin.flashFrame(true);
        existingWin.webContents.send('action-blink');
        return { allowed: false };
      } else {
        // The window ID existed but the window is gone (cleanup failed?), so claim it
        notesListWindowId = event.sender.id;
        return { allowed: true };
      }
    } else {
      // No notes list exists, claim it
      notesListWindowId = event.sender.id;
      return { allowed: true };
    }
  });

  ipcMain.handle('release-notes-list-view', (event) => {
    if (notesListWindowId === event.sender.id) {
      notesListWindowId = null;
    }
    return true;
  });

  ipcMain.on('create-new-window', () => {
    createWindow()
  })
})
