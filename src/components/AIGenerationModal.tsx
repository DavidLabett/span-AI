/**
 * Progress modal for AI generation process
 * Phase 3: Hierarchy Detection
 */

import React from 'react'
import { GenerationProgress } from '../hooks/useAIGeneration'
import { theme, typography, spacing, colors } from '../theme'

interface AIGenerationModalProps {
  progress: GenerationProgress
  onClose?: () => void
}

export function AIGenerationModal({ progress, onClose }: AIGenerationModalProps) {
  if (progress.step === 'idle') {
    return null
  }

  const isComplete = progress.step === 'complete'
  const isError = progress.step === 'error'
  const isProcessing = progress.step === 'analyzing' || progress.step === 'generating'

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
      onClick={isComplete || isError ? onClose : undefined}
    >
      <div
        style={{
          backgroundColor: theme.bgNode,
          borderRadius: '8px',
          padding: spacing[4],
          minWidth: '450px',
          maxWidth: '600px',
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
              display: 'flex',
              alignItems: 'center',
              gap: spacing[2],
            }}
          >
            {isError ? (
              <>❌ Error</>
            ) : isComplete ? (
              <>✅ Generation Complete</>
            ) : (
              <>
                <div
                  style={{
                    display: 'inline-block',
                    width: '20px',
                    height: '20px',
                    border: `3px solid ${theme.surface1}`,
                    borderTop: `3px solid ${colors.blue}`,
                    borderRadius: '50%',
                    animation: isProcessing ? 'spin 1s linear infinite' : 'none',
                    marginRight: spacing[2],
                  }}
                />
                AI Generation
              </>
            )}
          </h2>
          <p
            style={{
              margin: 0,
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.description,
              color: theme.textMuted,
            }}
          >
            {progress.message}
          </p>
        </div>

        <div style={{ marginBottom: spacing[3] }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing[2],
            }}
          >
            <span
              style={{
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.description,
                color: theme.text,
                fontWeight: 500,
              }}
            >
              {progress.step === 'analyzing' && 'Analyzing document structure...'}
              {progress.step === 'generating' && 
                (progress.nodesGenerated !== undefined && progress.totalNodesToGenerate !== undefined
                  ? `Generating nodes: ${progress.nodesGenerated} / ${progress.totalNodesToGenerate}`
                  : 'Generating node content...')}
              {progress.step === 'complete' && 'Processing complete'}
              {progress.step === 'error' && 'Generation failed'}
            </span>
            <span
              style={{
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.description,
                color: theme.textMuted,
              }}
            >
              {progress.progress}%
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '12px',
              backgroundColor: theme.surface0,
              borderRadius: '6px',
              overflow: 'hidden',
              border: `1px solid ${theme.border}`,
            }}
          >
            <div
              style={{
                width: `${progress.progress}%`,
                height: '100%',
                backgroundColor: isError 
                  ? colors.red 
                  : isComplete 
                    ? colors.green 
                    : colors.blue,
                transition: 'width 0.3s ease',
                borderRadius: '6px',
              }}
            />
          </div>
        </div>

        {isError && progress.error && (
          <div
            style={{
              padding: spacing[3],
              backgroundColor: theme.surface0,
              borderRadius: '4px',
              marginBottom: spacing[3],
              border: `1px solid ${colors.red}`,
            }}
          >
            <div
              style={{
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.description,
                color: colors.red,
                fontWeight: 500,
                marginBottom: spacing[1],
              }}
            >
              Error:
            </div>
            <div
              style={{
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.description,
                color: theme.textMuted,
              }}
            >
              {progress.error}
            </div>
          </div>
        )}

        {isComplete && progress.stats && (
          <div
            style={{
              padding: spacing[3],
              backgroundColor: theme.surface0,
              borderRadius: '4px',
              marginBottom: spacing[3],
              border: `1px solid ${theme.border}`,
            }}
          >
            <div
              style={{
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.description,
                fontWeight: 600,
                color: theme.text,
                marginBottom: spacing[2],
              }}
            >
              Generation Statistics
            </div>
            <div
              style={{
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.ui,
                color: theme.textMuted,
                display: 'flex',
                flexDirection: 'column',
                gap: spacing[1],
              }}
            >
              <div>Total nodes: <strong style={{ color: theme.text }}>{progress.stats.totalNodes}</strong></div>
              <div>Max depth: <strong style={{ color: theme.text }}>{progress.stats.maxDepth}</strong></div>
              {progress.nodesGenerated !== undefined && progress.totalNodesToGenerate !== undefined && (
                <div>
                  Nodes generated: <strong style={{ color: theme.text }}>
                    {progress.nodesGenerated} / {progress.totalNodesToGenerate}
                  </strong>
                </div>
              )}
              <div style={{ marginTop: spacing[1] }}>
                Nodes by level:{' '}
                {Object.entries(progress.stats.nodeCountByLevel)
                  .map(([level, count]) => (
                    <span key={level} style={{ color: theme.text }}>
                      Level {level}: {count}
                    </span>
                  ))
                  .reduce((acc, el, idx) => idx === 0 ? [el] : [...acc, ', ', el], [] as React.ReactNode[])}
              </div>
            </div>
          </div>
        )}

        {(isComplete || isError) && onClose && (
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: spacing[2],
              backgroundColor: isError ? colors.red : colors.green,
              color: theme.base,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.ui,
              fontWeight: 500,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
          >
            {isError ? 'Close' : 'Continue'}
          </button>
        )}

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}

