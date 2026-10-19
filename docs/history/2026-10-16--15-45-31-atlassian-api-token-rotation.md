# Atlassian API token rotation

**Date:** 2026-10-16 15:45 (Europe/Budapest)

## Summary

Rotated the Atlassian Rovo MCP personal API token in the project-level MCP
config. The previous token authenticated but lacked the
`search:jira:agent-interface` scope, so Jira tool calls returned
`403 Insufficient scopes`.

## Root cause

- Org admin enabled API-token authentication for the Rovo MCP server
  (earlier error `You don't have permission to connect via API token`
  disappeared).
- The remaining failure was a scope gap: the old token had no
  `*-:agent-interface` scopes, so `searchJiraIssuesUsingJql` failed with
  `Required: [search:jira:agent-interface]`.

## What changed

- [`.roo/mcp.json`](../../.roo/mcp.json) — replaced the `Authorization`
  header value with a new `Basic <base64(email:token)>` built from the newly
  created token (pre-selected Rovo MCP scopes via
  `https://id.atlassian.com/manage-profile/security/api-tokens?autofillToken&expiryDays=max&appId=mcp-v2&selectedScopes=all`).

## Notes / follow-ups

- The live MCP connection must be reloaded (restart MCP server / reload
  window) for the new token to take effect; the running session still holds
  the old token until then.
- The global `mcp_settings.json` only configures the custom `mcp-server`
  (filesystem/ssh/cmd tools) and does **not** contain the Atlassian token;
  no change needed there.

## Update 15:55 — Jira access working

After the second token and an MCP reload, `searchJiraIssuesUsingJql` succeeds.
JQL must be bounded (e.g. `created >= -30d ORDER BY created DESC`); an
unbounded `ORDER BY created DESC` is rejected with
`400 Unbounded JQL queries are not allowed here`. Project key is `AIS`.

## Update 15:54 — second token rotation

A second token was pasted and re-encoded into [`.roo/mcp.json`](../../.roo/mcp.json).
Verification still pending an MCP reload — the running session keeps the previous
scope-less token, so tool calls still return the same `401 missing scope claim`
until the connection is restarted.

## Update 15:47 — token has no scope claim

After reloading the MCP connection, all Atlassian tools (including
`getAccessibleAtlassianResources`) returned
`401 Unable to resolve user scopes from the user-context token — the session
token is missing the scope claim`. The newly provided token authenticates the
user but carries **no** `*-:agent-interface` scope claim, i.e. it was created
as a plain personal API token, not via the Rovo MCP pre-selected-scope link.
It must be recreated using
`https://id.atlassian.com/manage-profile/security/api-tokens?autofillToken&expiryDays=max&appId=mcp-v2&selectedScopes=all`
and selecting at least `read:jira:agent-interface`, `search:jira:agent-interface`,
`write:jira:agent-interface`.
