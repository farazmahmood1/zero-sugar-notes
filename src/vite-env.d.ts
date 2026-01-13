/// <reference types="vite/client" />

interface Window {
    ipcRenderer: import('electron').IpcRenderer
    electron: {
        saveNote: (note: any) => Promise<boolean>
        getNotes: () => Promise<any[]>
        deleteNote: (id: string) => Promise<boolean>
    }
}
