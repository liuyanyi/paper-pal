# Fork changes

This fork extends [claire1217/paper-pal](https://github.com/claire1217/paper-pal)
for chapter-based manuscripts and projects with their own writing and build workflows.

## Project instructions, skills and plans

Every agent invocation can include required project-relative files in full, with
SHA-256 values. Missing or out-of-project files fail the invocation. Files are read
again for each request so changes to plans are picked up without restarting.
Document-specific guidance accompanies rewrite, review and chat requests; unscoped
tasks include all configured document guidance. Linked references remain the agent's
responsibility. Supplying instructions does not prove that a model followed them.

```json
{
  "latex": { "enabled": false },
  "agent": {
    "provider": "codex",
    "requiredGuidanceFiles": ["AGENTS.md", ".agents/skills/writing/SKILL.md", "plans/overview.md"],
    "documentGuidance": {
      "chapter1.tex": ["plans/chapter1.md"]
    },
    "referenceBuildManifest": "build/latest-success.json"
  }
}
```

These are illustrative paths; configure existing files in your project. Required
guidance is additional to the ordinary manuscript context budget, with a separate
one-million-character limit and no silent truncation. It is sent to the selected
backend, including API backends. Do not list secrets or private runtime traces.

## Chapter hierarchy and review scope

Chapter-based documents retain chapter, section, subsection and subsubsection
levels, chapter counter resets and appendix letters. Article-style documents keep
their original section numbering. Structure groups chapter-based content by chapter.
The review button sends the active heading and source etag. Review input ends at the
next same-or-higher heading in that source file, and findings outside that interval
are discarded. Stale source returns HTTP 409. Cross-file included content is tracked
by Structure separately; this endpoint does not aggregate a multi-file review.

## Citation numbers from an existing build

`upcite` displays superscript numbers and `inlinecite` inline numbers, retaining
optional locators. A configured successful-build manifest points at
`runs/<build_id>/<main-stem>.aux` next to it. The aux content must match `aux_sha256`.
The manifest must contain `status: "success"` and a safe `build_id`.
Document responses expose the build ID and artifact path. Saved success is not a
claim that the build matches current source; no compilation is triggered. With no
manifest configured, the original aux lookup remains available.

## Formula editing

Single-click still enters paragraph editing and exposes inline LaTeX. Leaving the
paragraph restores formula rendering, including when no text was changed.

## Validation and limits

Tests use synthetic manuscripts, fake CLI agents and local mock API servers.
Coverage includes heading hierarchy, review scope and stale-source checks, required
guidance loading, immutable aux citation numbers, source-range edits and formula
focus behavior. No real AI response or LaTeX compilation is needed by these tests.
Run `npm test` with Node 20 or newer. Native Windows may skip platform-specific
process-group and symlink checks.

The fork does not include a manuscript, project credentials, review history or local
runtime configuration. Existing read-only agent execution and explicit acceptance
of source changes remain in place.
