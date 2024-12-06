import { FileUploader } from '@/components/FileUploader'
import { Header } from '@/components/Header'
import { Card, CardContent } from '@/components/ui/card'

export default function Page() {
	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Header />
			<main className="flex-grow container mx-auto px-4 py-8">
				<div className="max-w-4xl mx-auto">
					<h2 className="text-3xl font-bold mb-2 text-center text-foreground">File Summarizer</h2>
					<p className="text-muted-foreground mb-8 text-center">
						Upload your document and get an AI-powered summary in seconds using Gemini.
					</p>
					<Card className="mb-8 bg-card shadow-lg">
						<CardContent className="p-6">
							<h3 className="text-xl font-semibold mb-2 text-foreground">
								Gemini-Powered Summarization
							</h3>
							<p className="text-muted-foreground">
								Experience the power of Gemini AI for quick and accurate document summarization. Simply
								provide your Gemini API key to get started.
							</p>
						</CardContent>
					</Card>
					<FileUploader />
				</div>
			</main>
			<footer className="bg-card mt-8">
				<div className="container mx-auto px-4 py-6 text-center text-muted-foreground">
					<p>&copy; 2023 FileLight. Created by YonatanLavy. All rights reserved.</p>
					<p className="mt-2">Powered by Gemini API for intelligent document summarization.</p>
				</div>
			</footer>
		</div>
	)
}
