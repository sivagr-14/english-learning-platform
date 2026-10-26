import copy
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('parallel', Path(__file__).with_name('catalogue-parallel-assessment.py'))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


class ParallelTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = str(Path(self.tmp.name) / 'assessment.sqlite')
        self.out = str(Path(self.tmp.name) / 'workers')
        records = []
        for i in range(6):
            source = {'wordId': i, 'text': 'fixture'+str(i), 'primaryMeaning': 'A synthetic test definition'}
            records.append({'recordId': 'wordup-'+('a'*16)+'-'+str(i), 'source': source, 'recordHash': p.q.digest(source)})
        self.prep = {'source': {'sha256': 'a'*64, 'recordCount': 6}, 'records': records,
                     'assessmentGroups': [{'groupId': 'group-'+str(i), 'recordIds': [r['recordId'] for r in records[i*2:i*2+2]]} for i in range(3)]}
        self.prep['preparationHash'] = p.q.digest(self.prep)
        with sqlite3.connect(self.db) as db:
            db.executescript('''CREATE TABLE words(wordId INTEGER PRIMARY KEY,text TEXT,primaryMeaning TEXT);
            CREATE TABLE assessment_meta(key TEXT PRIMARY KEY,value TEXT);
            CREATE TABLE catalogue_record_scope_review(record_id TEXT PRIMARY KEY,group_id TEXT,scope_json TEXT,reviewed_at TEXT);
            CREATE TABLE catalogue_meaning_review(candidate_id TEXT PRIMARY KEY,record_id TEXT,review_json TEXT);''')
            db.executemany('INSERT INTO words VALUES (:wordId,:text,:primaryMeaning)', [r['source'] for r in records])
            db.executemany('INSERT INTO assessment_meta VALUES (?,?)', [('source_sha256','a'*64),('latest_editorial_checkpoint','base'), ('learner_scope_override', json.dumps({'policyId': p.q.POLICY, 'eligibleLevels': ['B1','B2','C1','C2'], 'priorityLevels': ['B2','C1','C2'], 'includedFrequencies': ['heavy','medium'], 'excludeBasicObvious': True, 'excludePredictableCombinations': True, 'excludeRareSpecialist': True, 'preserveNonObviousExpressions': True, 'expandBasicHeadwords': False}))])

    def bundles(self):
        result = p.prepare(self.db, self.prep, self.out, coordinator='test-run', now=100)
        return [json.loads(Path(f).read_text()) for f in result['assignments']]

    def result(self, bundle):
        return {'assignmentId': bundle['assignmentId'], 'bundleHash': bundle['bundleHash'], 'recordReviews': [
            {'recordId': r['recordId'], 'sourceRecordHash': r['recordHash'], 'scopePolicyId': p.q.POLICY,
             'term': r['source']['text'], 'sourcePrimaryMeaning': r['source']['primaryMeaning'],
             'scopeDecision': 'hold', 'reason': 'Synthetic fixture needs actual linguistic assessment',
             'importReady': False, 'meaningInventoryComplete': False, 'additionalMeaningsReviewed': False}
            for r in bundle['records']]}

    def count(self):
        with sqlite3.connect(self.db) as db:
            return db.execute('SELECT count(*) FROM catalogue_record_scope_review').fetchone()[0]

    def test_three_disjoint_bundles_resume_exactly(self):
        bundles = self.bundles()
        self.assertEqual(len(bundles), 3)
        self.assertEqual(len({rid for b in bundles for rid in b['recordIds']}), 6)
        self.assertEqual(bundles, self.bundles())

    def test_another_coordinator_cannot_duplicate_active_dispatch(self):
        self.bundles()
        with self.assertRaisesRegex(ValueError, 'Another coordinator'):
            p.prepare(self.db, self.prep, self.out, coordinator='other-run', now=101)

    def test_skips_existing_scope_and_legacy_meaning_reviews(self):
        ids = self.prep['assessmentGroups'][0]['recordIds']
        with sqlite3.connect(self.db) as db:
            db.execute('INSERT INTO catalogue_record_scope_review VALUES (?,?,?,?)', (ids[0], 'group-0', '{}', 'old'))
            db.execute('INSERT INTO catalogue_meaning_review VALUES (?,?,?)', ('candidate', ids[1], '{}'))
        bundles = self.bundles()
        self.assertEqual(len(bundles), 2)
        self.assertNotIn('group-0', [b['groupId'] for b in bundles])

    def test_atomic_round_and_idempotent_replay(self):
        results = [self.result(b) for b in self.bundles()]
        self.assertEqual(p.merge(self.db, results, 101)['newScopeReviews'], 6)
        self.assertEqual(p.merge(self.db, results, 99999)['newScopeReviews'], 0)
        results[0]['recordReviews'][0]['reason'] = 'Changed conflicting content'
        with self.assertRaisesRegex(ValueError, 'Conflicting replay'):
            p.merge(self.db, results, 102)
        self.assertEqual(self.count(), 6)

    def test_invalid_last_worker_rolls_back_entire_round(self):
        results = [self.result(b) for b in self.bundles()]
        results[-1]['recordReviews'][0]['importReady'] = True
        with self.assertRaises(ValueError):
            p.merge(self.db, results, 101)
        self.assertEqual(self.count(), 0)

    def test_sibling_results_allow_independent_checkpoint_progress(self):
        results = [self.result(b) for b in self.bundles()]
        p.merge(self.db, results[:1], 101)
        with sqlite3.connect(self.db) as db:
            db.execute("UPDATE assessment_meta SET value='new-checkpoint' WHERE key='latest_editorial_checkpoint'")
        p.merge(self.db, results[1:], 102)
        self.assertEqual(self.count(), 6)

    def test_concurrent_review_never_overwritten(self):
        result = self.result(self.bundles()[0])
        rid = result['recordReviews'][0]['recordId']
        with sqlite3.connect(self.db) as db:
            db.execute('INSERT INTO catalogue_meaning_review VALUES (?,?,?)', ('concurrent', rid, '{"preserve":true}'))
        with self.assertRaisesRegex(ValueError, 'reviewed after assignment'):
            p.merge(self.db, [result], 101)
        self.assertEqual(self.count(), 0)

    def test_expired_assignment_and_reissue(self):
        first = self.bundles()[0]
        with self.assertRaisesRegex(ValueError, 'expired'):
            p.merge(self.db, [self.result(first)], 4000)
        newer = p.prepare(self.db, self.prep, self.out, coordinator='test-run', now=4000)
        self.assertNotEqual(first['assignmentId'], json.loads(Path(newer['assignments'][0]).read_text())['assignmentId'])

    def test_source_tampering_rejected_before_dispatch_and_merge(self):
        result = self.result(self.bundles()[0])
        with sqlite3.connect(self.db) as db:
            db.execute("UPDATE words SET text='tampered' WHERE wordId=0")
        with self.assertRaisesRegex(ValueError, 'source row changed'):
            p.prepare(self.db, self.prep, self.out, coordinator='test-run', now=101)
        with self.assertRaisesRegex(ValueError, 'Source row changed'):
            p.merge(self.db, [result], 101)

    def test_changed_policy_blocks_dispatch_and_merge(self):
        result = self.result(self.bundles()[0])
        with sqlite3.connect(self.db) as db:
            db.execute("UPDATE assessment_meta SET value='{}' WHERE key='learner_scope_override'")
        with self.assertRaisesRegex(ValueError, 'policy'):
            p.prepare(self.db, self.prep, self.out, coordinator='test-run', now=101)
        with self.assertRaisesRegex(ValueError, 'policy'):
            p.merge(self.db, [result], 101)

    def test_worker_cannot_finalize_semantic_decisions(self):
        result = self.result(self.bundles()[0])
        result['recordReviews'][0]['scopeDecisionFinal'] = True
        with self.assertRaisesRegex(ValueError, 'finalize'):
            p.merge(self.db, [result], 101)
        self.assertEqual(self.count(), 0)

    def test_bindings_coverage_and_duplicate_rejected(self):
        result = self.result(self.bundles()[0])
        mutations = [lambda r: r.update(bundleHash='bad'),
                     lambda r: r['recordReviews'].pop(),
                     lambda r: r['recordReviews'].__setitem__(1, r['recordReviews'][0]),
                     lambda r: r['recordReviews'][0].update(scopePolicyId='old'),
                     lambda r: r['recordReviews'][0].update(sourceRecordHash='bad')]
        for mutate in mutations:
            bad = copy.deepcopy(result)
            mutate(bad)
            with self.assertRaises(ValueError):
                p.merge(self.db, [bad], 101)
        self.assertEqual(self.count(), 0)


if __name__ == '__main__':
    unittest.main()
