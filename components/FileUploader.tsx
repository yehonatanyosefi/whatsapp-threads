'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, Edit, FileText, Key, Loader2, RefreshCw, Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export function FileUploader() {
	const [file, setFile] = useState<File | null>(null)
	const [fileContent, setFileContent] = useState<string>('')
	const [loadingStep, setLoadingStep] = useState<number>(0)
	const [progress, setProgress] = useState<number>(0)
	const [apiKey, setApiKey] = useState<string>('')
	const [summary, setSummary] = useState<string>('')
	const [isKeyVerified, setIsKeyVerified] = useState<boolean>(false)
	const { toast } = useToast()

	useEffect(() => {
		const storedApiKey = localStorage.getItem('geminiApiKey')
		if (storedApiKey) {
			setApiKey(storedApiKey)
			testApiKey(storedApiKey)
		}
	}, [])

	const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = event.target.files?.[0]
		if (selectedFile) {
			if (selectedFile.size > 10 * 1024 * 1024) {
				toast({
					title: 'File too large',
					description: 'Please upload a file smaller than 10MB.',
					variant: 'destructive',
				})
				return
			}

			setFile(selectedFile)
			setProgress(0)
			setLoadingStep(0)
			setSummary('')

			try {
				const content = await readFileContent(selectedFile)
				setFileContent(content)
			} catch (error) {
				console.error(error)
				toast({
					title: 'Error reading file',
					description: 'There was an error reading the file. Please try again.',
					variant: 'destructive',
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
				import('pdfjs-dist')
					.then((pdfjsLib) => {
						pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
						const loadingTask = pdfjsLib.getDocument({ url: URL.createObjectURL(file) })
						loadingTask.promise
							.then((pdf) => {
								let fullText = ''
								const pagePromises = []
								for (let i = 1; i <= pdf.numPages; i++) {
									pagePromises.push(
										pdf.getPage(i).then((page) =>
											page.getTextContent().then((content) => {
												return content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
											})
										)
									)
								}
								Promise.all(pagePromises).then((pageTexts) => {
									fullText = pageTexts.join('\n\n')
									resolve(fullText)
								})
							})
							.catch(reject)
					})
					.catch(reject)
			} else if (
				file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
			) {
				import('mammoth')
					.then(async (mammoth) => {
						const buffer = await file.arrayBuffer()
						mammoth
							.extractRawText({ arrayBuffer: buffer })
							.then((result) => {
								resolve(result.value)
							})
							.catch(reject)
					})
					.catch(reject)
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
		try {
			const response = await fetch('/api/test-api-key', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ apiKey: keyToTest }),
			})

			if (response.ok) {
				toast({
					title: 'API Key Valid',
					description: 'Your Gemini API key is valid and has been saved.',
					variant: 'default',
				})
				localStorage.setItem('geminiApiKey', keyToTest)
				setIsKeyVerified(true)
			} else {
				throw new Error('Invalid API Key')
			}
		} catch (error) {
			console.error(error)
			toast({
				title: 'Invalid API Key',
				description: 'Please check your Gemini API key and try again.',
				variant: 'destructive',
			})
			setIsKeyVerified(false)
		}
	}

	const handleEditApiKey = () => {
		setIsKeyVerified(false)
	}

	const handleUpload = async () => {
		if (!file || !apiKey) return

		setLoadingStep(1)
		let progress = 0
		const interval = setInterval(() => {
			progress += 10
			setProgress(Math.min(progress, 100))
			if (progress >= 100) clearInterval(interval)
		}, 500)

		try {
			const response = await fetch('/api/summarize', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ content: fileContent, apiKey }),
			})

			if (!response.ok) {
				throw new Error('Failed to summarize')
			}

			const data = await response.json()
			setSummary(data.summary)
			setLoadingStep(3)
		} catch (error) {
			console.error(error)
			toast({
				title: 'Error summarizing file',
				description: 'There was an error summarizing the file. Please check your API key and try again.',
				variant: 'destructive',
			})
		} finally {
			clearInterval(interval)
			setProgress(100)
		}
	}

	const removeFile = () => {
		setFile(null)
		setFileContent('')
		setLoadingStep(0)
		setProgress(0)
		setSummary('')
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
										className="flex items-center justify-between bg-green-100 dark:bg-green-900 p-3 rounded-md">
										<div className="flex items-center space-x-2">
											<Check className="h-5 w-5 text-green-500" />
											<span className="text-sm text-green-700 dark:text-green-300">
												API Key verified
											</span>
										</div>
										<Button onClick={handleEditApiKey} variant="outline" size="sm">
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
								className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
								Verify API Key
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			<AnimatePresence>
				{isKeyVerified && (
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
										<p className="text-xs text-muted-foreground">TXT, PDF, DOCX (MAX. 10MB)</p>
									</div>
									<input
										id="file-upload"
										type="file"
										className="hidden"
										onChange={handleFileChange}
										accept=".txt,.pdf,.docx"
									/>
									<div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
								</label>
							</CardContent>
						</Card>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{file && isKeyVerified && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}>
						<Card className="bg-card shadow-lg">
							<CardContent className="p-6">
								<div className="flex items-center justify-between mb-4">
									<div className="flex items-center space-x-2">
										<FileText className="w-6 h-6 text-primary" />
										<span className="text-sm font-medium text-foreground">{file.name}</span>
									</div>
									<Button variant="ghost" size="icon" onClick={removeFile}>
										<X className="w-4 h-4" />
									</Button>
								</div>
								<div className="text-xs text-muted-foreground mb-2">
									Size: {(file.size / 1024).toFixed(2)} KB
								</div>
								<Progress value={progress} className="w-full h-2" />
								<div className="mt-4">
									<Button
										onClick={handleUpload}
										disabled={loadingStep > 0}
										className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
										{loadingStep > 0 ? (
											<Loader2 className="w-4 h-4 mr-2 animate-spin" />
										) : (
											<Upload className="w-4 h-4 mr-2" />
										)}
										Upload and Summarize
									</Button>
								</div>
							</CardContent>
						</Card>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{loadingStep > 0 && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}>
						<Card className="bg-card shadow-lg">
							<CardContent className="p-6">
								<h2 className="text-xl font-semibold mb-4 text-foreground">Processing</h2>
								<div className="space-y-4">
									<Step number={1} text="Uploading file" completed={loadingStep > 1} />
									<Step number={2} text="Analyzing content" completed={loadingStep > 2} />
									<Step number={3} text="Generating summary" completed={loadingStep > 3} />
								</div>
							</CardContent>
						</Card>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{summary && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}>
						<Card className="bg-card shadow-lg">
							<CardContent className="p-6">
								<div className="flex justify-between items-center mb-4">
									<h2 className="text-xl font-semibold text-foreground">Summary</h2>
									<Button variant="outline" size="sm" onClick={handleUpload}>
										<RefreshCw className="w-4 h-4 mr-2" />
										Regenerate
									</Button>
								</div>
								<Alert>
									<AlertTriangle className="h-4 w-4" />
									<AlertTitle>AI-Generated Summary</AlertTitle>
									<AlertDescription>
										<ScrollArea className="h-[200px] w-full rounded-md border p-4">
											{summary.split('\n').map((paragraph, index) => (
												<p key={index} className="mb-4 text-sm text-foreground">
													{paragraph}
												</p>
											))}
										</ScrollArea>
									</AlertDescription>
								</Alert>
							</CardContent>
						</Card>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{fileContent && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}>
						<Card className="bg-card shadow-lg">
							<CardContent className="p-6">
								<h2 className="text-xl font-semibold mb-4 text-foreground">File Content</h2>
								<ScrollArea className="h-[300px] w-full rounded-md border p-4">
									{fileContent.split('\n').map((line, index) => (
										<p key={index} className="mb-2 text-sm text-foreground">
											{line}
										</p>
									))}
								</ScrollArea>
							</CardContent>
						</Card>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

function Step({ number, text, completed }: { number: number; text: string; completed: boolean }) {
	return (
		<div className="flex items-center">
			<div
				className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
					completed ? 'bg-green-500' : 'bg-primary'
				}`}>
				{completed ? '✓' : number}
			</div>
			<span className="text-sm text-foreground">{text}</span>
			{!completed && <Loader2 className="animate-spin ml-2" />}
		</div>
	)
}
