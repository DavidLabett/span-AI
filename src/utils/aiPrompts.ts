/**
 * AI prompt templates for document processing
 * Phase 3: Hierarchy Detection
 * Phase 4: Node Content Generation
 */

const MAX_SEGMENTS = 40
const MAX_SEGMENT_CHARS = 150

/**
 * Build prompt for hierarchy detection.
 * Caps input to MAX_SEGMENTS segments (headers preferred) and enforces a
 * compact tree: max depth 3, max 4 children per node, max 12 total nodes.
 */
export function buildHierarchyDetectionPrompt(segments: Array<{ id: string; level: number; text: string; type: string }>): string {
  // Prefer header segments; fill remaining slots with paragraphs
  const headers = segments.filter(s => s.type === 'chapter' || s.type === 'section')
  const paragraphs = segments.filter(s => s.type === 'paragraph')
  const selected = [
    ...headers,
    ...paragraphs.slice(0, Math.max(0, MAX_SEGMENTS - headers.length)),
  ].slice(0, MAX_SEGMENTS)

  const segmentsText = selected
    .map((seg, idx) => {
      const preview = seg.text.length > MAX_SEGMENT_CHARS
        ? seg.text.substring(0, MAX_SEGMENT_CHARS) + '...'
        : seg.text
      return `${idx + 1}. [Level ${seg.level}] ${seg.type.toUpperCase()}: ${preview}`
    })
    .join('\n')

  return `Analyze this document and return a compact JSON hierarchy for a mindmap.

Document segments:

${segmentsText}

Return ONLY valid JSON in this exact format:
{
  "title": "Root title summarizing the entire document",
  "level": 0,
  "content": "One-sentence summary of the document",
  "children": [
    {
      "title": "Section title",
      "level": 1,
      "content": "Key idea of this section in one sentence",
      "children": [
        {
          "title": "Subsection title",
          "level": 2,
          "content": "Key idea of this subsection in one sentence",
          "children": []
        }
      ]
    }
  ]
}

Rules:
- Root node has level 0; each child level is parent level + 1
- Maximum depth: 3 levels (levels 0, 1, 2)
- Maximum 4 children per node
- Maximum 12 nodes total across the entire tree
- Merge minor or closely related sections into their parent instead of creating new nodes
- Titles: 3-7 words summarising the section
- Content: one concise sentence per node
- Return ONLY the JSON object — no markdown, no code blocks, no explanations

JSON:`
}

/**
 * Parse LLM response into HierarchyNode structure.
 * Handles various response formats (JSON, markdown code blocks, etc.)
 */
export function parseHierarchyResponse(response: string): { title: string; level: number; content: string; children: any[] } | null {
  try {
    let cleaned = response.trim()

    cleaned = cleaned.replace(/^```json\s*/i, '')
    cleaned = cleaned.replace(/^```\s*/i, '')
    cleaned = cleaned.replace(/```\s*$/i, '')
    cleaned = cleaned.trim()

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleaned = jsonMatch[0]
    }

    const parsed = JSON.parse(cleaned)

    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }

    return {
      title: parsed.title || 'Untitled',
      level: typeof parsed.level === 'number' ? parsed.level : 0,
      content: parsed.content || '',
      children: Array.isArray(parsed.children) ? parsed.children : [],
    }
  } catch (error) {
    console.error('Failed to parse hierarchy response:', error)
    console.error('Response was:', response)
    return null
  }
}

/**
 * Build prompt that generates both the node title and 2-3 bullet points
 * in a single LLM call. Replaces the separate title + bullet prompts.
 */
export function buildNodeContentPrompt(content: string, existingTitle?: string): string {
  const maxContentLength = 600
  const truncatedContent = content.length > maxContentLength
    ? content.substring(0, maxContentLength) + '...'
    : content

  const titleHint = existingTitle
    ? `The section is titled "${existingTitle}". You may keep or improve this title.\n`
    : ''

  return `${titleHint}Write a short title and 2-3 key bullet points for the following text.

Format your response EXACTLY like this (no extra text before or after):
TITLE: <3-7 word title>
- <concise sentence>
- <concise sentence>
- <concise sentence>

Rules:
- TITLE line first, then bullet lines starting with "- "
- Title: 3-7 words, no punctuation at the end
- Each bullet: one short, self-contained sentence
- Return ONLY the formatted block above — no intro, no commentary

Text:
${truncatedContent}`
}

/**
 * Parse the response from buildNodeContentPrompt into title + bullets.
 */
export function parseNodeContent(response: string): { title: string; bullets: string[] } {
  const lines = response.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0)

  let title = ''
  const bullets: string[] = []

  for (const line of lines) {
    if (!title && line.toUpperCase().startsWith('TITLE:')) {
      title = line.replace(/^TITLE:\s*/i, '').trim()
    } else if (line.startsWith('- ')) {
      const bullet = line.replace(/^-\s+/, '').trim()
      if (bullet.length >= 5 && bullets.length < 3) {
        bullets.push(bullet)
      }
    }
  }

  // Fallback: if no TITLE line, use first non-bullet line
  if (!title) {
    const firstNonBullet = lines.find(l => !l.startsWith('- '))
    title = firstNonBullet
      ? firstNonBullet.replace(/^TITLE:\s*/i, '').trim()
      : 'Untitled'
  }

  // Fallback: if no bullets, use title as single bullet
  if (bullets.length === 0) {
    bullets.push(title)
  }

  return { title: cleanTitle(title), bullets }
}

/**
 * Clean and truncate title.
 * Enforces max length and removes unwanted characters.
 */
export function cleanTitle(title: string, maxLength: number = 50): string {
  let cleaned = title.trim()

  cleaned = cleaned.replace(/^["']|["']$/g, '')
  cleaned = cleaned.replace(/^\.+$/, '')

  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength - 3) + '...'
  }

  if (cleaned.length === 0) {
    cleaned = 'Untitled'
  }

  return cleaned
}
