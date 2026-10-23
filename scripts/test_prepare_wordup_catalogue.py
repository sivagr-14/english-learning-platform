import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("catalogue", Path(__file__).with_name("prepare-wordup-catalogue.py"))
catalogue = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(catalogue)


class CatalogueTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / "catalogue.sqlite"
        self.output = Path(self.temp.name) / "prepared.json"
        with sqlite3.connect(self.source) as connection:
            connection.execute("CREATE TABLE words (wordId INTEGER PRIMARY KEY, rank INTEGER, personalRank INTEGER, text TEXT, otherForms TEXT, primaryMeaning TEXT, primarySenseId TEXT, type INTEGER, britishPhonetic TEXT, americanPhonetic TEXT, learnStateInt INTEGER)")
            connection.executemany("INSERT INTO words VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
                (1, 1, 2, "charge", "charged", "Ask someone to pay a price.", "bad-id", 1, "tʃɑːdʒ", "tʃɑrdʒ", 0),
                (2, 1, 1, "charge", "", "Rush forward forcefully.", "bad-id", 1, "", "", 2),
                (3, 100000, 100000, "go on", "", "Continue doing something.", "9fb3c45f-36f2-424a-b955-3da3fc4b4e40", 2, "", "", 1),
            ])

    def prepare(self):
        source_hash, rows = catalogue.read_rows(self.source)
        return catalogue.build(source_hash, rows)

    def test_exact_source_and_different_senses_survive_without_progress(self):
        original = self.source.read_bytes()
        prepared = self.prepare()
        catalogue.validate(prepared, self.source)
        self.assertEqual(original, self.source.read_bytes())
        self.assertEqual(len(prepared["records"]), 3)
        self.assertEqual(prepared["records"][1]["source"]["primaryMeaning"], "Rush forward forcefully.")
        self.assertNotEqual(prepared["records"][0]["recordId"], prepared["records"][1]["recordId"])
        self.assertNotIn("learnStateInt", json.dumps(prepared))
        self.assertNotIn("cefrLevel", json.dumps(prepared))
        self.assertFalse(prepared["policy"]["sourceSentenceAvailable"])
        self.assertEqual(prepared["policy"]["teachingExampleOrigin"], "authored_for_learning")

    def test_rank_is_not_a_cutoff_and_bad_ids_do_not_drop_rows(self):
        prepared = self.prepare()
        self.assertEqual(prepared["audit"]["untracked"], 0)
        self.assertEqual(prepared["audit"]["flagCounts"]["reused_source_sense_id"], 2)
        self.assertEqual(prepared["audit"]["flagCounts"]["invalid_source_sense_id"], 2)
        grouped = [key for group in prepared["assessmentGroups"] for key in group["recordIds"]]
        self.assertEqual(len(grouped), 3)
        self.assertEqual(len(set(grouped)), 3)
        self.assertTrue(any(record["source"]["rank"] == 100000 for record in prepared["records"]))

    def test_rehashing_tampered_definition_or_group_does_not_pass(self):
        for mutation in ("definition", "group", "policy", "numeric_type"):
            prepared = self.prepare()
            if mutation == "definition":
                prepared["records"][0]["source"]["primaryMeaning"] = "Forged meaning"
            elif mutation == "group":
                prepared["assessmentGroups"][0]["recordIds"].pop()
            elif mutation == "policy":
                prepared["policy"] = {**prepared["policy"], "sourceSentenceAvailable": True}
            else:
                prepared["records"][0]["source"]["wordId"] = True
            prepared["preparationHash"] = catalogue.digest({key: value for key, value in prepared.items() if key != "preparationHash"})
            with self.assertRaisesRegex(ValueError, "differs"):
                catalogue.validate(prepared, self.source)

    def test_idempotent_write_and_changed_output_conflict(self):
        prepared = self.prepare()
        catalogue.write_once(self.output, prepared)
        first = self.output.read_bytes()
        catalogue.write_once(self.output, self.prepare())
        self.assertEqual(first, self.output.read_bytes())
        with self.assertRaisesRegex(ValueError, "different content"):
            catalogue.write_once(self.output, {"edited": True})
        self.assertEqual(first, self.output.read_bytes())

    def test_changed_source_cannot_validate_old_preparation(self):
        prepared = self.prepare()
        with sqlite3.connect(self.source) as connection:
            connection.execute("UPDATE words SET primaryMeaning='Different meaning' WHERE wordId=1")
        with self.assertRaisesRegex(ValueError, "differs"):
            catalogue.validate(prepared, self.source)

    def test_balanced_complete_groups_at_boundaries(self):
        _, sample = catalogue.read_rows(self.source)
        for count in (1, 50, 100, 101, 199, 200, 201, 42200):
            rows = [{**sample[0], "wordId": index + 1} for index in range(count)]
            prepared = catalogue.build("a" * 64, rows)
            sizes = [len(group["recordIds"]) for group in prepared["assessmentGroups"]]
            self.assertEqual(sum(sizes), count)
            self.assertLessEqual(max(sizes), 100)
            if count > 100:
                self.assertGreaterEqual(min(sizes), 50)
            self.assertLessEqual(max(sizes) - min(sizes), 1)

    def test_missing_content_flagged_without_inventing_evidence(self):
        with sqlite3.connect(self.source) as connection:
            connection.execute("UPDATE words SET text='',primaryMeaning=NULL,type=9 WHERE wordId=1")
        prepared = self.prepare()
        self.assertEqual(prepared["audit"]["records"], 3)
        self.assertEqual(prepared["audit"]["unknownTypes"], 1)
        self.assertTrue({"missing_term", "missing_definition", "unknown_source_type"} <= set(prepared["records"][0]["flags"]))

    def test_wal_sidecar_is_rejected(self):
        Path(str(self.source) + "-wal").touch()
        with self.assertRaisesRegex(ValueError, "WAL"):
            self.prepare()

    def test_shared_gloss_flags_are_not_automatic_rejections(self):
        with sqlite3.connect(self.source) as connection:
            connection.execute("UPDATE words SET primaryMeaning='Continue doing something.' WHERE wordId=1")
        prepared = self.prepare()
        self.assertEqual(prepared["audit"]["flagCounts"]["shared_definition_review_only"], 2)
        self.assertNotIn("final_decision", json.dumps(prepared))


if __name__ == "__main__":
    unittest.main()
