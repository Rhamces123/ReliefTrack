/**
 * Password validation rules:
 * 1. Must be at least 8 characters long
 * 2. First character must be a capital letter (A-Z)
 * 3. Must contain at least one number (0-9)
 * 4. Must contain at least one symbol / special character
 */

export function getPasswordValidationState(password) {
  const p = password || ''
  return {
    startsWithCapital: /^[A-Z]/.test(p),
    hasMinLength: p.length >= 8,
    hasNumber: /[0-9]/.test(p),
    hasSymbol: /[^A-Za-z0-9]/.test(p),
  }
}

export function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.'
  }
  if (!/^[A-Z]/.test(password)) {
    return 'Password must start with a capital letter (A-Z).'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number (0-9).'
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one symbol (e.g. !@#$%^&*).'
  }
  return null
}
