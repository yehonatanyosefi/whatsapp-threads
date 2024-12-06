import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { createSupabaseAdminClient } from '@/lib/utils'
import { WhatsAppAnalysisPreview } from './WhatsAppAnalysisPreview'
import type { Metadata } from 'next'

type PageProps = {
	params: {
		threadId: string
	}
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	return {
		title: `Thread #${params.threadId}`,
	}
}

export default async function Page({ params }: PageProps) {
	const { threadId } = params

	const supabase = createSupabaseAdminClient()

	const { data: thread, error } = await supabase
		.from('threads')
		.select('id, concepts, thread_data')
		.eq('id', threadId)
		.single()

	if (error) {
		console.error('Error fetching thread:', error)
		return <div>Error loading thread</div>
	}

	if (!thread) {
		return <div>Thread not found</div>
	}

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Header />
			<WhatsAppAnalysisPreview
				id={thread.id}
				concepts={thread.concepts}
				threads={thread.thread_data.threads}
			/>
			<Footer />
		</div>
	)
}
