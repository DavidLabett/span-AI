/**
 * LLM Client for Ollama API
 * Handles communication with local Ollama service
 */

export interface LLMConfig {
  baseUrl: string   // default: 'http://localhost:11434'
  model: string     // default: 'Gemma3:1b'
  maxTokens?: number // maps to Ollama options.num_predict; limits output length
}

export interface OllamaResponse {
  model: string
  created_at: string
  response: string
  done: boolean
  context?: number[]
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

export interface OllamaError {
  error: string
}

/**
 * Check if Ollama service is running
 */
export async function checkOllamaStatus(baseUrl: string = 'http://localhost:11434'): Promise<{
  running: boolean
  error?: string
}> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      return { running: true }
    } else {
      return {
        running: false,
        error: `Ollama returned status ${response.status}`
      }
    }
  } catch (error) {
    return {
      running: false,
      error: error instanceof Error ? error.message : 'Failed to connect to Ollama'
    }
  }
}

/**
 * Check if a specific model is available
 */
export async function checkModelAvailable(
  model: string,
  baseUrl: string = 'http://localhost:11434'
): Promise<{
  available: boolean
  error?: string
  models?: string[]
}> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return {
        available: false,
        error: `Failed to fetch models: ${response.status}`
      }
    }

    const data = await response.json()
    const models = data.models?.map((m: any) => m.name) || []
    const available = models.includes(model) || models.some((m: string) => m.startsWith(model + ':'))

    return {
      available,
      models,
      error: available ? undefined : `Model '${model}' not found. Available models: ${models.join(', ')}`,
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Failed to check model availability'
    }
  }
}

/**
 * Call Ollama API to generate a response
 */
export async function callLLM(
  prompt: string,
  config: LLMConfig = {
    baseUrl: 'http://localhost:11434',
    model: 'Gemma3:1b',
  }
): Promise<string> {
  try {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        prompt: prompt,
        stream: false,
        ...(config.maxTokens !== undefined && { options: { num_predict: config.maxTokens } }),
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error || `Ollama API error: ${response.status} ${response.statusText}`
      )
    }

    const data: OllamaResponse = await response.json()

    if (!data.response) {
      throw new Error('Empty response from Ollama')
    }

    return data.response.trim()
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Failed to connect to Ollama. Is it running at ' + config.baseUrl + '?')
    }
    throw error
  }
}

/**
 * Call Ollama API with streaming (for progress updates)
 */
export async function* callLLMStream(
  prompt: string,
  config: LLMConfig = {
    baseUrl: 'http://localhost:11434',
    model: 'Gemma3:1b',
  }
): AsyncGenerator<string, void, unknown> {
  try {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        prompt: prompt,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error || `Ollama API error: ${response.status} ${response.statusText}`
      )
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('Failed to get response stream')
    }

    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''  // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data: OllamaResponse = JSON.parse(line)
            if (data.response) {
              yield data.response
            }
            if (data.done) {
              return
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Failed to connect to Ollama. Is it running at ' + config.baseUrl + '?')
    }
    throw error
  }
}

