import { z } from 'zod';

export const crmPrompts = {
  preCallDossier: {
    name: 'pre_call_dossier',
    description: 'Generate a 1-page executive pre-meeting briefing for an upcoming customer call.',
    arguments: [
      {
        name: 'companyId',
        description: 'The UUID of the company in the CRM',
        required: true,
      },
    ],
    generate(companyId: string) {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Please generate a comprehensive 1-page pre-meeting briefing for company ID ${companyId}.
Use the tool 'crm_get_company' to retrieve the company's contacts, open opportunities, and recent transcripts.
Then, use 'polygres_graph_search' to find unresolved objections or past commitments in the communication graph.
Summarize:
1. Executive Overview & Deal State
2. Key Stakeholders Attending & Roles
3. Past Commitments & Unresolved Blockers
4. Recommended Discovery Questions & Competitive Positioning.`,
            },
          },
        ],
      };
    },
  },

  dealRiskReview: {
    name: 'deal_risk_review',
    description: 'Analyze an active opportunity for churn risk or closing blockers using conversational transcripts and sentiment.',
    arguments: [
      {
        name: 'opportunityId',
        description: 'The UUID of the opportunity to analyze',
        required: true,
      },
    ],
    generate(opportunityId: string) {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Perform a rigorous reality-grounded deal risk review for opportunity ID ${opportunityId}.
Use 'polygres_joint_search' around this opportunity searching for keywords like "budget, competitor, legal, delay, objection".
Evaluate:
1. Deal Velocity & Engagement Consistency
2. Buyer Sentiment vs. Current Forecast Stage
3. Red Flags & Vulnerabilities
4. Recommended Closing Action Items.`,
            },
          },
        ],
      };
    },
  },
};
