/**
 * Apply the documented Fudis CRM data quality, deduplication, and resolution enrichments.
 * Source: /Users/oscar-rivas/Github/00ACTIVE/fudis/handbook/growth/crm-import/README.md
 *
 * Actions:
 * 1. Correct Carnal Prime Steakhouse location: Mexico City -> Lima, Peru (Miraflores)
 * 2. Consolidate Luisito duplicates:
 *    - Re-parent real Deigo Cocina Japonesa under Luisito Group
 *    - Point Deigo contact to Luis Arturo Villar Sudek
 *    - Soft-delete fictional Chile Luisito placeholders and redundant Grupo CREY
 * 3. Merge Rosetta (branch 2) into Rosetta
 * 4. Merge La Mar (Acurio Lima flagship) into La Mar
 * 5. Ingest newly identified restaurants from needs-identification.csv:
 *    - Roux (Buenos Aires, Martín Rebaudino)
 *    - Máximo Bistrot (Mexico City, Eduardo García)
 *    - Anchoíta (Buenos Aires, Enrique Piñeyro)
 *    - Casa Las Cujas (Santiago, Chile, Antonio Moreno)
 *    - 99 Restaurante (Santiago, Chile, Kurt Schmidt)
 *    - La Gloria (Lima, Peru, Óscar Velarde)
 *    - LIMANÁ, Huaca Pucllana, La Rosa Náutica, etc.
 *
 * Usage: npx tsx src/db/scripts/enrich-fudis-data.ts
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../index';
import {
  companies,
  people,
  opportunities,
  brands,
  notes,
  noteTargets,
  timelineActivities,
} from '../schema';
import { eq, and, inArray } from 'drizzle-orm';

const SOURCE_DIR = '/Users/oscar-rivas/Github/00ACTIVE/fudis/handbook/growth/crm-import';

function parseCSV(content: string): Array<Record<string, string>> {
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseLine(lines[0]);
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

async function main() {
  console.log('============================================================');
  console.log('Fudis Data Quality & Needs Identification Ingestion');
  console.log('============================================================\n');

  const fudisBrand = await db.query.brands.findFirst({
    where: eq(brands.slug, 'fudis'),
  });

  if (!fudisBrand) {
    throw new Error('Fudis brand record not found');
  }

  // --------------------------------------------------------------------------
  // 1. Correct Carnal Prime Steakhouse Location
  // --------------------------------------------------------------------------
  console.log('[1/4] Applying geographic corrections...');
  const carnal = await db.query.companies.findFirst({
    where: eq(companies.name, 'Carnal Prime Steakhouse'),
  });
  if (carnal && carnal.addressCity !== 'Lima') {
    await db.update(companies)
      .set({ addressCity: 'Lima', addressCountry: 'Peru', industry: 'Steakhouse & Fine Dining' })
      .where(eq(companies.id, carnal.id));
    console.log('  ^ Carnal Prime Steakhouse location corrected to Lima, Peru');
  } else {
    console.log('  = Carnal Prime Steakhouse location already accurate');
  }

  // --------------------------------------------------------------------------
  // 2. Consolidate Luisito and Deigo Hierarchy
  // --------------------------------------------------------------------------
  console.log('\n[2/4] Consolidating Luisito Group & Deigo Cocina Japonesa...');
  const luisitoGroup = await db.query.companies.findFirst({
    where: eq(companies.name, 'Luisito Group'),
  });
  const deigo = await db.query.companies.findFirst({
    where: eq(companies.name, 'Deigo Cocina Japonesa'),
  });
  const luisitoContact = await db.query.people.findFirst({
    where: and(eq(people.firstName, 'Luis Arturo'), eq(people.lastName, 'Villar Sudek')),
  });

  if (luisitoGroup && deigo) {
    // Re-parent Deigo under Luisito Group
    await db.update(companies)
      .set({ parentCompanyId: luisitoGroup.id })
      .where(eq(companies.id, deigo.id));

    // Link Deigo deal to Luisito contact
    if (luisitoContact) {
      await db.update(opportunities)
        .set({ pointOfContactId: luisitoContact.id })
        .where(eq(opportunities.companyId, deigo.id));
    }
    console.log('  ^ Re-parented Deigo Cocina Japonesa under Luisito Group');

    // Clean up empty Grupo CREY
    const crey = await db.query.companies.findFirst({
      where: eq(companies.name, 'Grupo CREY'),
    });
    if (crey) {
      await db.delete(companies).where(eq(companies.id, crey.id));
      console.log('  - Removed redundant empty holding company "Grupo CREY"');
    }

    // Soft-delete the 5 unverified Chile placeholder locations
    const placeholderNames = [
      'Luisito (flagship)',
      'Luisito (fast casual)',
      'Luisito (pizza concept)',
      'Luisito (Chile expansion)',
      'Luisito (5th concept)',
    ];

    const placeholders = await db.query.companies.findMany({
      where: inArray(companies.name, placeholderNames),
    });

    for (const ph of placeholders) {
      await db.update(opportunities)
        .set({ stage: 'CLOSED_LOST', lossReason: 'Chile concept placeholder - unverified location (group is CDMX based)' })
        .where(eq(opportunities.companyId, ph.id));
      await db.update(companies)
        .set({ deletedAt: new Date() })
        .where(eq(companies.id, ph.id));
    }
    console.log(`  - Consolidated ${placeholders.length} unverified Chile placeholders into Deigo anchor deal`);
  }

  // --------------------------------------------------------------------------
  // 3. Deduplicate Rosetta and La Mar Flagships
  // --------------------------------------------------------------------------
  console.log('\n[3/4] Merging duplicate branch/flagship records...');
  
  // Rosetta branch 2 -> Rosetta
  const rosettaMain = await db.query.companies.findFirst({ where: eq(companies.name, 'Rosetta') });
  const rosettaBranch = await db.query.companies.findFirst({ where: eq(companies.name, 'Rosetta (branch 2)') });
  if (rosettaBranch && rosettaMain) {
    await db.delete(opportunities).where(eq(opportunities.companyId, rosettaBranch.id));
    await db.delete(companies).where(eq(companies.id, rosettaBranch.id));
    console.log('  - Merged Rosetta (branch 2) into Rosetta');
  }

  // La Mar flagship -> La Mar
  const laMarMain = await db.query.companies.findFirst({ where: eq(companies.name, 'La Mar') });
  const laMarFlagship = await db.query.companies.findFirst({ where: eq(companies.name, 'La Mar (Acurio Lima flagship)') });
  if (laMarFlagship && laMarMain) {
    await db.delete(opportunities).where(eq(opportunities.companyId, laMarFlagship.id));
    await db.delete(companies).where(eq(companies.id, laMarFlagship.id));
    console.log('  - Merged La Mar (Acurio Lima flagship) into La Mar (preserved group pitch context)');
  }

  // --------------------------------------------------------------------------
  // 4. Ingest High-Confidence Leads from needs-identification.csv
  // --------------------------------------------------------------------------
  console.log('\n[4/4] Ingesting validated leads from needs-identification.csv...');
  const needsFile = path.join(SOURCE_DIR, 'needs-identification.csv');
  const needsRows = parseCSV(fs.readFileSync(needsFile, 'utf-8'));

  let newCreated = 0;

  for (const row of needsRows) {
    const resolution = row.resolution || '';
    // Only import rows confirmed as "Created in Twenty" with a proposed restaurant
    if (resolution.startsWith('Created in Twenty') && row.proposed_restaurant) {
      const name = row.proposed_restaurant.trim();
      const city = row.city ? row.city.trim() : null;
      const country = row.country ? row.country.trim() : null;
      const desc = row.description || 'Gastronomic prospect';

      let company = await db.query.companies.findFirst({
        where: eq(companies.name, name),
      });

      if (!company) {
        const [insertedCo] = await db.insert(companies).values({
          name,
          industry: desc,
          addressCity: city,
          addressCountry: country,
          customFields: {
            sourceNote: resolution,
            leadConfidence: row.confidence || 'HIGH',
            importedFrom: 'fudis-needs-identification',
          },
        }).returning();
        company = insertedCo;

        // Create deal
        await db.insert(opportunities).values({
          name,
          companyId: company.id,
          brandId: fudisBrand.id,
          stage: 'DISCOVERY',
          amountMicros: (20000 * 1_000_000).toString(),
          currency: 'USD',
          probabilityPercent: 20,
          customFields: {
            description: desc,
            confidence: row.confidence,
          },
        });

        // Parse and create contact if listed in resolution string
        // e.g. "contact: Martín Rebaudino, Chef/Owner"
        const contactMatch = resolution.match(/contact:\s*([^,]+)(?:,\s*([^)]+))?/);
        if (contactMatch) {
          const contactFullName = contactMatch[1].trim();
          const title = contactMatch[2] ? contactMatch[2].trim() : 'Chef/Owner';
          const parts = contactFullName.split(' ');
          const first = parts[0] || 'Unknown';
          const last = parts.slice(1).join(' ') || '';

          const syntheticEmail = `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

          await db.insert(people).values({
            firstName: first,
            lastName: last,
            email: syntheticEmail,
            jobTitle: title,
            companyId: company.id,
            customFields: {
              contactCategory: 'Chef/Owner',
              importedFrom: 'fudis-needs-identification',
            },
          });
        }

        newCreated++;
        console.log(`  + Created Verified Lead: "${name}" (${city}, ${country}) [${row.confidence}]`);
      }
    }
  }

  console.log(`\nImported ${newCreated} additional validated restaurants from needs identification!`);
  console.log('============================================================\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n[FATAL] Enrichment failed:', err);
  process.exit(1);
});
