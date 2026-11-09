'use strict';
/*
 * The Windows folder-picker cannot be executed in Ubuntu CI. These static
 * checks verify that the manual desktop helper remains explicit, calls the
 * already physically restore-tested Node programs and contains no GitHub
 * publishing, token-discovery, automatic-update or network commands.
 *
 * The actual Node backup and restore logic is covered by separate tests.
 * Owner-side Windows UI behaviour still requires an explicit Windows test.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..','tools');
const ps=fs.readFileSync(path.join(dir,'Start-Naxxramas-Private-Backup.ps1'),'utf8');
const cmd=fs.readFileSync(path.join(dir,'Start-Naxxramas-Private-Backup.cmd'),'utf8');
test('manual-only folder picker invokes the real backup and independent retained restore verifier',()=>{
  assert.match(ps,/FolderBrowserDialog/);
  assert.match(ps,/ShowDialog\(\)/);
  assert.match(ps,/ShowNewFolderButton/);
  assert.match(ps,/Get-Command 'node.exe'/);
  assert.match(ps,/Get-Command 'git.exe'/);
  assert.match(ps,/create-local-git-backup\.cjs/);
  assert.match(ps,/verify-retained-backup\.cjs/);
  assert.match(ps,/\$node\.Source \$createTool '--output' \$backupPath/);
  assert.match(ps,/\$node\.Source \$verifyTool '--backup' \$backupPath/);
  assert.match(ps,/ConvertFrom-Json/);
  assert.match(ps,/independentlyRecoveredTwice/);
  assert.match(ps,/restoredAgainFromExistingBundle/);
  assert.match(ps,/exactGitCheckoutBound/);
  assert.match(ps,/originalCheckoutUnchanged/);
  assert.match(ps,/saved\.sourceCommit -ne \$verified\.verifiedOriginalCommit/);
  assert.match(ps,/\.receipt\.json/);
  assert.match(ps,/\.READ_ME_FIRST\.txt/);
});
test('helper remains an explicitly launched local file, not a GitHub source or network uploader',()=>{
  assert.match(cmd,/%~dp0Start-Naxxramas-Private-Backup\.ps1/);
  assert.match(cmd,/-NoProfile/);
  assert.match(cmd,/-STA/);
  assert.match(cmd,/-ExecutionPolicy RemoteSigned/);
  for(const script of [ps,cmd]){
    for(const unsafe of [
      'Invoke-WebRequest','Invoke-RestMethod','Start-BitsTransfer',
      'git push','--mirror','https.request','Authorization:',
      'GITHUB_TOKEN','GH_TOKEN','-ExecutionPolicy Bypass',
      'Set-ExecutionPolicy','Update-Ref','gh repo','curl.exe',
      'WebClient','System.Net.HttpClient'
    ])assert.equal(script.toLowerCase().includes(unsafe.toLowerCase()),false,
      'Forbidden automatic network/write command: '+unsafe);
  }
});
test('success and failure messages distinguish verified local recovery from off-machine storage',()=>{
  assert.match(ps,/No GitHub upload, website edit or publication/);
  assert.match(ps,/That separate copy is NOT yet verified/);
  assert.match(ps,/not the entire server or GitHub settings/);
  assert.match(ps,/do not rely on them yet/);
  assert.match(ps,/exit 1/);
  assert.match(ps,/exit 0/);
  assert.match(ps,/Do not choose a public or shared folder/);
});
