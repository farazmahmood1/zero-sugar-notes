import { useState, useEffect } from 'react'
import { Plus, X, MoreHorizontal, List, Settings } from 'lucide-react'
import './App.css'
import { NoteEditor } from './components/NoteEditor'
import { NotesListPage } from './components/NotesListPage'
import { SettingsPage } from './components/SettingsPage'
import { OnboardingPage } from './components/OnboardingPage'

function App() {
  const [view, setView] = useState<'editor' | 'list' | 'settings' | 'onboarding'>('editor');
  const [noteId, setNoteId] = useState<string>('');
  const [initialContent, setInitialContent] = useState('');
  const [color, setColor] = useState('yellow');
  const [isBlinking, setIsBlinking] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Parse query params
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') as any;
    const noteIdParam = params.get('noteId');

    if (viewParam) {
      setView(viewParam);
    }

    const electron = (window as any).electron;
    if (electron) {
      // Load initial config for theme
      electron.getConfig().then((c: any) => {
        if (c) setDarkMode(c.darkMode);
      });

      // Listen for config updates
      electron.onConfigUpdated((newConfig: any) => {
        setDarkMode(newConfig.darkMode);
      });

      if (noteIdParam) {
        setNoteId(noteIdParam);
        // Let's fetch the note data if it's an editor view
        electron.getNotes().then((notes: any[]) => {
          const note = notes.find((n: any) => n.id === noteIdParam);
          if (note) {
            setInitialContent(note.content);
            setColor(note.color);
          }
        });
      } else {
        // No ID param? generate one for a new note.
        const newId = crypto.randomUUID();
        console.log('[App] Initializing new Note ID:', newId);
        setNoteId(newId);
      }
    } else if (!noteIdParam && !viewParam) {
      // Default new note if no params (Web mode)
      setNoteId(crypto.randomUUID());
    }

    // Blink listener
    if (electron && electron.onBlink) {
      electron.onBlink(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 1000);
      });
    }
  }, []);

  // Color update helper for Editor
  const handleContentChange = (newContent: string) => {
    const electron = (window as any).electron;
    console.log('[App] handleContentChange triggered. ID:', noteId, 'Content length:', newContent.length);
    if (electron && noteId) {
      console.log('[App] Sending save-note to Electron...');
      electron.saveNote({
        id: noteId,
        content: newContent,
        color: color
      }).then(() => console.log('[App] save-note success'))
        .catch((e: any) => console.error('[App] save-note failed:', e));
    } else {
      console.warn('[App] Skipping save: electron or noteId missing', { electron: !!electron, noteId });
    }
  };

  const themeClass = darkMode ? 'dark-mode' : 'light-mode';

  if (view === 'list') {
    return (
      <div className={`app-wrapper ${themeClass}`} style={{ height: '100%', width: '100%' }}>
        <NotesListPage />
      </div>
    );
  }

  if (view === 'settings') {
    // SettingsPage handles its own theme, but consistent wrapper helps
    return (
      <div className={`app-wrapper ${themeClass}`} style={{ height: '100%', width: '100%' }}>
        <SettingsPage />
      </div>
    );
  }

  if (view === 'onboarding') {
    return (
      <div className={`app-wrapper ${themeClass}`} style={{ height: '100%', width: '100%' }}>
        <OnboardingPage />
      </div>
    );
  }

  // Default: Editor
  return (
    <div className={`note-container ${color} ${isBlinking ? 'blink-anim' : ''} ${themeClass}`}>
      <EditorLayout
        noteId={noteId}
        initialContent={initialContent}
        color={color}
        setColor={setColor}
        handleContentChange={handleContentChange}
      />
    </div>
  )
}

function EditorLayout({ noteId, initialContent, color, setColor, handleContentChange }: any) {
  const [content, setContent] = useState(initialContent);
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => { setContent(initialContent); }, [initialContent]);

  // Debounced Save - Reduced to 200ms for "real-time" feel while throttling
  useEffect(() => {
    // Avoid saving on initial load if content hasn't changed from initial
    if (content === initialContent) return;

    const handler = setTimeout(() => {
      console.log('[EditorLayout] Debounce timer fired. Calling handleContentChange.');
      handleContentChange(content);
    }, 200);

    return () => clearTimeout(handler);
  }, [content, handleContentChange]); // handleContentChange needs to be stable or this will trigger often.
  // In App component, handleContentChange is defined with noteId dependency.
  // We should probably rely on the content change.

  const handleClose = () => window.close();
  const handleNewNote = () => (window as any).ipcRenderer?.send('create-new-window');

  const changeColor = (c: string, v: string, h: string) => {
    setColor(c);
    // Set properties
    document.documentElement.style.setProperty('--bg-color', v);
    document.documentElement.style.setProperty('--header-color', h);
    if (c === 'charcoal') {
      document.documentElement.style.setProperty('--text-color', '#ffffff');
    } else {
      document.documentElement.style.setProperty('--text-color', '#000000');
    }

    // Save the color update
    const electron = (window as any).electron;
    if (electron) {
      electron.saveNote({ id: noteId, content: content, color: c });
    }

    setShowColorPicker(false);
  }

  const colors = [
    { name: 'yellow', value: '#fff7d1', header: '#fff2ab' },
    { name: 'green', value: '#e4f9e0', header: '#cbf1c4' },
    { name: 'pink', value: '#ffe4f1', header: '#ffcce5' },
    { name: 'purple', value: '#f2e6ff', header: '#e1d4ef' },
  ];

  // Apply initial color
  useEffect(() => {
    const selected = colors.find(c => c.name === color);
    if (selected) {
      document.documentElement.style.setProperty('--bg-color', selected.value);
      document.documentElement.style.setProperty('--header-color', selected.header);
    }
  }, [color]);

  return (
    <>
      <div className="note-header" style={{ WebkitAppRegion: 'drag' } as any}>
        <button className="control-btn no-drag" onClick={handleNewNote}><Plus size={18} /></button>
        <div className="note-controls">
          <div className="menu-container">
            <button className="control-btn" onClick={() => setShowColorPicker(!showColorPicker)}>
              <MoreHorizontal size={18} />
            </button>
            {showColorPicker && (
              <div className="menu-dropdown">
                <div className="color-picker-row">
                  {colors.map(c => (
                    <button key={c.name} className={`color-btn ${color === c.name ? 'active' : ''}`} style={{ backgroundColor: c.value }} onClick={() => changeColor(c.name, c.value, c.header)} />
                  ))}
                </div>
                <div className="menu-item" onClick={() => { (window as any).electron.openNotesList(); setShowColorPicker(false); }}>
                  <List size={16} /> <span>Notes list</span>
                </div>
                <div className="menu-item" onClick={() => { (window as any).electron.openSettings(); setShowColorPicker(false); }}>
                  <Settings size={16} /> <span>Settings</span>
                </div>
                <div className="menu-item" onClick={() => { (window as any).electron.deleteNote(noteId); }}>
                  <X size={16} /> <span>Delete note</span>
                </div>
              </div>
            )}
          </div>
          <button className="control-btn close-btn" onClick={handleClose}><X size={18} /></button>
        </div>
      </div>
      <NoteEditor
        initialContent={content}
        onContentChange={(txt: string) => {
          setContent(txt);
        }}
      />
    </>
  );
}

export default App
