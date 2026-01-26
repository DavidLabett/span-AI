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
  const importDocument = useCallback(async (useOCR: boolean = false, selectedPages?: number[], filePath?: string): Promise<ImportedDocument | null> => {
    try {
      // Show file dialog only if filePath is not provided
      let actualFilePath = filePath
      if (!actualFilePath) {
        actualFilePath = await window.electronAPI.showImportDocumentDialog()
        if (!actualFilePath) {
          return null
        }
      }

      const ext = filePath.toLowerCase().endsWith('.pdf') ? '.pdf' :
        filePath.toLowerCase().endsWith('.md') ? '.md' :
          filePath.toLowerCase().endsWith('.txt') ? '.txt' :
            '.txt'

      let text: string
      let metadata: ImportedDocument['metadata'] | undefined

      // Handle PDF files
      if (ext === '.pdf') {
        // Use OCR if requested
        if (useOCR) {
          console.log('Using DeepSeek-OCR for PDF extraction...')

          // Set up progress listener
          const progressCleanup = window.electronAPI.onOCRProgress((progress) => {
            console.log(`[OCR Progress] ${progress.message} (${progress.current}/${progress.total} - ${progress.percentage}%)`)
          })

          try {
            const ocrResult = await window.electronAPI.analyzePDFWithOCR(filePath, undefined, selectedPages)

            // Clean up progress listener
            progressCleanup()
            if (!ocrResult.success || !ocrResult.text) {
              const errorMsg = ocrResult.error || 'Failed to extract PDF text with OCR'
              console.error('PDF OCR extraction failed:', {
                error: errorMsg,
                filePath,
                processedPages: ocrResult.processedPages,
                errors: ocrResult.errors,
              })
              throw new Error(errorMsg)
            }
            text = ocrResult.text
            metadata = {
              pageCount: ocrResult.pageCount,
              // OCR doesn't provide metadata, so we'll leave it undefined
            }

            // Parse OCR result as markdown (since DeepSeek-OCR outputs markdown)
            const segments = parseDocument(text, '.md') // Parse as markdown since OCR returns markdown

            console.log('PDF document imported with OCR:', {
              filePath: actualFilePath,
              textLength: text.length,
              segmentCount: segments.length,
              processedPages: ocrResult.processedPages,
              pageCount: ocrResult.pageCount,
              errors: ocrResult.errors,
              segments: segments.map(s => ({
                id: s.id,
                level: s.level,
                type: s.type,
                textPreview: s.text.substring(0, 50) + '...',
              })),
            })
            
            return {
              filePath: actualFilePath,
              text,
              segments,
              metadata,
            }
          } catch (error) {
            // Clean up progress listener on error
            progressCleanup()
            throw error
          }
        } else {
          // Use regular pdf2json extraction
          const result = await window.electronAPI.extractPDFText(actualFilePath)
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
            filePath: actualFilePath,
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
            filePath: actualFilePath,
            text,
            segments,
            metadata,
            pdfTextItems: result.textItems,
          }
        }
      } else {
        // Handle text/markdown files
        const result = await window.electronAPI.readDocumentFile(actualFilePath)
        if (!result.success || !result.content) {
        console.error('Document file read failed:', {
          error: result.error,
          filePath: actualFilePath,
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
      filePath: actualFilePath,
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
      filePath: actualFilePath,
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

