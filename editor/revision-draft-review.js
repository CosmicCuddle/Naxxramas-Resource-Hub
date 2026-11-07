/* PRIVATE EXPERIMENT: create a revision-bound local resource review draft
 * from an independently trusted and fully verified source snapshot.
 *
 * No file writes, network, GitHub Save, source conversion or publication.
 * Does not select a canonical 415/418 source layout. Never trust a manifest
 * as its own authority: caller must obtain trust from a verified Git source.
 */
(function(root,factory){
  'use strict';
  var node=typeof module==='object'&&!!module.exports;
  var reader=node?require('./revision-source-reader.js'):root.NaxxRevisionSourceReader;
  var rules=node?require('./resource-title-core.js'):root.NaxxResourceTitles;
  var api=factory(reader,rules);
  if(node)module.exports=api;else root.NaxxRevisionDraftReview=api;
})(typeof globalThis==='object'?globalThis:this,function(reader,rules){
  'use strict';
  var COUNT=414,FORMAT='naxx-private-versioned-resource-draft-v1';
  function object(v){
    return !!v&&typeof v==='object'&&!Array.isArray(v);
  }
  function cloneSnapshot(snapshot,trust){
    // Capture all input collections before asynchronous SHA verification;
    // preserve unknown keys so the independent verifier rejects them.
    if(!object(snapshot)||!object(snapshot.manifest)||
       !Array.isArray(snapshot.manifest.resources)||
       !object(snapshot.shell)||!Array.isArray(snapshot.shell.separators)||
       !Array.isArray(snapshot.fragments)||!object(trust)||
       !Array.isArray(trust.expectedRecordPaths))
      throw Error('A complete, separately trusted resource revision is required.');
    return {
      snapshot:{
        manifest:Object.assign({},snapshot.manifest,{
          resources:snapshot.manifest.resources.map(function(item){
            return object(item)?Object.assign({},item):item;
          })
        }),
        shell:Object.assign({},snapshot.shell,{
          separators:snapshot.shell.separators.slice()
        }),
        fragments:snapshot.fragments.slice()
      },
      trust:Object.assign({},trust,{
        expectedRecordPaths:trust.expectedRecordPaths.slice()
      })
    };
  }
  function copyChanges(changes){
    if(!Array.isArray(changes)||changes.length<1||changes.length>COUNT)
      throw Error('Choose at least one and at most 414 resource changes.');
    var seen=new Set();
    var result=changes.map(function(item){
      if(!object(item)||!Number.isInteger(item.index)||
         item.index<0||item.index>=COUNT||seen.has(item.index))
        throw Error('Invalid or duplicate resource index in the draft.');
      seen.add(item.index);
      var keys=Object.keys(item).sort().join(',');
      if(keys!=='index,title'&&keys!=='content,index'&&
         keys!=='content,index,title')
        throw Error('Unexpected resource draft field.');
      var copy={index:item.index};
      if(Object.prototype.hasOwnProperty.call(item,'title')){
        if(!rules||typeof rules.titleValid!=='function'||
           !rules.titleValid(item.title))
          throw Error('The edited resource title is invalid.');
        copy.title=item.title;
      }
      if(Object.prototype.hasOwnProperty.call(item,'content')){
        if(!rules||typeof rules.contentValid!=='function'||
           !rules.contentValid(item.content))
          throw Error('The edited resource content is invalid.');
        copy.content=item.content;
      }
      return copy;
    });
    return result.sort(function(a,b){return a.index-b.index;});
  }
  async function prepare(snapshot,trust,cryptoObj,changes){
    if(!reader||typeof reader.inspect!=='function')
      throw Error('The private revision verifier is unavailable.');
    var captured=cloneSnapshot(snapshot,trust);
    var edits=copyChanges(changes);
    var inspected=await reader.inspect(
      captured.snapshot,captured.trust,cryptoObj);
    if(!inspected||inspected.readOnly!==true||
       inspected.resourcesVerified!==COUNT||
       inspected.revision!==captured.snapshot.manifest.revision||
       inspected.sourceSha256!==captured.snapshot.manifest.sourceSha256)
      throw Error('The full resource revision was not verified.');
    var entries=edits.map(function(item){
      var expected=captured.snapshot.manifest.resources[item.index];
      if(!expected||typeof expected.sha256!=='string')
        throw Error('Missing resource hash for the reviewed edit.');
      var entry={index:item.index,expectedSha256:expected.sha256};
      if(Object.prototype.hasOwnProperty.call(item,'title'))
        entry.title=item.title;
      if(Object.prototype.hasOwnProperty.call(item,'content'))
        entry.content=item.content;
      return Object.freeze(entry);
    });
    // Identical to the previously-tested disposable versioned-draft schema.
    // A future independent plan() must reject unchanged edits and conflicts.
    return Object.freeze({
      format:FORMAT,sourceBaselineSha256:reader.ANCHOR,
      revision:inspected.revision,sourceSha256:inspected.sourceSha256,
      changes:Object.freeze(entries)
    });
  }
  return Object.freeze({FORMAT:FORMAT,prepare:prepare});
});
