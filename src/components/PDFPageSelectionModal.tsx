import { useState, useEffect } from 'react'
import { colors, spacing, typography, theme } from '../theme'

interface PDFPageSelectionModalProps {
  pageCount: number
  onConfirm: (pages: number[]) => void
  onCancel: () => void
}

/**
 * Modal for selecting which PDF pages to process with OCR
 */
export function PDFPageSelectionModal({ pageCount, onConfirm, onCancel }: PDFPageSelectionModalProps) {
  const [inputValue, setInputValue] = useState('all')
  const [error, setError] = useState<string | null>(null)

  // Parse page selection input
  const parsePageSelection = (input: string): number[] | null => {
    const trimmed = input.trim().toLowerCase()
    
    // Handle "all" or empty
    if (trimmed === 'all' || trimmed === '') {
      return Array.from({ length: pageCount }, (_, i) => i + 1)
    }

    const pages: number[] = []
    const parts = trimmed.split(',')

    for (const part of parts) {
      const trimmedPart = part.trim()
      
      // Check for range (e.g., "1-5")
      if (trimmedPart.includes('-')) {
        const [start, end] = trimmedPart.split('-').map(s => parseInt(s.trim(), 10))
        
        if (isNaN(start) || isNaN(end)) {
          return null
        }
        
        if (start < 1 || end > pageCount || start > end) {
          return null
        }
        
        for (let i = start; i <= end; i++) {
          pages.push(i)
        }
      } else {
        // Single page number
        const pageNum = parseInt(trimmedPart, 10)
        
        if (isNaN(pageNum) || pageNum < 1 || pageNum > pageCount) {
          return null
        }
        
        pages.push(pageNum)
      }
    }

    // Remove duplicates and sort
    return [...new Set(pages)].sort((a, b) => a - b)
  }

  const handleConfirm = () => {
    setError(null)
    const pages = parsePageSelection(inputValue)
    
    if (pages === null || pages.length === 0) {
      setError('Invalid page selection. Use page numbers (1, 3, 5), ranges (1-5), or "all"')
      return
    }

    onConfirm(pages)
  }

  const handleQuickSelect = (type: 'all' | 'first' | 'last') => {
    setError(null)
    switch (type) {
      case 'all':
        setInputValue('all')
        break
      case 'first':
        setInputValue('1')
        break
      case 'last':
        setInputValue(pageCount.toString())
        break
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel()
        }
      }}
    >
      <div
        style={{
          backgroundColor: colors.surface0,
          borderRadius: spacing.md,
          padding: spacing.xl,
          minWidth: '400px',
          maxWidth: '600px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: typography.sizes.title + 4,
            fontFamily: typography.fontFamily,
            fontWeight: 600,
            color: colors.text,
            marginTop: 0,
            marginBottom: spacing.md,
          }}
        >
          Select Pages for OCR
        </h2>

        <p
          style={{
            fontSize: typography.sizes.description,
            fontFamily: typography.fontFamily,
            color: colors.subtext1,
            marginBottom: spacing.lg,
          }}
        >
          This PDF contains {pageCount} page{pageCount !== 1 ? 's' : ''}. Select which pages to process with OCR.
        </p>

        <div style={{ marginBottom: spacing.md }}>
          <label
            style={{
              fontSize: typography.sizes.description,
              fontFamily: typography.fontFamily,
              color: colors.text,
              display: 'block',
              marginBottom: spacing.xs,
            }}
          >
            Page Selection:
          </label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setError(null)
            }}
            placeholder="all, 1-5, 1,3,5, or 1-3,5,7-10"
            style={{
              width: '100%',
              padding: spacing.sm,
              backgroundColor: colors.mantle,
              border: `1px solid ${colors.surface1}`,
              borderRadius: spacing.xs,
              color: colors.text,
              fontSize: typography.sizes.description,
              fontFamily: typography.fontFamily,
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleConfirm()
              } else if (e.key === 'Escape') {
                onCancel()
              }
            }}
          />
          {error && (
            <p
              style={{
                fontSize: typography.sizes.ui,
                fontFamily: typography.fontFamily,
                color: colors.red,
                marginTop: spacing.xs,
                marginBottom: 0,
              }}
            >
              {error}
            </p>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: spacing.sm,
            marginBottom: spacing.lg,
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => handleQuickSelect('all')}
            style={{
              padding: `${spacing.xs} ${spacing.sm}`,
              backgroundColor: colors.surface1,
              border: 'none',
              borderRadius: spacing.xs,
              color: colors.text,
              cursor: 'pointer',
              fontSize: typography.sizes.ui,
              fontFamily: typography.fontFamily,
            }}
          >
            All Pages
          </button>
          <button
            onClick={() => handleQuickSelect('first')}
            style={{
              padding: `${spacing.xs} ${spacing.sm}`,
              backgroundColor: colors.surface1,
              border: 'none',
              borderRadius: spacing.xs,
              color: colors.text,
              cursor: 'pointer',
              fontSize: typography.sizes.ui,
              fontFamily: typography.fontFamily,
            }}
          >
            First Page
          </button>
          <button
            onClick={() => handleQuickSelect('last')}
            style={{
              padding: `${spacing.xs} ${spacing.sm}`,
              backgroundColor: colors.surface1,
              border: 'none',
              borderRadius: spacing.xs,
              color: colors.text,
              cursor: 'pointer',
              fontSize: typography.sizes.ui,
              fontFamily: typography.fontFamily,
            }}
          >
            Last Page
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: spacing.md,
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              backgroundColor: colors.surface1,
              border: 'none',
              borderRadius: spacing.xs,
              color: colors.text,
              cursor: 'pointer',
              fontSize: typography.sizes.description,
              fontFamily: typography.fontFamily,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              backgroundColor: colors.blue,
              border: 'none',
              borderRadius: spacing.xs,
              color: colors.base,
              cursor: 'pointer',
              fontSize: typography.sizes.description,
              fontFamily: typography.fontFamily,
            }}
          >
            Process Pages
          </button>
        </div>

        <div
          style={{
            marginTop: spacing.md,
            padding: spacing.sm,
            backgroundColor: colors.mantle,
            borderRadius: spacing.xs,
          }}
        >
          <p
            style={{
              fontSize: typography.sizes.ui,
              fontFamily: typography.fontFamily,
              color: colors.subtext0,
              margin: 0,
            }}
          >
            <strong>Examples:</strong>
            <br />
            • <code>all</code> - Process all pages
            <br />
            • <code>1-5</code> - Pages 1 through 5
            <br />
            • <code>1,3,5</code> - Pages 1, 3, and 5
            <br />
            • <code>1-3,5,7-10</code> - Pages 1-3, 5, and 7-10
          </p>
        </div>
      </div>
    </div>
  )
}

