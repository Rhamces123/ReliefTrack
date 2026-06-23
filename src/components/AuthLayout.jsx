import { useState, useEffect } from 'react'
import nagaLogo from '../assets/naga-logo.jpg'

const BG_IMAGES = ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg']

export default function AuthLayout({ children }) {
  const [bgIndex, setBgIndex] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setBgIndex((prev) => (prev + 1) % BG_IMAGES.length)
        setFading(false)
      }, 800)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="login-bg">
      <div
        className={`bg-slide ${fading ? 'fade-out' : 'fade-in'}`}
        style={{ backgroundImage: `url(${BG_IMAGES[bgIndex]})` }}
      />
      <div className="bg-overlay" />

      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="bg-dots" />

      <div className="glass-card">
        <div className="glass-card-scroll">
          <div className="avatar-ring">
            <img src={nagaLogo} alt="Profile" />
          </div>

          {children}

          <div className="slide-dots">
            {BG_IMAGES.map((_, i) => (
              <span
                key={i}
                className={`dot ${i === bgIndex ? 'active' : ''}`}
                onClick={() => setBgIndex(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
