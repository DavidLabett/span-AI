/**
 * Model Settings Modal
 * Allows easy switching between AI models
 */

import React, { useState, useEffect } from 'react'
import { theme, typography, spacing, colors } from '../theme'
import { useOllama } from '../hooks/useOllama'

interface ModelSettingsModalProps {
  isVisible: boolean
  onClose: () => void
}

export function ModelSettingsModal({ isVisible, onClose }: ModelSettingsModalProps) {
  const { config, status, saveConfig, checkStatus, loading } = useOllama()
  const [llmModel, setLlmModel] = useState(config.model)
  const [ocrModel, setOcrModel] = useState('deepseek-ocr:3b')
  const [baseUrl, setBaseUrl] = useState(config.baseUrl)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Load available models when modal opens
  useEffect(() => {
    if (isVisible) {
      setLlmModel(config.model)
      setBaseUrl(config.baseUrl)
      loadAvailableModels()
    }
  }, [isVisible, config])

  const loadAvailableModels = async () => {
    setLoadingModels(true)
    setError(null)
    try {
      const result = await window.electronAPI.aiCheckOllama(baseUrl)
      if (result.success && result.running) {
        // Get list of available models
        const modelResult = await window.electronAPI.aiCheckModel('', baseUrl)
        if (modelResult.models) {
          setAvailableModels(modelResult.models)
        }
      } else {
        setError('Ollama is not running. Please start Ollama first.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models')
    } finally {
      setLoadingModels(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const saved = await saveConfig({
        model: llmModel,
        baseUrl: baseUrl,
      })

      if (saved) {
        setSuccess(true)
        // Re-check status with new config
        await checkStatus()
        setTimeout(() => {
          setSuccess(false)
          onClose()
        }, 1000)
      } else {
        setError('Failed to save configuration')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleRefresh = () => {
    loadAvailableModels()
  }

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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.bgNode,
          borderRadius: '8px',
          padding: spacing[4],
          minWidth: '500px',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflowY: 'auto',
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
            Model Settings
          </h2>
          <p
            style={{
              margin: 0,
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.description,
              color: theme.textMuted,
            }}
          >
            Configure AI models for mindmap generation
          </p>
        </div>

        {/* Ollama Status */}
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
                fontWeight: 500,
                color: theme.text,
              }}
            >
              Ollama Status
            </span>
            <span
              style={{
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.ui,
                color: status.running ? colors.green : colors.red,
                fontWeight: 500,
              }}
            >
              {status.running ? '● Running' : '● Not Running'}
            </span>
          </div>
          {status.error && (
            <div
              style={{
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.ui,
                color: colors.red,
                marginTop: spacing[1],
              }}
            >
              {status.error}
            </div>
          )}
        </div>

        {/* Base URL */}
        <div style={{ marginBottom: spacing[3] }}>
          <label
            style={{
              display: 'block',
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.description,
              fontWeight: 500,
              color: theme.text,
              marginBottom: spacing[1],
            }}
          >
            Ollama Base URL
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            style={{
              width: '100%',
              padding: spacing[2],
              backgroundColor: theme.surface0,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.description,
              boxSizing: 'border-box',
            }}
            placeholder="http://localhost:11434"
          />
        </div>

        {/* LLM Model Selection */}
        <div style={{ marginBottom: spacing[3] }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing[1],
            }}
          >
            <label
              style={{
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.description,
                fontWeight: 500,
                color: theme.text,
              }}
            >
              LLM Model (for hierarchy & content generation)
            </label>
            <button
              onClick={handleRefresh}
              disabled={loadingModels}
              style={{
                padding: `${spacing[1]} ${spacing[2]}`,
                backgroundColor: theme.surface0,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                cursor: loadingModels ? 'not-allowed' : 'pointer',
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.ui,
                opacity: loadingModels ? 0.5 : 1,
              }}
            >
              {loadingModels ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: spacing[2] }}>
            <select
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              style={{
                flex: 1,
                padding: spacing[2],
                backgroundColor: theme.surface0,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.description,
                boxSizing: 'border-box',
              }}
            >
              {availableModels.length > 0 ? (
                availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))
              ) : (
                <option value={llmModel}>{llmModel}</option>
              )}
            </select>
            <input
              type="text"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              placeholder="Or type model name..."
              style={{
                flex: 1,
                padding: spacing[2],
                backgroundColor: theme.surface0,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.description,
                boxSizing: 'border-box',
              }}
            />
          </div>
          {llmModel && (
            <div
              style={{
                marginTop: spacing[1],
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.ui,
                color: theme.textMuted,
              }}
            >
              {status.modelAvailable ? (
                <span style={{ color: colors.green }}>✓ Model available</span>
              ) : (
                <span style={{ color: colors.red }}>
                  ✗ Model not available. Run: <code style={{ backgroundColor: theme.surface0, padding: '2px 4px', borderRadius: '2px' }}>ollama pull {llmModel}</code>
                </span>
              )}
            </div>
          )}
        </div>

        {/* OCR Model (read-only for now) */}
        <div style={{ marginBottom: spacing[3] }}>
          <label
            style={{
              display: 'block',
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.description,
              fontWeight: 500,
              color: theme.text,
              marginBottom: spacing[1],
            }}
          >
            OCR Model (for PDF processing)
          </label>
          <input
            type="text"
            value={ocrModel}
            disabled
            style={{
              width: '100%',
              padding: spacing[2],
              backgroundColor: theme.surface1,
              color: theme.textMuted,
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.description,
              boxSizing: 'border-box',
              cursor: 'not-allowed',
            }}
          />
          <div
            style={{
              marginTop: spacing[1],
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.ui,
              color: theme.textMuted,
            }}
          >
            Currently fixed to deepseek-ocr:3b
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div
            style={{
              padding: spacing[2],
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
              }}
            >
              {error}
            </div>
          </div>
        )}

        {success && (
          <div
            style={{
              padding: spacing[2],
              backgroundColor: theme.surface0,
              borderRadius: '4px',
              marginBottom: spacing[3],
              border: `1px solid ${colors.green}`,
            }}
          >
            <div
              style={{
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.description,
                color: colors.green,
              }}
            >
              ✓ Configuration saved successfully
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: spacing[2],
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: spacing[2],
              backgroundColor: theme.surface0,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.ui,
              fontWeight: 500,
              opacity: saving ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loadingModels}
            style={{
              padding: spacing[2],
              backgroundColor: colors.blue,
              color: theme.base,
              border: 'none',
              borderRadius: '4px',
              cursor: saving || loadingModels ? 'not-allowed' : 'pointer',
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.ui,
              fontWeight: 500,
              opacity: saving || loadingModels ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

