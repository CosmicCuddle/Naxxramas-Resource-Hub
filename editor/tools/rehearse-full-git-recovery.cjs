'use strict';
/*
 * PRIVATE GIT RECOVERY REHEARSAL — NO PUBLIC OUTPUT.
 *
 * A Git bundle backs up all FETCHED reachable refs/commits/tags and tree
 * objects, not remote refs never fetched, reflog-only objects, untracked or
 * ignored files, GitHub settings/secrets, LFS payloads or external services.
 *
 * The tool fails closed on shallow/partial clones, dirty/untracked/ignored
 * files, symlinks, submodules and Git LFS pointers. Its default CLI mode
 * creates a bundle and independent recovered checkout in an OS temp folder
 * and deletes both. It never uploads a GitHub Actions artifact.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process'),crypto=require('node:crypto');
const {inventory}=require('./audit-full-checkout.cjs');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const EXPECTED_SITE='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
function git(root,args,options={}){
  const p=cp.spawnSync('git',args,{
    cwd:root,encoding:options.binary?null:'utf8',maxBuffer:32*1024*1024,
    stdio:['ignore','pipe','pipe'],timeout:options.timeout||180000
  });
  if(p.error||p.status!==0)throw Error('Private Git verification command failed safely.');
  return p.stdout;
}
function rootsEqual(a,b){
  const left=fs.realpathSync(a),right=fs.realpathSync(b);
  if(left===right)return true;
  if(process.platform!=='win32')return false;
  // Windows Git and Node can spell the SAME physical directory differently
  // (e.g. 8.3 short names, slashes, extended path prefixes, drive casing).
  // The GitHub Windows runner proved canonical path strings still differed
  // while BOTH stat identities were identical. Do not trust case-folding:
  // Windows can contain case-sensitive folders with distinct file identities.
  const l=fs.statSync(left),r=fs.statSync(right);
  return l.isDirectory()&&r.isDirectory()&&
    l.dev===r.dev&&l.ino!==0&&l.ino===r.ino;
}
function baseline(root,{requireWebsite=true}={}){
  const top=git(root,['rev-parse','--show-toplevel']).trim();
  if(!rootsEqual(top,root))throw Error('Select the root of a complete Git checkout.');
  if(git(root,['rev-parse','--is-shallow-repository']).trim()!=='false')
    throw Error('Git history is shallow; fetch complete history before backup.');
  if(git(root,['rev-parse','--is-inside-work-tree']).trim()!=='true')
    throw Error('A normal Git worktree is required.');
  // Fail closed if the checkout is a partial/promisor clone.
  const config=git(root,['config','--list','--local']);
  if(/(?:^|\n)(?:extensions\.partialclone|remote\.[^\n=]+\.promisor)=/i.test(config))
    throw Error('Partial/promisor Git clones cannot be backed up as complete history.');
  const status=git(root,['status','--porcelain=v1','-z','--untracked-files=all'],{binary:true});
  if(status.length)throw Error('Checkout has modified or untracked files; save/review them first.');
  const ignored=git(root,['ls-files','--others','--ignored','--exclude-standard','-z'],{binary:true});
  if(ignored.length)throw Error('Checkout contains ignored files not represented by Git history.');
  const tracked=git(root,['ls-files','--stage','-z'],{binary:true});
  if(!tracked.length)throw Error('No tracked files found.');
  for(const part of tracked.toString('utf8').split('\0').filter(Boolean)){
    const m=/^([0-7]{6}) [0-9a-f]{40,64} [0-3]\t(.+)$/.exec(part);
    if(!m||m[1]==='160000'||m[1]==='120000')
      throw Error('Submodules, symlinks or unknown tracked file modes require separate handling.');
  }
  const files=git(root,['ls-files','-z'],{binary:true}).toString('utf8').split('\0').filter(Boolean);
  const head=git(root,['rev-parse','HEAD']).trim();
  const tree=git(root,['rev-parse','HEAD^{tree}']).trim();
  if(!/^[0-9a-f]{40,64}$/.test(head)||!/^[0-9a-f]{40,64}$/.test(tree))
    throw Error('Unexpected Git commit/tree identifier.');
  // Local refs include branches, tags and fetched remote references; the
  // detached HEAD is explicitly included in the bundle command.
  const refs=git(root,['for-each-ref','--format=%(refname)%00%(objectname)','refs/heads','refs/tags','refs/remotes'])
    .trim().split('\n').filter(Boolean);
  if(!refs.length)throw Error('No local/fetched refs found to preserve.');
  const actualRefs=new Map();
  for(const entry of refs){
    const parts=entry.split('\0');
    if(parts.length!==2||!/^refs\/(heads|tags|remotes)\//.test(parts[0])||
       !/^[a-f0-9]{40,64}$/.test(parts[1])||actualRefs.has(parts[0]))
      throw Error('A Git ref is malformed or duplicated.');
    actualRefs.set(parts[0],parts[1]);
  }
  // Read-only inventory is identical in ordering to the earlier preflight.
  const snapshot=requireWebsite?inventory(root,files):fingerprint(root,files);
  // Explicitly refuse LFS pointer files, which require external media storage.
  for(const rel of files){
    const file=path.join(root,...rel.split('/'));
    const stat=fs.statSync(file);
    if(stat.size>=50&&stat.size<=1024){
      const bytes=fs.readFileSync(file);
      if(bytes.toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1\n'))
        throw Error('Git LFS pointer detected; external LFS data is not included.');
    }
  }
  return {root:fs.realpathSync(root),head,tree,refs:actualRefs,
    trackedFiles:files,snapshot,requireWebsite};
}
function fingerprint(root,files){
  if(!Array.isArray(files)||files.length<1)throw Error('No tracked files to fingerprint.');
  const pieces=[],seen=new Set();let count=0;
  for(const rel of files.slice().sort()){
    if(typeof rel!=='string'||!rel||rel.startsWith('/')||
       rel.includes('\\')||rel.split('/').some(t=>!t||t==='.'||t==='..')||
       seen.has(rel.toLowerCase()))
      throw Error('Tracked path is unsafe or duplicated.');
    seen.add(rel.toLowerCase());
    const file=path.join(root,...rel.split('/'));
    const st=fs.lstatSync(file);
    if(!st.isFile()||st.isSymbolicLink())throw Error('Tracked checkout file is not regular.');
    const bytes=fs.readFileSync(file);
    count+=bytes.length;
    pieces.push(Buffer.from(JSON.stringify([rel,bytes.length,sha(bytes)])+'\n'));
  }
  return {fingerprintSha256:sha(Buffer.concat(pieces)),
    trackedFiles:files.length,trackedBytes:count};
}
function preserveRefs(mirror,expected){
  const refs=git(mirror,['--git-dir=.', 'for-each-ref',
    '--format=%(refname)%00%(objectname)','refs/heads','refs/tags','refs/remotes'])
    .trim().split('\n').filter(Boolean);
  const restored=new Map(refs.map(row=>row.split('\0')));
  for(const [name,id] of expected){
    if(restored.get(name)!==id)
      throw Error('A fetched branch/tag ref did not survive Git bundle recovery.');
  }
  return expected.size;
}
function verifyRecovery(source,bundle,temp,expected){
  // Git's own verifier validates prerequisite/object availability.
  git(source,['bundle','verify',bundle],{timeout:180000});
  const mirror=path.join(temp,'mirror.git');
  git(temp,['clone','--quiet','--mirror',bundle,mirror],{timeout:180000});
  if(git(mirror,['cat-file','-t',expected.head]).trim()!=='commit')
    throw Error('Original HEAD commit is missing in the restored repository.');
  const refCount=preserveRefs(mirror,expected.refs);
  const restored=path.join(temp,'restored');
  git(temp,['clone','--quiet','--no-checkout',mirror,restored],{timeout:180000});
  git(restored,['checkout','--quiet','--detach',expected.head],{timeout:180000});
  if(git(restored,['rev-parse','HEAD']).trim()!==expected.head||
     git(restored,['rev-parse','HEAD^{tree}']).trim()!==expected.tree)
    throw Error('Recovered HEAD or tree hash differs from the original.');
  const actual=fingerprint(restored,expected.trackedFiles);
  if(actual.fingerprintSha256!==expected.snapshot.fingerprintSha256||
     actual.trackedFiles!==expected.snapshot.trackedFiles||
     actual.trackedBytes!==expected.snapshot.trackedBytes)
    throw Error('Recovered checkout is not byte-identical to the intended tracked snapshot.');
  const sourceCount=Number(git(source,['rev-list','--all','--count']).trim());
  const restoredCount=Number(git(mirror,['rev-list','--all','--count']).trim());
  if(!Number.isInteger(sourceCount)||!Number.isInteger(restoredCount)||
     sourceCount!==restoredCount)
    throw Error('Recovered reachable Git history count differs.');
  return {
    independentGitMirrorRestored:true,headMatches:true,treeMatches:true,
    trackedFilesMatch:true,trackedBytesMatch:true,
    localFetchedRefsRestored:refCount,
    reachableCommitCount:sourceCount,
    recoveredCheckoutSha256:actual.fingerprintSha256
  };
}
function rehearse(root,options={}){
  const before=baseline(root,options);
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-private-git-restore-'));
  fs.chmodSync(work,0o700);
  try{
    const bundle=path.join(work,'source.bundle');
    git(root,['bundle','create',bundle,'--all','HEAD'],{timeout:180000});
    const bundleBytes=fs.readFileSync(bundle);
    if(bundleBytes.length<32)throw Error('Git bundle is empty or incomplete.');
    const verified=verifyRecovery(root,bundle,work,before);
    return {
      format:'naxx-private-git-history-recovery-v1',
      temporaryOnly:true,privateDataIncluded:true,
      shallowRejected:true,dirtyAndUntrackedRejected:true,
      ignoredFilesRejected:true,partialCloneRejected:true,
      lfsAndSubmodulesRejected:true,
      sourceCommit:before.head,sourceTree:before.tree,
      trackedFiles:before.snapshot.trackedFiles,
      trackedBytes:before.snapshot.trackedBytes,
      bundleBytes:bundleBytes.length,bundleSha256:sha(bundleBytes),
      originalCheckoutSha256:before.snapshot.fingerprintSha256,
      ...verified,
      githubWrites:0,archivePublished:false,
      backupPersisted:false,
      exclusions:'Never-fetched remote refs, reflog-only objects, GitHub settings/secrets, LFS content, external services and ignored/untracked files not captured.'
    };
  }finally{fs.rmSync(work,{recursive:true,force:true});}
}
if(require.main===module){
  try{
    const report=rehearse(path.resolve(__dirname,'..','..'));
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
  }catch(_){
    process.stderr.write('Complete Git history recovery preflight was refused or failed; no private paths or objects printed.\n');
    process.exitCode=1;
  }
}
module.exports={rootsEqual,baseline,fingerprint,verifyRecovery,rehearse};
