'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {layoutProbe,PAGES}=require('../tools/private-site-layout-probes.cjs');
test('all ten private browser layouts have syntactically valid inert expressions',()=>{
  assert.equal(PAGES.size,5);
  for(const name of PAGES){
    const expression=layoutProbe(name);
    assert.doesNotThrow(()=>new Function('return '+expression+';'));
    assert.ok(expression.includes('originalAdminButtonPreserved'));
    assert.ok(expression.includes('originalPasswordControlPreserved'));
    assert.ok(expression.includes('noHorizontalDocumentOverflow'));
    assert.ok(expression.includes('gridInsideViewport'));
    for(const dangerous of ['window.open(','.submit(','.click(','localStorage.',
      'sessionStorage.','fetch(','XMLHttpRequest(','sendBeacon(']){
      assert.ok(!expression.includes(dangerous),'Disallowed effect: '+dangerous);
    }
  }
});
test('native Game Clients visual-admin toggle is exception-safe and restored',()=>{
  const expr=layoutProbe('clients');
  assert.ok(expr.includes("getComputedStyle"));
  assert.ok(expr.includes("visual-admin-active"));
  assert.ok(expr.includes("finally"));
  assert.ok(expr.includes("visitorDuplicateCardHidden"));
  assert.ok(expr.includes("adminOriginalCardVisible"));
  assert.ok(expr.includes("adminNewGuideHidden"));
  assert.ok(expr.includes("visitorStateRestored"));
});
test('private layout probe rejects unspecified route rather than inspecting another page',()=>{
  for(const p of ['',null,undefined,'editor','admin','clients/','apply/']){
    assert.throws(()=>layoutProbe(p),/Unknown protected browser layout route/);
  }
});
