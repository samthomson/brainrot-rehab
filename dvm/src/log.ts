/** Logger module. Other files import from './log.js' (compiled from this .ts file). */
type Level = 'info' | 'warn' | 'error'

const LEVEL_PREFIX: Record<Level, string> = {
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
}

function ts(): string {
  return new Date().toISOString()
}

function fmt(level: Level, scope: string, msg: string, meta?: Record<string, unknown>): string {
  const base = `[${ts()}] ${LEVEL_PREFIX[level]} [${scope}] ${msg}`
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`
  }
  return base
}

export function createLogger(scope: string) {
  return {
    info(msg: string, meta?: Record<string, unknown>) {
      console.log(fmt('info', scope, msg, meta))
    },
    warn(msg: string, meta?: Record<string, unknown>) {
      console.warn(fmt('warn', scope, msg, meta))
    },
    error(msg: string, meta?: Record<string, unknown>) {
      console.error(fmt('error', scope, msg, meta))
    },
  }
}
