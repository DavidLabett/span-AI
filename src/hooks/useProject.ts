import { useState, useCallback } from 'react'
import { Project, NodeMap, EdgeMap } from '../types'
import { Camera } from './useCanvas'

interface UseProjectOptions {
  nodes: NodeMap
  edges: EdgeMap
  camera: Camera
  setAllNodes: (nodes: NodeMap) => void
  setAllEdges: (edges: EdgeMap) => void
  setCameraPosition: (camera: Partial<Camera>) => void
}

export function useProject({
  nodes,
  edges,
  camera,
  setAllNodes,
  setAllEdges,
  setCameraPosition,
}: UseProjectOptions) {
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [projectName, setProjectName] = useState('Untitled')

  // Check for unsaved changes before destructive action
  const checkUnsavedChanges = useCallback((): boolean => {
    if (!isDirty) return true
    
    return window.confirm(
      'You have unsaved changes. Do you want to continue without saving?'
    )
  }, [isDirty])

  // Build project data object
  const buildProjectData = useCallback((): Project => {
    return {
      meta: {
        name: projectName,
        created: new Date().toISOString(),
        canvas: {
          zoom: camera.scale,
          x: camera.x,
          y: camera.y,
        },
      },
      nodes,
      edges,
    }
  }, [projectName, camera, nodes, edges])

  // Save to current file or prompt for new file
  const save = useCallback(async () => {
    let filePath = currentFilePath

    if (!filePath) {
      filePath = await window.electronAPI.showSaveDialog()
      if (!filePath) return false // User cancelled
    }

    const result = await window.electronAPI.saveProject(filePath, buildProjectData())
    
    if (result.success) {
      setCurrentFilePath(filePath)
      setIsDirty(false)
      return true
    }
    
    console.error('Save failed:', result.error)
    return false
  }, [currentFilePath, buildProjectData])

  // Save As (always prompt for new file)
  const saveAs = useCallback(async () => {
    const filePath = await window.electronAPI.showSaveDialog()
    if (!filePath) return false

    const result = await window.electronAPI.saveProject(filePath, buildProjectData())
    
    if (result.success) {
      setCurrentFilePath(filePath)
      setIsDirty(false)
      return true
    }
    
    return false
  }, [buildProjectData])

  // Load a project by file path (used when opening from WelcomeScreen)
  const loadProjectByPath = useCallback(async (filePath: string) => {
    const result = await window.electronAPI.loadProject(filePath)
    
    if (result.success && result.data) {
      const project = result.data as Project
      
      // Restore state
      setAllNodes(project.nodes)
      setAllEdges(project.edges)
      setCameraPosition({
        x: project.meta.canvas.x,
        y: project.meta.canvas.y,
        scale: project.meta.canvas.zoom,
      })
      setProjectName(project.meta.name)
      setCurrentFilePath(filePath)
      setIsDirty(false)
      
      return true
    }
    
    console.error('Load failed:', result.error)
    return false
  }, [setAllNodes, setAllEdges, setCameraPosition])

  // Open a project file (shows dialog)
  const open = useCallback(async () => {
    // Check for unsaved changes first
    if (!checkUnsavedChanges()) return false
    
    const filePath = await window.electronAPI.showOpenDialog()
    if (!filePath) return false

    return loadProjectByPath(filePath)
  }, [checkUnsavedChanges, loadProjectByPath])

  // Create new project
  const newProject = useCallback(() => {
    // Check for unsaved changes first
    if (!checkUnsavedChanges()) return false
    
    setAllNodes({})
    setAllEdges({})
    setCameraPosition({ x: 0, y: 0, scale: 1 })
    setProjectName('Untitled')
    setCurrentFilePath(null)
    setIsDirty(false)
    
    return true
  }, [checkUnsavedChanges, setAllNodes, setAllEdges, setCameraPosition])

  // Mark as dirty when changes occur
  const markDirty = useCallback(() => {
    setIsDirty(true)
  }, [])

  return {
    currentFilePath,
    isDirty,
    projectName,
    save,
    saveAs,
    open,
    loadProjectByPath,
    newProject,
    markDirty,
    setProjectName,
  }
}
