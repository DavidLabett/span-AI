import { useState, useCallback, useRef } from 'react'
import Konva from 'konva'

export interface Camera {
  x: number      // offset X (pan)
  y: number      // offset Y (pan)
  scale: number  // zoom level
}

interface UseCanvasOptions {
  minScale?: number
  maxScale?: number
  scaleStep?: number
}

const DEFAULT_OPTIONS: Required<UseCanvasOptions> = {
  minScale: 0.1,
  maxScale: 3,
  scaleStep: 1.1, // 10% zoom per scroll
}

export function useCanvas(options: UseCanvasOptions = {}) {
  const { minScale, maxScale, scaleStep } = { ...DEFAULT_OPTIONS, ...options }
  
  const [camera, setCamera] = useState<Camera>({
    x: 0,
    y: 0,
    scale: 1,
  })

  const stageRef = useRef<Konva.Stage>(null)
  const isPanning = useRef(false)
  const lastPointerPos = useRef({ x: 0, y: 0 })

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - camera.x) / camera.scale,
      y: (screenY - camera.y) / camera.scale,
    }
  }, [camera])

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = useCallback((canvasX: number, canvasY: number) => {
    return {
      x: canvasX * camera.scale + camera.x,
      y: canvasY * camera.scale + camera.y,
    }
  }, [camera])

  // Handle wheel zoom
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    
    const stage = stageRef.current
    if (!stage) return

    const pointer = stage.getPointerPosition()
    if (!pointer) return

    // Determine zoom direction
    const direction = e.evt.deltaY < 0 ? 1 : -1
    const newScale = direction > 0 
      ? Math.min(camera.scale * scaleStep, maxScale)
      : Math.max(camera.scale / scaleStep, minScale)

    // Zoom toward pointer position
    const mousePointTo = {
      x: (pointer.x - camera.x) / camera.scale,
      y: (pointer.y - camera.y) / camera.scale,
    }

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    }

    setCamera({
      x: newPos.x,
      y: newPos.y,
      scale: newScale,
    })
  }, [camera, minScale, maxScale, scaleStep])

  // Handle pan start (mouse down on empty canvas)
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Only pan if clicking on empty canvas (Stage itself)
    if (e.target === e.target.getStage()) {
      isPanning.current = true
      const pos = e.target.getStage()?.getPointerPosition()
      if (pos) {
        lastPointerPos.current = pos
      }
      // Change cursor
      const container = e.target.getStage()?.container()
      if (container) {
        container.style.cursor = 'grabbing'
      }
    }
  }, [])

  // Handle pan move
  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isPanning.current) return

    const stage = e.target.getStage()
    const pos = stage?.getPointerPosition()
    if (!pos) return

    const dx = pos.x - lastPointerPos.current.x
    const dy = pos.y - lastPointerPos.current.y

    setCamera(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }))

    lastPointerPos.current = pos
  }, [])

  // Handle pan end
  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    isPanning.current = false
    const container = e.target.getStage()?.container()
    if (container) {
      container.style.cursor = 'default'
    }
  }, [])

  // Handle mouse leave (stop panning if mouse leaves canvas)
  const handleMouseLeave = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPanning.current) {
      isPanning.current = false
      const container = e.target.getStage()?.container()
      if (container) {
        container.style.cursor = 'default'
      }
    }
  }, [])

  // Reset camera to origin
  const resetCamera = useCallback(() => {
    setCamera({ x: 0, y: 0, scale: 1 })
  }, [])

  // Set camera position directly (for loading saved state)
  const setCameraPosition = useCallback((newCamera: Partial<Camera>) => {
    setCamera(prev => ({ ...prev, ...newCamera }))
  }, [])

  return {
    camera,
    stageRef,
    handlers: {
      onWheel: handleWheel,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
    },
    screenToCanvas,
    canvasToScreen,
    resetCamera,
    setCameraPosition,
  }
}

