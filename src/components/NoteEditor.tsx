import { useEffect, useRef } from 'react'
import { Bold, Italic, Underline, List } from 'lucide-react'

interface NoteEditorProps {
    initialContent: string
    onContentChange: (newContent: string) => void
}

export function NoteEditor({ initialContent, onContentChange }: NoteEditorProps) {
    const contentRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (contentRef.current) {
            // We use innerText to respect line breaks but avoid HTML injection if we want plain text.
            // However, the original code used `textContent` in handleContentChange but `contentEditable` allows HTML.
            // If we want rich text (bold/italic), we must use `innerHTML`.
            // The tools (document.execCommand) generate HTML.
            // So we should save/load HTML.
            // But the original `handleContentChange` used `e.currentTarget.textContent`.
            // This means the user generates HTML (bold) but SAVES only text?
            // That would lose formatting on reload.
            // I should fix this to use `innerHTML` for saving if possible, or stick to text if that's the requirement.
            // Given the tools (Bold, Italic), it usually implies HTML support.
            // I'll switch to `innerHTML` for better experience.
            if (initialContent !== contentRef.current.innerHTML) {
                contentRef.current.innerHTML = initialContent
            }
        }
    }, [initialContent])

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        // Determine if we save HTML or Text. Prefer HTML for formatting.
        const content = e.currentTarget.innerHTML
        // console.log('[NoteEditor] Input detected. Length:', content.length);
        onContentChange(content)
    }

    const execCmd = (cmd: string) => {
        document.execCommand(cmd, false, undefined);
        // Force update maybe?
        if (contentRef.current) {
            onContentChange(contentRef.current.innerHTML);
        }
    }

    return (
        <>
            <div
                ref={contentRef}
                className="note-content"
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                spellCheck={false}
                data-placeholder="what's on your mind"
            />

            <div className="note-footer">
                <button className="tool-btn" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); execCmd('bold'); }}>
                    <Bold size={16} />
                </button>
                <button className="tool-btn" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); execCmd('italic'); }}>
                    <Italic size={16} />
                </button>
                <button className="tool-btn" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); execCmd('underline'); }}>
                    <Underline size={16} />
                </button>
                <button className="tool-btn" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); execCmd('insertUnorderedList'); }}>
                    <List size={16} />
                </button>
            </div>
        </>
    )
}
