// Keeps one idle container per workspace, so terminal commands and test runs
// use `docker exec` (a fraction of a second) instead of starting a container
// (two seconds or more) every time. Each command still starts from a fresh
// copy of the workspace, with no network, and an idle container is removed
// after ten minutes.
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {exclusive} from './locks.mjs';

const IDLE_MS = 10 * 60000;
const PREFIX = 'dg-warm-';
// Empties /work, including dotfiles, before each command copies the workspace in.
export const RESET_WORK = 'rm -rf /work/* /work/.[!.]* /work/..?* 2>/dev/null; true';

export function sandboxPool(run) {
  const pool = new Map();
  let reaper = null;

  const remove = name => run('docker', ['rm', '-f', name], {timeout: 15000}).catch(() => {});
  function startReaper() {
    if (reaper) return;
    reaper = setInterval(() => {
      for (const [key, box] of pool) if (Date.now() - box.lastUsed > IDLE_MS) { pool.delete(key); remove(box.name); }
    }, 60000);
    reaper.unref();
  }

  async function start(spec) {
    const name = PREFIX + randomUUID();
    const args = ['run', '-d', '--rm', '--name', name, '--network', 'none', '--memory', spec.memory || '1g', '--cpus', '2', '--pids-limit', '256',
      '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', ...(spec.writable ? [] : ['--read-only']),
      '--tmpfs', '/tmp:rw,exec,nosuid,size=256m', '--tmpfs', '/work:rw,exec,nosuid,size=768m', '-e', 'HOME=/tmp', '-e', 'PYTHONDONTWRITEBYTECODE=1',
      ...spec.mounts.flatMap(m => ['--mount', `type=bind,source=${m.source},target=${m.target},readonly`]),
      '--entrypoint', '/bin/sh', spec.image, '-c', 'trap "exit 0" TERM INT; while :; do sleep 3600 & wait $!; done'];
    const result = await run('docker', args, {timeout: 60000});
    if (result.code !== 0) throw new Error('The sandbox could not start: ' + result.output.slice(-300));
    return name;
  }

  // spec: {key, image, mounts: [{source, target}], memory}. Commands for one
  // workspace run one at a time, because each one resets /work.
  async function exec(spec, script, {timeout = 120000, env = {}} = {}) {
    startReaper();
    return exclusive(`warm:${spec.key}`, async () => {
      const signature = JSON.stringify([spec.image, spec.mounts, spec.memory, !!spec.writable]);
      let box = pool.get(spec.key);
      if (box && box.signature !== signature) { pool.delete(spec.key); remove(box.name); box = null; }
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!box) { box = {name: await start(spec), signature, lastUsed: Date.now()}; pool.set(spec.key, box); }
        const started = Date.now();
        box.lastUsed = started;
        const result = await run('docker', ['exec', ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), box.name, '/bin/sh', '-c', script], {timeout});
        box.lastUsed = Date.now();
        // A command that ran out of time may still be running inside: replace the container.
        if (result.timedOut) { pool.delete(spec.key); remove(box.name); return {...result, ms: Date.now() - started}; }
        if (result.code !== 0 && result.output.includes(box.name) && /No such container|is not running/i.test(result.output)) { pool.delete(spec.key); box = null; continue; }
        return {...result, ms: Date.now() - started};
      }
      throw new Error('The sandbox container stopped unexpectedly. Try again.');
    });
  }

  // Removes containers left over from an earlier run of the app.
  async function cleanup() {
    const listed = await run('docker', ['ps', '-aq', '--filter', `name=${PREFIX}`], {timeout: 15000}).catch(() => null);
    const ids = listed?.code === 0 ? listed.output.split(/\s+/).filter(id => /^[a-f0-9]{6,64}$/.test(id)) : [];
    if (ids.length) await run('docker', ['rm', '-f', ...ids], {timeout: 30000}).catch(() => {});
  }
  function stopAll() {
    for (const box of pool.values()) spawnSync('docker', ['rm', '-f', box.name], {timeout: 8000, windowsHide: true});
    pool.clear();
  }
  // Under the workspace's lock, so a command running right now finishes first
  // instead of finding its container gone and starting a replacement.
  const forget = key => exclusive(`warm:${key}`, async () => { const box = pool.get(key); if (box) { pool.delete(key); await remove(box.name); } }).catch(() => {});

  return {exec, cleanup, stopAll, forget, size: () => pool.size};
}
