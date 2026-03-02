export { IOSTerminal } from "./ios-terminal";
export { createInitialState, getPrompt, processCommand, expandCommand } from "./ios-simulator";
export { validateCommands, parseSections } from "./ios-validator";
export type {
  IOSMode,
  IOSState,
  TerminalLine,
  CommandResult,
  ValidationResult,
  DeviceSection,
} from "./ios-types";
