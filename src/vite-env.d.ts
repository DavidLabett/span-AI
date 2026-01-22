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
}

interface Window {
  electronAPI: ElectronAPI
}
