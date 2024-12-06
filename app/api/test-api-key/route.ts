import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: Request) {
	try {
		const { apiKey } = await req.json()

		if (!apiKey) {
			return new Response(JSON.stringify({ error: 'API key is required' }), { status: 400 })
		}

		const genAI = new GoogleGenerativeAI(apiKey)
		const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

		// Test the API key with a simple prompt
		const result = await model.generateContent('Hello, World!')
		const response = result.response

		if (response) {
			return new Response(JSON.stringify({ success: true }), { status: 200 })
		} else {
			throw new Error('Failed to generate content')
		}
	} catch (error) {
		console.error('Error testing API key:', error)
		return new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 400 })
	}
}
