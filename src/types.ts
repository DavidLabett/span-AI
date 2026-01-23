/**
 * Core data types for Span
 */

export interface Node {
  id: string
  x: number
  y: number
  width: number
  height: number
  title: string
  description: string
  collapsed: boolean
  titleColor?: string  // Optional color for title text
}

export interface Edge {
  id: string
  from: string  // node id
  to: string    // node id
  label?: string  // Optional text label for the edge
}

export interface ProjectMeta {
  name: string
  created: string
  canvas: {
    zoom: number
    x: number
    y: number
  }
}

export interface Project {
  meta: ProjectMeta
  nodes: Record<string, Node>
  edges: Record<string, Edge>
}

// Node map type for efficient lookups
export type NodeMap = Record<string, Node>
export type EdgeMap = Record<string, Edge>

// Document processing types
export interface DocumentSegment {
  id: string
  level: number  // hierarchy depth (0 = root, 1 = chapter, etc.)
  text: string
  type: 'chapter' | 'section' | 'paragraph'
  parentId?: string
  // PDF-specific metadata (optional, only for PDFs)
  fontSize?: number
  isBold?: boolean
  yPosition?: number  // Vertical position on page (for ordering)
  pageNumber?: number
}

// Hierarchy detection types (Phase 3)
export interface HierarchyNode {
  id: string
  title: string
  level: number
  content: string
  children: HierarchyNode[]
  parentId?: string
  segmentId?: string  // Reference to original DocumentSegment
}

