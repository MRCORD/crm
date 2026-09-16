export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '3rem', maxWidth: 720 }}>
      <h1>Mysios CRM</h1>
      <p>
        Self-hosted, MCP-native CRM. Connect Claude Desktop, Cursor, or any
        agent swarm via the Model Context Protocol to query and act on this
        CRM&apos;s data directly.
      </p>
      <p>
        This page hosts the Clerk identity webhook (
        <code>/api/webhooks/clerk</code>) that keeps <code>system.users</code>
        , <code>system.organizations</code>, and{' '}
        <code>system.organization_members</code> in sync with Clerk.
      </p>
    </main>
  );
}
