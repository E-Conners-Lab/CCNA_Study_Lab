"""
Configuration Review Grader

Validates device configuration by comparing against expected configuration lines.
Used for "fix the broken config" style exercises.
"""

import re
from typing import Dict, List


def normalize_config_line(line: str) -> str:
    """Normalize a configuration line for comparison."""
    line = line.strip()
    line = re.sub(r"\s+", " ", line)
    return line.lower()


def grade_config_review(code: str, expected: Dict) -> Dict:
    """
    Grade a config review exercise.

    expected: {
        "required_lines": ["hostname R1", "ip routing", ...],
        "forbidden_lines": ["no ip routing", ...],
        "required_sections": {
            "interface GigabitEthernet0/0": [
                "ip address 192.168.1.1 255.255.255.0",
                "no shutdown"
            ]
        }
    }
    """
    required_lines: List[str] = expected.get("required_lines", [])
    forbidden_lines: List[str] = expected.get("forbidden_lines", [])
    required_sections: Dict[str, List[str]] = expected.get("required_sections", {})

    user_lines = [l.strip() for l in code.strip().split("\n") if l.strip()]
    user_normalized = [normalize_config_line(l) for l in user_lines]

    issues = []
    checks = 0
    passed_checks = 0

    # Check required lines
    for req in required_lines:
        checks += 1
        if normalize_config_line(req) in user_normalized:
            passed_checks += 1
        else:
            issues.append(f"Missing required line: {req}")

    # Check forbidden lines
    for forbidden in forbidden_lines:
        checks += 1
        if normalize_config_line(forbidden) not in user_normalized:
            passed_checks += 1
        else:
            issues.append(f"Config contains forbidden line: {forbidden}")

    # Check required sections
    for section_header, section_lines in required_sections.items():
        section_norm = normalize_config_line(section_header)
        # Find the section in user config
        try:
            section_start = next(
                i for i, uline in enumerate(user_normalized) if uline == section_norm
            )
        except StopIteration:
            checks += 1
            issues.append(f"Missing section: {section_header}")
            continue

        # Check lines within the section (until next section or end)
        section_end = len(user_normalized)
        for i in range(section_start + 1, len(user_normalized)):
            if not user_normalized[i].startswith(" ") and user_normalized[i] != "!":
                section_end = i
                break

        section_content = user_normalized[section_start:section_end]
        for sline in section_lines:
            checks += 1
            if normalize_config_line(sline) in section_content:
                passed_checks += 1
            else:
                issues.append(f"Missing in {section_header}: {sline}")

    total = max(checks, 1)
    score = passed_checks / total
    passed = len(issues) == 0

    output_lines = [f"Configuration check: {passed_checks}/{total} passed"]
    if issues:
        output_lines.append("\nIssues found:")
        for issue in issues:
            output_lines.append(f"  - {issue}")
    else:
        output_lines.append("All configuration checks passed!")

    return {
        "passed": passed,
        "output": "\n".join(output_lines),
        "errors": "" if passed else f"{len(issues)} issue(s) found",
        "score": score,
    }
