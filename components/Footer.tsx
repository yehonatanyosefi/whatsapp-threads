type FooterProps = {}

export function Footer({}: FooterProps) {
	return (
		<footer className="bg-card mt-8">
			<div className="container mx-auto px-4 py-6 text-center text-muted-foreground">
				<p>&copy; 2024 WhatsApp Thread Generator. All rights reserved.</p>
				<p className="mt-2">Powered by Gemini API for intelligent chat analysis.</p>
			</div>
		</footer>
	)
}
