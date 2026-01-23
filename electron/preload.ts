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

  extractPDFText: (filePath: string) =>
    ipcRenderer.invoke('extract-pdf-text', filePath),

  // Ollama/LLM API
  aiCheckOllama: (baseUrl?: string) =>
    ipcRenderer.invoke('ai-check-ollama', baseUrl),

  aiCheckModel: (model: string, baseUrl?: string) =>
    ipcRenderer.invoke('ai-check-model', model, baseUrl),

  aiGetConfig: () =>
    ipcRenderer.invoke('ai-get-config'),

  aiSetConfig: (config: { baseUrl?: string; model?: string }) =>
    ipcRenderer.invoke('ai-set-config', config),

  aiCallLLM: (prompt: string, baseUrl?: string, model?: string) =>
    ipcRenderer.invoke('ai-call-llm', prompt, baseUrl, model),
})

