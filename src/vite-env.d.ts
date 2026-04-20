/// <reference types="vite/client" />

interface RecentProject {
  name: string;
  filePath: string;
  modified: string;
  created: string;
}

interface ElectronAPI {
  saveProject: (filePath: string, data: unknown) => Promise<{ success: boolean; error?: string }>
  loadProject: (filePath: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
  showSaveDialog: () => Promise<string | null>
  showOpenDialog: () => Promise<string | null>
  listRecentProjects: () => Promise<RecentProject[]>
  showSaveImageDialog: () => Promise<string | null>
  saveImage: (filePath: string, imageData: string) => Promise<{ success: boolean; error?: string }>
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  getProjectsPath: () => Promise<string>
  setProjectsPath: (projectsPath: string) => Promise<{ success: boolean; error?: string }>
  showSelectFolderDialog: () => Promise<string | null>
  showImportDocumentDialog: () => Promise<string | null>
  readDocumentFile: (filePath: string) => Promise<{ success: boolean; content?: string; extension?: string; filePath?: string; error?: string }>
  getPDFPageCount: (filePath: string) => Promise<{ success: boolean; pageCount?: number; error?: string }>
  // Ollama/LLM API
  aiCheckOllama: (baseUrl?: string) => Promise<{ success: boolean; running: boolean; error?: string }>
  aiCheckModel: (model: string, baseUrl?: string) => Promise<{ success: boolean; available: boolean; models?: string[]; error?: string }>
  aiGetConfig: () => Promise<{ success: boolean; config?: { baseUrl: string; model: string }; error?: string }>
  aiSetConfig: (config: { baseUrl?: string; model?: string }) => Promise<{ success: boolean; error?: string }>
  aiCallLLM: (prompt: string, baseUrl?: string, model?: string, maxTokens?: number) => Promise<{ success: boolean; response?: string; error?: string }>
  // OCR API
  aiCallOCR: (imagePath: string, prompt?: string, baseUrl?: string) => Promise<{ success: boolean; response?: string; error?: string }>
  convertPDFPageToImage: (pdfPath: string, pageNumber: number, outputDir: string) => Promise<{ success: boolean; imagePath?: string; error?: string }>
  analyzePDFWithOCR: (pdfPath: string, baseUrl?: string, selectedPages?: number[]) => Promise<{ 
    success: boolean
    text?: string
    pageCount?: number
    processedPages?: number
    selectedPages?: number
    errors?: string[]
    error?: string
  }>
  onOCRProgress: (callback: (progress: { message: string; current: number; total: number; percentage: number }) => void) => () => void
}

interface Window {
  electronAPI: ElectronAPI
}
