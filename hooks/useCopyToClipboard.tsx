import { useState } from 'react'

export function useCopyToClipboard() {
	const [copied, setCopied] = useState(false)
	const handleResetCopied = () => {
		setCopied(false)
	}
	const copy = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch (err) {
			console.error('Failed to copy text:', err)
		}
	}

	return { copied, copy, handleResetCopied }
}
