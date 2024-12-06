import { FileUploader } from '@/components/FileUploader'
import { Header } from '@/components/Header'
import { Card, CardContent } from '@/components/ui/card'

export default function Page() {
	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Header />
			<main className="flex-grow container mx-auto px-4 py-8">
				<div className="max-w-4xl mx-auto">
					<h2 className="text-3xl font-bold mb-2 text-center text-foreground">
						WhatsApp Thread Generator
					</h2>
					<p className="text-muted-foreground mb-8 text-center">
						Upload your WhatsApp chat export and generate organized discussion threads using Gemini.
					</p>
					<Card className="mb-8 bg-card shadow-lg">
						<CardContent className="p-6">
							<h3 className="text-xl font-semibold mb-2 text-foreground">
								Gemini-Powered Thread Analysis
							</h3>
							<p className="text-muted-foreground">
								Transform your WhatsApp chat exports into organized discussion threads. Identify key
								topics and follow conversation flows with AI assistance.
							</p>
						</CardContent>
					</Card>
					<FileUploader />
				</div>
			</main>
			<footer className="bg-card mt-8">
				<div className="container mx-auto px-4 py-6 text-center text-muted-foreground">
					<p>&copy; 2024 WhatsApp Thread Generator. All rights reserved.</p>
					<p className="mt-2">Powered by Gemini API for intelligent chat analysis.</p>
				</div>
			</footer>
		</div>
	)
}
