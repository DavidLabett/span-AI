/**
 * AI prompt templates for document processing
 * Phase 3: Hierarchy Detection
 * Phase 4: Node Content Generation
 */

/**
 * Build prompt for hierarchy detection
 * Analyzes document segments and returns a hierarchical tree structure
 */
export function buildHierarchyDetectionPrompt(segments: Array<{ id: string; level: number; text: string; type: string }>): string {
  // Format segments for the prompt
  const segmentsText = segments
    .map((seg, idx) => {
      return `${idx + 1}. [Level ${seg.level}] ${seg.type.toUpperCase()}: ${seg.text.substring(0, 200)}${seg.text.length > 200 ? '...' : ''}`
    })
    .join('\n')

  return `Analyze this document and identify its hierarchical structure.

The document has been segmented into the following parts:

${segmentsText}

Your task is to analyze these segments and return a JSON tree structure representing the document's hierarchy.

Return ONLY valid JSON in this exact format:
{
  "title": "Root title summarizing the entire document",
  "level": 0,
  "content": "Brief summary of the document",
  "children": [
    {
      "title": "Chapter/Section title",
      "level": 1,
      "content": "Content or summary of this section",
      "children": [
        {
          "title": "Subsection title",
          "level": 2,
          "content": "Content of subsection",
          "children": []
        }
      ]
    }
  ]
}

Rules:
- The root node should have level 0
- Each child should have a level one higher than its parent
- Use the segment text to infer titles (summarize in 3-7 words)
- Group related segments under appropriate parent nodes
- Keep the hierarchy logical and meaningful
- If a segment seems like a header, use it as a title
- If a segment is content, include it in the "content" field or as a child
- Return ONLY the JSON object, no markdown, no code blocks, no explanations

JSON:`
}

/**
 * Parse LLM response into HierarchyNode structure
 * Handles various response formats (JSON, markdown code blocks, etc.)
 */
export function parseHierarchyResponse(response: string): { title: string; level: number; content: string; children: any[] } | null {
  try {
    // Remove markdown code blocks if present
    let cleaned = response.trim()

    // Remove ```json or ``` markers
    cleaned = cleaned.replace(/^```json\s*/i, '')
    cleaned = cleaned.replace(/^```\s*/i, '')
    cleaned = cleaned.replace(/```\s*$/i, '')
    cleaned = cleaned.trim()

    // Try to find JSON object in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleaned = jsonMatch[0]
    }

    const parsed = JSON.parse(cleaned)

    // Validate structure
    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }

    // Ensure required fields exist
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
 * Build prompt for title generation
 * Phase 4: Node Content Generation
 */
export function buildTitleGenerationPrompt(content: string): string {
  // Truncate content if too long (to avoid token limits)
  const maxContentLength = 500
  const truncatedContent = content.length > maxContentLength
    ? content.substring(0, maxContentLength) + '...'
    : content

  return `Summarize the following text in 3-7 words. Return ONLY the title, nothing else, no quotes, no explanation:

${truncatedContent}

Title:`
}

/**
 * Build prompt for bullet point extraction
 * Phase 4: Node Content Generation
 */
export function buildBulletPointPrompt(content: string): string {
  // Truncate content if too long
  const maxContentLength = 800
  const truncatedContent = content.length > maxContentLength
    ? content.substring(0, maxContentLength) + '...'
    : content

  return `Extract 3-5 key bullet points from the following text. Return ONLY the bullet points, one per line, no numbering, no dashes, no markdown, just plain text:

${truncatedContent}

Bullet points:`
}

/**
 * Parse bullet points from LLM response
 * Handles various formats (numbered lists, dashes, etc.)
 */
export function parseBulletPoints(response: string): string[] {
  const lines = response
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  const bullets: string[] = []

  for (const line of lines) {
    // Remove common list markers
    let cleaned = line
      .replace(/^[-*•]\s+/, '')  // Remove dashes, asterisks, bullets
      .replace(/^\d+[.)]\s+/, '')  // Remove numbered lists (1. 2. etc.)
      .replace(/^\([a-z0-9]+\)\s+/, '')  // Remove lettered lists (a) b) etc.)
      .trim()

    // Skip if empty or too short
    if (cleaned.length < 3) continue

    // Limit to 50 characters per bullet (for display)
    if (cleaned.length > 50) {
      cleaned = cleaned.substring(0, 47) + '...'
    }

    bullets.push(cleaned)

    // Limit to 7 bullets max
    if (bullets.length >= 7) break
  }

  // Ensure at least one bullet point
  if (bullets.length === 0 && response.trim().length > 0) {
    // Fallback: use first sentence or first 50 chars
    const fallback = response.trim().split(/[.!?]/)[0].trim()
    bullets.push(fallback.length > 50 ? fallback.substring(0, 47) + '...' : fallback)
  }

  return bullets
}

/**
 * Clean and truncate title
 * Enforces max length and removes unwanted characters
 */
export function cleanTitle(title: string, maxLength: number = 50): string {
  let cleaned = title.trim()

  // Remove quotes if present
  cleaned = cleaned.replace(/^["']|["']$/g, '')

  // Remove trailing punctuation if it's just a period
  cleaned = cleaned.replace(/^\.+$/, '')

  // Truncate if too long
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength - 3) + '...'
  }

  // Fallback if empty
  if (cleaned.length === 0) {
    cleaned = 'Untitled'
  }

  return cleaned
}

