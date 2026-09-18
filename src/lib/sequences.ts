import { db } from '../db';
import {
  sequences,
  sequenceSteps,
  sequenceEnrollments,
  people,
  companies,
  tasks,
  taskTargets,
} from '../db/schema';
import { eq, and, sql, desc, asc, lte, inArray } from 'drizzle-orm';
import { logTimelineActivity } from './timeline';

export type SequenceChannel = 'EMAIL' | 'LINKEDIN' | 'PHONE_CALL' | 'TASK';
export type EnrollmentStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'EXITED_REPLY';

export interface StepDefinition {
  stepOrder: number;
  delayDays: number;
  channel: SequenceChannel;
  templateSubject?: string;
  templateBody?: string;
  promptInstructions?: string;
  exitOnReply?: boolean;
}

export interface CreateSequenceInput {
  name: string;
  description?: string;
  organizationId?: string | null;
  ownerId?: string | null;
  steps: StepDefinition[];
}

/**
 * Create a new outbound sequence with ordered steps.
 */
export async function createSequence(input: CreateSequenceInput) {
  const [seq] = await db
    .insert(sequences)
    .values({
      name: input.name,
      description: input.description ?? null,
      organizationId: input.organizationId ?? null,
      ownerId: input.ownerId ?? null,
      isActive: true,
    })
    .returning();

  if (input.steps.length > 0) {
    const stepsToInsert = input.steps.map((s, idx) => ({
      sequenceId: seq.id,
      stepOrder: s.stepOrder ?? idx + 1,
      delayDays: s.delayDays ?? 0,
      channel: s.channel,
      templateSubject: s.templateSubject ?? null,
      templateBody: s.templateBody ?? null,
      promptInstructions: s.promptInstructions ?? null,
      exitOnReply: s.exitOnReply ?? true,
    }));

    await db.insert(sequenceSteps).values(stepsToInsert);
  }

  const steps = await db.query.sequenceSteps.findMany({
    where: eq(sequenceSteps.sequenceId, seq.id),
    orderBy: [asc(sequenceSteps.stepOrder)],
  });

  return { ...seq, steps };
}

/**
 * Enroll a person into an outbound sequence.
 * Enforces single-active-enrollment check to prevent prospect fatigue.
 */
export async function enrollPersonInSequence(options: {
  sequenceId: string;
  personId: string;
  organizationId?: string | null;
}) {
  const { sequenceId, personId, organizationId } = options;

  // 1. Check person exists
  const person = await db.query.people.findFirst({ where: eq(people.id, personId) });
  if (!person) throw new Error(`Contact with ID ${personId} not found`);

  // 2. Check sequence exists and has steps
  const seq = await db.query.sequences.findFirst({
    where: eq(sequences.id, sequenceId),
    with: { steps: { orderBy: [asc(sequenceSteps.stepOrder)] } },
  });
  if (!seq) throw new Error(`Sequence with ID ${sequenceId} not found`);
  if (!seq.isActive) throw new Error(`Sequence "${seq.name}" is currently inactive`);
  if (!seq.steps || seq.steps.length === 0) throw new Error(`Sequence "${seq.name}" has no defined steps`);

  // 3. Prevent duplicate active enrollments in the same sequence
  const existing = await db.query.sequenceEnrollments.findFirst({
    where: and(
      eq(sequenceEnrollments.sequenceId, sequenceId),
      eq(sequenceEnrollments.personId, personId),
      eq(sequenceEnrollments.status, 'ACTIVE')
    ),
  });

  if (existing) {
    return {
      success: true,
      alreadyEnrolled: true,
      enrollment: existing,
      message: `Contact is already actively enrolled in "${seq.name}" (currently at step ${existing.currentStep}).`,
    };
  }

  // 4. Calculate initial due date based on step 1 delay
  const step1 = seq.steps[0]!;
  const nextStepDueAt = new Date(Date.now() + step1.delayDays * 86400000);

  const [enrollment] = await db
    .insert(sequenceEnrollments)
    .values({
      sequenceId,
      personId,
      companyId: person.companyId ?? null,
      organizationId: organizationId ?? seq.organizationId ?? null,
      currentStep: 1,
      status: 'ACTIVE',
      nextStepDueAt,
    })
    .returning();

  // 5. Log activity timeline event
  await logTimelineActivity({
    entityType: 'person',
    entityId: personId,
    activityType: 'SEQUENCE_ENROLLED',
    actorSource: 'AGENT',
    actorName: 'AI SDR Outbound Engine',
    properties: {
      sequenceId,
      sequenceName: seq.name,
      firstStepChannel: step1.channel,
      nextStepDueAt: nextStepDueAt.toISOString(),
    },
  });

  if (person.companyId) {
    await logTimelineActivity({
      entityType: 'company',
      entityId: person.companyId,
      activityType: 'SEQUENCE_ENROLLED',
      actorSource: 'AGENT',
      actorName: 'AI SDR Outbound Engine',
      properties: {
        personId,
        personName: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
        sequenceId,
        sequenceName: seq.name,
      },
    });
  }

  return {
    success: true,
    alreadyEnrolled: false,
    enrollment,
    sequence: seq,
  };
}

/**
 * Advance an enrollment by executing the current step and scheduling the next step.
 */
export async function advanceSequenceStep(options: {
  enrollmentId: string;
  touchContent?: string;
  notes?: string;
  userId?: string;
}) {
  const { enrollmentId, touchContent, notes, userId } = options;

  const enrollment = await db.query.sequenceEnrollments.findFirst({
    where: eq(sequenceEnrollments.id, enrollmentId),
    with: {
      sequence: {
        with: {
          steps: { orderBy: [asc(sequenceSteps.stepOrder)] },
        },
      },
      person: true,
      company: true,
    },
  });

  if (!enrollment) throw new Error(`Enrollment ${enrollmentId} not found`);
  if (enrollment.status !== 'ACTIVE') {
    throw new Error(`Enrollment is ${enrollment.status}; only ACTIVE enrollments can be advanced`);
  }

  const allSteps = enrollment.sequence.steps;
  const currentStep = allSteps.find((s) => s.stepOrder === enrollment.currentStep);
  if (!currentStep) {
    throw new Error(`Step ${enrollment.currentStep} not found in sequence`);
  }

  const now = new Date();

  // 1. Record the action on Activity Timeline & Create Task if TASK channel
  if (currentStep.channel === 'TASK') {
    const [createdTask] = await db.insert(tasks).values({
      title: currentStep.templateSubject || `Sequence Task: ${enrollment.sequence.name}`,
      body: currentStep.templateBody || notes || `Automated sequence task for step ${currentStep.stepOrder}`,
      dueAt: new Date(Date.now() + 86400000), // due tomorrow
    }).returning();

    await db.insert(taskTargets).values({
      taskId: createdTask.id,
      personId: enrollment.personId,
      companyId: enrollment.companyId ?? null,
    });
  }

  const activityType = currentStep.channel === 'EMAIL'
    ? 'EMAIL_SENT'
    : currentStep.channel === 'PHONE_CALL'
    ? 'CALL_LOGGED'
    : 'TASK_CREATED';

  await logTimelineActivity({
    entityType: 'person',
    entityId: enrollment.personId,
    activityType,
    actorSource: userId ? 'MANUAL' : 'AGENT',
    actorUserId: userId ?? null,
    actorName: userId ? 'CRM Rep' : 'AI SDR Agent',
    properties: {
      sequenceId: enrollment.sequenceId,
      sequenceName: enrollment.sequence.name,
      stepOrder: currentStep.stepOrder,
      channel: currentStep.channel,
      subject: currentStep.templateSubject,
      touchContent: touchContent ?? currentStep.templateBody,
      notes,
    },
  });

  // 2. Check for next step
  const nextStep = allSteps.find((s) => s.stepOrder === enrollment.currentStep + 1);

  if (nextStep) {
    const nextStepDueAt = new Date(Date.now() + nextStep.delayDays * 86400000);

    const [updated] = await db
      .update(sequenceEnrollments)
      .set({
        currentStep: nextStep.stepOrder,
        lastStepExecutedAt: now,
        nextStepDueAt,
      })
      .where(eq(sequenceEnrollments.id, enrollmentId))
      .returning();

    return {
      status: 'ADVANCED',
      message: `Step ${currentStep.stepOrder} (${currentStep.channel}) executed. Next step ${nextStep.stepOrder} (${nextStep.channel}) scheduled for ${nextStepDueAt.toISOString()}`,
      executedStep: currentStep,
      nextStep,
      enrollment: updated,
    };
  } else {
    // Sequence completed!
    const [updated] = await db
      .update(sequenceEnrollments)
      .set({
        status: 'COMPLETED',
        lastStepExecutedAt: now,
      })
      .where(eq(sequenceEnrollments.id, enrollmentId))
      .returning();

    await logTimelineActivity({
      entityType: 'person',
      entityId: enrollment.personId,
      activityType: 'SEQUENCE_COMPLETED',
      actorSource: 'SYSTEM',
      actorName: 'Sequence Automation Runner',
      properties: {
        sequenceId: enrollment.sequenceId,
        sequenceName: enrollment.sequence.name,
        totalSteps: allSteps.length,
      },
    });

    return {
      status: 'COMPLETED',
      message: `Step ${currentStep.stepOrder} (${currentStep.channel}) executed. Sequence completed successfully!`,
      executedStep: currentStep,
      enrollment: updated,
    };
  }
}

/**
 * Immediately stop sequence when a prospect replies to an outbound touchpoint.
 */
export async function exitEnrollmentOnReply(options: {
  personId: string;
  sequenceId?: string;
  replySnippet?: string;
}) {
  const { personId, sequenceId, replySnippet } = options;

  const conditions = [
    eq(sequenceEnrollments.personId, personId),
    eq(sequenceEnrollments.status, 'ACTIVE'),
  ];
  if (sequenceId) {
    conditions.push(eq(sequenceEnrollments.sequenceId, sequenceId));
  }

  const updated = await db
    .update(sequenceEnrollments)
    .set({
      status: 'EXITED_REPLY',
      lastStepExecutedAt: new Date(),
    })
    .where(and(...conditions))
    .returning();

  if (updated.length > 0) {
    await logTimelineActivity({
      entityType: 'person',
      entityId: personId,
      activityType: 'SEQUENCE_EXITED_ON_REPLY',
      actorSource: 'SYSTEM',
      actorName: 'Inbound Reply Detector',
      properties: {
        exitedEnrollmentCount: updated.length,
        replySnippet,
      },
    });
  }

  return {
    exitedCount: updated.length,
    enrollments: updated,
  };
}

/**
 * Pause or resume an enrollment.
 */
export async function setEnrollmentStatus(enrollmentId: string, status: 'ACTIVE' | 'PAUSED') {
  const [updated] = await db
    .update(sequenceEnrollments)
    .set({
      status,
      nextStepDueAt: status === 'ACTIVE' ? new Date() : undefined,
    })
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .returning();

  return updated;
}

/**
 * Get detailed sequence progress report.
 */
export async function getSequenceProgress(enrollmentId: string) {
  const enrollment = await db.query.sequenceEnrollments.findFirst({
    where: eq(sequenceEnrollments.id, enrollmentId),
    with: {
      sequence: {
        with: {
          steps: { orderBy: [asc(sequenceSteps.stepOrder)] },
        },
      },
      person: true,
      company: true,
    },
  });

  if (!enrollment) throw new Error(`Enrollment ${enrollmentId} not found`);

  const stepsWithStatus = enrollment.sequence.steps.map((step) => {
    let stepStatus: 'COMPLETED' | 'CURRENT' | 'UPCOMING';
    if (enrollment.status === 'COMPLETED' || step.stepOrder < enrollment.currentStep) {
      stepStatus = 'COMPLETED';
    } else if (step.stepOrder === enrollment.currentStep && enrollment.status === 'ACTIVE') {
      stepStatus = 'CURRENT';
    } else {
      stepStatus = 'UPCOMING';
    }

    return {
      ...step,
      status: stepStatus,
    };
  });

  return {
    enrollmentId: enrollment.id,
    status: enrollment.status,
    currentStep: enrollment.currentStep,
    totalSteps: enrollment.sequence.steps.length,
    nextStepDueAt: enrollment.nextStepDueAt,
    lastStepExecutedAt: enrollment.lastStepExecutedAt,
    sequence: {
      id: enrollment.sequence.id,
      name: enrollment.sequence.name,
      description: enrollment.sequence.description,
    },
    person: {
      id: enrollment.person.id,
      name: `${enrollment.person.firstName || ''} ${enrollment.person.lastName || ''}`.trim(),
      email: enrollment.person.email,
    },
    company: enrollment.company ? {
      id: enrollment.company.id,
      name: enrollment.company.name,
      domainName: enrollment.company.domainName,
    } : null,
    steps: stepsWithStatus,
  };
}

/**
 * List all sequences with stats.
 */
export async function listSequences(organizationId?: string) {
  const allSequences = await db.query.sequences.findMany({
    where: organizationId ? eq(sequences.organizationId, organizationId) : undefined,
    with: {
      steps: { orderBy: [asc(sequenceSteps.stepOrder)] },
      enrollments: true,
    },
    orderBy: [desc(sequences.createdAt)],
  });

  return allSequences.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    isActive: s.isActive,
    stepCount: s.steps.length,
    activeEnrollmentsCount: s.enrollments.filter((e) => e.status === 'ACTIVE').length,
    completedEnrollmentsCount: s.enrollments.filter((e) => e.status === 'COMPLETED').length,
    exitedReplyCount: s.enrollments.filter((e) => e.status === 'EXITED_REPLY').length,
    steps: s.steps,
  }));
}
