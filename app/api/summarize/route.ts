import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: Request) {
  try {
    const { content, apiKey } = await req.json()

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Gemini API key is required' }), { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

    const prompt = `Please summarize the following text in 3-4 paragraphs, highlighting the main points and key ideas:\n\n${content}`

    const result = await model.generateContent(prompt)
    const summary = result.response.text()

    return new Response(JSON.stringify({ summary }), { status: 200 })
  } catch (error) {
    console.error('Error in summarize route:', error)
    return new Response(JSON.stringify({ error: 'Failed to summarize content' }), { status: 500 })
  }
}

