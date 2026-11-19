import net from 'net'

export async function verifyGmailMailbox(email) {
  const cleanEmail = (email || '').trim().toLowerCase()
  if (!cleanEmail || !cleanEmail.endsWith('@gmail.com')) {
    return { exists: false, error: 'Only @gmail.com addresses can be verified.' }
  }

  const username = cleanEmail.replace('@gmail.com', '')
  if (username.length < 6 || username.length > 30) {
    return { exists: false, error: 'Gmail username must be 6 to 30 characters.' }
  }

  return new Promise((resolve) => {
    let resolved = false
    const finish = (result) => {
      if (!resolved) {
        resolved = true
        try { socket.destroy() } catch {}
        resolve(result)
      }
    }

    const socket = net.createConnection(25, 'gmail-smtp-in.l.google.com')
    let step = 0

    socket.setEncoding('utf-8')
    socket.setTimeout(5000)

    socket.on('data', (data) => {
      if (data.includes('220') && step === 0) {
        step = 1
        socket.write('HELO relieftrack.com\r\n')
      } else if (data.includes('250') && step === 1) {
        step = 2
        socket.write('MAIL FROM:<verify@relieftrack.com>\r\n')
      } else if (data.includes('250') && step === 2) {
        step = 3
        socket.write(`RCPT TO:<${cleanEmail}>\r\n`)
      } else if (step === 3) {
        step = 4
        socket.write('QUIT\r\n')
        if (data.includes('550') || data.includes('5.1.1') || data.includes('NoSuchUser')) {
          finish({ exists: false, error: 'This Gmail address does not exist on Google.' })
        } else if (data.includes('250')) {
          finish({ exists: true })
        } else if (data.includes('552') || data.includes('553') || data.includes('551')) {
          finish({ exists: false, error: 'This Gmail address cannot receive messages or does not exist.' })
        } else {
          finish({ exists: null, message: data.trim() })
        }
      }
    })

    socket.on('error', (err) => {
      finish({ exists: null, error: err.message })
    })

    socket.on('timeout', () => {
      finish({ exists: null, error: 'Verification timed out' })
    })
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' })
      return
    }
  }

  const email = body?.email
  if (!email) {
    res.status(400).json({ error: 'Email is required' })
    return
  }

  try {
    const result = await verifyGmailMailbox(email)
    res.status(200).json(result)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Verification failed' })
  }
}
