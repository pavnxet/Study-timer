import { useState, useEffect } from 'react'
import { Cloud, Lock, Copy, LogOut, Check, ArrowUpCircle, User, AlertCircle, QrCode } from 'lucide-react'
import { useStudyData } from '../hooks/useStudyData'
import { QRCodeCanvas } from 'qrcode.react'

export default function SyncSettings() {
  const [token, setToken] = useState(localStorage.getItem('sync_token') || '')
  const [userName, setUserName] = useState(localStorage.getItem('user_name') || '')
  const [inputToken, setInputToken] = useState('')
  const [inputName, setInputName] = useState('')
  const [copied, setCopied] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)
  const [authError, setAuthError] = useState(null)
  const [showQR, setShowQR] = useState(false)

  const { syncLocalToCloud, registerUser, verifyToken, logout, loading } = useStudyData()

  const handleRegister = async () => {
    if (!inputName.trim()) {
      setAuthError("Please enter your name.")
      return
    }

    setAuthError(null)
    const result = await registerUser(inputName.trim())

    if (result.success) {
      setToken(result.token)
      setUserName(inputName.trim())
      setInputName('')
    } else {
      setAuthError(result.message)
    }
  }

  const handleVerify = async () => {
    if (!inputToken.trim()) return

    setAuthError(null)
    const result = await verifyToken(inputToken.trim())

    if (result.success) {
      setToken(inputToken.trim())
      setUserName(result.userName)
      setInputToken('')
    } else {
        setAuthError(result.message)
    }
  }

  const handleLogout = () => {
    logout()
    setToken('')
    setUserName('')
    setShowQR(false)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSync = async () => {
    setSyncStatus('Syncing...')
    const result = await syncLocalToCloud()
    setSyncStatus(result.message)
    setTimeout(() => setSyncStatus(null), 3000)
  }

  // Check if we have local data that needs syncing
  const hasLocalData = !!localStorage.getItem('local_study_sessions') && JSON.parse(localStorage.getItem('local_study_sessions') || '[]').length > 0

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-white p-4 max-w-md mx-auto animate-in fade-in duration-500">
      <div className="bg-neutral-800 p-8 rounded-xl shadow-lg border border-neutral-700 w-full">
        <div className="text-center mb-8">
          <Cloud className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold">Sync Settings</h2>
          <p className="text-neutral-400 mt-2 text-sm">
            {token
              ? `Signed in as ${userName}`
              : "Your data is only saved on this device."}
          </p>
        </div>

        {!token ? (
          <div className="space-y-6">
            {authError && (
                <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {authError}
                </div>
            )}

            <div className="p-4 bg-neutral-700/30 rounded-lg border border-neutral-600 space-y-4">
              <h3 className="font-medium">New User?</h3>
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Your Name</label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="e.g. Alex"
                            value={inputName}
                            onChange={(e) => setInputName(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-600 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    </div>
                </div>
              </div>
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                {loading ? 'Creating...' : 'Create Identity & Key'}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-neutral-800 text-neutral-400">Or</span>
              </div>
            </div>

            <div className="p-4 bg-neutral-700/30 rounded-lg border border-neutral-600">
              <h3 className="font-medium mb-2">Have a Key?</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste your key here..."
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  className="flex-1 bg-neutral-900 border border-neutral-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleVerify}
                  disabled={loading}
                  className="bg-neutral-600 hover:bg-neutral-500 text-white px-4 rounded-md transition-colors disabled:opacity-50"
                >
                  {loading ? '...' : 'Load'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
              <label className="text-xs text-indigo-300 font-medium uppercase tracking-wider block mb-2">Your Identity Key</label>

              <div className="flex items-center gap-2 bg-neutral-900 p-3 rounded border border-neutral-700 font-mono text-sm break-all mb-3">
                <span className="flex-1">{token}</span>
                <button
                  onClick={copyToClipboard}
                  className="text-neutral-400 hover:text-white p-1 hover:bg-neutral-800 rounded transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {showQR && (
                  <div className="flex justify-center my-4 bg-white p-4 rounded-lg">
                      <QRCodeCanvas value={token} size={150} />
                  </div>
              )}

              <button
                onClick={() => setShowQR(!showQR)}
                className="w-full text-xs flex items-center justify-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                  <QrCode className="w-3 h-3" />
                  {showQR ? 'Hide QR Code' : 'Show QR Code'}
              </button>

              <p className="text-xs text-neutral-400 mt-2">
                ⚠️ Keep this key safe! Use it to restore your profile "{userName}" on other devices.
              </p>
            </div>

            {hasLocalData && (
                <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                     <h3 className="text-sm font-medium text-yellow-500 mb-2">Sync Pending</h3>
                     <p className="text-xs text-neutral-400 mb-3">You have local study sessions that haven't been uploaded yet.</p>
                     <button
                        onClick={handleSync}
                        className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2 text-sm"
                     >
                        <ArrowUpCircle className="w-4 h-4" />
                        Sync Local Data to Cloud
                     </button>
                     {syncStatus && <p className="text-xs text-center mt-2 text-white">{syncStatus}</p>}
                </div>
            )}

            <button
              onClick={handleLogout}
              className="w-full text-red-400 hover:text-red-300 hover:bg-red-900/20 py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out (Clear Key)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
