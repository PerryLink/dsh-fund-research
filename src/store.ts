/**
 * Durable snapshot storage over the harness storage domain. The
 * `dsh_fund_research` domain keeps the latest acquired snapshot per fund code,
 * so offline mode and cache-TTL reuse never touch the network. Record schemas
 * are zod (the domain layer validates on open, so a corrupted store fails
 * loud at first read instead of poisoning a report).
 * @module dsh-fund-research/store
 */

import z from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { FundSnapshot } from './model.ts'

/** Zod schema for {@link SourceProvenance}. */
const provenanceSchema = z.object({
  url: z.string(),
  sha256: z.string(),
  fetchedAt: z.number(),
  ok: z.boolean(),
  error: z.string().optional(),
})

/** Zod schema for one {@link NavPoint}. */
const navPointSchema = z.object({
  t: z.number(),
  nav: z.number(),
  dailyReturn: z.number(),
})

/** Zod schema for the raw extracted sections. */
const rawSchema = z.object({
  fees: z.object({
    sourceRate: z.string(),
    rate: z.string(),
    minSubscription: z.string(),
  }),
  returns: z.object({
    month1: z.string(),
    month3: z.string(),
    month6: z.string(),
    year1: z.string(),
  }),
  navTrend: z.array(navPointSchema),
  manager: z.object({
    name: z.string(),
    star: z.number(),
    workTime: z.string(),
    fundSize: z.string(),
    powerAvr: z.string(),
    powerCategories: z.array(z.string()),
    powerData: z.array(z.number()),
    powerAsOf: z.string(),
    profitCategories: z.array(z.string()),
    profitValues: z.array(z.number()),
    profitAsOf: z.string(),
  }),
  performanceEvaluation: z.object({
    avr: z.string(),
    categories: z.array(z.string()),
    data: z.array(z.number()),
  }),
  scaleHistory: z.object({
    dates: z.array(z.string()),
    values: z.array(z.number()),
  }),
  assetAllocation: z.object({
    dates: z.array(z.string()),
    stockPct: z.array(z.number()),
    bondPct: z.array(z.number()),
    cashPct: z.array(z.number()),
    netAsset: z.array(z.number()),
  }),
  holdings: z.object({
    asOf: z.string(),
    rows: z.array(z.object({
      rank: z.number(),
      code: z.string(),
      name: z.string(),
      navPct: z.number(),
      shares10k: z.number(),
      marketValue10k: z.number(),
    })),
    previousAsOf: z.string().nullable(),
    previousRows: z.array(z.object({
      rank: z.number(),
      code: z.string(),
      name: z.string(),
      navPct: z.number(),
      shares10k: z.number(),
      marketValue10k: z.number(),
    })),
  }).nullable(),
  managerHistory: z.object({
    tenures: z.array(z.object({
      start: z.string(),
      end: z.string().nullable(),
      managers: z.array(z.string()),
      durationText: z.string(),
      returnPct: z.number(),
    })),
    managedFunds: z.array(z.object({
      code: z.string(),
      name: z.string(),
      fundType: z.string(),
      start: z.string(),
      end: z.string().nullable(),
      durationText: z.string(),
      returnPct: z.number(),
      peerAvgPct: z.number(),
      peerRank: z.number(),
      peerTotal: z.number(),
    })),
  }).nullable(),
  quotes: z.object({
    fetchedAt: z.number(),
    rows: z.record(z.string(), z.object({
      code: z.string(),
      name: z.string(),
      totalMarketCap: z.number(),
      peDynamic: z.number(),
      pb: z.number(),
    })),
  }).nullable(),
})

/** Zod schema for the computed metrics block. */
const computedSchema = z.object({
  performance: z.object({
    latestNav: z.number(),
    latestDate: z.string(),
    windows: z.array(z.object({
      label: z.string(),
      start: z.string(),
      end: z.string(),
      days: z.number(),
      periodReturnPct: z.number(),
      annualizedReturnPct: z.number(),
      volatilityPct: z.number(),
      maxDrawdownPct: z.number(),
      maxDrawdownPeak: z.string(),
      maxDrawdownTrough: z.string(),
      sharpe: z.number(),
    })),
  }),
  holdings: z.object({
    top3Pct: z.number(),
    top10Pct: z.number(),
    hhi: z.number(),
    industryPct: z.record(z.string(), z.number()),
    quarterCompare: z.object({
      kept: z.array(z.string()),
      added: z.array(z.string()),
      removed: z.array(z.string()),
    }).nullable(),
  }).nullable(),
  style: z.object({
    rows: z.array(z.object({
      code: z.string(),
      name: z.string(),
      navPct: z.number(),
      marketCapYi: z.number(),
      sizeBand: z.string(),
      sizeQuintile: z.number(),
      valueBand: z.string(),
      peDynamic: z.number(),
      pb: z.number(),
    })),
    sizeDistribution: z.record(z.string(), z.number()),
    valueDistribution: z.record(z.string(), z.number()),
    coverage: z.string(),
  }).nullable(),
  manager: z.object({
    tenureStart: z.string().nullable(),
    tenureDurationText: z.string().nullable(),
    tenureReturnPct: z.number().nullable(),
    managedFundCount: z.number().nullable(),
    beatPeerCount: z.number().nullable(),
    profitComparison: z.array(z.object({
      label: z.string(),
      valuePct: z.number(),
    })),
  }),
  benchmark: z.object({
    tenureReturnPct: z.number().nullable(),
    rows: z.array(z.object({
      label: z.string(),
      valuePct: z.number(),
      fundPct: z.number(),
      excessPct: z.number(),
    })),
    peerRank: z.object({
      managedFundCount: z.number(),
      beatPeerCount: z.number(),
      avgRank: z.number().nullable(),
      avgTotal: z.number().nullable(),
    }).nullable(),
  }),
})

/** Zod schema for one full {@link FundSnapshot}. */
export const fundSnapshotSchema = z.object({
  schema: z.literal('dsh-fund-research/snapshot@v1'),
  code: z.string(),
  name: z.string(),
  fetchedAt: z.number(),
  sources: z.object({
    pingzhongdata: provenanceSchema,
    holdings: provenanceSchema,
    managerHistory: provenanceSchema,
    quotes: provenanceSchema,
  }),
  raw: rawSchema,
  computed: computedSchema,
  parameters: z.object({
    riskFreeRate: z.number(),
    tradingDaysPerYear: z.number(),
    calendarDaysPerYear: z.number(),
  }),
  gaps: z.array(z.string()),
  asOf: z.string().optional(),
})

/** The stored record: the snapshot plus its acquisition time for TTL reuse. */
export interface SnapshotRecord {
  code: string
  storedAt: number
  snapshot: FundSnapshot
}

/** Zod schema for {@link SnapshotRecord}. */
export const snapshotRecordSchema = z.object({
  code: z.string(),
  storedAt: z.number(),
  snapshot: fundSnapshotSchema,
})

/** The `dsh_fund_research` storage-domain declaration. */
export const fundResearchDomainSpec = defineDomain({
  name: 'dsh_fund_research',
  version: 1,
  tables: {
    snapshots: domainTable<string, SnapshotRecord>(snapshotRecordSchema),
  },
})
