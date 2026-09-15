import { db } from './index';
import {
  companies,
  people,
  opportunities,
  notes,
  tasks,
  noteTargets,
  taskTargets,
  customFieldDefinitions,
  customObjectDefinitions,
  customObjectRecords,
  interactionTranscripts,
} from './schema';

/**
 * Seed the CRM database with realistic test data.
 * Run via: pnpm tsx src/db/seed.ts
 */
export async function seedDatabase() {
  console.log('[Seed] Starting database seeding...');

  // 1. Custom Field Definitions
  console.log('[Seed] Inserting custom field definitions...');
  await db.insert(customFieldDefinitions).values([
    {
      targetEntity: 'companies',
      name: 'contractTier',
      label: 'Contract Tier',
      fieldType: 'SELECT',
      options: ['Standard', 'Enterprise', 'Strategic VIP'],
      isRequired: false,
      isSearchable: true,
    },
    {
      targetEntity: 'opportunities',
      name: 'championSeniority',
      label: 'Champion Seniority',
      fieldType: 'SELECT',
      options: ['C-Level', 'VP / Director', 'Manager', 'IC'],
      isRequired: false,
      isSearchable: true,
    },
  ]);

  // 2. Custom Object Definition: Listings
  console.log('[Seed] Inserting custom object definitions...');
  const [listingDef] = await db.insert(customObjectDefinitions).values({
    nameSingular: 'listing',
    namePlural: 'listings',
    labelSingular: 'Commercial Listing',
    labelPlural: 'Commercial Listings',
    description: 'Commercial real estate office spaces represented by our team',
    icon: 'building',
  }).returning();

  // 3. Companies
  console.log('[Seed] Inserting companies...');
  const [acme, cyberdyne, stark] = await db.insert(companies).values([
    {
      name: 'Acme Corporation',
      domainName: 'acme.com',
      industry: 'Manufacturing & Hardware',
      employeesCount: 450,
      annualRevenueAmountMicros: '25000000000000', // $25M
      annualRevenueCurrency: 'USD',
      addressCity: 'San Francisco',
      addressCountry: 'USA',
      customFields: { contractTier: 'Strategic VIP' },
    },
    {
      name: 'Cyberdyne Systems',
      domainName: 'cyberdyne.ai',
      industry: 'Artificial Intelligence & Robotics',
      employeesCount: 1200,
      annualRevenueAmountMicros: '95000000000000', // $95M
      annualRevenueCurrency: 'USD',
      addressCity: 'Sunnyvale',
      addressCountry: 'USA',
      customFields: { contractTier: 'Enterprise' },
    },
    {
      name: 'Stark Industries',
      domainName: 'starkindustries.com',
      industry: 'Clean Energy & Defense',
      employeesCount: 5000,
      annualRevenueAmountMicros: '500000000000000', // $500M
      annualRevenueCurrency: 'USD',
      addressCity: 'New York',
      addressCountry: 'USA',
      customFields: { contractTier: 'Strategic VIP' },
    },
  ]).returning();

  // 4. People (Contacts)
  console.log('[Seed] Inserting contacts...');
  const [sarah, miles, pepper] = await db.insert(people).values([
    {
      companyId: acme.id,
      firstName: 'Sarah',
      lastName: 'Connor',
      jobTitle: 'VP of Operations',
      email: 'sarah.connor@acme.com',
      phone: '+1-415-555-0199',
      customFields: { preferredCommunication: 'Slack' },
    },
    {
      companyId: cyberdyne.id,
      firstName: 'Miles',
      lastName: 'Dyson',
      jobTitle: 'Chief Technology Officer',
      email: 'm.dyson@cyberdyne.ai',
      phone: '+1-408-555-0144',
      customFields: { securityClearance: 'Top Secret' },
    },
    {
      companyId: stark.id,
      firstName: 'Pepper',
      lastName: 'Potts',
      jobTitle: 'Chief Executive Officer',
      email: 'pepper@starkindustries.com',
      phone: '+1-212-555-0188',
      customFields: { assistantName: 'Happy Hogan' },
    },
  ]).returning();

  // 5. Opportunities (Deals)
  console.log('[Seed] Inserting opportunities...');
  const [acmeDeal, cyberdyneDeal, starkDeal] = await db.insert(opportunities).values([
    {
      companyId: acme.id,
      pointOfContactId: sarah.id,
      name: 'Acme Enterprise Global License Expansion',
      stage: 'PROPOSAL',
      amountMicros: '120000000000', // $120,000
      currency: 'USD',
      closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // in 30 days
      probabilityPercent: 60,
      healthScore: '0.75',
      customFields: { championSeniority: 'VP / Director' },
    },
    {
      companyId: cyberdyne.id,
      pointOfContactId: miles.id,
      name: 'Cyberdyne Neural Network Platform Trial',
      stage: 'NEGOTIATION',
      amountMicros: '450000000000', // $450,000
      currency: 'USD',
      closeDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      probabilityPercent: 80,
      healthScore: '0.90',
      customFields: { championSeniority: 'C-Level' },
    },
    {
      companyId: stark.id,
      pointOfContactId: pepper.id,
      name: 'Stark Arc Reactor Grid Analytics',
      stage: 'DISCOVERY',
      amountMicros: '1500000000000', // $1.5M
      currency: 'USD',
      closeDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      probabilityPercent: 30,
      healthScore: '0.40',
      customFields: { championSeniority: 'C-Level' },
    },
  ]).returning();

  // 6. Notes & Junction Targets
  console.log('[Seed] Inserting notes...');
  const [note1] = await db.insert(notes).values({
    title: 'Executive Meeting Summary - Q3 Renewal',
    body: 'Sarah Connor indicated that Acme is satisfied with SLA uptime but requested an upfront discount for a 2-year commitment. Need to verify pricing with sales leadership.',
  }).returning();

  await db.insert(noteTargets).values({
    noteId: note1.id,
    companyId: acme.id,
    personId: sarah.id,
    opportunityId: acmeDeal.id,
  });

  // 7. Tasks
  console.log('[Seed] Inserting tasks...');
  const [task1] = await db.insert(tasks).values({
    title: 'Prepare 2-Year DPA and Pricing Matrix for Acme',
    body: 'Draft formal 2-year enterprise quote with 12% multi-year discount tier.',
    dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    status: 'IN_PROGRESS',
  }).returning();

  await db.insert(taskTargets).values({
    taskId: task1.id,
    companyId: acme.id,
    opportunityId: acmeDeal.id,
  });

  // 8. Custom Object Records
  console.log('[Seed] Inserting custom object records...');
  await db.insert(customObjectRecords).values([
    {
      customObjectId: listingDef.id,
      name: 'One Market Plaza - Suite 3200',
      companyId: acme.id,
      personId: sarah.id,
      data: {
        squareFeet: 15000,
        monthlyRentUsd: 115000,
        leaseTermMonths: 36,
        status: 'Negotiation',
      },
    },
  ]);

  // 9. Interaction Transcripts (Ambient Grounding)
  console.log('[Seed] Inserting interaction transcripts...');
  await db.insert(interactionTranscripts).values([
    {
      channel: 'ZOOM',
      companyId: acme.id,
      personId: sarah.id,
      opportunityId: acmeDeal.id,
      rawTranscript: `Sarah Connor: "Thanks for walking us through the new roadmap. We really need SOC2 Type II compliance verified before our procurement team can sign off."
Sales Rep: "Understood Sarah, our compliance report is current and I can attach the auditor letter to our follow-up."
Sarah Connor: "Great. If you can keep the 2-year commitment under $240k total, we have executive sign-off from our CFO."`,
      executiveSummary: 'Customer confirmed CFO approval for a 2-year agreement under $240k total, subject to receiving current SOC2 Type II auditor letter.',
      actionItems: [
        { task: 'Send SOC2 Type II auditor letter to Sarah', assignee: 'Sales Rep' },
        { task: 'Prepare 2-year contract under $240k threshold', assignee: 'Sales Rep' },
      ],
      objectionsRaised: [{ objection: 'Procurement requires verified SOC2 Type II certification' }],
      competitorsMentioned: ['LegacyProvider'],
      sentimentScore: '0.80',
    },
  ]);

  console.log('[Seed] Database seeded successfully! You can now run "pnpm mcp" to test with Claude Desktop.');
  process.exit(0);
}

// Execute when invoked directly
seedDatabase().catch((err: unknown) => {
  console.error('[Seed Fatal Error]', err);
  process.exit(1);
});
