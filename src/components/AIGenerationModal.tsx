/**
 * Progress modal for AI generation process
 * Phase 3: Hierarchy Detection
 */

import React from 'react'
import { GenerationProgress } from '../hooks/useAIGeneration'

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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          minWidth: '400px',
          maxWidth: '600px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '16px' }}>
          {isError ? '❌ Error' : isComplete ? '✅ Complete' : '🤖 AI Generation'}
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: 500 }}>{progress.message}</span>
            <span style={{ color: '#666' }}>{progress.progress}%</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e0e0e0',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress.progress}%`,
                height: '100%',
                backgroundColor: isError ? '#f44336' : isComplete ? '#4caf50' : '#2196f3',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {isError && progress.error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#ffebee',
              borderRadius: '4px',
              marginBottom: '16px',
              color: '#c62828',
            }}
          >
            <strong>Error:</strong> {progress.error}
          </div>
        )}

        {isComplete && progress.stats && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#e8f5e9',
              borderRadius: '4px',
              marginBottom: '16px',
            }}
          >
            <div style={{ marginBottom: '8px' }}>
              <strong>Generation Statistics:</strong>
            </div>
            <div style={{ fontSize: '14px', color: '#333' }}>
              <div>Total nodes: {progress.stats.totalNodes}</div>
              <div>Max depth: {progress.stats.maxDepth}</div>
              {progress.nodesGenerated !== undefined && progress.totalNodesToGenerate !== undefined && (
                <div>Nodes generated: {progress.nodesGenerated} / {progress.totalNodesToGenerate}</div>
              )}
              <div>
                Nodes by level:{' '}
                {Object.entries(progress.stats.nodeCountByLevel)
                  .map(([level, count]) => `Level ${level}: ${count}`)
                  .join(', ')}
              </div>
            </div>
          </div>
        )}

        {(isComplete || isError) && onClose && (
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: isError ? '#f44336' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {isError ? 'Close' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  )
}

