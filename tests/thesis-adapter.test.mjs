import test, { after } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { makeProject, startServer, apiOk, api, getDocument, saveBlock, cleanupAll } from "./helpers.mjs";
import { requiredProjectGuidance } from "../agent-providers.mjs";
after(cleanupAll);

test("chapter hierarchy, appendix and scoped review preserve source", async () => {
  const source = String.raw`\documentclass{book}
\begin{document}
\chapter{First}
Opening paragraph.

\section{Alpha}
Alpha paragraph.

\subsection{Details}
Detail paragraph.

\section{Beta}
Beta paragraph.

\chapter{Second}
Second paragraph.

\section{Gamma}
Gamma paragraph.

\appendix
\chapter{Appendix}
\section{Extra}
Extra paragraph.
\end{document}
`;
  const project = await makeProject({ files: { "main.tex": source }, fakeAgent: true });
  const server = await startServer(project.root);
  const outline = await apiOk(server, "/api/outline");
  assert.deepEqual(outline.items.map((i) => [i.title, i.number, i.level]), [
    ["First", "1", 1], ["Alpha", "1.1", 2], ["Details", "1.1.1", 3], ["Beta", "1.2", 2],
    ["Second", "2", 1], ["Gamma", "2.1", 2], ["Appendix", "A", 1], ["Extra", "A.1", 2],
  ]);
  const structure = await apiOk(server, "/api/structure");
  assert.equal(structure.sections.length, 3);
  assert.ok(structure.sections[0].sources.some((i) => i.text.includes("Beta paragraph")));
  assert.ok(structure.sections[0].sources.every((i) => !i.text.includes("Second paragraph")));
  const document = await getDocument(server, "main.tex");
  for (const block of document.blocks) assert.equal(source.slice(block.start, block.end), block.raw);
  const stale = await api(server, "/api/document/review", { method: "POST", body: { path: "main.tex", blockId: outline.items[1].blockId, etag: "stale" } });
  assert.equal(stale.status, 409);
  const review = await apiOk(server, "/api/document/review", { method: "POST", body: { path: "main.tex", blockId: outline.items[1].blockId, etag: document.etag } });
  const run = JSON.parse(await fs.readFile(path.join(project.root, ".fake-agent/last-run.json"), "utf8"));
  assert.equal(run.taskType, "paper_section_review");
  assert.ok(run.reviewSource.includes("Alpha paragraph"));
  assert.ok(run.reviewSource.includes("Detail paragraph"));
  assert.ok(!run.reviewSource.includes("Beta paragraph"));
  assert.ok(!run.reviewSource.includes("Opening paragraph"));
  assert.equal(await fs.readFile(path.join(project.root, "main.tex"), "utf8"), source);
  const alpha = document.blocks.find((b) => b.raw.includes("Alpha paragraph"));
  await saveBlock(server, document, alpha, alpha.raw.replace("Alpha paragraph", "Changed paragraph"));
  assert.equal(await fs.readFile(path.join(project.root, "main.tex"), "utf8"), source.replace("Alpha paragraph", "Changed paragraph"));
});

test("required guidance is complete, fresh, chapter-specific and fails closed", async () => {
  const project = await makeProject({ files: { "main.tex": "\\documentclass{article}\n", "AGENTS.md": "project policy", "skill.md": "skill policy", "one.md": "chapter one", "two.md": "chapter two" } });
  const config = { codex: { requiredGuidanceFiles: ["AGENTS.md", "skill.md"], documentGuidance: { "chapter1.tex": ["one.md"], "chapter2.tex": ["two.md"] } } };
  let prompt = await requiredProjectGuidance(config, project.root, ["chapter1.tex"]);
  assert.match(prompt, /project policy/); assert.match(prompt, /skill policy/); assert.match(prompt, /chapter one/); assert.doesNotMatch(prompt, /chapter two/);
  await fs.writeFile(path.join(project.root, "one.md"), "updated plan");
  assert.match(await requiredProjectGuidance(config, project.root, ["chapter1.tex"]), /updated plan/);
  assert.match(await requiredProjectGuidance(config, project.root, []), /chapter two/);
  await fs.unlink(path.join(project.root, "skill.md"));
  await assert.rejects(requiredProjectGuidance(config, project.root, ["chapter1.tex"]));
});

test("custom citations use immutable successful aux numbers with compilation off", async () => {
  const aux = String.raw`\bibcite{alpha}{{14}{2022}{{Author}}{{Author}}}
\bibcite{beta}{{15}{2023}{{Other}}{{Other}}}`;
  const hash = createHash("sha256").update(aux).digest("hex");
  const source = String.raw`\documentclass{article}
\begin{document}
\section{Intro}
Source\upcite{alpha,beta}. Inline \inlinecite[7]{alpha}.
\end{document}
`;
  const project = await makeProject({ files: {
    "main.tex": source,
    "build/latest-success.json": JSON.stringify({status: "success", build_id: "run-one", aux_sha256: hash}),
    "build/runs/run-one/main.aux": aux,
    "main.aux": String.raw`\bibcite{alpha}{{99}{2022}{{Wrong}}{{Wrong}}}`,
  }, config: { agent: { referenceBuildManifest: "build/latest-success.json" } } });
  const server = await startServer(project.root);
  const document = await getDocument(server, "main.tex");
  const paragraph = document.blocks.find((b) => b.raw.includes("upcite"));
  assert.match(paragraph.display, /\[14, 15\]/);
  assert.match(paragraph.display, /\[14, 7\]/);
  assert.doesNotMatch(paragraph.display, /99|alpha|beta/);
  assert.equal((await apiOk(server, "/api/health")).latex.enabled, false);
  for (const block of document.blocks) assert.equal(source.slice(block.start, block.end), block.raw);
  await saveBlock(server, document, paragraph, paragraph.raw.replace("Source", "Evidence"));
  assert.equal(await fs.readFile(path.join(project.root, "main.tex"), "utf8"), source.replace("Source", "Evidence"));
});
