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

// Keep track of windows
const windows: Record<string, BrowserWindow> = {};
// Map window ID to Note ID for position tracking
const windowNoteMap: Record<number, string> = {};

// Data Persistence Helpers (Hoisted)
function getNotesFilePath() {
  // const config = getConfig(); // Removed to fix lint error
  // getConfig is defined inside app.whenReady. We need to move it out or access it safely.
  // Ideally, valid config is loaded once.
  // For safety in this messy file, let's read config manually here or improve the structure.

  // Quick fix: Read config directly to check for user ID.
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      const conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (conf.user && conf.user.id) {
        return path.join(app.getPath('userData'), `notes_${conf.user.id}.json`);
      }
    }
  } catch (e) { /* ignore */ }

  return path.join(app.getPath('userData'), 'notes.json');
}

function getNotes() {
  try {
    const filePath = getNotesFilePath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(data);
      console.log(`[Main] Loaded ${parsed.length} notes from ${filePath}`);
      if (parsed.length === 0) console.log('[Main] File is valid array but empty.');
      return parsed;
    } else {
      console.log(`[Main] No notes file found at ${filePath}`);
    }
  } catch (e) {
    console.error('[Main] Failed to read notes:', e);
  }
  return [];
}

function saveNotes(notes: any[]) {
  try {
    const filePath = getNotesFilePath();
    const data = JSON.stringify(notes, null, 2);
    fs.writeFileSync(filePath, data);
    console.log(`[Main] Saved ${notes.length} notes to ${filePath}. Content length: ${data.length}`);
  } catch (e) {
    console.error('[Main] Failed to save notes:', e);
  }
}

function createWindow(type: 'editor' | 'list' | 'settings' | 'onboarding' = 'editor', props: any = {}) {
  // Singleton checks
  if (type === 'list' && windows['list'] && !windows['list'].isDestroyed()) {
    windows['list'].focus();
    return;
  }
  if (type === 'settings' && windows['settings'] && !windows['settings'].isDestroyed()) {
    windows['settings'].focus();
    return;
  }

  let width = 320;
  let height = 300;
  let frame = false;
  let alwaysOnTop = true;
  let transparent = true;
  let resizeable = true;

  if (type === 'list') {
    width = 400;
    height = 600;
    frame = false; // Custom header in UI
    alwaysOnTop = false;
    transparent = false; // Solid background for list
  } else if (type === 'settings') {
    width = 350;
    height = 500;
    frame = false;
    alwaysOnTop = true;
    transparent = true;
    resizeable = false;
  } else if (type === 'onboarding') {
    width = 800;
    height = 500;
    frame = true; // Maybe standard frame for onboarding? Or custom. Let's do custom for consistency.
    frame = false;
    alwaysOnTop = true; // Focus it
    transparent = false;
    resizeable = false;
  }

  // Create window logic update
  // Look up note for bounds
  let x: number | undefined;
  let y: number | undefined;

  if (type === 'editor' && props.noteId) {
    const notes = getNotes();
    const note = notes.find((n: any) => n.id === props.noteId);
    if (note) {
      if (note.x) x = note.x;
      if (note.y) y = note.y;
      if (note.width) width = note.width;
      if (note.height) height = note.height;
    }
  }

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    minHeight: 300,
    minWidth: 300,
    frame,
    transparent, // editor is transparent
    // User wants "Ghosts Notes" style.
    // Reverting to previous logic: type === 'list' ? '#ffffff' : '#fff7d1' was default.
    // But if we want custom UI, usually transparent + CSS background.
    // Let's stick to '#00000000' (fully transparent) for editor if we handle background in CSS, 
    // OR keep strict color but use 'backgroundColor' prop.
    backgroundColor: type === 'list' ? '#ffffff' : '#00000000',
    alwaysOnTop,
    show: false,
    hasShadow: true,
    resizable: resizeable,
    icon: path.join(process.env.VITE_PUBLIC, 'Ghosts Notes.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Map window to note if ID exists
  if (type === 'editor' && props.noteId) {
    windowNoteMap[win.id] = props.noteId;
  }

  // ... (rest of createWindow) ...

  win.on('close', () => {
    if (type === 'editor') {
      // Retrieve noteId from map if available, otherwise fallback to props (though props is closure)
      let noteId = windowNoteMap[win.id] || props.noteId;

      if (noteId) {
        // Mark as closed in DB
        const notes = getNotes();
        const index = notes.findIndex((n: any) => n.id === noteId);
        if (index !== -1) {
          notes[index].isOpen = false;
          // Save final position
          const bounds = win.getBounds();
          notes[index].x = bounds.x;
          notes[index].y = bounds.y;
          notes[index].width = bounds.width;
          notes[index].height = bounds.height;
          saveNotes(notes);
        }
        delete windowNoteMap[win.id];
      }
    }
    if (type === 'list' || type === 'settings') {
      delete windows[type];
    }
  });

  // Save Config and etc... (omitted for brevity in replacement, targeting specific blocks)
  // Actually, I need to replace 'createWindow' and 'ipcMain.handle("save-note")'
  // I will do specific chunks for precision.

  // Store reference for singletons
  if (type === 'list' || type === 'settings') {
    windows[type] = win;
  }

  // Apply Privacy Mode (skip for list perhaps? User said "Notes List" should show invisible notes? No, screen share visibility. 
  // Let's keep it safe and apply to all for now unless specified.)
  win.once('ready-to-show', () => {
    win.show();

    if (SetWindowDisplayAffinity && win && GetLastError) {
      try {
        const hwndBuffer = win.getNativeWindowHandle();
        const WDA_EXCLUDEFROMCAPTURE = 0x00000011;

        let hwnd;
        if (hwndBuffer.length === 8) {
          hwnd = hwndBuffer.readBigInt64LE(0);
        } else {
          hwnd = hwndBuffer.readInt32LE(0);
        }
        SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
      } catch (err) {
        console.error('[Privacy] Exception while setting affinity:', err);
      }
    }
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  const loadQuery = `?view=${type}${props.noteId ? `&noteId=${props.noteId}` : ''}`;
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + loadQuery)
  } else {
    // In production, we need to load index.html and then hash router or query param? 
    // Electron+React usually fine with query params on file protocol if hash router is used or just parsing window.location
    win.loadURL(`file://${path.join(RENDERER_DIST, 'index.html')}${loadQuery}`)
  }

  win.on('closed', () => {
    // Cleanup if not already done
    if (type === 'list' || type === 'settings') {
      delete windows[type];
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
  console.log('[Main] App Ready');

  // Config management
  const configFile = path.join(app.getPath('userData'), 'config.json');

  function getConfig() {
    try {
      if (fs.existsSync(configFile)) {
        return JSON.parse(fs.readFileSync(configFile, 'utf8'));
      }
    } catch (e) {
      console.error('Failed to read config:', e);
    }
    return {
      onboardingComplete: false,
      darkMode: true,
      confirmDelete: true,
      user: null,
      authToken: null
    };
  }

  function saveConfig(config: any) {
    try {
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  }

  // Cloud Sync Helpers
  const API_URL = 'http://localhost:3000/api'; // Dev URL
  const cloudSyncTimers: Record<string, NodeJS.Timeout> = {};

  async function syncToCloud(note: any) {
    const config = getConfig();
    if (!config.authToken) return;

    // Debounce cloud sync (2 seconds)
    if (cloudSyncTimers[note.id]) {
      clearTimeout(cloudSyncTimers[note.id]);
    }

    cloudSyncTimers[note.id] = setTimeout(async () => {
      try {
        await fetch(`${API_URL}/notes/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.authToken}`
          },
          body: JSON.stringify({ notes: [note] })
        });
        delete cloudSyncTimers[note.id];
      } catch (e) {
        console.error('Cloud sync failed:', e);
      }
    }, 2000);
  }

  async function deleteFromCloud(noteId: string) {
    const config = getConfig();
    if (!config.authToken) return;
    try {
      await fetch(`${API_URL}/notes/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.authToken}`
        },
        body: JSON.stringify({ notes: [{ id: noteId, isDeleted: true }] })
      });
    } catch (e) {
      console.error('Cloud delete failed:', e);
    }
  }

  async function fetchFromCloud() {
    const config = getConfig();
    if (!config.authToken) return;

    try {
      const response = await fetch(`${API_URL}/notes`, {
        headers: { 'Authorization': `Bearer ${config.authToken}` }
      });
      if (response.ok) {
        const cloudNotes = await response.json();
        const localNotes = getNotes();

        let merged = [...localNotes];
        let changed = false;

        cloudNotes.forEach((cNote: any) => {
          const index = merged.findIndex(l => l.id === cNote.id);
          if (index === -1) {
            if (!cNote.is_deleted) {
              merged.unshift({
                id: cNote.id,
                content: cNote.content,
                color: cNote.color,
                createdAt: cNote.created_at,
                updatedAt: cNote.updated_at
              });
              changed = true;
            }
          } else {
            const lNote = merged[index];
            const cDate = new Date(cNote.updated_at || cNote.updatedAt).getTime();
            const lDate = new Date(lNote.updatedAt).getTime();
            if (cDate > lDate) {
              if (cNote.is_deleted) {
                merged.splice(index, 1);
              } else {
                merged[index] = {
                  id: cNote.id,
                  content: cNote.content,
                  color: cNote.color,
                  createdAt: cNote.created_at,
                  updatedAt: cNote.updated_at
                };
              }
              changed = true;
            }
          }
        });

        if (changed) {
          saveNotes(merged);
          broadcastUpdate();
        }
      }
    } catch (e) {
      console.error('Fetch from cloud failed:', e);
    }
  }

  // Initial Launch Logic
  const config = getConfig();
  if (config.onboardingComplete) {
    const notes = getNotes();
    const openNotes = notes.filter((n: any) => n.isOpen);
    if (openNotes.length > 0) {
      openNotes.forEach((n: any) => createWindow('editor', { noteId: n.id }));
    } else {
      createWindow('editor');
    }
    fetchFromCloud();
  } else {
    createWindow('onboarding');
  }

  // IPC Handlers for Notes
  // notesFile removed in favor of getNotesFilePath() helper
  const notesPathForLog = getNotesFilePath();
  console.log('[Main] Notes file path:', notesPathForLog);

  // Removed local getNotes/saveNotes to use hoisted versions

  ipcMain.handle('get-notes', () => {
    return getNotes();
  });

  // Broadcast updates
  function broadcastUpdate() {
    BrowserWindow.getAllWindows().forEach(w => {
      w.webContents.send('notes-updated', getNotes());
    });
  }

  ipcMain.handle('save-note', (_event, note) => {
    // Modification: Do NOT delete if empty. User wants "Empty Note" state.
    // We only delete if explicitly requested (accessed via delete-note).

    // However, if it's a NEW note and empty, maybe we still save it?
    // User said: "Default Empty Note State... display an entry titled “Empty Note”"
    // So yes, we save it.

    const notes = getNotes();
    const index = notes.findIndex((n: any) => n.id === note.id);
    let updatedNote = { ...note };

    console.log('[Main] Saving note:', note.id);

    if (index !== -1) {
      updatedNote = { ...notes[index], ...note, updatedAt: new Date().toISOString(), isOpen: true };
      notes[index] = updatedNote;
    } else {
      updatedNote.createdAt = new Date().toISOString();
      updatedNote.updatedAt = new Date().toISOString();
      updatedNote.isOpen = true;
      notes.unshift(updatedNote);
    }

    // Position Update if window exists
    const win = BrowserWindow.fromWebContents(_event.sender);
    if (win) {
      const bounds = win.getBounds();
      updatedNote.x = bounds.x;
      updatedNote.y = bounds.y;
      updatedNote.width = bounds.width;
      updatedNote.height = bounds.height;
      // Update map to track this window's Note ID (important for new notes)
      windowNoteMap[win.id] = note.id;
    }

    saveNotes(notes);
    console.log('[Main] Broadcasting update. Note count:', notes.length);
    broadcastUpdate();
    try {
      syncToCloud(updatedNote);
    } catch (e) {
      console.error('[Main] Sync trigger failed:', e);
    }
    return true;
  });

  // Deletion: Find and close window
  ipcMain.handle('delete-note', (_event, noteId) => {
    let notes = getNotes();
    notes = notes.filter((n: any) => n.id !== noteId);
    saveNotes(notes);
    broadcastUpdate();
    deleteFromCloud(noteId);

    // Close window if open
    const targetWinId = Object.keys(windowNoteMap).find(key => windowNoteMap[Number(key)] === noteId);
    if (targetWinId) {
      const win = BrowserWindow.fromId(Number(targetWinId));
      if (win) win.close();
      delete windowNoteMap[Number(targetWinId)];
    }

    return true;
  });

  ipcMain.handle('request-notes-list-view', (event) => {
    // Legacy support or specific use case
    // For now, reuse logic or just allow always since we have dedicated window
    // Logic kept for compatibility if needed, else redundant with dedicated window
    if (notesListWindowId !== null) {
      const existingWin = BrowserWindow.fromId(notesListWindowId);
      if (existingWin) {
        if (existingWin.id === event.sender.id) return { allowed: true };
        if (existingWin.isMinimized()) existingWin.restore();
        existingWin.show();
        existingWin.focus();
        existingWin.flashFrame(true);
        existingWin.webContents.send('action-blink');
        return { allowed: false };
      } else {
        notesListWindowId = event.sender.id;
        return { allowed: true };
      }
    } else {
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

  // Config Handlers
  ipcMain.handle('get-config', () => getConfig());
  ipcMain.handle('save-config', (_event, newConfig) => {
    const config = getConfig();
    const updated = { ...config, ...newConfig };
    saveConfig(updated);
    // Broadcast config update
    BrowserWindow.getAllWindows().forEach(w => {
      w.webContents.send('config-updated', updated);
    });
    return updated;
  });

  ipcMain.on('complete-onboarding', (event) => {
    const config = getConfig();
    config.onboardingComplete = true;
    saveConfig(config);

    // Close Onboarding Window
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();

    // Open editor
    createWindow('editor');
  });

  ipcMain.handle('login-google', (event) => {
    return new Promise((resolve, reject) => {
      // Get parent window to ensure modal behavior if desired, or just use alwaysOnTop
      const parentWin = BrowserWindow.fromWebContents(event.sender);

      const authWindow = new BrowserWindow({
        width: 500,
        height: 600,
        show: true,
        parent: parentWin || undefined,
        modal: !!parentWin,
        alwaysOnTop: true, // Ensure it stays on top
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
      const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI;

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=email%20profile%20openid&access_type=online`;
      authWindow.loadURL(authUrl);

      authWindow.webContents.on('will-redirect', (event, url) => {
        handleAuthUrl(url);
      });

      authWindow.webContents.on('will-navigate', (event, url) => {
        handleAuthUrl(url);
      });

      async function handleAuthUrl(url: string) {
        if (url.includes('code=')) {
          const raw = url.split('?')[1];
          const params = new URLSearchParams(raw);
          const code = params.get('code');

          if (code) {
            // Do NOT destroy immediately, wait for token exchange or it might look abrupt? 
            // Actually destroying is fine, but lets wait for success.

            try {
              const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  code: code,
                  client_id: GOOGLE_CLIENT_ID,
                  client_secret: GOOGLE_CLIENT_SECRET,
                  redirect_uri: REDIRECT_URI,
                  grant_type: 'authorization_code'
                })
              });

              const tokenData = await tokenRes.json();

              if (tokenData.error) {
                console.error('Token exchange error:', tokenData);
                reject('Token exchange failed: ' + (tokenData.error_description || tokenData.error));
                authWindow.destroy();
                return;
              }

              const idToken = tokenData.id_token;

              // Validate with Backend
              const loginRes = await fetch('http://localhost:3000/api/user/login', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${idToken}` }
              });

              const loginData = await loginRes.json();

              if (loginData.user) {
                const config = getConfig();
                config.user = loginData.user;
                config.authToken = idToken;
                config.onboardingComplete = true; // Mark as complete on login
                saveConfig(config);

                authWindow.destroy();

                // Close Onboarding Window (Parent)
                if (parentWin && !parentWin.isDestroyed()) parentWin.close();

                createWindow('editor');
                resolve(loginData.user);
              } else {
                authWindow.destroy();
                reject('Login failed at backend');
              }
            } catch (err) {
              console.error('Login process error', err);
              authWindow.destroy();
              reject(err);
            }
          }
        }
      }

      authWindow.on('closed', () => {
        // Cleanup
      });
    });
  });

  // New Handlers for separate windows
  ipcMain.on('open-notes-list', () => {
    createWindow('list');
  });

  ipcMain.on('open-note', (_event, noteId) => {
    createWindow('editor', { noteId });
  });

  ipcMain.on('open-settings', () => {
    createWindow('settings');
  });

  ipcMain.on('open-onboarding', () => {
    createWindow('onboarding');
  });

  ipcMain.on('create-new-window', () => {
    createWindow('editor');
  })
})

