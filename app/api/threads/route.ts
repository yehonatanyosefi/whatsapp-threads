import { GoogleGenerativeAI } from '@google/generative-ai'

// Constants for configuration
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // ms
const MAX_CONTENT_LENGTH = 100000 // characters
const MIN_CONTENT_LENGTH = 50
const MAX_PARALLEL_THREADS = 10

const MODEL_CHEAP = 'gemini-1.5-flash'

interface ThreadResponse {
	concept: string
	discussion: string
}

interface ConceptExtractionResult {
	concepts: string[]
	error?: string
}

interface ThreadGenerationResult {
	concept: string
	discussion: string
}

// Utility function for delay between retries
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Retry wrapper for API calls
async function withRetry<T>(operation: () => Promise<T>, retryCount = 0): Promise<T> {
	try {
		return await operation()
	} catch (error) {
		if (retryCount >= MAX_RETRIES) {
			throw error
		}

		if (error instanceof Error && (error.message.includes('429') || error.message.includes('503'))) {
			await delay(RETRY_DELAY * Math.pow(2, retryCount)) // Exponential backoff
			return withRetry(operation, retryCount + 1)
		}

		throw error
	}
}

// Validate and sanitize content
function validateContent(content: string): string {
	if (!content || typeof content !== 'string') {
		throw new Error('Invalid content format')
	}

	if (content.length < MIN_CONTENT_LENGTH) {
		throw new Error('Content too short for meaningful analysis')
	}

	if (content.length > MAX_CONTENT_LENGTH) {
		content = content.slice(0, MAX_CONTENT_LENGTH) + '\n[Content truncated due to length...]'
	}

	return content.replace(/```/g, "'''") // Prevent markdown confusion
}

// Get prompts for concept extraction
function getConceptExtractionPrompts(content: string) {
	const systemPrompt = `You are an expert conversation analyst specializing in identifying the most impactful and meaningful discussion topics.
		Your primary responsibility is to extract key concepts with extremely high precision and consistency.

		STRICT OUTPUT REQUIREMENTS:
		- Must return ONLY a valid JSON array of strings
		- Format: ["Concept 1", "Concept 2", "Concept 3"]
		- Return [] if no significant concepts found
		- No additional text, commentary, or explanations
		- No nested objects or arrays
		- Each concept must be 2-5 words maximum
		- Extract 3-7 concepts maximum
		- Concepts must be in Title Case

		CONCEPT SELECTION CRITERIA:
		- Must have substantial back-and-forth discussion (>3 messages)
		- Must involve multiple participants
		- Must have clear conclusions or decisions
		- Must be business/project relevant
		- Must exclude casual conversation or pleasantries
		- Must exclude one-off mentions or tangents

		CONCEPT FORMATTING RULES:
		1. Use action-oriented phrases when possible (e.g., "Database Migration Strategy")
		2. Include the specific focus area (e.g., "Frontend Performance Optimization")
		3. Be specific enough to distinguish from other topics
		4. Be general enough to group related discussions
		5. Use standard industry terminology
		6. Maintain consistent naming conventions

		INVALID CONCEPT EXAMPLES:
		- "Discussion about the thing" (too vague)
		- "John's idea about improving the database and also looking at the frontend performance issues" (too long)
		- "hello" (not a concept)
		- "misc" (not specific)

		VALID CONCEPT EXAMPLES:
		- "API Authentication Design"
		- "Database Schema Optimization"
		- "User Onboarding Flow"
		- "CI/CD Pipeline Setup"
		- "Mobile App Architecture"`

	const userPrompt = `Extract the key concepts from this conversation that represent the most important topics discussed.
		You must return strictly as a JSON array like: ["concept1", "concept2", "concept3"]
		If no significant topics are found, return an empty array: []

		Analyze this chat history:\n\`\`\`${content}\`\`\``

	return { systemPrompt, userPrompt }
}

// Get prompts for thread generation
function getThreadGenerationPrompts(content: string, concept: string) {
	const systemPrompt = `You are an expert discussion synthesizer who creates clear, structured narrative summaries.
		Your role is to transform complex conversations into coherent, engaging summaries while maintaining absolute accuracy.

		SUMMARY STRUCTURE REQUIREMENTS:
		1. Opening Context (2-3 sentences)
		   - When/how the topic emerged
		   - Initial context and importance
		
		2. Main Discussion Flow (3-5 paragraphs)
		   - Chronological or logical progression
		   - Clear transitions between subtopics
		   - Explicit participant viewpoints
		
		3. Resolution & Next Steps (1-2 paragraphs)
		   - Concrete decisions made
		   - Action items assigned
		   - Remaining open questions

		STRICT WRITING GUIDELINES:
		- Use clear, professional language
		- Maintain third-person perspective
		- Include specific examples and quotes
		- Use transitional phrases between sections
		- Break into clear paragraphs (4-6 sentences each)
		- Highlight opposing viewpoints with "However," "In contrast," etc.
		- Use active voice
		- Keep technical accuracy absolute

		MUST INCLUDE:
		- Participant names/roles when relevant
		- Specific metrics or data points discussed
		- Direct quotes for key insights
		- Timeline indicators
		- Decision rationale
		- Dissenting opinions
		- Implementation challenges
		- Risk considerations

		MUST EXCLUDE:
		- Personal commentary
		- Speculation beyond discussion
		- Off-topic tangents
		- Redundant information
		- Sensitive/confidential details
		- Informal language/emoji
		- Unresolved debates without context`

	const userPrompt = `Create a comprehensive narrative summary of all discussions related to "${concept}".

		Required Focus Areas:
		1. Topic Introduction
		   - Initial context and catalyst
		   - Why this topic emerged
		   - Who raised it first

		2. Discussion Evolution
		   - All major viewpoints presented
		   - Supporting arguments and evidence
		   - Counter-arguments and concerns
		   - Technical constraints identified
		   - Resource implications discussed

		3. Problem Resolution
		   - How conflicts were resolved
		   - Compromise solutions reached
		   - Alternative approaches considered
		   - Decision-making process
		   
		4. Concrete Outcomes
		   - Specific decisions made
		   - Assigned action items
		   - Ownership and deadlines
		   - Success metrics defined
		   - Follow-up requirements

		If this topic wasn't substantially discussed, respond only with:
		"This topic was mentioned but not substantively discussed in the conversation."

		Analyze this chat history:\n\`\`\`${content}\`\`\``

	return { systemPrompt, userPrompt }
}

// Extract concepts from content
async function extractConcepts(apiKey: string, content: string): Promise<ConceptExtractionResult> {
	try {
		const { systemPrompt, userPrompt } = getConceptExtractionPrompts(content)
		const genAI = new GoogleGenerativeAI(apiKey)
		const model = genAI.getGenerativeModel({ model: MODEL_CHEAP, systemInstruction: systemPrompt })

		const conceptsResult = await withRetry(async () => {
			const result = await model.generateContent(userPrompt)
			if (!result.response) {
				throw new Error('Empty response from Gemini API')
			}
			return result
		})

		const conceptsJson = conceptsResult.response.text()

		try {
			const concepts = JSON.parse(conceptsJson)
			if (!Array.isArray(concepts)) {
				throw new Error('Invalid concepts format')
			}
			return { concepts }
		} catch (parseError) {
			console.error('JSON parsing error:', {
				response: conceptsJson,
				error: parseError instanceof Error ? parseError.message : 'Unknown parse error',
			})
			throw parseError
		}
	} catch (error: unknown) {
		console.error('Error extracting concepts:', {
			error: error instanceof Error ? error.message : 'Unknown error',
			type: error instanceof Error ? error.constructor.name : 'Unknown',
			stack: error instanceof Error ? error.stack : undefined,
			timestamp: new Date().toISOString(),
		})
		return {
			concepts: [],
			error: `Failed to extract concepts: ${error instanceof Error ? error.message : 'Unknown error'}`,
		}
	}
}

// Generate thread summary for a concept
async function generateThreadSummary(
	apiKey: string,
	content: string,
	concept: string
): Promise<ThreadGenerationResult> {
	try {
		const { systemPrompt, userPrompt } = getThreadGenerationPrompts(content, concept)
		const genAI = new GoogleGenerativeAI(apiKey)
		const model = genAI.getGenerativeModel({ model: MODEL_CHEAP, systemInstruction: systemPrompt })

		const threadResult = await withRetry(async () => {
			return await model.generateContent(userPrompt)
		})

		return {
			concept,
			discussion: threadResult.response.text(),
		}
	} catch (error) {
		console.error(`Error processing thread for concept "${concept}":`, error)
		return {
			concept,
			discussion: 'Failed to generate discussion summary for this topic.',
		}
	}
}

// Process concepts in batches
async function processConceptBatches(
	apiKey: string,
	concepts: string[],
	content: string
): Promise<ThreadResponse[]> {
	const threads: ThreadResponse[] = []

	for (let i = 0; i < concepts.length; i += MAX_PARALLEL_THREADS) {
		const batch = concepts.slice(i, i + MAX_PARALLEL_THREADS)
		const batchPromises = batch.map((concept) => generateThreadSummary(apiKey, content, concept))
		const batchResults = await Promise.all(batchPromises)
		threads.push(...batchResults)
	}

	return threads
}

export async function POST(req: Request) {
	try {
		if (req.method !== 'POST') {
			return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
		}

		const { content, apiKey } = await req.json().catch(() => ({ content: null, apiKey: null }))

		if (!apiKey) {
			return new Response(JSON.stringify({ error: 'Gemini API key is required' }), { status: 400 })
		}

		let sanitizedContent: string
		try {
			sanitizedContent = validateContent(content)
		} catch (error) {
			return new Response(
				JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid content' }),
				{ status: 400 }
			)
		}

		// Extract concepts
		const { concepts, error: conceptsError } = await extractConcepts(apiKey, sanitizedContent)

		if (conceptsError) {
			return new Response(JSON.stringify({ error: conceptsError }), { status: 500 })
		}

		if (concepts.length === 0) {
			return new Response(
				JSON.stringify({
					concepts: [],
					threads: [],
					message: 'No significant topics found in the conversation',
				}),
				{ status: 200 }
			)
		}

		// Generate thread summaries
		const threads = await processConceptBatches(apiKey, concepts, sanitizedContent)

		const response = {
			concepts,
			threads,
			message: 'Analysis completed successfully',
		}

		return new Response(JSON.stringify(response), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store',
			},
		})
	} catch (error) {
		console.error('Error in threads route:', error)
		return new Response(
			JSON.stringify({
				error: 'Failed to process chat history',
				details: error instanceof Error ? error.message : 'Unknown error',
			}),
			{ status: 500 }
		)
	}
}
