import { BuyMeACoffee } from './BuyMeACoffee'
import { Logo } from './Logo'

export function Header() {
	return (
		<header className="bg-card shadow-md">
			<div className="container mx-auto px-4 py-4 sm:py-6 flex flex-col sm:flex-row justify-between items-center">
				<Logo />
				<nav className="flex items-center space-x-4">
					{/* <ThemeToggle /> */}
					<BuyMeACoffee />
				</nav>
			</div>
		</header>
	)
}
