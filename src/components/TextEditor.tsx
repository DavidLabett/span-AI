import { useEffect, useRef, useState } from 'react'
import { theme, typography } from '../theme'

interface TextEditorProps {
  x: number
  y: number
  width: number
  height: number
  value: string
  fontSize: number
  isTitle?: boolean
  onSave: (value: string) => void
  onCancel: () => void
}

/**
 * Floating HTML textarea for editing node text.
 * Positioned absolutely over the canvas.
 */
export function TextEditor({
  x,
  y,
  width,
  height,
  value,
  fontSize,
  isTitle = false,
  onSave,
  onCancel,
}: TextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [textareaHeight, setTextareaHeight] = useState(height)
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-resize textarea based on content
  const adjustHeight = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    
    // Reset height to get accurate scrollHeight
    textarea.style.height = 'auto'
    const newHeight = Math.max(
      height, // Minimum height
      Math.min(
        textarea.scrollHeight + 4, // Content height + padding
        height * 3 // Maximum 3x original height
      )
    )
    setTextareaHeight(newHeight)
    textarea.style.height = `${newHeight}px`
  }

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.focus()
      
      // Don't select all - just place cursor at end for better UX
      // User can still select all with Ctrl+A if needed
      const length = textarea.value.length
      textarea.setSelectionRange(length, length)
      
      // Auto-resize on mount
      adjustHeight()
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Clear any pending blur save
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }

    if (e.key === 'Enter') {
      if (isTitle) {
        // Titles: Enter saves
        e.preventDefault()
        onSave(textareaRef.current?.value || '')
      } else {
        // Descriptions: Enter creates new line, Shift+Enter saves
        if (e.shiftKey) {
          e.preventDefault()
          onSave(textareaRef.current?.value || '')
        }
        // Otherwise, let Enter create new line (default behavior)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Tab') {
      // Prevent tab from blurring
      e.preventDefault()
      // Insert tab or spaces
      const textarea = textareaRef.current
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = textarea.value
        textarea.value = text.substring(0, start) + '  ' + text.substring(end)
        textarea.setSelectionRange(start + 2, start + 2)
        adjustHeight()
      }
    }
  }

  const handleInput = () => {
    adjustHeight()
  }

  const handleBlur = () => {
    // Add small delay to prevent accidental saves when clicking buttons
    blurTimeoutRef.current = setTimeout(() => {
      onSave(textareaRef.current?.value || '')
    }, 150)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
      }
    }
  }, [])

  return (
    <textarea
      ref={textareaRef}
      defaultValue={value}
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      onBlur={handleBlur}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: width,
        minHeight: height,
        height: textareaHeight,
        padding: '4px 6px',
        margin: '0',
        border: 'none',
        outline: `2px solid ${theme.accent}`,
        borderRadius: '2px',
        background: theme.bgNode,
        color: isTitle ? theme.text : theme.textMuted,
        fontFamily: typography.fontFamily,
        fontSize: fontSize,
        fontWeight: isTitle ? 500 : 400,
        lineHeight: typography.lineHeight,
        resize: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        zIndex: 1000,
      }}
    />
  )
}

