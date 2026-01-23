/**
 * Hierarchy tree construction utilities
 * Converts flat segments or LLM responses into hierarchical tree structures
 */

import { HierarchyNode, DocumentSegment } from '../types'

/**
 * Generate unique ID for hierarchy nodes
 */
function generateHierarchyId(): string {
  return `hierarchy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Convert LLM response tree to HierarchyNode structure
 * Recursively processes the tree and assigns IDs
 */
export function buildHierarchyTree(
  llmResponse: { title: string; level: number; content: string; children: any[] },
  parentId?: string
): HierarchyNode {
  const nodeId = generateHierarchyId()
  
  const node: HierarchyNode = {
    id: nodeId,
    title: llmResponse.title || 'Untitled',
    level: llmResponse.level ?? 0,
    content: llmResponse.content || '',
    children: [],
    parentId,
  }
  
  // Recursively process children
  if (Array.isArray(llmResponse.children) && llmResponse.children.length > 0) {
    node.children = llmResponse.children.map((child: any) => 
      buildHierarchyTree(child, nodeId)
    )
  }
  
  return node
}

/**
 * Validate hierarchy tree structure
 * Checks for common issues like circular references, missing parents, etc.
 */
export function validateHierarchyTree(root: HierarchyNode): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const visitedIds = new Set<string>()
  const parentMap = new Map<string, string>()
  
  function traverse(node: HierarchyNode, expectedLevel: number) {
    // Check for duplicate IDs
    if (visitedIds.has(node.id)) {
      errors.push(`Duplicate node ID found: ${node.id}`)
      return
    }
    visitedIds.add(node.id)
    
    // Check level consistency
    if (node.level !== expectedLevel) {
      errors.push(`Node "${node.title}" has inconsistent level: expected ${expectedLevel}, got ${node.level}`)
    }
    
    // Check parent reference
    if (node.parentId) {
      if (parentMap.has(node.id)) {
        errors.push(`Node "${node.title}" has multiple parent references`)
      }
      parentMap.set(node.id, node.parentId)
      
      // Check for circular reference (parent is a descendant)
      let currentId: string | undefined = node.parentId
      const ancestors = new Set<string>([node.id])
      while (currentId) {
        if (ancestors.has(currentId)) {
          errors.push(`Circular reference detected in node "${node.title}"`)
          break
        }
        ancestors.add(currentId)
        currentId = parentMap.get(currentId)
      }
    }
    
    // Validate children
    if (Array.isArray(node.children)) {
      node.children.forEach((child, idx) => {
        if (!child.id) {
          errors.push(`Child ${idx} of "${node.title}" is missing an ID`)
        }
        if (child.parentId !== node.id) {
          errors.push(`Child "${child.title}" has incorrect parentId`)
        }
        traverse(child, node.level + 1)
      })
    } else {
      errors.push(`Node "${node.title}" has invalid children array`)
    }
  }
  
  traverse(root, 0)
  
  // Check for orphaned nodes (nodes with parentId that doesn't exist)
  function checkOrphans(node: HierarchyNode) {
    if (node.parentId && !visitedIds.has(node.parentId) && node.parentId !== 'root') {
      errors.push(`Node "${node.title}" references non-existent parent: ${node.parentId}`)
    }
    node.children.forEach(checkOrphans)
  }
  checkOrphans(root)
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get tree statistics
 */
export function getTreeStats(root: HierarchyNode): {
  totalNodes: number
  maxDepth: number
  nodeCountByLevel: Record<number, number>
} {
  let totalNodes = 0
  let maxDepth = 0
  const nodeCountByLevel: Record<number, number> = {}
  
  function traverse(node: HierarchyNode, depth: number) {
    totalNodes++
    maxDepth = Math.max(maxDepth, depth)
    nodeCountByLevel[node.level] = (nodeCountByLevel[node.level] || 0) + 1
    
    node.children.forEach(child => traverse(child, depth + 1))
  }
  
  traverse(root, 0)
  
  return {
    totalNodes,
    maxDepth,
    nodeCountByLevel,
  }
}

/**
 * Flatten hierarchy tree to array (for debugging/display)
 */
export function flattenHierarchy(root: HierarchyNode): HierarchyNode[] {
  const result: HierarchyNode[] = [root]
  
  function traverse(node: HierarchyNode) {
    node.children.forEach(child => {
      result.push(child)
      traverse(child)
    })
  }
  
  traverse(root)
  return result
}

