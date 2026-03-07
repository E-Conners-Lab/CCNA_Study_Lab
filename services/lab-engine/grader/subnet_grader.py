"""
Subnetting Grader

Validates subnetting answers (network address, broadcast, hosts, masks).
"""

from typing import Dict


def grade_subnetting(code: str, expected: Dict) -> Dict:
    """
    Grade subnetting exercise answers.

    The user's code is treated as a set of key=value answers, one per line.
    Example user input:
        network=192.168.1.0
        broadcast=192.168.1.255
        first_host=192.168.1.1
        last_host=192.168.1.254
        hosts=254
        subnet_mask=255.255.255.0

    expected: {
        "answers": {
            "network": "192.168.1.0",
            "broadcast": "192.168.1.255",
            "first_host": "192.168.1.1",
            "last_host": "192.168.1.254",
            "hosts": "254",
            "subnet_mask": "255.255.255.0"
        }
    }
    """
    expected_answers: Dict[str, str] = expected.get("answers", {})

    if not expected_answers:
        return {
            "passed": False,
            "output": "No expected answers configured for this exercise.",
            "errors": "Grading configuration error",
            "score": 0.0,
        }

    # Parse user answers
    user_answers = {}
    for line in code.strip().split("\n"):
        line = line.strip()
        if "=" in line:
            key, _, value = line.partition("=")
            user_answers[key.strip().lower().replace(" ", "_")] = value.strip()

    correct = 0
    total = len(expected_answers)
    results = []

    for key, expected_val in expected_answers.items():
        user_val = user_answers.get(key.lower(), "")
        if user_val.lower() == expected_val.lower():
            correct += 1
            results.append(f"  {key}: {user_val} [CORRECT]")
        else:
            results.append(f"  {key}: {user_val or '(not provided)'} [INCORRECT - expected {expected_val}]")

    score = correct / total if total > 0 else 0.0
    passed = correct == total

    output = f"Score: {correct}/{total}\n" + "\n".join(results)

    return {
        "passed": passed,
        "output": output,
        "errors": "" if passed else f"{total - correct} answer(s) incorrect",
        "score": score,
    }
