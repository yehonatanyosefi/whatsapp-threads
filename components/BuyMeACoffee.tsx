'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Coffee } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export function BuyMeACoffee() {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<Popover open={isOpen}>
			<PopoverTrigger asChild>
				<div onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
					<Link
						href="https://buymeacoffee.com/yonatanlavy"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center space-x-2 bg-[#FFDD00] text-black px-4 py-2 rounded-full 
							hover:bg-[#FFE44D] transition-all duration-300 hover:scale-105 hover:shadow-lg 
							group data-[state=open]:bg-[#FFE44D]">
						<Coffee
							size={18}
							className="transform group-hover:rotate-12 transition-transform duration-300"
						/>
						<span className="hidden sm:inline font-medium group-hover:text-black/80">
							Buy Me a Coffee
						</span>
					</Link>
				</div>
			</PopoverTrigger>

			<PopoverContent
				className="w-64 p-0 border-none data-[state=open]:animate-in data-[state=closed]:animate-out 
					data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 
					data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 
					data-[side=top]:slide-in-from-bottom-2">
				<div
					onMouseEnter={() => setIsOpen(true)}
					onMouseLeave={() => setIsOpen(false)}
					className="relative overflow-hidden bg-white rounded-lg p-4 shadow-xl">
					{/* Gradient background */}
					<div
						className="absolute inset-0 bg-gradient-to-r from-yellow-300/20 via-orange-300/20 to-yellow-300/20 
						animate-gradient-x"
					/>

					{/* Content */}
					<div className="relative space-y-2">
						<div className="flex items-center justify-center space-x-2">
							<span className="inline-block animate-bounce-subtle">✨</span>
							<span
								className="font-bold text-lg bg-gradient-to-r from-yellow-600 to-orange-600 
								bg-clip-text text-transparent">
								Thank you!
							</span>
							<span className="inline-block animate-bounce-subtle delay-75">☕️</span>
						</div>

						<p className="text-sm text-center text-gray-600">
							Your support helps me create better content and tools!
						</p>

						{/* Decorative elements */}
						<div
							className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 
							bg-gradient-to-br from-yellow-300/30 to-orange-300/30 rounded-full blur-xl"
						/>
						<div
							className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 
							bg-gradient-to-tr from-orange-300/30 to-yellow-300/30 rounded-full blur-xl"
						/>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
