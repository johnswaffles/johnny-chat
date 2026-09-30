import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

export const storyTask = new AsyncLocalStorage();
export function transientStoryError(error) {
  return [408, 409, 429, 500, 502, 503, 504].includes(error?.status)
    || ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN'].includes(error?.code)
    || /timeout|connection error|fetch failed|database is locked/i.test(error?.message || '');
}
export function createStoryQueue({ path, run, onFailure, interval = 5000, leaseMs = 45000, retryDelay = 15000 }) {
  const owner = randomUUID();
  let busy = false, stopped = false, timer;
  const controllers = new Map();
  const db = () => { const d = new DatabaseSync(path); d.exec('PRAGMA busy_timeout=5000'); return d; };
  const access = fn => { const d = db(); try { return fn(d); } finally { d.close(); } };
  const init = () => access(d => d.exec(`CREATE TABLE IF NOT EXISTS story_worker_queue (
    job_id TEXT PRIMARY KEY, state TEXT NOT NULL DEFAULT 'queued', owner TEXT,
    lease_until INTEGER NOT NULL DEFAULT 0, heartbeat INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0, available_at INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT '', auto_resume INTEGER NOT NULL DEFAULT 1
  );`));
  const enqueue = (id, explicit = false) => access(d => {
    if (explicit) d.prepare(`INSERT INTO story_worker_queue(job_id) VALUES (?) ON CONFLICT(job_id) DO UPDATE SET state='queued', attempts=0, available_at=0, last_error='' WHERE state IN ('failed','paused','completed')`).run(id);
    else d.prepare('INSERT OR IGNORE INTO story_worker_queue(job_id) VALUES (?)').run(id);
  });
  const info = id => access(d => d.prepare('SELECT * FROM story_worker_queue WHERE job_id=?').get(id));
  async function tick() {
    if (busy || stopped) return;
    busy = true;
    let task, heartbeat, controller;
    try {
      task = access(d => d.prepare(`UPDATE story_worker_queue SET state='running', owner=?, lease_until=?, heartbeat=?
        WHERE job_id=(SELECT job_id FROM story_worker_queue WHERE
          (state='queued' AND available_at<=?) OR (state='running' AND lease_until<?)
          ORDER BY available_at, rowid LIMIT 1)
        RETURNING *`).get(owner, Date.now()+leaseMs, Date.now(), Date.now(), Date.now()));
      if (!task) return;
      controller=new AbortController(); controllers.set(task.job_id,controller);
      heartbeat = setInterval(() => {
        try { const renewed=access(d => d.prepare("UPDATE story_worker_queue SET heartbeat=?,lease_until=? WHERE job_id=? AND owner=? AND state='running'").run(Date.now(),Date.now()+leaseMs,task.job_id,owner).changes); if(!renewed) controller.abort(); } catch { /* Lease expires safely if storage is unavailable. */ }
      }, Math.max(50, Math.floor(leaseMs/3)));
      await storyTask.run({jobId:task.job_id, owner, signal:controller.signal}, () => run(task.job_id));
      access(d => d.prepare("UPDATE story_worker_queue SET state='completed',lease_until=0 WHERE job_id=? AND owner=? AND state='running'").run(task.job_id,owner));
    } catch (error) {
      if (!task) { console.error('Story queue unavailable:',error.message); return; }
      if (error.code === 'STORY_LEASE_LOST') return;
      const retry = transientStoryError(error) && task.attempts < 3;
      const changed = access(d => d.prepare(`UPDATE story_worker_queue SET state=?,attempts=attempts+1,available_at=?,lease_until=0,last_error=? WHERE job_id=? AND owner=? AND state='running'`).run(retry?'queued':'failed',Date.now()+retryDelay*2**task.attempts,String(error.message).slice(0,1000),task.job_id,owner).changes);
      if (changed) await onFailure(task.job_id,error,retry);
    } finally {
      clearInterval(heartbeat);if(task) controllers.delete(task.job_id);busy = false;
    }
  }
  return { init, enqueue, info, tick,
    start() { timer=setInterval(()=>void tick(),interval); timer.unref(); void tick(); },
    stop() { stopped=true; clearInterval(timer); },
    pause(id) { controllers.get(id)?.abort(); return access(d => d.prepare("UPDATE story_worker_queue SET state='paused',lease_until=0 WHERE job_id=? AND state IN ('queued','running')").run(id).changes); }
  };
}

export function assertStoryLease(db, task = storyTask.getStore()) {
  if (!task) return;
  const row=db.prepare("SELECT 1 FROM story_worker_queue WHERE job_id=? AND owner=? AND state='running' AND lease_until>?").get(task.jobId,task.owner,Date.now());
  if (!row) {const error=new Error('The edit was paused or another worker took over. Saved progress is retained.');error.code='STORY_LEASE_LOST';throw error;}
}
