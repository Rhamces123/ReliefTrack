import nodemailer from 'nodemailer'

const stripSpaces = (value = '') => String(value).replace(/\s+/g, '')

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
  body = body || {}

  const { recipient, displayName, deviceLabel, location, timeLabel, approveUrl, rejectUrl } = body

  if (
    !recipient ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient) ||
    !approveUrl ||
    !rejectUrl
  ) {
    res.status(400).json({ error: 'Missing recipient or action URLs' })
    return
  }

  const smtpUser = process.env.SMTP_USER || ''
  const smtpPass = stripSpaces(process.env.SMTP_PASS || '')
  if (!smtpUser || !smtpPass) {
    res.status(500).json({ error: 'SMTP credentials not configured' })
    return
  }

  const deviceLine = deviceLabel || 'a new browser'
  const locationLine = location ? `Location: ${location}` : ''
  const prettyTime = timeLabel || 'recently'

  const text = [
    `Hi ${displayName || 'there'},`,
    '',
    'A login to your ReliefTrack account was requested from a new device.',
    '',
    `Device: ${deviceLine}`,
    locationLine,
    `Time: ${prettyTime}`,
    '',
    'If this was you, approve the device so it can sign in.',
    "If you did not request this login, reject it and consider changing your password.",
    '',
    `Approve: ${approveUrl}`,
    `Reject: ${rejectUrl}`,
  ]
    .filter((line) => line !== '')
    .join('\n')

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0a0828;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0a0828 0%,#140a3c 50%,#001e32 100%);padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#171238;border:1px solid rgba(255,255,255,0.12);border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 8px;color:#aa3bff;font-size:18px;">ReliefTrack Security</h1>
                <h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;">New device login confirmation</h2>
                <p style="margin:0 0 20px;color:#c6c2e8;font-size:14px;line-height:1.6;">Hi ${displayName || 'there'},<br/><br/>A login to your ReliefTrack account was requested from a new device. Please confirm whether it was you.</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.05);border-radius:12px;margin-bottom:20px;">
                  <tr><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.08);color:#8b87ad;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Device</td></tr>
                  <tr><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.08);color:#ffffff;font-size:14px;">${deviceLine}</td></tr>
                  ${location ? `<tr><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.08);color:#8b87ad;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Location</td></tr>
                  <tr><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.08);color:#ffffff;font-size:14px;">${location}</td></tr>` : ''}
                  <tr><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.08);color:#8b87ad;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Time</td></tr>
                  <tr><td style="padding:12px 16px;color:#ffffff;font-size:14px;">${prettyTime}</td></tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                  <tr>
                    <td align="center" style="padding:0 4px 0 0;width:50%;">
                      <a href="${approveUrl}" style="display:block;background:linear-gradient(135deg,#7850ff 0%,#00c8c8 100%);color:#ffffff;text-decoration:none;padding:14px 16px;border-radius:10px;font-size:15px;font-weight:bold;text-align:center;">Approve</a>
                    </td>
                    <td align="center" style="padding:0 0 0 4px;width:50%;">
                      <a href="${rejectUrl}" style="display:block;background:#ff5c6c;color:#ffffff;text-decoration:none;padding:14px 16px;border-radius:10px;font-size:15px;font-weight:bold;text-align:center;">Reject</a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0;color:#8b87ad;font-size:12px;line-height:1.6;">
                  If you did not request this login, reject it and change your password. This link only works once.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
      from: `"ReliefTrack Security" <${smtpUser}>`,
      to: recipient,
      subject: 'ReliefTrack — new device login confirmation required',
      text,
      html,
    })

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[device-email] send failed:', err.message)
    res.status(500).json({ error: 'Failed to send email', detail: err.message })
  }
}