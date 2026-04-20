/**
 * Hook for Ollama/LLM operations
 */

import { useState, useCallback, useEffect } from 'react'

export interface OllamaStatus {
  running: boolean
  modelAvailable: boolean
  error?: string
  models?: string[]
}

export interface OllamaConfig {
  baseUrl: string
  model: string
}

export function useOllama() {
  const [status, setStatus] = useState<OllamaStatus>({
    running: false,
    modelAvailable: false,
  })
  const [config, setConfig] = useState<OllamaConfig>({
    baseUrl: 'http://localhost:11434',
    model: 'Gemma3:1b',
  })
  const [loading, setLoading] = useState(false)

  // Load config on mount
  useEffect(() => {
    loadConfig()
  }, [])

  // Check status on mount and when config changes
  useEffect(() => {
    checkStatus()
  }, [config])

  const loadConfig = useCallback(async () => {
    try {
      const result = await window.electronAPI.aiGetConfig()
      if (result.success && result.config) {
        setConfig(result.config)
      }
    } catch (error) {
      console.error('Failed to load Ollama config:', error)
    }
  }, [])

  const saveConfig = useCallback(async (newConfig: Partial<OllamaConfig>) => {
    try {
      const result = await window.electronAPI.aiSetConfig(newConfig)
      if (result.success) {
        setConfig(prev => ({ ...prev, ...newConfig }))
        return true
      } else {
        console.error('Failed to save config:', result.error)
        return false
      }
    } catch (error) {
      console.error('Failed to save Ollama config:', error)
      return false
    }
  }, [])

  const checkStatus = useCallback(async () => {
    setLoading(true)
    try {
      // Check if Ollama is running
      const ollamaResult = await window.electronAPI.aiCheckOllama(config.baseUrl)

      if (!ollamaResult.success || !ollamaResult.running) {
        setStatus({
          running: false,
          modelAvailable: false,
          error: ollamaResult.error || 'Ollama is not running',
        })
        setLoading(false)
        return
      }

      // Check if model is available
      const modelResult = await window.electronAPI.aiCheckModel(config.model, config.baseUrl)

      setStatus({
        running: true,
        modelAvailable: modelResult.available,
        error: modelResult.error,
        models: modelResult.models,
      })
    } catch (error) {
      setStatus({
        running: false,
        modelAvailable: false,
        error: error instanceof Error ? error.message : 'Failed to check Ollama status',
      })
    } finally {
      setLoading(false)
    }
  }, [config])

  const callLLM = useCallback(async (prompt: string, options?: { maxTokens?: number }): Promise<string> => {
    try {
      const result = await window.electronAPI.aiCallLLM(prompt, config.baseUrl, config.model, options?.maxTokens)
      if (result.success && result.response) {
        return result.response
      } else {
        throw new Error(result.error || 'Failed to get response from Ollama')
      }
    } catch (error) {
      throw error
    }
  }, [config])

  return {
    status,
    config,
    loading,
    checkStatus,
    loadConfig,
    saveConfig,
    callLLM,
  }
}

