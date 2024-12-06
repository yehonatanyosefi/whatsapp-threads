import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: Request) {
	try {
		const { content, apiKey } = await req.json()

		if (!apiKey) {
			return new Response(JSON.stringify({ error: 'Gemini API key is required' }), { status: 400 })
		}

		const genAI = new GoogleGenerativeAI(apiKey)
		const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

		const systemPrompt =
			'You are a professional summarizer. Your task is to create clear, concise summaries that capture the main points and key ideas of any given text. Focus on maintaining accuracy while condensing the information.'

		const userPrompt = `Please summarize the following text delimited by triple backticks in 3-4 paragraphs:\n\n\`\`\`${content}\`\`\``

		const result = await model.generateContent({
			contents: [
				{ role: 'system', parts: [{ text: systemPrompt }] },
				{ role: 'user', parts: [{ text: userPrompt }] },
			],
		})
		const summary = result.response.text()

		return new Response(JSON.stringify({ summary }), { status: 200 })
	} catch (error) {
		console.error('Error in summarize route:', error)
		return new Response(JSON.stringify({ error: 'Failed to summarize content' }), { status: 500 })
	}
}
