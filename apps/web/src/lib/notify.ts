import { notifications } from '@mantine/notifications'
import { isApiError } from './api/client'

/** Short confirmation after an action worked. */
export function notifyDone(message: string) {
  notifications.show({ message, color: 'green' })
}

/** Error toast that shows the API's message when there is one. */
export function notifyError(error: unknown, fallback = 'That didn’t work. Try again.') {
  notifications.show({ color: 'red', message: isApiError(error) ? error.message : fallback })
}
