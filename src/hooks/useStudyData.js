import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export function useStudyData() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const getToken = () => localStorage.getItem('sync_token')
  const getUserName = () => localStorage.getItem('user_name')

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
          user_name: name
        })

      if (regError) throw regError

      // Local Commitment
      localStorage.setItem('sync_token', newToken)
      localStorage.setItem('user_name', name)

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
        .select('user_name')
        .eq('token', cleanToken)
        .single()

      if (error || !data) {
        throw new Error("Invalid Identity Key. Profile not found.")
      }

      // Session Hydration
      localStorage.setItem('sync_token', cleanToken)
      localStorage.setItem('user_name', data.user_name)

      return { success: true, userName: data.user_name }
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
    const timestamp = new Date().toISOString()

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
        return true
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
        return true
      } catch (err) {
        console.error("Local save failed:", err)
        return false
      }
    }
  }, [])

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
    loading,
    error
  }
}
