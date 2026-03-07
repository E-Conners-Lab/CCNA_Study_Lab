"""
ACL Builder Grader

Validates access control list statements against expected rules.
"""

import re
from typing import Dict, List


def normalize_acl_line(line: str) -> str:
    """Normalize an ACL line for comparison."""
    line = line.strip().lower()
    line = re.sub(r"\s+", " ", line)
    return line


def parse_acl_entries(code: str) -> List[str]:
    """Parse ACL entries from user input, ignoring comments and blanks."""
    entries = []
    for line in code.strip().split("\n"):
        line = line.strip()
        if not line or line.startswith("!") or line.startswith("#"):
            continue
        entries.append(normalize_acl_line(line))
    return entries


def grade_acl(code: str, expected: Dict) -> Dict:
    """
    Grade an ACL exercise.

    expected: {
        "entries": [
            "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80",
            "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 443",
            "access-list 100 deny ip any any"
        ],
        "ordered": true,
        "check_apply": {
            "interface": "GigabitEthernet0/0",
            "direction": "in"
        }
    }
    """
    expected_entries: List[str] = expected.get("entries", [])
    ordered = expected.get("ordered", True)
    check_apply = expected.get("check_apply")

    if not expected_entries:
        return {
            "passed": False,
            "output": "No expected ACL entries configured.",
            "errors": "Grading configuration error",
            "score": 0.0,
        }

    user_entries = parse_acl_entries(code)
    expected_normalized = [normalize_acl_line(e) for e in expected_entries]

    matched: List[int] = []
    unmatched: set[int] = set(range(len(expected_normalized)))
    total_checks = len(expected_normalized)

    if ordered:
        idx = 0
        for user_entry in user_entries:
            if idx < len(expected_normalized) and user_entry == expected_normalized[idx]:
                matched.append(idx)
                unmatched.discard(idx)
                idx += 1
    else:
        for user_entry in user_entries:
            for i in sorted(unmatched):
                if user_entry == expected_normalized[i]:
                    matched.append(i)
                    unmatched.discard(i)
                    break

    # Check if ACL is applied to the interface
    apply_correct = True
    if check_apply:
        total_checks += 1
        iface = check_apply.get("interface", "").lower()
        direction = check_apply.get("direction", "in").lower()
        apply_found = False
        for entry in user_entries:
            if f"ip access-group" in entry and direction in entry:
                apply_found = True
                break
        if apply_found:
            matched.append(-1)  # placeholder
        else:
            apply_correct = False

    score = len(matched) / total_checks if total_checks > 0 else 0.0
    passed = len(unmatched) == 0 and apply_correct

    missing = [expected_entries[i] for i in sorted(unmatched)]
    output_lines = [f"Matched {len(matched)}/{total_checks} checks."]
    if missing:
        output_lines.append(f"\nMissing ACL entries:")
        for m in missing:
            output_lines.append(f"  - {m}")
    if not apply_correct:
        output_lines.append(f"\nACL not applied to interface correctly.")
    if passed:
        output_lines = ["All ACL entries correct and properly applied!"]

    return {
        "passed": passed,
        "output": "\n".join(output_lines),
        "errors": "" if passed else "ACL entries incomplete or incorrect",
        "score": score,
    }
