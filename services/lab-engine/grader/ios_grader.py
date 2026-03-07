"""
IOS CLI Command Grader

Validates user-entered IOS commands against expected command sequences.
Handles variations in whitespace, abbreviations, and command ordering.
"""

import re
from typing import Dict, List


# Common IOS command abbreviations
ABBREVIATIONS = {
    "int": "interface",
    "fa": "fastethernet",
    "gi": "gigabitethernet",
    "no": "no",
    "conf": "configure",
    "t": "terminal",
    "en": "enable",
    "ex": "exit",
    "sh": "show",
    "ip": "ip",
    "sw": "switchport",
}


def normalize_command(cmd: str) -> str:
    """Normalize an IOS command for comparison."""
    cmd = cmd.strip().lower()
    cmd = re.sub(r"\s+", " ", cmd)
    # Remove trailing ! or # prompts
    cmd = re.sub(r"^[a-zA-Z0-9_\-]+[#>]\s*", "", cmd)
    return cmd


def commands_match(user_cmd: str, expected_cmd: str) -> bool:
    """Check if a user command matches an expected command (with abbreviation support)."""
    u = normalize_command(user_cmd)
    e = normalize_command(expected_cmd)

    if u == e:
        return True

    # Check if user used abbreviations
    u_parts = u.split()
    e_parts = e.split()

    if len(u_parts) != len(e_parts):
        return False

    for up, ep in zip(u_parts, e_parts):
        if up == ep:
            continue
        if ep.startswith(up) and len(up) >= 2:
            continue
        return False

    return True


def grade_ios_commands(code: str, expected: Dict) -> Dict:
    """
    Grade IOS CLI commands.

    expected: {
        "commands": ["enable", "configure terminal", "interface gi0/0", ...],
        "ordered": true/false
    }
    """
    expected_commands: List[str] = expected.get("commands", [])
    ordered = expected.get("ordered", True)

    if not expected_commands:
        return {
            "passed": False,
            "output": "No expected commands configured for this exercise.",
            "errors": "Grading configuration error",
            "score": 0.0,
        }

    user_lines = [l.strip() for l in code.strip().split("\n") if l.strip() and not l.strip().startswith("!")]

    matched: List[int] = []
    unmatched: set[int] = set(range(len(expected_commands)))

    if ordered:
        idx = 0
        for user_line in user_lines:
            if idx < len(expected_commands) and commands_match(user_line, expected_commands[idx]):
                matched.append(idx)
                unmatched.discard(idx)
                idx += 1
    else:
        for user_line in user_lines:
            for i in sorted(unmatched):
                if commands_match(user_line, expected_commands[i]):
                    matched.append(i)
                    unmatched.discard(i)
                    break

    score = len(matched) / len(expected_commands) if expected_commands else 0.0
    passed = len(unmatched) == 0

    missing = [expected_commands[i] for i in sorted(unmatched)]
    output_lines = [f"Matched {len(matched)}/{len(expected_commands)} commands."]
    if missing:
        output_lines.append(f"Missing commands: {', '.join(missing)}")

    return {
        "passed": passed,
        "output": "\n".join(output_lines),
        "errors": "" if passed else f"{len(missing)} command(s) missing or incorrect",
        "score": score,
    }
