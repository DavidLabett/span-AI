import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import { readdir, stat } from 'fs/promises';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';

const CONFIG_FILE_NAME = 'config.json';

const getConfigPath = () => {
    return path.join(app.getPath('userData'), CONFIG_FILE_NAME);
}

const getConfig = async (): Promise<any> => {
    try {
        const configPath = getConfigPath();
        const configContent = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(configContent);
    } catch (err) {
        return {};
    }
}

const setConfig = async (config: any): Promise<void> => {
    const configPath = getConfigPath();
    const existingConfig = await getConfig();
    const mergedConfig = { ...existingConfig, ...config };
    await fs.writeFile(configPath, JSON.stringify(mergedConfig, null, 2), 'utf-8');
}

// Helper to make HTTP requests in Node.js (main process)
const httpRequest = (url: string, options: { method?: string; body?: string; headers?: Record<string, string> } = {}): Promise<{ status: number; data: any }> => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        };

        const req = http.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode || 200, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode || 200, data: data });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
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
    ipcMain.handle('load-project', async (_event, filePath: string) => {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return { success: true, data: JSON.parse(content) }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })
    // Show save dialog
    ipcMain.handle('show-save-dialog', async () => {
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
    ipcMain.handle('show-open-dialog', async () => {
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

    // Show document import dialog (PDF, text, markdown)
    ipcMain.handle('show-import-document-dialog', async () => {
        const result = await dialog.showOpenDialog({
            filters: [
                { name: 'Documents', extensions: ['pdf', 'txt', 'md'] },
                { name: 'PDF Files', extensions: ['pdf'] },
                { name: 'Text Files', extensions: ['txt'] },
                { name: 'Markdown Files', extensions: ['md'] },
                { name: 'All Files', extensions: ['*'] },
            ],
            properties: ['openFile'],
        });
        return result.canceled ? null : result.filePaths[0];
    });

    // Read document file content
    ipcMain.handle('read-document-file', async (_event, filePath: string) => {
        try {
            // Check if file exists
            try {
                await fs.access(filePath);
            } catch (accessError) {
                return {
                    success: false,
                    error: `File not found or not accessible: ${filePath}`
                };
            }

            // Read file with UTF-8 encoding
            const content = await fs.readFile(filePath, 'utf-8');
            const ext = path.extname(filePath).toLowerCase();

            if (!content || content.length === 0) {
                return {
                    success: false,
                    error: 'File is empty'
                };
            }

            return { success: true, content, extension: ext, filePath };
        } catch (error) {
            console.error('Error reading document file:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: `Failed to read file: ${errorMessage}`
            };
        }
    });

    // Extract text from PDF file (runs in main process)
    ipcMain.handle('extract-pdf-text', async (_event, filePath: string) => {
        try {
            // Use pdf2json which is designed for Node.js and doesn't require DOM APIs
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const PDFParser = require('pdf2json');

            return new Promise((resolve) => {
                const pdfParser = new PDFParser(null, 1);

                // Set up event handlers
                pdfParser.on('pdfParser_dataError', (errData: any) => {
                    console.error('PDF parsing error:', errData);
                    resolve({
                        success: false,
                        error: `PDF parsing error: ${errData.parserError || 'Unknown error'}`,
                    });
                });

                pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
                    try {
                        // Extract text with structure information from all pages
                        let fullText = '';
                        const pages = pdfData.Pages || [];
                        const textItems: Array<{
                            text: string;
                            fontSize: number;
                            isBold: boolean;
                            y: number;
                            x: number;
                            pageNumber: number;
                        }> = [];

                        pages.forEach((page: any, pageIndex: number) => {
                            if (page.Texts && Array.isArray(page.Texts)) {
                                page.Texts.forEach((textItem: any) => {
                                    // Extract text from all runs
                                    const textRuns = textItem.R || [];
                                    let combinedText = '';
                                    let maxFontSize = 0;
                                    let hasBold = false;

                                    textRuns.forEach((run: any) => {
                                        const rawText = run.T || '';
                                        try {
                                            const decodedText = decodeURIComponent(rawText);
                                            combinedText += decodedText;
                                        } catch {
                                            combinedText += rawText;
                                        }

                                        // Extract font size (S property often contains font size)
                                        // sw (stroke width) can also indicate font size
                                        const fontSize = run.S || textItem.sw || 12;
                                        if (fontSize > maxFontSize) {
                                            maxFontSize = fontSize;
                                        }

                                        // Check for bold (TS array or font name containing "Bold")
                                        // TS[0] is often font size, TS[1] might be font name or style info
                                        if (run.TS && Array.isArray(run.TS) && run.TS.length > 1) {
                                            const styleInfo = run.TS[1];
                                            if (typeof styleInfo === 'string' && styleInfo.includes('Bold')) {
                                                hasBold = true;
                                            } else if (typeof styleInfo === 'object' && styleInfo) {
                                                // Sometimes TS[1] is an object with font info
                                                const fontName = styleInfo.fontName || styleInfo.F || '';
                                                if (typeof fontName === 'string' && fontName.includes('Bold')) {
                                                    hasBold = true;
                                                }
                                            }
                                        }

                                        // Also check textItem level bold indicators
                                        if (textItem.sw && textItem.sw > 14) {
                                            hasBold = true; // Heuristic: larger stroke width might indicate bold
                                        }
                                    });

                                    if (combinedText.trim().length > 0) {
                                        textItems.push({
                                            text: combinedText,
                                            fontSize: maxFontSize || textItem.sw || 12,
                                            isBold: hasBold || (textItem.sw && textItem.sw > 14), // Heuristic: larger stroke width might indicate bold
                                            y: textItem.y || 0,
                                            x: textItem.x || 0,
                                            pageNumber: pageIndex + 1,
                                        });
                                    }
                                });

                                // Also create simple text version for backward compatibility
                                const pageText = page.Texts
                                    .map((text: any) => {
                                        const rawText = text.R?.[0]?.T || '';
                                        try {
                                            return decodeURIComponent(rawText);
                                        } catch {
                                            return rawText;
                                        }
                                    })
                                    .join(' ');
                                fullText += pageText + '\n\n';
                            }
                        });

                        resolve({
                            success: true,
                            text: fullText.trim(),
                            textItems: textItems, // Include structured data
                            pageCount: pages.length,
                            metadata: {
                                title: pdfData.Meta?.Title,
                                author: pdfData.Meta?.Author,
                                subject: pdfData.Meta?.Subject,
                            },
                            filePath,
                        });
                    } catch (error) {
                        console.error('Error processing PDF data:', error);
                        resolve({
                            success: false,
                            error: error instanceof Error ? error.message : String(error),
                        });
                    }
                });

                // Load and parse the PDF file
                pdfParser.loadPDF(filePath);
            });
        } catch (error) {
            console.error('PDF extraction error:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            return {
                success: false,
                error: errorMessage,
                stack: errorStack,
            };
        }
    });

    // Check if Ollama is running
    ipcMain.handle('ai-check-ollama', async (_event, baseUrl?: string) => {
        try {
            const url = baseUrl || 'http://localhost:11434';
            const result = await httpRequest(`${url}/api/tags`);
            return {
                success: result.status === 200,
                running: result.status === 200,
                error: result.status !== 200 ? `Ollama returned status ${result.status}` : undefined,
            };
        } catch (error) {
            return {
                success: false,
                running: false,
                error: error instanceof Error ? error.message : 'Failed to connect to Ollama',
            };
        }
    });

    // Check if a specific model is available
    ipcMain.handle('ai-check-model', async (_event, model: string, baseUrl?: string) => {
        try {
            const url = baseUrl || 'http://localhost:11434';
            const result = await httpRequest(`${url}/api/tags`);

            if (result.status !== 200) {
                return {
                    success: false,
                    available: false,
                    error: `Failed to fetch models: ${result.status}`,
                };
            }

            const models = result.data.models?.map((m: any) => m.name) || [];
            const available = models.includes(model) || models.some((m: string) => m.startsWith(model + ':'));

            return {
                success: true,
                available,
                models,
                error: available ? undefined : `Model '${model}' not found. Available models: ${models.join(', ')}`,
            };
        } catch (error) {
            return {
                success: false,
                available: false,
                error: error instanceof Error ? error.message : 'Failed to check model availability',
            };
        }
    });

    // Get AI/LLM configuration
    ipcMain.handle('ai-get-config', async () => {
        try {
            const config = await getConfig();
            return {
                success: true,
                config: {
                    baseUrl: config.ai?.baseUrl || 'http://localhost:11434',
                    model: config.ai?.model || 'Gemma3:1b',
                },
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get config',
            };
        }
    });

    // Set AI/LLM configuration
    ipcMain.handle('ai-set-config', async (_event, config: { baseUrl?: string; model?: string }) => {
        try {
            await setConfig({
                ai: {
                    baseUrl: config.baseUrl || 'http://localhost:11434',
                    model: config.model || 'Gemma3:1b',
                },
            });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to set config',
            };
        }
    });

    // Call Ollama API (main generation endpoint - will be used in Phase 3)
    ipcMain.handle('ai-call-llm', async (_event, prompt: string, baseUrl?: string, model?: string) => {
        try {
            const config = await getConfig();
            const url = baseUrl || config.ai?.baseUrl || 'http://localhost:11434';
            const modelName = model || config.ai?.model || 'Gemma3:1b';

            const result = await httpRequest(`${url}/api/generate`, {
                method: 'POST',
                body: JSON.stringify({
                    model: modelName,
                    prompt: prompt,
                    stream: false,
                }),
            });

            if (result.status !== 200) {
                return {
                    success: false,
                    error: result.data.error || `Ollama API error: ${result.status}`,
                };
            }

            if (!result.data.response) {
                return {
                    success: false,
                    error: 'Empty response from Ollama',
                };
            }

            return {
                success: true,
                response: result.data.response.trim(),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to call Ollama',
            };
        }
    });
}