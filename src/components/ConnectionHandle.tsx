import { Circle } from 'react-konva'
import { useState } from 'react'
import { theme } from '../theme'
import { HandlePosition } from '../utils/geometry'

interface ConnectionHandleProps {
  x: number
  y: number
  position: HandlePosition
  nodeId: string
  onDragStart?: (nodeId: string, position: HandlePosition, x: number, y: number) => void
  onDragMove?: (x: number, y: number) => void
  onDragEnd?: () => void
}

const HANDLE_RADIUS = 6

export function ConnectionHandle({
  x,
  y,
  position,
  nodeId,
  onDragStart,
  onDragMove,
  onDragEnd,
}: ConnectionHandleProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  return (
    <Circle
      x={x}
      y={y}
      radius={HANDLE_RADIUS}
      fill={isDragging ? theme.accent : isHovered ? theme.accentSecondary : theme.bgNode}
      stroke={theme.accentSecondary}
      strokeWidth={2}
      draggable
      onMouseEnter={() => {
        setIsHovered(true)
        document.body.style.cursor = 'crosshair'
      }}
      onMouseLeave={() => {
        setIsHovered(false)
        if (!isDragging) {
          document.body.style.cursor = 'default'
        }
      }}
      onDragStart={(e) => {
        e.cancelBubble = true
        setIsDragging(true)
        const stage = e.target.getStage()
        const pos = stage?.getPointerPosition()
        if (pos) {
          onDragStart?.(nodeId, position, pos.x, pos.y)
        }
      }}
      onDragMove={(e) => {
        e.cancelBubble = true
        const stage = e.target.getStage()
        const pos = stage?.getPointerPosition()
        if (pos) {
          onDragMove?.(pos.x, pos.y)
        }
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true
        setIsDragging(false)
        document.body.style.cursor = 'default'
        
        // Reset handle position (it will be repositioned by parent)
        e.target.x(x)
        e.target.y(y)
        
        onDragEnd?.()
      }}
    />
  )
}

