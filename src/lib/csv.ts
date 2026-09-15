import { db } from '../db';
import {
  companies,
  people,
  opportunities,
  mergeCandidates,
} from '../db/schema';
import { eq, and, sql, or } from 'drizzle-orm';
import {
  normalizeDomain,
  normalizeCompanyName,
  computeStringSimilarity,
} from './duplicates';
import { logTimelineActivity } from './timeline';
import { runView, FilterCondition, SortCondition } from './views';

export type TargetEntity = 'companies' | 'people' | 'opportunities';

export interface ImportResult {
  totalRows: number;
  insertedCount: number;
  skippedDuplicateCount: number;
  errorCount: number;
  rows: Array<{
    rowIndex: number;
    status: 'inserted' | 'duplicate' | 'error';
    recordId?: string;
    error?: string;
    data: Record<string, string>;
  }>;
}

export interface ExportOptions {
  entityType: TargetEntity;
  viewId?: string;
  filters?: FilterCondition[];
  sortBy?: SortCondition[];
  visibleFields?: string[];
  limit?: number;
}

/**
 * Parse a raw CSV string into rows of key/value pairs.
 */
export function parseCSV(raw: string): Array<Record<string, string>> {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]!).map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    const values = splitCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Split a single CSV line respecting double-quote escaping.
 */
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (insideQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (ch === ',' && !insideQuote) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Escape a single CSV cell value.
 */
function escapeCSVCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Import CSV rows into the CRM database.
 * Validates required fields, checks for duplicates, and inserts clean rows.
 */
export async function importCSV(options: {
  entityType: TargetEntity;
  csvContent: string;
  columnMap?: Record<string, string>; // maps CSV header -> entity field name
  skipDuplicates?: boolean;
}): Promise<ImportResult> {
  const { entityType, csvContent, columnMap = {}, skipDuplicates = true } = options;

  const rawRows = parseCSV(csvContent);
  const result: ImportResult = {
    totalRows: rawRows.length,
    insertedCount: 0,
    skippedDuplicateCount: 0,
    errorCount: 0,
    rows: [],
  };

  for (let idx = 0; idx < rawRows.length; idx++) {
    const rawRow = rawRows[idx]!;

    // Apply column mapping
    const row: Record<string, string> = {};
    for (const [header, val] of Object.entries(rawRow)) {
      const mappedField = columnMap[header] ?? header;
      row[mappedField] = val;
    }

    try {
      if (entityType === 'companies') {
        const name = row.name || row.companyName || row.company_name;
        if (!name) {
          throw new Error('Required field "name" is missing');
        }

        // Duplicate check: exact domain or normalized name similarity
        const domain = normalizeDomain(row.domainName || row.domain_name || row.website || '');
        const normName = normalizeCompanyName(name);

        if (skipDuplicates) {
          const existingCompanies = await db.query.companies.findMany({});
          for (const existing of existingCompanies) {
            const existingDomain = normalizeDomain(existing.domainName);
            const existingNormName = normalizeCompanyName(existing.name);

            const isDomainMatch = domain && existingDomain && domain === existingDomain;
            const isNameMatch = computeStringSimilarity(normName, existingNormName) >= 0.92;

            if (isDomainMatch || isNameMatch) {
              // Persist candidate
              await db.insert(mergeCandidates).values({
                entityType: 'company',
                primaryRecordId: existing.id,
                duplicateRecordId: existing.id, // placeholder — no new record to ref yet
                confidenceScore: isDomainMatch ? '0.98' : '0.92',
                matchReason: isDomainMatch ? 'DOMAIN_MATCH' : 'FUZZY_NAME',
                status: 'PENDING',
              }).catch(() => {});

              result.rows.push({ rowIndex: idx + 1, status: 'duplicate', data: row });
              result.skippedDuplicateCount++;
              break;
            }
          }
          // If already marked duplicate, skip to next row
          if (result.rows[result.rows.length - 1]?.status === 'duplicate') continue;
        }

        const [inserted] = await db.insert(companies).values({
          name,
          domainName: domain ?? null,
          industry: row.industry || null,
          employeesCount: row.employeesCount ? parseInt(row.employeesCount) : null,
          linkedinUrl: row.linkedinUrl || row.linkedin_url || null,
          addressCity: row.addressCity || row.city || null,
          addressCountry: row.addressCountry || row.country || null,
          customFields: {},
        }).returning();

        result.rows.push({ rowIndex: idx + 1, status: 'inserted', recordId: inserted.id, data: row });
        result.insertedCount++;

      } else if (entityType === 'people') {
        const email = row.email;
        if (!email) {
          throw new Error('Required field "email" is missing');
        }

        if (skipDuplicates) {
          const existing = await db.query.people.findFirst({
            where: eq(people.email, email.toLowerCase().trim()),
          });
          if (existing) {
            result.rows.push({ rowIndex: idx + 1, status: 'duplicate', data: row });
            result.skippedDuplicateCount++;
            continue;
          }
        }

        const [inserted] = await db.insert(people).values({
          firstName: row.firstName || row.first_name || null,
          lastName: row.lastName || row.last_name || null,
          email: email.toLowerCase().trim(),
          jobTitle: row.jobTitle || row.job_title || row.title || null,
          phone: row.phone || null,
          linkedinUrl: row.linkedinUrl || row.linkedin_url || null,
          customFields: {},
        }).returning();

        result.rows.push({ rowIndex: idx + 1, status: 'inserted', recordId: inserted.id, data: row });
        result.insertedCount++;

      } else {
        throw new Error(`Import not yet supported for entity type "${entityType}"`);
      }

    } catch (err: any) {
      result.rows.push({
        rowIndex: idx + 1,
        status: 'error',
        error: err.message || String(err),
        data: row,
      });
      result.errorCount++;
    }
  }

  return result;
}

/**
 * Export CRM records to a CSV string.
 * Leverages Saved Views for pre-configured filters and sorting.
 */
export async function exportCSV(options: ExportOptions): Promise<string> {
  const { entityType, viewId, filters = [], sortBy = [], visibleFields, limit = 500 } = options;

  let records: Array<Record<string, any>>;

  if (viewId) {
    const viewResult = await runView({ viewId, limit });
    records = (viewResult as any).records ?? Object.values((viewResult as any).groups ?? {}).flat();
  } else {
    const viewResult = await runView({
      view: {
        targetEntity: entityType,
        viewType: 'TABLE',
        filters,
        sortBy,
        visibleFields,
      },
      limit,
    });
    records = (viewResult as any).records ?? [];
  }

  if (records.length === 0) {
    return '';
  }

  // Determine columns
  const allKeys = new Set<string>();
  for (const r of records) {
    Object.keys(r).forEach((k) => {
      if (k !== 'customFields' && k !== 'searchVector') allKeys.add(k);
    });
  }

  const columns = visibleFields && visibleFields.length > 0
    ? visibleFields.filter((f) => allKeys.has(f))
    : [...allKeys];

  // Build CSV
  const lines: string[] = [];
  lines.push(columns.map(escapeCSVCell).join(','));
  for (const record of records) {
    lines.push(columns.map((col) => escapeCSVCell(record[col])).join(','));
  }

  return lines.join('\n');
}
