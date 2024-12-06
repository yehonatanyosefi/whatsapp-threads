import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai'

// Constants for configuration
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // ms
const MAX_CONTENT_LENGTH = 100000 // characters
const MIN_CONTENT_LENGTH = 50
const MAX_PARALLEL_THREADS = 10

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
		Your task is to extract the core concepts that shaped this conversation.

		Guidelines for concept extraction:
		- Focus on substantial topics that drove meaningful discussion
		- Identify breakthrough ideas or key decisions
		- Look for themes that multiple participants engaged with
		- Include problems raised AND their proposed solutions
		- Capture innovative ideas or unique perspectives shared

		Requirements:
		- Return ONLY a valid JSON array of strings
		- Each concept should be clear and specific (2-5 words)
		- Extract 3-7 most significant concepts
		- Exclude small talk or tangential topics
		- Format concepts as action-oriented phrases when possible
		- If no clear concepts are found, return an empty array []

		Example format: ["API Authentication Design", "Database Schema Optimization", "User Onboarding Flow"]`

	const userPrompt = `Extract the key concepts from this conversation that represent the most important topics discussed.
		Return strictly as a JSON array like: ["concept1", "concept2", "concept3"]
		If no significant topics are found, return an empty array: []

		Analyze this chat history:\n\`\`\`${content}\`\`\``

	return { systemPrompt, userPrompt }
}

// Get prompts for thread generation
function getThreadGenerationPrompts(content: string, concept: string) {
	const systemPrompt = `You are an expert discussion synthesizer who creates engaging narrative summaries of complex conversations.

		Guidelines for creating thread summaries:
		- Structure the summary as a flowing discussion with clear progression
		- Highlight key participant contributions and different viewpoints
		- Include specific examples, decisions, and action items discussed
		- Show how initial ideas evolved into final conclusions
		- Maintain participants' original insights while removing redundancy
		- Use transitional phrases to show how the discussion developed
		- Format in clear paragraphs with natural breaks between subtopics
		- If no relevant discussion is found, indicate that clearly

		Your summary should read like a well-crafted story of how the ideas developed, capturing both the content and the collaborative nature of the discussion.`

	const userPrompt = `Create an engaging narrative summary of all discussions related to "${concept}".

		Focus areas:
		- How was this topic first introduced?
		- What were the main viewpoints or approaches suggested?
		- What challenges or concerns were raised?
		- How did the group work through disagreements?
		- What solutions or decisions were reached?
		- What next steps or action items were identified?

		If this topic wasn't substantially discussed, indicate that briefly.

		Use the chat history below to create a cohesive story of this discussion thread:
		\`\`\`${content}\`\`\``

	return { systemPrompt, userPrompt }
}

// Extract concepts from content
async function extractConcepts(
	model: GenerativeModel,
	content: string
): Promise<ConceptExtractionResult> {
	try {
		const { systemPrompt, userPrompt } = getConceptExtractionPrompts(content)

		const conceptsResult = await withRetry(async () => {
			return await model.generateContent({
				contents: [
					{ role: 'system', parts: [{ text: systemPrompt }] },
					{ role: 'user', parts: [{ text: userPrompt }] },
				],
			})
		})

		const conceptsJson = conceptsResult.response.text()
		const concepts = JSON.parse(conceptsJson)

		if (!Array.isArray(concepts)) {
			throw new Error('Invalid concepts format')
		}

		return { concepts }
	} catch (error) {
		console.error('Error extracting concepts:', error)
		return {
			concepts: [],
			error: 'Failed to extract concepts from chat history',
		}
	}
}

// Generate thread summary for a concept
async function generateThreadSummary(
	model: GenerativeModel,
	content: string,
	concept: string
): Promise<ThreadGenerationResult> {
	try {
		const { systemPrompt, userPrompt } = getThreadGenerationPrompts(content, concept)

		const threadResult = await withRetry(async () => {
			return await model.generateContent({
				contents: [
					{ role: 'system', parts: [{ text: systemPrompt }] },
					{ role: 'user', parts: [{ text: userPrompt }] },
				],
			})
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
	model: GenerativeModel,
	concepts: string[],
	content: string
): Promise<ThreadResponse[]> {
	const threads: ThreadResponse[] = []

	for (let i = 0; i < concepts.length; i += MAX_PARALLEL_THREADS) {
		const batch = concepts.slice(i, i + MAX_PARALLEL_THREADS)
		const batchPromises = batch.map((concept) => generateThreadSummary(model, content, concept))
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

		const genAI = new GoogleGenerativeAI(apiKey)
		const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

		// Extract concepts
		const { concepts, error: conceptsError } = await extractConcepts(model, sanitizedContent)

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
		const threads = await processConceptBatches(model, concepts, sanitizedContent)

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
