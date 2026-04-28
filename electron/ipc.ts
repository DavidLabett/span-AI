import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import { readdir, stat } from 'fs/promises';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';

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

    // Get page count from a PDF file (lightweight — no text extraction)
    ipcMain.handle('get-pdf-page-count', async (_event, filePath: string) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const PDFParser = require('pdf2json');

            return new Promise((resolve) => {
                const pdfParser = new PDFParser(null, 1);

                pdfParser.on('pdfParser_dataError', (errData: any) => {
                    resolve({
                        success: false,
                        error: `PDF parsing error: ${errData.parserError || 'Unknown error'}`,
                    });
                });

                pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
                    resolve({
                        success: true,
                        pageCount: (pdfData.Pages || []).length,
                    });
                });

                pdfParser.loadPDF(filePath);
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: errorMessage,
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
    ipcMain.handle('ai-call-llm', async (_event, prompt: string, baseUrl?: string, model?: string, maxTokens?: number) => {
        try {
            const config = await getConfig();
            const url = baseUrl || config.ai?.baseUrl || 'http://localhost:11434';
            const modelName = model || config.ai?.model || 'Gemma3:1b';

            const body: Record<string, unknown> = {
                model: modelName,
                prompt: prompt,
                stream: false,
            };
            if (maxTokens !== undefined) {
                body.options = { num_predict: maxTokens };
            }

            const result = await httpRequest(`${url}/api/generate`, {
                method: 'POST',
                body: JSON.stringify(body),
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

    // Call DeepSeek-OCR with image (base64 encoded)
    ipcMain.handle('ai-call-ocr', async (_event, imagePath: string, prompt?: string, baseUrl?: string) => {
        try {
            const config = await getConfig();
            const url = baseUrl || config.ai?.baseUrl || 'http://localhost:11434';

            // Read image file and convert to base64
            const imageBuffer = await fs.readFile(imagePath);

            // Ensure it's a proper Buffer before converting
            const buffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
            const imageBase64 = buffer.toString('base64');

            // Validate base64 format
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            if (!base64Regex.test(imageBase64)) {
                return {
                    success: false,
                    error: 'Invalid base64 encoding detected',
                };
            }

            // DeepSeek-OCR uses /api/chat endpoint with images
            // According to Ollama docs, images should be base64 strings (not data URLs)
            const ocrPrompt = prompt || '<|grounding|>Convert the document to markdown preserving structure.';

            const result = await httpRequest(`${url}/api/chat`, {
                method: 'POST',
                body: JSON.stringify({
                    model: 'deepseek-ocr:3b',
                    messages: [
                        {
                            role: 'user',
                            content: ocrPrompt,
                            images: [imageBase64], // Just the base64 string, no data URL prefix
                        },
                    ],
                    stream: false,
                }),
            });

            if (result.status !== 200) {
                return {
                    success: false,
                    error: result.data.error || `Ollama API error: ${result.status}`,
                };
            }

            if (!result.data.message?.content) {
                return {
                    success: false,
                    error: 'Empty response from DeepSeek-OCR',
                };
            }

            return {
                success: true,
                response: result.data.message.content.trim(),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to call DeepSeek-OCR',
            };
        }
    });

    // Convert PDF page to image using Python pdf2image
    ipcMain.handle('convert-pdf-page-to-image', async (_event, pdfPath: string, pageNumber: number, outputDir: string) => {
        try {
            await fs.mkdir(outputDir, { recursive: true });
            const outputPath = path.join(outputDir, `page-${pageNumber}.png`);

            return new Promise((resolve) => {
                const python = process.platform === 'win32' ? 'python' : 'python3';
                // Try to find poppler path from common locations
                const script = `import sys
import os
from pdf2image import convert_from_path
from PIL import Image

pdf_path = sys.argv[1]
page_num = int(sys.argv[2])
output_path = sys.argv[3]

# Try to find poppler path
poppler_path = None
if len(sys.argv) > 4 and sys.argv[4]:
    poppler_path = sys.argv[4]
else:
    # Check common Windows locations
    common_paths = [
        r'C:\Program Files\poppler-25.12.0\Library\bin',  # User's specific installation
        os.path.join(os.environ.get('LOCALAPPDATA', ''), 'poppler', 'Library', 'bin'),
        os.path.join('C:', 'poppler', 'Library', 'bin'),
        os.path.join('C:', 'Program Files', 'poppler', 'Library', 'bin'),
        os.path.join('C:', 'Program Files', 'poppler-25.12.0', 'Library', 'bin'),
        os.path.join(os.environ.get('USERPROFILE', ''), 'poppler', 'Library', 'bin'),
    ]
    for p in common_paths:
        if os.path.exists(p) and os.path.exists(os.path.join(p, 'pdftoppm.exe')):
            poppler_path = p
            break

try:
    if poppler_path:
        images = convert_from_path(pdf_path, first_page=page_num, last_page=page_num, dpi=200, poppler_path=poppler_path)
    else:
        images = convert_from_path(pdf_path, first_page=page_num, last_page=page_num, dpi=200)
    if images:
        images[0].save(output_path, 'PNG')
        print(output_path)
    else:
        sys.exit(1)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;

                const tempScriptPath = path.join(app.getPath('temp'), `pdf2img-${Date.now()}.py`);

                // Try to find poppler path - check common locations
                let popplerPath = '';
                const commonPaths = [
                    'C:\\Program Files\\poppler-25.12.0\\Library\\bin', // User's specific installation
                    path.join(process.env.LOCALAPPDATA || '', 'poppler', 'Library', 'bin'),
                    path.join('C:', 'poppler', 'Library', 'bin'),
                    path.join('C:', 'Program Files', 'poppler', 'Library', 'bin'),
                    path.join('C:', 'Program Files', 'poppler-25.12.0', 'Library', 'bin'),
                    path.join(process.env.USERPROFILE || '', 'poppler', 'Library', 'bin'),
                ];

                // Check if any common path exists
                const fsSync = require('fs');
                for (const p of commonPaths) {
                    try {
                        const pdftoppmPath = path.join(p, 'pdftoppm.exe');
                        if (fsSync.existsSync(pdftoppmPath)) {
                            popplerPath = p;
                            console.log(`Found Poppler at: ${popplerPath}`);
                            break;
                        }
                    } catch {
                        // Continue checking
                    }
                }
                if (!popplerPath) {
                    console.log('Poppler not found in common paths, will try PATH or let Python script find it');
                }

                fs.writeFile(tempScriptPath, script).then(() => {
                    const args = [tempScriptPath, pdfPath, pageNumber.toString(), outputPath];
                    if (popplerPath) {
                        args.push(popplerPath);
                    }
                    const process = spawn(python, args, { windowsHide: true });

                    let errorOutput = '';
                    process.stderr.on('data', (data) => {
                        errorOutput += data.toString();
                    });

                    process.on('close', async (code) => {
                        // Clean up temp script
                        try {
                            await fs.unlink(tempScriptPath);
                        } catch {
                            // Ignore
                        }

                        if (code === 0) {
                            // Check if file was created
                            try {
                                await fs.access(outputPath);
                                resolve({
                                    success: true,
                                    imagePath: outputPath,
                                });
                            } catch {
                                resolve({
                                    success: false,
                                    error: 'Image file was not created',
                                });
                            }
                        } else {
                            let errorMsg = errorOutput || 'Unknown error';
                            if (errorMsg.includes('poppler') || errorMsg.includes('Poppler')) {
                                errorMsg = 'Poppler is not installed or not in PATH.';
                            } else if (errorMsg.includes('pdf2image')) {
                                errorMsg = 'pdf2image Python package not found. Install with: pip install pdf2image pillow';
                            }
                            resolve({
                                success: false,
                                error: `PDF to image conversion failed: ${errorMsg}`,
                            });
                        }
                    });
                }).catch((err) => {
                    resolve({
                        success: false,
                        error: `Failed to create conversion script: ${err.message}`,
                    });
                });
            });
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to convert PDF page to image',
            };
        }
    });

    // Analyze PDF with DeepSeek-OCR (processes all pages)
    ipcMain.handle('analyze-pdf-with-ocr', async (_event, pdfPath: string, baseUrl?: string, selectedPages?: number[]) => {
        try {
            const config = await getConfig();
            const url = baseUrl || config.ai?.baseUrl || 'http://localhost:11434';

            // First, get PDF page count using pdf2json
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const PDFParser = require('pdf2json');

            const pageCount = await new Promise<number>((resolve, reject) => {
                const pdfParser = new PDFParser(null, 1);
                pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
                    resolve((pdfData.Pages || []).length);
                });
                pdfParser.on('pdfParser_dataError', (err: any) => {
                    reject(new Error(`Failed to read PDF: ${err.parserError || 'Unknown error'}`));
                });
                pdfParser.loadPDF(pdfPath);
            });

            // Create temp directory for images
            const tempDir = path.join(app.getPath('temp'), `pdf-ocr-${Date.now()}`);
            await fs.mkdir(tempDir, { recursive: true });

            const allPagesText: string[] = [];
            const errors: string[] = [];

            // Get the main window to send progress updates
            const mainWindow = BrowserWindow.getAllWindows()[0];
            const sendProgress = (message: string, current: number, total: number) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('ocr-progress', {
                        message,
                        current,
                        total,
                        percentage: Math.round((current / total) * 100),
                    });
                }
            };

            // Filter pages to process if specific pages are selected
            const pagesToProcess = selectedPages && selectedPages.length > 0
                ? selectedPages.filter((p: number) => p >= 1 && p <= pageCount).sort((a: number, b: number) => a - b)
                : Array.from({ length: pageCount }, (_, i) => i + 1);

            if (pagesToProcess.length === 0) {
                return {
                    success: false,
                    error: 'No valid pages selected for processing',
                };
            }

            sendProgress(`Processing ${pagesToProcess.length} of ${pageCount} pages...`, 0, pagesToProcess.length);

            // Process each selected page
            let processedIndex = 0;
            for (const pageNum of pagesToProcess) {
                sendProgress(`Converting page ${pageNum} to image...`, pageNum - 1, pageCount);
                try {
                    // Convert PDF page to image
                    const convertResult = await new Promise<{ success: boolean; imagePath?: string; error?: string }>((resolve) => {
                        const python = process.platform === 'win32' ? 'python' : 'python3';
                        // Try to find poppler path from common locations or use environment variable
                        const script = `import sys
import os
from pdf2image import convert_from_path
from PIL import Image

pdf_path = sys.argv[1]
page_num = int(sys.argv[2])
output_path = sys.argv[3]

# Try to find poppler path
poppler_path = None
if len(sys.argv) > 4 and sys.argv[4]:
    poppler_path = sys.argv[4]
else:
    # Check common Windows locations
    common_paths = [
        r'C:\Program Files\poppler-25.12.0\Library\bin',  # User's specific installation
        os.path.join(os.environ.get('LOCALAPPDATA', ''), 'poppler', 'Library', 'bin'),
        os.path.join('C:', 'poppler', 'Library', 'bin'),
        os.path.join('C:', 'Program Files', 'poppler', 'Library', 'bin'),
        os.path.join('C:', 'Program Files', 'poppler-25.12.0', 'Library', 'bin'),
        os.path.join(os.environ.get('USERPROFILE', ''), 'poppler', 'Library', 'bin'),
    ]
    for p in common_paths:
        if os.path.exists(p) and os.path.exists(os.path.join(p, 'pdftoppm.exe')):
            poppler_path = p
            break

try:
    if poppler_path:
        images = convert_from_path(pdf_path, first_page=page_num, last_page=page_num, dpi=200, poppler_path=poppler_path)
    else:
        images = convert_from_path(pdf_path, first_page=page_num, last_page=page_num, dpi=200)
    if images:
        images[0].save(output_path, 'PNG')
        print(output_path)
    else:
        sys.exit(1)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;
                        const tempScriptPath = path.join(app.getPath('temp'), `pdf2img-${Date.now()}-${pageNum}.py`);
                        const outputPath = path.join(tempDir, `page-${pageNum}.png`);

                        // Try to find poppler path - check common locations
                        let popplerPath = '';
                        const commonPaths = [
                            'C:\\Program Files\\poppler-25.12.0\\Library\\bin', // User's specific installation
                            path.join(process.env.LOCALAPPDATA || '', 'poppler', 'Library', 'bin'),
                            path.join('C:', 'poppler', 'Library', 'bin'),
                            path.join('C:', 'Program Files', 'poppler', 'Library', 'bin'),
                            path.join('C:', 'Program Files', 'poppler-25.12.0', 'Library', 'bin'),
                            path.join(process.env.USERPROFILE || '', 'poppler', 'Library', 'bin'),
                        ];

                        // Check if any common path exists
                        const fsSync = require('fs');
                        for (const p of commonPaths) {
                            try {
                                const pdftoppmPath = path.join(p, 'pdftoppm.exe');
                                if (fsSync.existsSync(pdftoppmPath)) {
                                    popplerPath = p;
                                    break;
                                }
                            } catch {
                                // Continue checking
                            }
                        }

                        fs.writeFile(tempScriptPath, script).then(() => {
                            const args = [tempScriptPath, pdfPath, pageNum.toString(), outputPath];
                            if (popplerPath) {
                                args.push(popplerPath);
                            }
                            const process = spawn(python, args, { windowsHide: true });

                            let stdoutOutput = '';
                            let errorOutput = '';

                            process.stdout.on('data', (data) => {
                                stdoutOutput += data.toString();
                            });

                            process.stderr.on('data', (data) => {
                                errorOutput += data.toString();
                            });

                            process.on('close', async (code) => {
                                // Clean up temp script
                                try {
                                    await fs.unlink(tempScriptPath);
                                } catch {
                                    // Ignore
                                }

                                if (code === 0) {
                                    try {
                                        // Verify the image file exists and has content
                                        const stats = await fs.stat(outputPath);
                                        if (stats.size === 0) {
                                            resolve({ success: false, error: 'Image file is empty' });
                                            return;
                                        }

                                        // Verify it's a valid image by checking file signature
                                        const buffer = await fs.readFile(outputPath);
                                        const isValidPNG = buffer.length >= 8 &&
                                            buffer[0] === 0x89 && buffer[1] === 0x50 &&
                                            buffer[2] === 0x4E && buffer[3] === 0x47;

                                        if (!isValidPNG) {
                                            resolve({ success: false, error: 'Generated file is not a valid PNG image' });
                                            return;
                                        }

                                        resolve({ success: true, imagePath: outputPath });
                                    } catch (err) {
                                        resolve({ success: false, error: `Image file check failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
                                    }
                                } else {
                                    let errorMsg = errorOutput || 'Conversion failed';
                                    if (stdoutOutput) {
                                        errorMsg += `\nOutput: ${stdoutOutput}`;
                                    }
                                    if (errorMsg.includes('poppler') || errorMsg.includes('Poppler') || errorMsg.includes('Unable to get page count')) {
                                        errorMsg = 'Poppler is not installed or not in PATH. ' +
                                            'Windows: Download from https://github.com/oschwartz10612/poppler-windows/releases and add bin folder to PATH. ' +
                                            'macOS: brew install poppler. ' +
                                            'Linux: sudo apt-get install poppler-utils';
                                    }
                                    resolve({ success: false, error: errorMsg });
                                }
                            });
                        }).catch((err) => {
                            resolve({ success: false, error: err.message });
                        });
                    });

                    if (!convertResult.success || !convertResult.imagePath) {
                        const errorMsg = convertResult.error || 'Conversion failed';
                        errors.push(`Page ${pageNum}: ${errorMsg}`);

                        // If it's a poppler error, stop processing and return helpful message
                        if (errorMsg.includes('poppler') || errorMsg.includes('Poppler') || errorMsg.includes('Unable to get page count')) {
                            return {
                                success: false,
                                error: `PDF to image conversion requires Poppler to be installed and in PATH.\n\n` +
                                    'Installation instructions:\n' +
                                    'Windows: Download from https://github.com/oschwartz10612/poppler-windows/releases\n' +
                                    '         Extract and add the "bin" folder to your system PATH\n' +
                                    '         Then install Python package: pip install pdf2image pillow\n\n' +
                                    'macOS: brew install poppler\n' +
                                    '       Then: pip install pdf2image pillow\n\n' +
                                    'Linux: sudo apt-get install poppler-utils (or equivalent)\n' +
                                    '       Then: pip install pdf2image pillow',
                            };
                        }
                        continue;
                    }

                    // Call DeepSeek-OCR
                    sendProgress(`Running OCR on page ${pageNum}...`, processedIndex - 1, pagesToProcess.length);
                    const ocrResult = await (async () => {
                        try {
                            // Verify image file exists and is readable
                            if (!convertResult.imagePath) {
                                throw new Error('Image path is missing');
                            }

                            const imageStats = await fs.stat(convertResult.imagePath);
                            if (imageStats.size === 0) {
                                throw new Error('Image file is empty');
                            }

                            const imageBuffer = await fs.readFile(convertResult.imagePath);
                            if (imageBuffer.length === 0) {
                                throw new Error('Failed to read image file');
                            }

                            // Convert to base64 - ensure it's a proper Buffer
                            const buffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
                            const imageBase64 = buffer.toString('base64');

                            // Validate base64 format (should only contain A-Z, a-z, 0-9, +, /, =)
                            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
                            if (!base64Regex.test(imageBase64)) {
                                throw new Error('Invalid base64 encoding detected');
                            }

                            if (!imageBase64 || imageBase64.length < 100) {
                                throw new Error('Base64 encoding appears invalid (too short)');
                            }

                            const result = await httpRequest(`${url}/api/chat`, {
                                method: 'POST',
                                body: JSON.stringify({
                                    model: 'deepseek-ocr:3b',
                                    messages: [{
                                        role: 'user',
                                        content: '<|grounding|>Convert the document to markdown preserving structure.',
                                        images: [imageBase64], // Just the base64 string, no data URL prefix
                                    }],
                                    stream: false,
                                }),
                            });

                            if (result.status === 200 && result.data.message?.content) {
                                sendProgress(`OCR completed for page ${pageNum}`, processedIndex, pagesToProcess.length);
                                return { success: true, response: result.data.message.content.trim() };
                            } else {
                                sendProgress(`OCR failed for page ${pageNum}`, processedIndex - 1, pagesToProcess.length);
                                return { success: false, error: result.data.error || 'OCR failed' };
                            }
                        } catch (err) {
                            sendProgress(`OCR error on page ${pageNum}: ${err instanceof Error ? err.message : 'Unknown error'}`, processedIndex - 1, pagesToProcess.length);
                            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
                        }
                    })();

                    if (ocrResult.success && ocrResult.response) {
                        allPagesText.push(ocrResult.response);
                        sendProgress(`Page ${pageNum} processed successfully`, processedIndex, pagesToProcess.length);
                    } else {
                        const errorMsg = ocrResult.error || 'OCR failed';
                        errors.push(`Page ${pageNum}: ${errorMsg}`);
                        sendProgress(`Page ${pageNum} failed: ${errorMsg}`, processedIndex - 1, pagesToProcess.length);
                    }

                    // Clean up image file
                    try {
                        await fs.unlink(convertResult.imagePath!);
                    } catch {
                        // Ignore cleanup errors
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Page ${pageNum}: ${errorMsg}`);
                    sendProgress(`Page ${pageNum} error: ${errorMsg}`, processedIndex - 1, pagesToProcess.length);
                }
            }

            sendProgress('Combining all pages...', pagesToProcess.length, pagesToProcess.length);

            // Clean up temp directory
            try {
                await fs.rmdir(tempDir, { recursive: true });
            } catch {
                // Ignore cleanup errors
            }

            if (allPagesText.length === 0) {
                return {
                    success: false,
                    error: `Failed to process any pages. Errors: ${errors.join('; ')}`,
                };
            }

            // Combine all pages
            const combinedText = allPagesText.join('\n\n---\n\n');

            return {
                success: true,
                text: combinedText,
                pageCount: pageCount,
                processedPages: allPagesText.length,
                errors: errors.length > 0 ? errors : undefined,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to analyze PDF with OCR',
            };
        }
    });
}