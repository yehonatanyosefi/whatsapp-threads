import { FileUploader } from '@/components/FileUploader'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'

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
					<p className="text-muted-foreground mb-8 text-center">
						By default, the summary will be taken only from the last month of the chat.
					</p>
					<FileUploader />
				</div>
			</main>
			<Footer />
		</div>
	)
}
