import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export function useStudyData() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const [syncToken, setSyncToken] = useState(localStorage.getItem('sync_token') || '')
  const [userName, setUserName] = useState(localStorage.getItem('user_name') || '')

  const getToken = useCallback(() => syncToken, [syncToken])
  const getUserName = useCallback(() => userName, [userName])

  const hydrateUserSession = useCallback(async (userId) => {
    try {
      const { data, error: regError } = await supabase
        .from('registered_tokens')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (regError) {
        if (regError.code === 'PGRST116') {
          // No record found in registry for this user_id yet
          return null
        }
        throw regError
      }

      if (data) {
        localStorage.setItem('sync_token', data.token)
        localStorage.setItem('user_name', data.user_name)
        setSyncToken(data.token)
        setUserName(data.user_name)
        return data
      }
    } catch (err) {
      console.error("Hydration failed:", err)
    }
    return null
  }, [])

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        hydrateUserSession(session.user.id)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await hydrateUserSession(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('sync_token')
        localStorage.removeItem('user_name')
        setSyncToken('')
        setUserName('')
      }
    })

    return () => subscription.unsubscribe()
  }, [hydrateUserSession])

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
      setSyncToken(newToken)
      setUserName(name)

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
      setSyncToken(cleanToken)
      setUserName(data.user_name)

      return { success: true, userName: data.user_name }
    } catch (err) {
      console.error("Verification failed:", err)
      setError(err.message)
      return { success: false, message: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('sync_token')
    localStorage.removeItem('user_name')
    setSyncToken('')
    setUserName('')
  }, [])

  const signUpWithPasskey = useCallback(async (email, name) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: authError } = await supabase.auth.signInWithPasskey({
        email,
        options: {
          registrationOptions: {
            userDisplayName: name,
          }
        }
      })

      if (authError) throw authError

      const userId = data.user.id
      const newToken = `study-${uuidv4().slice(0, 8)}`

      const { error: regError } = await supabase
        .from('registered_tokens')
        .insert({
          token: newToken,
          user_name: name,
          user_id: userId
        })

      if (regError) throw regError

      localStorage.setItem('sync_token', newToken)
      localStorage.setItem('user_name', name)
      setSyncToken(newToken)
      setUserName(name)

      return { success: true }
    } catch (err) {
      console.error("Sign up with passkey failed:", err)
      setError(err.message)
      return { success: false, message: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  const signInWithPasskey = useCallback(async (email) => {
    setLoading(true)
    setError(null)
    try {
      const { error: authError } = await supabase.auth.signInWithPasskey({
        email,
      })

      if (authError) throw authError

      return { success: true }
    } catch (err) {
      console.error("Sign in with passkey failed:", err)
      setError(err.message)
      return { success: false, message: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  const upgradeToPasskey = useCallback(async (email) => {
    setLoading(true)
    setError(null)
    const currentToken = syncToken
    const currentName = userName

    if (!currentToken) {
        setError("No active token to upgrade.")
        setLoading(false)
        return { success: false }
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPasskey({
        email,
        options: {
          registrationOptions: {
            userDisplayName: currentName,
          }
        }
      })

      if (authError) throw authError

      const userId = data.user.id

      // Link token to user_id
      const { error: regError } = await supabase
        .from('registered_tokens')
        .update({ user_id: userId })
        .eq('token', currentToken)

      if (regError) throw regError

      // Backfill existing sessions
      const { error: sessionError } = await supabase
        .from('study_sessions')
        .update({ user_id: userId })
        .eq('token', currentToken)

      if (sessionError) throw sessionError

      return { success: true }
    } catch (err) {
      console.error("Upgrade to passkey failed:", err)
      setError(err.message)
      return { success: false, message: err.message }
    } finally {
      setLoading(false)
    }
  }, [syncToken, userName])

  // --- Study Data Logic ---

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch Local Sessions
      const local = JSON.parse(localStorage.getItem('local_study_sessions') || '[]')

      // 2. Fetch Cloud Sessions
      let cloud = []
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        // Fetch sessions for this user_id or token (for hybrid support)
        const { data, error: dbError } = await supabase
          .from('study_sessions')
          .select('*')
          .or(`user_id.eq.${session.user.id},token.eq.${syncToken}`)
          .order('created_at', { ascending: false })

        if (dbError) throw dbError
        if (data) cloud = data
      } else if (syncToken) {
        // Guest/Legacy mode: fetch by token
        const { data, error: dbError } = await supabase
          .from('study_sessions')
          .select('*')
          .eq('token', syncToken)
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
  }, [syncToken])

  const saveSession = useCallback(async (sessionData) => {
    const { data: { session } } = await supabase.auth.getSession()
    // Use provided timestamp or current time
    const timestamp = sessionData.created_at || new Date().toISOString()

    if (syncToken || session?.user) {
      // Sync Mode: Save to Supabase
      try {
        const { error: dbError } = await supabase.from('study_sessions').insert({
          subject: sessionData.subject,
          duration_minutes: sessionData.duration_minutes,
          token: syncToken,
          user_id: session?.user?.id,
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
  }, [syncToken])

  const syncLocalToCloud = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()

    if (!syncToken && !session?.user) return { success: false, message: "No sync identity found." }

    const local = JSON.parse(localStorage.getItem('local_study_sessions') || '[]')
    if (local.length === 0) return { success: true, message: "No local data to sync." }

    try {
      // Prepare data for insertion
      const toInsert = local.map(s => ({
        subject: s.subject,
        duration_minutes: s.duration_minutes,
        created_at: s.created_at,
        token: syncToken,
        user_id: session?.user?.id
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
  }, [syncToken])

  return {
    fetchSessions,
    saveSession,
    syncLocalToCloud,
    registerUser,
    verifyToken,
    signUpWithPasskey,
    signInWithPasskey,
    upgradeToPasskey,
    logout,
    getUserName,
    getToken,
    user,
    syncToken,
    userName,
    loading,
    error
  }
}
