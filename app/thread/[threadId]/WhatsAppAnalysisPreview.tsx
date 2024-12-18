'use client'
import { Threads } from '@/components/Threads'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { ThreadDiscussion } from '@/lib/types'
import { getSiteURL } from '@/lib/utils'
import { useEffect } from 'react'

type WhatsAppAnalysisPreviewProps = {
	concepts: string[]
	threads: {
		concept: string
		discussion: ThreadDiscussion
	}[]
	id: string
}

export function WhatsAppAnalysisPreview({ threads, id }: WhatsAppAnalysisPreviewProps) {
	const { copy, copied, handleResetCopied } = useCopyToClipboard()

	// Add effect to auto-close popover
	useEffect(() => {
		if (copied) {
			const timer = setTimeout(() => {
				handleResetCopied() // Reset copied state
			}, 1000)
			return () => clearTimeout(timer)
		}
	}, [copied, handleResetCopied])

	return (
		<div className="p-4 max-w-4xl mx-auto mt-10 flex flex-col gap-4">
			<h1 className="text-2xl font-bold mb-4">
				Thread{' '}
				<Popover open={copied}>
					<PopoverTrigger asChild>
						<span
							onClick={() => copy(`${getSiteURL()}thread/${id}`)}
							className="text-blue-500 hover:text-blue-600 cursor-pointer">
							{id}
						</span>
					</PopoverTrigger>
					<PopoverContent className="w-auto p-2">Copied!</PopoverContent>
				</Popover>
			</h1>
			{/* <Concepts concepts={concepts} /> */}
			<Threads threads={threads} />
		</div>
	)
}
