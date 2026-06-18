import type { ErrorPayload } from '@vibecam/types';

/** Turn raw media/permission/signaling errors into friendly UI text. */
export function mediaErrorMessage(err: unknown): string {
  if (isErrorPayload(err)) return err.message;
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        return 'Permission denied. Allow microphone and screen sharing to join.';
      case 'NotFoundError':
        return 'No microphone found. Connect an input device and try again.';
      case 'NotReadableError':
        return 'Your microphone or screen is in use by another application.';
      case 'AbortError':
        return 'Screen selection was cancelled.';
      default:
        return `Media error: ${err.message}`;
    }
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}

function isErrorPayload(err: unknown): err is ErrorPayload {
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
}
