type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
const debugEnabled = /^(1|true|yes)$/i.test(process.env.PI_TEAM_DEBUG || '');
function timestamp(): string {
  return new Date().toTimeString().slice(0, 8);
}
function emit(level: Level, agent: string, message: string): void {
  if (level === 'DEBUG' && !debugEnabled) return;
  const line = `[${timestamp()}] [${level}] [${agent}] ${message}`;
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}
function log(level: Level, agentOrMessage: string, maybeMessage?: string): void {
  if (maybeMessage === undefined) emit(level, 'team', agentOrMessage);
  else emit(level, agentOrMessage, maybeMessage);
}
export const logger = {
  info: (agentOrMessage: string, message?: string) => log('INFO', agentOrMessage, message),
  warn: (agentOrMessage: string, message?: string) => log('WARN', agentOrMessage, message),
  error: (agentOrMessage: string, message?: string) => log('ERROR', agentOrMessage, message),
  debug: (agentOrMessage: string, message?: string) => log('DEBUG', agentOrMessage, message),
};
