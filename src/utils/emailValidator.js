/**
 * Validates that an email is a real, well-formed Gmail (@gmail.com) address.
 * Follows Google's Gmail address guidelines:
 * - Must end with @gmail.com
 * - Username must be 6 to 30 characters
 * - Only letters (a-z), numbers (0-9), and periods (.)
 * - Cannot begin or end with a period
 * - Cannot contain consecutive periods (..)
 */
export function validateGmail(email) {
  if (!email || !email.trim()) {
    return 'Gmail address is required.'
  }

  const clean = email.trim().toLowerCase()

  if (!clean.includes('@')) {
    return 'Please include "@gmail.com" in your email.'
  }

  const parts = clean.split('@')
  if (parts.length !== 2) {
    return 'Please enter a valid Gmail address.'
  }

  const [username, domain] = parts

  if (domain !== 'gmail.com') {
    return 'Only real Gmail accounts (@gmail.com) are accepted.'
  }

  if (username.length < 6) {
    return 'Gmail username must be at least 6 characters long.'
  }

  if (username.length > 30) {
    return 'Gmail username cannot exceed 30 characters.'
  }

  if (username.startsWith('.') || username.endsWith('.')) {
    return 'Gmail username cannot begin or end with a period.'
  }

  if (username.includes('..')) {
    return 'Gmail username cannot contain consecutive periods.'
  }

  // Letters, digits, and periods only
  if (!/^[a-z0-9.]+$/.test(username)) {
    return 'Only letters (a-z), numbers (0-9), and periods (.) are allowed.'
  }

  return null
}
