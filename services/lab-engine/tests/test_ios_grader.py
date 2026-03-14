"""Tests for IOS CLI Command Grader."""

import pytest

from grader.ios_grader import commands_match, grade_ios_commands, normalize_command


class TestNormalizeCommand:
    """Tests for the normalize_command helper."""

    def test_strips_whitespace(self):
        assert normalize_command("  show ip route  ") == "show ip route"

    def test_collapses_internal_whitespace(self):
        assert normalize_command("show   ip    route") == "show ip route"

    def test_lowercases(self):
        assert normalize_command("Show IP Route") == "show ip route"

    def test_strips_router_hash_prompt(self):
        assert normalize_command("Router#show ip route") == "show ip route"

    def test_strips_router_angle_prompt(self):
        assert normalize_command("Router>enable") == "enable"

    def test_strips_custom_hostname_prompt(self):
        assert normalize_command("R1-Core#show running-config") == "show running-config"

    def test_empty_string(self):
        assert normalize_command("") == ""

    def test_only_whitespace(self):
        assert normalize_command("   ") == ""


class TestCommandsMatch:
    """Tests for the commands_match helper."""

    def test_exact_match(self):
        assert commands_match("show ip route", "show ip route") is True

    def test_case_insensitive_match(self):
        assert commands_match("Show IP Route", "show ip route") is True

    def test_abbreviation_int_for_interface(self):
        assert commands_match("int gi0/0", "interface gi0/0") is True

    def test_abbreviation_prefix_match_on_word(self):
        # "gi0/0" is a single token and is NOT a prefix of "gigabitethernet0/0"
        # because of the trailing "0/0". The abbreviation logic works on
        # space-separated parts, so "gi" must be its own word.
        assert commands_match(
            "interface gi0/0", "interface gigabitethernet0/0"
        ) is False

    def test_abbreviation_works_on_whole_words(self):
        # Abbreviation prefix matching works when the abbreviated word
        # is a standalone part that is a prefix of the expected part.
        assert commands_match("conf terminal", "configure terminal") is True

    def test_abbreviation_sh_for_show(self):
        assert commands_match("sh ip route", "show ip route") is True

    def test_abbreviation_conf_for_configure(self):
        assert commands_match("conf terminal", "configure terminal") is True

    def test_no_match_different_commands(self):
        assert commands_match("show ip route", "show ip interface") is False

    def test_no_match_different_length(self):
        assert commands_match("show ip", "show ip route") is False

    def test_abbreviation_too_short_rejected(self):
        # Single-char abbreviation (< 2 chars) should not match via prefix
        assert commands_match("s ip route", "show ip route") is False

    def test_whitespace_in_commands_still_match(self):
        assert commands_match("  show   ip   route  ", "show ip route") is True

    def test_prompt_stripped_before_match(self):
        assert commands_match("Router#show ip route", "show ip route") is True


class TestGradeIosCommands:
    """Tests for the grade_ios_commands function."""

    def test_perfect_match_ordered(self):
        code = "enable\nconfigure terminal\ninterface gi0/0\nno shutdown\nexit"
        expected = {
            "commands": [
                "enable",
                "configure terminal",
                "interface gi0/0",
                "no shutdown",
                "exit",
            ],
            "ordered": True,
        }
        result = grade_ios_commands(code, expected)
        assert result["passed"] is True
        assert result["score"] == 1.0
        assert result["errors"] == ""

    def test_partial_match_ordered(self):
        code = "enable\ninterface gi0/0\nexit"
        expected = {
            "commands": [
                "enable",
                "configure terminal",
                "interface gi0/0",
                "no shutdown",
                "exit",
            ],
            "ordered": True,
        }
        result = grade_ios_commands(code, expected)
        assert result["passed"] is False
        assert 0.0 < result["score"] < 1.0
        assert result["errors"] != ""

    def test_abbreviations_match(self):
        # Abbreviation matching works when abbreviated words are standalone
        # space-separated tokens that are prefixes of the expected tokens.
        code = "en\nconf terminal\nint gi0/0\nno shut\nex"
        expected = {
            "commands": [
                "enable",
                "configure terminal",
                "interface gi0/0",
                "no shutdown",
                "exit",
            ],
            "ordered": True,
        }
        result = grade_ios_commands(code, expected)
        assert result["passed"] is True
        assert result["score"] == 1.0

    def test_empty_expected_commands_returns_config_error(self):
        result = grade_ios_commands("enable", {"commands": []})
        assert result["passed"] is False
        assert result["score"] == 0.0
        assert "configuration error" in result["errors"].lower()

    def test_missing_commands_key_returns_config_error(self):
        result = grade_ios_commands("enable", {})
        assert result["passed"] is False
        assert result["score"] == 0.0
        assert "configuration error" in result["errors"].lower()

    def test_unordered_matching(self):
        code = "exit\nno shutdown\nenable\nconfigure terminal\ninterface gi0/0"
        expected = {
            "commands": [
                "enable",
                "configure terminal",
                "interface gi0/0",
                "no shutdown",
                "exit",
            ],
            "ordered": False,
        }
        result = grade_ios_commands(code, expected)
        assert result["passed"] is True
        assert result["score"] == 1.0

    def test_unordered_partial_match(self):
        code = "exit\nenable"
        expected = {
            "commands": [
                "enable",
                "configure terminal",
                "interface gi0/0",
                "no shutdown",
                "exit",
            ],
            "ordered": False,
        }
        result = grade_ios_commands(code, expected)
        assert result["passed"] is False
        assert result["score"] == pytest.approx(2 / 5)

    def test_extra_whitespace_in_user_input(self):
        code = "  enable  \n  configure   terminal  \n  exit  "
        expected = {
            "commands": ["enable", "configure terminal", "exit"],
            "ordered": True,
        }
        result = grade_ios_commands(code, expected)
        assert result["passed"] is True
        assert result["score"] == 1.0

    def test_ios_prompts_stripped_simple(self):
        # The prompt regex strips patterns like "Router#" or "Switch>"
        # but does NOT handle "Router(config)#" due to parentheses.
        code = "Router#enable\nRouter#configure terminal\nSwitch>show ip route"
        expected = {
            "commands": ["enable", "configure terminal", "show ip route"],
            "ordered": True,
        }
        result = grade_ios_commands(code, expected)
        assert result["passed"] is True
        assert result["score"] == 1.0

    def test_ios_config_mode_prompt_not_stripped(self):
        # Prompts with parentheses like "Router(config)#" are NOT stripped
        # by the current regex, so the command will not match.
        code = "Router(config)#exit"
        expected = {"commands": ["exit"], "ordered": True}
        result = grade_ios_commands(code, expected)
        assert result["passed"] is False

    def test_comment_lines_ignored(self):
        code = "enable\n! this is a comment\nconfigure terminal\nexit"
        expected = {
            "commands": ["enable", "configure terminal", "exit"],
            "ordered": True,
        }
        result = grade_ios_commands(code, expected)
        assert result["passed"] is True

    def test_blank_lines_ignored(self):
        code = "enable\n\n\nconfigure terminal\n\nexit"
        expected = {
            "commands": ["enable", "configure terminal", "exit"],
            "ordered": True,
        }
        result = grade_ios_commands(code, expected)
        assert result["passed"] is True

    def test_score_calculation(self):
        code = "enable\nconfigure terminal"
        expected = {
            "commands": [
                "enable",
                "configure terminal",
                "interface gi0/0",
                "no shutdown",
            ],
            "ordered": True,
        }
        result = grade_ios_commands(code, expected)
        assert result["score"] == pytest.approx(0.5)

    def test_output_reports_missing_commands(self):
        code = "enable"
        expected = {
            "commands": ["enable", "configure terminal"],
            "ordered": True,
        }
        result = grade_ios_commands(code, expected)
        assert "configure terminal" in result["output"]
        assert "Missing" in result["output"]

    def test_ordered_skips_out_of_order_commands(self):
        code = "configure terminal\nenable\nexit"
        expected = {
            "commands": ["enable", "configure terminal", "exit"],
            "ordered": True,
        }
        result = grade_ios_commands(code, expected)
        # In ordered mode, "configure terminal" matches first expected "enable"? No.
        # It tries to match each user line against expected[idx] sequentially.
        # "configure terminal" != "enable", skip user line
        # "enable" != "enable"? Actually "enable" == "enable", so idx advances
        # "exit" != "configure terminal", skip
        # So only "enable" matched.
        assert result["passed"] is False
