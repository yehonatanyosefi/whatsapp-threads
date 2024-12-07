export interface ThreadResponse {
	concept: string
	discussion: ThreadDiscussion
}
export type ThreadDiscussion = {
	title: string
	language: string
	threads: Array<{
		timestamp: string
		participants: string[]
		additional_context?: string
		summary: string
		attachments?: string[]
		unresolved_questions?: string[]
		notes?: string
	}>
	follow_ups?: Array<{
		task: string
		assigned_to?: string
		due_date?: string
		status?: string
	}>
}

export interface ConceptExtractionResult {
	concepts: string[]
	error?: string
}

export interface ThreadsApiResponse {
	concepts: string[]
	threads: ThreadResponse[]
	message: string
	id?: string
	error?: string
}
