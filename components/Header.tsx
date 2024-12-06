import { FileText } from 'lucide-react'
import { BuyMeACoffee } from './BuyMeACoffee'
import { ThemeToggle } from './ThemeToggle'

export function Header() {
	return (
		<header className="bg-card shadow-md">
			<div className="container mx-auto px-4 py-4 sm:py-6 flex flex-col sm:flex-row justify-between items-center">
				<div className="flex items-center space-x-4 mb-4 sm:mb-0">
					<div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
						<FileText className="text-primary-foreground w-6 h-6" />
					</div>
					<div>
						<h1 className="text-2xl font-bold text-foreground">FileLight</h1>
						<p className="text-sm text-muted-foreground">Illuminate Your Documents</p>
					</div>
				</div>
				<nav className="flex items-center space-x-4">
					<ThemeToggle />
					<BuyMeACoffee />
				</nav>
			</div>
		</header>
	)
}
