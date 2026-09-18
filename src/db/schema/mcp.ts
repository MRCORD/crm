import { pgSchema, uuid, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { users, apiKeys } from './system';

export const mcpSchema = pgSchema('mcp');

// ============================================================================
// 1. MCP CONNECTED CLIENTS & AGENTS (Claude Desktop, Cursor, LangGraph, etc.)
// ============================================================================
export const mcpClients = mcpSchema.table('mcp_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(), // e.g. 'Claude Desktop (CEO)', 'Cursor (Engineer)', 'LangGraph BDR Swarm'
  clientType: text('client_type').default('STDIO').notNull(), // 'STDIO', 'HTTP_SSE', 'REMOTE_AGENT'
  apiKeyId: text('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
  allowedTools: text('allowed_tools').array().default(['*']).notNull(), // ['*'] or specific tools
  isActive: boolean('is_active').default(true).notNull(),
  lastConnectedAt: timestamp('last_connected_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 2. MCP TOOL CALL RECEIPTS (Immutable Audit Ledger)
// ============================================================================
export const mcpToolCallReceipts = mcpSchema.table('mcp_tool_call_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => mcpClients.id, { onDelete: 'set null' }),
  toolName: text('tool_name').notNull(), // 'crm_update_opportunity', 'polygres_graph_search'
  toolInput: jsonb('tool_input').notNull(),
  toolOutput: jsonb('tool_output'),
  targetObject: text('target_object'), // 'companies', 'people', 'opportunities'
  targetRecordId: uuid('target_record_id'),
  status: text('status').notNull(), // 'SUCCESS', 'FAILED', 'WAITING_FOR_APPROVAL', 'REJECTED'
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 3. HUMAN-IN-THE-LOOP APPROVAL QUEUE (Gating High-Risk MCP Writes)
// ============================================================================
export const mcpApprovals = mcpSchema.table('mcp_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => mcpClients.id, { onDelete: 'set null' }),
  toolName: text('tool_name').notNull(), // 'crm_send_outbound_email', 'crm_update_stage'
  actionType: text('action_type').notNull(),
  payload: jsonb('payload').notNull(),
  proposedText: text('proposed_text'),
  riskTier: integer('risk_tier').notNull(), // Tier 3 (Policy gated) or Tier 4 (Mandatory approval)
  status: text('status').default('PENDING').notNull(), // 'PENDING', 'APPROVED', 'REJECTED', 'MODIFIED'
  assignedToUserId: text('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewComments: text('review_comments'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
