import { useState, useCallback } from 'react'
import { Edge, EdgeMap } from '../types'

// Generate unique ID
function generateId(): string {
  return `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function useEdges(initial: EdgeMap = {}) {
  const [edges, setEdges] = useState<EdgeMap>(initial)

  // Create a new edge between two nodes
  const createEdge = useCallback((fromNodeId: string, toNodeId: string): Edge | null => {
    // Don't allow self-connections
    if (fromNodeId === toNodeId) return null

    // Check if edge already exists
    const exists = Object.values(edges).some(
      edge => (edge.from === fromNodeId && edge.to === toNodeId) ||
              (edge.from === toNodeId && edge.to === fromNodeId)
    )
    if (exists) return null

    const id = generateId()
    const newEdge: Edge = {
      id,
      from: fromNodeId,
      to: toNodeId,
    }

    setEdges(prev => ({
      ...prev,
      [id]: newEdge,
    }))

    return newEdge
  }, [edges])

  // Delete an edge
  const deleteEdge = useCallback((id: string) => {
    setEdges(prev => {
      const { [id]: _, ...rest } = prev
      return rest
    })
  }, [])

  // Update an edge's properties
  const updateEdge = useCallback((id: string, updates: Partial<Omit<Edge, 'id'>>) => {
    setEdges(prev => {
      if (!prev[id]) return prev
      return {
        ...prev,
        [id]: { ...prev[id], ...updates },
      }
    })
  }, [])

  // Delete all edges connected to a node
  const deleteEdgesForNode = useCallback((nodeId: string) => {
    setEdges(prev => {
      const filtered: EdgeMap = {}
      for (const [id, edge] of Object.entries(prev)) {
        if (edge.from !== nodeId && edge.to !== nodeId) {
          filtered[id] = edge
        }
      }
      return filtered
    })
  }, [])

  // Get edges as array (for rendering)
  const edgeList = Object.values(edges)

  // Set all edges (for loading from file)
  const setAllEdges = useCallback((newEdges: EdgeMap) => {
    setEdges(newEdges)
  }, [])

  // Get edges connected to a specific node
  const getEdgesForNode = useCallback((nodeId: string) => {
    return Object.values(edges).filter(
      edge => edge.from === nodeId || edge.to === nodeId
    )
  }, [edges])

  return {
    edges,
    edgeList,
    createEdge,
    updateEdge,
    deleteEdge,
    deleteEdgesForNode,
    setAllEdges,
    getEdgesForNode,
  }
}

