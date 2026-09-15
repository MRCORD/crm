import 'dotenv/config';
import { crmToolHandlers } from '../../mcp/tools';
import { db } from '../index';
import { companies, people, mergeCandidates } from '../schema';
import { eq, ilike, inArray } from 'drizzle-orm';

async function main() {
  console.log('[Test] Starting Import/Export (CSV) end-to-end test against live Polygres DB...');

  const timestamp = Date.now();

  // 1. Import a CSV of companies
  console.log('\n1. Importing 3 companies from CSV...');
  const companiesCSV = [
    `name,domainName,industry,addressCity,addressCountry`,
    `Stellar Dynamics ${timestamp},stellar-${timestamp}.io,Deep Tech,San Francisco,US`,
    `Nova Ventures ${timestamp},nova-${timestamp}.com,FinTech,New York,US`,
    `Polar Analytics ${timestamp},polar-${timestamp}.ai,Data & AI,Toronto,CA`,
  ].join('\n');

  const importResult = await crmToolHandlers.importCSV({
    entityType: 'companies',
    csvContent: companiesCSV,
    skipDuplicates: true,
  });

  console.log(`✓ Import result: ${importResult.insertedCount} inserted, ${importResult.skippedDuplicateCount} duplicates, ${importResult.errorCount} errors.`);
  if (importResult.insertedCount !== 3) {
    throw new Error(`Expected 3 insertions, got ${importResult.insertedCount}`);
  }

  const insertedIds = importResult.rows
    .filter((r) => r.status === 'inserted' && r.recordId)
    .map((r) => r.recordId!);

  console.log(`  Inserted IDs: ${insertedIds.join(', ')}`);

  // 2. Test duplicate skip on re-import of same CSV
  console.log('\n2. Re-importing the same CSV to test duplicate detection...');
  const reimportResult = await crmToolHandlers.importCSV({
    entityType: 'companies',
    csvContent: companiesCSV,
    skipDuplicates: true,
  });
  console.log(`✓ Re-import result: ${reimportResult.insertedCount} inserted, ${reimportResult.skippedDuplicateCount} duplicates skipped.`);
  if (reimportResult.skippedDuplicateCount !== 3) {
    throw new Error(`Expected 3 duplicates skipped, got ${reimportResult.skippedDuplicateCount}`);
  }

  // 3. Import contacts CSV with column remapping
  console.log('\n3. Importing 2 contacts with column remapping...');
  const peopleCSV = [
    `First Name,Last Name,Work Email,Title`,
    `Amelia,Earhart,amelia@stellar-${timestamp}.io,CEO`,
    `Nikola,Tesla,nikola@nova-${timestamp}.com,CTO`,
  ].join('\n');

  const peopleImportResult = await crmToolHandlers.importCSV({
    entityType: 'people',
    csvContent: peopleCSV,
    columnMap: {
      'First Name': 'firstName',
      'Last Name': 'lastName',
      'Work Email': 'email',
      'Title': 'jobTitle',
    },
    skipDuplicates: true,
  });
  console.log(`✓ People import: ${peopleImportResult.insertedCount} inserted, ${peopleImportResult.errorCount} errors.`);
  if (peopleImportResult.insertedCount !== 2) {
    throw new Error(`Expected 2 contact insertions, got ${peopleImportResult.insertedCount}`);
  }

  const insertedPeopleIds = peopleImportResult.rows
    .filter((r) => r.status === 'inserted' && r.recordId)
    .map((r) => r.recordId!);

  // 4. Test CSV Export: export the 3 imported companies
  console.log('\n4. Exporting imported companies via ad-hoc filter...');
  const exportResult = await crmToolHandlers.exportCSV({
    entityType: 'companies',
    filters: [
      { field: 'name', operator: 'contains', value: String(timestamp) },
    ],
    visibleFields: ['id', 'name', 'domainName', 'industry', 'addressCity', 'addressCountry'],
    limit: 10,
  });

  console.log(`✓ Export result: ${exportResult.rowCount} rows exported.`);
  console.log(`  Preview (first 3 lines):\n${exportResult.csv.split('\n').slice(0, 3).map((l) => '  ' + l).join('\n')}`);
  if (exportResult.rowCount !== 3) {
    throw new Error(`Expected 3 rows in CSV export, got ${exportResult.rowCount}`);
  }

  // 5. Verify CSV has correct header and data
  const csvLines = exportResult.csv.split('\n');
  const headers = csvLines[0]?.split(',') ?? [];
  console.log(`✓ CSV headers: ${headers.join(', ')}`);
  if (!headers.includes('name')) {
    throw new Error('Export CSV missing required "name" column');
  }

  // 6. Cleanup
  console.log('\n6. Cleaning up imported test records from live DB...');
  // Clean up people
  await db.delete(people).where(inArray(people.id, insertedPeopleIds));
  // Clean up companies (including any lingering duplicates)
  const importedCompanies = await db.query.companies.findMany({
    where: ilike(companies.name, `%${timestamp}%`),
  });
  if (importedCompanies.length > 0) {
    await db.delete(companies).where(inArray(companies.id, importedCompanies.map((c) => c.id)));
  }
  console.log('✓ Cleanup complete.');

  console.log('\n🎉 ALL IMPORT/EXPORT (CSV) TESTS PASSED VERIFIED LIVE AGAINST POLYGRES DB!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Test Failed]', err);
  process.exit(1);
});
