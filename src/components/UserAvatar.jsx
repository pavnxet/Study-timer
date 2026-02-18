import { Sprout, Cat, Coffee, BookOpen, User } from 'lucide-react'
import { cn } from '../lib/utils'

const AVATAR_ICONS = {
    'sprout': Sprout,
    'cat': Cat,
    'coffee': Coffee,
    'book': BookOpen
}

export default function UserAvatar({ url, alt, className, fallbackText = 'GU' }) {
    if (url && url.startsWith('preset:')) {
        const presetKey = url.split(':')[1]
        const Icon = AVATAR_ICONS[presetKey] || User
        return (
            <div className={cn("flex items-center justify-center bg-neutral-800 text-neutral-300 overflow-hidden", className)}>
                <Icon className="w-2/3 h-2/3" />
            </div>
        )
    }

    if (url) {
        return (
            <img
                src={url}
                alt={alt || "Avatar"}
                className={cn("object-cover", className)}
                onError={(e) => { e.target.style.display = 'none' }}
            />
        )
    }

    return (
        <div className={cn("flex items-center justify-center bg-neutral-800 text-neutral-400 font-bold", className)}>
            {fallbackText.slice(0, 2).toUpperCase()}
        </div>
    )
}
