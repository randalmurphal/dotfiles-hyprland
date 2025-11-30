import GLib from "gi://GLib"
import { logError } from "./logger"

/**
 * Spawn a command asynchronously (fire and forget).
 */
export function spawnAsync(command: string): void {
  GLib.spawn_command_line_async(command)
}

/**
 * Spawn a command synchronously and return raw result.
 * Prefer spawnSyncOutput for most use cases.
 */
export function spawnSync(command: string): [boolean, Uint8Array] {
  return GLib.spawn_command_line_sync(command)
}

/**
 * Result type for spawnSyncOutput.
 */
export interface SpawnResult {
  ok: boolean
  output: string
  error?: string
}

/**
 * Spawn a command synchronously and return parsed output.
 * Logs errors instead of silently failing.
 */
export function spawnSyncOutput(command: string, context = "spawn"): SpawnResult {
  try {
    const [ok, stdout, stderr] = GLib.spawn_command_line_sync(command)
    if (ok && stdout) {
      return { ok: true, output: new TextDecoder().decode(stdout).trim() }
    }
    const errMsg = stderr ? new TextDecoder().decode(stderr).trim() : "Unknown error"
    logError(context, errMsg)
    return { ok: false, output: "", error: errMsg }
  } catch (e) {
    logError(context, e)
    return { ok: false, output: "", error: String(e) }
  }
}

/**
 * Read a file's contents as string.
 * Returns null on error (logged).
 */
export function readFileSync(path: string, context = "readFile"): string | null {
  try {
    const [ok, contents] = GLib.file_get_contents(path)
    if (ok && contents) {
      return new TextDecoder().decode(contents)
    }
    return null
  } catch (e) {
    logError(context, e)
    return null
  }
}

export function fileExists(path: string): boolean {
  return GLib.file_test(path, GLib.FileTest.EXISTS)
}

export function touchFile(path: string): void {
  spawnAsync(`touch ${path}`)
}

export function removeFile(path: string): void {
  spawnAsync(`rm -f ${path}`)
}

export function getHomeDir(): string {
  return GLib.get_home_dir()
}

export function getCacheDir(): string {
  return GLib.get_user_cache_dir()
}

export function getConfigDir(): string {
  return GLib.get_user_config_dir()
}
