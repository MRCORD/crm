import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { crmToolSchemas, crmToolHandlers } from './tools';
import { crmResources, readCrmResource } from './resources';
import { crmPrompts } from './prompts';
import { db } from '../db';
import { mcpToolCallReceipts } from '../db/schema';

/**
 * Instantiate and configure the CRM Model Context Protocol (MCP) Server.
 */
export function createCrmMcpServer() {
  const server = new McpServer({
    name: 'crm-mcp-server',
    version: '1.0.0',
  });

  // Helper to wrap tool execution with audit logging
  async function executeWithReceipt<T>(
    toolName: string,
    input: Record<string, unknown>,
    targetObject: string | undefined,
    targetRecordId: string | undefined,
    fn: () => Promise<T>
  ): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const start = performance.now();
    try {
      const result = await fn();
      const durationMs = Math.round(performance.now() - start);

      const isPendingApproval = Boolean(
        result && typeof result === 'object' && 'status' in result && result.status === 'PENDING_APPROVAL'
      );

      // Async audit log to mcp.mcp_tool_call_receipts
      db.insert(mcpToolCallReceipts).values({
        toolName,
        toolInput: input,
        toolOutput: result as Record<string, unknown>,
        targetObject,
        targetRecordId,
        status: isPendingApproval ? 'WAITING_FOR_APPROVAL' : 'SUCCESS',
        durationMs,
      }).catch(err => console.error('[MCP Audit Error]', err));

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: unknown) {
      const durationMs = Math.round(performance.now() - start);
      const errorMessage = error instanceof Error ? error.message : String(error);

      db.insert(mcpToolCallReceipts).values({
        toolName,
        toolInput: input,
        toolOutput: { error: errorMessage },
        targetObject,
        targetRecordId,
        status: 'FAILED',
        durationMs,
      }).catch(err => console.error('[MCP Audit Error]', err));

      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }, null, 2) }],
      };
    }
  }

  // ============================================================================
  // REGISTER MCP TOOLS
  // ============================================================================

  server.tool(
    'crm_search_companies',
    crmToolSchemas.searchCompanies.description,
    crmToolSchemas.searchCompanies.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_search_companies', args, 'companies', undefined, () =>
        crmToolHandlers.searchCompanies(args)
      );
    }
  );

  server.tool(
    'crm_get_company',
    crmToolSchemas.getCompany.description,
    crmToolSchemas.getCompany.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_get_company', args, 'companies', args.companyId, () =>
        crmToolHandlers.getCompany(args)
      );
    }
  );

  server.tool(
    'crm_create_company',
    crmToolSchemas.createCompany.description,
    crmToolSchemas.createCompany.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_create_company', args, 'companies', undefined, () =>
        crmToolHandlers.createCompany(args)
      );
    }
  );

  server.tool(
    'crm_update_opportunity_stage',
    crmToolSchemas.updateOpportunityStage.description,
    crmToolSchemas.updateOpportunityStage.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_update_opportunity_stage', args, 'opportunities', args.opportunityId, () =>
        crmToolHandlers.updateOpportunityStage(args)
      );
    }
  );

  server.tool(
    'crm_create_custom_field',
    crmToolSchemas.createCustomField.description,
    crmToolSchemas.createCustomField.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_create_custom_field', args, args.targetEntity, undefined, () =>
        crmToolHandlers.createCustomField(args)
      );
    }
  );

  server.tool(
    'crm_create_custom_object',
    crmToolSchemas.createCustomObject.description,
    crmToolSchemas.createCustomObject.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_create_custom_object', args, 'custom_object_definitions', undefined, () =>
        crmToolHandlers.createCustomObject(args)
      );
    }
  );

  server.tool(
    'crm_create_custom_record',
    crmToolSchemas.createCustomRecord.description,
    crmToolSchemas.createCustomRecord.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_create_custom_record', args, args.customObjectName, undefined, () =>
        crmToolHandlers.createCustomRecord(args)
      );
    }
  );

  server.tool(
    'crm_search_custom_records',
    crmToolSchemas.searchCustomRecords.description,
    crmToolSchemas.searchCustomRecords.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_search_custom_records', args, args.customObjectName, undefined, () =>
        crmToolHandlers.searchCustomRecords(args)
      );
    }
  );

  server.tool(
    'crm_log_meeting_transcript',
    crmToolSchemas.logMeetingTranscript.description,
    crmToolSchemas.logMeetingTranscript.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_log_meeting_transcript', args, 'interaction_transcripts', undefined, () =>
        crmToolHandlers.logMeetingTranscript(args)
      );
    }
  );

  server.tool(
    'polygres_graph_search',
    crmToolSchemas.polygresGraphSearch.description,
    crmToolSchemas.polygresGraphSearch.parameters.shape,
    async (args) => {
      return executeWithReceipt('polygres_graph_search', args, 'companies', args.companyId, () =>
        crmToolHandlers.polygresGraphSearch(args)
      );
    }
  );

  server.tool(
    'polygres_joint_search',
    crmToolSchemas.polygresJointSearch.description,
    crmToolSchemas.polygresJointSearch.parameters.shape,
    async (args) => {
      return executeWithReceipt('polygres_joint_search', args, 'opportunities', args.opportunityId, () =>
        crmToolHandlers.polygresJointSearch(args)
      );
    }
  );

  server.tool(
    'polygres_recommend_lookalikes',
    crmToolSchemas.polygresRecommendLookalikes.description,
    crmToolSchemas.polygresRecommendLookalikes.parameters.shape,
    async (args) => {
      return executeWithReceipt('polygres_recommend_lookalikes', args, 'companies', undefined, () =>
        crmToolHandlers.polygresRecommendLookalikes(args)
      );
    }
  );

  server.tool(
    'crm_create_tag',
    crmToolSchemas.createTag.description,
    crmToolSchemas.createTag.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_create_tag', args, 'tags', undefined, () =>
        crmToolHandlers.createTag(args)
      );
    }
  );

  server.tool(
    'crm_tag_record',
    crmToolSchemas.tagRecord.description,
    crmToolSchemas.tagRecord.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_tag_record', args, args.taggableType, args.taggableId, () =>
        crmToolHandlers.tagRecord(args)
      );
    }
  );

  server.tool(
    'crm_untag_record',
    crmToolSchemas.untagRecord.description,
    crmToolSchemas.untagRecord.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_untag_record', args, args.taggableType, args.taggableId, () =>
        crmToolHandlers.untagRecord(args)
      );
    }
  );

  server.tool(
    'crm_get_record_tags',
    crmToolSchemas.getRecordTags.description,
    crmToolSchemas.getRecordTags.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_get_record_tags', args, args.taggableType, args.taggableId, () =>
        crmToolHandlers.getRecordTags(args)
      );
    }
  );

  server.tool(
    'crm_search_by_tag',
    crmToolSchemas.searchByTag.description,
    crmToolSchemas.searchByTag.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_search_by_tag', args, args.taggableType, undefined, () =>
        crmToolHandlers.searchByTag(args)
      );
    }
  );

  server.tool(
    'crm_get_timeline',
    crmToolSchemas.getTimeline.description,
    crmToolSchemas.getTimeline.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_get_timeline', args, args.entityType, args.entityId, () =>
        crmToolHandlers.getTimeline(args)
      );
    }
  );

  server.tool(
    'crm_log_timeline_activity',
    crmToolSchemas.logTimelineActivity.description,
    crmToolSchemas.logTimelineActivity.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_log_timeline_activity', args, args.entityType, args.entityId, () =>
        crmToolHandlers.logTimelineActivity(args)
      );
    }
  );

  server.tool(
    'crm_create_view',
    crmToolSchemas.createView.description,
    crmToolSchemas.createView.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_create_view', args, args.targetEntity, undefined, () =>
        crmToolHandlers.createView(args)
      );
    }
  );

  server.tool(
    'crm_list_views',
    crmToolSchemas.listViews.description,
    crmToolSchemas.listViews.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_list_views', args, args.targetEntity, undefined, () =>
        crmToolHandlers.listViews(args)
      );
    }
  );

  server.tool(
    'crm_run_view',
    crmToolSchemas.runView.description,
    crmToolSchemas.runView.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_run_view', args, args.targetEntity, args.viewId, () =>
        crmToolHandlers.runView(args)
      );
    }
  );

  server.tool(
    'crm_delete_view',
    crmToolSchemas.deleteView.description,
    crmToolSchemas.deleteView.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_delete_view', args, undefined, args.viewId, () =>
        crmToolHandlers.deleteView(args)
      );
    }
  );

  server.tool(
    'crm_find_duplicates',
    crmToolSchemas.findDuplicates.description,
    crmToolSchemas.findDuplicates.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_find_duplicates', args, args.entityType, args.recordId, () =>
        crmToolHandlers.findDuplicates(args)
      );
    }
  );

  server.tool(
    'crm_list_merge_candidates',
    crmToolSchemas.listMergeCandidates.description,
    crmToolSchemas.listMergeCandidates.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_list_merge_candidates', args, args.entityType, undefined, () =>
        crmToolHandlers.listMergeCandidates(args)
      );
    }
  );

  server.tool(
    'crm_merge_records',
    crmToolSchemas.mergeRecords.description,
    crmToolSchemas.mergeRecords.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_merge_records', args, args.entityType, args.primaryRecordId, () =>
        crmToolHandlers.mergeRecords(args)
      );
    }
  );

  server.tool(
    'crm_dismiss_merge_candidate',
    crmToolSchemas.dismissMergeCandidate.description,
    crmToolSchemas.dismissMergeCandidate.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_dismiss_merge_candidate', args, undefined, args.candidateId, () =>
        crmToolHandlers.dismissMergeCandidate(args)
      );
    }
  );

  server.tool(
    'crm_get_company_hierarchy',
    crmToolSchemas.getCompanyHierarchy.description,
    crmToolSchemas.getCompanyHierarchy.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_get_company_hierarchy', args, 'company', args.companyId, () =>
        crmToolHandlers.getCompanyHierarchy(args)
      );
    }
  );

  server.tool(
    'crm_set_parent_company',
    crmToolSchemas.setParentCompany.description,
    crmToolSchemas.setParentCompany.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_set_parent_company', args, 'company', args.companyId, () =>
        crmToolHandlers.setParentCompany(args)
      );
    }
  );

  server.tool(
    'crm_create_sequence',
    crmToolSchemas.createSequence.description,
    crmToolSchemas.createSequence.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_create_sequence', args, undefined, undefined, () =>
        crmToolHandlers.createSequence(args)
      );
    }
  );

  server.tool(
    'crm_list_sequences',
    crmToolSchemas.listSequences.description,
    crmToolSchemas.listSequences.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_list_sequences', args, undefined, undefined, () =>
        crmToolHandlers.listSequences(args)
      );
    }
  );

  server.tool(
    'crm_enroll_in_sequence',
    crmToolSchemas.enrollInSequence.description,
    crmToolSchemas.enrollInSequence.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_enroll_in_sequence', args, 'person', args.personId, () =>
        crmToolHandlers.enrollInSequence(args)
      );
    }
  );

  server.tool(
    'crm_advance_sequence_step',
    crmToolSchemas.advanceSequenceStep.description,
    crmToolSchemas.advanceSequenceStep.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_advance_sequence_step', args, 'sequence_enrollment', args.enrollmentId, () =>
        crmToolHandlers.advanceSequenceStep(args)
      );
    }
  );

  server.tool(
    'crm_get_sequence_progress',
    crmToolSchemas.getSequenceProgress.description,
    crmToolSchemas.getSequenceProgress.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_get_sequence_progress', args, 'sequence_enrollment', args.enrollmentId, () =>
        crmToolHandlers.getSequenceProgress(args)
      );
    }
  );

  server.tool(
    'crm_set_sequence_enrollment_status',
    crmToolSchemas.setEnrollmentStatus.description,
    crmToolSchemas.setEnrollmentStatus.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_set_sequence_enrollment_status', args, 'sequence_enrollment', args.enrollmentId, () =>
        crmToolHandlers.setEnrollmentStatus(args)
      );
    }
  );

  server.tool(
    'crm_exit_sequence_on_reply',
    crmToolSchemas.exitSequenceOnReply.description,
    crmToolSchemas.exitSequenceOnReply.parameters.shape,
    async (args) => {
      return executeWithReceipt('crm_exit_sequence_on_reply', args, 'person', args.personId, () =>
        crmToolHandlers.exitSequenceOnReply(args)
      );
    }
  );

  // ============================================================================
  // REGISTER MCP RESOURCES
  // ============================================================================

  server.resource(
    'pipeline_summary',
    'crm://pipeline/summary',
    async (uri) => {
      const text = await readCrmResource(uri.href);
      return {
        contents: [{ uri: uri.href, text, mimeType: 'application/json' }],
      };
    }
  );

  // ============================================================================
  // REGISTER MCP PROMPTS
  // ============================================================================

  server.prompt(
    crmPrompts.preCallDossier.name,
    crmPrompts.preCallDossier.description,
    { companyId: z.string().describe('The UUID of the company') },
    ({ companyId }) => crmPrompts.preCallDossier.generate(companyId)
  );

  server.prompt(
    crmPrompts.dealRiskReview.name,
    crmPrompts.dealRiskReview.description,
    { opportunityId: z.string().describe('The UUID of the opportunity') },
    ({ opportunityId }) => crmPrompts.dealRiskReview.generate(opportunityId)
  );

  return server;
}
