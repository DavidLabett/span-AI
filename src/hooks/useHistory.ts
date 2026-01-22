import { useState, useCallback, useRef } from 'react'
import { NodeMap, EdgeMap } from '../types'

interface HistoryState {
  nodes: NodeMap
  edges: EdgeMap
}

interface UseHistoryOptions {
  maxSize?: number
}

const DEFAULT_MAX_SIZE = 50

export function useHistory(options: UseHistoryOptions = {}) {
  const { maxSize = DEFAULT_MAX_SIZE } = options
  
  // Past states (for undo)
  const [past, setPast] = useState<HistoryState[]>([])
  // Future states (for redo)
  const [future, setFuture] = useState<HistoryState[]>([])
  
  // Track if we're currently performing undo/redo to avoid recording
  const isUndoingRef = useRef(false)

  // Push current state to history before making a change
  const pushState = useCallback((nodes: NodeMap, edges: EdgeMap) => {
    // Don't record if we're undoing/redoing
    if (isUndoingRef.current) return

    setPast(prev => {
      const newPast = [...prev, { nodes, edges }]
      // Trim to max size
      if (newPast.length > maxSize) {
        return newPast.slice(-maxSize)
      }
      return newPast
    })
    
    // Clear future on new action
    setFuture([])
  }, [maxSize])

  // Undo: restore previous state
  const undo = useCallback((
    currentNodes: NodeMap,
    currentEdges: EdgeMap,
    setNodes: (nodes: NodeMap) => void,
    setEdges: (edges: EdgeMap) => void
  ): boolean => {
    if (past.length === 0) return false

    isUndoingRef.current = true

    const previous = past[past.length - 1]
    const newPast = past.slice(0, -1)

    // Save current state to future
    setFuture(prev => [...prev, { nodes: currentNodes, edges: currentEdges }])
    setPast(newPast)

    // Restore previous state
    setNodes(previous.nodes)
    setEdges(previous.edges)

    isUndoingRef.current = false
    return true
  }, [past])

  // Redo: restore next state
  const redo = useCallback((
    currentNodes: NodeMap,
    currentEdges: EdgeMap,
    setNodes: (nodes: NodeMap) => void,
    setEdges: (edges: EdgeMap) => void
  ): boolean => {
    if (future.length === 0) return false

    isUndoingRef.current = true

    const next = future[future.length - 1]
    const newFuture = future.slice(0, -1)

    // Save current state to past
    setPast(prev => [...prev, { nodes: currentNodes, edges: currentEdges }])
    setFuture(newFuture)

    // Restore next state
    setNodes(next.nodes)
    setEdges(next.edges)

    isUndoingRef.current = false
    return true
  }, [future])

  // Clear all history
  const clearHistory = useCallback(() => {
    setPast([])
    setFuture([])
  }, [])

  return {
    pushState,
    undo,
    redo,
    clearHistory,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoCount: past.length,
    redoCount: future.length,
  }
}

