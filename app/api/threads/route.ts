import { ConceptExtractionResult, ThreadResponse, ThreadsApiResponse } from '@/lib/types'
import { createSupabaseAdminClient, isProduction } from '@/lib/utils'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Constants for configuration
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // ms
const MAX_CONTENT_LENGTH = 100000 // characters
const MIN_CONTENT_LENGTH = 50
const MAX_PARALLEL_THREADS = 10

const MODEL_CHEAP = 'gemini-1.5-flash'

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

// Add these helper functions at the top with other constants
function parseWhatsAppDate(timestamp: string): Date | null {
	// Remove brackets if present
	timestamp = timestamp.replace(/[\[\]]/g, '')

	// Different format patterns
	const patterns = [
		// 12-hour formats
		{
			regex: /(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s(\d{1,2}):(\d{2}):?(\d{2})?\s?(AM|PM)?/,
			handler: (matches: string[]) => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const [_, month, day] = matches
				const [, , , , , minutes, seconds = '00', period] = matches
				let [, , , year, hours] = matches
				// Adjust year if needed
				year = year.length === 2 ? '20' + year : year
				// Convert to 24-hour format if needed
				if (period) {
					hours = String(
						period === 'PM'
							? parseInt(hours) === 12
								? 12
								: parseInt(hours) + 12
							: parseInt(hours) === 12
							? 0
							: parseInt(hours)
					)
				}
				return new Date(
					`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(
						2,
						'0'
					)}:${minutes}:${seconds}`
				)
			},
		},
		// 24-hour formats
		{
			regex: /(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s(\d{2}):(\d{2})/,
			handler: (matches: string[]) => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const [_, month, day, year, hours, minutes] = matches
				return new Date(
					`${year.length === 2 ? '20' + year : year}-${month.padStart(2, '0')}-${day.padStart(
						2,
						'0'
					)}T${hours}:${minutes}:00`
				)
			},
		},
		// Add more patterns as needed
	]

	for (const pattern of patterns) {
		const matches = timestamp.match(pattern.regex)
		if (matches) {
			try {
				return pattern.handler(matches)
			} catch (e) {
				console.error('Date parsing error:', e)
				return null
			}
		}
	}
	return null
}

function standardizeTimestamp(timestamp: string): string {
	const date = parseWhatsAppDate(timestamp)
	if (!date) return timestamp // Return original if parsing fails
	return date.toISOString() // Or any other standard format you prefer
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

	// Standardize timestamps instead of removing them
	return content
		.replace(/```/g, "'''") // Prevent markdown confusion
		.replace(
			/\[?\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4},\s\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM)?\]?\s?-?/g,
			(match) => standardizeTimestamp(match)
		)
		.replace(/\u200E/g, '') // Remove LTR mark
		.replace(/\u200F/g, '') // Remove RTL mark
		.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Remove emojis
		.trim()
}

// Get prompts for concept extraction
function getConceptExtractionPrompts(content: string) {
	const systemPrompt = `You are an expert in analyzing group chat conversations to identify the most significant and meaningful topics discussed.

STRICT OUTPUT REQUIREMENTS:
- Return ONLY a valid JSON array of strings.
- Format: ["Topic 1", "Topic 2", "Topic 3"]
- Return [] if no significant topics are found.
- No additional text or explanations.
- Each topic must be 2-6 words maximum.
- Extract 3-15 topics maximum. Try to extract as many as possible.
- Topics must be in Title Case.

ANALYSIS GUIDELINES:
- Recognize topics regardless of language used.
- Understand informal language, slang, and abbreviations.
- Identify and group related messages into coherent topics.
- Focus on topics that are important, time-sensitive, or require action.
- Ignore spam, automated messages, and irrelevant content.
- Ensure privacy by excluding sensitive personal data.

TOPIC TYPES TO IDENTIFY (but not limited to):
1. **Announcements and News**
   - Important updates
   - Personal milestones
   - Group events

2. **Plans and Scheduling**
   - Event planning
   - Meeting coordination
   - Deadline discussions

3. **Questions and Assistance**
   - Requests for help
   - Advice seeking
   - Problem-solving

4. **Decisions and Agreements**
   - Group consensus
   - Polls or votes
   - Policy updates

5. **Tasks and Action Items**
   - Assignments
   - Responsibilities
   - Next steps

6. **Feedback and Opinions**
   - Reviews
   - Suggestions
   - Preferences

7. **Social and Emotional Interactions**
   - Celebrations
   - Support messages
   - Humor and jokes

8. **Information Sharing**
   - Resources and links
   - Articles and news
   - Educational content

TOPIC SELECTION CRITERIA:
- Involves multiple participants.
- Contains significant back-and-forth discussion.
- Has impact on the group or individuals.
- Is relevant for future reference.
- Reflects decisions, plans, or important information.

INVALID TOPIC EXAMPLES:
- "Chatting" (too vague)
- "Just saying hi" (not significant)
- "Random thoughts" (not specific)

VALID TOPIC EXAMPLES:
- "Project 'Zersal' Deadline Extension"
- "Family Reunion Plans"
- "Website Launch Date (May 15th)"
- "Technical Issue with App - Can't login"
- "Vacation Recommendations For Fuji"
- "Alex Farewell Party Planning"
- "Emergency Procedures Update"
- "Made fun of David for his new haircut"
- "Discussed the new product's name"
- "Josh made a mistake with the pizza order"
`

	const userPrompt = `Extract the key topics from this group chat conversation.
Focus on identifying the most significant discussions that are important for participants to be aware of or may require action.
Return strictly as a JSON array: ["Topic 1", "Topic 2", "Topic 3"].
If no significant topics are found, return: [].

Analyze this chat history:
\`\`\`
${content}
\`\`\``

	return { systemPrompt, userPrompt }
}

// Get prompts for thread generation
function getThreadGenerationPrompts(content: string, concept: string) {
	const systemPrompt = `You are an expert in summarizing group chat conversations into clear, concise, and actionable summaries.

OUTPUT STRUCTURE:
{
    "title": "Descriptive title of the topic",
    "language": "Language code (e.g., 'en' for English)",
    "threads": [
        {
            "timestamp": "Approximate date/time range",
            "participants": ["Names or identifiers of active participants"],
            "summary": "An extremely detailed summary of the discussion",
            "attachments": ["Important links or files shared"],
            "unresolved_questions": ["Questions that were not answered"],
            "notes": "Additional important details"
        }
    ],
    "related_topics": ["Other topics connected to this discussion"],
    "follow_ups": [
        {
            "task": "Follow-up action required",
            "assigned_to": "Person responsible",
            "due_date": "Deadline or time frame",
            "status": "Pending|In Progress|Completed"
        }
    ]
}

ANALYSIS GUIDELINES:
- Maintain the original context and intent of messages.
- Recognize and interpret informal language, slang, and abbreviations.
- Capture emotional tones such as humor, excitement, frustration, or support.
- Identify and summarize decisions, agreements, and outcomes.
- Highlight action items with responsibilities and deadlines.
- Mention important dates, events, or deadlines.
- Include relevant attachments, links, or shared media.
- Respect privacy by excluding sensitive personal information.
- Organize information logically and chronologically.
- Ignore spam, irrelevant messages, and off-topic conversations.
- Note any shifts in topics or conversation flow.
- Differentiate between individual opinions and group consensus.
- Identify any conflicts or disagreements and their resolutions.

EXAMPLE OF BAD SUMMARIES (DO NOT WRITE LIKE THIS):
- "The team discussed various options for the project."
- "Several participants offer suggestions and support."
- "There's a general positive, collaborative tone."
- "Members shared different viewpoints about the proposal."
- "The group talked about scheduling and made some decisions."

EXAMPLE OF GOOD SUMMARIES (WRITE LIKE THIS):
- "A critical discussion about team communication tools began on March 15th at 10:15 AM EST when Sarah Chen (Tech Lead, previously at Stripe) presented a detailed analysis of Slack Enterprise. Her presentation highlighted specific integrations: GitHub Enterprise (for PR notifications, code reviews, and deployment alerts), Jira Premium (for ticket tracking and sprint management), and Slack's Custom API capabilities (specifically WebSockets for real-time updates and REST API for automation). Sarah demonstrated how their current code review process, which averages 4.2 hours per review, could be reduced to 1.5 hours by connecting GitHub PR notifications with dedicated Slack channels and implementing custom ChatOps workflows. John Martinez (Backend Lead, ex-Twilio) and Maria Kovac (DevOps Lead, AWS Certified Solutions Architect) strongly supported the proposal, with Maria specifically highlighting Slack's AWS CloudWatch integration features including custom CloudWatch metric alerts, Lambda function logs, and ECS container health monitoring. Pete Davidson (Finance Director) raised concerns about the Slack Enterprise Grid pricing ($8/user/month with annual commitment), presenting a detailed spreadsheet showing a projected annual cost of $15,360 for their 160-person team across 5 departments (Engineering, Product, Sales, Customer Success, and Operations). The team explored alternatives including Discord ($4.99/user/month, lacking SSO) and Microsoft Teams (included in current E3 license at $23/user/month). After comparing 15 key features (documented in Pete's spreadsheet 'Communication-Tools-Comparison-2024.xlsx'), the group determined Slack's developer-focused features would offset the cost through improved productivity, projecting a 20% reduction in communication overhead based on Sarah's previous experience at Stripe. A formal vote was conducted at 11:00 AM, resulting in 7-3 in favor of Slack adoption (documented in meeting-notes.md). Tom Wilson (CTO) approved the budget at 11:30 AM and assigned key responsibilities: Sarah to create implementation plan by Tuesday (March 19th), focusing on data migration from Microsoft Teams (estimated 18 months of historical data, 250GB); Maria to document security requirements including SSO configuration via Okta and DLP policies; John to establish coding guidelines for ChatOps integrations. First department migration (Engineering team of 45 people) scheduled for April 1st, with full company migration to be completed by May 15th."
- "A comprehensive infrastructure modernization initiative was discussed between March 12th-14th, initiated by Yonatan Levy (Infrastructure Lead, previously Site Reliability Engineer at Wix) who presented a detailed analysis of their current development pipeline issues. The presentation identified three critical bottlenecks: 1) Deployment processes averaging 45 minutes (compared to industry standard of 15-20 minutes) due to sequential testing and manual approvals, 2) Limited visibility across their five remote teams (Singapore GMT+8, Tel Aviv GMT+2, London GMT, New York GMT-5, and Berlin GMT+1), and 3) Inconsistent project tracking across 12 different repositories and 3 project management tools (Jira, Trello, and internal tools). Yonatan proposed Monday.com Enterprise ($16/user/month) as a centralized solution, sharing a 45-slide comparison with alternatives: Jira Premium ($14/user/month), ClickUp Enterprise ($12/user/month), and Asana Business ($19.99/user/month). His proof of concept, developed over two weeks, demonstrated Monday.com's integration capabilities with their existing stack: Jenkins CI/CD pipeline (v2.401.1), Docker registry (self-hosted v20.10.23), and AWS services (including ECS, EKS, and ECR). The custom automation workflow he built showed potential to reduce deployment times to 18 minutes through parallel test execution and automated dependency checks using Monday.com's GraphQL API. Alex Thompson (Project Lead, managing 8 teams across 3 continents) strongly endorsed the proposal after testing the workflows for two days, particularly highlighting the automated sprint planning feature that accommodates multiple time zones and the capacity management dashboard that factors in regional holidays and working hours. Dana Kim (Team Lead, Singapore) expressed concerns about the learning curve for her 12-person team, citing previous challenges with tool transitions. The group agreed to address this through a phased rollout: Phase 1 (Tel Aviv team, 15 people) - March 25th to April 15th; Phase 2 (London & Berlin teams, 28 people) - April 16th to May 7th; Phase 3 (New York & Singapore teams, 32 people) - May 8th to May 30th. The final agreement included a $15/month/user budget ($28,800 annual for 160 users), approved by Finance with quarterly ROI reviews scheduled for Q3 and Q4 2024. Implementation deadlines were set: infrastructure setup by March 20th (Yonatan), training program development by March 22nd (Alex), and documentation in four languages (English, Hebrew, German, and Mandarin) by March 24th (Dana coordinating with regional leads). The transition plan includes 2-hour daily office hours in each regional time zone and a dedicated Slack channel (#monday-migration) for support."
- "The family's Passover planning discussion began when Mom (Rachel Cohen, host for the past 8 years) shared concerns about Grandma Sarah's mobility issues affecting the traditional seder location. The conversation, spanning from March 10th evening (6:45 PM EST) to March 11th afternoon (3:20 PM EST), involved all 15 family members across three generations. David Cohen (eldest son, homeowner in Newton, MA - 15 minutes from Grandma's assisted living facility) proposed hosting at his newly renovated house, detailing its accessibility features including no stairs, wider doorways (36 inches) for Grandma's walker, and a first-floor bathroom with ADA-compliant fixtures. Sarah Cohen (youngest daughter, traditionally helps with cooking) initially opposed, citing the 8-year tradition of hosting at Mom's house in Brookline, but changed her position after Lisa Cohen (David's wife, interior designer) shared photos of their new dining room setup that could accommodate 22 people comfortably with two tables: a main table (seats 15) and a children's table (seats 7). The group extensively discussed dietary requirements: Jake's (David's son) new gluten sensitivity (diagnosed January 2024), Emily's (Sarah's partner) three vegetarian guests, and keeping strictly kosher for Uncle Joe's family (Orthodox, requires separate meat/dairy dishes). Aunt Mary (professional event planner) volunteered to coordinate the potluck assignments using a shared Google Sheet ('Passover 2024 Menu Planning'), which she created and shared by 8 PM. The final arrangement included David hosting (address: 123 Oak Street, Newton), Mom bringing her traditional brisket (recipe from Grandma Rose, circa 1955) with Lisa learning the recipe as backup, and specific arrival times set for 4 PM to help Grandma settle in before the traditional start time of 5:30 PM. A separate kids' table was planned for the seven children under 12 (ages 4-11), with Hannah (15, Red Cross babysitting certified) assigned to supervise. The family agreed to split the costs of hiring a professional cleaner for post-seder cleanup ($180, recommended by Lisa's synagogue), and Michael (Sarah's husband, works near Grandma) offered to coordinate Uber Health arrangements for Grandma (estimated $45 round trip, covered by David). Rabbi Goldstein (family's rabbi for 20 years) will attend from 5:30-7:30 PM to lead the traditional elements of the seder."
- "דיון מעמיק התפתח בקבוצת החברים לגבי טיול השנתי המסורתי (המתקיים זו השנה העשירית), שהחל כשדני לוי (מארגן הטיול בשנתיים האחרונות, מדריך טיולים מוסמך) העלה הצעה לטיול ג'יפים בדרום ב-8 במרץ בשעה 20:15. במהלך שיחה של יומיים, שכללה 42 הודעות קוליות ו-15 תמונות ממסלולים קודמים (כולל תמונות ממסלול מצדה-עין גדי משנת 2023), נדונו אפשרויות שונות. רוני כהן (אחראי לוגיסטיקה, קצין רכב לשעבר בצה"ל) הציג ניתוח מפורט של שלוש חברות השכרת ג'יפים, כולל הצעות מחיר: 'דרך הטיולים' (850 ש״ח ליום לג'יפ סוזוקי ג'ימני 2023, כולל ביטוח חובה ומקיף), 'מסעות המדבר' (780 ש״ח עם ביטוח מקיף וציוד קמפינג בסיסי) ו'טיולי הנגב' (920 ש״ח כולל GPS מקצועי וערכת חילוץ). מיכל ברק (מנהלת חשבונות) הביעה דאגה לגבי העלויות, והציגה סקר מפורט (באמצעות טופס Google Forms) שהראה ש-4 מתוך 12 חברי הקבוצה מתקשים עם התקציב המוצע של 1,200 ש״ח לאדם (כולל דלק, אוכל, וציוד). בתגובה, יעל שטרן (מנהלת מכירות בחברת 'תיירות אתגרית') הצליחה להשיג הנחה של 15% מ'דרך הטיולים' עבור הזמנה מוקדמת, והציעה לחלק את התשלום ל-3 תשלומים ללא ריבית. הקבוצה דנה באריכות במסלול המוצע, כאשר עמית גולן (מדריך טיולים מוסמך ממשרד התיירות, מספר רישיון 12345) הכין מפה מפורטת ב-Wikiloc הכוללת 3 ימי מסלול: יום 1 - מצפה רמון וחאן בארות (כולל לינת שטח), יום 2 - מכתש רמון ונחל ארדון, יום 3 - הר הנגב ובורות לוץ. המסלול כולל נקודות עניין מדויקות (עם קואורדינטות GPS), מקומות לינה, ונקודות מים מאושרות על ידי רשות הטבע והגנים. לאחר דיון ער בWhatsApp (קבוצת 'טיול שנתי 2024') לגבי תאריכים אפשריים, סוכם על סוף שבוע ארוך בחודש מאי (16-18), עם אפשרות להארכה ליום רביעי למי שיכול. נקבע תאריך יעד לתשלום מקדמה (1 לאפריל, 300 ש"ח לאדם), ודני מונה כאחראי על תיאום ההזמנות מול חברת הג'יפים. אבי כהן (חובש מוסמך) מונה כאחראי רפואה, ורותם לוי (שף) כאחראית על תכנון התפריט והציוד."
- "The SaaS Builders community (a 15,000-member Slack group for SaaS founders and technical leaders) experienced a pivotal discussion around AI implementation strategies, triggered by Elena Rodriguez's (founder of DataMetrics.io, previously ML Lead at Databricks) comprehensive breakdown of her company's recent GPT-4 integration. The conversation, which generated over 200 responses in 24 hours (March 13th, 9:00 AM - March 14th, 9:00 AM PST), began with Elena sharing detailed metrics from their first 90 days of implementation: a 47% reduction in customer support response time (from 15 minutes to 8 minutes average), 32% improvement in first-contact resolution (from 61% to 93%), and a surprising 28% increase in customer satisfaction scores (from NPS 45 to NPS 73). She provided a thorough technical breakdown in a shared GitHub repository (github.com/datametrics/ai-support-framework), including their custom prompt engineering approach (using few-shot learning with 150 curated examples), rate limiting solutions (implementing Token Bucket algorithm with Redis), and integration with their existing Zendesk setup (via custom middleware built on Node.js 18.x). The discussion gained significant momentum when Marcus Chen (CTO at ScaleRight, processing 2M+ API calls/day) challenged some assumptions about token costs, presenting his company's analysis showing potential hidden expenses in fine-tuning and API calls (approximately $12,000/month for their scale of 500k daily customer interactions). This sparked an extensive debate about ROI calculations, with Sarah Johnson from PricingAI contributing a detailed spreadsheet template ('AI-Cost-Calculator-v3.xlsx') for calculating true AI implementation costs, including often-overlooked factors like prompt engineering time (avg. $150/hour) and model fine-tuning costs ($2,500-5,000 per custom model). The community particularly focused on Chris Thompson's (founder of DevFlow, YC W23) experience with hybrid approaches, combining ChatGPT-4 (for creative tasks like email drafting and feature ideation) with Claude 2.1 for analytical processes (data analysis and code review), which he documented with actual code snippets and performance comparisons in a comprehensive Medium article ('Hybrid AI Architecture at Scale', published March 14th). The discussion evolved into planning a community knowledge base, with Rachel Park (community manager, previously at Stack Overflow) creating a dedicated GitHub repository (github.com/saasbuilders/ai-implementation-patterns) for sharing implementation patterns. The group agreed on weekly case study presentations, scheduled for Thursdays at 11:00 AM PST, with the first three speakers confirmed: Elena focusing on support automation (March 21st), Marcus covering cost optimization (March 28th), and Chris demonstrating hybrid AI architectures (April 4th). Additionally, a monthly 'AI Implementation Office Hours' was established, scheduled for every first Thursday from 2-4 PM PST, with rotating experts from the community serving as mentors. All sessions will be recorded and shared on the community's new YouTube channel ('SaaS Builders AI Hub'), with transcripts and code samples available on GitHub."


SUMMARY MUST INCLUDE:
1. Who specifically made each suggestion/decision
2. What exactly was suggested (with specific details/numbers when available)
3. How others responded to the suggestion
4. What was the final outcome or next steps
5. Any relevant context that helps understand the significance
6. Specific timeframes or deadlines mentioned
7. Detailed explanation of all the mentioned taglines, acronyms, and abbreviations, tools, places

LANGUAGE HANDLING RULES:
1. Detect the primary language of the conversation
2. Keep all JSON keys in English (e.g., "title", "summary", "participants")
3. Write all content values in the detected language
4. Status values should remain in English: "Pending", "In Progress", "Completed"
5. Dates and timestamps should use a consistent format regardless of language

EXAMPLE OUTPUT IN HEBREW:
{
    "title": "דיון על שינויים בתקציב החברה",
    "language": "he",
    "threads": [
        {
            "timestamp": "2024-03-15 10:00-11:30",
            "participants": ["יונתן", "רחל", "דוד"],
            "summary": "יונתן הציע להגדיל את תקציב השיווק ב-20%. רחל תמכה ברעיון והציגה נתונים מהרבעון האחרון. דוד הסכים והוסיף שיש לבחון מחדש את ההקצאה בעוד שלושה חודשים.",
            "attachments": ["דוח תקציב Q1.pdf"],
            "unresolved_questions": ["כיצד נמדוד את ההשפעה של הגדלת התקציב?"],
            "notes": "נדרש אישור סופי מההנהלה"
        }
    ],
    "related_topics": ["תכנון תקציבי 2024", "יעדי צמיחה"],
    "follow_ups": [
        {
            "task": "הכנת מצגת לישיבת הנהלה",
            "assigned_to": "רחל",
            "due_date": "2024-03-20",
            "status": "In Progress"
        }
    ]
}

LANGUAGE AND CULTURAL CONTEXT:
- Be sensitive to cultural nuances and expressions.
- Handle multilingual conversations appropriately.
- Use the primary language of the conversation for the summary.

RESPONSE RULES:
1. Ensure all required fields in the output structure are completed.
2. Be concise but include all important details.
3. Use clear and natural language appropriate for participants.
4. If the topic was only briefly mentioned, note it accordingly.
5. Do not include any additional text outside the JSON structure.

`

	const userPrompt = `Summarize the discussions related to "${concept}" from the group chat.
Focus on capturing important details, decisions, action items, emotional tones, and any unresolved questions.
Ensure the summary is useful for participants who may have missed the conversation.

Analyze this chat history:
\`\`\`
${content}
\`\`\``

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
			const cleanedResponse = result.response
				.text()
				.replace(/```json\n?/g, '')
				.replace(/```/g, '')
				.trim()

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
				language: 'en',
				threads: [],
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

function filterLastMonth(content: string): string {
	const oneMonthAgo = new Date()
	oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

	// Split content into lines and filter
	return content
		.split('\n')
		.filter((line) => {
			const timestampMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
			if (!timestampMatch) return true // Keep lines without timestamps
			const messageDate = new Date(timestampMatch[0])
			return messageDate >= oneMonthAgo
		})
		.join('\n')
}

export async function POST(req: Request): Promise<Response> {
	try {
		if (req.method !== 'POST') {
			return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
		}

		const { content, apiKey, onlyLastMonth } = await req.json().catch(() => ({
			content: null,
			apiKey: null,
			onlyLastMonth: true,
		}))

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
		if (onlyLastMonth) {
			sanitizedContent = filterLastMonth(sanitizedContent)
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

		// Only save to Supabase in production
		let savedThread = null
		if (isProduction()) {
			const supabase = createSupabaseAdminClient()
			const { data, error: saveError } = await supabase
				.from('threads')
				.insert({
					content,
					concepts,
					thread_data: { threads },
				})
				.select('id, share_id')
				.single()

			if (saveError) throw saveError
			savedThread = data
			console.log('Saved to Supabase with ID:', savedThread.id, 'Share ID:', savedThread.share_id)
		}

		const response: ThreadsApiResponse = {
			concepts,
			threads,
			message: 'Analysis completed successfully',
			id: savedThread?.id,
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
