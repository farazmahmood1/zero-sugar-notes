import React from 'react'
import { Search, X, Plus } from 'lucide-react'

interface Note {
    id: string
    content: string
    color: string
    updatedAt: string
}

interface NotesListProps {
    notes: Note[]
    searchQuery: string
    setSearchQuery: (q: string) => void
    onOpenNote: (note: Note) => void
    onDeleteNote: (e: React.MouseEvent, id: string) => void
    onCreateNote: () => void
}

export function NotesList({ notes, searchQuery, setSearchQuery, onOpenNote, onDeleteNote, onCreateNote }: NotesListProps) {

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    const filteredNotes = notes.filter(n =>
        (n.content || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Helper to strip HTML for preview
    const getPreview = (html: string) => {
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    return (
        <div className="notes-list-view">
            <div className="search-bar">
                <div className="search-input-wrapper">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search className="search-icon" size={16} />
                </div>
                <button className="create-note-btn" onClick={onCreateNote}>
                    +
                </button>
            </div>

            {filteredNotes.length === 0 && !searchQuery ? (
                <div className="empty-state">
                    <div className="empty-state-image">
                        <div className="sticky-graphic">
                            <div className="sticky-graphic-inner"></div>
                            <div className="sticky-pencil"></div>
                        </div>
                    </div>
                    <p>Tap the new note button above<br />to create a note</p>
                </div>
            ) : (
                <div className="notes-list">
                    {filteredNotes.map(n => (
                        <div key={n.id} className="note-list-item" onClick={() => onOpenNote(n)}>
                            <div className="note-info">
                                <div className="note-preview-text">
                                    {(!n.content || n.content.trim() === '') ? 'Empty Note' : getPreview(n.content)}
                                </div>
                                <div className="note-date">{formatDate(n.updatedAt)}</div>
                            </div>
                            <button className="delete-note-btn" onClick={(e) => onDeleteNote(e, n.id)}>
                                <X size={14} color="white" />
                            </button>
                        </div>
                    ))}
                    {filteredNotes.length === 0 && searchQuery && (
                        <div className="no-results">No notes found</div>
                    )}
                </div>
            )}
        </div>
    )
}
