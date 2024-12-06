import { createClient } from '@supabase/supabase-js'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export function getBaseURL(): string {
	const DEV_PORT = process.env.DEV_PORT || 3000
	let url =
		process.env.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
		process.env.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
		`http://localhost:${DEV_PORT}/`

	url = url.startsWith('http') ? url : `https://${url}`
	url = url.charAt(url.length - 1) === '/' ? url : `${url}/`

	return url
}

export function getSiteURL(path?: string): string {
	const baseUrl = getBaseURL()
	return path ? `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}` : baseUrl
}

export function isProduction(): boolean {
	return process.env.NODE_ENV === 'production'
}

export function createSupabaseAdminClient() {
	return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SERVICE_ROLE_KEY!)
}
