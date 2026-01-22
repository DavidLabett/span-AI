import { Node } from '../types'
import { nodeDefaults, spacing } from '../theme'

export type HandlePosition = 'top' | 'right' | 'bottom' | 'left'

export interface HandlePoint {
  x: number
  y: number
  position: HandlePosition
  nodeId?: string
}

// Snap threshold in canvas coordinates
export const SNAP_THRESHOLD = 30

/**
 * Get the display height of a node (accounting for collapsed state)
 */
export function getNodeDisplayHeight(node: Node): number {
  return node.collapsed 
    ? nodeDefaults.titleHeight + spacing[3]
    : node.height
}

/**
 * Get the center points of connection handles for a node
 */
export function getHandlePoints(node: Node): Record<HandlePosition, HandlePoint> {
  const displayHeight = getNodeDisplayHeight(node)

  return {
    top: {
      x: node.x + node.width / 2,
      y: node.y,
      position: 'top',
      nodeId: node.id,
    },
    right: {
      x: node.x + node.width,
      y: node.y + displayHeight / 2,
      position: 'right',
      nodeId: node.id,
    },
    bottom: {
      x: node.x + node.width / 2,
      y: node.y + displayHeight,
      position: 'bottom',
      nodeId: node.id,
    },
    left: {
      x: node.x,
      y: node.y + displayHeight / 2,
      position: 'left',
      nodeId: node.id,
    },
  }
}

/**
 * Find the closest handle point on a node to a given point
 */
export function getClosestHandle(node: Node, targetX: number, targetY: number): HandlePoint {
  const handles = getHandlePoints(node)
  let closest = handles.top
  let minDist = Infinity

  for (const handle of Object.values(handles)) {
    const dist = Math.hypot(handle.x - targetX, handle.y - targetY)
    if (dist < minDist) {
      minDist = dist
      closest = handle
    }
  }

  return closest
}

/**
 * Find the closest handle across all nodes (excluding a specific node)
 */
export function findClosestHandleInNodes(
  nodes: Node[],
  targetX: number,
  targetY: number,
  excludeNodeId?: string
): { handle: HandlePoint; distance: number } | null {
  let closestHandle: HandlePoint | null = null
  let minDist = Infinity

  for (const node of nodes) {
    if (node.id === excludeNodeId) continue

    const handles = getHandlePoints(node)
    for (const handle of Object.values(handles)) {
      const dist = Math.hypot(handle.x - targetX, handle.y - targetY)
      if (dist < minDist) {
        minDist = dist
        closestHandle = handle
      }
    }
  }

  if (!closestHandle) return null

  return {
    handle: closestHandle,
    distance: minDist,
  }
}

/**
 * Calculate arrow points between two nodes.
 * Returns [startX, startY, endX, endY]
 */
export function getArrowPoints(
  fromNode: Node,
  toNode: Node
): [number, number, number, number] {
  const fromHandles = getHandlePoints(fromNode)
  const toHandles = getHandlePoints(toNode)

  // Find the pair of handles with minimum distance
  let minDist = Infinity
  let bestFrom = fromHandles.right
  let bestTo = toHandles.left

  for (const from of Object.values(fromHandles)) {
    for (const to of Object.values(toHandles)) {
      const dist = Math.hypot(from.x - to.x, from.y - to.y)
      if (dist < minDist) {
        minDist = dist
        bestFrom = from
        bestTo = to
      }
    }
  }

  return [bestFrom.x, bestFrom.y, bestTo.x, bestTo.y]
}

/**
 * Get handle position relative to node (for rendering handles on node)
 */
export function getHandleOffset(
  position: HandlePosition,
  width: number,
  height: number
): { x: number; y: number } {
  switch (position) {
    case 'top':
      return { x: width / 2, y: 0 }
    case 'right':
      return { x: width, y: height / 2 }
    case 'bottom':
      return { x: width / 2, y: height }
    case 'left':
      return { x: 0, y: height / 2 }
  }
}
