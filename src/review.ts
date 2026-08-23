/**
 * Read-only review stage for the `fund-report` pipeline: after sealing, a
 * `fund-review` background job performs a deterministic, code-only review of
 * the sealed artifacts (gap-declaration completeness, disclaimer presence, and
 * a re-verification of the traceability table against the sealed snapshot) and
 * writes `review-note.md` into the version directory. No model and no network
 * are involved; the review is scheduled only through the optional `ctx.jobs`
 * service, and skips gracefully when it is absent.
 * @module dsh-fund-research/review
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { FundSnapshot, ReportManifest } from './model.ts'
import { fundSnapshotSchema } from './store.ts'
import { buildBody, DISCLAIMER } from './report.ts'
import { builtinVerifyCitations } from './verify-bridge.ts'

/** The background-job kind this reviewer registers (declaration-merged into JobKindMap). */
export const FUND_REVIEW_JOB_KIND = 'fund-review' as const

declare module '@deepseek-ai/dsh-jobs' {
  interface JobKindMap {
    'fund-review': typeof FUND_REVIEW_JOB_KIND
  }
}

/** The deterministic checks the review produces. */
export interface ReviewChecks {
  disclaimerPresent: boolean
  gapDeclared: { declared: string[], missing: string[] }
  traceTally: { verified: number, mismatch: number, notFound: number, unverifiable: number }
}

/**
 * Review one sealed report directory read-only: parse the sealed snapshot,
 * manifest, and report, run the deterministic checks, and write review-note.md.
 * @param versionDir - absolute version directory holding snapshot/report/manifest.
 * @returns the review-note markdown and the check results.
 */
export async function reviewSealedReport(versionDir: string): Promise<{ markdown: string, checks: ReviewChecks }> {
  const snapshotText = await readFile(path.join(versionDir, 'snapshot.json'), 'utf8')
  const snapshot = fundSnapshotSchema.parse(JSON.parse(snapshotText)) as FundSnapshot
  const manifest = JSON.parse(await readFile(path.join(versionDir, 'manifest.json'), 'utf8')) as ReportManifest
  const reportText = await readFile(path.join(versionDir, 'report.md'), 'utf8')

  const disclaimerPresent = reportText.includes(DISCLAIMER)
  const gapDeclared = { declared: [] as string[], missing: [] as string[] }
  for (const gap of manifest.gaps) {
    if (reportText.includes(`缺口：${gap}`)) gapDeclared.declared.push(gap)
    else gapDeclared.missing.push(gap)
  }

  const body = buildBody(snapshot)
  const result = await builtinVerifyCitations({
    dataset: path.join(versionDir, 'snapshot.json'),
    citations: body.citations.map(citation => ({
      id: citation.id,
      path: citation.path,
      value: citation.value,
      tolerance: citation.tolerance,
    })),
  })
  const traceTally = { verified: 0, mismatch: 0, notFound: 0, unverifiable: 0 }
  for (const entry of result.results) {
    if (entry.status === 'verified') traceTally.verified++
    else if (entry.status === 'mismatch') traceTally.mismatch++
    else if (entry.status === 'not-found') traceTally.notFound++
    else traceTally.unverifiable++
  }

  const checks: ReviewChecks = { disclaimerPresent, gapDeclared, traceTally }
  const markdown = renderReviewNote(manifest, checks)
  await writeFile(path.join(versionDir, 'review-note.md'), markdown, 'utf8')
  return { markdown, checks }
}

/** Render the review-note markdown from the manifest and the check results. */
export function renderReviewNote(manifest: ReportManifest, checks: ReviewChecks): string {
  const declared = checks.gapDeclared.declared.length === 0 ? '无' : checks.gapDeclared.declared.join('、')
  const missing = checks.gapDeclared.missing.length === 0 ? '无' : checks.gapDeclared.missing.join('、')
  return [
    '# 复核审阅记录（review-note）',
    '',
    '> 只读复核：不改动封存的 snapshot.json / report.md / manifest.json，仅新写本 review-note.md。',
    '',
    '审查清单（代码确定性复核，无模型参与、无网络）：',
    '',
    `- 缺口声明完整性：${checks.gapDeclared.missing.length === 0 ? 'PASS' : 'FAIL'}；已声明 ${declared}；缺失 ${missing}`,
    `- 免责声明：${checks.disclaimerPresent ? 'PASS' : 'FAIL（report.md 未含免责声明）'}`,
    `- 数字回溯表一致性：核查引擎 ${manifest.verifyEngine}；重核 verified ${checks.traceTally.verified} / mismatch ${checks.traceTally.mismatch} / not-found ${checks.traceTally.notFound} / unverifiable ${checks.traceTally.unverifiable}`,
    '',
    `复核对象：${manifest.code} ${manifest.name}，版本 ${manifest.version}，报告 sha256 ${manifest.reportSha256}。`,
    '',
    '> 仅供研究参考，不构成投资建议。',
  ].join('\n')
}
