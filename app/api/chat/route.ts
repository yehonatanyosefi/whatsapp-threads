import { Configuration, OpenAIApi } from 'openai-edge'
import { OpenAIStream, StreamingTextResponse } from 'ai'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'edge'

export async function POST(req: Request) {
  const { messages, model, apiKey } = await req.json()

  if (model === 'openai') {
    const config = new Configuration({
      apiKey: apiKey || process.env.OPENAI_API_KEY
    })
    const openai = new OpenAIApi(config)

    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      stream: true,
      messages
    })
    const stream = OpenAIStream(response)
    return new StreamingTextResponse(stream)
  } else if (model === 'gemini') {
    if (!apiKey) {
      return new Response('Gemini API key is required', { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

    const chat = model.startChat({
      history: messages.slice(0, -1).map((m: any) => ({ role: m.role, parts: m.content })),
    })

    const result = await chat.sendMessage(messages[messages.length - 1].content)
    const response = result.response
    const text = response.text()

    return new Response(text)
  } else {
    return new Response('Invalid model specified', { status: 400 })
  }
}

