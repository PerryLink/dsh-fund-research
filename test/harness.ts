/**
 * Shared test harness: REAL Cordis `Context`, REAL `SessionStore`/`Session`
 * rooted in a per-mount temp workspace, the REAL storage seam (dsh-storage +
 * in-memory backend + the REAL DomainFacility), the REAL ToolRuntime, the
 * REAL LocalJobRegistry, and a structural systemPrompt stub. Nothing here is
 * a hand-written mock of a service the plugin consumes; the network layer is
 * replaced only by loading fixture bytes through the plugin's own parsers.
 * @module dsh-fund-research/test/harness
 */

import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import SessionStore, { SessionId, type Session } from '@deepseek-ai/dsh-session'
import Storage from '@deepseek-ai/dsh-storage'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import LocalJobRegistry from '@deepseek-ai/dsh-jobs-local'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { MemoryStorageBackend } from './helpers/memory-backend.ts'

/** Everything a mounted base hands back to a test. */
export interface BaseHarness {
  /** The mounting context (sessions + storage domain + tools + jobs). */
  readonly ctx: Context
  /** A real session created on the mounted store, cwd = the temp workspace. */
  readonly session: Session
  /** A structurally complete agent pointing at the session. */
  readonly agent: Agent
  /** The temp workspace root (owned by the caller; deleted on teardown). */
  readonly workspace: string
  /** The in-memory storage backend. */
  readonly backend: MemoryStorageBackend
}

/** Build a structurally complete fake agent over a real session. */
function makeAgent(session: Session, scopeCtx: Context): Agent {
  const fake = {
    id: session.id,
    options: { provider: 'deepseek', model: 'demo-model' },
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle' as const,
    ctx: scopeCtx,
    send: () => undefined,
    followup: () => undefined,
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => undefined,
    cancel: () => undefined,
    runMaintenance: async <T>(task: (signal: AbortSignal) => Promise<T>) => task(new AbortController().signal),
    whenIdle: async () => undefined,
  }
  return fake as unknown as Agent
}

/**
 * Mount the real services the plugin consumes, plus a real session and agent
 * scoped to a fresh temp workspace.
 * @param sessionId - session id to create.
 * @param options - `jobs: false` omits the job registry (for the review-skip path).
 * @returns the mounted base.
 */
export async function mountBase(sessionId = 'fund-harness', options: { jobs?: boolean } = {}): Promise<BaseHarness> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  const workspace = await mkdtemp(path.join(tmpdir(), 'fund-test-'))
  const session = ctx.sessions.create(SessionId(sessionId), { meta: { cwd: workspace } })
  await ctx.plugin(Storage)
  const backend = new MemoryStorageBackend()
  ctx.storage.backend.register('memory', backend)
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)
  ctx.provide('systemPrompt', { tools: () => () => undefined, section: () => () => undefined, context: () => () => undefined } as never)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  if (options.jobs !== false) {
    await ctx.plugin(LocalJobRegistry)
    ctx.jobs.attachController('test-harness')
  }
  const agentCtx = ctx.plugin(() => {}).ctx
  const agent = makeAgent(session, agentCtx)
  ctx.agents.register(agent)
  return { ctx, session, agent, workspace, backend }
}

/** Remove the temp workspace a base was mounted on (only own mkdtemp dirs). */
export async function unmountBase(base: BaseHarness): Promise<void> {
  const expected = path.join(tmpdir(), 'fund-test-')
  const resolved = path.resolve(base.workspace)
  if (!resolved.toLowerCase().startsWith(path.resolve(expected).toLowerCase())) {
    throw new Error(`refusing to remove non-harness dir: ${base.workspace}`)
  }
  // The async fund-review job appends review-note.md after the report seals,
  // racing teardown: its O_CREAT append can re-create a file between the
  // recursive unlink pass and the final rmdir (ENOTEMPTY on Linux). Retry
  // briefly to close that window.
  for (let attempt = 0; ; attempt++) {
    try {
      await rm(resolved, { recursive: true, force: true })
      return
    } catch (error) {
      if (attempt >= 20) throw error
      await new Promise(resolve => setTimeout(resolve, 25))
    }
  }
}
