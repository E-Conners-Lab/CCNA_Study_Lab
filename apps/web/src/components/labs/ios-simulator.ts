// ---------------------------------------------------------------------------
// Pure-function IOS CLI state machine
// ---------------------------------------------------------------------------

import type { IOSState, IOSMode, CommandResult } from "./ios-types";

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

export function createInitialState(hostname = "Router"): IOSState {
  return {
    hostname,
    mode: "user",
    modeContext: "",
    commandHistory: [],
    configCommands: [],
  };
}

// ---------------------------------------------------------------------------
// Prompt generation
// ---------------------------------------------------------------------------

const MODE_SUFFIXES: Record<IOSMode, (ctx: string) => string> = {
  user: () => ">",
  privileged: () => "#",
  "global-config": () => "(config)#",
  interface: (ctx) => `(config-if:${shortIf(ctx)})#`,
  subinterface: (ctx) => `(config-subif:${shortIf(ctx)})#`,
  "interface-range": (ctx) => `(config-if-range:${ctx})#`,
  line: (ctx) => `(config-line:${ctx})#`,
  router: (ctx) => `(config-router:${ctx})#`,
  "acl-standard": (ctx) => `(config-std-nacl:${ctx})#`,
  "acl-extended": (ctx) => `(config-ext-nacl:${ctx})#`,
  vlan: (ctx) => `(config-vlan:${ctx})#`,
  "port-channel": (ctx) => `(config-if:Po${ctx})#`,
};

/** Abbreviate interface names for the prompt */
function shortIf(name: string): string {
  return name
    .replace("GigabitEthernet", "Gi")
    .replace("FastEthernet", "Fa")
    .replace("Ethernet", "Et")
    .replace("Serial", "Se")
    .replace("Loopback", "Lo")
    .replace("Port-channel", "Po")
    .replace("Vlan", "Vl");
}

export function getPrompt(state: IOSState): string {
  const suffix = MODE_SUFFIXES[state.mode];
  return `${state.hostname}${suffix(state.modeContext)}`;
}

// ---------------------------------------------------------------------------
// IOS keyword expansion — maps abbreviations to full keywords
// ---------------------------------------------------------------------------

/**
 * IOS CLI allows any unambiguous prefix of a keyword. This table covers
 * every keyword used across all CCNA labs, keyed by minimum-unique prefix.
 * Context-sensitive words (enc, pass, nat, etc.) are handled separately.
 */
const KEYWORDS: string[] = [
  // Compound (hyphenated) keywords — checked first
  "access-class",
  "access-group",
  "access-list",
  "channel-group",
  "domain-name",
  "exec-timeout",
  "passive-interface",
  "password-encryption",
  "point-to-point",
  "router-id",
  // Single keywords
  "switchport",
  "encapsulation",
  "configure",
  "interfaces",
  "terminal",
  "interface",
  "transport",
  "encryption",
  "overload",
  "privilege",
  "protocols",
  "neighbors",
  "neighbor",
  "shutdown",
  "username",
  "hostname",
  "generate",
  "standard",
  "extended",
  "statistics",
  "summary",
  "modulus",
  "allowed",
  "address",
  "network",
  "console",
  "version",
  "service",
  "passive",
  "outside",
  "running-config",
  "inside",
  "permit",
  "source",
  "static",
  "router",
  "secret",
  "native",
  "active",
  "access",
  "enable",
  "crypto",
  "brief",
  "trunk",
  "login",
  "local",
  "input",
  "route",
  "show",
  "port-channel",
  "etherchannel",
  "mypubkey",
  "mode",
  "vlan",
  "deny",
  "name",
  "line",
  "area",
  "cost",
  "ospf",
  "lacp",
  "exit",
  "ssh",
  "rsa",
  "key",
  "end",
  "host",
  "icmp",
  "list",
  "log",
  "tcp",
  "udp",
  "nat",
  "ip",
  "no",
  "eq",
];

/**
 * Find the unique keyword that `abbrev` is a prefix of.
 * Returns the keyword if exactly one match, otherwise returns null.
 */
function matchKeyword(abbrev: string): string | null {
  const lower = abbrev.toLowerCase();
  // Already a full keyword?
  if (KEYWORDS.includes(lower)) return lower;
  // Must be at least 2 chars to expand
  if (lower.length < 2) return null;
  const matches = KEYWORDS.filter((kw) => kw.startsWith(lower));
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Context-sensitive expansion for ambiguous abbreviations.
 * `prev` is the already-expanded previous token(s) for disambiguation.
 * `hasMore` indicates if there are more tokens after this one.
 */
function expandTokenInContext(
  token: string,
  prev: string,
  prev2: string,
  hasMore: boolean,
): string {
  const t = token.toLowerCase();

  // Skip values: numbers, IPs, masks, VLAN lists, names with special chars
  if (/^[\d./:,\-!]+$/.test(token)) return token;
  // Preserve ACL/user names that look like values (contain mixed case, special chars)
  if (/[A-Z].*[a-z]|[a-z].*[A-Z]/.test(token) && token.length > 3) return token;

  // ---- Single-char and special short abbreviations ----

  // "en" → enable (most common 2-char IOS command)
  if (t === "en") {
    if (prev === "password" || prev === "service") return "encryption";
    return "enable";
  }

  // "t" after "configure"/"conf"/"config" → terminal
  if (t === "t" && (prev === "configure" || prev === "conf" || prev === "config")) return "terminal";

  // "con" / "cons" after "line" → console
  if ((t === "con" || t === "cons" || t === "conso") && prev === "line") return "console";

  // "ho" → hostname (not "host", since "host" is typed in full in ACLs)
  if (t === "ho" || t === "hostn") return "hostname";

  // ---- Context-sensitive disambiguation ----

  // "enc" after "trunk" or "switchport" → encapsulation; after "password" or "service" → encryption
  if (t === "enc" || t === "encr" || t === "encrypt") {
    if (prev === "password" || prev === "service" || prev2 === "service") return "encryption";
    return "encapsulation";
  }
  if (isPrefix(t, "encapsulation") && !isPrefix(t, "encryption")) return "encapsulation";
  if (isPrefix(t, "encryption") && !isPrefix(t, "encapsulation")) return "encryption";

  // "pass" → passive (channel-group context), password (line/service context), passive-interface (router context)
  if (t === "pass" || t === "passw") {
    if (prev === "service") return "password-encryption";
    if (prev === "mode" || prev2 === "channel-group") return "passive";
    // Default to password for line config context
    return "password";
  }
  if (isPrefix(t, "passive-interface") && t.includes("-")) return "passive-interface";
  if (isPrefix(t, "passive") && !isPrefix(t, "password")) {
    if (prev === "mode" || prev2 === "channel-group") return "passive";
    return "passive";
  }
  if (isPrefix(t, "password") && !isPrefix(t, "passive")) return "password";

  // "nat" stays "nat" when after "ip" (ip nat inside/outside); "native" after "trunk"
  if (t === "nat") {
    if (prev === "ip") return "nat";
    if (prev === "trunk") return "native";
    return "nat"; // default
  }
  if (isPrefix(t, "native") && t.length >= 4) return "native";

  // "sh" / "shut" → shutdown (in config); show is handled separately in privileged mode
  if (t === "sh" || t === "shut" || t === "shutd" || t === "shutdo") return "shutdown";

  // "mo" → mode (switchport/channel-group context) vs modulus (crypto context)
  if (t === "mo" || t === "mod") {
    if (prev === "switchport" || prev === "channel-group" || prev2 === "channel-group") return "mode";
    if (prev === "rsa" || prev === "generate" || prev2 === "crypto") return "modulus";
    return "mode"; // default — more common
  }

  // "acc" → access (switchport context) vs active (channel-group mode context)
  if (t === "acc" || t === "acce") {
    if (prev === "mode") return "access";
    return "access"; // default
  }
  if (t === "act" || t === "acti" || t === "activ") return "active";

  // "tr" / "tru" → trunk (switchport) vs transport (line config)
  if (t === "tr" || t === "tru" || t === "trun") {
    if (prev === "switchport" || prev === "mode") return "trunk";
    return "trunk"; // default — more common
  }
  if (isPrefix(t, "transport") && t.length >= 5) return "transport";
  if (isPrefix(t, "trunk") && t.length >= 3) return "trunk";

  // "all" → allowed (switchport trunk context)
  if (t === "all" || t === "allow") {
    if (prev === "trunk") return "allowed";
    return token; // keep as-is when ambiguous
  }

  // "log" → "login" when followed by more tokens (e.g. "log loc" → "login local")
  //       → "log" when it's the last token (ACL logging keyword)
  // "logi" → login
  if (t === "log") {
    return hasMore ? "login" : "log";
  }
  if (t === "logi") return "login";
  // "lo" → login (most common in config context; Loopback handled by normalizeInterface)
  if (t === "lo") {
    if (prev === "login") return "local";
    return "login";
  }
  // "loc" / "loca" → local
  if (t === "loc" || t === "loca") return "local";

  // "int" → interface (show context) vs inside/input in other contexts
  if (t === "int" || t === "inte" || t === "interf") {
    if (prev === "show" || prev === "ospf" || prev === "ip") return "interface";
    return "interface"; // default
  }
  if (t === "interfaces") return "interfaces";

  // "in" → input (transport context) vs inside (ip nat context) vs "in" (access-group/class direction)
  if (t === "in") {
    if (prev === "transport") return "input";
    if (prev === "nat" || prev === "ip") return "inside";
    return "in"; // direction keyword for access-group/access-class
  }
  if (t === "inp" || isPrefix(t, "input")) return "input";
  if (isPrefix(t, "inside") && t.length >= 3 && t !== "in" && t !== "int" && t !== "inte" && t !== "interf") return "inside";

  // "ro" → router (global config) vs route (ip route)
  if (t === "ro") {
    if (prev === "ip") return "route";
    return "router";
  }
  if (t === "rout" || t === "route") {
    if (prev === "ip") return "route";
    return "router";
  }

  // "ex" → exit (mode-independent) vs extended (acl context) vs exec-timeout
  if (t === "ex") return "exit";
  if (isPrefix(t, "extended") && t.length >= 3 && t !== "ex" && t !== "exi" && t !== "exit") return "extended";
  if (isPrefix(t, "exec-timeout") && t.length >= 5) return "exec-timeout";

  // "br" → brief (show context)
  if (t === "br" || t === "bri" || t === "brie") return "brief";

  // "run" → running-config (show context)
  if (t === "run" || t === "runn" || t === "runni" || isPrefix(t, "running")) {
    if (prev === "show") return "running-config";
    return token;
  }

  // "sum" → summary
  if (isPrefix(t, "summary") && t.length >= 3) return "summary";

  // "transl" → translations (unambiguous at 6 chars, vs "transport")
  if (isPrefix(t, "translations") && t.length >= 6) return "translations";

  // "neig" → neighbor/neighbors
  if (isPrefix(t, "neighbor") && t.length >= 4 && !isPrefix(t, "neighbors")) return "neighbor";
  if (isPrefix(t, "neighbors") && t.length >= 9) return "neighbors";

  // "proto" → protocols
  if (isPrefix(t, "protocols") && t.length >= 5) return "protocols";

  // "statis" → statistics (unambiguous at 6 chars)
  if (isPrefix(t, "statistics") && t.length >= 6) return "statistics";

  // "ver" → version
  if (t === "ver" || isPrefix(t, "version")) return "version";

  // "out" / "outs" → outside
  if (t === "out" || t === "outs" || isPrefix(t, "outside")) return "outside";

  // "stat" → static (ip nat/route context)
  if (isPrefix(t, "static") && t.length >= 4) return "static";

  // "sou" / "sourc" → source
  if (isPrefix(t, "source") && t.length >= 3) return "source";

  // "over" → overload
  if (isPrefix(t, "overload") && t.length >= 4) return "overload";

  // ---- Generic expansion: unambiguous prefixes ----
  const kw = matchKeyword(t);
  if (kw) return kw;

  return token;
}

function isPrefix(abbrev: string, full: string): boolean {
  return full.startsWith(abbrev) && abbrev.length <= full.length;
}

/**
 * Expand IOS command abbreviations in a full command string.
 * Handles both mode-transition commands and config commands.
 */
export function expandCommand(cmd: string): string {
  const tokens = cmd.trim().split(/\s+/);
  if (tokens.length === 0) return cmd;

  const expanded: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const prev = i > 0 ? expanded[i - 1] : "";
    const prev2 = i > 1 ? expanded[i - 2] : "";
    expanded.push(expandTokenInContext(token, prev, prev2, i < tokens.length - 1));
  }

  return expanded.join(" ");
}

// ---------------------------------------------------------------------------
// Command processing
// ---------------------------------------------------------------------------

export function processCommand(
  rawCmd: string,
  state: IOSState,
  expectedOutput?: string,
): CommandResult {
  const cmd = rawCmd.trim();
  if (!cmd) return { output: [], newState: state };

  // Expand abbreviations for mode detection
  const expanded = expandCommand(cmd);
  const lower = expanded.toLowerCase();

  const newState: IOSState = {
    ...state,
    commandHistory: [...state.commandHistory, cmd],
  };

  // ---- Mode-independent commands ----

  // `end` → back to privileged from any config mode
  if (lower === "end" && isConfigMode(state.mode)) {
    return {
      output: [],
      newState: { ...newState, mode: "privileged", modeContext: "" },
    };
  }

  // `exit` → go up one level
  if (lower === "exit") {
    return { output: [], newState: handleExit(newState) };
  }

  // `do <cmd>` from config mode → run as privileged
  if (lower.startsWith("do ") && isConfigMode(state.mode)) {
    const doCmd = cmd.slice(3).trim();
    const result = processPrivilegedMode(doCmd, doCmd.toLowerCase(), newState, expectedOutput);
    // Stay in current config mode (don't change mode from the do command)
    return { output: result.output, newState: { ...newState } };
  }

  // `show` commands from config mode → auto-route through privileged mode
  // Real IOS allows show commands in config mode (implicit `do`)
  if ((lower.startsWith("show ") || lower === "show") && isConfigMode(state.mode)) {
    const result = processPrivilegedMode(cmd, lower, newState, expectedOutput);
    // Stay in current config mode
    return { output: result.output, newState: { ...newState } };
  }

  // ---- Per-mode processing ----
  switch (state.mode) {
    case "user":
      return processUserMode(cmd, lower, newState);
    case "privileged":
      return processPrivilegedMode(cmd, lower, newState, expectedOutput);
    case "global-config":
      return processGlobalConfig(cmd, lower, newState, expanded);
    default:
      // Sub-config modes: record config commands and handle nested transitions
      return processSubConfig(cmd, lower, newState, expanded);
  }
}

// ---------------------------------------------------------------------------
// User EXEC mode
// ---------------------------------------------------------------------------

function processUserMode(
  cmd: string,
  lower: string,
  state: IOSState,
): CommandResult {
  if (lower === "enable" || lower === "en") {
    return {
      output: [],
      newState: { ...state, mode: "privileged", modeContext: "" },
    };
  }
  if (lower.startsWith("show ") || lower === "show") {
    return {
      output: ["% Type \"enable\" to access privileged commands"],
      newState: state,
    };
  }
  return {
    output: [`% Unknown command or action '${cmd}'`],
    newState: state,
  };
}

// ---------------------------------------------------------------------------
// Privileged EXEC mode
// ---------------------------------------------------------------------------

function processPrivilegedMode(
  cmd: string,
  lower: string,
  state: IOSState,
  expectedOutput?: string,
): CommandResult {
  // Enter global config
  if (
    lower === "configure terminal" ||
    lower === "conf t" ||
    lower === "config t" ||
    lower === "configure t" ||
    lower === "config terminal" ||
    lower === "conf terminal"
  ) {
    return {
      output: ["Enter configuration commands, one per line.  End with CNTL/Z."],
      newState: { ...state, mode: "global-config", modeContext: "" },
    };
  }

  // Show commands → look up in expectedOutput
  // Check both expanded `lower` and raw `cmd` since expandCommand maps "sh" → "shutdown"
  const rawLower = cmd.toLowerCase();
  if (lower.startsWith("show ") || rawLower.startsWith("sh ") || rawLower.startsWith("show ")) {
    const lines = lookupShowOutput(cmd, expectedOutput, state.hostname);
    return { output: lines, newState: state };
  }

  if (lower === "disable" || lower === "disa") {
    return { output: [], newState: { ...state, mode: "user", modeContext: "" } };
  }

  // Debug commands
  if (lower.startsWith("debug ")) {
    const feature = cmd.slice("debug ".length).trim();
    return {
      output: [`${feature} debugging is on`],
      newState: state,
    };
  }

  if (lower.startsWith("no debug ") || lower === "undebug all" || lower === "u all") {
    return {
      output: ["All possible debugging has been turned off"],
      newState: state,
    };
  }

  if (lower.startsWith("copy ") || lower === "write" || lower === "wr") {
    return {
      output: ["[OK]"],
      newState: state,
    };
  }

  if (lower.startsWith("ping ")) {
    return {
      output: [
        "Type escape sequence to abort.",
        "Sending 5, 100-byte ICMP Echos, timeout is 2 seconds:",
        "!!!!!",
        "Success rate is 100 percent (5/5)",
      ],
      newState: state,
    };
  }

  if (lower.startsWith("traceroute ") || lower.startsWith("trace ")) {
    return {
      output: [
        "Type escape sequence to abort.",
        "Tracing the route to " + cmd.split(/\s+/)[1],
        "  1  * * *",
      ],
      newState: state,
    };
  }

  // "terminal" commands like "terminal length 0"
  if (lower.startsWith("terminal ") || lower.startsWith("term ")) {
    return { output: [], newState: state };
  }

  return {
    output: [`% Unknown command '${cmd}'`],
    newState: state,
  };
}

// ---------------------------------------------------------------------------
// Global configuration mode
// ---------------------------------------------------------------------------

function processGlobalConfig(
  cmd: string,
  lower: string,
  state: IOSState,
  expanded: string,
): CommandResult {
  const withConfig = addConfigCmd(state, cmd);
  const eLower = expanded.toLowerCase();

  // hostname
  if (eLower.startsWith("hostname ")) {
    const newHostname = expanded.slice("hostname ".length).trim();
    return {
      output: [],
      newState: { ...withConfig, hostname: newHostname },
    };
  }

  // interface range (must come before generic interface match)
  if (eLower.startsWith("interface range ")) {
    const range = expanded.slice("interface range ".length).trim();
    return {
      output: [],
      newState: { ...withConfig, mode: "interface-range", modeContext: range },
    };
  }

  // interface (with subinterface detection)
  const ifMatch = eLower.match(/^interface\s+(.+)/);
  if (ifMatch) {
    const ifName = normalizeInterface(ifMatch[1].trim());
    // Subinterface: contains a dot (e.g. GigabitEthernet0/0.10)
    if (ifName.includes(".")) {
      return {
        output: [],
        newState: { ...withConfig, mode: "subinterface", modeContext: ifName },
      };
    }
    // Port-channel (check normalized name, not raw input)
    if (ifName.toLowerCase().includes("port-channel")) {
      const num = ifName.replace(/\D/g, "");
      return {
        output: [],
        newState: { ...withConfig, mode: "port-channel", modeContext: num },
      };
    }
    return {
      output: [],
      newState: { ...withConfig, mode: "interface", modeContext: ifName },
    };
  }

  // line vty / console / aux
  const lineMatch = eLower.match(/^line\s+(vty|console|aux)\s*(.*)/);
  if (lineMatch) {
    const lineType = lineMatch[1];
    const lineArgs = lineMatch[2]?.trim() ?? "";
    const ctx = lineArgs ? `${lineType} ${lineArgs}` : lineType;
    return {
      output: [],
      newState: { ...withConfig, mode: "line", modeContext: ctx },
    };
  }

  // router ospf / eigrp / rip / bgp
  const routerMatch = eLower.match(/^router\s+(\w+)\s*(.*)/);
  if (routerMatch) {
    const proto = routerMatch[1];
    const args = routerMatch[2]?.trim() ?? "";
    const ctx = args ? `${proto} ${args}` : proto;
    return {
      output: [],
      newState: { ...withConfig, mode: "router", modeContext: ctx },
    };
  }

  // ip access-list standard / extended
  const aclMatch = eLower.match(
    /^ip\s+access-list\s+(standard|extended)\s+(.+)/,
  );
  if (aclMatch) {
    const aclType = aclMatch[1] as "standard" | "extended";
    const aclName = aclMatch[2].trim();
    const mode = aclType === "standard" ? "acl-standard" : "acl-extended";
    return {
      output: [],
      newState: { ...withConfig, mode, modeContext: aclName },
    };
  }

  // vlan N
  const vlanMatch = eLower.match(/^vlan\s+(\d+)/);
  if (vlanMatch) {
    return {
      output: [],
      newState: { ...withConfig, mode: "vlan", modeContext: vlanMatch[1] },
    };
  }

  // crypto key generate rsa
  if (eLower.includes("crypto key generate rsa") || lower.includes("crypto key generate rsa")) {
    const modMatch = cmd.match(/modulus\s+(\d+)/i) ?? expanded.match(/modulus\s+(\d+)/i);
    const bits = modMatch ? modMatch[1] : "2048";
    return {
      output: [
        `The name for the keys will be: ${state.hostname}.ccnastudy.lab`,
        "",
        `% Generating ${bits} bit RSA keys, keys will be non-exportable...`,
        `% Key pair was successfully generated.`,
      ],
      newState: withConfig,
    };
  }

  // Everything else in global config: accept silently (realistic IOS behavior)
  return { output: [], newState: withConfig };
}

// ---------------------------------------------------------------------------
// Sub-configuration modes (interface, line, router, acl, vlan, etc.)
// ---------------------------------------------------------------------------

function processSubConfig(
  cmd: string,
  lower: string,
  state: IOSState,
  expanded: string,
): CommandResult {
  const withConfig = addConfigCmd(state, cmd);
  const eLower = expanded.toLowerCase();

  // interface range (must come before generic interface match)
  if (eLower.startsWith("interface range ")) {
    const range = expanded.slice("interface range ".length).trim();
    return {
      output: [],
      newState: { ...withConfig, mode: "interface-range", modeContext: range },
    };
  }

  // Allow nested interface transitions from config sub-modes
  const ifMatch = eLower.match(/^interface\s+(.+)/);
  if (ifMatch) {
    const ifName = normalizeInterface(ifMatch[1].trim());
    if (ifName.includes(".")) {
      return {
        output: [],
        newState: { ...withConfig, mode: "subinterface", modeContext: ifName },
      };
    }
    if (ifName.toLowerCase().includes("port-channel")) {
      const num = ifName.replace(/\D/g, "");
      return {
        output: [],
        newState: { ...withConfig, mode: "port-channel", modeContext: num },
      };
    }
    return {
      output: [],
      newState: { ...withConfig, mode: "interface", modeContext: ifName },
    };
  }

  // Allow `router ospf N` etc. from sub-config
  const routerMatch = eLower.match(/^router\s+(\w+)\s*(.*)/);
  if (routerMatch) {
    const proto = routerMatch[1];
    const args = routerMatch[2]?.trim() ?? "";
    const ctx = args ? `${proto} ${args}` : proto;
    return {
      output: [],
      newState: { ...withConfig, mode: "router", modeContext: ctx },
    };
  }

  // Allow line transitions from sub-config
  const lineMatch = eLower.match(/^line\s+(vty|console|aux)\s*(.*)/);
  if (lineMatch) {
    const lineType = lineMatch[1];
    const lineArgs = lineMatch[2]?.trim() ?? "";
    const ctx = lineArgs ? `${lineType} ${lineArgs}` : lineType;
    return {
      output: [],
      newState: { ...withConfig, mode: "line", modeContext: ctx },
    };
  }

  // Allow vlan transitions from sub-config
  const vlanMatch = eLower.match(/^vlan\s+(\d+)/);
  if (vlanMatch) {
    return {
      output: [],
      newState: { ...withConfig, mode: "vlan", modeContext: vlanMatch[1] },
    };
  }

  // ip access-list from sub-config
  const aclMatch = eLower.match(
    /^ip\s+access-list\s+(standard|extended)\s+(.+)/,
  );
  if (aclMatch) {
    const aclType = aclMatch[1] as "standard" | "extended";
    const aclName = aclMatch[2].trim();
    const mode = aclType === "standard" ? "acl-standard" : "acl-extended";
    return {
      output: [],
      newState: { ...withConfig, mode, modeContext: aclName },
    };
  }

  // Hostname changes work from any config sub-mode
  if (eLower.startsWith("hostname ")) {
    const newHostname = expanded.slice("hostname ".length).trim();
    return {
      output: [],
      newState: { ...withConfig, hostname: newHostname },
    };
  }

  // Accept everything else silently
  return { output: [], newState: withConfig };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isConfigMode(mode: IOSMode): boolean {
  return mode !== "user" && mode !== "privileged";
}

function handleExit(state: IOSState): IOSState {
  switch (state.mode) {
    case "user":
      return state;
    case "privileged":
      return { ...state, mode: "user", modeContext: "" };
    case "global-config":
      return { ...state, mode: "privileged", modeContext: "" };
    default:
      // All sub-config modes exit to global-config
      return { ...state, mode: "global-config", modeContext: "" };
  }
}

function addConfigCmd(state: IOSState, cmd: string): IOSState {
  return {
    ...state,
    configCommands: [...state.configCommands, cmd],
  };
}

/** Normalize short interface names to long form */
export function normalizeInterface(name: string): string {
  return name
    .replace(/^Gi(?:gabitEthernet)?(?=\d)/i, "GigabitEthernet")
    .replace(/^Gig(?=\d)/i, "GigabitEthernet")
    .replace(/^Fa(?:stEthernet)?(?=\d)/i, "FastEthernet")
    .replace(/^Et(?:hernet)?(?=\d)/i, "Ethernet")
    .replace(/^Se(?:rial)?(?=\d)/i, "Serial")
    .replace(/^Lo(?:opback)?(?=\d)/i, "Loopback")
    .replace(/^Po(?:rt-channel)?(?=\d)/i, "Port-channel")
    .replace(/^Vl(?:an)?(?=\d)/i, "Vlan");
}

/**
 * Check if abbreviated user command matches a full show command from expectedOutput.
 * Each token in the user command must be a prefix of the corresponding token in the
 * full command (standard IOS abbreviation rules). Extra tokens in the full command
 * are allowed (user can omit trailing tokens).
 */
function showCmdMatches(userCmd: string, fullCmd: string): boolean {
  const userTokens = userCmd.toLowerCase().split(/\s+/);
  const fullTokens = fullCmd.toLowerCase().split(/\s+/);

  // Token counts must match — "show ip route" should not match "show ip route static"
  if (userTokens.length !== fullTokens.length) return false;

  for (let i = 0; i < userTokens.length; i++) {
    const u = userTokens[i];
    const f = fullTokens[i];
    // Exact match, or user token is a prefix of full token (IOS abbreviation)
    if (f === u || f.startsWith(u)) continue;
    // Normalize interface names (e.g., "Gi0/0" vs "GigabitEthernet0/0")
    if (normalizeInterface(u) === normalizeInterface(f)) continue;
    return false;
  }

  return true;
}

/** Look up show command output from the expectedOutput blob */
function lookupShowOutput(
  cmd: string,
  expectedOutput?: string,
  hostname?: string,
): string[] {
  if (!expectedOutput) {
    return [`% Simulation: output not available for '${cmd}'`];
  }

  // Normalize "sh" → "show" prefix
  let normalized = cmd.trim();
  if (/^sh\s/i.test(normalized)) {
    normalized = "show" + normalized.slice(2);
  }

  const lines = expectedOutput.split("\n");
  const results: string[] = [];
  let capturing = false;

  for (const line of lines) {
    const promptMatch = line.match(/^(\S+[#>])(.+)/);
    if (promptMatch) {
      const promptHost = promptMatch[1].replace(/[#>]$/, "");
      const promptCmd = promptMatch[2].trim();

      // If hostname is provided, only match commands from the same device
      if (hostname && promptHost.toLowerCase() !== hostname.toLowerCase()) {
        if (capturing) break;
        continue;
      }

      if (showCmdMatches(normalized, promptCmd)) {
        capturing = true;
        results.push(line);
        continue;
      } else if (capturing) {
        break;
      }
    }

    if (capturing) {
      results.push(line);
    }
  }

  if (results.length > 0) return results;
  return [`% Simulation: no output available for '${cmd}'`];
}
