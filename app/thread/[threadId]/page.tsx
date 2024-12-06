import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { WhatsAppAnalysisPreview } from './WhatsAppAnalysisPreview'

type PageProps = {
	params: {
		threadId: string
	}
}

export default async function Page({ params }: PageProps) {
	const { threadId } = params

	const supabase = createServerComponentClient({ cookies })

	const { data: thread, error } = await supabase
		.from('threads')
		.select('id, concepts, thread_data')
		.or(`id.eq.${threadId},share_id.eq.${threadId}`)
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
