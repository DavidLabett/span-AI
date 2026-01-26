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

  return `Extract 3-5 key bullet points from the following text. Each bullet point must be a complete, short sentence that makes sense on its own.

Rules:
- Write complete sentences (subject + verb + object)
- Keep sentences concise but grammatically complete
- Each sentence should be self-contained and meaningful
- Do not truncate or cut off sentences mid-thought
- Return ONLY the bullet points themselves
- Do NOT include any introductory text, explanations, or meta-commentary
- Do NOT write phrases like "here are X bullet points" or "extracted from the text"
- Do NOT number the bullets or use dashes/markers
- Return ONLY the bullet points, one per line, no numbering, no dashes, no markdown, just plain text sentences

Text:
${truncatedContent}

Bullet points:`
}

/**
 * Parse bullet points from LLM response
 * Handles various formats (numbered lists, dashes, etc.)
 */
export function parseBulletPoints(response: string): string[] {
  // Remove common meta-commentary patterns
  let cleanedResponse = response
    // Remove introductory phrases
    .replace(/^(here are|here is|below are|below is|the following|extracted|key points?|bullet points?)[:\s]*/i, '')
    .replace(/^(these are|these is|following are|following is)[:\s]*/i, '')
    .replace(/^(from the text|from the content|from the document)[:\s]*/i, '')
    .replace(/^(extracted from|based on|derived from)[:\s]*/i, '')
    .trim()

  const lines = cleanedResponse
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  const bullets: string[] = []

  for (const line of lines) {
    // Skip meta-commentary lines
    if (/^(here are|here is|below are|below is|the following|extracted|key points?|bullet points?|these are|following are|from the text|from the content)/i.test(line)) {
      continue
    }

    // Remove common list markers
    let cleaned = line
      .replace(/^[-*•]\s+/, '')  // Remove dashes, asterisks, bullets
      .replace(/^\d+[.)]\s+/, '')  // Remove numbered lists (1. 2. etc.)
      .replace(/^\([a-z0-9]+\)\s+/, '')  // Remove lettered lists (a) b) etc.)
      .trim()

    // Skip if empty or too short (less than 3 characters)
    if (cleaned.length < 3) continue

    // Skip if it looks like meta-commentary
    if (/^(here are|here is|below are|below is|the following|extracted|key points?|bullet points?|these are|following are|from the text|from the content|extracted from|based on|derived from)/i.test(cleaned)) {
      continue
    }

    // Ensure sentence ends with punctuation (if it doesn't, try to find complete sentence)
    // If the line doesn't end with punctuation, check if it's a complete thought
    if (!/[.!?]$/.test(cleaned)) {
      // Try to find the end of the sentence in the original line
      const sentenceMatch = line.match(/^[-*•\d.)\s]*([^.!?]*[.!?])/)
      if (sentenceMatch) {
        cleaned = sentenceMatch[1].trim()
      }
    }

    // Only add if it's a meaningful sentence (at least 5 characters)
    if (cleaned.length >= 5) {
      bullets.push(cleaned)
    }

    // Limit to 7 bullets max
    if (bullets.length >= 7) break
  }

  // Ensure at least one bullet point
  if (bullets.length === 0 && response.trim().length > 0) {
    // Fallback: use first complete sentence
    const sentences = response.trim().split(/[.!?]+/).filter(s => s.trim().length >= 5)
    if (sentences.length > 0) {
      bullets.push(sentences[0].trim())
    } else {
      // Last resort: use first meaningful part
      const fallback = response.trim().substring(0, 100).trim()
      if (fallback.length >= 5) {
        bullets.push(fallback)
      }
    }
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

