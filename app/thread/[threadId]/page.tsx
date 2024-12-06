import { Concepts } from '@/components/Concepts'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Threads } from '@/components/Threads'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

type PageProps = {
	params: {
		threadId: string
	}
}

export default async function Page({ params }: PageProps) {
	const { threadId } = params

	const supabase = createServerComponentClient({ cookies })

	const { data: thread, error } = await supabase.from('threads').select('*').eq('id', threadId).single()
	console.log(`thread:`, thread)

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
			<div className="p-4 max-w-4xl mx-auto mt-10 flex flex-col gap-4">
				<h1 className="text-2xl font-bold mb-4">Thread #{thread.id}</h1>
				<Concepts concepts={thread.concepts} />
				<Threads threads={thread.thread_data.threads} />
			</div>
			<Footer />
		</div>
	)
}
