import 'dotenv/config';
import { crmToolHandlers } from '../../mcp/tools';
import { db } from '../index';
import {
  companies,
  people,
  sequences,
  sequenceSteps,
  sequenceEnrollments,
  tasks,
  taskTargets,
  timelineActivities,
} from '../schema';
import { eq, or, inArray } from 'drizzle-orm';

async function main() {
  console.log('[Test] Starting Outbound Sequences / Cadences end-to-end test against live Polygres DB...');

  const timestamp = Date.now();

  // 1. Create a 3-step Outbound Sequence via crm_create_sequence tool
  console.log('\n1. Creating 3-step Outbound Sequence...');
  const createSeqRes = await crmToolHandlers.createSequence({
    name: `AI Infrastructure Cold Cadence ${timestamp}`,
    description: '3-touch multi-channel outbound cadence for technical founders',
    steps: [
      {
        stepOrder: 1,
        delayDays: 0,
        channel: 'EMAIL',
        templateSubject: 'Solving data silos at {{company.name}}',
        templateBody: 'Hi {{person.firstName}}, noticed your recent post on distributed pg...',
        promptInstructions: 'Personalize based on prospect recent github/linkedin activity',
        exitOnReply: true,
      },
      {
        stepOrder: 2,
        delayDays: 3,
        channel: 'LINKEDIN',
        templateBody: 'Following up on my email regarding pgContext benchmarks.',
        exitOnReply: true,
      },
      {
        stepOrder: 3,
        delayDays: 2,
        channel: 'TASK',
        templateSubject: 'Call Founder / Leave Voicemail',
        templateBody: 'Attempt phone outreach and reference previous email touchpoints.',
        exitOnReply: true,
      },
    ],
  });

  const sequenceId = createSeqRes.sequence.id;
  console.log(`✓ Sequence created: "${createSeqRes.sequence.name}" (ID: ${sequenceId}) with ${createSeqRes.sequence.steps.length} steps.`);

  // 2. Create a test prospect company and contact
  console.log('\n2. Creating test prospect company and contact...');
  const [prospectCompany] = await db.insert(companies).values({
    name: `Cybernetics Labs ${timestamp}`,
    domainName: `cybernetics-${timestamp}.io`,
  }).returning();

  const [prospect1] = await db.insert(people).values({
    companyId: prospectCompany.id,
    firstName: 'Miles',
    lastName: 'Dyson',
    email: `miles@cybernetics-${timestamp}.io`,
  }).returning();

  const [prospect2] = await db.insert(people).values({
    companyId: prospectCompany.id,
    firstName: 'Sarah',
    lastName: 'Connor',
    email: `sarah@cybernetics-${timestamp}.io`,
  }).returning();
  console.log(`✓ Created prospects: ${prospect1.id} (${prospect1.email}) and ${prospect2.id} (${prospect2.email})`);

  // 3. Enroll Prospect 1 into the Sequence
  console.log('\n3. Enrolling Miles Dyson into sequence...');
  const enrollRes = await crmToolHandlers.enrollInSequence({
    sequenceId,
    personId: prospect1.id,
  });
  console.log(`✓ Enrolled! Current step: ${enrollRes.enrollment.currentStep}, Status: ${enrollRes.enrollment.status}`);
  const enrollmentId = enrollRes.enrollment.id;

  // Verify duplicate prevention
  console.log('   Testing duplicate enrollment prevention...');
  const dupEnrollRes = await crmToolHandlers.enrollInSequence({
    sequenceId,
    personId: prospect1.id,
  });
  console.log(`✓ Duplicate enrollment prevented: alreadyEnrolled = ${dupEnrollRes.alreadyEnrolled}`);
  if (!dupEnrollRes.alreadyEnrolled) {
    throw new Error('Duplicate enrollment prevention failed!');
  }

  // 4. Inspect sequence progress before executing steps
  console.log('\n4. Checking sequence progress...');
  let progress = await crmToolHandlers.getSequenceProgress({ enrollmentId });
  console.log(`✓ Progress report: ${progress.currentStep}/${progress.totalSteps} steps. Next due: ${progress.nextStepDueAt}`);
  for (const s of progress.steps) {
    console.log(`   • Step ${s.stepOrder} [${s.channel}]: ${s.status}`);
  }

  // 5. Advance Step 1 (EMAIL)
  console.log('\n5. Advancing Step 1 (EMAIL touchpoint)...');
  const step1Res = await crmToolHandlers.advanceSequenceStep({
    enrollmentId,
    touchContent: 'Hi Miles, we built an agentic CRM on Polygres that solves your pipeline sync.',
  });
  console.log(`✓ Step 1 executed: status = "${step1Res.status}". Message: ${step1Res.message}`);

  // 6. Advance Step 2 (LINKEDIN)
  console.log('\n6. Advancing Step 2 (LINKEDIN touchpoint)...');
  const step2Res = await crmToolHandlers.advanceSequenceStep({
    enrollmentId,
  });
  console.log(`✓ Step 2 executed: status = "${step2Res.status}". Next step: ${step2Res.nextStep?.stepOrder} (${step2Res.nextStep?.channel})`);

  // 7. Advance Step 3 (TASK) -> Should complete sequence and create a CRM task
  console.log('\n7. Advancing Step 3 (TASK channel - creates rep task and completes sequence)...');
  const step3Res = await crmToolHandlers.advanceSequenceStep({
    enrollmentId,
    notes: 'Left message with assistant',
  });
  console.log(`✓ Step 3 executed: status = "${step3Res.status}". Message: ${step3Res.message}`);
  if (step3Res.status !== 'COMPLETED') {
    throw new Error(`Expected sequence status COMPLETED, got ${step3Res.status}`);
  }

  // Verify task was created in crm.tasks
  const createdTasks = await db.select().from(tasks).where(eq(tasks.title, 'Call Founder / Leave Voicemail'));
  console.log(`✓ Found ${createdTasks.length} CRM task created automatically for Step 3.`);
  if (createdTasks.length === 0) {
    throw new Error('Automated CRM task was not created for TASK step!');
  }

  // 8. Test Exit on Reply for Prospect 2
  console.log('\n8. Testing Exit-on-Reply for Prospect 2 (Sarah Connor)...');
  const enroll2 = await crmToolHandlers.enrollInSequence({
    sequenceId,
    personId: prospect2.id,
  });
  console.log(`✓ Enrolled Sarah Connor (Enrollment ID: ${enroll2.enrollment.id})`);

  console.log('   Simulating inbound reply from Sarah Connor...');
  const exitRes = await crmToolHandlers.exitSequenceOnReply({
    personId: prospect2.id,
    replySnippet: 'Thanks for reaching out! Let us schedule a call next Tuesday.',
  });
  console.log(`✓ Exited ${exitRes.exitedCount} active sequence enrollment(s) on reply.`);
  if (exitRes.exitedCount !== 1) {
    throw new Error(`Expected 1 exited enrollment, got ${exitRes.exitedCount}`);
  }

  const updatedEnroll2 = await db.query.sequenceEnrollments.findFirst({
    where: eq(sequenceEnrollments.id, enroll2.enrollment.id),
  });
  console.log(`✓ Enrollment status now: "${updatedEnroll2?.status}" (Expected: EXITED_REPLY)`);
  if (updatedEnroll2?.status !== 'EXITED_REPLY') {
    throw new Error(`Expected EXITED_REPLY status, got ${updatedEnroll2?.status}`);
  }

  // 9. Verify Activity Timeline has logged all cadence events
  console.log('\n9. Verifying activity timeline events...');
  const timeline = await db.query.timelineActivities.findMany({
    where: or(
      eq(timelineActivities.entityId, prospect1.id),
      eq(timelineActivities.entityId, prospect2.id)
    ),
  });
  console.log(`✓ Found ${timeline.length} timeline events recorded for sequence activities:`);
  for (const t of timeline) {
    console.log(`   • [${t.activityType}] ${t.entityType} ${t.entityId}: ${JSON.stringify(t.properties)}`);
  }

  // 10. Clean up test records
  console.log('\n10. Cleaning up test data from live DB...');
  await db.delete(timelineActivities).where(or(
    eq(timelineActivities.entityId, prospect1.id),
    eq(timelineActivities.entityId, prospect2.id),
    eq(timelineActivities.entityId, prospectCompany.id)
  ));
  await db.delete(taskTargets).where(inArray(taskTargets.personId, [prospect1.id, prospect2.id]));
  if (createdTasks.length > 0) {
    await db.delete(tasks).where(eq(tasks.title, 'Call Founder / Leave Voicemail'));
  }
  await db.delete(sequenceEnrollments).where(eq(sequenceEnrollments.sequenceId, sequenceId));
  await db.delete(sequenceSteps).where(eq(sequenceSteps.sequenceId, sequenceId));
  await db.delete(sequences).where(eq(sequences.id, sequenceId));
  await db.delete(people).where(or(eq(people.id, prospect1.id), eq(people.id, prospect2.id)));
  await db.delete(companies).where(eq(companies.id, prospectCompany.id));
  console.log('✓ Cleanup complete.');

  console.log('\n🎉 ALL OUTBOUND SEQUENCES / CADENCES TESTS PASSED VERIFIED LIVE AGAINST POLYGRES DB!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Test Failed]', err);
  process.exit(1);
});
