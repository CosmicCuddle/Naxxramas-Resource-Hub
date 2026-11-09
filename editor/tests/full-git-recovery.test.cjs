'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process');
const {rootsEqual,baseline,fingerprint,rehearse}=require('../tools/rehearse-full-git-recovery.cjs');
function git(root,...args){
  const result=cp.spawnSync('git',args,{
    cwd:root,encoding:'utf8',maxBuffer:3*1024*1024,stdio:['ignore','pipe','pipe']
  });
  if(result.status!==0)throw Error('Synthetic Git fixture setup failed.');
  return result.stdout.trim();
}
function fixture(fn){
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-git-recovery-fixture-'));
  fs.chmodSync(work,0o700);
  const root=path.join(work,'source');
  try{
    git(work,'init','--quiet','--initial-branch=main',root);
    git(root,'config','user.name','Private recovery test');
    git(root,'config','user.email','private-test@example.invalid');
    fs.mkdirSync(path.join(root,'pages'));
    fs.writeFileSync(path.join(root,'index.html'),'original loader');
    fs.writeFileSync(path.join(root,'pages','guide.html'),'guide v1');
    git(root,'add','.');
    git(root,'commit','--quiet','-m','original source');
    const first=git(root,'rev-parse','HEAD');
    git(root,'switch','--quiet','-c','resources');
    fs.writeFileSync(path.join(root,'pages','guide.html'),'guide v2');
    git(root,'add','.');
    git(root,'commit','--quiet','-m','test branch update');
    git(root,'tag','-a','verified-v1','-m','annotated backup test');
    git(root,'switch','--quiet','main');
    return fn({root,work,first});
  }finally{fs.rmSync(work,{recursive:true,force:true});}
}
test('independent bundle restore keeps all local refs, tags, history and working-tree bytes',()=>{
  fixture(({root})=>{
    const before=baseline(root,{requireWebsite:false});
    assert.equal(before.refs.size,3);
    assert.equal(before.snapshot.trackedFiles,2);
    assert.equal(before.snapshot.trackedBytes,'original loader'.length+'guide v1'.length);
    const report=rehearse(root,{requireWebsite:false});
    assert.equal(report.temporaryOnly,true);
    assert.equal(report.privateDataIncluded,true);
    assert.equal(report.independentGitMirrorRestored,true);
    assert.equal(report.headMatches,true);
    assert.equal(report.treeMatches,true);
    assert.equal(report.trackedFilesMatch,true);
    assert.equal(report.trackedBytesMatch,true);
    assert.equal(report.localFetchedRefsRestored,3);
    assert.equal(report.reachableCommitCount,2);
    assert.equal(report.sourceCommit,before.head);
    assert.equal(report.sourceTree,before.tree);
    assert.equal(report.backupPersisted,false);
    assert.equal(report.archivePublished,false);
    assert.equal(report.githubWrites,0);
    assert.match(report.bundleSha256,/^[a-f0-9]{64}$/);
    assert.equal(report.originalCheckoutSha256,before.snapshot.fingerprintSha256);
  });
});
test('backup is refused for staged edits, untracked files and ignored content',()=>{
  fixture(({root})=>{
    fs.writeFileSync(path.join(root,'pages','guide.html'),'unsaved change');
    assert.throws(()=>rehearse(root,{requireWebsite:false}),/modified or untracked/);
    git(root,'restore','pages/guide.html');
    fs.writeFileSync(path.join(root,'untracked.txt'),'not safe');
    assert.throws(()=>rehearse(root,{requireWebsite:false}),/modified or untracked/);
    fs.unlinkSync(path.join(root,'untracked.txt'));
    fs.writeFileSync(path.join(root,'.gitignore'),'ignored.local\n');
    git(root,'add','.gitignore');
    git(root,'commit','--quiet','-m','ignore rule');
    fs.writeFileSync(path.join(root,'ignored.local'),'do not drop this');
    assert.throws(()=>rehearse(root,{requireWebsite:false}),/ignored files/);
  });
});
test('shallow Git history is refused even when the working tree appears clean',()=>{
  fixture(({root,work})=>{
    const clone=path.join(work,'shallow');
    git(work,'clone','--quiet','--depth=1','--branch=resources','file://'+root,clone);
    assert.equal(git(clone,'rev-parse','--is-shallow-repository'),'true');
    assert.throws(()=>rehearse(clone,{requireWebsite:false}),/shallow/);
  });
});
test('symlinks and Git LFS pointers cannot pass as a complete local backup',()=>{
  fixture(({root})=>{
    const p=path.join(root,'point-to-loader');
    fs.symlinkSync('index.html',p);
    git(root,'add','point-to-loader');
    git(root,'commit','--quiet','-m','symlink fixture');
    assert.throws(()=>rehearse(root,{requireWebsite:false}),/Submodules, symlinks/);
    fs.unlinkSync(p);
    git(root,'rm','--quiet','point-to-loader');
    git(root,'commit','--quiet','-m','remove symlink');
    fs.writeFileSync(path.join(root,'large.asset'),
      'version https://git-lfs.github.com/spec/v1\n'+
      'oid sha256:'+'a'.repeat(64)+'\nsize 1000000\n');
    git(root,'add','large.asset');
    git(root,'commit','--quiet','-m','LFS pointer fixture');
    assert.throws(()=>rehearse(root,{requireWebsite:false}),/Git LFS pointer/);
  });
});
test('tracked-file snapshot rejects malicious traversal, duplicates and missing files',()=>{
  fixture(({root})=>{
    assert.throws(()=>fingerprint(root,['../sneaky']),/unsafe|duplicated/);
    assert.throws(()=>fingerprint(root,['index.html','index.html']),/unsafe|duplicated/);
    assert.throws(()=>fingerprint(root,['missing.txt']),/ENOENT/);
    const names=['index.html','pages/guide.html'];
    assert.deepEqual(fingerprint(root,names),fingerprint(root,names.slice().reverse()));
  });
});

test('original Git checkout identity accepts Windows drive case only for the SAME physical directory',()=>{
  fixture(({root,work})=>{
    assert.equal(rootsEqual(root,root),true);
    assert.equal(rootsEqual(root,work),false);
    assert.equal(rootsEqual(root,path.join(root,'..')),false);
    if(process.platform==='win32'){
      const swapped=root[0]===root[0].toUpperCase()?
        root[0].toLowerCase()+root.slice(1):
        root[0].toUpperCase()+root.slice(1);
      assert.equal(rootsEqual(root,swapped),true,
        'Windows native Git and Node may spell the same drive letter differently.');
      assert.equal(rootsEqual(root,root.replace(/\\/g,'/')),true,
        'Windows Git may return forward slashes for the same root.');
    }
  });
});
