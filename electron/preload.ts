import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  saveProject: (filePath: string, data: unknown) =>
    ipcRenderer.invoke('save-project', { filePath, data }),

  loadProject: (filePath: string) =>
    ipcRenderer.invoke('load-project', filePath),

  showSaveDialog: () =>
    ipcRenderer.invoke('show-save-dialog'),

  showOpenDialog: () =>
    ipcRenderer.invoke('show-open-dialog'),

  listRecentProjects: () =>
    ipcRenderer.invoke('list-recent-projects'),

  showSaveImageDialog: () =>
    ipcRenderer.invoke('show-save-image-dialog'),

  saveImage: (filePath: string, imageData: string) =>
    ipcRenderer.invoke('save-image', { filePath, imageData }),

  windowMinimize: () =>
    ipcRenderer.invoke('window-minimize'),

  windowMaximize: () =>
    ipcRenderer.invoke('window-maximize'),

  windowClose: () =>
    ipcRenderer.invoke('window-close'),

  getProjectsPath: () =>
    ipcRenderer.invoke('get-projects-path'),

  setProjectsPath: (projectsPath: string) =>
    ipcRenderer.invoke('set-projects-path', projectsPath),

  showSelectFolderDialog: () =>
    ipcRenderer.invoke('show-select-folder-dialog'),

  showImportDocumentDialog: () =>
    ipcRenderer.invoke('show-import-document-dialog'),

  readDocumentFile: (filePath: string) =>
    ipcRenderer.invoke('read-document-file', filePath),

  getPDFPageCount: (filePath: string) =>
    ipcRenderer.invoke('get-pdf-page-count', filePath),

  // Ollama/LLM API
  aiCheckOllama: (baseUrl?: string) =>
    ipcRenderer.invoke('ai-check-ollama', baseUrl),

  aiCheckModel: (model: string, baseUrl?: string) =>
    ipcRenderer.invoke('ai-check-model', model, baseUrl),

  aiGetConfig: () =>
    ipcRenderer.invoke('ai-get-config'),

  aiSetConfig: (config: { baseUrl?: string; model?: string }) =>
    ipcRenderer.invoke('ai-set-config', config),

  aiCallLLM: (prompt: string, baseUrl?: string, model?: string, maxTokens?: number) =>
    ipcRenderer.invoke('ai-call-llm', prompt, baseUrl, model, maxTokens),

  // OCR API
  aiCallOCR: (imagePath: string, prompt?: string, baseUrl?: string) =>
    ipcRenderer.invoke('ai-call-ocr', imagePath, prompt, baseUrl),

  convertPDFPageToImage: (pdfPath: string, pageNumber: number, outputDir: string) =>
    ipcRenderer.invoke('convert-pdf-page-to-image', pdfPath, pageNumber, outputDir),

  analyzePDFWithOCR: (pdfPath: string, baseUrl?: string, selectedPages?: number[]) =>
    ipcRenderer.invoke('analyze-pdf-with-ocr', pdfPath, baseUrl, selectedPages),

  // Listen for OCR progress events
  onOCRProgress: (callback: (progress: { message: string; current: number; total: number; percentage: number }) => void) => {
    ipcRenderer.on('ocr-progress', (_event, progress) => callback(progress));
    // Return cleanup function
    return () => {
      ipcRenderer.removeAllListeners('ocr-progress');
    };
  },
})

