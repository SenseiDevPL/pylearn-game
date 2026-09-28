import Editor from '@monaco-editor/react'
import { useState, useEffect } from 'react'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 1024)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 1024)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return mobile
}

export function CodeEditor({ value, onChange, disabled }: CodeEditorProps) {
  const isMobile = useIsMobile()

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-indigo-500/5 touch-pan-y">
      <div className="bg-slate-800 px-4 py-2 flex items-center gap-2 border-b border-slate-700/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-slate-400 text-sm ml-2 font-mono">main.py</span>
      </div>
      <Editor
        height={isMobile ? '200px' : '360px'}
        language="python"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: isMobile ? 13 : 14,
          lineNumbers: isMobile ? 'off' : 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 4,
          insertSpaces: true,
          automaticLayout: true,
          readOnly: disabled,
          padding: { top: 8, bottom: 8 },
          overviewRulerBorder: false,
          scrollbar: { verticalScrollbarSize: 6 },
          domReadOnly: isMobile ? false : false,
        }}
        onMount={(editor) => {
          if (isMobile) {
            const dom = editor.getDomNode()
            if (dom) {
              dom.style.touchAction = 'pan-y'
              // Force all child elements to allow vertical scrolling
              const style = document.createElement('style')
              style.textContent = '.monaco-editor, .monaco-editor * { touch-action: pan-y !important; }'
              dom.appendChild(style)
            }
          }
        }}
      />
    </div>
  )
}
