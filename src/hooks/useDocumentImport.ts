/**
 * Hook for importing and processing documents
 */

import { useCallback } from 'react'
import { DocumentSegment } from '../types'
import { parseDocument } from '../utils/documentParser'

export interface ImportedDocument {
  filePath: string
  text: string
  segments: DocumentSegment[]
  metadata?: {
    pageCount?: number
    title?: string
    author?: string
    subject?: string
  }
  pdfTextItems?: Array<{
    text: string
    fontSize: number
    isBold: boolean
    y: number
    x: number
    pageNumber: number
  }>
}

export function useDocumentImport() {
  const importDocument = useCallback(async (): Promise<ImportedDocument | null> => {
    try {
      // Show file dialog
      const filePath = await window.electronAPI.showImportDocumentDialog()
      if (!filePath) {
        return null
      }

      const ext = filePath.toLowerCase().endsWith('.pdf') ? '.pdf' : 
                  filePath.toLowerCase().endsWith('.md') ? '.md' : 
                  filePath.toLowerCase().endsWith('.txt') ? '.txt' : 
                  '.txt'

      let text: string
      let metadata: ImportedDocument['metadata'] | undefined

      // Handle PDF files
      if (ext === '.pdf') {
        const result = await window.electronAPI.extractPDFText(filePath)
        if (!result.success || !result.text) {
          const errorMsg = result.error || 'Failed to extract PDF text'
          console.error('PDF extraction failed:', {
            error: errorMsg,
            stack: (result as any).stack,
            filePath,
          })
          throw new Error(errorMsg)
        }
        text = result.text
        metadata = {
          pageCount: result.pageCount,
          title: result.metadata?.title,
          author: result.metadata?.author,
          subject: result.metadata?.subject,
        }
        
        // Parse document with PDF-specific segmentation
        const segments = parseDocument(text, ext, result.textItems)
        
        // Log segments for debugging
        console.log('PDF document imported with improved segmentation:', {
          filePath,
          textLength: text.length,
          segmentCount: segments.length,
          textItemsCount: result.textItems?.length || 0,
          segments: segments.map(s => ({
            id: s.id,
            level: s.level,
            type: s.type,
            fontSize: s.fontSize,
            isBold: s.isBold,
            pageNumber: s.pageNumber,
            textPreview: s.text.substring(0, 50) + '...',
          })),
        })
        
        return {
          filePath,
          text,
          segments,
          metadata,
          pdfTextItems: result.textItems,
        }
      } else {
        // Handle text/markdown files
        const result = await window.electronAPI.readDocumentFile(filePath)
        if (!result.success || !result.content) {
          console.error('Document file read failed:', {
            error: result.error,
            filePath,
            result,
          })
          throw new Error(result.error || 'Failed to read document file')
        }
        text = result.content
      }

      // Parse document into segments
      const segments = parseDocument(text, ext)

      // Log segments for debugging
      console.log('Document imported:', {
        filePath,
        textLength: text.length,
        segmentCount: segments.length,
        segments: segments.map(s => ({
          id: s.id,
          level: s.level,
          type: s.type,
          fontSize: s.fontSize,
          isBold: s.isBold,
          textPreview: s.text.substring(0, 50) + '...',
        })),
      })

      return {
        filePath,
        text,
        segments,
        metadata,
      }
    } catch (error) {
      console.error('Error importing document:', error)
      throw error
    }
  }, [])

  return { importDocument }
}

