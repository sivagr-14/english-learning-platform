import copy
import importlib.util
import json
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
import sqlite3
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('queue',Path(__file__).with_name('catalogue-work-queue.py'))
q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)

def concurrent_claim(args):
    return q.claim(*args,now=100)

class QueueTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.path=str(Path(self.tmp.name)/'queue.sqlite')
        records=[]
        for i in range(8):
            source={'wordId':i,'text':'synthetic test '+str(i)}
            records.append({'recordId':'wordup-'+('a'*16)+'-'+str(i),'recordHash':q.digest(source),'source':source})
        self.prep={'source':{'sha256':'a'*64,'recordCount':8},'records':records,
                   'assessmentGroups':[{'groupId':'group-'+str(i),'recordIds':[r['recordId']]} for i,r in enumerate(records)]}
        self.prep['preparationHash']=q.digest(self.prep)
        q.initialize(self.path,self.prep,'checkpoint-25')
    def result(self,a):
        return dict(a,recordReviews=[{'recordId':rid,'scopeDecision':'hold','reason':'Requires individual linguistic assessment'} for rid in a['recordIds']])
    def test_concurrent_claims_are_disjoint_and_limited_to_three(self):
        with ProcessPoolExecutor(max_workers=8) as pool:
            results=list(pool.map(concurrent_claim,[(self.path,str(i)) for i in range(8)]))
        claimed=[r for r in results if r]
        self.assertEqual(len(claimed),3)
        self.assertEqual(len({r['groupId'] for r in claimed}),3)
    def test_same_worker_reuses_live_assignment(self):
        a=q.claim(self.path,'worker',now=100)
        self.assertEqual(a,q.claim(self.path,'worker',now=110))
    def test_expired_worker_cannot_submit_after_reassignment(self):
        a=q.claim(self.path,'old',30,100)
        b=q.claim(self.path,'new',30,131)
        self.assertEqual(a['groupId'],b['groupId'])
        with self.assertRaises(ValueError):q.submit(self.path,self.result(a),132)
        q.submit(self.path,self.result(b),132)
    def test_expired_lease_rejected_without_reassignment(self):
        a=q.claim(self.path,'worker',30,100)
        with self.assertRaises(ValueError):q.submit(self.path,self.result(a),131)
    def test_identical_replay_is_safe_conflict_is_rejected(self):
        a=q.claim(self.path,'worker',now=100);r=self.result(a)
        h=q.submit(self.path,r,101)
        self.assertEqual(h,q.submit(self.path,r,9999))
        r['recordReviews'][0]['reason']='Different conflicting decision'
        with self.assertRaises(ValueError):q.submit(self.path,r,102)
    def test_each_binding_is_checked(self):
        a=q.claim(self.path,'worker',now=100)
        for field in ['preparationHash','sourceHash','policyId','recordIds','baseCheckpoint','worker','leaseToken']:
            r=self.result(a);r[field]='wrong'
            with self.subTest(field=field),self.assertRaises(ValueError):q.submit(self.path,r,101)
        self.assertEqual(q.status(self.path)['workQueue'],{'leased':1,'pending':7})
    def test_record_coverage_and_reason_required(self):
        a=q.claim(self.path,'worker',now=100)
        for reviews in [[],[{'recordId':'other','scopeDecision':'hold','reason':'valid explanation'}],
                        [{'recordId':a['recordIds'][0],'scopeDecision':'hold','reason':''}]]:
            with self.assertRaises(ValueError):q.submit(self.path,dict(a,recordReviews=reviews),101)
    def test_scope_exclusion_cannot_claim_exhaustive_review(self):
        a=q.claim(self.path,'worker',now=100);r=self.result(a)
        r['recordReviews'][0].update(scopeDecision='scope_excluded',scopeExclusionCode='basic_obvious',additionalMeaningsReviewed=True)
        with self.assertRaises(ValueError):q.submit(self.path,r,101)
        r['recordReviews'][0]['additionalMeaningsReviewed']=False
        q.submit(self.path,r,101)
    def test_requeue_retains_prior_artifact_and_fences_old_token(self):
        a=q.claim(self.path,'worker',now=100);r=self.result(a);q.submit(self.path,r,101)
        q.requeue(self.path,a['groupId'],'checkpoint-26','Resolve remaining sense evidence',102)
        b=q.claim(self.path,'worker',now=103)
        self.assertEqual(b['baseCheckpoint'],'checkpoint-26')
        with self.assertRaises(ValueError):q.submit(self.path,r,104)
        with sqlite3.connect(self.path) as db:
            history=json.loads(db.execute("SELECT details FROM events WHERE action='requeue'").fetchone()[0])
        self.assertEqual(json.loads(history['previous']['result_json']),r)
    def test_init_is_idempotent_and_preserves_progress(self):
        a=q.claim(self.path,'worker',now=100)
        q.initialize(self.path,self.prep,'new-checkpoint-must-not-reset')
        self.assertEqual(a,q.claim(self.path,'worker',now=101))
        bad=copy.deepcopy(self.prep);bad['records'][0]['source']['text']='tampered'
        with self.assertRaises(ValueError):q.initialize(self.path,bad,'checkpoint-26')
    def test_invalid_group_partition_and_record_hash_rejected(self):
        for field in ['group','record']:
            bad=copy.deepcopy(self.prep);bad.pop('preparationHash')
            if field=='group':bad['assessmentGroups'][1]['recordIds']=bad['assessmentGroups'][0]['recordIds']
            else:bad['records'][0]['source']['text']='changed'
            bad['preparationHash']=q.digest(bad)
            with self.assertRaises(ValueError):q.initialize(self.path,bad,'checkpoint-25')
    def test_submission_never_claims_assessment_or_import_completion(self):
        q.submit(self.path,self.result(q.claim(self.path,'worker',now=100)),101)
        s=q.status(self.path)
        self.assertEqual(s['workQueue']['submitted'],1)
        self.assertFalse(s['importsVerified'])
        self.assertEqual(s['assessmentCompletion'],'not established by work queue')

if __name__=='__main__':unittest.main()
