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
 * Parse PDF document using font size and position data
 */
export function parsePDFWithStructure(
  textItems: Array<{
    text: string
    fontSize: number
    isBold: boolean
    y: number
    x: number
    pageNumber: number
  }>
): DocumentSegment[] {
  const segments: DocumentSegment[] = []
  
  if (!textItems || textItems.length === 0) {
    return segments
  }
  
  // Sort by page number, then by Y position (top to bottom), then by X position (left to right)
  const sortedItems = [...textItems].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) {
      return a.pageNumber - b.pageNumber
    }
    // Higher Y values are lower on the page (PDF coordinates)
    if (Math.abs(a.y - b.y) > 3) {
      return b.y - a.y
    }
    return a.x - b.x
  })
  
  // First pass: Group text items that are on the same line into sentences
  // Items on the same line (similar Y position) should be grouped together
  const LINE_TOLERANCE = 3  // Y position difference to consider same line
  const groupedLines: Array<{
    items: typeof textItems
    y: number
    pageNumber: number
  }> = []
  
  for (const item of sortedItems) {
    const trimmedText = item.text.trim()
    if (trimmedText.length === 0) continue
    
    // Find if this item belongs to an existing line
    let foundLine = false
    for (const line of groupedLines) {
      if (line.pageNumber === item.pageNumber && 
          Math.abs(line.y - item.y) <= LINE_TOLERANCE) {
        line.items.push(item)
        foundLine = true
        break
      }
    }
    
    if (!foundLine) {
      groupedLines.push({
        items: [item],
        y: item.y,
        pageNumber: item.pageNumber,
      })
    }
  }
  
  // Sort lines by page and Y position
  groupedLines.sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) {
      return a.pageNumber - b.pageNumber
    }
    return b.y - a.y  // Higher Y = lower on page
  })
  
  // Calculate font size statistics from grouped lines
  const allFontSizes = groupedLines.flatMap(line => 
    line.items.map(item => item.fontSize).filter(fs => fs > 0)
  )
  const avgFontSize = allFontSizes.length > 0
    ? allFontSizes.reduce((a, b) => a + b, 0) / allFontSizes.length
    : 12
  const maxFontSize = allFontSizes.length > 0 ? Math.max(...allFontSizes) : 12
  
  // Define stricter thresholds for header detection
  const largeHeaderThreshold = avgFontSize * 1.4  // 40% larger than average
  const mediumHeaderThreshold = avgFontSize * 1.25  // 25% larger than average
  const smallHeaderThreshold = avgFontSize * 1.1  // 10% larger than average
  
  let currentLevel = 0
  let currentParagraph: string[] = []
  let currentParagraphLines: typeof groupedLines = []
  let previousY = -1
  let previousPage = -1
  
  for (let i = 0; i < groupedLines.length; i++) {
    const line = groupedLines[i]
    
    // Combine items on this line into a single text string
    const lineItems = line.items.sort((a, b) => a.x - b.x)
    const lineText = lineItems.map(item => item.text.trim()).filter(t => t.length > 0).join(' ')
    const trimmedLineText = lineText.trim()
    
    if (trimmedLineText.length === 0) continue
    
    // Get representative item for this line (use first item or largest font)
    const representativeItem = lineItems.reduce((prev, curr) => 
      curr.fontSize > prev.fontSize ? curr : prev
    )
    
    // Check for page break or significant vertical gap
    const isNewPage = line.pageNumber !== previousPage
    const verticalGap = previousY > 0 ? previousY - line.y : 0
    const isLargeGap = verticalGap > 25  // Significant gap suggests new section
    
    // Stricter header detection
    const isLargeHeader = representativeItem.fontSize >= largeHeaderThreshold
    const isMediumHeader = representativeItem.fontSize >= mediumHeaderThreshold
    const isSmallHeader = representativeItem.fontSize >= smallHeaderThreshold && representativeItem.isBold
    
    // Header must be:
    // - At least 3 characters (not single words)
    // - Not too long (headers are usually short)
    // - No ending punctuation (headers don't end with .!?)
    // - Either large font OR (medium font + bold) OR (centered + short)
    const minLength = 3
    const maxLength = 150
    const hasValidLength = trimmedLineText.length >= minLength && trimmedLineText.length <= maxLength
    const hasNoEndPunctuation = !trimmedLineText.match(/[.!?]$/)
    const isCentered = representativeItem.x < 150  // Rough heuristic for centered text
    const isShortEnough = trimmedLineText.length < 80
    
    const looksLikeHeader = hasValidLength && 
                           hasNoEndPunctuation && 
                           (isLargeHeader || 
                            (isMediumHeader && representativeItem.isBold) ||
                            (isSmallHeader && isShortEnough) ||
                            (isCentered && isShortEnough && (isMediumHeader || representativeItem.isBold)))
    
    // Save current paragraph if we encounter a header or large gap
    if ((looksLikeHeader || isLargeGap || isNewPage) && currentParagraph.length > 0) {
      const paragraphText = currentParagraph.join(' ').trim()
      if (paragraphText.length > 0) {
        // Find parent (last segment at same or lower level)
        let parentId: string | undefined
        for (let j = segments.length - 1; j >= 0; j--) {
          if (segments[j].level <= currentLevel) {
            parentId = segments[j].id
            break
          }
        }
        
        // Use average font size and position from paragraph lines
        const allParaItems = currentParagraphLines.flatMap(l => l.items)
        const avgParaFontSize = allParaItems.length > 0
          ? allParaItems.reduce((sum, it) => sum + it.fontSize, 0) / allParaItems.length
          : avgFontSize
        const avgParaY = currentParagraphLines.length > 0
          ? currentParagraphLines.reduce((sum, l) => sum + l.y, 0) / currentParagraphLines.length
          : line.y
        const paraPage = currentParagraphLines.length > 0
          ? currentParagraphLines[0].pageNumber
          : line.pageNumber
        
        segments.push({
          id: generateSegmentId(),
          level: currentLevel + 1,
          text: paragraphText,
          type: 'paragraph',
          parentId,
          fontSize: avgParaFontSize,
          yPosition: avgParaY,
          pageNumber: paraPage,
        })
      }
      currentParagraph = []
      currentParagraphLines = []
    }
    
    if (looksLikeHeader) {
      // Determine header level based on font size
      let level: number
      if (isLargeHeader) {
        level = 1  // Chapter-level
      } else if (isMediumHeader) {
        level = 2  // Section-level
      } else if (isSmallHeader) {
        level = 3  // Subsection-level
      } else {
        level = 2  // Default to section
      }
      
      // Find parent (last segment at lower level)
      let parentId: string | undefined
      for (let j = segments.length - 1; j >= 0; j--) {
        if (segments[j].level < level) {
          parentId = segments[j].id
          break
        }
      }
      
      segments.push({
        id: generateSegmentId(),
        level,
        text: trimmedLineText,
        type: level === 1 ? 'chapter' : 'section',
        parentId,
        fontSize: representativeItem.fontSize,
        isBold: representativeItem.isBold,
        yPosition: line.y,
        pageNumber: line.pageNumber,
      })
      
      currentLevel = level
    } else {
      // Add to current paragraph
      currentParagraph.push(trimmedLineText)
      currentParagraphLines.push(line)
    }
    
    previousY = line.y
    previousPage = line.pageNumber
  }
  
  // Save last paragraph
  if (currentParagraph.length > 0) {
    const paragraphText = currentParagraph.join(' ').trim()
    if (paragraphText.length > 0) {
      let parentId: string | undefined
      for (let j = segments.length - 1; j >= 0; j--) {
        if (segments[j].level <= currentLevel) {
          parentId = segments[j].id
          break
        }
      }
      
      const allParaItems = currentParagraphLines.flatMap(l => l.items)
      const avgParaFontSize = allParaItems.length > 0
        ? allParaItems.reduce((sum, it) => sum + it.fontSize, 0) / allParaItems.length
        : avgFontSize
      const avgParaY = currentParagraphLines.length > 0
        ? currentParagraphLines.reduce((sum, l) => sum + l.y, 0) / currentParagraphLines.length
        : groupedLines[groupedLines.length - 1].y
      const paraPage = currentParagraphLines.length > 0
        ? currentParagraphLines[0].pageNumber
        : groupedLines[groupedLines.length - 1].pageNumber
      
      segments.push({
        id: generateSegmentId(),
        level: currentLevel + 1,
        text: paragraphText,
        type: 'paragraph',
        parentId,
        fontSize: avgParaFontSize,
        yPosition: avgParaY,
        pageNumber: paraPage,
      })
    }
  }
  
  // If no segments created, create a single root segment
  if (segments.length === 0 && groupedLines.length > 0) {
    const allText = groupedLines.flatMap(line => 
      line.items.map(item => item.text.trim()).filter(t => t.length > 0)
    ).join(' ')
    segments.push({
      id: generateSegmentId(),
      level: 0,
      text: allText,
      type: 'paragraph',
      pageNumber: groupedLines[0].pageNumber,
    })
  }
  
  return segments
}

/**
 * Parse document based on file extension
 */
export function parseDocument(
  text: string, 
  fileExtension: string,
  pdfTextItems?: Array<{
    text: string
    fontSize: number
    isBold: boolean
    y: number
    x: number
    pageNumber: number
  }>
): DocumentSegment[] {
  const ext = fileExtension.toLowerCase()
  
  if (ext === '.md' || ext === 'md') {
    return parseMarkdown(text)
  } else if (ext === '.pdf' && pdfTextItems && pdfTextItems.length > 0) {
    // Use improved PDF parsing with font/position data
    return parsePDFWithStructure(pdfTextItems)
  } else {
    return parsePlainText(text)
  }
}

