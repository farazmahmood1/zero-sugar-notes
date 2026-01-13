import { useState } from 'react'
import { Plus, X, MoreHorizontal, Bold, Italic, Underline, List } from 'lucide-react'
import './App.css'

function App() {
  const [, setContent] = useState('')

  const handleClose = () => {
    // Try native close, fallback to IPC later if needed
    window.close();
  };

  return (
    <div className="note-container">
      {/* Header */}
      <div className="note-header">
        <button className="control-btn" title="New Note">
          <Plus size={18} />
        </button>
        <div className="note-controls">
          <button className="control-btn" title="Menu">
            <MoreHorizontal size={18} />
          </button>
          <button className="control-btn close-btn" onClick={handleClose} title="Close">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="note-content"
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => setContent(e.currentTarget.textContent || '')}
        spellCheck={false}
      >
        Take a note...
      </div>

      {/* Footer (Formatting Tools) */}
      <div className="note-footer">
        <button className="tool-btn" title="Bold">
          <Bold size={16} />
        </button>
        <button className="tool-btn" title="Italic">
          <Italic size={16} />
        </button>
        <button className="tool-btn" title="Underline">
          <Underline size={16} />
        </button>
        <button className="tool-btn" title="List">
          <List size={16} />
        </button>
      </div>
    </div>
  )
}

export default App
