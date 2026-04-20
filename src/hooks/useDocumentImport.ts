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
}

export function useDocumentImport() {
  const importDocument = useCallback(async (
    selectedPages?: number[],
    filePath?: string,
    onOCRProgress?: (progress: { message: string; current: number; total: number; percentage: number }) => void
  ): Promise<ImportedDocument | null> => {
    try {
      // Show file dialog only if filePath is not provided
      let actualFilePath: string | undefined = filePath
      if (!actualFilePath) {
        const chosen = await window.electronAPI.showImportDocumentDialog()
        if (!chosen) {
          return null
        }
        actualFilePath = chosen
      }

      const ext = actualFilePath.toLowerCase().endsWith('.pdf') ? '.pdf' :
        actualFilePath.toLowerCase().endsWith('.md') ? '.md' :
          actualFilePath.toLowerCase().endsWith('.txt') ? '.txt' :
            '.txt'

      let text: string
      let metadata: ImportedDocument['metadata'] | undefined

      // Handle PDF files — always use OCR
      if (ext === '.pdf') {
        console.log('Using DeepSeek-OCR for PDF extraction...')

        const progressCleanup = window.electronAPI.onOCRProgress((progress) => {
          console.log(`[OCR Progress] ${progress.message} (${progress.current}/${progress.total} - ${progress.percentage}%)`)
          onOCRProgress?.(progress)
        })

        try {
          const ocrResult = await window.electronAPI.analyzePDFWithOCR(actualFilePath, undefined, selectedPages)

          progressCleanup()
          if (!ocrResult.success || !ocrResult.text) {
            const errorMsg = ocrResult.error || 'Failed to extract PDF text with OCR'
            console.error('PDF OCR extraction failed:', {
              error: errorMsg,
              filePath: actualFilePath,
              processedPages: ocrResult.processedPages,
              errors: ocrResult.errors,
            })
            throw new Error(errorMsg)
          }
          text = ocrResult.text
          metadata = { pageCount: ocrResult.pageCount }

          const segments = parseDocument(text, '.md')

          console.log('PDF document imported with OCR:', {
            filePath: actualFilePath,
            textLength: text.length,
            segmentCount: segments.length,
            processedPages: ocrResult.processedPages,
            pageCount: ocrResult.pageCount,
          })

          return {
            filePath: actualFilePath,
            text,
            segments,
            metadata,
          }
        } catch (error) {
          progressCleanup()
          throw error
        }
      } else {
        // Handle text/markdown files
        const result = await window.electronAPI.readDocumentFile(actualFilePath)
        if (!result.success || !result.content) {
          console.error('Document file read failed:', {
            error: result.error,
            filePath: actualFilePath,
          })
          throw new Error(result.error || 'Failed to read document file')
        }
        text = result.content

        const segments = parseDocument(text, ext)

        console.log('Document imported:', {
          filePath: actualFilePath,
          textLength: text.length,
          segmentCount: segments.length,
        })

        return {
          filePath: actualFilePath,
          text,
          segments,
          metadata,
        }
      }
    } catch (error) {
      console.error('Error importing document:', error)
      throw error
    }
  }, [])

  return { importDocument }
}

