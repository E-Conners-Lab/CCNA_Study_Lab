// ---------------------------------------------------------------------------
// Shared types for the IOS CLI simulator
// ---------------------------------------------------------------------------

export type IOSMode =
  | "user"
  | "privileged"
  | "global-config"
  | "interface"
  | "subinterface"
  | "interface-range"
  | "line"
  | "router"
  | "acl-standard"
  | "acl-extended"
  | "vlan"
  | "port-channel";

export interface IOSState {
  hostname: string;
  mode: IOSMode;
  /** e.g. "GigabitEthernet0/0", "vty 0 4", "ospf 1", "MY_ACL", "10" */
  modeContext: string;
  /** Full command history for the session */
  commandHistory: string[];
  /** Config commands entered (for validation) */
  configCommands: string[];
}

export interface TerminalLine {
  type: "input" | "output" | "system" | "guide";
  text: string;
}

export interface CommandResult {
  output: string[];
  newState: IOSState;
}

export interface ValidationResult {
  score: number;
  matched: string[];
  missing: string[];
  extra: string[];
  feedback: string;
}

export interface DeviceSection {
  deviceName: string;
  hostname: string;
  commands: string[];
}
