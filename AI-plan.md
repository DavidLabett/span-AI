# AI Mindmap Generation – MVP Development Plan

> Generate mindmaps from documents using LLM to identify hierarchy and extract content.

---

## Overview

**Goal:** Transform a document into a visual mindmap by:
1. Segmenting the document into logical units (chapters, titles, paragraphs)
2. Using LLM to identify hierarchical structure (outline/tree)
3. For each node: generate short title, extract bullet points
4. Auto-layout nodes on canvas based on hierarchy

**Flow:**
```
Document → Segmentation → LLM Hierarchy Detection → Node Generation (Title + Bullets) → Layout Engine → Canvas
```

---

## Development Phases

### Phase 1 – Document Input & Basic Segmentation

> Goal: Accept document input and break it into logical segments.

#### 1.1 File Input Support
- [x] Add "Import Document" option to menu/UI
  - [x] PDF files (.pdf) - **Primary format** (using `pdf2json`)
  - [x] Text files (.txt)
  - [x] Markdown files (.md)
  - [ ] Plain text from clipboard (optional)
- [x] File dialog integration (reuse existing IPC patterns)
- [x] Read file content into memory
- [x] PDF text extraction:
  - [x] Install PDF parsing library (using `pdf2json` for Node.js compatibility)
  - [x] Extract text content from PDF pages
  - [x] Preserve basic structure (page breaks, headings if detectable)

#### 1.2 Basic Segmentation
- [x] Create `src/utils/documentParser.ts`
- [x] Implement segmentation logic:
  - [x] **PDF-specific**: Extract text with structure hints (font sizes, bold text as potential headers)
  - [x] Split by markdown headers (`#`, `##`, `###`) for .md files
  - [x] Split by paragraph breaks (double newline)
  - [x] Detect chapter/section boundaries
  - [x] Handle PDF page breaks (optional: preserve page numbers)
- [x] Store segments with metadata:
  ```ts
  interface DocumentSegment {
    id: string
    level: number  // hierarchy depth (0 = root, 1 = chapter, etc.)
    text: string
    type: 'chapter' | 'section' | 'paragraph'
    parentId?: string
  }
  ```
- [x] Display raw segments in console/log for debugging

**Deliverable:** ✅ **COMPLETE** - Can import a document and see it segmented into logical chunks.

**Status:** Phase 1 is complete! Both PDF and Markdown files can be imported and segmented. Text files also work. The only optional feature not implemented is clipboard support.

---

### Phase 2 – LLM Integration Setup

> Goal: Set up local Ollama connection and basic prompt structure.

#### 2.1 Ollama Setup & Verification
- [x] Verify Ollama is installed and running locally
  - [x] Check if Ollama service is accessible at `http://localhost:11434`
  - [x] Add detection/validation in UI (via `useOllama` hook)
- [x] Ensure `gemma3:1b` model is available:
  - [x] Check if model exists via `/api/tags` endpoint
  - [x] If not, show helpful error message with instructions
  - [x] Add helper function to verify model availability

#### 2.2 LLM Client Setup
- [x] Install HTTP client library (`fetch` for Ollama API - using Node.js http in main process)
- [x] Create `src/utils/llmClient.ts`:
  ```ts
  interface LLMConfig {
    baseUrl: string  // default: 'http://localhost:11434'
    model: string    // default: 'gemma3:1b'
  }
  
  async function callLLM(prompt: string, config: LLMConfig): Promise<string>
  ```
- [x] Implement Ollama API calls:
  - [x] POST to `/api/generate` endpoint
  - [x] Handle streaming responses (optional, for progress) - implemented but not used yet
  - [x] Parse JSON responses from model
- [x] Basic error handling:
  - [x] Ollama not running
  - [x] Model not found
  - [x] Network errors
  - [x] Invalid responses
- [x] Test with simple prompt to verify connection (Shift+T keyboard shortcut)

#### 2.3 IPC Integration
- [x] Add IPC handlers in `electron/ipc.ts`:
  - [x] `ai-call-llm` - main LLM call endpoint (for Phase 3)
  - [x] `ai-check-ollama` - verify Ollama is running
  - [x] `ai-check-model` - verify model availability
  - [x] `ai-get-config` - retrieve current config (baseUrl, model)
  - [x] `ai-set-config` - update Ollama settings (optional: custom port)
- [x] Expose via preload script
- [x] Create `useOllama` hook for React components

**Deliverable:** ✅ **COMPLETE** - Can call LLM API and receive responses.

**Status:** Phase 2 is complete! Ollama integration is set up with verification, configuration, and testing capabilities. Use `Shift+T` to test the connection.

---

### Phase 3 – Hierarchy Detection

> Goal: Use LLM to identify document structure and build a tree.

#### 3.1 Hierarchy Detection Prompt
- [x] Design prompt template:
  ```
  Analyze this document and identify its hierarchical structure.
  Return a JSON tree where each node has:
  - title: short summary
  - level: depth in hierarchy (0 = root, 1 = main section, etc.)
  - children: array of child nodes
  - content: original text segment
  
  Document:
  {document}
  ```
- [x] Implement prompt building in `src/utils/aiPrompts.ts`
- [x] Parse JSON response into tree structure:
  ```ts
  interface HierarchyNode {
    id: string
    title: string
    level: number
    content: string
    children: HierarchyNode[]
    parentId?: string
  }
  ```

#### 3.2 Tree Construction
- [x] Create `src/utils/hierarchyBuilder.ts`
- [x] Convert flat segments → hierarchical tree
- [x] Handle edge cases:
  - [x] Missing parent references
  - [x] Circular dependencies
  - [x] Orphaned nodes
- [x] Validate tree structure before proceeding

#### 3.3 Progress Feedback
- [x] Add progress indicator UI component
- [x] Show "Analyzing document..." status
- [x] Display hierarchy depth and node count

**Deliverable:** ✅ **COMPLETE** - Can analyze a document and receive a hierarchical tree structure.

**Status:** Phase 3 is complete! The system can now detect document hierarchy using LLM. When importing a document, it automatically triggers hierarchy detection (if Ollama is ready) and displays progress in a modal. The hierarchy tree is validated and statistics are shown upon completion.

---

### Phase 4 – Node Content Generation

> Goal: For each node in hierarchy, generate title and bullet points.

#### 4.1 Title Generation
- [x] For each hierarchy node:
  - [x] If LLM already provided title, use it
  - [x] Otherwise, prompt LLM: "Summarize this in 3-5 words: {content}"
- [x] Enforce max title length (e.g., 50 chars)
- [x] Fallback to first sentence if generation fails

#### 4.2 Bullet Point Extraction
- [x] Design prompt for bullet extraction:
  ```
  Extract 3-5 key bullet points from this text:
  {content}
  
  Return as a simple list, one point per line.
  ```
- [x] Parse bullet points from response
- [x] Format as description string (join with newlines)
- [x] Limit to 5-7 bullets max per node

#### 4.3 Batch Processing
- [x] Process nodes in batches to avoid rate limits
- [x] Add delay between API calls if needed
- [x] Show progress: "Generating content for node X of Y..."
- [x] Cache results to avoid re-processing

#### 4.4 Node Creation
- [x] Map hierarchy nodes → Span Node format:
  ```ts
  const spanNode: Node = {
    id: generateId(),
    x: 0,  // will be set by layout engine
    y: 0,
    width: nodeDefaults.width,
    height: nodeDefaults.height,
    title: hierarchyNode.title,
    description: bullets.join('\n'),
    collapsed: false,
  }
  ```
- [x] Use `setAllNodes` to create nodes on canvas
- [x] Store hierarchy relationships for edge creation
- [x] Create edges between parent-child nodes

**Deliverable:** ✅ **COMPLETE** - Can generate nodes with titles and bullet points from hierarchy.

**Status:** Phase 4 is complete! The system can now generate titles and bullet points for each hierarchy node using LLM, process them in batches with progress tracking, and create Span nodes with edges on the canvas. Nodes are created at position (0,0) and will be positioned by the layout engine in Phase 5.

---

### Phase 5 – Layout Engine

> Goal: Automatically position nodes on canvas based on hierarchy using Hierarchical Tree Layout.

#### 5.1 Hierarchical Tree Layout Implementation
- [ ] Create `src/utils/layoutEngine.ts`:
  ```ts
  interface LayoutConfig {
    nodeWidth: number
    nodeHeight: number
    horizontalSpacing: number  // between siblings
    verticalSpacing: number    // between levels
    levelHeight: number        // height per hierarchy level
  }
  
  function layoutHierarchy(
    rootNode: HierarchyNode,
    nodes: NodeMap,
    config: LayoutConfig
  ): NodeMap
  ```
- [ ] Algorithm:
  1. Start with root at top-center
  2. For each level, distribute children horizontally
  3. Center parent above its children
  4. Recursively layout subtrees
- [ ] Handle edge cases:
  - [ ] Single child (center below parent)
  - [ ] Many children (wrap or scroll horizontally)
  - [ ] Deep trees (prevent vertical overflow)

#### 5.2 Edge Creation
- [ ] After layout, create edges based on hierarchy:
  - [ ] For each parent-child relationship, create edge
  - [ ] Use `createEdge` from `useEdges` hook
- [ ] Connect parent node → child node

#### 5.3 Canvas Positioning
- [ ] Center the entire tree in viewport
- [ ] Set initial camera position to show full tree
- [ ] Optional: Add zoom-to-fit functionality

**Deliverable:** Nodes are automatically positioned in a readable hierarchy with connecting edges.

---

### Phase 6 – Integration & Polish

> Goal: Smooth user experience and error handling.

#### 6.1 UI Integration
- [ ] Add "Generate from Document" button/menu item
- [ ] File selection dialog
- [ ] Progress modal/dialog showing:
  - [ ] Current step (segmentation, analysis, generation, layout)
  - [ ] Progress percentage
  - [ ] Estimated time remaining
- [ ] Success message when complete
- [ ] Option to cancel mid-process

#### 6.2 Error Handling
- [ ] Handle Ollama errors gracefully:
  - [ ] Ollama service not running (show helpful message with install instructions)
  - [ ] Model not found (prompt to pull `gemma3:1b`)
  - [ ] Network failures (connection refused, timeout)
  - [ ] Malformed LLM responses (invalid JSON, empty responses)
  - [ ] Out of memory (large documents)
- [ ] Show user-friendly error messages
- [ ] Retry logic for transient failures
- [ ] Fallback: create nodes with raw text if LLM fails

#### 6.3 Optimization
- [ ] Batch LLM requests where possible
- [ ] Cache API responses for identical content
- [ ] Stream progress updates (if LLM supports streaming)
- [ ] Optimize layout calculation for large trees (100+ nodes)

#### 6.4 User Controls
- [ ] Allow user to:
  - [ ] Regenerate specific nodes (right-click → "Regenerate content")
  - [ ] Adjust layout spacing (settings)
  - [ ] Choose different layout algorithms
  - [ ] Manually refine titles/bullets after generation

#### 6.5 Testing & Refinement
- [ ] Test with various document types:
  - [ ] Academic papers
  - [ ] Blog posts
  - [ ] Technical documentation
  - [ ] Books/chapters
- [ ] Gather feedback on:
  - [ ] Title quality
  - [ ] Bullet point relevance
  - [ ] Layout readability
- [ ] Iterate on prompts based on results

**Deliverable:** Polished feature ready for use with good UX and error handling.

---

## Technical Considerations

### Data Flow

```
User selects document (PDF/text/markdown)
  ↓
File read → PDFExtractor.extract() (if PDF) → DocumentParser.segment()
  ↓
Segments → OllamaClient.detectHierarchy() (gemma3:1b)
  ↓
Hierarchy tree → OllamaClient.generateNodeContent() (for each node)
  ↓
Nodes with content → LayoutEngine.layoutHierarchy()
  ↓
Positioned nodes + edges → Canvas (via useNodes, useEdges)
```

### File Structure

```
src/
├── utils/
│   ├── documentParser.ts      # ✅ Segment documents (PDF, text, markdown) - COMPLETE
│   ├── llmClient.ts           # ✅ Ollama API wrapper - COMPLETE
│   ├── aiPrompts.ts           # ✅ Prompt templates - COMPLETE
│   ├── hierarchyBuilder.ts   # ✅ Build tree from segments - COMPLETE
│   └── layoutEngine.ts       # ⏳ Hierarchical tree layout - Phase 5
├── hooks/
│   ├── useDocumentImport.ts   # ✅ Document import hook - COMPLETE
│   ├── useOllama.ts           # ✅ Ollama connection hook - COMPLETE
│   └── useAIGeneration.ts     # ✅ Orchestrate generation flow - COMPLETE
├── components/
│   └── AIGenerationModal.tsx  # ✅ Progress UI - COMPLETE
└── types.ts
    └── DocumentSegment, HierarchyNode (additions) - COMPLETE
```

### Dependencies to Add

```json
{
  "dependencies": {
    "pdf2json": "^3.1.1"         // for PDF text extraction (Node.js compatible) - ✅ Installed
    // "axios": "^1.6.0",       // for Ollama API calls - ⏳ Phase 2
  }
}
```

**Note:** Using `pdf2json` instead of `pdf-parse` for better Electron/Node.js compatibility (no DOM API dependencies).

### Configuration

Store in Electron config:
```json
{
  "ai": {
    "baseUrl": "http://localhost:11434",  // Ollama default
    "model": "gemma3:1b"
  }
}
```

**Ollama Setup Requirements:**
- Ollama must be installed: https://ollama.ai
- Model must be pulled: `ollama pull gemma3:1b`
- Ollama service must be running (usually auto-starts)

---

## Success Criteria

1. ✅ User can import a document (PDF, text, markdown) - **Phase 1 Complete**
2. ✅ PDF text is extracted and document is segmented into logical units - **Phase 1 Complete**
3. ✅ Local Ollama (gemma3:1b) identifies hierarchical structure - **Phase 2-3 Complete**
4. ✅ Each node gets a concise title and relevant bullet points - **Phase 4 Complete**
5. ⏳ Nodes are automatically laid out in readable hierarchical tree - **Phase 5 Pending**
6. ⏳ Edges connect parent-child relationships - **Phase 5 Pending**
7. ⏳ Generated mindmap can be edited, saved, and exported like any project - **Phase 6 Pending**

---

## Future Enhancements (Post-MVP)

- [ ] Support Word documents (.docx)
- [ ] Multiple layout algorithms (Force-Directed, Radial) - user choice
- [ ] Support larger Ollama models (gemma3:2b, gemma3:4b) for better quality
- [ ] Interactive refinement: regenerate individual nodes
- [ ] Smart merging: combine similar nodes
- [ ] Export hierarchy as outline/markdown
- [ ] Incremental updates: add new content to existing mindmap
- [ ] Batch processing: generate multiple mindmaps from document collection
- [ ] PDF structure preservation: better header detection from formatting
- [ ] Custom Ollama model selection in settings
- [ ] Add an option to record speech-to-text as input for mindmap-generation 

---

## Notes

- **Privacy:** Using local Ollama ensures all processing happens on-device
- **Performance:** 
  - `gemma3:1b` is fast but smaller; may need prompt tuning for quality
  - Large documents (100+ pages) may need chunking strategy
  - Ollama runs locally, so no network latency but uses local compute
- **Quality:** Prompt engineering is critical with smaller models; iterate based on real document tests
- **Layout:** Hierarchical Tree Layout is the starting point; can add other algorithms later
- **PDF Extraction:** May need to handle various PDF formats (text-based vs scanned); consider OCR for scanned PDFs in future

