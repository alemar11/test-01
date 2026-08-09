from __future__ import annotations

import contextlib
import io
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from resolve_release_version import (
    RESOLVER_VERSION,
    is_final_tag,
    main,
    normalize_operation,
    resolve,
)


class ResolveReleaseVersionTests(unittest.TestCase):
    def test_cli_reports_resolver_version(self) -> None:
        script = Path(__file__).with_name("resolve_release_version.py")
        output = subprocess.check_output(
            [sys.executable, str(script), "--version"],
            text=True,
        )
        self.assertEqual(RESOLVER_VERSION, "0.2.0")
        self.assertEqual(output.strip(), RESOLVER_VERSION)

    def test_final_tag_classification_requires_a_canonical_stable_tag(self) -> None:
        self.assertTrue(is_final_tag("v1.2.3"))
        self.assertFalse(is_final_tag("v1.2.3-rc.1"))
        self.assertFalse(is_final_tag("1.2.3"))
        self.assertFalse(is_final_tag("v1.2.3-beta"))

    def resolve(
        self,
        *,
        operation: str,
        tags: list[str] | None = None,
        ref_name: str = "main",
        confirmed_tag: str | None = None,
    ) -> dict[str, object]:
        return resolve(
            ref_name=ref_name,
            default_branch="main",
            operation=operation,
            raw_tags=tags or ["v0.1.0"],
            confirmed_tag=confirmed_tag,
        )

    def test_manual_menu_prefix_is_the_only_semantic_key(self) -> None:
        self.assertEqual(
            normalize_operation("[minor] Any descriptive text may change"),
            "minor",
        )
        self.assertEqual(normalize_operation("candidate"), "candidate")
        self.assertEqual(normalize_operation("auto"), "auto")

    def test_default_branch_proposals_from_stable_baseline(self) -> None:
        expected = {
            "patch": "v0.1.1-rc.1",
            "minor": "v0.2.0-rc.1",
            "major": "v1.0.0-rc.1",
        }
        for operation, tag in expected.items():
            with self.subTest(operation=operation):
                result = self.resolve(operation=operation)
                self.assertTrue(result["ok"])
                self.assertEqual(result["tag"], tag)
                self.assertFalse(result["is_final"])
                self.assertEqual(result["status"], "proposal-ready")

    def test_same_release_line_must_continue_from_its_release_branch(self) -> None:
        result = self.resolve(
            operation="patch",
            tags=["v0.1.0", "v0.1.1-rc.1"],
        )
        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "blocked-release-in-progress")
        self.assertEqual(result["release_branch"], "release/v0.1.1")

    def test_finalized_candidate_line_no_longer_blocks_new_line(self) -> None:
        result = self.resolve(
            operation="patch",
            tags=["v0.1.0", "v0.2.0-rc.1", "v0.2.0"],
        )
        self.assertTrue(result["ok"])
        self.assertEqual(result["tag"], "v0.2.1-rc.1")

    def test_unrelated_release_lines_do_not_change_the_stable_baseline(self) -> None:
        result = self.resolve(
            operation="patch",
            tags=["v1.0.0", "v2.0.0-rc.1", "v3.0.0-rc.1"],
        )
        self.assertTrue(result["ok"])
        self.assertEqual(result["tag"], "v1.0.1-rc.1")

    def test_prereleases_without_a_stable_baseline_are_blocked(self) -> None:
        result = self.resolve(
            operation="patch",
            tags=["v0.1.0-rc.1"],
        )
        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "blocked-missing-baseline")

    def test_release_branch_calculates_next_candidate(self) -> None:
        result = self.resolve(
            operation="candidate",
            tags=["v0.1.0", "v0.2.0-rc.1", "v0.2.0-rc.3"],
            ref_name="release/v0.2.0",
        )
        self.assertTrue(result["ok"])
        self.assertEqual(result["tag"], "v0.2.0-rc.4")
        self.assertFalse(result["is_final"])

    def test_release_branch_can_finalize_without_a_prior_candidate(self) -> None:
        result = self.resolve(
            operation="final",
            ref_name="release/v9.9.9",
        )
        self.assertTrue(result["ok"])
        self.assertEqual(result["tag"], "v9.9.9")
        self.assertTrue(result["is_final"])

    def test_legacy_baseline_produces_only_canonical_new_tags(self) -> None:
        result = self.resolve(operation="patch", tags=["9.0.0"])
        self.assertTrue(result["ok"])
        self.assertEqual(result["tag"], "v9.0.1-rc.1")

    def test_noncanonical_confirmation_is_never_normalized(self) -> None:
        for confirmed_tag in (
            "0.1.1-rc.1",
            "v0.1.1-beta",
            "v0.1.1-rc01",
            "v0.1.1-rc.01",
            "v0.1.1+build.1",
        ):
            with self.subTest(confirmed_tag=confirmed_tag):
                result = self.resolve(
                    operation="patch",
                    confirmed_tag=confirmed_tag,
                )
                self.assertFalse(result["ok"])
                self.assertEqual(result["status"], "blocked-noncanonical")

    def test_exact_confirmation_is_required(self) -> None:
        accepted = self.resolve(
            operation="patch",
            confirmed_tag="v0.1.1-rc.1",
        )
        rejected = self.resolve(
            operation="patch",
            confirmed_tag="v0.1.2-rc.1",
        )
        self.assertTrue(accepted["application_ready"])
        self.assertEqual(rejected["status"], "blocked-confirmation-mismatch")

    def test_existing_final_can_only_reconcile_the_pr(self) -> None:
        result = self.resolve(
            operation="final",
            tags=["v0.1.0", "v0.2.0"],
            ref_name="release/v0.2.0",
            confirmed_tag="v0.2.0",
        )
        self.assertTrue(result["ok"])
        self.assertEqual(result["status"], "reconcile-existing-final")
        self.assertEqual(result["tag_state"], "existing-final")
        self.assertTrue(result["is_final"])

    def test_finalized_line_rejects_a_new_candidate(self) -> None:
        result = self.resolve(
            operation="candidate",
            tags=["v0.1.0", "v0.2.0-rc.1", "v0.2.0"],
            ref_name="release/v0.2.0",
        )
        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "blocked-finalized")

    def test_cli_writes_outputs_and_legacy_warning(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            tags = root / "tags.txt"
            output = root / "output.txt"
            summary = root / "summary.md"
            tags.write_text("9.0.0\n", encoding="utf-8")
            output.touch()
            summary.touch()

            with contextlib.redirect_stdout(io.StringIO()):
                status = main(
                    [
                        "--default-branch",
                        "main",
                        "--github-output",
                        str(output),
                        "--github-step-summary",
                        str(summary),
                        "--operation",
                        "[patch] Default branch",
                        "--ref-name",
                        "main",
                        "--tag-snapshot",
                        "snapshot",
                        "--tags-file",
                        str(tags),
                        "--target-sha",
                        "abc123",
                    ]
                )

            self.assertEqual(status, 0)
            rendered_output = output.read_text(encoding="utf-8")
            self.assertIn("tag=v9.0.1-rc.1", rendered_output)
            self.assertIn("is_final=false", rendered_output)
            rendered_summary = summary.read_text(encoding="utf-8")
            self.assertIn("Legacy SemVer tags", rendered_summary)
            self.assertIn("Every new proposal remains canonical", rendered_summary)

    def test_cli_auto_infers_an_exact_application(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            tags = root / "tags.txt"
            output = root / "output.txt"
            summary = root / "summary.md"
            tags.write_text("v0.1.0\n", encoding="utf-8")
            output.touch()
            summary.touch()

            with contextlib.redirect_stdout(io.StringIO()):
                status = main(
                    [
                        "--application-mode",
                        "--confirmed-tag",
                        "v0.2.0-rc.1",
                        "--default-branch",
                        "main",
                        "--github-output",
                        str(output),
                        "--github-step-summary",
                        str(summary),
                        "--operation",
                        "auto",
                        "--ref-name",
                        "main",
                        "--tag-snapshot",
                        "snapshot",
                        "--tags-file",
                        str(tags),
                        "--target-sha",
                        "abc123",
                    ]
                )

            self.assertEqual(status, 0)
            rendered_output = output.read_text(encoding="utf-8")
            self.assertIn("application_ready=true", rendered_output)
            self.assertIn("is_final=false", rendered_output)
            self.assertIn("resolver_version=0.2.0", rendered_output)
            self.assertIn("tag=v0.2.0-rc.1", rendered_output)

    def test_cli_exposes_final_tag_boolean(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            tags = root / "tags.txt"
            output = root / "output.txt"
            summary = root / "summary.md"
            tags.write_text("v0.1.0\n", encoding="utf-8")
            output.touch()
            summary.touch()

            with contextlib.redirect_stdout(io.StringIO()):
                status = main(
                    [
                        "--default-branch",
                        "main",
                        "--github-output",
                        str(output),
                        "--github-step-summary",
                        str(summary),
                        "--operation",
                        "final",
                        "--ref-name",
                        "release/v0.2.0",
                        "--tag-snapshot",
                        "snapshot",
                        "--tags-file",
                        str(tags),
                        "--target-sha",
                        "abc123",
                    ]
                )

            self.assertEqual(status, 0)
            rendered_output = output.read_text(encoding="utf-8")
            self.assertIn("is_final=true", rendered_output)
            self.assertIn("tag=v0.2.0", rendered_output)
            self.assertIn("| Final tag | `True` |", summary.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
