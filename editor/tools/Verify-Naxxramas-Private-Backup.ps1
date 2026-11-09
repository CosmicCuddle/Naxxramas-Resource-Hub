#requires -Version 5.1
<#
  OWNER'S PRIVATE RETAINED-GIT-BACKUP VERIFIER — WINDOWS, MANUAL ONLY.

  Choose an EXISTING .bundle through an Open File dialog. Read the saved
  bundle, receipt and recovery notes; independently restore the saved
  Git history and tracked source into a temporary private directory.
  This tool NEVER creates a new backup, changes an existing bundle,
  connects to GitHub, modifies the website or publishes anything.

  A successful restore proves the selected LOCAL FILE is intact relative
  to the exact source Git checkout. It does not prove the chosen drive
  is physically off-machine or that the complete server is backed up.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Show-RestoreNotice([string]$message, [string]$title, [string]$kind) {
  [void][System.Windows.Forms.MessageBox]::Show(
    $message, $title,
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]$kind
  )
}

try {
  if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'The private file picker requires Windows.'
  }
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.Application]::EnableVisualStyles()

  $verifyTool = Join-Path $PSScriptRoot 'verify-retained-backup.cjs'
  if (-not [System.IO.File]::Exists($verifyTool)) {
    throw 'The private Git backup verification utility is missing.'
  }
  $node = Get-Command 'node.exe' -ErrorAction Stop
  [void](Get-Command 'git.exe' -ErrorAction Stop)

  Show-RestoreNotice (
    'Select an EXISTING private Git-history .bundle file.' +
    [Environment]::NewLine + [Environment]::NewLine +
    'The matching .receipt.json and .READ_ME_FIRST.txt must be beside it.' +
    [Environment]::NewLine +
    'Ideally select the copy kept on your separate PRIVATE drive.' +
    [Environment]::NewLine + [Environment]::NewLine +
    'This is a READ-ONLY recovery test. Nothing is uploaded or published.'
  ) 'Naxxramas — verify existing backup' 'Information'

  $picker = New-Object System.Windows.Forms.OpenFileDialog
  try {
    $picker.Title = 'Select the saved Naxxramas PRIVATE Git backup'
    $picker.Filter = 'Git history bundles (*.bundle)|*.bundle'
    $picker.Multiselect = $false
    $picker.CheckFileExists = $true
    $picker.RestoreDirectory = $true
    if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
      Write-Host 'Existing private backup verification cancelled.'
      exit 0
    }
    $backupPath = $picker.FileName
  } finally {
    $picker.Dispose()
  }

  if ([string]::IsNullOrWhiteSpace($backupPath) -or
      -not [System.IO.File]::Exists($backupPath)) {
    throw 'The chosen existing .bundle is unavailable.'
  }

  # No shell interpolation: call the already-tested Node verifier directly.
  # The verifier rejects stale, altered, wrong-commit, shallow and unsafe
  # sources, and actually restores the saved Git history into a private temp.
  $resultText = & $node.Source $verifyTool '--backup' $backupPath
  if ($LASTEXITCODE -ne 0) {
    throw 'The saved private Git backup did not pass an independent restoration.'
  }
  $report = ($resultText -join [Environment]::NewLine) | ConvertFrom-Json
  if ($report.exactGitCheckoutBound -ne $true -or
      $report.existingBundleAndSidecarsIntact -ne $true -or
      $report.restoredAgainFromExistingBundle -ne $true -or
      $report.originalCheckoutUnchanged -ne $true -or
      $report.localBundleReadOnly -ne $true -or
      $report.realSaveEnabled -ne $false -or
      $report.githubWrites -ne 0 -or
      $report.wholeServerOrGitHubSettingsBackup -ne $false) {
    throw 'The selected Git backup did not satisfy every source recovery check.'
  }

  Write-Host 'The selected existing private Git-history backup was restored and verified.'
  Write-Host 'Its backup, receipt and recovery instructions were left unchanged.'
  Write-Host 'No website data was uploaded or published.'

  Show-RestoreNotice (
    'The selected backup was VERIFIED and restore-tested!' +
    [Environment]::NewLine + [Environment]::NewLine +
    'The selected .bundle, receipt and instructions remain unchanged.' +
    [Environment]::NewLine +
    'This verified the particular copy you selected.' +
    [Environment]::NewLine + [Environment]::NewLine +
    'Keep this copy PRIVATE and on your separate backup drive.' +
    [Environment]::NewLine +
    'The checker does not determine whether that drive is off-machine.' +
    [Environment]::NewLine +
    'This does not back up the full server or GitHub settings.' +
    [Environment]::NewLine + [Environment]::NewLine +
    'No real website Save, GitHub upload or publication occurred.'
  ) 'Naxxramas — retained backup verified' 'Information'

  # The owner may explicitly copy a concise NON-SENSITIVE result into ChatGPT.
  # Never copy the path, .bundle, receipt, raw JSON, credentials or content.
  # This is a restoration claim only; it is NOT proof of off-machine storage.
  $safeSummary = @(
    'NAXXRAMAS PRIVATE GIT BACKUP — LOCAL VERIFICATION',
    'Existing bundle and sidecars: VERIFIED',
    'Physical Git history restore: PASSED',
    'Exact local Git checkout: MATCHED',
    'Original files unchanged: VERIFIED',
    'Original Git commit: ' + [string]$report.verifiedOriginalCommit,
    'GitHub writes and publication: NONE',
    'Off-machine storage: NOT independently verified by tool',
    'Whole-server/GitHub-settings backup: NO',
    'No file paths or backup contents included'
  ) -join [Environment]::NewLine

  $copyChoice = [System.Windows.Forms.MessageBox]::Show(
    'Would you like to COPY a safe verification summary for your records?' +
    [Environment]::NewLine + [Environment]::NewLine +
    'Only the original Git commit and PASS/NOT VERIFIED statuses are copied.' +
    [Environment]::NewLine +
    'Your private folder path, file contents and recovery files are NOT copied.' +
    [Environment]::NewLine + [Environment]::NewLine +
    'Choosing No leaves the clipboard unchanged.',
    'Naxxramas — copy safe backup result?',
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question
  )
  if ($copyChoice -eq [System.Windows.Forms.DialogResult]::Yes) {
    # Clipboard availability is NOT part of physical Git recovery. A locked
    # clipboard must never turn a verified backup into a false failure.
    try {
      [System.Windows.Forms.Clipboard]::SetText($safeSummary)
      Show-RestoreNotice (
        'A short, non-sensitive confirmation was copied to your clipboard.' +
        [Environment]::NewLine +
        'You can paste it into our chat, without sharing the backup itself.'
      ) 'Naxxramas — safe confirmation copied' 'Information'
    } catch {
      Write-Warning 'Backup verification PASSED, but the clipboard was unavailable.'
      Show-RestoreNotice (
        'Your backup was VERIFIED and restore-tested.' +
        [Environment]::NewLine +
        'Only copying the optional status to the clipboard failed.' +
        [Environment]::NewLine +
        'Your backup and verification result remain valid.'
      ) 'Naxxramas — backup verified; clipboard unavailable' 'Warning'
    }
  }
} catch {
  Write-Warning 'Existing private backup verification failed or was refused.'
  Write-Warning 'The backup and website have not been changed. No GitHub upload was made.'
  if ([type]::GetType('System.Windows.Forms.MessageBox, System.Windows.Forms')) {
    Show-RestoreNotice (
      'The selected backup could not be verified.' +
      [Environment]::NewLine + [Environment]::NewLine +
      'It may be missing a receipt, damaged, stored in an unsafe location,' +
      [Environment]::NewLine +
      'or belong to a different Git source commit.' +
      [Environment]::NewLine +
      'The current source also needs a clean, complete Git history.' +
      [Environment]::NewLine + [Environment]::NewLine +
      'Do not rely on an unverified backup.' +
      [Environment]::NewLine +
      'No GitHub upload or website publication was attempted.'
    ) 'Naxxramas — backup verification refused' 'Warning'
  }
  exit 1
}
