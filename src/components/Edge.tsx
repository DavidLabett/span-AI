import { Arrow, Text, Group } from 'react-konva'
import { useState } from 'react'
import { theme, colors, typography } from '../theme'
import { Node as NodeType } from '../types'
import { getArrowPoints } from '../utils/geometry'

interface EdgeProps {
  id: string
  fromNode: NodeType
  toNode: NodeType
  label?: string
  isSelected?: boolean
  onClick?: () => void
  onDblClick?: () => void
  fromNodeVisualPos?: { x: number; y: number } | null
  toNodeVisualPos?: { x: number; y: number } | null
}

export function Edge({
  fromNode,
  toNode,
  label,
  isSelected = false,
  onClick,
  onDblClick,
  fromNodeVisualPos,
  toNodeVisualPos,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Use visual position if node is being dragged, otherwise use stored position
  const effectiveFromNode = fromNodeVisualPos 
    ? { ...fromNode, x: fromNodeVisualPos.x, y: fromNodeVisualPos.y }
    : fromNode
  const effectiveToNode = toNodeVisualPos
    ? { ...toNode, x: toNodeVisualPos.x, y: toNodeVisualPos.y }
    : toNode

  const [startX, startY, endX, endY] = getArrowPoints(effectiveFromNode, effectiveToNode)

  const strokeColor = isSelected 
    ? theme.accent 
    : isHovered 
      ? theme.accentSecondary 
      : colors.subtext0  // More visible default color

  // Calculate midpoint for label
  const midX = (startX + endX) / 2
  const midY = (startY + endY) / 2

  // Calculate edge vector
  const dx = endX - startX
  const dy = endY - startY
  const edgeLength = Math.sqrt(dx * dx + dy * dy)
  
  // Calculate angle for label rotation
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)
  const isFlipped = angle > 90 || angle < -90
  const textRotation = isFlipped ? angle + 180 : angle
  
  // Offset distances for normal and flipped states (adjust to fine-tune visual distance)
  const offsetDistance = isFlipped ? 13 : 4.5
  
  // Calculate perpendicular offset to move label away from edge
  let offsetX = 0
  let offsetY = 0
  
  if (edgeLength > 0) {
    // Normalized perpendicular vector (90° clockwise rotation: (-dy, dx))
    const perpX = -dy / edgeLength
    const perpY = dx / edgeLength
    // Apply fixed distance offset in world coordinates
    const worldOffsetX = perpX * offsetDistance
    const worldOffsetY = perpY * offsetDistance
    
    // Rotate offset back to text's local coordinate system (negative of text rotation)
    const rotationRad = -textRotation * (Math.PI / 180)
    offsetX = worldOffsetX * Math.cos(rotationRad) - worldOffsetY * Math.sin(rotationRad)
    offsetY = worldOffsetX * Math.sin(rotationRad) + worldOffsetY * Math.cos(rotationRad)
  }

  return (
    <Group>
      <Arrow
        points={[startX, startY, endX, endY]}
        stroke={strokeColor}
        strokeWidth={isSelected ? 2 : 1.5}
        fill={strokeColor}
        pointerLength={8}
        pointerWidth={6}
        hitStrokeWidth={15}
        onClick={(e) => {
          e.cancelBubble = true
          onClick?.()
        }}
        onDblClick={(e) => {
          e.cancelBubble = true
          onDblClick?.()
        }}
        onMouseEnter={() => {
          setIsHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onMouseLeave={() => {
          setIsHovered(false)
          document.body.style.cursor = 'default'
        }}
      />
      {/* Label text at midpoint, offset from edge */}
      {label && (
        <Text
          x={midX}
          y={midY}
          text={label}
          fontFamily={typography.fontFamily}
          fontSize={10}
          fill={colors.subtext0}
          align="center"
          verticalAlign="middle"
          offsetX={-offsetX}
          offsetY={-offsetY}
          rotation={textRotation}
          listening={false}
        />
      )}
    </Group>
  )
}

interface TempEdgeProps {
  startX: number
  startY: number
  endX: number
  endY: number
  isSnapped?: boolean
}

/**
 * Temporary edge shown while dragging to create a connection
 */
export function TempEdge({ startX, startY, endX, endY, isSnapped = false }: TempEdgeProps) {
  return (
    <Arrow
      points={[startX, startY, endX, endY]}
      stroke={isSnapped ? colors.green : theme.accent}
      strokeWidth={2}
      fill={isSnapped ? colors.green : theme.accent}
      pointerLength={10}
      pointerWidth={8}
      dash={isSnapped ? undefined : [5, 5]}
      opacity={isSnapped ? 1 : 0.7}
    />
  )
}
