/**
 * Hook encapsulating the Ctrl+J demo import simulation.
 *
 * Flow:
 *   handleDemoImport()
 *     → file picker (JSON)
 *     → derive fake page count
 *     → setPdfPageSelection('__demo__')   ← triggers PDFPageSelectionModal in Canvas
 *
 *   onPageSelectionConfirm(pages)          ← called by Canvas when modal confirms
 *     → runDemoSimulation(project, pages)
 *       → fake OCR ticks  → fake AI ticks → loadProjectFromData + clearHistory
 *
 *   onPageSelectionCancel()                ← called by Canvas when modal cancels
 *     → clear pending demo data
 */

import { useState, useCallback, useRef } from 'react'
import { GenerationProgress } from './useAIGeneration'
import { Project } from '../types'

export const DEMO_SENTINEL = '__demo__'

interface UseDemoOptions {
  setOcrProgress: (
    progress: { message: string; current: number; total: number; percentage: number } | null
  ) => void
  setPdfPageSelection: (
    value: { pageCount: number; filePath: string } | null
  ) => void
  loadProjectFromData: (project: Project) => void
  clearHistory: () => void
}

export function useDemo({
  setOcrProgress,
  setPdfPageSelection,
  loadProjectFromData,
  clearHistory,
}: UseDemoOptions) {
  const [demoAIProgress, setDemoAIProgress] = useState<GenerationProgress | null>(null)
  const [pendingDemoData, setPendingDemoData] = useState<{ project: Project; pageCount: number } | null>(null)

  // Resolves when the user presses "Continue" on the complete screen
  const continueResolveRef = useRef<(() => void) | null>(null)

  /** Called by Canvas's AIGenerationModal onClose when demoAIProgress.step === 'complete'. */
  const onDemoComplete = useCallback(() => {
    continueResolveRef.current?.()
    continueResolveRef.current = null
  }, [])

  const runDemoSimulation = useCallback(
    async (project: Project, pages: number[]) => {
      const nodeCount = Math.max(1, Object.keys(project.nodes).length)
      const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

      // OCR phase — tick through the pages the user selected
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        setOcrProgress({
          message: `Extracting text from page ${page}...`,
          current: i + 1,
          total: pages.length,
          percentage: Math.round(((i + 1) / pages.length) * 100),
        })
        await delay(10000)
      }
      setOcrProgress(null)

      // AI generation phase
      setDemoAIProgress({ step: 'analyzing', message: 'Analyzing document structure...', progress: 10 })
      await delay(6000)
      setDemoAIProgress({ step: 'analyzing', message: 'Sending request to LLM...', progress: 30 })
      await delay(3000)
      setDemoAIProgress({
        step: 'generating',
        message: `Generating nodes 0 / ${nodeCount}`,
        progress: 50,
        nodesGenerated: 0,
        totalNodesToGenerate: nodeCount,
      })
      await delay(5000)
      const BATCH_SIZE = 5
      for (let n = BATCH_SIZE; n <= nodeCount + BATCH_SIZE - 1; n += BATCH_SIZE) {
        const generated = Math.min(n, nodeCount)
        setDemoAIProgress({
          step: 'generating',
          message: `Generating nodes ${generated} / ${nodeCount}`,
          progress: Math.round(50 + (generated / nodeCount) * 45),
          nodesGenerated: generated,
          totalNodesToGenerate: nodeCount,
        })
        await delay(3500)
      }
      setDemoAIProgress({
        step: 'complete',
        message: 'Generation complete',
        progress: 100,
        nodesGenerated: nodeCount,
        totalNodesToGenerate: nodeCount,
        stats: { totalNodes: nodeCount, maxDepth: 2, nodeCountByLevel: {} },
      })

      // Wait for the user to press "Continue" in the modal
      await new Promise<void>(resolve => {
        continueResolveRef.current = resolve
      })

      setDemoAIProgress(null)
      loadProjectFromData(project)
      clearHistory()
    },
    [setOcrProgress, loadProjectFromData, clearHistory]
  )

  /** Open file picker, load the JSON, then show the page selection modal. */
  const handleDemoImport = useCallback(async () => {
    const filePath = await window.electronAPI.showOpenDialog()
    if (!filePath) return

    const result = await window.electronAPI.loadProject(filePath)
    if (!result.success || !result.data) {
      alert('Failed to load demo file')
      return
    }

    const project = result.data as Project
    const nodeCount = Math.max(1, Object.keys(project.nodes).length)
    const fakePageCount = Math.max(3, Math.ceil(nodeCount * 1.5))

    setPendingDemoData({ project, pageCount: fakePageCount })
    setPdfPageSelection({ pageCount: fakePageCount, filePath: DEMO_SENTINEL })
  }, [setPdfPageSelection])

  /** Called by Canvas's handlePageSelectionConfirm when filePath === DEMO_SENTINEL. */
  const onDemoPageSelectionConfirm = useCallback(
    (pages: number[]) => {
      if (!pendingDemoData) return
      const { project } = pendingDemoData
      setPendingDemoData(null)
      runDemoSimulation(project, pages)
    },
    [pendingDemoData, runDemoSimulation]
  )

  /** Called by Canvas's handlePageSelectionCancel to clean up demo state. */
  const onDemoPageSelectionCancel = useCallback(() => {
    setPendingDemoData(null)
  }, [])

  const isDemoMode = pendingDemoData !== null

  return {
    demoAIProgress,
    setDemoAIProgress,
    handleDemoImport,
    onDemoComplete,
    onDemoPageSelectionConfirm,
    onDemoPageSelectionCancel,
    isDemoMode,
  }
}
