/**
 * Idempotent migration script to import Fudis LatAm Sales pipeline into Polygres CRM.
 * Source: /Users/oscar-rivas/Github/00ACTIVE/fudis/handbook/growth/crm-import/
 *
 * Imports:
 * 1. Company Groups (12 holding groups as root parent companies)
 * 2. Companies / Locations (33 restaurant locations, with parent_company_id and custom_fields)
 * 3. People / Key Stakeholders (18 chefs/owners, linked via company_id)
 * 4. Opportunities (33 pipeline deals, scoped to Fudis brand_id)
 *
 * Usage: npx tsx src/db/scripts/import-fudis-pipeline.ts
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
  timelineActivities,
} from '../schema';
import { eq, and } from 'drizzle-orm';

const SOURCE_DIR = '/Users/oscar-rivas/Github/00ACTIVE/fudis/handbook/growth/crm-import';

function parseCSV(content: string): Array<Record<string, string>> {
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Parse header line handling quotes
  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
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
  console.log('Fudis LatAm Sales Pipeline -> Polygres CRM Migration');
  console.log('============================================================\n');

  // 1. Resolve Fudis Brand ID
  const fudisBrand = await db.query.brands.findFirst({
    where: eq(brands.slug, 'fudis'),
  });

  if (!fudisBrand) {
    throw new Error('Fudis brand record not found in crm.brands table. Please run seed-brands first.');
  }
  console.log(`[1/5] Target Brand: "${fudisBrand.name}" (UUID: ${fudisBrand.id})`);

  // Map to cache company IDs by name for fast relational lookups
  const companyMap = new Map<string, string>();

  // 2. Import Company Groups (Root Holding Companies)
  const groupsFile = path.join(SOURCE_DIR, 'company-groups.csv');
  const groupRows = parseCSV(fs.readFileSync(groupsFile, 'utf-8'));
  console.log(`\n[2/5] Importing ${groupRows.length} Holding Groups from company-groups.csv...`);

  for (const row of groupRows) {
    const name = row.company_name;
    const locationsCount = parseInt(row.number_of_locations) || 1;

    let company = await db.query.companies.findFirst({
      where: eq(companies.name, name),
    });

    if (!company) {
      const [inserted] = await db.insert(companies).values({
        name,
        industry: 'Hospitality & Restaurant Group',
        customFields: {
          groupType: 'Holding Group',
          numberOfLocations: locationsCount,
          importedFrom: 'fudis-crm-import',
        },
      }).returning();
      company = inserted;
      console.log(`  + Created Group: "${name}" (${locationsCount} locations)`);
    } else {
      console.log(`  = Exists: "${name}"`);
    }

    companyMap.set(name, company.id);
  }

  // 3. Import Companies / Restaurant Locations
  const companiesFile = path.join(SOURCE_DIR, 'companies.csv');
  const companyRows = parseCSV(fs.readFileSync(companiesFile, 'utf-8'));
  console.log(`\n[3/5] Importing ${companyRows.length} Restaurant Locations from companies.csv...`);

  for (const row of companyRows) {
    const name = row.company_name;
    const domain = row.domain ? row.domain.trim() : null;
    const city = row.address_city ? row.address_city.trim() : null;
    const country = row.address_country ? row.address_country.trim() : null;
    const parentName = row.parent_company ? row.parent_company.trim() : null;
    const parentId = parentName ? companyMap.get(parentName) ?? null : null;

    // Build custom fields bundle preserving all hospitality tags
    const customFields: Record<string, any> = {
      importedFrom: 'fudis-crm-import',
      locationStatus: row.location_status || 'Active',
    };
    if (row.cuisine_type) customFields.cuisineType = row.cuisine_type.split('|').map((s) => s.trim());
    if (row.restaurant_format) customFields.restaurantFormat = row.restaurant_format.split('|').map((s) => s.trim());
    if (row.reservation_model) customFields.reservationModel = row.reservation_model.split('|').map((s) => s.trim());
    if (row.price_range) customFields.priceRange = row.price_range;
    if (row.deal_priority) customFields.dealPriority = row.deal_priority;
    if (row.current_reservation_platform) customFields.currentReservationPlatform = row.current_reservation_platform;
    if (row.recognition) customFields.recognition = row.recognition.split('|').map((s) => s.trim());
    if (row.tags) customFields.tags = row.tags.split('|').map((s) => s.trim());
    if (row.lead_source) customFields.leadSource = row.lead_source;

    let company = await db.query.companies.findFirst({
      where: eq(companies.name, name),
    });

    if (!company) {
      const [inserted] = await db.insert(companies).values({
        name,
        domainName: domain,
        industry: customFields.cuisineType ? (Array.isArray(customFields.cuisineType) ? customFields.cuisineType.join(', ') : customFields.cuisineType) : 'Fine Dining & Hospitality',
        addressCity: city,
        addressCountry: country,
        parentCompanyId: parentId,
        customFields,
      }).returning();
      company = inserted;
      console.log(`  + Created Restaurant: "${name}" in ${city || 'Unknown'}, ${country || ''}${parentId ? ` (Parent: ${parentName})` : ''}`);
    } else {
      // Update parent company if not yet linked
      if (parentId && company.parentCompanyId !== parentId) {
        await db.update(companies).set({ parentCompanyId: parentId }).where(eq(companies.id, company.id));
        console.log(`  ^ Updated Parent for "${name}" -> "${parentName}"`);
      } else {
        console.log(`  = Exists: "${name}"`);
      }
    }

    companyMap.set(name, company.id);
  }

  // 4. Import People (Chefs / Owners)
  const peopleFile = path.join(SOURCE_DIR, 'people.csv');
  const peopleRows = parseCSV(fs.readFileSync(peopleFile, 'utf-8'));
  console.log(`\n[4/5] Importing ${peopleRows.length} Contacts from people.csv...`);

  const personMap = new Map<string, string>();

  for (const row of peopleRows) {
    const firstName = row.first_name.trim();
    const lastName = row.last_name.trim();
    const fullName = `${firstName} ${lastName}`;
    const companyName = row.company_name.trim();
    const jobTitle = row.job_title.trim();
    const companyId = companyMap.get(companyName) ?? null;

    // Synthesize safe canonical contact email if absent in export
    const domainPart = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const syntheticEmail = `${cleanFirst}.${cleanLast}@${domainPart || 'fudis-contact'}.com`;

    let person = await db.query.people.findFirst({
      where: and(
        eq(people.firstName, firstName),
        eq(people.lastName, lastName)
      ),
    });

    if (!person) {
      const [inserted] = await db.insert(people).values({
        firstName,
        lastName,
        email: syntheticEmail,
        jobTitle,
        companyId,
        customFields: {
          contactCategory: 'Chef/Owner',
          importedFrom: 'fudis-crm-import',
        },
      }).returning();
      person = inserted;
      console.log(`  + Created Contact: ${fullName} (${jobTitle}) @ ${companyName}`);
    } else {
      console.log(`  = Exists: ${fullName}`);
    }

    personMap.set(fullName, person.id);
  }

  // 5. Import Opportunities (Pipeline Deals)
  const oppsFile = path.join(SOURCE_DIR, 'opportunities.csv');
  const oppRows = parseCSV(fs.readFileSync(oppsFile, 'utf-8'));
  console.log(`\n[5/5] Importing ${oppRows.length} Opportunities from opportunities.csv...`);

  let createdDealsCount = 0;
  for (const row of oppRows) {
    const oppName = row.opportunity_name.trim();
    const companyName = row.company_name.trim();
    const companyId = companyMap.get(companyName);

    if (!companyId) {
      console.warn(`  ! Skipping "${oppName}": company "${companyName}" not resolved`);
      continue;
    }

    const contactName = row.point_of_contact ? row.point_of_contact.trim() : null;
    const contactId = contactName ? personMap.get(contactName) ?? null : null;
    const stage = row.stage === 'LOST' ? 'CLOSED_LOST' : 'DISCOVERY';
    const notes = row.notes ? row.notes.trim() : null;

    // Check if opportunity already exists
    const existing = await db.query.opportunities.findFirst({
      where: and(
        eq(opportunities.name, oppName),
        eq(opportunities.companyId, companyId)
      ),
    });

    if (!existing) {
      // Default amount $15,000 USD (15B micros) or higher for anchors
      const isAnchor = oppName.toLowerCase().includes('acurio') || oppName.toLowerCase().includes('luisito') || (notes && notes.includes('Anchor'));
      const defaultAmountMicros = isAnchor ? (50000 * 1_000_000).toString() : (15000 * 1_000_000).toString();

      const [inserted] = await db.insert(opportunities).values({
        name: oppName,
        companyId,
        brandId: fudisBrand.id,
        pointOfContactId: contactId,
        stage,
        amountMicros: defaultAmountMicros,
        currency: 'USD',
        probabilityPercent: stage === 'CLOSED_LOST' ? 0 : 25,
        lossReason: stage === 'CLOSED_LOST' ? (notes || 'Restaurant closed') : null,
        customFields: {
          importedNotes: notes,
          importedFrom: 'fudis-crm-import',
        },
      }).returning();

      // Log initial timeline activity
      await db.insert(timelineActivities).values({
        entityType: 'opportunity',
        entityId: inserted.id,
        activityType: 'RECORD_CREATED',
        actorSource: 'API',
        actorName: 'Fudis Pipeline Migrator',
        properties: {
          dealName: oppName,
          companyName,
          stage,
          brand: 'Fudis',
          notes,
        },
      });

      createdDealsCount++;
      console.log(`  + Created Deal: "${oppName}" [${stage}] -> ${companyName}${notes ? ` (Note: ${notes})` : ''}`);
    } else {
      console.log(`  = Exists: "${oppName}"`);
    }
  }

  console.log('\n============================================================');
  console.log(`Migration Complete!`);
  console.log(`- Groups imported: ${groupRows.length}`);
  console.log(`- Restaurants imported: ${companyRows.length}`);
  console.log(`- Contacts imported: ${peopleRows.length}`);
  console.log(`- Opportunities processed: ${oppRows.length} (${createdDealsCount} new created)`);
  console.log('============================================================\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n[FATAL] Migration failed:', err);
  process.exit(1);
});
