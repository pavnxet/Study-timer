import { supabase } from './supabase'

export async function fetchLeaderboard(token, period = 'all_time') {
  try {
    const { data, error } = await supabase.rpc('get_leaderboard', {
      viewer_token: token,
      period: period
    })

    if (error) throw error
    return data || []
  } catch (err) {
    console.error("Leaderboard fetch failed:", err)
    return []
  }
}
