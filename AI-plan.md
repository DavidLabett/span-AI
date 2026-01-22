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
- [ ] Add "Import Document" option to menu/UI
  - [ ] PDF files (.pdf) - **Primary format**
  - [ ] Text files (.txt)
  - [ ] Markdown files (.md)
  - [ ] Plain text from clipboard (optional)
- [ ] File dialog integration (reuse existing IPC patterns)
- [ ] Read file content into memory
- [ ] PDF text extraction:
  - [ ] Install PDF parsing library (e.g., `pdf-parse`, `pdfjs-dist`)
  - [ ] Extract text content from PDF pages
  - [ ] Preserve basic structure (page breaks, headings if detectable)

#### 1.2 Basic Segmentation
- [ ] Create `src/utils/documentParser.ts`
- [ ] Implement segmentation logic:
  - [ ] **PDF-specific**: Extract text with structure hints (font sizes, bold text as potential headers)
  - [ ] Split by markdown headers (`#`, `##`, `###`) for .md files
  - [ ] Split by paragraph breaks (double newline)
  - [ ] Detect chapter/section boundaries
  - [ ] Handle PDF page breaks (optional: preserve page numbers)
- [ ] Store segments with metadata:
  ```ts
  interface DocumentSegment {
    id: string
    level: number  // hierarchy depth (0 = root, 1 = chapter, etc.)
    text: string
    type: 'chapter' | 'section' | 'paragraph'
    parentId?: string
  }
  ```
- [ ] Display raw segments in console/log for debugging

**Deliverable:** Can import a document and see it segmented into logical chunks.

---

### Phase 2 – LLM Integration Setup

> Goal: Set up local Ollama connection and basic prompt structure.

#### 2.1 Ollama Setup & Verification
- [ ] Verify Ollama is installed and running locally
  - [ ] Check if Ollama service is accessible at `http://localhost:11434`
  - [ ] Add detection/validation in UI (show status indicator)
- [ ] Ensure `gemma3:1b` model is available:
  - [ ] Check if model exists: `ollama list`
  - [ ] If not, prompt user to pull: `ollama pull gemma3:1b`
  - [ ] Add helper function to verify model availability

#### 2.2 LLM Client Setup
- [ ] Install HTTP client library (`fetch` for Ollama API)
- [ ] Create `src/utils/llmClient.ts`:
  ```ts
  interface LLMConfig {
    baseUrl: string  // default: 'http://localhost:11434'
    model: string    // default: 'gemma3:1b'
  }
  
  async function callLLM(prompt: string, config: LLMConfig): Promise<string>
  ```
- [ ] Implement Ollama API calls:
  - [ ] POST to `/api/generate` endpoint
  - [ ] Handle streaming responses (optional, for progress)
  - [ ] Parse JSON responses from model
- [ ] Basic error handling:
  - [ ] Ollama not running
  - [ ] Model not found
  - [ ] Network errors
  - [ ] Invalid responses
- [ ] Test with simple prompt to verify connection

#### 2.3 IPC Integration
- [ ] Add IPC handlers in `electron/ipc.ts`:
  - [ ] `ai-generate-mindmap` - main generation endpoint
  - [ ] `ai-check-ollama` - verify Ollama is running
  - [ ] `ai-get-config` - retrieve current config (baseUrl, model)
  - [ ] `ai-set-config` - update Ollama settings (optional: custom port)
- [ ] Expose via preload script

**Deliverable:** Can call LLM API and receive responses.

---

### Phase 3 – Hierarchy Detection

> Goal: Use LLM to identify document structure and build a tree.

#### 3.1 Hierarchy Detection Prompt
- [ ] Design prompt template:
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
- [ ] Implement prompt building in `src/utils/aiPrompts.ts`
- [ ] Parse JSON response into tree structure:
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
- [ ] Create `src/utils/hierarchyBuilder.ts`
- [ ] Convert flat segments → hierarchical tree
- [ ] Handle edge cases:
  - [ ] Missing parent references
  - [ ] Circular dependencies
  - [ ] Orphaned nodes
- [ ] Validate tree structure before proceeding

#### 3.3 Progress Feedback
- [ ] Add progress indicator UI component
- [ ] Show "Analyzing document..." status
- [ ] Display hierarchy depth and node count

**Deliverable:** Can analyze a document and receive a hierarchical tree structure.

---

### Phase 4 – Node Content Generation

> Goal: For each node in hierarchy, generate title and bullet points.

#### 4.1 Title Generation
- [ ] For each hierarchy node:
  - [ ] If LLM already provided title, use it
  - [ ] Otherwise, prompt LLM: "Summarize this in 3-5 words: {content}"
- [ ] Enforce max title length (e.g., 50 chars)
- [ ] Fallback to first sentence if generation fails

#### 4.2 Bullet Point Extraction
- [ ] Design prompt for bullet extraction:
  ```
  Extract 3-5 key bullet points from this text:
  {content}
  
  Return as a simple list, one point per line.
  ```
- [ ] Parse bullet points from response
- [ ] Format as description string (join with newlines)
- [ ] Limit to 5-7 bullets max per node

#### 4.3 Batch Processing
- [ ] Process nodes in batches to avoid rate limits
- [ ] Add delay between API calls if needed
- [ ] Show progress: "Generating content for node X of Y..."
- [ ] Cache results to avoid re-processing

#### 4.4 Node Creation
- [ ] Map hierarchy nodes → Span Node format:
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
- [ ] Use `createNode` from `useNodes` hook
- [ ] Store hierarchy relationships for edge creation

**Deliverable:** Can generate nodes with titles and bullet points from hierarchy.

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
│   ├── documentParser.ts      # Segment documents (PDF, text, markdown)
│   ├── pdfExtractor.ts        # PDF text extraction
│   ├── llmClient.ts           # Ollama API wrapper
│   ├── aiPrompts.ts           # Prompt templates
│   ├── hierarchyBuilder.ts   # Build tree from segments
│   └── layoutEngine.ts       # Hierarchical tree layout
├── components/
│   └── AIGenerationModal.tsx  # Progress UI
├── hooks/
│   └── useAIGeneration.ts     # Orchestrate generation flow
└── types.ts
    └── DocumentSegment, HierarchyNode (additions)
```

### Dependencies to Add

```json
{
  "dependencies": {
    "axios": "^1.6.0",           // for Ollama API calls
    "pdf-parse": "^1.1.1"        // for PDF text extraction
  },
  "devDependencies": {
    "@types/pdf-parse": "^1.1.4"  // TypeScript types
  }
}
```

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

1. ✅ User can import a document (PDF, text, markdown)
2. ✅ PDF text is extracted and document is segmented into logical units
3. ✅ Local Ollama (gemma3:1b) identifies hierarchical structure
4. ✅ Each node gets a concise title and relevant bullet points
5. ✅ Nodes are automatically laid out in readable hierarchical tree
6. ✅ Edges connect parent-child relationships
7. ✅ Generated mindmap can be edited, saved, and exported like any project

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

