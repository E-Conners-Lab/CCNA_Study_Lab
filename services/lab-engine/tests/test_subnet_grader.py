"""Tests for Subnetting Grader."""

import pytest

from grader.subnet_grader import grade_subnetting


class TestGradeSubnetting:
    """Tests for the grade_subnetting function."""

    def test_all_correct_answers(self):
        code = (
            "network=192.168.1.0\n"
            "broadcast=192.168.1.255\n"
            "first_host=192.168.1.1\n"
            "last_host=192.168.1.254\n"
            "hosts=254\n"
            "subnet_mask=255.255.255.0"
        )
        expected = {
            "answers": {
                "network": "192.168.1.0",
                "broadcast": "192.168.1.255",
                "first_host": "192.168.1.1",
                "last_host": "192.168.1.254",
                "hosts": "254",
                "subnet_mask": "255.255.255.0",
            }
        }
        result = grade_subnetting(code, expected)
        assert result["passed"] is True
        assert result["score"] == 1.0
        assert result["errors"] == ""

    def test_partially_correct_answers(self):
        code = (
            "network=192.168.1.0\n"
            "broadcast=192.168.1.128\n"
            "hosts=254"
        )
        expected = {
            "answers": {
                "network": "192.168.1.0",
                "broadcast": "192.168.1.255",
                "hosts": "254",
            }
        }
        result = grade_subnetting(code, expected)
        assert result["passed"] is False
        assert result["score"] == pytest.approx(2 / 3)
        assert "1 answer(s) incorrect" in result["errors"]

    def test_case_insensitive_matching(self):
        code = "subnet_mask=255.255.255.0\nnetwork=192.168.1.0"
        expected = {
            "answers": {
                "subnet_mask": "255.255.255.0",
                "network": "192.168.1.0",
            }
        }
        result = grade_subnetting(code, expected)
        assert result["passed"] is True
        assert result["score"] == 1.0

    def test_case_insensitive_value_matching(self):
        # Keys with mixed case in expected and user input
        code = "Network=192.168.1.0"
        expected = {"answers": {"network": "192.168.1.0"}}
        result = grade_subnetting(code, expected)
        assert result["passed"] is True

    def test_missing_answers_marked_incorrect(self):
        code = "network=192.168.1.0"
        expected = {
            "answers": {
                "network": "192.168.1.0",
                "broadcast": "192.168.1.255",
                "hosts": "254",
            }
        }
        result = grade_subnetting(code, expected)
        assert result["passed"] is False
        assert result["score"] == pytest.approx(1 / 3)
        assert "2 answer(s) incorrect" in result["errors"]

    def test_missing_answer_shows_not_provided(self):
        code = "network=192.168.1.0"
        expected = {
            "answers": {
                "network": "192.168.1.0",
                "broadcast": "192.168.1.255",
            }
        }
        result = grade_subnetting(code, expected)
        assert "(not provided)" in result["output"]

    def test_empty_expected_answers_returns_config_error(self):
        result = grade_subnetting("network=192.168.1.0", {"answers": {}})
        assert result["passed"] is False
        assert result["score"] == 0.0
        assert "configuration error" in result["errors"].lower()

    def test_missing_answers_key_returns_config_error(self):
        result = grade_subnetting("network=192.168.1.0", {})
        assert result["passed"] is False
        assert result["score"] == 0.0
        assert "configuration error" in result["errors"].lower()

    def test_extra_whitespace_in_key_value_pairs(self):
        code = "  network  =  192.168.1.0  \n  hosts = 254  "
        expected = {
            "answers": {
                "network": "192.168.1.0",
                "hosts": "254",
            }
        }
        result = grade_subnetting(code, expected)
        assert result["passed"] is True
        assert result["score"] == 1.0

    def test_cidr_notation_answers(self):
        code = "prefix_length=/24\nnetwork=10.0.0.0/24"
        expected = {
            "answers": {
                "prefix_length": "/24",
                "network": "10.0.0.0/24",
            }
        }
        result = grade_subnetting(code, expected)
        assert result["passed"] is True
        assert result["score"] == 1.0

    def test_all_wrong_answers(self):
        code = "network=10.0.0.0\nbroadcast=10.0.0.255"
        expected = {
            "answers": {
                "network": "192.168.1.0",
                "broadcast": "192.168.1.255",
            }
        }
        result = grade_subnetting(code, expected)
        assert result["passed"] is False
        assert result["score"] == 0.0

    def test_output_shows_correct_and_incorrect(self):
        code = "network=192.168.1.0\nbroadcast=WRONG"
        expected = {
            "answers": {
                "network": "192.168.1.0",
                "broadcast": "192.168.1.255",
            }
        }
        result = grade_subnetting(code, expected)
        assert "[CORRECT]" in result["output"]
        assert "[INCORRECT" in result["output"]

    def test_key_with_spaces_normalized_to_underscore(self):
        code = "first host=192.168.1.1"
        expected = {"answers": {"first_host": "192.168.1.1"}}
        result = grade_subnetting(code, expected)
        assert result["passed"] is True

    def test_score_field_present(self):
        code = "network=192.168.1.0"
        expected = {"answers": {"network": "192.168.1.0"}}
        result = grade_subnetting(code, expected)
        assert "score" in result
        assert isinstance(result["score"], float)
