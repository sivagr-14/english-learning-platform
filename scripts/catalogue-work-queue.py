#!/usr/bin/env python3
"""Private, transactional work assignments. Never an assessment/import validator."""
import argparse
import hashlib
import json
import sqlite3
import time
import uuid
from contextlib import contextmanager

POLICY = 'wordup-useful-b1-c2-20261024'

def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(',', ':')).encode()).hexdigest()

@contextmanager
def transaction(path):
    db = sqlite3.connect(path, timeout=30)
    db.row_factory = sqlite3.Row
    try:
        db.execute('BEGIN IMMEDIATE')
        yield db
        db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()

def initialize(path, preparation, checkpoint):
    if not isinstance(checkpoint, str) or not checkpoint.strip():
        raise ValueError('A verified durable checkpoint identity is required')
    payload = dict(preparation)
    expected = payload.pop('preparationHash')
    if digest(payload) != expected:
        raise ValueError('Preparation hash mismatch')
    records = preparation['records']
    ids = [r['recordId'] for r in records]
    source_hash = preparation['source']['sha256']
    if len(ids) != len(set(ids)) or len(ids) != preparation['source']['recordCount']:
        raise ValueError('Record count/identity mismatch')
    for record in records:
        if (digest(record['source']) != record['recordHash'] or
            record['recordId'] != f"wordup-{source_hash[:16]}-{record['source']['wordId']}"):
            raise ValueError('Source record integrity mismatch')
    groups = preparation['assessmentGroups']
    grouped = [i for g in groups for i in g['recordIds']]
    if (len(grouped) != len(ids) or set(grouped) != set(ids) or
        len({g['groupId'] for g in groups}) != len(groups) or
        any(not 1 <= len(g['recordIds']) <= 100 for g in groups)):
        raise ValueError('Groups must partition all records, at most 100 per group')
    with transaction(path) as db:
        db.execute('CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
        db.execute('''CREATE TABLE IF NOT EXISTS jobs (
          group_id TEXT PRIMARY KEY, ordinal INTEGER UNIQUE NOT NULL, record_ids TEXT NOT NULL,
          checkpoint TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
          worker TEXT, token TEXT, expires REAL, result_hash TEXT, result_json TEXT)''')
        db.execute('''CREATE TABLE IF NOT EXISTS events (
          seq INTEGER PRIMARY KEY, at REAL NOT NULL, group_id TEXT, action TEXT NOT NULL, details TEXT NOT NULL)''')
        binding = {'preparationHash': expected, 'sourceHash': source_hash, 'policyId': POLICY}
        previous = dict(db.execute('SELECT key,value FROM metadata'))
        if previous:
            if previous != binding:
                raise ValueError('Queue already bound to another source or policy')
            return  # Idempotent init must not reset leases, results or checkpoint revisions.
        db.executemany('INSERT INTO metadata VALUES (?,?)', binding.items())
        db.executemany('INSERT INTO jobs (group_id,ordinal,record_ids,checkpoint) VALUES (?,?,?,?)',
                       [(g['groupId'], n, json.dumps(g['recordIds']), checkpoint) for n,g in enumerate(groups)])

def event(db, group, action, details, now):
    db.execute('INSERT INTO events (at,group_id,action,details) VALUES (?,?,?,?)',
               (now, group, action, json.dumps(details, sort_keys=True)))

def claim(path, worker, seconds=1800, now=None):
    now = time.time() if now is None else now
    if not worker.strip() or not 30 <= seconds <= 3600:
        raise ValueError('Named worker and lease of 30–3600 seconds required')
    with transaction(path) as db:
        active = db.execute("SELECT * FROM jobs WHERE state='leased' AND expires>?", (now,)).fetchall()
        own = [r for r in active if r['worker'] == worker]
        if own:
            return assignment(db, own[0])
        if len(active) >= 3:
            return None
        row = db.execute("SELECT * FROM jobs WHERE state='pending' OR (state='leased' AND expires<=?) ORDER BY ordinal LIMIT 1", (now,)).fetchone()
        if row is None:
            return None
        token = uuid.uuid4().hex
        db.execute("UPDATE jobs SET state='leased',worker=?,token=?,expires=? WHERE group_id=?",
                   (worker,token,now+seconds,row['group_id']))
        event(db,row['group_id'],'claim',{'worker':worker,'token':token},now)
        return assignment(db, db.execute('SELECT * FROM jobs WHERE group_id=?',(row['group_id'],)).fetchone())

def assignment(db, row):
    return dict(dict(db.execute('SELECT key,value FROM metadata')),
                groupId=row['group_id'], recordIds=json.loads(row['record_ids']),
                baseCheckpoint=row['checkpoint'], worker=row['worker'],
                leaseToken=row['token'], expires=row['expires'])

def submit(path, result, now=None):
    """Stage a worker artifact; only the coordinator calls this mutation."""
    now = time.time() if now is None else now
    checksum = digest(result)
    with transaction(path) as db:
        row = db.execute('SELECT * FROM jobs WHERE group_id=?',(result['groupId'],)).fetchone()
        if row is None:
            raise ValueError('Unknown group')
        if row['state'] == 'submitted' and row['result_hash'] == checksum:
            return checksum
        if row['state'] != 'leased' or row['expires'] <= now:
            raise ValueError('No live lease; resubmit against a fresh assignment')
        bound = assignment(db,row)
        for key in ['preparationHash','sourceHash','policyId','groupId','recordIds','baseCheckpoint','worker','leaseToken']:
            if result.get(key) != bound[key]:
                raise ValueError('Stale or mismatched assignment: '+key)
        reviews = result.get('recordReviews')
        if not isinstance(reviews,list) or len(reviews) != len(bound['recordIds']):
            raise ValueError('Exactly one worker review per assigned record required')
        seen = set()
        for review in reviews:
            rid = review.get('recordId')
            if rid not in bound['recordIds'] or rid in seen:
                raise ValueError('Unassigned or duplicate record')
            seen.add(rid)
            if review.get('scopeDecision') not in ['retain','scope_excluded','rejected','hold']:
                raise ValueError('Explicit scope decision required')
            if not isinstance(review.get('reason'),str) or len(review['reason'].strip()) < 8:
                raise ValueError('Specific per-record reason required')
            if review['scopeDecision']=='scope_excluded' and (
                review.get('scopeExclusionCode') not in ['basic_obvious','predictable_combination'] or
                review.get('additionalMeaningsReviewed') is not False):
                raise ValueError('Scope exclusion must not claim exhaustive sense review')
        db.execute("UPDATE jobs SET state='submitted',result_hash=?,result_json=? WHERE group_id=?",
                   (checksum,json.dumps(result,ensure_ascii=False,sort_keys=True),row['group_id']))
        event(db,row['group_id'],'submit',{'resultHash':checksum},now)
    return checksum

def requeue(path, group, checkpoint, reason, now=None):
    """Coordinator invalidates prior leases; immutable event history retains results."""
    if not checkpoint.strip() or len(reason.strip()) < 8:
        raise ValueError('Checkpoint and explicit retry reason required')
    now = time.time() if now is None else now
    with transaction(path) as db:
        row=db.execute('SELECT * FROM jobs WHERE group_id=?',(group,)).fetchone()
        if row is None:
            raise ValueError('Unknown group')
        event(db,group,'requeue',{'reason':reason,'previous':dict(row),'nextCheckpoint':checkpoint},now)
        db.execute("UPDATE jobs SET state='pending',checkpoint=?,worker=NULL,token=NULL,expires=NULL,result_hash=NULL,result_json=NULL WHERE group_id=?",(checkpoint,group))

def status(path):
    with transaction(path) as db:
        counts=dict(db.execute('SELECT state,count(*) FROM jobs GROUP BY state'))
        return {'workQueue':counts,'assessmentCompletion':'not established by work queue',
                'importsVerified':False,'nextGroup':(dict(db.execute("SELECT group_id,checkpoint FROM jobs WHERE state!='submitted' ORDER BY ordinal LIMIT 1").fetchone() or {}))}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', required=True)
    sub=parser.add_subparsers(dest='command',required=True)
    p=sub.add_parser('init');p.add_argument('preparation');p.add_argument('checkpoint')
    p=sub.add_parser('claim');p.add_argument('worker');p.add_argument('--seconds',type=int,default=1800)
    p=sub.add_parser('submit');p.add_argument('result')
    p=sub.add_parser('requeue');p.add_argument('group');p.add_argument('checkpoint');p.add_argument('reason')
    sub.add_parser('status')
    args=parser.parse_args()
    if args.command=='init':
        with open(args.preparation) as f: initialize(args.db,json.load(f),args.checkpoint)
        output=status(args.db)
    elif args.command=='claim': output=claim(args.db,args.worker,args.seconds)
    elif args.command=='submit':
        with open(args.result) as f: output={'stagedResultHash':submit(args.db,json.load(f))}
    elif args.command=='requeue':
        requeue(args.db,args.group,args.checkpoint,args.reason);output=status(args.db)
    else: output=status(args.db)
    print(json.dumps(output,ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
