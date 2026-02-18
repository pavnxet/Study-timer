import { subDays, format } from 'date-fns'

/**
 * Calculate total XP (Total Minutes)
 * @param {Array} sessions
 * @returns {number}
 */
export function calculateXP(sessions) {
  if (!sessions) return 0
  return sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0)
}

/**
 * Calculate Level based on XP
 * Formula: Level = floor(sqrt(XP / 100))
 * @param {number} xp
 * @returns {number}
 */
export function calculateLevel(xp) {
  if (xp < 0) return 1
  return Math.floor(Math.sqrt(xp / 100)) + 1
}

/**
 * Calculate XP required for next level
 * @param {number} currentLevel
 * @returns {number}
 */
export function xpForNextLevel(currentLevel) {
  return Math.pow(currentLevel, 2) * 100
}

/**
 * Calculate Current Streak (Consecutive days)
 * @param {Array} sessions
 * @returns {number}
 */
export function calculateStreak(sessions) {
  if (!sessions || sessions.length === 0) return 0

  // 1. Get unique days with sessions, formatted as 'YYYY-MM-DD'
  const uniqueDays = new Set(
    sessions.map(s => format(new Date(s.created_at), 'yyyy-MM-dd'))
  )

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  // 2. Determine start of streak count
  let checkDate = new Date()

  if (uniqueDays.has(todayStr)) {
      // Streak continues today
  } else if (uniqueDays.has(yesterdayStr)) {
      // Streak continues from yesterday
      checkDate = subDays(new Date(), 1)
  } else {
      // Streak broken
      return 0
  }

  // 3. Count backwards
  let streak = 0
  while (uniqueDays.has(format(checkDate, 'yyyy-MM-dd'))) {
      streak++
      checkDate = subDays(checkDate, 1)
  }

  return streak
}

/**
 * Calculate Momentum Score (0-100 based on last 30 days consistency)
 * @param {Array} sessions
 * @returns {number}
 */
export function calculateMomentum(sessions) {
  if (!sessions || sessions.length === 0) return 0

  const today = new Date()
  const thirtyDaysAgo = subDays(today, 30)

  // Filter sessions within last 30 days
  const recentSessions = sessions.filter(s =>
      new Date(s.created_at) >= thirtyDaysAgo
  )

  const uniqueDays = new Set(
      recentSessions.map(s => format(new Date(s.created_at), 'yyyy-MM-dd'))
  )

  // Cap at 100% if they studied every day
  return Math.min(100, Math.round((uniqueDays.size / 30) * 100))
}

export const REWARD_ASSETS = {
    'Basic Avatars': [
        { id: 'preset:sprout', name: 'Seedling', icon: 'sprout' },
        { id: 'preset:cat', name: 'Focused Cat', icon: 'cat' },
        { id: 'preset:coffee', name: 'Coffee Mug', icon: 'coffee' },
        { id: 'preset:book', name: 'Open Book', icon: 'book' }
    ],
    'UI Themes': [
        { id: 'theme:beautiful', name: 'Beautiful Jekyll', color: '#007BFF' },
        { id: 'theme:chalk', name: 'Chalk', color: '#96cbfe' },
        { id: 'theme:catppuccin', name: 'Catppuccin', color: '#cba6f7' },
        { id: 'theme:happy', name: 'Happy Hues', color: '#6246ea' },
        { id: 'theme:realtime', name: 'Realtime', color: '#ff8906' }
    ]
}

export const LEVEL_REWARDS = [
    { min: 1, max: 15, type: 'Basic Avatars', desc: 'Fresh Start (Seedling), Focused Cat, Coffee Mug, Open Book' },
    { min: 16, max: 30, type: 'UI Themes', desc: 'Midnight Blue, Forest Moss, Retro Terminal, Solarized Light' },
    { min: 31, max: 45, type: 'Advanced Avatars', desc: 'Library Owl, Coding Wizard, Zen Monk, Lightbulb Brain' },
    { min: 46, max: 60, type: 'App Icons', desc: 'Neon Timer, Golden Clock, Minimal Dot, Pixel Heart' },
    { min: 61, max: 75, type: 'Premium Themes', desc: 'Cyberpunk Neon, OLED True Black, Paper Texture, Glassmorphism' },
    { min: 76, max: 90, type: 'Custom Fonts', desc: 'JetBrains Mono, Playfair Display (Serif), Hand-written Style' },
    { min: 91, max: 99, type: 'Legendary Gear', desc: 'Crown Avatar, Animated "Glitch" Theme, Glowing Border Effects' },
    { min: 100, max: 1000, type: 'The Grand Reward', desc: 'Eternal Focus Badge + Custom "Study Ticket" Layout' }
]

export function getRewardForLevel(level) {
    // Find the range that includes this level
    const reward = LEVEL_REWARDS.find(r => level >= r.min && level <= r.max)
    // Fallback to highest reward if level > max defined
    return reward || LEVEL_REWARDS[LEVEL_REWARDS.length - 1]
}
