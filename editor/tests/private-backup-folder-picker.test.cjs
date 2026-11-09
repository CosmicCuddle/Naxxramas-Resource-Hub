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

test('manual verification picker selects an existing bundle and calls only the read-only restore checker',()=>{
  const file=fs.readFileSync(path.join(dir,'Verify-Naxxramas-Private-Backup.ps1'),'utf8');
  const shortcut=fs.readFileSync(path.join(dir,'Verify-Naxxramas-Private-Backup.cmd'),'utf8');
  assert.match(file,/OpenFileDialog/);
  assert.match(file,/Git history bundles \(\*\.bundle\)/);
  assert.match(file,/CheckFileExists = \$true/);
  assert.match(file,/Multiselect = \$false/);
  assert.match(file,/verify-retained-backup\.cjs/);
  assert.match(file,/\$node\.Source \$verifyTool '--backup' \$backupPath/);
  assert.match(file,/ConvertFrom-Json/);
  assert.match(file,/exactGitCheckoutBound/);
  assert.match(file,/existingBundleAndSidecarsIntact/);
  assert.match(file,/restoredAgainFromExistingBundle/);
  assert.match(file,/originalCheckoutUnchanged/);
  assert.match(file,/realSaveEnabled -ne \$false/);
  assert.match(file,/githubWrites -ne 0/);
  assert.match(file,/does not determine whether that drive is off-machine/);
  assert.match(shortcut,/%~dp0Verify-Naxxramas-Private-Backup\.ps1/);
  assert.match(shortcut,/-NoProfile/);
  assert.match(shortcut,/-ExecutionPolicy RemoteSigned/);
  assert.match(shortcut,/-STA/);
  for(const script of [file,shortcut]){
    for(const banned of [
      'Invoke-WebRequest','Invoke-RestMethod','git push',
      'gh repo','GITHUB_TOKEN','GH_TOKEN',
      'https.request','Authorization:',
      'Set-ExecutionPolicy','-ExecutionPolicy Bypass',
      'create-local-git-backup.cjs','Start-BitsTransfer'
    ])assert.equal(script.toLowerCase().includes(banned.toLowerCase()),false,banned);
  }
});

test('verified Windows backup offers ONLY optional clipboard copy of safe, non-secret status',()=>{
  const content=fs.readFileSync(path.join(dir,'Verify-Naxxramas-Private-Backup.ps1'),'utf8');
  assert.match(content,/MessageBoxButtons\]::YesNo/);
  assert.match(content,/DialogResult\]::Yes/);
  assert.match(content,/Clipboard\]::SetText\(\$safeSummary\)/);
  assert.match(content,/Choosing No leaves the clipboard unchanged/);
  assert.match(content,/Original Git commit: /);
  assert.match(content,/Off-machine storage: NOT independently verified by tool/);
  assert.match(content,/No file paths or backup contents included/);
  const begin=content.indexOf('$safeSummary = @(');
  const end=content.indexOf(') -join [Environment]::NewLine',begin);
  assert.ok(begin>=0&&end>begin);
  const summary=content.slice(begin,end);
  for(const unsafe of [
    '$backupPath','$resultText','$verifyTool','$node',
    'receipt.json','READ_ME_FIRST.txt','ConvertTo-Json',
    'SelectedPath','FileName','Authorization:','GitHub_TOKEN'
  ])assert.equal(summary.includes(unsafe),false,
    'Clipboard summary may not include private source paths, recovery files or credentials: '+unsafe);
  assert.ok(content.indexOf('if ($copyChoice -eq [System.Windows.Forms.DialogResult]::Yes) {')<
    content.indexOf('[System.Windows.Forms.Clipboard]::SetText($safeSummary)'),
    'Clipboard writes must only be made after owner selects Yes');
});

test('Windows owner backup checks clean original Git source before asking for destination',()=>{
  const src=fs.readFileSync(path.join(dir,'Start-Naxxramas-Private-Backup.ps1'),'utf8');
  assert.match(src,/check-private-backup-readiness\.cjs/);
  assert.match(src,/\$node\.Source \$readinessTool '--check'/);
  assert.match(src,/cleanCompleteGitCheckout -ne \$true/);
  assert.match(src,/fullFetchedHistoryPresent -ne \$true/);
  assert.match(src,/originalWebsiteChecksumVerified -ne \$true/);
  assert.match(src,/privateBackupWritten -ne \$false/);
  assert.match(src,/realSaveEnabled -ne \$false/);
  assert.ok(src.indexOf("$node.Source $readinessTool '--check'")<
    src.indexOf('FolderBrowserDialog'),
    'Read-only preflight must finish BEFORE offering destination picker.');
  assert.equal(src.includes('Get-ChildItem Env:'),false);
});

test('optional clipboard errors cannot falsely invalidate a verified Git recovery',()=>{
  const src=fs.readFileSync(path.join(dir,'Verify-Naxxramas-Private-Backup.ps1'),'utf8');
  const block=src.slice(src.indexOf("if ($copyChoice -eq [System.Windows.Forms.DialogResult]::Yes) {"));
  assert.ok(block.includes('try {'), 'Clipboard action must handle clipboard errors separately');
  assert.match(block,/\[System\.Windows\.Forms\.Clipboard\]::SetText\(\$safeSummary\)/);
  assert.match(block,/Backup verification PASSED, but the clipboard was unavailable/);
  assert.match(block,/Your backup and verification result remain valid/);
  assert.ok(block.indexOf('catch {')<block.indexOf('} catch {')+4000,
    'Clipboard errors must be isolated from the outer backup validation');
});
