#!/usr/bin/env python3
"""Prepare isolated ChatGPT worker inputs and atomically apply reviewed scope results.

No language model calls or PostgreSQL writes. The ChatGPT coordinator launches
workers concurrently, inspects their outputs, then calls merge as sole writer.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import time
import uuid

spec = importlib.util.spec_from_file_location('work_queue', Path(__file__).with_name('catalogue-work-queue.py'))
q = importlib.util.module_from_spec(spec)
spec.loader.exec_module(q)


def schema(db):
    db.execute('''CREATE TABLE IF NOT EXISTS catalogue_parallel_assignment(
        assignment_id TEXT PRIMARY KEY, bundle_json TEXT NOT NULL,
        state TEXT NOT NULL, expires REAL NOT NULL, result_hash TEXT)''')
    db.execute('''CREATE TABLE IF NOT EXISTS catalogue_parallel_receipt(
        assignment_id TEXT PRIMARY KEY, result_hash TEXT NOT NULL,
        result_json TEXT NOT NULL, applied_at REAL NOT NULL)''')


SOURCE_COLUMNS = {'wordId', 'rank', 'personalRank', 'text', 'otherForms',
                  'primaryMeaning', 'primarySenseId', 'type', 'britishPhonetic', 'americanPhonetic'}


def verify_policy(db):
    meta = dict(db.execute('SELECT key,value FROM assessment_meta'))
    policy = json.loads(meta.get('learner_scope_override', '{}'))
    expected = {'policyId': q.POLICY, 'eligibleLevels': ['B1', 'B2', 'C1', 'C2'],
                'priorityLevels': ['B2', 'C1', 'C2'], 'includedFrequencies': ['heavy', 'medium'],
                'excludeBasicObvious': True, 'excludePredictableCombinations': True,
                'excludeRareSpecialist': True, 'preserveNonObviousExpressions': True,
                'expandBasicHeadwords': False}
    if any(policy.get(k) != v for k, v in expected.items()):
        raise ValueError('Assessment selection policy changed or is missing')


def verify_source(db, preparation):
    # Verify the entire immutable preparation with the existing production helper.
    with tempfile.TemporaryDirectory() as tmp:
        q.initialize(str(Path(tmp) / 'verify.sqlite'), preparation, 'integrity-check')
    verify_policy(db)
    meta = dict(db.execute('SELECT key,value FROM assessment_meta'))
    if meta.get('source_sha256') != preparation['source']['sha256']:
        raise ValueError('Assessment/source binding mismatch')
    if db.execute('SELECT count(*) FROM words').fetchone()[0] != len(preparation['records']):
        raise ValueError('Assessment/source count mismatch')
    for record in preparation['records']:
        keys = list(record['source'])
        if not set(keys) <= SOURCE_COLUMNS:
            raise ValueError('Unexpected source columns')
        row = db.execute('SELECT ' + ','.join('"'+key+'"' for key in keys) + ' FROM words WHERE wordId=?',
                         (record['source']['wordId'],)).fetchone()
        if row is None or dict(zip(keys, row)) != record['source']:
            raise ValueError('Immutable source row changed: ' + record['recordId'])


def prepare(db_path, preparation, output, workers=3, now=None, seconds=3600, coordinator=None):
    """Persist assignments first; reruns re-export live bundles without new claims."""
    if not isinstance(coordinator, str) or not coordinator.strip():
        raise ValueError('A unique coordinator run identity is required')
    if not 1 <= workers <= 3 or not 30 <= seconds <= 3600:
        raise ValueError('Use 1–3 workers and 30–3600 second leases')
    now = time.time() if now is None else now
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    with q.transaction(db_path) as db:
        verify_source(db, preparation)
        schema(db)
        db.execute("UPDATE catalogue_parallel_assignment SET state='expired' WHERE state='assigned' AND expires<=?", (now,))
        live = [json.loads(r[0]) for r in db.execute("SELECT bundle_json FROM catalogue_parallel_assignment WHERE state='assigned' ORDER BY rowid")]
        if live:
            if any(b.get('coordinator') != coordinator for b in live):
                raise ValueError('Another coordinator owns live assignments; wait for expiry or resume the same run')
            bundles = live  # Resume exact identities; do not abandon active workers.
        else:
            seen = {r[0] for r in db.execute('SELECT record_id FROM catalogue_record_scope_review')}
            seen.update(r[0] for r in db.execute('SELECT DISTINCT record_id FROM catalogue_meaning_review'))
            records = {r['recordId']: r for r in preparation['records']}
            checkpoint = dict(db.execute('SELECT key,value FROM assessment_meta')).get('latest_editorial_checkpoint')
            if not checkpoint:
                raise ValueError('Missing verified checkpoint identity')
            bundles = []
            for group in preparation['assessmentGroups']:
                pending = [rid for rid in group['recordIds'] if rid not in seen]
                if not pending:
                    continue
                bundle = {'formatVersion': 'catalogue-parallel-scope-v1',
                          'assignmentId': uuid.uuid4().hex, 'groupId': group['groupId'],
                          'coordinator': coordinator,
                          'recordIds': pending, 'records': [records[rid] for rid in pending],
                          'sourceHash': preparation['source']['sha256'],
                          'preparationHash': preparation['preparationHash'],
                          'policyId': q.POLICY, 'baseCheckpoint': checkpoint,
                          'expires': now + seconds, 'stage': 'initial_scope_only',
                          'requirements': 'Individually assess B1–C2 usefulness, prioritize B2–C2; exclude obvious basics/predictable combinations; retain non-obvious expressions. Rank is not evidence. Do not claim full sense review, lesson generation or import. Output assignmentId, bundleHash, recordReviews; each review requires recordId, scopeDecision, specific reason, scopePolicyId, sourceRecordHash, term, sourcePrimaryMeaning, importReady=false, meaningInventoryComplete=false, additionalMeaningsReviewed=false. scope_excluded requires basic_obvious or predictable_combination scopeExclusionCode.'}
                bundle['bundleHash'] = q.digest(bundle)
                db.execute('INSERT INTO catalogue_parallel_assignment VALUES (?,?,?,?,NULL)',
                           (bundle['assignmentId'], json.dumps(bundle, ensure_ascii=False), 'assigned', now + seconds))
                bundles.append(bundle)
                if len(bundles) == workers:
                    break
    paths = []
    for bundle in bundles:
        path = output / (bundle['assignmentId'] + '.json')
        data = json.dumps(bundle, ensure_ascii=False, indent=2) + '\n'
        if path.exists() and path.read_text() != data:
            raise ValueError('Refusing to overwrite changed worker input')
        if not path.exists():
            with path.open('x') as f:
                f.write(data)
        paths.append(str(path))
    return {'assignments': paths, 'workers': len(paths), 'stage': 'initial_scope_only', 'importsVerified': False}


def merge(db_path, results, now=None):
    """One transaction for the entire supplied worker round. Never replace old reviews."""
    now = time.time() if now is None else now
    inserted = 0
    with q.transaction(db_path) as db:
        schema(db)
        verify_policy(db)
        for result in results:
            aid = result['assignmentId']
            checksum = q.digest(result)
            receipt = db.execute('SELECT result_hash FROM catalogue_parallel_receipt WHERE assignment_id=?', (aid,)).fetchone()
            if receipt:
                if receipt[0] != checksum:
                    raise ValueError('Conflicting replay')
                continue
            row = db.execute('SELECT bundle_json,state,expires FROM catalogue_parallel_assignment WHERE assignment_id=?', (aid,)).fetchone()
            if row is None or row[1] != 'assigned' or row[2] <= now:
                raise ValueError('Unknown, stale or expired assignment')
            bundle = json.loads(row[0])
            if result.get('bundleHash') != bundle['bundleHash']:
                raise ValueError('Worker input binding mismatch')
            if dict(db.execute('SELECT key,value FROM assessment_meta')).get('source_sha256') != bundle['sourceHash']:
                raise ValueError('Source binding changed')
            reviews = result.get('recordReviews')
            if not isinstance(reviews, list) or len(reviews) != len(bundle['recordIds']):
                raise ValueError('Incomplete assigned-record coverage')
            records = {r['recordId']: r for r in bundle['records']}
            seen = set()
            for review in reviews:
                rid = review.get('recordId')
                if rid not in records or rid in seen:
                    raise ValueError('Duplicate or unassigned record')
                seen.add(rid)
                record = records[rid]
                source = record['source']
                keys = list(source)
                actual = db.execute('SELECT '+','.join('"'+k+'"' for k in keys)+' FROM words WHERE wordId=?', (source['wordId'],)).fetchone()
                if actual is None or dict(zip(keys, actual)) != source:
                    raise ValueError('Source row changed during review')
                for key, value in {'scopePolicyId': q.POLICY, 'sourceRecordHash': record['recordHash'],
                                   'term': source['text'], 'sourcePrimaryMeaning': source['primaryMeaning'],
                                   'importReady': False, 'meaningInventoryComplete': False,
                                   'additionalMeaningsReviewed': False}.items():
                    if key not in review or review[key] != value:
                        raise ValueError('Invalid review binding or unsupported completion claim: '+key)
                if review.get('scopeDecision') not in ('retain', 'scope_excluded', 'rejected', 'hold'):
                    raise ValueError('Missing scope decision')
                if not isinstance(review.get('reason'), str) or len(review['reason'].strip()) < 8:
                    raise ValueError('Specific individual reason required')
                if review['scopeDecision'] == 'scope_excluded' and review.get('scopeExclusionCode') not in ('basic_obvious', 'predictable_combination'):
                    raise ValueError('Missing scope exclusion reason code')
                if db.execute('SELECT 1 FROM catalogue_record_scope_review WHERE record_id=?', (rid,)).fetchone() or db.execute('SELECT 1 FROM catalogue_meaning_review WHERE record_id=?', (rid,)).fetchone():
                    raise ValueError('Record was reviewed after assignment; reconcile rather than overwrite')
                if any(key in review for key in ('finalDecision', 'final_decision', 'candidateDecision')) or review.get('scopeDecisionFinal', False) is not False:
                    raise ValueError('Worker cannot finalize semantic decisions')
                stored = dict(review, groupId=bundle['groupId'], assignmentId=aid, scopeDecisionFinal=False)
                db.execute('INSERT INTO catalogue_record_scope_review VALUES (?,?,?,?)',
                           (rid, bundle['groupId'], json.dumps(stored, ensure_ascii=False, sort_keys=True), str(now)))
                inserted += 1
            db.execute('INSERT INTO catalogue_parallel_receipt VALUES (?,?,?,?)',
                       (aid, checksum, json.dumps(result, ensure_ascii=False, sort_keys=True), now))
            db.execute("UPDATE catalogue_parallel_assignment SET state='applied',result_hash=? WHERE assignment_id=?", (checksum, aid))
        screened = db.execute('SELECT count(*) FROM (SELECT record_id FROM catalogue_record_scope_review UNION SELECT record_id FROM catalogue_meaning_review)').fetchone()[0]
    return {'newScopeReviews': inserted, 'initialSourceRecordsScreened': screened, 'assessmentCompletion': 'not established by scope screening', 'importsVerified': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assessment', required=True)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('prepare')
    p.add_argument('preparation')
    p.add_argument('output_directory')
    p.add_argument('--workers', type=int, default=3)
    p.add_argument('--coordinator', required=True)
    p = sub.add_parser('merge')
    p.add_argument('results', nargs='+')
    args = parser.parse_args()
    if args.command == 'prepare':
        result = prepare(args.assessment, json.loads(Path(args.preparation).read_text()), args.output_directory, args.workers, coordinator=args.coordinator)
    else:
        result = merge(args.assessment, [json.loads(Path(p).read_text()) for p in args.results])
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
