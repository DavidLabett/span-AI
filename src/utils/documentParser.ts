/**
 * Document segmentation utility
 * Breaks documents into logical segments (chapters, sections, paragraphs)
 */

import { DocumentSegment } from '../types'

/**
 * Generate unique ID for segments
 */
function generateSegmentId(): string {
  return `segment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Detect if text appears to be a header based on heuristics
 */
function isLikelyHeader(text: string, previousText?: string): boolean {
  const trimmed = text.trim()
  
  // Empty or very short text is not a header
  if (trimmed.length < 3) return false
  
  // Check if it's all uppercase (common for headers)
  if (trimmed === trimmed.toUpperCase() && trimmed.length < 100) return true
  
  // Check if it ends without punctuation (common for headers)
  if (!trimmed.match(/[.!?]$/) && trimmed.length < 100) {
    // If previous text was a paragraph and this is short, might be header
    if (previousText && previousText.length > 50 && trimmed.length < 80) {
      return true
    }
  }
  
  return false
}

/**
 * Parse markdown document into segments
 */
export function parseMarkdown(text: string): DocumentSegment[] {
  const segments: DocumentSegment[] = []
  const lines = text.split('\n')
  
  let currentSegment: DocumentSegment | null = null
  let currentLevel = 0
  let currentText: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    
    if (headerMatch) {
      // Save previous segment if exists
      if (currentSegment && currentText.length > 0) {
        currentSegment.text = currentText.join('\n').trim()
        segments.push(currentSegment)
      }
      
      // Create new segment for header
      const level = headerMatch[1].length
      const headerText = headerMatch[2].trim()
      
      // Determine parent (last segment at lower level)
      let parentId: string | undefined
      for (let j = segments.length - 1; j >= 0; j--) {
        if (segments[j].level < level) {
          parentId = segments[j].id
          break
        }
      }
      
      currentSegment = {
        id: generateSegmentId(),
        level,
        text: headerText,
        type: level === 1 ? 'chapter' : 'section',
        parentId,
      }
      
      currentText = []
      currentLevel = level
    } else if (line.trim() === '') {
      // Empty line - end current paragraph if we have text
      if (currentText.length > 0 && currentSegment) {
        // Continue accumulating for current segment
        currentText.push('')
      } else if (currentText.length > 0) {
        // Create paragraph segment
        const segment: DocumentSegment = {
          id: generateSegmentId(),
          level: currentLevel + 1,
          text: currentText.join('\n').trim(),
          type: 'paragraph',
          parentId: currentSegment?.id,
        }
        segments.push(segment)
        currentText = []
      }
    } else {
      // Regular text line
      currentText.push(line)
    }
  }
  
  // Save last segment
  if (currentSegment) {
    if (currentText.length > 0) {
      currentSegment.text += '\n\n' + currentText.join('\n').trim()
    }
    segments.push(currentSegment)
  } else if (currentText.length > 0) {
    // No headers found, create single paragraph segment
    segments.push({
      id: generateSegmentId(),
      level: 0,
      text: currentText.join('\n').trim(),
      type: 'paragraph',
    })
  }
  
  return segments
}

/**
 * Parse plain text document into segments
 */
export function parsePlainText(text: string): DocumentSegment[] {
  const segments: DocumentSegment[] = []
  
  // Split by double newlines (paragraph breaks)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
  
  let currentLevel = 0
  let previousText = ''
  
  for (const para of paragraphs) {
    const trimmed = para.trim()
    
    // Check if this looks like a header
    if (isLikelyHeader(trimmed, previousText)) {
      // Determine level based on text characteristics
      const level = trimmed === trimmed.toUpperCase() ? 1 : 2
      
      // Find parent (last segment at lower level)
      let parentId: string | undefined
      for (let i = segments.length - 1; i >= 0; i--) {
        if (segments[i].level < level) {
          parentId = segments[i].id
          break
        }
      }
      
      segments.push({
        id: generateSegmentId(),
        level,
        text: trimmed,
        type: level === 1 ? 'chapter' : 'section',
        parentId,
      })
      currentLevel = level
    } else {
      // Regular paragraph
      let parentId: string | undefined
      if (segments.length > 0) {
        // Find last segment at same or lower level
        for (let i = segments.length - 1; i >= 0; i--) {
          if (segments[i].level <= currentLevel) {
            parentId = segments[i].id
            break
          }
        }
      }
      
      segments.push({
        id: generateSegmentId(),
        level: currentLevel + 1,
        text: trimmed,
        type: 'paragraph',
        parentId,
      })
    }
    
    previousText = trimmed
  }
  
  // If no segments created, create a single root segment
  if (segments.length === 0 && text.trim().length > 0) {
    segments.push({
      id: generateSegmentId(),
      level: 0,
      text: text.trim(),
      type: 'paragraph',
    })
  }
  
  return segments
}


/**
 * Parse document based on file extension.
 * PDFs must be converted to markdown via OCR before calling this function.
 */
export function parseDocument(text: string, fileExtension: string): DocumentSegment[] {
  const ext = fileExtension.toLowerCase()

  if (ext === '.md' || ext === 'md') {
    return parseMarkdown(text)
  } else {
    return parsePlainText(text)
  }
}

