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
	discussion: {
		title: string
		threads: {
			timestamp: string
			initiator: {
				who: string
				question: string
				context: string
			}
			responses: {
				who: string
				contribution: string
				key_points: string[]
				attachments?: string
			}[]
			resolution: {
				outcome: string
				next_steps: string
				pending?: string
			}
		}[]
		related_topics: string[]
		action_items: {
			task: string
			owner: string
			deadline?: string
		}[]
		note?: string // For brief mentions
	}
}

interface ConceptExtractionResult {
	concepts: string[]
	error?: string
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

	// Additional WhatsApp-specific sanitization
	return content
		.replace(/```/g, "'''") // Prevent markdown confusion
		.replace(/\[\d{1,2}\/\d{1,2}\/\d{2,4},\s\d{1,2}:\d{2}:\d{2}\s[AP]M\]/g, '') // Remove WhatsApp timestamps
		.replace(/\u200E/g, '') // Remove LTR mark
		.replace(/\u200F/g, '') // Remove RTL mark
		.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Remove emojis
		.trim()
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
		- Extract 3-15 concepts maximum
		- Concepts must be in Title Case

		CONCEPT TYPES TO IDENTIFY:
		1. Technical Discussions
		   - Architecture decisions
		   - Implementation details
		   - Technology choices
		   - Performance issues
		   - Security concerns

		2. Project Management
		   - Timeline discussions
		   - Resource allocation
		   - Task assignments
		   - Project blockers
		   - Dependencies

		3. Decision Making
		   - Problem solving sessions
		   - Solution evaluations
		   - Trade-off discussions
		   - Risk assessments
		   - Consensus building

		4. Planning & Strategy
		   - Future roadmap
		   - Feature planning
		   - Process improvements
		   - Team organization
		   - Strategic initiatives

		CONCEPT SELECTION CRITERIA:
		- Must have substantial back-and-forth discussion (>3 messages)
		- Must involve multiple participants
		- Must have clear conclusions or decisions
		- Must be business/project relevant
		- Must exclude casual conversation or pleasantries
		- Must exclude one-off mentions or tangents
		- Must capture both resolved and unresolved important topics
		- Must include time-sensitive or urgent matters
		- Must include technical deep-dives
		- Must include planning discussions

		CONCEPT FORMATTING RULES:
		1. Use action-oriented phrases when possible (e.g., "Database Migration Strategy")
		2. Include the specific focus area (e.g., "Frontend Performance Optimization")
		3. Be specific enough to distinguish from other topics
		4. Be general enough to group related discussions
		5. Use standard industry terminology
		6. Maintain consistent naming conventions
		7. Include status indicators when relevant (e.g., "Pending API Integration")

		INVALID CONCEPT EXAMPLES:
		- "Discussion about the thing" (too vague)
		- "John's idea about improving the database and also looking at the frontend performance issues" (too long)
		- "hello" (not a concept)
		- "misc" (not specific)
		- "talked about project" (not specific enough)
		- "random chat" (not a meaningful concept)

		VALID CONCEPT EXAMPLES:
		- "API Authentication Design"
		- "Database Schema Optimization"
		- "User Onboarding Flow"
		- "CI/CD Pipeline Setup"
		- "Mobile App Architecture"
		- "Sprint Planning Discussion"
		- "Security Vulnerability Fix"
		- "Performance Bottleneck Resolution"
		- "Team Workflow Optimization"
		- "Release Schedule Planning"`

	const userPrompt = `Extract the key concepts from this conversation that represent the most important topics discussed.
			You must return strictly as a JSON array like: ["concept1", "concept2", "concept3"]
			If no significant topics are found, return an empty array: []

			Analyze this chat history:\n\`\`\`${content}\`\`\``

	return { systemPrompt, userPrompt }
}

// Get prompts for thread generation
function getThreadGenerationPrompts(content: string, concept: string) {
	const systemPrompt = `You are an expert conversation analyzer specializing in WhatsApp chat analysis.
        Your role is to transform informal WhatsApp discussions into structured, comprehensive thread summaries.

        OUTPUT STRUCTURE:
        {
            "title": "Engaging title that captures the main topic",
            "threads": [
                {
                    "timestamp": "Approximate timing or sequence",
                    "initiator": {
                        "who": "Person who started this thread",
                        "question": "The initial question/problem/suggestion",
                        "context": "Why this was brought up"
                    },
                    "responses": [
                        {
                            "who": "Responder's name",
                            "contribution": "Their response or solution",
                            "key_points": ["Main points they made"],
                            "attachments": "Any files/links shared (if mentioned)"
                        }
                    ],
                    "resolution": {
                        "outcome": "What was decided or concluded",
                        "next_steps": "Actions to be taken",
                        "pending": "Any unresolved items"
                    }
                }
            ],
            "related_topics": ["Other concepts discussed that connect to this thread"],
            "action_items": [
                {
                    "task": "Specific action to be taken",
                    "owner": "Person responsible",
                    "deadline": "Timeline if mentioned"
                }
            ]
        }

        ANALYSIS REQUIREMENTS:
        - Capture every distinct question or problem raised
        - Track all responses and solutions proposed
        - Note when topics branch into sub-discussions
        - Identify when previous topics are revisited
        - Maintain chronological order while grouping related messages
        - Track decisions and changes in direction
        - Note any shared resources (files, links, images mentioned)

        CONVERSATION PATTERNS TO TRACK:
        - Question-Answer sequences
        - Problem-Solution discussions
        - Decision-making processes
        - Task assignments
        - Status updates
        - Technical debates
        - Planning discussions
        - Resource sharing
        - Agreement/disagreement points

        CONTEXT PRESERVATION:
        - Capture time gaps between messages if significant
        - Note when conversations resume after breaks
        - Track topic evolution over time
        - Maintain references to previous discussions
        - Note when external meetings/calls are mentioned
        - Track dependencies between different discussion threads

        MUST INCLUDE:
        - All significant questions raised
        - Every distinct solution proposed
        - All decisions made (even if later changed)
        - Resource sharing and references
        - Task assignments and volunteers
        - Timeline commitments
        - Technical specifications
        - Concerns and roadblocks
        - External dependencies
        - Follow-up items

        MUST EXCLUDE:
        - Social chitchat unrelated to topics
        - Repeated information
        - Personal comments unrelated to work
        - Emojis and reactions unless they indicate decisions
        - Side conversations without substance

        If a topic wasn't substantially discussed, respond with:
        {
            "title": "Brief mention: [topic]",
            "threads": [],
            "note": "This topic was only briefly mentioned without substantial discussion."
        }`

	const userPrompt = `Create a comprehensive thread summary of all discussions related to "${concept}".
        Focus on capturing the complete conversation flow, including all questions, answers, and decisions.
        Ensure no significant points are missed, even if they seem minor.
        
        Analyze this WhatsApp chat history:\n\`\`\`${content}\`\`\``

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

		// Clean up the response by removing markdown code blocks and extra whitespace
		const conceptsJson = conceptsResult.response
			.text()
			.replace(/```json\n?/g, '')
			.replace(/```\n?/g, '')
			.trim()

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
): Promise<ThreadResponse> {
	try {
		const { systemPrompt, userPrompt } = getThreadGenerationPrompts(content, concept)
		const genAI = new GoogleGenerativeAI(apiKey)
		const model = genAI.getGenerativeModel({ model: MODEL_CHEAP, systemInstruction: systemPrompt })

		const threadResult = await withRetry(async () => {
			const result = await model.generateContent(userPrompt)
			if (!result.response) {
				throw new Error('Empty response from Gemini API')
			}

			// Clean up the response text by removing markdown code blocks
			const cleanedResponse = result.response
				.text()
				.replace(/```json\n?/g, '')
				.replace(/```\n?/g, '')
				.trim()

			// Validate JSON structure
			const response = JSON.parse(cleanedResponse)
			if (!response.title || !response.threads) {
				throw new Error('Invalid response structure')
			}

			return response
		})

		return {
			concept,
			discussion: threadResult,
		}
	} catch (error) {
		console.error('Thread generation error:', {
			concept,
			error: error instanceof Error ? error.message : 'Unknown error',
			timestamp: new Date().toISOString(),
			type: error instanceof Error ? error.constructor.name : 'Unknown',
		})

		return {
			concept,
			discussion: {
				title: `Error Processing: ${concept}`,
				threads: [],
				related_topics: [],
				action_items: [],
				note: 'Failed to generate discussion summary for this topic.',
			},
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
