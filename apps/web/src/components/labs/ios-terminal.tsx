"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import type { IOSState, TerminalLine } from "./ios-types";
import {
  createInitialState,
  getPrompt,
  processCommand,
} from "./ios-simulator";
import { parseSections } from "./ios-validator";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IOSTerminalProps {
  starterCode?: string;
  expectedOutput?: string;
  /** Called whenever the user's config commands change */
  onCommandsChange?: (commands: string[]) => void;
  /** External signal to reset the terminal */
  resetKey?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IOSTerminal({
  starterCode,
  expectedOutput,
  onCommandsChange,
  resetKey = 0,
}: IOSTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [iosState, setIosState] = useState<IOSState>(createInitialState());
  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [deviceSections, setDeviceSections] = useState<
    { deviceName: string; hostname: string }[]
  >([]);
  const [currentDevice, setCurrentDevice] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const allCommandsRef = useRef<string[][]>([]);

  // ---- Initialize / Reset ----
  useEffect(() => {
    const sections = starterCode ? parseSections(starterCode) : [];
    const hasMultiDevice = sections.length > 1;

    const initLines: TerminalLine[] = [];

    // Show starter code comments as guide text
    if (starterCode) {
      const guideLines = starterCode
        .split("\n")
        .filter((l) => l.trim().startsWith("!") && !l.trim().match(/^!\s*=+/))
        .map((l) => l.trim().replace(/^!\s*/, ""));

      if (guideLines.length > 0) {
        initLines.push({
          type: "system",
          text: "--- Lab Guide ---",
        });
        for (const gl of guideLines) {
          if (gl) initLines.push({ type: "guide", text: `  ${gl}` });
        }
        initLines.push({ type: "system", text: "--- Begin Configuration ---" });
        initLines.push({ type: "output", text: "" });
      }
    }

    let initialHostname = "Router";
    if (hasMultiDevice) {
      const devs = sections.map((s) => ({
        deviceName: s.deviceName,
        hostname: s.hostname,
      }));
      setDeviceSections(devs);
      setCurrentDevice(0);
      allCommandsRef.current = devs.map(() => []);
      initialHostname = devs[0].hostname;

      initLines.push({
        type: "system",
        text: `Connected to ${devs[0].deviceName}`,
      });
    } else {
      // Use hostname from single named section if available
      if (sections.length === 1 && sections[0].hostname !== "Router") {
        initialHostname = sections[0].hostname;
      }
      setDeviceSections([]);
      setCurrentDevice(0);
      allCommandsRef.current = [[]];
    }

    setLines(initLines);
    setIosState(createInitialState(initialHostname));
    setInput("");
    setHistoryIndex(-1);
    onCommandsChange?.([]);
  }, [starterCode, resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Auto-scroll ----
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // ---- Submit command ----
  const handleSubmit = useCallback(() => {
    const cmd = input.trim();
    const prompt = getPrompt(iosState);

    // Always show the input line
    const newLines: TerminalLine[] = [
      ...lines,
      { type: "input", text: `${prompt}${cmd}` },
    ];

    if (!cmd) {
      setLines(newLines);
      setInput("");
      return;
    }

    const result = processCommand(cmd, iosState, expectedOutput);

    // Add output lines
    for (const ol of result.output) {
      newLines.push({ type: "output", text: ol });
    }

    // Track config commands for the current device
    const newConfigCmds = result.newState.configCommands;
    allCommandsRef.current[currentDevice] = newConfigCmds;

    // Notify parent of all commands across all devices
    const flat = allCommandsRef.current.flat();
    onCommandsChange?.(flat);

    setLines(newLines);
    setIosState(result.newState);
    setInput("");
    setHistoryIndex(-1);
  }, [input, iosState, lines, expectedOutput, onCommandsChange, currentDevice]);

  // ---- Switch device (multi-device labs) ----
  const switchDevice = useCallback(
    (targetIdx: number) => {
      if (
        deviceSections.length <= 1 ||
        targetIdx === currentDevice ||
        targetIdx < 0 ||
        targetIdx >= deviceSections.length
      )
        return;

      const dev = deviceSections[targetIdx];
      const newLines: TerminalLine[] = [
        ...lines,
        { type: "output", text: "" },
        {
          type: "system",
          text: `--- Disconnected from ${deviceSections[currentDevice].deviceName} ---`,
        },
        {
          type: "system",
          text: `--- Connected to ${dev.deviceName} ---`,
        },
        { type: "output", text: "" },
      ];

      setCurrentDevice(targetIdx);
      setLines(newLines);
      // Create fresh state for the new device with saved commands replayed
      const freshState = createInitialState(dev.hostname);
      // Restore config commands from previous work on this device
      const savedCmds = allCommandsRef.current[targetIdx] ?? [];
      setIosState({
        ...freshState,
        configCommands: savedCmds,
      });
      setInput("");
      setHistoryIndex(-1);
    },
    [deviceSections, currentDevice, lines],
  );

  // ---- Key handling ----
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
        return;
      }

      // Command history navigation
      const history = iosState.commandHistory;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length === 0) return;
        const newIdx =
          historyIndex === -1
            ? history.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIdx);
        setInput(history[newIdx]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex === -1) return;
        const newIdx = historyIndex + 1;
        if (newIdx >= history.length) {
          setHistoryIndex(-1);
          setInput("");
        } else {
          setHistoryIndex(newIdx);
          setInput(history[newIdx]);
        }
      }
    },
    [handleSubmit, iosState.commandHistory, historyIndex],
  );

  // ---- Focus input when clicking anywhere in terminal ----
  const handleTerminalClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const prompt = getPrompt(iosState);

  return (
    <div
      className="flex flex-col h-full bg-black font-mono text-sm select-text"
      onClick={handleTerminalClick}
    >
      {/* Device switcher for multi-device labs */}
      {deviceSections.length > 1 && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Device:
          </span>
          {deviceSections.map((dev, idx) => (
            <button
              key={dev.deviceName}
              onClick={(e) => {
                e.stopPropagation();
                switchDevice(idx);
              }}
              className={`text-[11px] px-2 py-0.5 rounded ${
                idx === currentDevice
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700"
              }`}
            >
              {dev.hostname}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable output */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 min-h-0">
        {lines.map((line, i) => (
          <div key={i} className="leading-5 whitespace-pre-wrap break-all">
            {line.type === "input" && (
              <span className="text-green-400">{line.text}</span>
            )}
            {line.type === "output" && (
              <span className="text-zinc-300">{line.text}</span>
            )}
            {line.type === "system" && (
              <span className="text-cyan-400 text-xs">{line.text}</span>
            )}
            {line.type === "guide" && (
              <span className="text-zinc-600 text-xs italic">{line.text}</span>
            )}
          </div>
        ))}

        {/* Input line */}
        <div className="flex items-center leading-5">
          <span className="text-green-400 whitespace-pre">{prompt}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-green-300 outline-none caret-green-400 font-mono text-sm"
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
