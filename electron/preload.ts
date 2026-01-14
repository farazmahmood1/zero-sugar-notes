import { ipcRenderer, contextBridge } from 'electron'

console.log('[Preload] Script loaded successfully');

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

contextBridge.exposeInMainWorld('electron', {
  saveNote: (note: any) => ipcRenderer.invoke('save-note', note),
  getNotes: () => ipcRenderer.invoke('get-notes'),
  deleteNote: (id: string) => ipcRenderer.invoke('delete-note', id),
  requestNotesListView: () => ipcRenderer.invoke('request-notes-list-view'),
  releaseNotesListView: () => ipcRenderer.invoke('release-notes-list-view'),
  onBlink: (callback: () => void) => ipcRenderer.on('action-blink', (_e) => callback()),
  openNotesList: () => ipcRenderer.send('open-notes-list'),
  openSettings: () => ipcRenderer.send('open-settings'),
  openOnboarding: () => ipcRenderer.send('open-onboarding'),
  onNotesUpdated: (callback: (notes: any[]) => void) => {
    const subscription = (_event: any, notes: any[]) => callback(notes);
    ipcRenderer.on('notes-updated', subscription);
    return () => ipcRenderer.removeListener('notes-updated', subscription);
  },
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  completeOnboarding: () => ipcRenderer.send('complete-onboarding'),
  onConfigUpdated: (callback: (config: any) => void) => ipcRenderer.on('config-updated', (_event, config) => callback(config)),
  loginGoogle: () => ipcRenderer.invoke('login-google'),
})


