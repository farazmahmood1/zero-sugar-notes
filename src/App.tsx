import { useState, useEffect } from 'react'
import { Plus, X, MoreHorizontal, List, Settings } from 'lucide-react'
import './App.css'
import { NoteEditor } from './components/NoteEditor'
import { NotesList } from './components/NotesList'

function App() {
  const [content, setContent] = useState('')
  const [noteId, setNoteId] = useState<string>(() => crypto.randomUUID())
  const [color, setColor] = useState('yellow')
  const [view, setView] = useState<'editor' | 'list'>('editor')
  const [notes, setNotes] = useState<any[]>([])
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isBlinking, setIsBlinking] = useState(false)

  const colors = [
    { name: 'yellow', value: '#fff7d1', header: '#fff2ab' },
    { name: 'green', value: '#e4f9e0', header: '#cbf1c4' },
    { name: 'pink', value: '#ffe4f1', header: '#ffcce5' },
    { name: 'purple', value: '#f2e6ff', header: '#e1d4ef' },
  ]

  useEffect(() => {
    const electron = (window as any).electron;
    if (electron && electron.onBlink) {
      const startBlinking = () => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 1000); // Clear after animation
      };

      // We pass the callback to the preload exposure
      // Note: check preload implementation. 
      // Preload: onBlink: (cb) => ipcRenderer.on ...
      // So calling electron.onBlink(startBlinking) sets up the listener.
      electron.onBlink(startBlinking);
    }
  }, []);

  const handleClose = () => {
    window.close();
  };

  const handleNewNote = () => {
    (window as any).ipcRenderer.send('create-new-window');
  };

  const saveCurrentNote = (newContent: string, newColor: string) => {
    const note = {
      id: noteId,
      content: newContent,
      color: newColor,
    };
    (window as any).electron.saveNote(note);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    saveCurrentNote(newContent, color);
  };

  const changeColor = (colorName: string) => {
    setColor(colorName);
    setShowColorPicker(false);
    // Update theme vars
    const selected = colors.find(c => c.name === colorName);
    if (selected) {
      document.documentElement.style.setProperty('--bg-color', selected.value);
      document.documentElement.style.setProperty('--header-color', selected.header);
      // specific fix for charcoal text
      if (colorName === 'charcoal') {
        document.documentElement.style.setProperty('--text-color', '#ffffff');
      } else {
        document.documentElement.style.setProperty('--text-color', '#000000');
      }
    }
    saveCurrentNote(content, colorName);
  };

  const toggleView = async () => {
    const electron = (window as any).electron;
    if (!electron) {
      console.error("Electron API is not available.");
      alert("Electron integration is not working. Please restart the application completely.");
      return;
    }

    if (view === 'editor') {
      try {
        // Check if we can become the list view
        const result = await electron.requestNotesListView();
        if (!result.allowed) {
          // Another window is already the notes list and has been focused/blinked.
          // We just close our menu and stay as we are.
          setShowColorPicker(false);
          return;
        }

        // Allowed to become list view
        const fetchedNotes = await electron.getNotes();
        console.log('Notes fetched, switching to list view:', fetchedNotes);
        setNotes(fetchedNotes);
        setView('list');
      } catch (err: any) {
        console.error('Failed to switch to list view:', err);
        alert("Failed to load notes: " + err.message);
        setNotes([]);
        setView('list'); // Switch anyway so user isn't stuck logic? maybe not if checking failed.
      }
      setShowColorPicker(false);
    } else {
      // Switching back to editor
      try {
        await electron.releaseNotesListView();
      } catch (e) {
        console.error('Failed to release notes list view:', e);
      }
      setView('editor');
      setShowColorPicker(false);
    }
  };

  const openNote = (n: any) => {
    setNoteId(n.id);
    setContent(n.content);
    // Update color
    changeColor(n.color || 'yellow');
    setView('editor');
  };

  const deleteNote = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await (window as any).electron.deleteNote(id);
    setNotes(notes.filter(n => n.id !== id));
  };

  return (
    <div className={`note-container ${color} ${isBlinking ? 'blink-anim' : ''}`}>
      {/* Header */}
      <div className="note-header">
        {view === 'list' ? (
          <div className="app-title">Sticky Notes</div>
        ) : (
          <button className="control-btn no-drag" title="New Note" onClick={handleNewNote}>
            <Plus size={18} />
          </button>
        )}

        <div className="note-controls">
          {view === 'list' ? (
            <button className="control-btn no-drag" title="New Note" onClick={handleNewNote}>
              <Plus size={18} />
            </button>
          ) : null}

          <div className="menu-container">
            <button className="control-btn" title="Menu" onClick={() => setShowColorPicker(!showColorPicker)}>
              <div className="settings-icon">
                {view === 'list' ? <Settings size={18} /> : <MoreHorizontal size={18} />}
              </div>
            </button>
            {showColorPicker && (
              <div className="menu-dropdown">
                {view === 'editor' && (
                  <div className="color-picker-row">
                    {colors.map((c) => (
                      <button
                        key={c.name}
                        className={`color-btn ${color === c.name ? 'active' : ''}`}
                        style={{ backgroundColor: c.value }}
                        onClick={() => changeColor(c.name)}
                        title={c.name}
                      />
                    ))}
                  </div>
                )}

                {view === 'editor' && (
                  <div className="menu-item" onClick={toggleView}>
                    <List size={16} />
                    <span>Notes list</span>
                  </div>
                )}

                {/* In list view, maybe we want a way to go back to *current* note? 
                    Usually list view REPLACES editor. 
                    So user has to click a note to go back.
                    But if they just want to close the list?
                    The "Back" arrow is common. 
                    Current UI shows "Settings" icon in list view.
                    If user clicks it, menu opens. Maybe add "Back to Note" if applicable?
                    For now, clicking a note is the way.
                */}

                {view === 'list' && (
                  <div className="menu-item" onClick={toggleView}>
                    <X size={16} />
                    <span>Close list</span>
                  </div>
                )}


                {view === 'editor' && (
                  <div className="menu-item delete-item" onClick={() => {
                    (window as any).electron.deleteNote(noteId);
                    setContent('');
                    setShowColorPicker(false);
                    // Maybe close window or reset?
                  }}>
                    <X size={16} />
                    <span>Delete current note</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <button className="control-btn close-btn" onClick={handleClose} title="Close">
            <X size={18} />
          </button>
        </div>
      </div>

      {view === 'editor' ? (
        <NoteEditor
          initialContent={content}
          onContentChange={handleContentChange}
        />
      ) : (
        <NotesList
          notes={notes}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenNote={openNote}
          onDeleteNote={deleteNote}
          onCreateNote={handleNewNote}
        />
      )}
    </div>
  )
}

export default App
