#!/usr/bin/env python3
"""Prepare a private WordUp SQLite export for assessment, not app import.

Python 3.10+, standard library only. No network or PostgreSQL access.
"""
import argparse
from collections import Counter
from contextlib import closing
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import uuid

FORMAT = "wordup-catalogue-preparation-v1"
COLUMNS = ("wordId", "rank", "personalRank", "text", "otherForms",
           "primaryMeaning", "primarySenseId", "type", "britishPhonetic",
           "americanPhonetic", "learnStateInt")
POLICY = {
    "includedCefrLevels": ["B1", "B2", "C1"],
    "includedFrequencies": ["heavy", "medium"],
    "evidenceType": "catalogue_definition",
    "teachingExampleOrigin": "authored_for_learning",
    "sourceSentenceAvailable": False,
    "rankIsLevelOrFrequencyEvidence": False,
    "importSourceLearningState": False,
    "existingVocabularyCheck": "required_in_local_app",
}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def file_hash(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest() if hasattr(hashlib, "file_digest") else hashlib.sha256(stream.read()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_rows(source):
    source = source.resolve(strict=True)
    # Require a closed export: uncheckpointed WAL would not be covered by file hash.
    require(not Path(str(source) + "-wal").exists(), "Use a closed SQLite export without a WAL sidecar")
    before = file_hash(source)
    with closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)) as connection:
        connection.execute("PRAGMA query_only=ON")
        require(connection.execute("PRAGMA quick_check").fetchall() == [("ok",)], "SQLite integrity check failed")
        schema = connection.execute("SELECT type FROM sqlite_master WHERE name='words'").fetchone()
        require(schema == ("table",), "words must be a table")
        actual = {row[1] for row in connection.execute("PRAGMA table_info(words)")}
        require(set(COLUMNS) <= actual, "Unsupported words schema; required columns are missing")
        connection.row_factory = sqlite3.Row
        rows = [dict(row) for row in connection.execute(
            'SELECT ' + ','.join('"' + column + '"' for column in COLUMNS) + ' FROM words ORDER BY wordId')]
    require(before == file_hash(source), "Source changed during preparation")
    require(not Path(str(source) + "-wal").exists(), "Source acquired a WAL sidecar during preparation")
    require(rows, "Catalogue is empty")
    require(all(type(row["wordId"]) is int for row in rows), "wordId must be an integer")
    require(len({row["wordId"] for row in rows}) == len(rows), "Duplicate wordId")
    for row in rows:
        for column in ("text", "otherForms", "primaryMeaning", "primarySenseId", "britishPhonetic", "americanPhonetic"):
            require(row[column] is None or isinstance(row[column], str), f"Invalid text field {column} in row {row['wordId']}")
        for column in ("rank", "personalRank", "type", "learnStateInt"):
            require(row[column] is None or type(row[column]) is int, f"Invalid numeric field {column} in row {row['wordId']}")
    return before, rows


def normalized(value):
    return " ".join((value or "").split()).casefold()


def build(source_hash, rows):
    ids = Counter(row["primarySenseId"] for row in rows if row["primarySenseId"])
    terms = Counter(normalized(row["text"]) for row in rows)
    definitions = Counter(row["primaryMeaning"] for row in rows if row["primaryMeaning"])
    records = []
    for row in rows:
        flags = []
        if not normalized(row["text"]):
            flags.append("missing_term")
        if not normalized(row["primaryMeaning"]):
            flags.append("missing_definition")
        if row["type"] not in (1, 2):
            flags.append("unknown_source_type")
        if not row["britishPhonetic"] and not row["americanPhonetic"]:
            flags.append("missing_pronunciation")
        try:
            uuid.UUID(row["primarySenseId"] or "")
        except (ValueError, AttributeError):
            flags.append("invalid_source_sense_id")
        if row["primarySenseId"] and ids[row["primarySenseId"]] > 1:
            flags.append("reused_source_sense_id")
        if terms[normalized(row["text"])] > 1:
            flags.append("repeated_spelling_review_senses")
        if row["primaryMeaning"] and definitions[row["primaryMeaning"]] > 1:
            flags.append("shared_definition_review_only")
        # Source snapshot is retained separately, byte-for-byte. Progress is not
        # copied into the assessment payload and can never become app progress.
        evidence = {key: row[key] for key in COLUMNS if key != "learnStateInt"}
        records.append({
            "recordId": f"wordup-{source_hash[:16]}-{row['wordId']}",
            "recordHash": digest(evidence),
            "source": evidence,
            "evidenceType": "catalogue_definition",
            "flags": flags,
        })
    # No lexical rank cutoff. Separate ranks are only ordering signals.
    ordered = sorted(records, key=lambda r: (
        r["source"]["rank"] if r["source"]["rank"] is not None else sys.maxsize,
        r["source"]["type"] if r["source"]["type"] is not None else sys.maxsize,
        r["source"]["wordId"]))
    group_count = (len(records) + 99) // 100
    base, remainder = divmod(len(records), group_count)
    groups, offset = [], 0
    for index in range(group_count):
        size = base + (index < remainder)
        groups.append({"groupId": f"group-{index + 1:05d}",
                       "recordIds": [r["recordId"] for r in ordered[offset:offset + size]]})
        offset += size
    counts = Counter(flag for record in records for flag in record["flags"])
    payload = {
        "formatVersion": FORMAT,
        "source": {"sha256": source_hash, "table": "words", "recordCount": len(records)},
        "policy": POLICY,
        "records": records,
        "assessmentGroups": groups,
        "audit": {"records": len(records), "groupedRecords": offset, "untracked": 0,
                  "words": sum(row["type"] == 1 for row in rows),
                  "expressions": sum(row["type"] == 2 for row in rows),
                  "unknownTypes": sum(row["type"] not in (1, 2) for row in rows),
                  "flagCounts": dict(sorted(counts.items()))},
    }
    return {**payload, "preparationHash": digest(payload)}


def validate(preparation, source):
    source_hash, rows = read_rows(source)
    # Recompute from the closed original snapshot, including flags and group
    # membership. A self-consistent edited JSON hash alone is not sufficient.
    require(canonical(preparation) == canonical(build(source_hash, rows)), "Preparation differs from the source or preparation contract")
    return preparation["audit"]


def write_once(path, payload):
    data = canonical(payload) + b"\n"
    if path.exists():
        require(path.read_bytes() == data, "Output already exists with different content; use a new path")
        return
    # Exclusive creation prevents clobbering a concurrent or previous result.
    with path.open("xb") as output:
        output.write(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("prepare", "validate"))
    parser.add_argument("source", type=Path)
    parser.add_argument("preparation", type=Path)
    args = parser.parse_args()
    try:
        require(args.source.resolve() != args.preparation.resolve(), "Output must not overwrite the source")
        if args.command == "prepare":
            source_hash, rows = read_rows(args.source)
            preparation = build(source_hash, rows)
            write_once(args.preparation, preparation)
        else:
            preparation = json.loads(args.preparation.read_text())
        audit = validate(preparation, args.source)
        print(json.dumps({"preparationHash": preparation["preparationHash"],
                          "assessmentGroups": len(preparation["assessmentGroups"]),
                          "audit": audit, "importReady": False,
                          "status": "prepared_not_semantically_assessed"}, indent=2))
    except (ValueError, OSError, sqlite3.Error) as error:
        parser.exit(1, f"Catalogue preparation failed: {error}\n")


if __name__ == "__main__":
    main()
