/**
 * Text measurement utilities for calculating node dimensions
 */

import { typography, nodeDefaults, spacing } from '../theme'

/**
 * Measure text width using canvas context
 */
function measureTextWidth(text: string, fontSize: number, fontFamily: string): number {
  // Create a temporary canvas element to measure text
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  
  if (!context) {
    // Fallback: rough estimate based on character count
    return text.length * (fontSize * 0.6)
  }
  
  context.font = `${fontSize}px ${fontFamily}`
  const metrics = context.measureText(text)
  return metrics.width
}

/**
 * Calculate node width based on title length
 * Accounts for padding: chevron (8px) + spacing[2] (8px) + color box (12px) + padding (8px) + spacing[3] (16px)
 */
export function calculateNodeWidth(title: string): number {
  const titleFontSize = typography.sizes.title
  const titleFontFamily = typography.fontFamily
  
  // Measure title width
  const titleWidth = measureTextWidth(title, titleFontSize, titleFontFamily)
  
  // Calculate padding: chevron (8px) + spacing[2] (8px) + color box (12px) + padding (8px) + spacing[3] (16px)
  const leftPadding = spacing[3] + 8 + spacing[2]  // chevronX + chevronSize + spacing
  const rightPadding = 12 + spacing[2] + spacing[3]  // colorBoxSize + colorBoxPadding + spacing[3]
  const totalPadding = leftPadding + rightPadding
  
  // Add some extra padding for better appearance
  const extraPadding = 16
  
  const calculatedWidth = titleWidth + totalPadding + extraPadding
  
  // Ensure minimum width
  return Math.max(calculatedWidth, nodeDefaults.minWidth)
}

/**
 * Calculate node height based on description length
 * Accounts for title height, padding, and text wrapping
 */
export function calculateNodeHeight(description: string, nodeWidth: number): number {
  if (!description || description.trim().length === 0) {
    // If no description, return minimum height (title height + padding)
    return nodeDefaults.titleHeight + spacing[3] * 2
  }
  
  const descFontSize = typography.sizes.description
  const descFontFamily = typography.fontFamily
  const lineHeight = typography.lineHeight * descFontSize
  
  // Available width for description (accounting for padding)
  const availableWidth = nodeWidth - (spacing[3] * 2)
  
  // Split description into lines (handle both \n and wrapping)
  const lines = description.split('\n')
  let totalHeight = 0
  
  for (const line of lines) {
    if (line.trim().length === 0) {
      // Empty line still takes up space
      totalHeight += lineHeight
      continue
    }
    
    // Measure line width
    const lineWidth = measureTextWidth(line, descFontSize, descFontFamily)
    
    // Calculate how many wrapped lines this line will create
    const wrappedLines = Math.ceil(lineWidth / availableWidth) || 1
    totalHeight += wrappedLines * lineHeight
  }
  
  // Add title height and padding
  const titleHeight = nodeDefaults.titleHeight
  const topPadding = spacing[2]  // spacing between title and description
  const bottomPadding = spacing[3]  // bottom padding
  
  const calculatedHeight = titleHeight + topPadding + totalHeight + bottomPadding
  
  // Ensure minimum height
  return Math.max(calculatedHeight, nodeDefaults.minHeight)
}

