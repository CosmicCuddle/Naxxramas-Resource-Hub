'use strict';
/*
 * Candidate SOURCE-TREE preflight, not a repository migration or export.
 * Constructs 414 independent resource paths in a disposable private folder,
 * verifies the complete compatibility source, tests rollback, deletes folder.
 * Never executes source JS, writes into the checkout or displays source data.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {splitInMemory,restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {planChangeSet}=require('./rehearse-resource-change-set.cjs');
const BASE='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const COUNT=414,ROOT='content/legacy',MANIFEST=ROOT+'/manifest.json';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const utf8=value=>Buffer.from(value,'utf8');
const resourcePath=index=>ROOT+'/resources/'+String(index+1).padStart(4,'0')+'.fragment';
const layout={
  prefix:ROOT+'/layout/prefix.utf8',
  suffix:ROOT+'/layout/suffix.utf8',
  separators:ROOT+'/layout/separators.json'
};
function originalSplit(original){
  if(!Buffer.isBuffer(original)||sha(original)!==BASE)
    throw Error('Expected the exact original site-content.html SHA-256.');
  return splitInMemory(original);
}
function diskPath(root,relative){
  // The paths come only from fixed constants, never from a user draft.
  if(!relative.startsWith(ROOT+'/')||relative.includes('..')||relative.includes('\\'))
    throw Error('Unexpected candidate path.');
  return path.join(root,...relative.split('/'));
}
function writeFile(root,relative,bytes,newFile=true){
  const file=diskPath(root,relative);
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  if(!newFile){
    const st=fs.lstatSync(file);
    if(!st.isFile()||st.isSymbolicLink())throw Error('Unsafe candidate file type.');
  }
  fs.writeFileSync(file,bytes,{flag:newFile?'wx':'w',mode:0o600});
}
function readFile(root,relative){
  const file=diskPath(root,relative),st=fs.lstatSync(file);
  if(!st.isFile()||st.isSymbolicLink())throw Error('Candidate file missing or not regular.');
  return fs.readFileSync(file);
}
function expectedPaths(){
  return new Set([MANIFEST,...Object.values(layout),
    ...Array.from({length:COUNT},(_,i)=>resourcePath(i))]);
}
function listTree(root){
  const actual=[];
  function walk(dir){
    for(const item of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,item.name),rel=path.relative(root,full).split(path.sep).join('/');
      const stat=fs.lstatSync(full);
      if(stat.isSymbolicLink())throw Error('Candidate tree contains a symlink.');
      if(stat.isDirectory())walk(full);
      else if(stat.isFile())actual.push(rel);
      else throw Error('Candidate tree contains an unsafe file type.');
    }
  }
  walk(root);
  const wanted=expectedPaths();
  if(actual.length!==wanted.size||actual.some(item=>!wanted.has(item)))
    throw Error('Candidate tree contains missing or unapproved files.');
  return actual.length;
}
function stateFromPlan(split,plan){
  const records=split.records.slice();
  if(plan){
    for(const [index,value] of plan.fragments){
      if(!Number.isInteger(index)||index<0||index>=COUNT)throw Error('Invalid planned fragment.');
      records[index]=value;
    }
  }
  const output=restoreInMemory(split,records);
  const paths=plan?[...plan.fragments.keys()].sort((a,b)=>a-b).map(resourcePath):[];
  const metadata={
    format:'naxx-proposed-legacy-source-tree-preflight-v1',
    candidateOnly:true,githubReady:false,publishable:false,deployable:false,
    root:ROOT,recordCount:COUNT,
    originalSourceSha256:BASE,originalSourceBytes:split.bytes.length,
    stagedSourceSha256:sha(output),stagedSourceBytes:output.length,
    files:Object.fromEntries(Object.entries(layout).map(([key,file])=>{
      const text=key==='prefix'?split.source.slice(0,split.arrayBegin):
        key==='suffix'?split.source.slice(split.arrayEnd):JSON.stringify(split.separators);
      return [key,{path:file,sha256:sha(utf8(text))}];
    })),
    resources:records.map((record,index)=>({
      position:index+1,path:resourcePath(index),
      originalSha256:sha(utf8(split.records[index])),
      stagedSha256:sha(utf8(record)),
      changed:record!==split.records[index]
    })),
    changedPaths:paths
  };
  return {metadata,records,output};
}
function writeCandidate(root,original,plan){
  const split=originalSplit(original);
  if(plan&&(!plan.split||plan.split.source!==split.source||
     plan.manifest?.originalSourceSha256!==BASE))
    throw Error('A changed plan is not based on this original source.');
  const state=stateFromPlan(split,plan);
  writeFile(root,layout.prefix,utf8(split.source.slice(0,split.arrayBegin)));
  writeFile(root,layout.suffix,utf8(split.source.slice(split.arrayEnd)));
  writeFile(root,layout.separators,utf8(JSON.stringify(split.separators)));
  state.records.forEach((record,index)=>writeFile(root,resourcePath(index),utf8(record)));
  writeFile(root,MANIFEST,utf8(JSON.stringify(state.metadata,null,2)+'\n'));
  return state;
}
function verifyCandidate(root,original,plan=null){
  const split=originalSplit(original),expected=stateFromPlan(split,plan);
  const count=listTree(root);
  const saved=JSON.parse(readFile(root,MANIFEST).toString('utf8'));
  const expectedSerialized=JSON.stringify(expected.metadata);
  if(JSON.stringify(saved)!==expectedSerialized)
    throw Error('Candidate manifest does not match approved deterministic source plan.');
  for(const [key,meta] of Object.entries(saved.files)){
    if(meta.path!==layout[key]||sha(readFile(root,meta.path))!==meta.sha256)
      throw Error('Candidate layout checksum mismatch.');
  }
  const prefix=readFile(root,layout.prefix);
  const suffix=readFile(root,layout.suffix);
  const separators=readFile(root,layout.separators);
  if(!prefix.equals(utf8(split.source.slice(0,split.arrayBegin)))||
     !suffix.equals(utf8(split.source.slice(split.arrayEnd)))||
     !separators.equals(utf8(JSON.stringify(split.separators))))
    throw Error('Candidate original layout bytes changed.');
  const records=[];let unchanged=0;
  for(let index=0;index<COUNT;index++){
    const meta=saved.resources[index];
    if(meta.position!==index+1||meta.path!==resourcePath(index)||
       meta.originalSha256!==sha(utf8(split.records[index])))
      throw Error('Candidate record order or original checksum changed.');
    const data=readFile(root,meta.path);
    if(sha(data)!==meta.stagedSha256||!data.equals(utf8(expected.records[index])))
      throw Error('Candidate resource differs from verified intended content.');
    if(!data.equals(utf8(split.records[index]))&&meta.changed!==true)
      throw Error('Candidate file was modified without manifest approval.');
    if(data.equals(utf8(split.records[index])))unchanged++;
    records.push(data.toString('utf8'));
  }
  const rebuilt=restoreInMemory(split,records);
  if(!rebuilt.equals(expected.output)||
     sha(rebuilt)!==saved.stagedSourceSha256||
     rebuilt.length!==saved.stagedSourceBytes)
    throw Error('Candidate compatibility source was not reconstructed exactly.');
  return {
    format:saved.format,candidateOnly:true,
    fileCount:count,resourceFiles:COUNT,changedFragments:COUNT-unchanged,
    unchangedFragments:unchanged,
    originalSourceByteIdentical:plan===null&&rebuilt.equals(original),
    intendedSourceByteIdentical:rebuilt.equals(expected.output),
    originalLayoutByteIdentical:true,
    originalSourceSha256:BASE,stagedSourceSha256:sha(rebuilt),
    candidateTreeBytes:[...expectedPaths()].reduce((total,rel)=>total+readFile(root,rel).length,0),
    githubFilesWritten:0,published:false,sourceValuesPrinted:false
  };
}
function rollbackCandidate(root,original,plan){
  if(!plan||!plan.fragments?.size)throw Error('Expected a changed source to roll back.');
  verifyCandidate(root,original,plan); // fail closed before changing candidate files
  const split=originalSplit(original);
  for(const index of plan.fragments.keys())
    writeFile(root,resourcePath(index),utf8(split.records[index]),false);
  const baseline=stateFromPlan(split,null);
  writeFile(root,MANIFEST,utf8(JSON.stringify(baseline.metadata,null,2)+'\n'),false);
  return verifyCandidate(root,original,null);
}
async function withCandidateTree(original,draft,fn){
  if(typeof fn!=='function')throw Error('A private synchronous verifier is required.');
  const split=originalSplit(original);
  const plan=draft?await planChangeSet(original,draft):null;
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-candidate-tree-'));
  fs.chmodSync(root,0o700);
  try{
    writeCandidate(root,original,plan);
    return fn(root,plan,split);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
}
async function rehearse(original,draft){
  let rootName;
  const reports=await withCandidateTree(original,draft,(root,plan)=>{
    rootName=root;
    const staged=verifyCandidate(root,original,plan);
    const restored=plan?rollbackCandidate(root,original,plan):
      verifyCandidate(root,original,null);
    return {staged,restored};
  });
  if(!rootName||fs.existsSync(rootName))
    throw Error('Candidate directory cleanup was not confirmed.');
  return {
    format:'naxx-candidate-tree-rehearsal-v1',privateTemporaryOnly:true,
    staged:reports.staged,rollback:reports.restored,
    rollbackExactOriginal:reports.restored.originalSourceByteIdentical,
    temporaryDirectoryDeleted:true,
    publicFilesModified:false
  };
}
if(require.main===module){
  (async()=>{
    const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    const draft={format:'naxx-local-resource-draft-v2',baselineSha256:BASE,
      changes:[{index:0,title:'Candidate path test title'},
        {index:413,content:'Candidate multiline content.\n\nSecond line.'}]};
    process.stdout.write(JSON.stringify(await rehearse(original,draft),null,2)+'\n');
  })().catch(_=>{
    process.stderr.write('Candidate tree test rejected the input. No original content was printed.\n');
    process.exitCode=1;
  });
}
module.exports={ROOT,MANIFEST,layout,resourcePath,expectedPaths,
  stateFromPlan,writeCandidate,verifyCandidate,rollbackCandidate,withCandidateTree,rehearse};
