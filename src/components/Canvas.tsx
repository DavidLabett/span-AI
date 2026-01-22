import Konva from 'konva'
import { Stage, Layer } from 'react-konva'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Node, nodeLayout } from './Node'
import { Edge, TempEdge } from './Edge'
import { TextEditor } from './TextEditor'
import { StatusBar } from './StatusBar'
import { useCanvas } from '../hooks/useCanvas'
import { useNodes } from '../hooks/useNodes'
import { useEdges } from '../hooks/useEdges'
import { useProject } from '../hooks/useProject'
import { useHistory } from '../hooks/useHistory'
import { typography, spacing, theme, colors } from '../theme'
import { HandlePosition, findClosestHandleInNodes, getHandlePoints, getArrowPoints, SNAP_THRESHOLD } from '../utils/geometry'
import { Node as NodeType } from '../types'

interface EditingState {
  nodeId?: string
  edgeId?: string
  field: 'title' | 'description' | 'label'
}

interface ConnectionDragState {
  fromNodeId: string
  fromPosition: HandlePosition
  startX: number
  startY: number
  currentX: number
  currentY: number
  // Snapped target (if within threshold)
  snappedNodeId: string | null
  snappedPosition: HandlePosition | null
  snappedX: number | null
  snappedY: number | null
}

interface CanvasProps {
  initialProjectPath?: string
}

/**
 * Canvas component with infinite pan & zoom.
 */
export function Canvas({ initialProjectPath }: CanvasProps = {}) {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDragState | null>(null)
  // Track visual positions of nodes being dragged (for smooth edge updates)
  const [draggingNodes, setDraggingNodes] = useState<Record<string, { x: number; y: number }>>({})
  // Track copied nodes for paste operation
  const [copiedNodes, setCopiedNodes] = useState<NodeType[]>([])
  const [pasteOffset, setPasteOffset] = useState({ x: 0, y: 0 })
  // Track initial drag positions for multi-select
  const dragStartPositions = useRef<Record<string, { x: number; y: number }>>({})
  
  const { camera, stageRef, handlers, screenToCanvas, canvasToScreen, setCameraPosition } = useCanvas()
  const { nodes, nodeList, createNode, moveNode, resizeNode, updateNode, toggleCollapse, deleteNode, setAllNodes } = useNodes({})
  const { edges, edgeList, createEdge, updateEdge, deleteEdge, setAllEdges } = useEdges()

  // History for undo/redo
  const { pushState, undo, redo, undoCount, redoCount, clearHistory } = useHistory()

  // Project persistence
  const { save, open, loadProjectByPath, newProject, markDirty, isDirty, projectName, currentFilePath } = useProject({
    nodes,
    edges,
    camera,
    setAllNodes,
    setAllEdges,
    setCameraPosition,
  })

  // Load project if initialProjectPath is provided (from WelcomeScreen)
  useEffect(() => {
    if (initialProjectPath) {
      loadProjectByPath(initialProjectPath)
    }
  }, [initialProjectPath, loadProjectByPath])

  // Helper to save state before changes
  const saveStateForUndo = useCallback(() => {
    pushState(nodes, edges)
  }, [pushState, nodes, edges])

  // Handle undo
  const handleUndo = useCallback(() => {
    const success = undo(nodes, edges, setAllNodes, setAllEdges)
    if (success) markDirty()
  }, [undo, nodes, edges, setAllNodes, setAllEdges, markDirty])

  // Handle redo
  const handleRedo = useCallback(() => {
    const success = redo(nodes, edges, setAllNodes, setAllEdges)
    if (success) markDirty()
  }, [redo, nodes, edges, setAllNodes, setAllEdges, markDirty])

  // Copy selected node(s)
  const handleCopy = useCallback(() => {
    if (selectedNodeIds.size === 0) return
    
    // Get all selected nodes
    const nodesToCopy = Array.from(selectedNodeIds)
      .map(id => nodes[id])
      .filter((node): node is NodeType => node !== undefined)
    
    if (nodesToCopy.length === 0) return
    
    // Store the nodes to copy
    setCopiedNodes(nodesToCopy)
    // Store the average position for offset calculation
    const avgX = nodesToCopy.reduce((sum, node) => sum + node.x, 0) / nodesToCopy.length
    const avgY = nodesToCopy.reduce((sum, node) => sum + node.y, 0) / nodesToCopy.length
    setPasteOffset({ x: avgX, y: avgY })
  }, [selectedNodeIds, nodes])

  // Paste copied node(s) at cursor position
  const handlePaste = useCallback(() => {
    if (copiedNodes.length === 0) return
    if (editing) return // Don't paste while editing text
    
    // Get cursor position (use center of viewport if no specific position)
    const stage = stageRef.current
    if (!stage) return
    
    const pointer = stage.getPointerPosition()
    let canvasPos: { x: number; y: number }
    
    if (pointer) {
      // Use actual cursor position
      canvasPos = screenToCanvas(pointer.x, pointer.y)
    } else {
      // Use center of viewport if cursor is not over canvas
      const viewportCenter = screenToCanvas(dimensions.width / 2, dimensions.height / 2)
      canvasPos = viewportCenter
    }
    
    // Calculate offset from original position
    const offsetX = canvasPos.x - pasteOffset.x
    const offsetY = canvasPos.y - pasteOffset.y
    
    saveStateForUndo()
    
    // Create new nodes with new IDs, offset from original positions
    const newNodeIds: string[] = []
    
    copiedNodes.forEach(copiedNode => {
      // Create new node at offset position
      const newX = copiedNode.x + offsetX
      const newY = copiedNode.y + offsetY
      
      // Use createNode to add it properly, then update all properties
      const tempNode = createNode(newX, newY)
      const newId = tempNode.id
      
      // Update with all copied properties
      updateNode(newId, {
        title: copiedNode.title,
        description: copiedNode.description,
        width: copiedNode.width,
        height: copiedNode.height,
        collapsed: copiedNode.collapsed,
        titleColor: copiedNode.titleColor,
      })
      
      newNodeIds.push(newId)
    })
    
    // Select all pasted nodes
    if (newNodeIds.length > 0) {
      setSelectedNodeIds(new Set(newNodeIds))
      setSelectedEdgeId(null)
    }
    
    // Update paste offset for next paste (staggered paste)
    setPasteOffset(prev => ({
      x: prev.x + 20,
      y: prev.y + 20,
    }))
    
    markDirty()
  }, [copiedNodes, pasteOffset, editing, stageRef, screenToCanvas, dimensions, saveStateForUndo, createNode, updateNode, markDirty])

  // Export canvas to image
  const handleExportImage = useCallback(async () => {
    const stage = stageRef.current
    if (!stage) return
    
    try {
      // Get stage data URL (high quality)
      const dataURL = stage.toDataURL({
        pixelRatio: 2, // Higher quality
        mimeType: 'image/png',
        quality: 1,
      })
      
      // Show save dialog
      const filePath = await window.electronAPI.showSaveImageDialog()
      if (!filePath) return // User cancelled
      
      // Save the image
      const result = await window.electronAPI.saveImage(filePath, dataURL)
      if (!result.success) {
        console.error('Failed to save image:', result.error)
      }
    } catch (error) {
      console.error('Error exporting image:', error)
    }
  }, [stageRef])

  // Check if we're currently dragging a connection
  const isDraggingConnection = connectionDrag !== null

  useEffect(() => {
    const updateDimensions = () => {
      const container = document.querySelector('.canvas-container')
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: container.clientHeight,
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Keyboard handler for delete, file operations, and undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // File and edit operations (Ctrl/Cmd + key)
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault()
          save()
          return
        }
        if (e.key === 'o') {
          e.preventDefault()
          open()
          return
        }
        if (e.key === 'n') {
          e.preventDefault()
          newProject()
          clearHistory()
          return
        }
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          handleUndo()
          return
        }
        if ((e.key === 'z' || e.key === 'Z') && e.shiftKey) {
          e.preventDefault()
          handleRedo()
          return
        }
        if (e.key === 'c') {
          e.preventDefault()
          handleCopy()
          return
        }
        if (e.key === 'v') {
          e.preventDefault()
          handlePaste()
          return
        }
        if (e.key === 'e') {
          e.preventDefault()
          handleExportImage()
          return
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if editing text
        if (editing) return
        
        if (selectedEdgeId) {
          saveStateForUndo()
          deleteEdge(selectedEdgeId)
          setSelectedEdgeId(null)
          markDirty()
        } else if (selectedNodeIds.size > 0) {
          saveStateForUndo()
          // Delete all selected nodes
          selectedNodeIds.forEach(nodeId => deleteNode(nodeId))
          setSelectedNodeIds(new Set())
          markDirty()
        }
      } else if (e.key === 'Escape') {
        setSelectedNodeIds(new Set())
        setSelectedEdgeId(null)
        setEditing(null)
        setConnectionDrag(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNodeIds, selectedEdgeId, editing, deleteNode, deleteEdge, save, open, newProject, markDirty, handleUndo, handleRedo, saveStateForUndo, clearHistory, handleCopy, handlePaste, handleExportImage])

  // Create node at pointer position
  const createNodeAtPointer = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Only create on empty canvas (Stage itself)
    if (e.target !== e.target.getStage()) return

    const stage = e.target.getStage()
    const pointer = stage?.getPointerPosition()
    if (!pointer) return

    // Convert screen position to canvas coordinates
    const canvasPos = screenToCanvas(pointer.x, pointer.y)
    
    // Save state for undo
    saveStateForUndo()
    
    // Create node and select it
    const newNode = createNode(canvasPos.x, canvasPos.y)
    setSelectedNodeIds(new Set([newNode.id]))
    setSelectedEdgeId(null)
    markDirty()
  }, [screenToCanvas, createNode, markDirty, saveStateForUndo])

  // Handle double-click to create node
  const handleDblClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    createNodeAtPointer(e)
  }, [createNodeAtPointer])

  // Handle right-click to create node (and prevent context menu)
  // const handleContextMenu = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
  //   e.evt.preventDefault()
  //   createNodeAtPointer(e)
  // }, [createNodeAtPointer])

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Deselect if clicking on empty canvas
    if (e.target === e.target.getStage()) {
      setSelectedNodeIds(new Set())
      setSelectedEdgeId(null)
    }
  }, [])

  // Handle node click with multi-select support
  const handleNodeClick = useCallback((nodeId: string, e?: Konva.KonvaEventObject<MouseEvent>) => {
    const isCtrlClick = e?.evt.ctrlKey || e?.evt.metaKey
    
    if (isCtrlClick) {
      // Toggle selection
      setSelectedNodeIds(prev => {
        const next = new Set(prev)
        if (next.has(nodeId)) {
          next.delete(nodeId)
        } else {
          next.add(nodeId)
        }
        return next
      })
      setSelectedEdgeId(null)
    } else {
      // Single selection (replace)
      setSelectedNodeIds(new Set([nodeId]))
      setSelectedEdgeId(null)
    }
  }, [])

  // Handle edge click to select
  const handleEdgeClick = useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId)
    setSelectedNodeIds(new Set())
  }, [])

  // Start editing a field
  const startEditing = useCallback((nodeId: string, field: 'title' | 'description') => {
    setEditing({ nodeId, field })
  }, [])

  // Start editing an edge label
  const startEditingEdgeLabel = useCallback((edgeId: string) => {
    setEditing({ edgeId, field: 'label' })
  }, [])

  // Save edited text
  const handleSaveEdit = useCallback((value: string) => {
    if (editing) {
      saveStateForUndo()
      if (editing.nodeId && (editing.field === 'title' || editing.field === 'description')) {
        updateNode(editing.nodeId, { [editing.field]: value })
      } else if (editing.edgeId && editing.field === 'label') {
        updateEdge(editing.edgeId, { label: value })
      }
      setEditing(null)
      markDirty()
    }
  }, [editing, updateNode, updateEdge, markDirty, saveStateForUndo])

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditing(null)
  }, [])

  // Connection drag handlers
  const handleConnectionStart = useCallback((
    nodeId: string, 
    position: HandlePosition, 
    _screenX: number, 
    _screenY: number
  ) => {
    const node = nodes[nodeId]
    if (!node) return

    // Get the actual handle position from the node
    const handles = getHandlePoints(node)
    const handle = handles[position]
    
    setConnectionDrag({
      fromNodeId: nodeId,
      fromPosition: position,
      startX: handle.x,
      startY: handle.y,
      currentX: handle.x,
      currentY: handle.y,
      snappedNodeId: null,
      snappedPosition: null,
      snappedX: null,
      snappedY: null,
    })
  }, [nodes])

  const handleConnectionMove = useCallback((screenX: number, screenY: number) => {
    if (!connectionDrag) return
    
    const canvasPos = screenToCanvas(screenX, screenY)
    
    // Find closest handle (excluding the source node)
    const closest = findClosestHandleInNodes(
      nodeList,
      canvasPos.x,
      canvasPos.y,
      connectionDrag.fromNodeId
    )

    // Check if within snap threshold
    const isSnapped = closest && closest.distance < SNAP_THRESHOLD

    setConnectionDrag(prev => prev ? {
      ...prev,
      currentX: canvasPos.x,
      currentY: canvasPos.y,
      snappedNodeId: isSnapped && closest ? closest.handle.nodeId || null : null,
      snappedPosition: isSnapped && closest ? closest.handle.position : null,
      snappedX: isSnapped && closest ? closest.handle.x : null,
      snappedY: isSnapped && closest ? closest.handle.y : null,
    } : null)
  }, [connectionDrag, screenToCanvas, nodeList])

  const handleConnectionEnd = useCallback(() => {
    if (!connectionDrag) return

    // If snapped to a handle, create the edge
    if (connectionDrag.snappedNodeId) {
      saveStateForUndo()
      createEdge(connectionDrag.fromNodeId, connectionDrag.snappedNodeId)
      markDirty()
    }

    setConnectionDrag(null)
  }, [connectionDrag, createEdge, markDirty, saveStateForUndo])

  // Track node drag move for smooth edge updates
  const handleNodeDragMove = useCallback((nodeId: string, x: number, y: number) => {
    const node = nodes[nodeId]
    if (!node) return
    
    // Store initial positions on first drag move
    if (!dragStartPositions.current[nodeId]) {
      dragStartPositions.current[nodeId] = { x: node.x, y: node.y }
      // Store initial positions for all selected nodes
      if (selectedNodeIds.has(nodeId) && selectedNodeIds.size > 1) {
        selectedNodeIds.forEach(id => {
          const n = nodes[id]
          if (n && !dragStartPositions.current[id]) {
            dragStartPositions.current[id] = { x: n.x, y: n.y }
          }
        })
      }
    }
    
    setDraggingNodes(prev => ({
      ...prev,
      [nodeId]: { x, y }
    }))
    
    // If this node is selected and there are multiple selected nodes, move all selected nodes
    if (selectedNodeIds.has(nodeId) && selectedNodeIds.size > 1) {
      const startPos = dragStartPositions.current[nodeId]
      if (startPos) {
        // Calculate offset from initial position
        const offsetX = x - startPos.x
        const offsetY = y - startPos.y
        
        // Move all other selected nodes by the same offset
        selectedNodeIds.forEach(id => {
          if (id !== nodeId) {
            const otherStartPos = dragStartPositions.current[id]
            if (otherStartPos) {
              setDraggingNodes(prev => ({
                ...prev,
                [id]: { x: otherStartPos.x + offsetX, y: otherStartPos.y + offsetY }
              }))
            }
          }
        })
      }
    }
  }, [selectedNodeIds, nodes])

  // Wrapped handlers that save state before changes
  const handleNodeDragEnd = useCallback((nodeId: string, x: number, y: number) => {
    const node = nodes[nodeId]
    if (!node) return
    
    const startPos = dragStartPositions.current[nodeId]
    if (!startPos) return
    
    // Calculate offset from initial position
    const offsetX = x - startPos.x
    const offsetY = y - startPos.y
    
    // Clear dragging positions
    setDraggingNodes(prev => {
      const next = { ...prev }
      // Clear all selected nodes' dragging positions
      selectedNodeIds.forEach(id => {
        delete next[id]
      })
      return next
    })
    
    // Clear drag start positions
    selectedNodeIds.forEach(id => {
      delete dragStartPositions.current[id]
    })
    
    saveStateForUndo()
    
    // Move the dragged node
    moveNode(nodeId, x, y)
    
    // If multiple nodes selected, move all of them by the same offset
    if (selectedNodeIds.has(nodeId) && selectedNodeIds.size > 1) {
      selectedNodeIds.forEach(id => {
        if (id !== nodeId) {
          const otherStartPos = dragStartPositions.current[id]
          if (otherStartPos) {
            moveNode(id, otherStartPos.x + offsetX, otherStartPos.y + offsetY)
          }
        }
      })
    }
    
    markDirty()
  }, [saveStateForUndo, moveNode, markDirty, selectedNodeIds, nodes])

  const handleNodeResize = useCallback((nodeId: string, w: number, h: number) => {
    saveStateForUndo()
    resizeNode(nodeId, w, h)
    markDirty()
  }, [saveStateForUndo, resizeNode, markDirty])

  const handleToggleCollapse = useCallback((nodeId: string) => {
    saveStateForUndo()
    toggleCollapse(nodeId)
    markDirty()
  }, [saveStateForUndo, toggleCollapse, markDirty])

  const handleToggleTitleColor = useCallback((nodeId: string) => {
    saveStateForUndo()
    const node = nodes[nodeId]
    if (!node) return
    
    // Get current color index or default to 0
    const TITLE_COLORS = [
      theme.text,        // Default
      colors.blue,       // Blue
      colors.green,      // Green
      colors.yellow,     // Yellow
      colors.pink,
    ]
    
    const currentColor = node.titleColor || TITLE_COLORS[0]
    const currentIndex = TITLE_COLORS.indexOf(currentColor as typeof TITLE_COLORS[number])
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % TITLE_COLORS.length
    const nextColor = TITLE_COLORS[nextIndex]
    
    updateNode(nodeId, { titleColor: nextColor })
    markDirty()
  }, [nodes, updateNode, markDirty, saveStateForUndo])

  // Calculate editor position for the current editing node or edge
  const getEditorPosition = () => {
    if (!editing) return null
    
    // Handle edge label editing
    if (editing.edgeId) {
      const edge = edges[editing.edgeId]
      if (!edge) return null
      
      const fromNode = nodes[edge.from]
      const toNode = nodes[edge.to]
      if (!fromNode || !toNode) return null
      
      // Calculate midpoint of edge
      const effectiveFromNode = draggingNodes[edge.from] 
        ? { ...fromNode, x: draggingNodes[edge.from].x, y: draggingNodes[edge.from].y }
        : fromNode
      const effectiveToNode = draggingNodes[edge.to]
        ? { ...toNode, x: draggingNodes[edge.to].x, y: draggingNodes[edge.to].y }
        : toNode
      
      const [startX, startY, endX, endY] = getArrowPoints(effectiveFromNode, effectiveToNode)
      const midX = (startX + endX) / 2
      const midY = (startY + endY) / 2
      
      const midScreen = canvasToScreen(midX, midY)
      
      return {
        x: midScreen.x,
        y: midScreen.y,
        width: 150 * camera.scale,
        height: 24 * camera.scale,
        value: edge.label || '',
        fontSize: 10 * camera.scale,
        isTitle: false,
      }
    }
    
    // Handle node field editing
    if (editing.nodeId) {
      const node = nodes[editing.nodeId]
      if (!node) return null

      const isTitle = editing.field === 'title'
      
      // Get node position in screen coordinates
      const nodeScreen = canvasToScreen(node.x, node.y)
      
      // Calculate field position within node
      const fieldX = isTitle ? nodeLayout.titleX : nodeLayout.descriptionX
      const fieldY = isTitle ? nodeLayout.titleY : nodeLayout.descriptionY
      const fieldWidth = isTitle 
        ? node.width - nodeLayout.titleX - spacing[3]
        : node.width - spacing[3] * 2
      const fieldHeight = isTitle
        ? nodeLayout.titleHeight
        : node.height - nodeLayout.descriptionY - spacing[3]

      return {
        x: nodeScreen.x + fieldX * camera.scale,
        y: nodeScreen.y + fieldY * camera.scale + 32, // Account for titlebar
        width: fieldWidth * camera.scale,
        height: Math.max(fieldHeight * camera.scale, 24),
        value: isTitle ? node.title : node.description,
        fontSize: (isTitle ? typography.sizes.title : typography.sizes.description) * camera.scale,
        isTitle,
      }
    }
    
    return null
  }

  const editorPos = getEditorPosition()

  // Calculate temp edge endpoint (snapped or current)
  const tempEdgeEnd = useMemo(() => {
    if (!connectionDrag) return null
    
    if (connectionDrag.snappedX !== null && connectionDrag.snappedY !== null) {
      return {
        x: connectionDrag.snappedX,
        y: connectionDrag.snappedY,
        isSnapped: true,
      }
    }
    
    return {
      x: connectionDrag.currentX,
      y: connectionDrag.currentY,
      isSnapped: false,
    }
  }, [connectionDrag])

  return (
    <>
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        // Apply camera transform
        scaleX={camera.scale}
        scaleY={camera.scale}
        x={camera.x}
        y={camera.y}
        // Event handlers
        {...handlers}
        onClick={handleStageClick}
        onDblClick={handleDblClick}
        // onContextMenu={handleContextMenu}
      >
        {/* Edges layer (below nodes) */}
        <Layer>
          {edgeList.map((edge) => {
            const fromNode = nodes[edge.from]
            const toNode = nodes[edge.to]
            if (!fromNode || !toNode) return null
            
            return (
              <Edge
                key={edge.id}
                id={edge.id}
                fromNode={fromNode}
                toNode={toNode}
                label={edge.label}
                isSelected={edge.id === selectedEdgeId}
                onClick={() => handleEdgeClick(edge.id)}
                onDblClick={() => startEditingEdgeLabel(edge.id)}
                fromNodeVisualPos={draggingNodes[edge.from] || null}
                toNodeVisualPos={draggingNodes[edge.to] || null}
              />
            )
          })}
          
          {/* Temporary edge while dragging */}
          {connectionDrag && tempEdgeEnd && (
            <TempEdge
              startX={connectionDrag.startX}
              startY={connectionDrag.startY}
              endX={tempEdgeEnd.x}
              endY={tempEdgeEnd.y}
              isSnapped={tempEdgeEnd.isSnapped}
            />
          )}
        </Layer>

        {/* Nodes layer (above edges) */}
        <Layer>
          {nodeList.map((node) => (
            <Node 
              key={node.id} 
              {...node}
              isSelected={selectedNodeIds.has(node.id)}
              forceShowHandles={isDraggingConnection && node.id !== connectionDrag?.fromNodeId}
              visualPos={draggingNodes[node.id] || null}
              onClick={(e) => handleNodeClick(node.id, e)}
              onDragMove={(x, y) => handleNodeDragMove(node.id, x, y)}
              onDragEnd={(x, y) => handleNodeDragEnd(node.id, x, y)}
              onResize={(w, h) => handleNodeResize(node.id, w, h)}
              onEditTitle={() => startEditing(node.id, 'title')}
              onEditDescription={() => startEditing(node.id, 'description')}
              onToggleCollapse={() => handleToggleCollapse(node.id)}
              onToggleTitleColor={() => handleToggleTitleColor(node.id)}
              onConnectionStart={handleConnectionStart}
              onConnectionMove={handleConnectionMove}
              onConnectionEnd={handleConnectionEnd}
            />
          ))}
        </Layer>
      </Stage>

      {/* Text editor overlay */}
      {editing && editorPos && (
        <TextEditor
          x={editorPos.x}
          y={editorPos.y}
          width={editorPos.width}
          height={editorPos.height}
          value={editorPos.value}
          fontSize={editorPos.fontSize}
          isTitle={editorPos.isTitle}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      )}

      {/* Status bar overlay */}
      <StatusBar
        projectName={projectName}
        filePath={currentFilePath}
        isDirty={isDirty}
        nodeCount={nodeList.length}
        undoCount={undoCount}
        redoCount={redoCount}
      />
    </>
  )
}
