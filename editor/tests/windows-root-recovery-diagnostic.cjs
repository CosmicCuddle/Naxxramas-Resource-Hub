'use strict';
/*
 * Windows-only anonymous Git root comparison diagnostic.
 * Creates a NEW disposable synthetic Git repo and logs booleans only,
 * NEVER any filesystem paths, GitHub token or source content.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process');
const {rootsEqual}=require('../tools/rehearse-full-git-recovery.cjs');
if(process.platform!=='win32')process.exit(0);
const work=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-safe-win-git-root-'));
try{
  const source=path.join(work,'fictional-source');
  const init=cp.spawnSync('git',['init','--quiet',source],{cwd:work,encoding:'utf8'});
  if(init.error||init.status!==0)throw Error('Windows root diagnostic could not create isolated Git source.');
  const top=cp.spawnSync('git',['rev-parse','--show-toplevel'],{cwd:source,encoding:'utf8'});
  if(top.error||top.status!==0)throw Error('Windows root diagnostic Git top-level unavailable.');
  const fromGit=top.stdout.trim(),a=fs.realpathSync(source),b=fs.realpathSync(fromGit);
  const la=fs.statSync(a),lb=fs.statSync(b);
  const left=path.normalize(a),right=path.normalize(b);
  const isWinDrive=p=>/^[a-zA-Z]:[\\/]/.test(p);
  const flags={
    realpathExact:a===b,
    normalizedExact:left===right,
    caseInsensitiveEquivalent:left.toLowerCase()===right.toLowerCase(),
    sameDevice:la.dev===lb.dev,
    sameInode:la.ino===lb.ino,
    nonzeroInode:la.ino!==0&&lb.ino!==0,
    bothDirectories:la.isDirectory()&&lb.isDirectory(),
    gitOutputWinDrive:isWinDrive(fromGit),
    gitOutputStartsForwardSlash:fromGit.startsWith('/'),
    gitOutputBackslashes:fromGit.includes('\\'),
    rootFromNodeWinDrive:isWinDrive(source),
    rootFromGitLength:fromGit.length,
    rootFromNodeLength:source.length,
    GitRootWasRecognized:rootsEqual(fromGit,source)
  };
  process.stdout.write('WINDOWS_ROOT_DIAGNOSTIC_BOOLEAN_FLAGS '+JSON.stringify(flags)+'\n');
}finally{fs.rmSync(work,{recursive:true,force:true});}
