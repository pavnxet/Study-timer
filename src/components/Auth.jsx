import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'
import { getURL } from '../lib/utils'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('email') // 'email' | 'verify'
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const handleSendOtp = async (event) => {
    event.preventDefault()

    setLoading(true)
    setMessage(null)
    setError(null)

    // Send OTP
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, // If user doesn't exist, create them
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage('OTP sent! Check your email.')
      setStep('verify')
    }
    setLoading(false)
  }

  const handleVerifyOtp = async (event) => {
    event.preventDefault()

    setLoading(true)
    setMessage(null)
    setError(null)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
        // Successful verification automatically updates the session via onAuthStateChange in App.jsx
        // We don't need to manually redirect here, the App component will re-render
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white p-4">
      <div className="w-full max-w-md space-y-8 bg-neutral-800 p-8 rounded-xl shadow-lg border border-neutral-700">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight">Study Tracker</h2>
          <p className="mt-2 text-sm text-neutral-400">
            {step === 'email' ? 'Sign in with email' : 'Verify your email'}
          </p>
        </div>

        {message && (
          <div className="bg-green-900/50 border border-green-500/50 text-green-200 p-4 rounded-lg text-center text-sm">
            {message}
          </div>
        )}

        {step === 'email' ? (
            <form className="mt-8 space-y-6" onSubmit={handleSendOtp}>
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

                <div>
                <button
                    type="submit"
                    disabled={loading}
                    className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                    {loading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                    ) : (
                    'Send OTP'
                    )}
                </button>
                </div>

                {error && (
                <div className="text-red-400 text-sm text-center mt-2">
                    {error}
                </div>
                )}
            </form>
        ) : (
            <form className="mt-8 space-y-6" onSubmit={handleVerifyOtp}>
                <div>
                <label htmlFor="otp" className="sr-only">One-Time Password</label>
                <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    className="relative block w-full rounded-md border-0 bg-neutral-700 py-3 px-4 text-white ring-1 ring-inset ring-neutral-600 placeholder:text-neutral-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 transition-all duration-200 tracking-widest text-center text-lg"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                />
                </div>

                <div className="flex flex-col space-y-3">
                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                        {loading ? (
                        <Loader2 className="animate-spin h-5 w-5" />
                        ) : (
                        'Verify Code'
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => { setStep('email'); setMessage(null); setError(null); }}
                        className="text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                        Change Email / Resend
                    </button>
                </div>

                {error && (
                <div className="text-red-400 text-sm text-center mt-2">
                    {error}
                </div>
                )}
            </form>
        )}
      </div>
    </div>
  )
}
