import { FileText } from 'lucide-react'
import Link from 'next/link'

export function Logo() {
	return (
		<Link href="/" className="flex items-center space-x-4 mb-4 sm:mb-0">
			<div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
				<FileText className="text-primary-foreground w-6 h-6" />
			</div>
			<div>
				<h1 className="text-2xl font-bold text-foreground">WhatsApp Thread Generator</h1>
				<p className="text-sm text-muted-foreground">Organize Your Chat Discussions</p>
			</div>
		</Link>
	)
}
