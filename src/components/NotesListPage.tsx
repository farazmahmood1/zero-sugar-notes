import { useState, useEffect } from 'react'
import { NotesList } from './NotesList'
import { RefreshCw } from 'lucide-react'

export function NotesListPage() {
    const [notes, setNotes] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchNotes = () => {
        const electron = (window as any).electron;
        if (!electron) return;
        console.log('[NotesList] Fetching notes...');
        electron.getNotes().then((n: any[]) => {
            console.log('[NotesList] Fetched notes:', n.length);
            setNotes(n)
        });
    };

    useEffect(() => {
        const electron = (window as any).electron;
        if (!electron) return;

        fetchNotes();

        const removeListener = electron.onNotesUpdated((updatedNotes: any[]) => {
            console.log('[NotesList] Review update via event:', updatedNotes.length);
            setNotes(updatedNotes);
        });

        window.addEventListener('focus', fetchNotes);

        return () => {
            if (removeListener && typeof removeListener === 'function') removeListener();
            window.removeEventListener('focus', fetchNotes);
        };
    }, []);

    const handleOpenNote = (note: any) => {
        (window as any).ipcRenderer?.send('open-note', note.id);
    };

    const handleDeleteNote = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        (window as any).electron.deleteNote(id);
    };

    const handleCreateNote = () => {
        (window as any).ipcRenderer?.send('create-new-window');
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div className="notes-list-header" style={{ padding: '8px', WebkitAppRegion: 'drag', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as any}>
                <span>All Notes</span>
                <button
                    onClick={fetchNotes}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', WebkitAppRegion: 'no-drag' } as any}
                    title="Refresh List"
                >
                    <RefreshCw size={14} />
                </button>
            </div>
            <NotesList
                notes={notes}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onOpenNote={handleOpenNote}
                onDeleteNote={handleDeleteNote}
                onCreateNote={handleCreateNote}
            />
        </div>
    )
}
