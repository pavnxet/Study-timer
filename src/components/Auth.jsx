import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { Turnstile } from '@marsidev/react-turnstile'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [captchaToken, setCaptchaToken] = useState(null)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const turnstileRef = useRef()

  const handleResetCaptcha = () => {
    if (turnstileRef.current) {
      turnstileRef.current.reset()
    }
    setCaptchaToken(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!captchaToken) {
      setError("Please complete the security check.")
      return
    }

    setLoading(true)
    setMessage(null)
    setError(null)

    let result

    if (mode === 'signup') {
      result = await supabase.auth.signUp({
        email,
        password,
        options: {
          captchaToken,
        },
      })
    } else {
      result = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken,
        },
      })
    }

    const { error: authError } = result

    if (authError) {
      setError(authError.message)
      handleResetCaptcha()
    } else {
        // Successful login automatically updates session via onAuthStateChange in App.jsx
        if (mode === 'signup') {
            // Check if email confirmation is required (user said they disabled it, but good to handle)
            if (result.data?.user && !result.data.session) {
                setMessage('Account created! Please verify your email if required.')
            } else {
                setMessage('Account created! Logging you in...')
            }
        }
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white p-4">
      <div className="w-full max-w-md space-y-8 bg-neutral-800 p-8 rounded-xl shadow-lg border border-neutral-700">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight">Study Tracker</h2>
          <p className="mt-2 text-sm text-neutral-400">
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {message && (
          <div className="bg-green-900/50 border border-green-500/50 text-green-200 p-4 rounded-lg text-center text-sm">
            {message}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
                <div>
                    <label htmlFor="email" className="sr-only">Email address</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="relative block w-full rounded-md border-0 bg-neutral-700 py-3 px-4 text-white ring-1 ring-inset ring-neutral-600 placeholder:text-neutral-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 transition-all duration-200"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="relative">
                    <label htmlFor="password" className="sr-only">Password</label>
                    <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={mode === 'login' ? "current-password" : "new-password"}
                        required
                        className="relative block w-full rounded-md border-0 bg-neutral-700 py-3 px-4 pr-12 text-white ring-1 ring-inset ring-neutral-600 placeholder:text-neutral-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 transition-all duration-200"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-white"
                    >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            <div className="flex justify-center py-2">
                <Turnstile
                    ref={turnstileRef}
                    siteKey={TURNSTILE_SITE_KEY}
                    onSuccess={(token) => setCaptchaToken(token)}
                    onError={() => setCaptchaToken(null)}
                    onExpire={() => setCaptchaToken(null)}
                    options={{
                        theme: 'dark',
                        size: 'normal',
                    }}
                />
            </div>

            <div>
                <button
                    type="submit"
                    disabled={loading || !captchaToken}
                    className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                    {loading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                    ) : (
                    mode === 'login' ? 'Sign In' : 'Sign Up'
                    )}
                </button>
            </div>

            {error && (
            <div className="text-red-400 text-sm text-center mt-2">
                {error}
            </div>
            )}

            <div className="text-center mt-4">
                <button
                    type="button"
                    onClick={() => {
                        setMode(mode === 'login' ? 'signup' : 'login')
                        setMessage(null)
                        setError(null)
                        handleResetCaptcha()
                    }}
                    className="text-sm text-neutral-400 hover:text-white transition-colors underline underline-offset-4"
                >
                    {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
                </button>
            </div>
        </form>
      </div>
    </div>
  )
}
