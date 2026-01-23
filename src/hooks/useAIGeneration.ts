/**
 * Hook for orchestrating AI-powered mindmap generation
 * Phase 3: Hierarchy Detection
 */

import { useState, useCallback } from 'react'
import { HierarchyNode, DocumentSegment, Node } from '../types'
import { 
  buildHierarchyDetectionPrompt, 
  parseHierarchyResponse,
  buildTitleGenerationPrompt,
  buildBulletPointPrompt,
  parseBulletPoints,
  cleanTitle
} from '../utils/aiPrompts'
import { buildHierarchyTree, validateHierarchyTree, getTreeStats, flattenHierarchy } from '../utils/hierarchyBuilder'
import { useOllama } from './useOllama'

export interface GenerationProgress {
  step: 'idle' | 'analyzing' | 'generating' | 'complete' | 'error'
  message: string
  progress: number  // 0-100
  hierarchy?: HierarchyNode
  stats?: {
    totalNodes: number
    maxDepth: number
    nodeCountByLevel: Record<number, number>
  }
  nodesGenerated?: number
  totalNodesToGenerate?: number
  error?: string
}

export interface GeneratedNode {
  hierarchyId: string
  node: Node
  parentHierarchyId?: string
}

export function useAIGeneration() {
  const { callLLM, status } = useOllama()
  const [progress, setProgress] = useState<GenerationProgress>({
    step: 'idle',
    message: '',
    progress: 0,
  })

  /**
   * Detect hierarchy from document segments using LLM
   */
  const detectHierarchy = useCallback(async (
    segments: DocumentSegment[]
  ): Promise<HierarchyNode | null> => {
    if (!status.running || !status.modelAvailable) {
      throw new Error('Ollama is not running or model is not available')
    }

    setProgress({
      step: 'analyzing',
      message: 'Analyzing document structure...',
      progress: 10,
    })

    try {
      // Build prompt from segments
      const prompt = buildHierarchyDetectionPrompt(segments)
      
      setProgress(prev => ({
        ...prev,
        message: 'Sending request to LLM...',
        progress: 30,
      }))

      // Call LLM
      const response = await callLLM(prompt)
      
      setProgress(prev => ({
        ...prev,
        message: 'Parsing hierarchy response...',
        progress: 60,
      }))

      // Parse response
      const parsed = parseHierarchyResponse(response)
      if (!parsed) {
        throw new Error('Failed to parse LLM response. The model may have returned invalid JSON.')
      }

      setProgress(prev => ({
        ...prev,
        message: 'Building hierarchy tree...',
        progress: 80,
      }))

      // Build hierarchy tree
      const hierarchy = buildHierarchyTree(parsed)

      // Validate tree
      const validation = validateHierarchyTree(hierarchy)
      if (!validation.valid) {
        console.warn('Hierarchy validation warnings:', validation.errors)
        // Continue anyway, but log warnings
      }

      // Get statistics
      const stats = getTreeStats(hierarchy)

      setProgress({
        step: 'complete',
        message: 'Hierarchy detected successfully!',
        progress: 100,
        hierarchy,
        stats,
      })

      return hierarchy
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setProgress({
        step: 'error',
        message: 'Failed to detect hierarchy',
        progress: 0,
        error: errorMessage,
      })
      throw error
    }
  }, [callLLM, status])

  /**
   * Generate content (title and bullets) for all nodes in hierarchy
   * Phase 4: Node Content Generation
   */
  const generateNodeContent = useCallback(async (
    hierarchy: HierarchyNode,
    onProgress?: (current: number, total: number) => void
  ): Promise<GeneratedNode[]> => {
    if (!status.running || !status.modelAvailable) {
      throw new Error('Ollama is not running or model is not available')
    }

    // Flatten hierarchy to process all nodes
    const allNodes = flattenHierarchy(hierarchy)
    const totalNodes = allNodes.length

    setProgress({
      step: 'generating',
      message: `Generating content for nodes...`,
      progress: 0,
      nodesGenerated: 0,
      totalNodesToGenerate: totalNodes,
    })

    const generatedNodes: GeneratedNode[] = []
    const BATCH_SIZE = 3  // Process 3 nodes at a time
    const DELAY_MS = 500   // 500ms delay between batches

    try {
      for (let i = 0; i < allNodes.length; i += BATCH_SIZE) {
        const batch = allNodes.slice(i, i + BATCH_SIZE)
        
        // Process batch in parallel
        const batchPromises = batch.map(async (hierarchyNode) => {
          try {
            // Generate title if needed (use existing title if it's good, otherwise generate)
            let title = hierarchyNode.title || 'Untitled'
            if (title.length > 50 || title === 'Untitled' || hierarchyNode.content.length > 0) {
              // Generate a better title from content
              const titlePrompt = buildTitleGenerationPrompt(
                hierarchyNode.content || hierarchyNode.title || ''
              )
              const titleResponse = await callLLM(titlePrompt)
              title = cleanTitle(titleResponse.trim() || title)
            } else {
              title = cleanTitle(title)
            }

            // Generate bullet points from content
            let bullets: string[] = []
            if (hierarchyNode.content && hierarchyNode.content.trim().length > 0) {
              const bulletPrompt = buildBulletPointPrompt(hierarchyNode.content)
              const bulletResponse = await callLLM(bulletPrompt)
              bullets = parseBulletPoints(bulletResponse)
            }

            // If no bullets generated, use title as single bullet
            if (bullets.length === 0) {
              bullets = [title]
            }

            // Create Span node (position will be set by layout engine)
            const spanNode: Node = {
              id: `node-${hierarchyNode.id}`,
              x: 0,  // Will be set by layout engine
              y: 0,
              width: 240,  // Default width
              height: 160,  // Default height (will be adjusted)
              title: title,
              description: bullets.join('\n'),
              collapsed: false,
            }

            return {
              hierarchyId: hierarchyNode.id,
              node: spanNode,
              parentHierarchyId: hierarchyNode.parentId,
            } as GeneratedNode
          } catch (error) {
            console.error(`Failed to generate content for node ${hierarchyNode.id}:`, error)
            // Fallback: create node with basic content
            return {
              hierarchyId: hierarchyNode.id,
              node: {
                id: `node-${hierarchyNode.id}`,
                x: 0,
                y: 0,
                width: 240,
                height: 160,
                title: cleanTitle(hierarchyNode.title || 'Untitled'),
                description: hierarchyNode.content.substring(0, 200) || 'No content',
                collapsed: false,
              },
              parentHierarchyId: hierarchyNode.parentId,
            } as GeneratedNode
          }
        })

        const batchResults = await Promise.all(batchPromises)
        generatedNodes.push(...batchResults)

        // Update progress
        const current = Math.min(i + BATCH_SIZE, totalNodes)
        const progressPercent = Math.round((current / totalNodes) * 100)
        
        setProgress(prev => ({
          ...prev,
          message: `Generating content for node ${current} of ${totalNodes}...`,
          progress: progressPercent,
          nodesGenerated: current,
        }))

        if (onProgress) {
          onProgress(current, totalNodes)
        }

        // Delay between batches (except for the last batch)
        if (i + BATCH_SIZE < allNodes.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS))
        }
      }

      setProgress(prev => ({
        ...prev,
        step: 'complete',
        message: `Generated content for ${totalNodes} nodes!`,
        progress: 100,
        nodesGenerated: totalNodes,
      }))

      return generatedNodes
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setProgress({
        step: 'error',
        message: 'Failed to generate node content',
        progress: 0,
        error: errorMessage,
      })
      throw error
    }
  }, [callLLM, status])

  /**
   * Reset progress state
   */
  const reset = useCallback(() => {
    setProgress({
      step: 'idle',
      message: '',
      progress: 0,
    })
  }, [])

  return {
    progress,
    detectHierarchy,
    generateNodeContent,
    reset,
    isReady: status.running && status.modelAvailable,
  }
}

