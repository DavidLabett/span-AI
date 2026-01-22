import { useState } from 'react'
import { Group, Rect, Text, Line } from 'react-konva'
import Konva from 'konva'
import { theme, typography, nodeDefaults, spacing, colors } from '../theme'
import { ConnectionHandle } from './ConnectionHandle'
import { HandlePosition, getHandleOffset } from '../utils/geometry'

// Predefined title colors (4 options)
const TITLE_COLORS = [
  theme.text,        // Default: white/light gray
  colors.blue,       // Blue
  colors.green,      // Green
  colors.yellow,     // Yellow
  colors.pink,        // Pink
]

interface NodeProps {
  id: string
  x: number
  y: number
  width: number
  height: number
  title: string
  description: string
  collapsed: boolean
  titleColor?: string
  isSelected?: boolean
  forceShowHandles?: boolean  // Show handles even if not hovered/selected
  visualPos?: { x: number; y: number } | null  // Visual position during drag (for multi-select)
  onClick?: (e?: Konva.KonvaEventObject<MouseEvent>) => void
  onDragMove?: (x: number, y: number) => void
  onDragEnd?: (x: number, y: number) => void
  onResize?: (width: number, height: number) => void
  onEditTitle?: () => void
  onEditDescription?: () => void
  onToggleCollapse?: () => void
  onToggleTitleColor?: () => void
  onConnectionStart?: (nodeId: string, position: HandlePosition, x: number, y: number) => void
  onConnectionMove?: (x: number, y: number) => void
  onConnectionEnd?: () => void
}

const RESIZE_HANDLE_SIZE = 8
const HANDLE_COLOR = theme.accent
const HANDLE_COLOR_HOVER = theme.accentSecondary

const HANDLE_POSITIONS: HandlePosition[] = ['top', 'right', 'bottom', 'left']

/**
 * Node component - draggable and resizable canvas element.
 */
export function Node({
  id,
  x,
  y,
  width,
  height,
  title,
  description,
  collapsed,
  titleColor,
  isSelected = false,
  forceShowHandles = false,
  visualPos,
  onClick,
  onDragMove,
  onDragEnd,
  onResize,
  onEditTitle,
  onEditDescription,
  onToggleCollapse,
  onToggleTitleColor,
  onConnectionStart,
  onConnectionMove,
  onConnectionEnd,
}: NodeProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null)
  
  // Local size state for live resize preview
  const [localSize, setLocalSize] = useState<{ width: number; height: number } | null>(null)

  const borderColor = isSelected 
    ? theme.borderSelected 
    : isHovered 
      ? theme.borderHover 
      : theme.border
  
  const borderWidth = isSelected 
    ? nodeDefaults.borderWidthSelected 
    : nodeDefaults.borderWidth

  // Use local size during resize, otherwise use props
  const currentWidth = localSize?.width ?? width
  const currentHeight = localSize?.height ?? height

  const displayHeight = collapsed 
    ? nodeDefaults.titleHeight + nodeDefaults.padding 
    : currentHeight

  // Chevron points for collapse indicator
  const chevronSize = 8
  const chevronX = spacing[3]
  const chevronY = nodeDefaults.titleHeight / 2
  const chevronPoints = collapsed
    ? [0, -chevronSize/2, chevronSize/2, 0, 0, chevronSize/2] // pointing right ▸
    : [0, 0, chevronSize/2, chevronSize/2, chevronSize, 0]     // pointing down ▾

  // Handle drag move - report position for edge updates
  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    onDragMove?.(node.x(), node.y())
  }

  // Handle drag end - update position in state
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    onDragEnd?.(node.x(), node.y())
  }

  // Handle resize drag - live preview
  const handleResizeDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    // Stop event from bubbling to parent Group (prevents node from moving)
    e.cancelBubble = true
    
    const handle = e.target
    const newWidth = Math.max(handle.x() + RESIZE_HANDLE_SIZE / 2, nodeDefaults.minWidth)
    const newHeight = Math.max(handle.y() + RESIZE_HANDLE_SIZE / 2, nodeDefaults.minHeight)
    
    // Update local size for live preview
    setLocalSize({ width: newWidth, height: newHeight })
    
    // Keep handle visually at the corner
    handle.x(newWidth - RESIZE_HANDLE_SIZE / 2)
    handle.y(newHeight - RESIZE_HANDLE_SIZE / 2)
  }

  const handleResizeDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true
    
    if (localSize) {
      // Commit the resize to state
      onResize?.(localSize.width, localSize.height)
      // Clear local size
      setLocalSize(null)
    }
  }

  const showResizeHandle = isSelected && !collapsed
  const showConnectionHandles = isSelected || isHovered || forceShowHandles

  // Title text area dimensions (for editing overlay positioning)
  const titleX = chevronX + chevronSize + spacing[2]
  const colorBoxSize = 12
  const colorBoxPadding = spacing[2]
  const titleWidth = currentWidth - chevronX - chevronSize - spacing[2] - colorBoxSize - colorBoxPadding * 2 - spacing[3]
  
  // Get current title color (default to first color if not set)
  const currentTitleColor = titleColor || TITLE_COLORS[0]

  // Use visual position if provided (for multi-select dragging), otherwise use stored position
  const displayX = visualPos?.x ?? x
  const displayY = visualPos?.y ?? y

  return (
    <Group 
      x={displayX} 
      y={displayY} 
      draggable
      onClick={(e) => onClick?.(e)}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background */}
      <Rect
        width={currentWidth}
        height={displayHeight}
        fill={theme.bgNode}
        stroke={borderColor}
        strokeWidth={borderWidth}
        cornerRadius={nodeDefaults.borderRadius}
      />

      {/* Collapse chevron - clickable */}
      <Group
        x={chevronX - 4}
        y={chevronY - 8}
        onClick={(e) => {
          e.cancelBubble = true
          onToggleCollapse?.()
        }}
      >
        <Rect
          width={16}
          height={16}
          fill="transparent"
        />
        <Line
          points={chevronPoints}
          x={4}
          y={8}
          stroke={theme.textMuted}
          strokeWidth={1.5}
          lineCap="round"
          lineJoin="round"
        />
      </Group>

      {/* Title - double-click to edit */}
      <Text
        x={titleX}
        y={spacing[2]}
        width={titleWidth}
        height={nodeDefaults.titleHeight - spacing[2]}
        text={title}
        fontFamily={typography.fontFamily}
        fontSize={typography.sizes.title}
        fontStyle="500"
        fill={currentTitleColor}
        verticalAlign="middle"
        ellipsis={true}
        onDblClick={(e) => {
          e.cancelBubble = true
          onEditTitle?.()
        }}
      />

      {/* Color toggle box - top right corner (only show when selected or hovered) */}
      {(isSelected || isHovered) && (
        <Group
          x={currentWidth - colorBoxSize - colorBoxPadding}
          y={colorBoxPadding}
          onClick={(e) => {
            e.cancelBubble = true
            onToggleTitleColor?.()
          }}
          onMouseEnter={() => {
            document.body.style.cursor = 'pointer'
          }}
          onMouseLeave={() => {
            document.body.style.cursor = 'default'
          }}
        >
          <Rect
            width={colorBoxSize}
            height={colorBoxSize}
            fill={currentTitleColor}
            stroke={theme.border}
            strokeWidth={1}
            cornerRadius={2}
          />
        </Group>
      )}

      {/* Divider line */}
      {!collapsed && (
        <Line
          points={[0, nodeDefaults.titleHeight, currentWidth, nodeDefaults.titleHeight]}
          stroke={theme.border}
          strokeWidth={1}
        />
      )}

      {/* Description - double-click to edit */}
      {!collapsed && (
        <Text
          x={spacing[3]}
          y={nodeDefaults.titleHeight + spacing[2]}
          width={currentWidth - spacing[3] * 2}
          height={displayHeight - nodeDefaults.titleHeight - spacing[3]}
          text={description}
          fontFamily={typography.fontFamily}
          fontSize={typography.sizes.description}
          fill={theme.textMuted}
          lineHeight={typography.lineHeight}
          wrap="word"
          ellipsis={true}
          onDblClick={(e) => {
            e.cancelBubble = true
            onEditDescription?.()
          }}
        />
      )}

      {/* Connection handles (4 sides) */}
      {showConnectionHandles && HANDLE_POSITIONS.map((position) => {
        const offset = getHandleOffset(position, currentWidth, displayHeight)
        return (
          <ConnectionHandle
            key={position}
            x={offset.x}
            y={offset.y}
            position={position}
            nodeId={id}
            onDragStart={onConnectionStart}
            onDragMove={onConnectionMove}
            onDragEnd={onConnectionEnd}
          />
        )
      })}

      {/* Resize handle (SE corner) */}
      {showResizeHandle && (
        <Rect
          x={currentWidth - RESIZE_HANDLE_SIZE / 2}
          y={displayHeight - RESIZE_HANDLE_SIZE / 2}
          width={RESIZE_HANDLE_SIZE}
          height={RESIZE_HANDLE_SIZE}
          fill={hoveredHandle === 'se' ? HANDLE_COLOR_HOVER : HANDLE_COLOR}
          cornerRadius={1}
          draggable
          onDragMove={handleResizeDragMove}
          onDragEnd={handleResizeDragEnd}
          onMouseEnter={() => {
            setHoveredHandle('se')
            document.body.style.cursor = 'se-resize'
          }}
          onMouseLeave={() => {
            setHoveredHandle(null)
            document.body.style.cursor = 'default'
          }}
        />
      )}
    </Group>
  )
}

// Export layout constants for positioning the editor
export const nodeLayout = {
  titleX: spacing[3] + 8 + spacing[2], // chevronX + chevronSize + spacing
  titleY: spacing[2],
  titleHeight: nodeDefaults.titleHeight - spacing[2],
  descriptionX: spacing[3],
  descriptionY: nodeDefaults.titleHeight + spacing[2],
}
