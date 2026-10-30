# Atlassian (Jira) MCP Integration

**Date:** 2026-10-16

## Summary

Integrated the official cloud-hosted Atlassian MCP server into Zoo Code so the
agent can interact with Jira (and Confluence) for the `zakzag.atlassian.net`
site.

## What was changed

- [`.roo/mcp.json`](../../.roo/mcp.json) — added the `atlassian` server entry:
  - `type: streamable-http` (recommended remote transport in Zoo Code).
  - `url: https://mcp.atlassian.com/v2/mcp` (current recommended v2 endpoint).
  - `headers.Authorization: Basic <base64(email:api_token)>` — headless API-token
    authentication as documented by Atlassian. The base64 value encodes
    `zakzag.dev@gmail.com:<Jira API token>`.
- [`.gitignore`](../../.gitignore) — added `.roo/mcp.json` so the personal API
  token is never committed to version control.

## Verification

A raw streamable-HTTP MCP handshake was executed against
`https://mcp.atlassian.com/v2/mcp`:

1. `initialize` → HTTP 200, `serverInfo.name = atlassian-mcp-server`,
   `protocolVersion = 2025-03-26`.
2. Captured `Mcp-Session-Id` from the initialize response headers.
3. `tools/list` → HTTP 200; returned the primary Atlassian tools including
   `getAccessibleAtlassianResources`, `atlassianUserInfo`, `getJiraIssue`,
   `searchJiraIssuesUsingJql`, `getConfluenceContent`, `executeRead`,
   `executeWrite`, `executeDestructive`, and `search`.

The `.roo/mcp.json` content was validated as parseable JSON, and
`git check-ignore` confirms the file is ignored.

## Notes / follow-ups

- The Jira API token was pasted into a chat message during setup; consider
  rotating it and updating the `Authorization` header afterwards.
- Atlassian requires API-token authentication to be enabled by an org admin
  (Atlassian Administration → Rovo → Rovo MCP server → Authentication). The
  handshake above succeeded, so it is currently enabled for this site.
- `delete_jira` / `manage_jira` permission groups are admin-enabled and disabled
  by default.
