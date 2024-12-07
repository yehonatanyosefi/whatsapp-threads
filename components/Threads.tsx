'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { ThreadDiscussion } from '@/lib/types'
import { useState } from 'react'
import { Button } from './ui/button'

function isThreadDiscussion(discussion: ThreadDiscussion): discussion is ThreadDiscussion {
	return (discussion as ThreadDiscussion).title !== undefined
}

type ThreadsProps = {
	threads: {
		concept: string
		discussion: ThreadDiscussion
	}[]
}

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur']

function isThreadInRTLLanguage(thread: ThreadDiscussion) {
	return RTL_LANGUAGES.includes(thread.language)
}

export function Threads({ threads }: ThreadsProps) {
	const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({})

	const toggleThread = (threadId: string) => {
		setExpandedThreads((prev) => ({
			...prev,
			[threadId]: !prev[threadId],
		}))
	}

	return (
		<ScrollArea className="h-[90vh] w-full rounded-md border p-4">
			{threads.map((thread, index) => (
				<div key={index} className="mb-8 border-b border-border pb-6 last:border-0">
					<h3 className="text-lg font-semibold mb-4">{thread.concept}</h3>

					{isThreadDiscussion(thread.discussion) && (
						<>
							<div
								className="flex justify-between items-center mb-2 sticky top-0 bg-background z-10 py-2"
								dir={isThreadInRTLLanguage(thread.discussion) ? 'rtl' : 'ltr'}>
								<h4 className="text-md font-medium">{thread.discussion.title}</h4>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => toggleThread(`${index}`)}
									className="text-muted-foreground hover:text-foreground">
									{expandedThreads[`${index}`] ? 'Hide Details' : 'Show Details'}
								</Button>
							</div>

							{expandedThreads[`${index}`] && (
								<>
									{thread.discussion.threads.map((discussionThread, threadIndex) => (
										<div
											key={threadIndex}
											className="mb-4"
											dir={isThreadInRTLLanguage(thread.discussion) ? 'rtl' : 'ltr'}>
											<div className="bg-muted/50 p-3 rounded-md mb-2">
												<p className="text-sm text-muted-foreground mb-1">
													{discussionThread.timestamp}
												</p>
												<p className="text-sm font-medium">
													Participants: {discussionThread.participants.join(', ')}
												</p>
												<p className="text-sm">Summary: {discussionThread.summary}</p>
											</div>

											{discussionThread.attachments && discussionThread.attachments.length > 0 && (
												<div className="ml-4 mb-2">
													<p className="text-sm font-medium">Attachments:</p>
													<ul className="list-disc list-inside text-sm">
														{discussionThread.attachments.map((attachment, idx) => (
															<li key={idx}>
																{attachment.startsWith('http') ? (
																	<a
																		href={attachment}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="text-primary hover:underline">
																		{attachment}
																	</a>
																) : (
																	attachment
																)}
															</li>
														))}
													</ul>
												</div>
											)}

											{discussionThread.unresolved_questions &&
												discussionThread.unresolved_questions.length > 0 && (
													<div className="ml-4 mb-2">
														<p className="text-sm font-medium">Unresolved Questions:</p>
														<ul className="list-disc list-inside text-sm text-muted-foreground">
															{discussionThread.unresolved_questions.map((question, idx) => (
																<li key={idx}>{question}</li>
															))}
														</ul>
													</div>
												)}

											{discussionThread.notes && discussionThread.notes.trim() && (
												<div
													className="ml-4 mb-2 text-sm text-muted-foreground"
													dir={isThreadInRTLLanguage(thread.discussion) ? 'rtl' : 'ltr'}>
													<p>Notes: {discussionThread.notes}</p>
												</div>
											)}
										</div>
									))}

									{thread.discussion.follow_ups && thread.discussion.follow_ups.length > 0 && (
										<div
											className="mt-4 bg-muted/30 p-3 rounded-md"
											dir={isThreadInRTLLanguage(thread.discussion) ? 'rtl' : 'ltr'}>
											<h5 className="text-sm font-medium mb-2">Follow-ups:</h5>
											<ul className="list-disc list-inside text-sm">
												{thread.discussion.follow_ups.map((item, idx) => (
													<li key={idx}>
														{item.task} - Assigned to: {item.assigned_to}
														{item.due_date && ` (Due: ${item.due_date})`} - Status: {item.status}
													</li>
												))}
											</ul>
										</div>
									)}
								</>
							)}
						</>
					)}
				</div>
			))}
		</ScrollArea>
	)
}
