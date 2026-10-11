/** What figma-flow remembers for the session. */
export type Flow = {
  /** A Figma tool has been called, so edits from here on are design work. */
  isActive: boolean
  /** Source files edited since the measurement last passed. */
  unmeasured: string[]
  /** How the last measurement run ended. */
  lastMeasure: 'none' | 'passed' | 'failed'
  /** The person released the hold with `/figma-flow release`. */
  isReleased: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'figma-flow': { flow: Flow }
  }
}
