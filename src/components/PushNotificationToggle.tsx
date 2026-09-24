import { useState, useEffect } from 'react'
import { API_URL } from '../utils/api'
import { fetchWithSession } from '../utils/authFetch'

function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function PushNotificationToggle() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check existing subscription
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          if (sub) setIsSubscribed(true)
        })
      })
    }
  }, [])

  const subscribe = async () => {
    if (!('serviceWorker' in navigator)) return alert('Service worker not supported')
    if (!('PushManager' in window)) return alert('Push notifications not supported')
    
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Notification permission denied')
      }

      const reg = await navigator.serviceWorker.ready
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BCai3kAc9VtvSaU0zTV7hMQRTMtUJf5WQ0ZT4TM-ezh5hetq9Av8uHHVCJvgwh81t90IMBlzxvRiUiPzSp-P1_I'
      const convertedVapidKey = urlB64ToUint8Array(vapidKey)

      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        })
      }

      // Send to backend
      const res = await fetchWithSession(`${API_URL}/api/push/subscribe`, {
        method: 'POST',
        body: JSON.stringify(sub)
      })

      if (res.ok) {
        setIsSubscribed(true)
      } else {
        throw new Error('Gagal menyimpan subscription di server')
      }
    } catch (err) {
      console.error(err)
      alert('Gagal mengaktifkan notifikasi: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const testPush = async () => {
    try {
      await fetchWithSession(`${API_URL}/api/push/test`, { method: 'POST' })
    } catch (e) {
      console.error(e)
    }
  }

  if (isSubscribed) {
    return (
      <button 
        onClick={testPush}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded-lg border border-teal-500/40 text-teal-400 hover:bg-teal-500/10 transition-all"
        title="Test Alert"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        Test Alert
      </button>
    )
  }

  return (
    <button 
      onClick={subscribe}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded-lg border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 transition-all"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      {loading ? 'Mengaktifkan...' : 'Aktifkan Alert Pagi'}
    </button>
  )
}
