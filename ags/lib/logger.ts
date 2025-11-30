// Centralized logging for AGS
// Replaces silent catch blocks with proper error reporting

export function logError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  print(`[AGS:${context}] Error: ${message}`)
}

export function logWarning(context: string, message: string): void {
  print(`[AGS:${context}] Warning: ${message}`)
}

export function logDebug(context: string, message: string): void {
  // Uncomment for debugging:
  // print(`[AGS:${context}] ${message}`)
}
