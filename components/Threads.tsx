'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { useState } from 'react'
import { ThreadDiscussion } from './FileUploader'
import { Button } from './ui/button'

function isThreadDiscussion(discussion: string | ThreadDiscussion): discussion is ThreadDiscussion {
	return (discussion as ThreadDiscussion).title !== undefined
}

type ThreadsProps = {
	threads: {
		concept: string
		discussion: string | ThreadDiscussion
	}[]
}

function convertLinksToJSX(text: string) {
	const urlRegex = /(https?:\/\/[^\s]+)/g
	const parts = text.split(urlRegex)

	return parts.map((part, i) => {
		if (part.match(urlRegex)) {
			return (
				<a
					key={i}
					href={part}
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary hover:underline">
					{part}
				</a>
			)
		}
		return part
	})
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

					{typeof thread.discussion === 'string' ? (
						<div className="text-sm text-muted-foreground whitespace-pre-wrap">
							{convertLinksToJSX(thread.discussion)}
						</div>
					) : (
						isThreadDiscussion(thread.discussion) &&
						(thread.discussion.note ? (
							<p className="text-sm text-muted-foreground">{thread.discussion.note}</p>
						) : (
							<>
								<div className="flex justify-between items-center mb-2">
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
											<div key={threadIndex} className="mb-4">
												<div className="bg-muted/50 p-3 rounded-md mb-2">
													<p className="text-sm text-muted-foreground mb-1">
														{discussionThread.timestamp}
													</p>
													<p className="text-sm font-medium">
														{discussionThread.initiator.who}: {discussionThread.initiator.question}
													</p>
													<p className="text-sm text-muted-foreground">
														Context: {discussionThread.initiator.context}
													</p>
												</div>

												{discussionThread.responses.map((response, responseIndex) => (
													<div key={responseIndex} className="ml-4 mb-2">
														<p className="text-sm font-medium">{response.who}:</p>
														<p className="text-sm">{convertLinksToJSX(response.contribution)}</p>
														{response.key_points.length > 0 && (
															<ul className="list-disc list-inside text-sm text-muted-foreground ml-2">
																{response.key_points.map((point, pointIndex) => (
																	<li key={pointIndex}>{point}</li>
																))}
															</ul>
														)}
														{response.attachments && (
															<p className="text-sm text-muted-foreground">
																Attachments: {response.attachments}
															</p>
														)}
													</div>
												))}

												<div className="mt-2 bg-muted/30 p-2 rounded-md">
													<p className="text-sm font-medium">Resolution:</p>
													<p className="text-sm">{discussionThread.resolution.outcome}</p>
													<p className="text-sm">Next steps: {discussionThread.resolution.next_steps}</p>
													{discussionThread.resolution.pending && (
														<p className="text-sm text-muted-foreground">
															Pending: {discussionThread.resolution.pending}
														</p>
													)}
												</div>
											</div>
										))}

										{/* {thread.discussion.action_items.length > 0 && (
																				<div className="mt-4">
																					<h5 className="text-sm font-medium mb-2">Action Items:</h5>
																					<ul className="list-disc list-inside text-sm">
																						{thread.discussion.action_items.map((item, itemIndex) => (
																							<li key={itemIndex}>
																								{item.task} - Assigned to: {item.owner}
																								{item.deadline && ` (Due: ${item.deadline})`}
																							</li>
																						))}
																					</ul>
																				</div>
																			)} */}
									</>
								)}
							</>
						))
					)}
				</div>
			))}
		</ScrollArea>
	)
}
