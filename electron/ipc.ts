import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import { readdir, stat } from 'fs/promises';
import fs from 'fs/promises';
import path from 'path';

const CONFIG_FILE_NAME = 'config.json';

const getConfigPath = () => {
    return path.join(app.getPath('userData'), CONFIG_FILE_NAME);
}

const getDefaultProjectsPath = () => {
    return path.join(app.getPath('documents'), 'Span');
}

const getProjectsPath = async (): Promise<string> => {
    try {
        const configPath = getConfigPath();
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        if (config.projectsPath && typeof config.projectsPath === 'string') {
            return config.projectsPath;
        }
    } catch (err) {
        // Config file doesn't exist or is invalid, use default
    }
    return getDefaultProjectsPath();
}

const setProjectsPath = async (projectsPath: string): Promise<void> => {
    const configPath = getConfigPath();
    let config: any = {};
    try {
        const configContent = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(configContent);
    } catch (err) {
        // Config file doesn't exist, start with empty config
    }
    config.projectsPath = projectsPath;
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

const ensureDir = async (dirPath: string) => {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        // Ignore if already exists
    }
}

// Setup IPC endpoints (handlers)
export function registerIpcHandlers() {
    // Save project to file
    ipcMain.handle('save-project', async (_event, { filePath, data }) => {
        try {
            await ensureDir(path.dirname(filePath));
            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
            return { success: true }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })
        // Load project from file
    ipcMain.handle('load-project', async (_event, filePath: string)=> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return { success: true, data: JSON.parse(content) }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })
    // Show save dialog
    ipcMain.handle('show-save-dialog', async ()=> {
        const projectsPath = await getProjectsPath();
        const result = await dialog.showSaveDialog({
            defaultPath: path.join(projectsPath, 'untitled.json'),
            filters: [{ name: 'Span Project', extensions: ['json'] }],
        })
        return result.canceled ? null : result.filePath
    })
    // Show save image dialog
    ipcMain.handle('show-save-image-dialog', async () => {
        const projectsPath = await getProjectsPath();
        const result = await dialog.showSaveDialog({
            defaultPath: path.join(projectsPath, 'export.png'),
            filters: [
                { name: 'PNG Image', extensions: ['png'] },
                { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
            ],
        })
        return result.canceled ? null : result.filePath
    })
    
    // Save image file
    ipcMain.handle('save-image', async (_event, { filePath, imageData }) => {
        try {
            // Remove data URL prefix (e.g., "data:image/png;base64,")
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
            const buffer = Buffer.from(base64Data, 'base64')
            await fs.writeFile(filePath, buffer)
            return { success: true }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })
    
    // Show Open Dialog
    ipcMain.handle('show-open-dialog', async ()=> {
        const projectsPath = await getProjectsPath();
        const result = await dialog.showOpenDialog({
            defaultPath: projectsPath,
            filters: [{ name: 'Span Project', extensions: ['json'] }],
            properties: ['openFile'],
        })
        return result.canceled ? null : result.filePaths[0]
    })

    ipcMain.handle('list-recent-projects', async () => {
        try {
            const projectsPath = await getProjectsPath();
            await ensureDir(projectsPath);
            
            const files = await readdir(projectsPath);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            
            const projects = await Promise.all(
            jsonFiles.map(async (file) => {
                const filePath = path.join(projectsPath, file);
                const stats = await stat(filePath);
                const content = await fs.readFile(filePath, 'utf-8');
                const project = JSON.parse(content);
                
                // Use filename if name is "Untitled" or missing
                const projectName = project.meta?.name;
                const fileName = path.basename(file, '.json');
                const displayName = (projectName && projectName !== 'Untitled') 
                    ? projectName 
                    : fileName;
                
                return {
                name: displayName,
                filePath,
                modified: stats.mtime.toISOString(),
                created: project.meta?.created || stats.birthtime.toISOString(),
                };
            })
            );
            
            // Sort by modified date (most recent first), limit to 5
            return projects
            .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
            .slice(0, 5);
        } catch (error) {
            return [];
        }
    });

    // Window controls
    ipcMain.handle('window-minimize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            win.minimize();
        }
        return;
    });

    ipcMain.handle('window-maximize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            if (win.isMaximized()) {
                win.unmaximize();
            } else {
                win.maximize();
            }
        }
        return;
    });

    ipcMain.handle('window-close', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            win.close();
        }
        return;
    });

    // Get projects path
    ipcMain.handle('get-projects-path', async () => {
        return await getProjectsPath();
    });

    // Set projects path
    ipcMain.handle('set-projects-path', async (_event, projectsPath: string) => {
        try {
            await setProjectsPath(projectsPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    // Show folder selection dialog
    ipcMain.handle('show-select-folder-dialog', async () => {
        const currentPath = await getProjectsPath();
        const result = await dialog.showOpenDialog({
            defaultPath: currentPath,
            properties: ['openDirectory'],
        });
        return result.canceled ? null : result.filePaths[0];
    });
}