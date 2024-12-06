'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, getSiteURL, isProduction } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, Edit, FileText, Key, Loader2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Concepts } from './Concepts'
import { Threads } from './Threads'

type UploadStatus = 'idle' | 'uploading' | 'analyzing' | 'done'

export interface ThreadDiscussion {
	title: string
	threads: {
		timestamp: string
		initiator: {
			who: string
			question: string
			context: string
		}
		responses: {
			who: string
			contribution: string
			key_points: string[]
			attachments?: string
		}[]
		resolution: {
			outcome: string
			next_steps: string
			pending?: string
		}
	}[]
	related_topics: string[]
	action_items: {
		task: string
		owner: string
		deadline?: string
	}[]
	note?: string
}

interface ThreadResponse {
	concept: string
	discussion: string | ThreadDiscussion
}

interface AnalysisResponse {
	concepts: string[]
	threads: ThreadResponse[]
	message: string
	id: string
}

interface StepProps {
	number: number
	text: string
	completed: boolean
}

function Step({ number, text, completed }: StepProps) {
	return (
		<div className="flex items-center">
			<div
				className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
					completed ? 'bg-green-500' : 'bg-primary'
				}`}>
				<span className="text-white text-sm">{completed ? '✓' : number}</span>
			</div>
			<span className="text-sm text-foreground">{text}</span>
			{!completed && <Loader2 className="animate-spin ml-2 h-4 w-4" />}
		</div>
	)
}

const isStepCompleted = (currentStatus: UploadStatus, requiredStatuses: UploadStatus[]): boolean => {
	return requiredStatuses.includes(currentStatus)
}
export function FileUploader() {
	const [fileContent, setFileContent] = useState<string>('')
	const [progress, setProgress] = useState<number>(0)
	const [apiKey, setApiKey] = useState<string>('')
	const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null)
	const [isKeyVerified, setIsKeyVerified] = useState<boolean>(false)
	const [isTestingKey, setIsTestingKey] = useState<boolean>(false)
	const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')

	useEffect(() => {
		const storedApiKey = localStorage.getItem('geminiApiKey')
		if (storedApiKey) {
			setApiKey(storedApiKey)
			setIsKeyVerified(true)
		}
	}, [])

	const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = event.target.files?.[0]
		if (selectedFile) {
			const allowedTypes = ['text/plain']

			if (!allowedTypes.includes(selectedFile.type)) {
				toast.error('Invalid file type', {
					description: 'Please upload a TXT file exported from WhatsApp.',
				})
				return
			}

			if (selectedFile.size > 10 * 1024 * 1024) {
				toast.error('File too large', {
					description: 'Please upload a file smaller than 10MB.',
				})
				return
			}

			setProgress(0)
			setUploadStatus('uploading')

			try {
				const content = await readFileContent(selectedFile)
				setFileContent(content)
				if (isKeyVerified) {
					handleAnalyze(content)
				}
			} catch (error) {
				console.error('File reading error:', error)
				setUploadStatus('idle')
				toast.error('Error reading file', {
					description: 'There was an error reading the file. Please try again.',
				})
			}
		}
	}

	const readFileContent = (file: File): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()

			reader.onload = (event) => {
				const content = event.target?.result
				if (typeof content === 'string') {
					resolve(content)
				} else {
					reject(new Error('Failed to read file content'))
				}
			}

			reader.onerror = (error) => reject(error)

			if (file.type === 'application/pdf') {
				const handlePdf = async () => {
					try {
						const pdfjsLib = await import('pdfjs-dist')
						pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

						const arrayBuffer = await file.arrayBuffer()
						const loadingTask = pdfjsLib.getDocument(new Uint8Array(arrayBuffer))
						const pdf = await loadingTask.promise

						let fullText = ''
						for (let i = 1; i <= pdf.numPages; i++) {
							const page = await pdf.getPage(i)
							const textContent = await page.getTextContent()
							const pageText = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ')
							fullText += pageText + '\n\n'
						}

						resolve(fullText.trim())
					} catch (error) {
						console.error('PDF parsing error:', error)
						reject(error)
					}
				}

				handlePdf().catch(reject)
			} else if (
				file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
			) {
				const handleDocx = async () => {
					try {
						const mammoth = await import('mammoth')
						const arrayBuffer = await file.arrayBuffer()
						const result = await mammoth.extractRawText({ arrayBuffer })
						resolve(result.value)
					} catch (error) {
						console.error('DOCX parsing error:', error)
						reject(error)
					}
				}

				handleDocx()
			} else {
				reader.readAsText(file)
			}
		})
	}

	const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newApiKey = e.target.value
		setApiKey(newApiKey)
		setIsKeyVerified(false)
	}

	const testApiKey = async (keyToTest: string = apiKey) => {
		if (isKeyVerified && keyToTest === apiKey) {
			setIsKeyVerified(true)
			return
		}

		setIsTestingKey(true)
		try {
			const response = await fetch('/api/test-api-key', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ apiKey: keyToTest }),
			})

			if (response.ok) {
				toast.success('API Key Valid', {
					description: 'Your Gemini API key is valid and has been saved.',
				})
				localStorage.setItem('geminiApiKey', keyToTest)
				setIsKeyVerified(true)
			} else {
				throw new Error('Invalid API Key')
			}
		} catch (error) {
			console.error(error)
			toast.error('Invalid API Key', {
				description: 'Please check your Gemini API key and try again.',
			})
			setIsKeyVerified(false)
		} finally {
			setIsTestingKey(false)
		}
	}

	const handleEditApiKey = () => {
		setIsKeyVerified(false)
	}

	const handleAnalyze = async (contentToAnalyze: string = fileContent) => {
		if (!apiKey) return

		setUploadStatus('analyzing')
		let progress = 0
		const interval = setInterval(() => {
			progress += 10
			setProgress(Math.min(progress, 100))
			if (progress >= 100) clearInterval(interval)
		}, 1000 * 8)

		try {
			const response = await fetch('/api/threads', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ content: contentToAnalyze, apiKey }),
			})

			if (!response.ok) {
				throw new Error('Failed to analyze')
			}

			const data: AnalysisResponse = await response.json()
			setAnalysisResult(data)
			setUploadStatus('done')
		} catch (error) {
			console.error(error)
			setUploadStatus('idle')
			toast.error('Error analyzing file', {
				description: 'There was an error analyzing the file. Please check your API key and try again.',
			})
		} finally {
			clearInterval(interval)
			setProgress(100)
		}
	}

	const successColor = 'text-green-500 dark:text-green-400'

	const handleRegenerateClick = () => {
		setAnalysisResult(null)
		setProgress(0)
		handleAnalyze(fileContent)
	}

	const handleReset = () => {
		setUploadStatus('idle')
		setFileContent('')
		setAnalysisResult(null)
		setProgress(0)
	}

	return (
		<div className="space-y-6 max-w-4xl mx-auto">
			<Card className="bg-card shadow-lg">
				<CardContent className="p-6">
					<div className="space-y-4">
						<div>
							<Label htmlFor="api-key" className="text-sm font-medium text-foreground">
								Gemini API Key
							</Label>
							<div className="mt-1 relative rounded-md shadow-sm">
								{isKeyVerified ? (
									<motion.div
										initial={{ opacity: 0, y: -10 }}
										animate={{ opacity: 1, y: 0 }}
										className="flex items-center justify-between bg-green-50 dark:bg-green-900 p-3 rounded-md">
										<div className="flex items-center space-x-2">
											<Check className={cn('h-5 w-5', successColor)} />
											<span className={cn('text-sm', successColor)}>API Key verified</span>
										</div>
										<Button
											onClick={handleEditApiKey}
											variant="outline"
											className={cn(successColor)}
											size="sm">
											<Edit className="h-4 w-4 mr-2" />
											Edit
										</Button>
									</motion.div>
								) : (
									<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
										<Input
											id="api-key"
											type="password"
											placeholder="Enter your Gemini API key"
											value={apiKey}
											onChange={handleApiKeyChange}
											className="pr-10 focus:ring-primary focus:border-primary block w-full sm:text-sm border-input rounded-md"
										/>
										<div className="absolute inset-y-0 right-0 pr-3 flex items-center">
											<Key className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
										</div>
									</motion.div>
								)}
							</div>
						</div>
						{!isKeyVerified && (
							<Button
								onClick={() => testApiKey()}
								disabled={isTestingKey}
								className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
								{isTestingKey ? (
									<>
										<Loader2 className="w-4 h-4 mr-2 animate-spin" />
										Verifying...
									</>
								) : (
									'Verify API Key'
								)}
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			<AnimatePresence>
				{isKeyVerified && uploadStatus === 'idle' && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}>
						<Card className="bg-card shadow-lg overflow-hidden">
							<CardContent className="p-0">
								<label
									htmlFor="file-upload"
									className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/70 transition-colors relative overflow-hidden group">
									<div className="flex flex-col items-center justify-center pt-5 pb-6 z-10">
										<FileText className="w-16 h-16 mb-3 text-primary transition-transform group-hover:scale-110" />
										<p className="mb-2 text-sm text-muted-foreground">
											<span className="font-semibold">Click to upload</span> or drag and drop
										</p>
										<p className="text-xs text-muted-foreground">WhatsApp chat export (.txt)</p>
									</div>
									<input
										id="file-upload"
										type="file"
										className="hidden"
										onChange={handleFileChange}
										accept=".txt"
									/>
									<div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
								</label>
							</CardContent>
						</Card>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{(uploadStatus === 'uploading' || uploadStatus === 'analyzing') && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}>
						<Card className="bg-card shadow-lg">
							<CardContent className="p-6">
								<h2 className="text-xl font-semibold mb-4 text-foreground">
									{uploadStatus === 'uploading' ? 'Reading File' : 'Analyzing Content'}
								</h2>
								<div className="space-y-4">
									<div className="w-full bg-muted rounded-full h-2.5">
										<div
											className="bg-primary h-2.5 rounded-full transition-all duration-300"
											style={{ width: `${progress}%` }}
										/>
									</div>
									<Step
										number={1}
										text="Uploading file"
										completed={isStepCompleted(uploadStatus, ['uploading', 'analyzing', 'done'])}
									/>
									<Step
										number={2}
										text="Analyzing content"
										completed={isStepCompleted(uploadStatus, ['analyzing', 'done'])}
									/>
									<Step
										number={3}
										text="Generating analysis"
										completed={isStepCompleted(uploadStatus, ['done'])}
									/>
								</div>
							</CardContent>
						</Card>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{uploadStatus === 'done' && analysisResult && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}>
						<Card className="bg-card shadow-lg">
							<CardContent className="p-6">
								<div className="flex justify-between items-center mb-4">
									<h2 className="text-xl font-semibold text-foreground">Discussion Analysis</h2>
									<div className="space-x-2">
										<Button variant="outline" size="sm" onClick={handleRegenerateClick}>
											<RefreshCw className="w-4 h-4 mr-2" />
											Regenerate
										</Button>
										<Button variant="default" size="sm" onClick={handleReset}>
											<FileText className="w-4 h-4 mr-2" />
											Process Another File
										</Button>
									</div>
								</div>

								<div className="space-y-6">
									{analysisResult.concepts.length > 0 ? (
										<>
											{isProduction() ? (
												<p>
													The result is complete! to see it go to{' '}
													<Link
														href={`${getSiteURL()}thread/${analysisResult.id}`}
														className="text-primary hover:underline"
														prefetch>
														here
													</Link>
												</p>
											) : (
												<>
													<Concepts concepts={analysisResult.concepts} />
													<Threads threads={analysisResult.threads} />
												</>
											)}
										</>
									) : (
										<Alert>
											<AlertTriangle className="h-4 w-4" />
											<AlertTitle>No Significant Topics Found</AlertTitle>
											<AlertDescription>
												The analysis couldn&apos;t identify any substantial discussion topics in the
												content.
											</AlertDescription>
										</Alert>
									)}
								</div>
							</CardContent>
						</Card>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
