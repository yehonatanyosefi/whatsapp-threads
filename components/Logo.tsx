import Image from 'next/image'
import Link from 'next/link'

export function Logo() {
	return (
		<Link href="/" className="flex items-center space-x-4 mb-4 sm:mb-0">
			<div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden">
				<Image
					src="/logo.jpg"
					alt="WhatsApp Thread Generator"
					width={40}
					height={40}
					className="object-cover w-full h-full"
				/>
			</div>
			<div>
				<h1 className="text-2xl font-bold text-foreground">WhatsApp Thread Generator</h1>
				<p className="text-sm text-muted-foreground">Organize Your Chat Discussions</p>
			</div>
		</Link>
	)
}
