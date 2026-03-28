// Mapping of user-facing interval labels to cron expressions
export const cronMap: Record<string, string> = {
  '1m':  '* * * * *',
  '5m':  '*/5 * * * *',
  '15m': '*/15 * * * *',
  '1h':  '0 * * * *',
  '4h':  '0 */4 * * *',
  '1d':  '0 0 * * *',
}

// Parse cron and compute the next fire Date using simple arithmetic
export function getNextCronDate(cron: string): Date {
  const now = new Date()
  const parts = cron.trim().split(' ')
  const minutePart = parts[0]
  const hourPart = parts[1]

  const next = new Date(now)
  next.setSeconds(0, 0)

  if (minutePart === '*') {
    next.setMinutes(now.getMinutes() + 1)
    return next
  }

  if (minutePart.startsWith('*/')) {
    const step = parseInt(minutePart.slice(2), 10)
    const current = now.getMinutes()
    const nextMinute = current + (step - (current % step))
    next.setMinutes(nextMinute)
    if (next <= now) next.setMinutes(next.getMinutes() + step)
    return next
  }

  const fixedMinute = parseInt(minutePart, 10)
  next.setMinutes(fixedMinute)

  if (hourPart === '*') {
    if (next <= now) next.setHours(next.getHours() + 1)
    return next
  }

  if (hourPart.startsWith('*/')) {
    const step = parseInt(hourPart.slice(2), 10)
    const currentHour = now.getHours()
    const nextHour = currentHour + (step - (currentHour % step))
    next.setHours(nextHour)
    if (next <= now) next.setHours(next.getHours() + step)
    return next
  }

  const fixedHour = parseInt(hourPart, 10)
  next.setHours(fixedHour, fixedMinute, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next
}
