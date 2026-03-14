"""Tests for ACL Builder Grader."""

import pytest

from grader.acl_grader import grade_acl, normalize_acl_line, parse_acl_entries


class TestNormalizeAclLine:
    """Tests for the normalize_acl_line helper."""

    def test_strips_whitespace(self):
        assert normalize_acl_line("  access-list 100 permit  ") == "access-list 100 permit"

    def test_collapses_internal_whitespace(self):
        assert normalize_acl_line("access-list  100   permit") == "access-list 100 permit"

    def test_lowercases(self):
        assert normalize_acl_line("Access-List 100 PERMIT") == "access-list 100 permit"

    def test_empty_string(self):
        assert normalize_acl_line("") == ""


class TestParseAclEntries:
    """Tests for the parse_acl_entries helper."""

    def test_parses_valid_entries(self):
        code = (
            "access-list 100 permit tcp any any eq 80\n"
            "access-list 100 deny ip any any"
        )
        entries = parse_acl_entries(code)
        assert len(entries) == 2
        assert entries[0] == "access-list 100 permit tcp any any eq 80"
        assert entries[1] == "access-list 100 deny ip any any"

    def test_ignores_comment_lines_exclamation(self):
        code = "! This is a comment\naccess-list 100 permit tcp any any eq 80"
        entries = parse_acl_entries(code)
        assert len(entries) == 1

    def test_ignores_comment_lines_hash(self):
        code = "# This is a comment\naccess-list 100 permit tcp any any eq 80"
        entries = parse_acl_entries(code)
        assert len(entries) == 1

    def test_ignores_blank_lines(self):
        code = "access-list 100 permit tcp any any eq 80\n\n\naccess-list 100 deny ip any any"
        entries = parse_acl_entries(code)
        assert len(entries) == 2

    def test_normalizes_entries(self):
        code = "  Access-List  100   PERMIT  tcp any any eq 80  "
        entries = parse_acl_entries(code)
        assert entries[0] == "access-list 100 permit tcp any any eq 80"

    def test_empty_input(self):
        entries = parse_acl_entries("")
        assert entries == []


class TestGradeAclOrdered:
    """Tests for ordered ACL grading."""

    def test_all_entries_correct_ordered(self):
        code = (
            "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80\n"
            "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 443\n"
            "access-list 100 deny ip any any"
        )
        expected = {
            "entries": [
                "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80",
                "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 443",
                "access-list 100 deny ip any any",
            ],
            "ordered": True,
        }
        result = grade_acl(code, expected)
        assert result["passed"] is True
        assert result["score"] == 1.0
        assert result["errors"] == ""

    def test_missing_entries_ordered(self):
        code = "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80"
        expected = {
            "entries": [
                "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80",
                "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 443",
                "access-list 100 deny ip any any",
            ],
            "ordered": True,
        }
        result = grade_acl(code, expected)
        assert result["passed"] is False
        assert result["score"] == pytest.approx(1 / 3)

    def test_wrong_order_fails_in_ordered_mode(self):
        code = (
            "access-list 100 deny ip any any\n"
            "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80\n"
            "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 443"
        )
        expected = {
            "entries": [
                "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80",
                "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 443",
                "access-list 100 deny ip any any",
            ],
            "ordered": True,
        }
        result = grade_acl(code, expected)
        assert result["passed"] is False


class TestGradeAclUnordered:
    """Tests for unordered ACL grading."""

    def test_unordered_matching(self):
        code = (
            "access-list 100 deny ip any any\n"
            "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 443\n"
            "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80"
        )
        expected = {
            "entries": [
                "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80",
                "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 443",
                "access-list 100 deny ip any any",
            ],
            "ordered": False,
        }
        result = grade_acl(code, expected)
        assert result["passed"] is True
        assert result["score"] == 1.0

    def test_unordered_partial_match(self):
        code = "access-list 100 deny ip any any"
        expected = {
            "entries": [
                "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80",
                "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 443",
                "access-list 100 deny ip any any",
            ],
            "ordered": False,
        }
        result = grade_acl(code, expected)
        assert result["passed"] is False
        assert result["score"] == pytest.approx(1 / 3)


class TestGradeAclCheckApply:
    """Tests for the check_apply feature."""

    def test_check_apply_with_ip_access_group(self):
        code = (
            "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80\n"
            "access-list 100 deny ip any any\n"
            "ip access-group 100 in"
        )
        expected = {
            "entries": [
                "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80",
                "access-list 100 deny ip any any",
            ],
            "ordered": True,
            "check_apply": {
                "interface": "GigabitEthernet0/0",
                "direction": "in",
            },
        }
        result = grade_acl(code, expected)
        assert result["passed"] is True
        assert result["score"] == 1.0

    def test_check_apply_missing_fails(self):
        code = (
            "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80\n"
            "access-list 100 deny ip any any"
        )
        expected = {
            "entries": [
                "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80",
                "access-list 100 deny ip any any",
            ],
            "ordered": True,
            "check_apply": {
                "interface": "GigabitEthernet0/0",
                "direction": "in",
            },
        }
        result = grade_acl(code, expected)
        assert result["passed"] is False
        assert "not applied" in result["output"].lower()

    def test_check_apply_wrong_direction(self):
        code = (
            "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80\n"
            "access-list 100 deny ip any any\n"
            "ip access-group 100 out"
        )
        expected = {
            "entries": [
                "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80",
                "access-list 100 deny ip any any",
            ],
            "ordered": True,
            "check_apply": {
                "interface": "GigabitEthernet0/0",
                "direction": "in",
            },
        }
        result = grade_acl(code, expected)
        assert result["passed"] is False

    def test_check_apply_score_includes_apply_check(self):
        code = (
            "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80\n"
            "access-list 100 deny ip any any"
        )
        expected = {
            "entries": [
                "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80",
                "access-list 100 deny ip any any",
            ],
            "ordered": True,
            "check_apply": {
                "interface": "GigabitEthernet0/0",
                "direction": "in",
            },
        }
        result = grade_acl(code, expected)
        # 2 entries matched out of 3 total checks (2 entries + 1 apply)
        assert result["score"] == pytest.approx(2 / 3)


class TestGradeAclEdgeCases:
    """Tests for edge cases."""

    def test_empty_expected_entries_returns_config_error(self):
        result = grade_acl("access-list 100 permit ip any any", {"entries": []})
        assert result["passed"] is False
        assert result["score"] == 0.0
        assert "configuration error" in result["errors"].lower()

    def test_missing_entries_key_returns_config_error(self):
        result = grade_acl("access-list 100 permit ip any any", {})
        assert result["passed"] is False
        assert result["score"] == 0.0
        assert "configuration error" in result["errors"].lower()

    def test_comments_and_blanks_ignored(self):
        code = (
            "! ACL for web traffic\n"
            "# Another comment\n"
            "\n"
            "access-list 100 permit tcp any any eq 80\n"
            "\n"
            "! End of ACL\n"
            "access-list 100 deny ip any any"
        )
        expected = {
            "entries": [
                "access-list 100 permit tcp any any eq 80",
                "access-list 100 deny ip any any",
            ],
            "ordered": True,
        }
        result = grade_acl(code, expected)
        assert result["passed"] is True
        assert result["score"] == 1.0

    def test_output_shows_missing_entries(self):
        code = "access-list 100 permit tcp any any eq 80"
        expected = {
            "entries": [
                "access-list 100 permit tcp any any eq 80",
                "access-list 100 deny ip any any",
            ],
            "ordered": True,
        }
        result = grade_acl(code, expected)
        assert "Missing ACL entries" in result["output"]
        assert "access-list 100 deny ip any any" in result["output"]

    def test_all_correct_output_message(self):
        code = "access-list 100 deny ip any any"
        expected = {
            "entries": ["access-list 100 deny ip any any"],
            "ordered": True,
        }
        result = grade_acl(code, expected)
        assert "All ACL entries correct" in result["output"]

    def test_no_check_apply_does_not_affect_result(self):
        code = "access-list 100 deny ip any any"
        expected = {
            "entries": ["access-list 100 deny ip any any"],
            "ordered": True,
        }
        result = grade_acl(code, expected)
        assert result["passed"] is True
        assert result["score"] == 1.0
