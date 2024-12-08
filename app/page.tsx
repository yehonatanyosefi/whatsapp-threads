import { FileUploader } from '@/components/FileUploader'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { MAX_CONTENT_LENGTH, PROCESSING_TIME } from '@/lib/whatsapp'

export default function Page() {
	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Header />
			<main className="flex-grow container mx-auto px-4 py-8">
				<div className="max-w-4xl mx-auto">
					<h2 className="text-3xl font-bold mb-2 text-center text-foreground">
						WhatsApp Thread Generator
					</h2>
					<div className="flex flex-col gap-4 items-center my-8">
						<p className="text-muted-foreground text-center">
							Upload your WhatsApp chat export and generate organized discussion threads using Gemini.
						</p>
						<p className="font-bold">
							{` `}Processing time can take up to: {PROCESSING_TIME / 60000} minutes.
						</p>
						<p className="text-muted-foreground text-center">
							By default, the summary will be taken only from the last month of the chat. And only up to
							{` ${MAX_CONTENT_LENGTH} `}characters will be used.
						</p>
					</div>
					<FileUploader />
				</div>
			</main>
			<Footer />
		</div>
	)
}
