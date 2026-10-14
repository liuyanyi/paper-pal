import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function body(name, next) { return source.slice(source.indexOf(`function ${name}(`), source.indexOf(`function ${next}(`)); }
test('single-click enters editing for both math and ordinary prose', () => {
  let activated = 0;
  const context = { requestAnimationFrame: f => f(), window: { getSelection: () => ({ isCollapsed: true }) }, activateBlockEditing: () => activated++ };
  vm.createContext(context);
  vm.runInContext(body('handleBlockPointerUp','handleBlockInput'), context);
  const event = hasMath => ({button:0,target:{closest:()=>false},currentTarget:{querySelector:()=>hasMath}});
  context.handleBlockPointerUp(event(true)); assert.equal(activated,1);
  context.handleBlockPointerUp(event(false)); assert.equal(activated,2);
});
test('blur schedules math rendering for normal and proposal paragraphs', () => {
  let rendered = 0;
  const context = {requestAnimationFrame:f=>f(),renderMath:()=>rendered++,renderReviewText:()=>{}};
  vm.createContext(context);
  vm.runInContext(body('deactivateBlockEditing','handleBlockPointerUp'),context);
  for (const preview of [false,true]) {
    const element={contentEditable:'true',classList:{remove:()=>{}},dataset:preview?{reviewPreviewHidden:'true'}:{},replaceChildren:()=>{}};
    context.deactivateBlockEditing(element); assert.equal(element.contentEditable,'false');
  }
  assert.equal(rendered,2);
});
