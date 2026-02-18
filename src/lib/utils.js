import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const getURL = () => {
  let url =
    import.meta.env?.VITE_SITE_URL ?? // Set this to your site URL in production env.
    window.location.origin ?? // Automatically set by browser
    'http://localhost:3000/'

  // Make sure to include `https://` when not localhost.
  url = url.includes('http') ? url : `https://${url}`

  // Make sure to include a trailing `/`.
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`

  return url
}
