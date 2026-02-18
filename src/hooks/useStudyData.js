import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { calculateXP, calculateLevel, calculateStreak, calculateMomentum } from '../lib/gamification'
import { checkAchievements } from '../lib/achievements'

const getToken = () => localStorage.getItem('sync_token')
const getUserName = () => localStorage.getItem('user_name')
const getAvatar = () => localStorage.getItem('avatar_url')
const getSettings = () => JSON.parse(localStorage.getItem('user_settings') || '{}')
const getAchievements = () => JSON.parse(localStorage.getItem('user_achievements') || '[]')

export function useStudyData() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // --- Identity Management ---

  const registerUser = useCallback(async (name) => {
    setLoading(true)
    setError(null)
    try {
      const newToken = `study-${uuidv4().slice(0, 8)}`

      // Atomic Registration: Insert Name + Token into Registry
      const { error: regError } = await supabase
        .from('registered_tokens')
        .insert({
          token: newToken,
          user_name: name,
          settings: {},
          achievements: []
        })

      if (regError) throw regError

      // Local Commitment
      localStorage.setItem('sync_token', newToken)
      localStorage.setItem('user_name', name)
      localStorage.setItem('user_settings', '{}')
      localStorage.setItem('user_achievements', '[]')

      return { success: true, token: newToken }
    } catch (err) {
      console.error("Registration failed:", err)
      setError(err.message)
      return { success: false, message: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  const verifyToken = useCallback(async (inputToken) => {
    setLoading(true)
    setError(null)
    try {
      const cleanToken = inputToken.trim()

      const { data, error } = await supabase
        .from('registered_tokens')
        .select('user_name, avatar_url, settings, achievements')
        .eq('token', cleanToken)
        .single()

      if (error || !data) {
        throw new Error("Invalid Identity Key. Profile not found.")
      }

      // Session Hydration
      localStorage.setItem('sync_token', cleanToken)
      localStorage.setItem('user_name', data.user_name)
      if (data.avatar_url) localStorage.setItem('avatar_url', data.avatar_url)
      if (data.settings) localStorage.setItem('user_settings', JSON.stringify(data.settings))
      if (data.achievements) localStorage.setItem('user_achievements', JSON.stringify(data.achievements))

      return {
        success: true,
        userName: data.user_name,
        avatarUrl: data.avatar_url,
        settings: data.settings,
        achievements: data.achievements
      }
    } catch (err) {
      console.error("Verification failed:", err)
      setError(err.message)
      return { success: false, message: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('sync_token')
    localStorage.removeItem('user_name')
    localStorage.removeItem('avatar_url')
    localStorage.removeItem('user_settings')
    localStorage.removeItem('user_achievements')
  }, [])

  // --- Settings & Profile Management ---

  const fetchSettings = useCallback(async () => {
    // Silent load (no global loading state to avoid flickering)
    try {
      const token = getToken()
      if (!token) return {
          settings: getSettings(),
          achievements: getAchievements(),
          avatarUrl: getAvatar()
      }

      const { data, error } = await supabase
        .from('registered_tokens')
        .select('settings, avatar_url, achievements')
        .eq('token', token)
        .single()

      if (error) throw error

      if (data) {
          // Update local storage
          localStorage.setItem('user_settings', JSON.stringify(data.settings || {}))
          localStorage.setItem('user_achievements', JSON.stringify(data.achievements || []))
          if (data.avatar_url) localStorage.setItem('avatar_url', data.avatar_url)

          return {
              settings: data.settings || {},
              achievements: data.achievements || [],
              avatarUrl: data.avatar_url
          }
      }
    } catch (err) {
      console.error("Fetch settings failed:", err)
    }
    return {
        settings: getSettings(),
        achievements: getAchievements(),
        avatarUrl: getAvatar()
    }
  }, [])

  const updateSettings = useCallback(async (newSettings) => {
    setLoading(true)
    setError(null)
    try {
      const currentSettings = getSettings()
      const updatedSettings = { ...currentSettings, ...newSettings }

      // Local Update
      localStorage.setItem('user_settings', JSON.stringify(updatedSettings))

      // Cloud Update
      const token = getToken()
      if (token) {
        const { error: dbError } = await supabase
          .from('registered_tokens')
          .update({ settings: updatedSettings })
          .eq('token', token)

        if (dbError) throw dbError
      }
      return { success: true, settings: updatedSettings }
    } catch (err) {
      console.error("Settings update failed:", err)
      setError(err.message)
      return { success: false, message: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  const updateAvatar = useCallback(async (url) => {
    setLoading(true)
    setError(null)
    try {
      // Local Update
      localStorage.setItem('avatar_url', url)

      // Cloud Update
      const token = getToken()
      if (token) {
        const { error: dbError } = await supabase
          .from('registered_tokens')
          .update({ avatar_url: url })
          .eq('token', token)

        if (dbError) throw dbError
      }
      return { success: true, url }
    } catch (err) {
      console.error("Avatar update failed:", err)
      setError(err.message)
      return { success: false, message: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  const updateAchievements = useCallback(async (newAchievements) => {
    // Usually called internally, not by UI directly
    try {
       // Local
       localStorage.setItem('user_achievements', JSON.stringify(newAchievements))

       // Cloud
       const token = getToken()
       if (token) {
         await supabase
           .from('registered_tokens')
           .update({ achievements: newAchievements })
           .eq('token', token)
       }
       return true
    } catch (err) {
      console.error("Achievement update failed:", err)
      return false
    }
  }, [])

  // --- Study Data Logic ---

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch Local Sessions
      const local = JSON.parse(localStorage.getItem('local_study_sessions') || '[]')

      // 2. Fetch Cloud Sessions if token exists
      let cloud = []
      const token = getToken()

      if (token) {
        const { data, error: dbError } = await supabase
          .from('study_sessions')
          .select('*')
          .eq('token', token)
          .order('created_at', { ascending: false })

        if (dbError) throw dbError
        if (data) cloud = data
      }

      // 3. Merge and Sort
      const all = [...local, ...cloud].sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
      )

      return all
    } catch (err) {
      console.error("Error fetching sessions:", err)
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const saveSession = useCallback(async (sessionData) => {
    const token = getToken()
    // Use provided timestamp or current time
    const timestamp = sessionData.created_at || new Date().toISOString()
    let saved = false

    if (token) {
      // Sync Mode: Save to Supabase
      try {
        const { error: dbError } = await supabase.from('study_sessions').insert({
          subject: sessionData.subject,
          duration_minutes: sessionData.duration_minutes,
          token: token,
          created_at: timestamp
        })

        if (dbError) throw dbError
        saved = true
      } catch (err) {
        console.error("Cloud save failed:", err)
        setError(err.message)
        return false
      }
    } else {
      // Guest Mode: Save to LocalStorage
      try {
        const local = JSON.parse(localStorage.getItem('local_study_sessions') || '[]')
        const newSession = {
          subject: sessionData.subject,
          duration_minutes: sessionData.duration_minutes,
          id: `local-${Date.now()}`,
          created_at: timestamp
        }
        local.push(newSession)
        localStorage.setItem('local_study_sessions', JSON.stringify(local))
        saved = true
      } catch (err) {
        console.error("Local save failed:", err)
        return false
      }
    }

    if (saved) {
        // Check Achievements (Silent background check)
        try {
             // We need sessions to calculate stats.
             // To avoid triggering global loading, we duplicate fetch logic slightly or use a helper
             // But simplest is to call fetchSessions() and ignore loading flash for now, or handle it.
             // Let's implement a silent fetch helper if needed, but for now reuse fetchSessions logic without setting state?
             // No, let's just use what we have.

             // Actually, we can just grab local and cloud without setting state
             const local = JSON.parse(localStorage.getItem('local_study_sessions') || '[]')
             let cloud = []
             if (token) {
                 const { data } = await supabase
                    .from('study_sessions')
                    .select('*')
                    .eq('token', token)
                 if (data) cloud = data
             }
             const allSessions = [...local, ...cloud]

             const xp = calculateXP(allSessions)
             const level = calculateLevel(xp)
             const streak = calculateStreak(allSessions)
             const momentum = calculateMomentum(allSessions)

             const currentAchievements = getAchievements()
             const settings = getSettings()

             const newUnlocks = checkAchievements(allSessions, { xp, level, streak, momentum }, settings, currentAchievements)

             if (newUnlocks.length > 0) {
                 const updated = [...currentAchievements, ...newUnlocks]
                 await updateAchievements(updated)
                 return { success: true, newAchievements: newUnlocks }
             }
        } catch (e) {
            console.error("Achievement check failed", e)
        }
        return { success: true, newAchievements: [] }
    }
    return false
  }, [updateAchievements])

  const syncLocalToCloud = useCallback(async () => {
    const token = getToken()
    if (!token) return { success: false, message: "No sync token found." }

    const local = JSON.parse(localStorage.getItem('local_study_sessions') || '[]')
    if (local.length === 0) return { success: true, message: "No local data to sync." }

    try {
      // Prepare data for insertion
      const toInsert = local.map(s => ({
        subject: s.subject,
        duration_minutes: s.duration_minutes,
        created_at: s.created_at,
        token: token
      }))

      const { error: dbError } = await supabase.from('study_sessions').insert(toInsert)

      if (dbError) throw dbError

      // Clear local storage after successful sync
      localStorage.removeItem('local_study_sessions')

      return { success: true, message: `Successfully synced ${local.length} sessions.` }
    } catch (err) {
      console.error("Sync failed:", err)
      return { success: false, message: "Sync failed. Please try again." }
    }
  }, [])

  return {
    fetchSessions,
    saveSession,
    syncLocalToCloud,
    registerUser,
    verifyToken,
    logout,
    getUserName,
    getToken,
    getAvatar,
    getSettings,
    getAchievements,
    fetchSettings,
    updateSettings,
    updateAvatar,
    updateAchievements,
    loading,
    error
  }
}
