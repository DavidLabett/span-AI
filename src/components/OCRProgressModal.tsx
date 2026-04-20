/**
 * Progress modal for OCR processing
 */

import React from 'react'
import { theme, typography, spacing, colors } from '../theme'

interface OCRProgressModalProps {
  isVisible: boolean
  message: string
  current: number
  total: number
  percentage?: number
  onCancel?: () => void
}

export function OCRProgressModal({
  isVisible,
  message,
  current,
  total,
  onCancel,
}: OCRProgressModalProps) {
  if (!isVisible) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          backgroundColor: theme.bgNode,
          borderRadius: '8px',
          padding: spacing[4],
          minWidth: '400px',
          maxWidth: '500px',
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4)`,
          border: `1px solid ${theme.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: spacing[3] }}>
          <h2
            style={{
              margin: 0,
              marginBottom: spacing[2],
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.title,
              fontWeight: 600,
              color: theme.text,
            }}
          >
            Processing PDF with OCR
          </h2>
          <p
            style={{
              margin: 0,
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.description,
              color: theme.textMuted,
            }}
          >
            {message}
          </p>
        </div>

        <div style={{ marginBottom: spacing[3] }}>
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.description,
              color: theme.text,
              fontWeight: 500,
            }}
          >
            Page {Math.max(0, current)} of {Math.max(1, total)}
          </span>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              width: '100%',
              padding: spacing[2],
              backgroundColor: colors.mantle,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.ui,
              fontWeight: 500,
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.crust
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.mantle
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

