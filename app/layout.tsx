import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
	title: {
		template: '%s | Whatsapp Thread Generator',
		default: 'Whatsapp Thread Generator',
	},
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				{children}
				<Toaster />
				<Analytics />
			</body>
		</html>
	)
}
