/**
 * Fixture loader: rebuilds the canonical 161725 `FundSnapshot` from the saved
 * real-response fixtures through the plugin's own parsers and metrics — the
 * same code path a live acquisition takes, with the network replaced by
 * fixture bytes. Used to seed the storage domain for offline tests.
 * @module dsh-fund-research/test/fixtures
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FundSnapshot, QuoteMap } from '../src/model.ts'
import { SNAPSHOT_SCHEMA } from '../src/model.ts'
import { parseHoldingsPage, parseManagerPage, parsePingzhongdata, parseQuote, provenanceOk, sha256Of } from '../src/sources/eastmoney.ts'
import { computeMetrics, computationParameters } from '../src/sources/snapshot.ts'

/** The fixture directory (repo `fixtures/`). */
export const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')

/** The sample fund code every fixture belongs to. */
export const FIXTURE_CODE = '161725'

/** One loaded fixture set: raw texts plus the parsed snapshot inputs. */
export interface FixtureSet {
  pingzhongdata: string
  holdings: string
  managerPage: string
  quotes: Record<string, string>
}

/** Load all fixture texts for the sample fund. */
export async function loadFixtures(): Promise<FixtureSet> {
  const [pingzhongdata, holdings, managerPage, quotesJson] = await Promise.all([
    readFile(join(FIXTURE_DIR, `pingzhongdata-${FIXTURE_CODE}.js`), 'utf8'),
    readFile(join(FIXTURE_DIR, `f10-jjcc-${FIXTURE_CODE}.html`), 'utf8'),
    readFile(join(FIXTURE_DIR, `f10-jjjl-page-${FIXTURE_CODE}.html`), 'utf8'),
    readFile(join(FIXTURE_DIR, `quotes-${FIXTURE_CODE}.json`), 'utf8'),
  ])
  const quotesRaw = JSON.parse(quotesJson) as Record<string, unknown>
  const quotes: Record<string, string> = {}
  for (const [secid, payload] of Object.entries(quotesRaw)) {
    quotes[secid] = JSON.stringify(payload)
  }
  return { pingzhongdata, holdings, managerPage, quotes }
}

/**
 * Build the canonical fixture snapshot: parse every fixture and compute the
 * deterministic metrics, exactly as a live acquisition would.
 * @param fixtures - the loaded fixture set.
 * @param fetchedAt - the acquisition stamp (fixed for determinism).
 * @returns the fund snapshot.
 */
export function buildFixtureSnapshot(fixtures: FixtureSet, fetchedAt = 1_755_600_000_000): FundSnapshot {
  const core = parsePingzhongdata(fixtures.pingzhongdata, FIXTURE_CODE)
  const holdings = parseHoldingsPage(fixtures.holdings, FIXTURE_CODE)
  const managerHistory = parseManagerPage(fixtures.managerPage, FIXTURE_CODE)
  const quoteRows: QuoteMap['rows'] = {}
  for (const [secid, text] of Object.entries(fixtures.quotes)) {
    quoteRows[secid] = parseQuote(text, secid)
  }
  const quotesText = Object.values(fixtures.quotes).join('')
  const raw: FundSnapshot['raw'] = {
    fees: core.fees,
    returns: core.returns,
    navTrend: core.navTrend,
    manager: core.manager,
    performanceEvaluation: core.performanceEvaluation,
    scaleHistory: core.scaleHistory,
    assetAllocation: core.assetAllocation,
    holdings,
    managerHistory,
    quotes: { fetchedAt, rows: quoteRows },
  }
  return {
    schema: SNAPSHOT_SCHEMA,
    code: FIXTURE_CODE,
    name: core.name,
    fetchedAt,
    sources: {
      pingzhongdata: provenanceOk(`https://fund.eastmoney.com/pingzhongdata/${FIXTURE_CODE}.js`, fixtures.pingzhongdata, fetchedAt),
      holdings: provenanceOk(`https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${FIXTURE_CODE}`, fixtures.holdings, fetchedAt),
      managerHistory: provenanceOk(`https://fundf10.eastmoney.com/jjjl_${FIXTURE_CODE}.html`, fixtures.managerPage, fetchedAt),
      quotes: { url: 'push2 per-holding quotes', sha256: sha256Of(quotesText), fetchedAt, ok: true },
    },
    raw,
    computed: computeMetrics(raw, 0.02),
    parameters: computationParameters(0.02),
    gaps: [],
  }
}
