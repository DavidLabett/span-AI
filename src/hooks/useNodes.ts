import { useState, useCallback } from 'react'
import { Node, NodeMap } from '../types'
import { nodeDefaults } from '../theme'

// Generate unique ID
function generateId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Initial mock nodes for development
const initialNodes: NodeMap = {
  'node-1': {
    id: 'node-1',
    x: 100,
    y: 100,
    width: 240,
    height: 160,
    title: 'Main Idea',
    description: 'This is a sample node to verify the visual design matches the Catppuccin theme.',
    collapsed: false,
  },
  'node-2': {
    id: 'node-2',
    x: 400,
    y: 120,
    width: 200,
    height: 120,
    title: 'Related Concept',
    description: 'Another thought that connects to the main idea.',
    collapsed: false,
  },
  'node-3': {
    id: 'node-3',
    x: 150,
    y: 320,
    width: 180,
    height: 80,
    title: 'Collapsed Node',
    description: 'This description is hidden when collapsed.',
    collapsed: true,
  },
}

export function useNodes(initial: NodeMap = initialNodes) {
  const [nodes, setNodes] = useState<NodeMap>(initial)

  // Create a new node at given position
  const createNode = useCallback((x: number, y: number): Node => {
    const id = generateId()
    const newNode: Node = {
      id,
      x,
      y,
      width: nodeDefaults.width,
      height: nodeDefaults.height,
      title: 'New Node',
      description: '',
      collapsed: false,
    }

    setNodes(prev => ({
      ...prev,
      [id]: newNode,
    }))

    return newNode
  }, [])

  // Update a node's properties
  const updateNode = useCallback((id: string, updates: Partial<Omit<Node, 'id'>>) => {
    setNodes(prev => {
      if (!prev[id]) return prev
      return {
        ...prev,
        [id]: { ...prev[id], ...updates },
      }
    })
  }, [])

  // Move a node to new position
  const moveNode = useCallback((id: string, x: number, y: number) => {
    updateNode(id, { x, y })
  }, [updateNode])

  // Resize a node
  const resizeNode = useCallback((id: string, width: number, height: number) => {
    const clampedWidth = Math.max(width, nodeDefaults.minWidth)
    const clampedHeight = Math.max(height, nodeDefaults.minHeight)
    updateNode(id, { width: clampedWidth, height: clampedHeight })
  }, [updateNode])

  // Toggle collapsed state
  const toggleCollapse = useCallback((id: string) => {
    setNodes(prev => {
      if (!prev[id]) return prev
      return {
        ...prev,
        [id]: { ...prev[id], collapsed: !prev[id].collapsed },
      }
    })
  }, [])

  // Delete a node
  const deleteNode = useCallback((id: string) => {
    setNodes(prev => {
      const { [id]: _, ...rest } = prev
      return rest
    })
  }, [])

  // Get nodes as array (for rendering)
  const nodeList = Object.values(nodes)

  // Set all nodes (for loading from file)
  const setAllNodes = useCallback((newNodes: NodeMap) => {
    setNodes(newNodes)
  }, [])

  return {
    nodes,
    nodeList,
    createNode,
    updateNode,
    moveNode,
    resizeNode,
    toggleCollapse,
    deleteNode,
    setAllNodes,
  }
}

