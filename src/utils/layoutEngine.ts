/**
 * Hierarchical Tree Layout Engine
 * Phase 5: Automatically position nodes based on hierarchy
 */

import { Node, NodeMap, HierarchyNode } from '../types'

export interface LayoutConfig {
  nodeWidth: number
  nodeHeight: number
  horizontalSpacing: number  // between siblings
  verticalSpacing: number    // between levels
  levelHeight: number        // minimum height per hierarchy level
}

export const defaultLayoutConfig: LayoutConfig = {
  nodeWidth: 240,
  nodeHeight: 160,
  horizontalSpacing: 80,  // 80px between sibling nodes
  verticalSpacing: 120,    // 120px between levels
  levelHeight: 200,        // minimum 200px per level
}

interface LayoutNode {
  hierarchyId: string
  nodeId: string
  x: number
  y: number
  width: number
  height: number  // node height for vertical spacing
  children: LayoutNode[]
  subtreeWidth: number  // total width of subtree
  subtreeHeight: number  // total height of subtree (for vertical spacing)
}

/**
 * Calculate the width of a subtree (for centering parents)
 */
function calculateSubtreeWidth(node: LayoutNode): number {
  if (node.children.length === 0) {
    return node.width
  }

  // Sum of all children's subtree widths plus spacing
  const childrenWidth = node.children.reduce((sum, child) => {
    return sum + calculateSubtreeWidth(child)
  }, 0)

  // Add spacing between children
  const spacing = node.children.length > 1 
    ? (node.children.length - 1) * defaultLayoutConfig.horizontalSpacing
    : 0

  return Math.max(node.width, childrenWidth + spacing)
}

/**
 * Layout a hierarchy tree recursively
 */
function layoutNode(
  hierarchyNode: HierarchyNode,
  nodeMap: NodeMap,
  hierarchyToNodeId: Map<string, string>,
  level: number,
  startX: number,
  startY: number,
  config: LayoutConfig
): LayoutNode {
  const nodeId = hierarchyToNodeId.get(hierarchyNode.id)
  if (!nodeId) {
    throw new Error(`Node ID not found for hierarchy node: ${hierarchyNode.id}`)
  }

  const node = nodeMap[nodeId]
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`)
  }

  // Calculate Y position based on level and accumulated heights
  // For the first level, use startY; for deeper levels, we'll calculate based on parent height
  const y = startY

  // Create layout node data structure
  const result: LayoutNode = {
    hierarchyId: hierarchyNode.id,
    nodeId: nodeId,
    x: startX,
    y: y,
    width: node.width,
    height: node.height,
    children: [],
    subtreeWidth: 0,
    subtreeHeight: 0,
  }

  // If no children, position node and return
  if (hierarchyNode.children.length === 0) {
    result.x = startX
    result.y = y
    result.subtreeWidth = node.width
    result.subtreeHeight = node.height
    return result
  }

  // Layout children recursively
  // Calculate Y position for children: parent Y + parent height + vertical spacing
  const childrenStartY = y + node.height + config.verticalSpacing
  
  let currentX = startX
  const childLayoutNodes: LayoutNode[] = []

  for (const childHierarchy of hierarchyNode.children) {
    const childLayout = layoutNode(
      childHierarchy,
      nodeMap,
      hierarchyToNodeId,
      level + 1,
      currentX,
      childrenStartY,
      config
    )
    childLayoutNodes.push(childLayout)
    currentX += childLayout.subtreeWidth + config.horizontalSpacing
  }

  result.children = childLayoutNodes

  // Calculate total width of children
  const childrenTotalWidth = childLayoutNodes.reduce((sum, child) => sum + child.subtreeWidth, 0)
  const childrenSpacing = childLayoutNodes.length > 1
    ? (childLayoutNodes.length - 1) * config.horizontalSpacing
    : 0
  const subtreeWidth = Math.max(node.width, childrenTotalWidth + childrenSpacing)

  // Calculate total height of subtree (parent height + spacing + max child subtree height)
  const maxChildSubtreeHeight = childLayoutNodes.length > 0
    ? Math.max(...childLayoutNodes.map(child => child.subtreeHeight))
    : 0
  const subtreeHeight = node.height + config.verticalSpacing + maxChildSubtreeHeight

  // Center parent above children
  const childrenStartX = childLayoutNodes[0].x
  const childrenEndX = childLayoutNodes[childLayoutNodes.length - 1].x + 
                       childLayoutNodes[childLayoutNodes.length - 1].subtreeWidth
  const childrenCenterX = (childrenStartX + childrenEndX) / 2

  // Position parent centered above children
  result.x = childrenCenterX - (node.width / 2)
  result.y = y
  result.subtreeWidth = subtreeWidth
  result.subtreeHeight = subtreeHeight

  // Update children positions if parent was centered (shift them if needed)
  if (result.x < startX) {
    const offset = startX - result.x
    result.x = startX
    // Shift all children right
    childLayoutNodes.forEach(child => {
      child.x += offset
    })
  }

  return result
}

/**
 * Apply layout positions to nodes
 */
function applyLayoutToNodes(
  layoutNode: LayoutNode,
  nodeMap: NodeMap
): void {
  const node = nodeMap[layoutNode.nodeId]
  if (node) {
    node.x = layoutNode.x
    node.y = layoutNode.y
  }

  // Recursively apply to children
  layoutNode.children.forEach(child => {
    applyLayoutToNodes(child, nodeMap)
  })
}

/**
 * Calculate bounding box of all nodes
 */
function calculateBounds(nodeMap: NodeMap): { minX: number; minY: number; maxX: number; maxY: number } {
  const nodes = Object.values(nodeMap)
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  nodes.forEach(node => {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  })

  return { minX, minY, maxX, maxY }
}

/**
 * Layout hierarchy tree and return updated node map
 */
export function layoutHierarchy(
  rootHierarchy: HierarchyNode,
  nodeMap: NodeMap,
  hierarchyToNodeId: Map<string, string>,
  config: LayoutConfig = defaultLayoutConfig
): NodeMap {
  // Create a copy of the node map to avoid mutating the original
  const updatedNodes: NodeMap = { ...nodeMap }

  // Calculate initial position (start at origin, will center later)
  const startX = 0
  const startY = 0

  // Layout the tree
  const rootLayout = layoutNode(
    rootHierarchy,
    updatedNodes,
    hierarchyToNodeId,
    0,
    startX,
    startY,
    config
  )

  // Apply layout positions
  applyLayoutToNodes(rootLayout, updatedNodes)

  // Calculate bounds to center the tree
  const bounds = calculateBounds(updatedNodes)
  const treeWidth = bounds.maxX - bounds.minX
  const treeHeight = bounds.maxY - bounds.minY

  // Center the entire tree at origin (0, 0) or offset if needed
  // We'll center it, but leave some margin
  const centerOffsetX = -bounds.minX - (treeWidth / 2)
  const centerOffsetY = -bounds.minY - (treeHeight / 2)

  // Apply centering offset
  Object.values(updatedNodes).forEach(node => {
    node.x += centerOffsetX
    node.y += centerOffsetY
  })

  return updatedNodes
}

/**
 * Get the center position of the tree (for camera positioning)
 */
export function getTreeCenter(nodeMap: NodeMap): { x: number; y: number } {
  const bounds = calculateBounds(nodeMap)
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }
}

/**
 * Get the bounding box of the tree (for zoom-to-fit)
 */
export function getTreeBounds(nodeMap: NodeMap): { 
  x: number; 
  y: number; 
  width: number; 
  height: number;
  padding: number;
} {
  const bounds = calculateBounds(nodeMap)
  const padding = 100  // Add padding around the tree

  return {
    x: bounds.minX - padding,
    y: bounds.minY - padding,
    width: (bounds.maxX - bounds.minX) + (padding * 2),
    height: (bounds.maxY - bounds.minY) + (padding * 2),
    padding,
  }
}

