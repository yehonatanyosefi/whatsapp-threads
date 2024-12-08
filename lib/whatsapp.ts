export const MAX_CONTENT_LENGTH = 400 * 1000 // characters
export const MIN_CONTENT_LENGTH = 50
export const PROCESSING_TIME = 5 * 60 * 1000 // 5 minutes
// Add these helper functions at the top with other constants
export function parseWhatsAppDate(timestamp: string): Date | null {
	// Remove brackets if present
	timestamp = timestamp.replace(/[\[\]]/g, '')

	// Different format patterns
	const patterns = [
		// 12-hour formats
		{
			regex: /(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s(\d{1,2}):(\d{2}):?(\d{2})?\s?(AM|PM)?/,
			handler: (matches: string[]) => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const [_, month, day] = matches
				const [, , , , , minutes, seconds = '00', period] = matches
				let [, , , year, hours] = matches

				// Adjust year if needed
				year = year.length === 2 ? '20' + year : year

				// Convert to 24-hour format if needed
				if (period) {
					hours = String(
						period === 'PM'
							? parseInt(hours) === 12
								? 12
								: parseInt(hours) + 12
							: parseInt(hours) === 12
							? 0
							: parseInt(hours)
					)
				}

				// Create date string
				const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(
					2,
					'0'
				)}:${minutes}:${seconds}`

				// Validate the date
				const date = new Date(dateStr)
				return isNaN(date.getTime()) ? null : date
			},
		},
		// 24-hour formats
		{
			regex: /(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s(\d{2}):(\d{2})/,
			handler: (matches: string[]) => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const [_, month, day, year, hours, minutes] = matches

				// Create date string
				const dateStr = `${year.length === 2 ? '20' + year : year}-${month.padStart(
					2,
					'0'
				)}-${day.padStart(2, '0')}T${hours}:${minutes}:00`

				// Validate the date
				const date = new Date(dateStr)
				return isNaN(date.getTime()) ? null : date
			},
		},
		// Add more patterns as needed
	]

	for (const pattern of patterns) {
		const matches = timestamp.match(pattern.regex)
		if (matches) {
			try {
				return pattern.handler(matches)
			} catch (e) {
				console.error('Date parsing error:', e)
				return null
			}
		}
	}
	return null
}

export function standardizeTimestamp(timestamp: string): string {
	const date = parseWhatsAppDate(timestamp)
	if (!date) return timestamp // Return original if parsing fails
	return date.toISOString() // Or any other standard format you prefer
}
// Validate and sanitize content
export function validateContent(content: string): string {
	if (!content || typeof content !== 'string') {
		throw new Error('Invalid content format')
	}

	if (content.length < MIN_CONTENT_LENGTH) {
		throw new Error('Content too short for meaningful analysis')
	}

	if (content.length > MAX_CONTENT_LENGTH) {
		content = '[Content truncated due to length...]\n' + content.slice(-MAX_CONTENT_LENGTH)
	}

	// Standardize timestamps instead of removing them
	return content
		.replace(/```/g, "'''") // Prevent markdown confusion
		.replace(
			/\[?\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4},\s\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM)?\]?\s?-?/g,
			(match) => standardizeTimestamp(match)
		)
		.replace(/\u200E/g, '') // Remove LTR mark
		.replace(/\u200F/g, '') // Remove RTL mark
		.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Remove emojis
		.trim()
}
