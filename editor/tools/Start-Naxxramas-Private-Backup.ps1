#requires -Version 5.1
<#
  ONE-TIME PRIVATE WEBSITE GIT BACKUP — WINDOWS OWNER UTILITY

  This is a manual desktop-only launcher. It is NOT a server, website
  endpoint, GitHub uploader, scheduler or installer. It creates a local
  Git bundle plus its receipt/instructions outside the source checkout
  and restores the saved bundle again before reporting success.

  The owner selects a PRIVATE destination. The owner should subsequently
  keep all THREE files on an OFF-MACHINE private drive. Merely choosing
  a folder does NOT verify an off-machine copy or full server backup.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Show-OwnerNotice([string]$message, [string]$title, [string]$kind) {
  [void][System.Windows.Forms.MessageBox]::Show(
    $message, $title,
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]$kind
  )
}

try {
  if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'The folder-picker helper is for Windows. The Node.js backup tools are cross-platform.'
  }

  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.Application]::EnableVisualStyles()

  $createTool = Join-Path $PSScriptRoot 'create-local-git-backup.cjs'
  $verifyTool = Join-Path $PSScriptRoot 'verify-retained-backup.cjs'
  if (-not [System.IO.File]::Exists($createTool) -or
      -not [System.IO.File]::Exists($verifyTool)) {
    throw 'The required website backup tools are missing.'
  }

  $node = Get-Command 'node.exe' -ErrorAction Stop
  [void](Get-Command 'git.exe' -ErrorAction Stop)

  # Verify the complete, clean original website BEFORE asking the owner
  # where to save a backup. This check only reads local Git and source bytes.
  $readinessTool = Join-Path $PSScriptRoot 'check-private-backup-readiness.cjs'
  if (-not [System.IO.File]::Exists($readinessTool)) {
    throw 'The original-site private backup readiness check is missing.'
  }
  $readinessOutput = & $node.Source $readinessTool '--check'
  if ($LASTEXITCODE -ne 0) {
    throw 'This is not a clean complete Git checkout of the original website.'
  }
  $ready = ($readinessOutput -join [Environment]::NewLine) | ConvertFrom-Json
  if ($ready.cleanCompleteGitCheckout -ne $true -or
      $ready.fullFetchedHistoryPresent -ne $true -or
      $ready.originalWebsiteChecksumVerified -ne $true -or
      $ready.privateBackupWritten -ne $false -or
      $ready.githubWrites -ne 0 -or
      $ready.realSaveEnabled -ne $false -or
      [string]::IsNullOrWhiteSpace([string]$ready.sourceCommit)) {
    throw 'Original site read-only backup readiness did not pass.'
  }

  Show-OwnerNotice (
    'This creates a PRIVATE backup of locally fetched website Git history.' +
    [Environment]::NewLine + [Environment]::NewLine +
    'Choose a PRIVATE folder OUTSIDE the website project.' +
    [Environment]::NewLine +
    'Do not choose a public or shared folder.' +
    [Environment]::NewLine + [Environment]::NewLine +
    'The tool will restore-test the backup and will NOT upload anything.' +
    [Environment]::NewLine +
    'Later, keep all three backup files on a separate private drive.'
  ) 'Naxxramas — private website backup' 'Information'

  $picker = New-Object System.Windows.Forms.FolderBrowserDialog
  try {
    $picker.Description = 'Choose a PRIVATE backup folder outside your website Git project'
    $picker.ShowNewFolderButton = $true
    if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
      Write-Host 'Private backup selection cancelled. No file was created.'
      exit 0
    }
    $destination = $picker.SelectedPath
  } finally {
    $picker.Dispose()
  }

  if ([string]::IsNullOrWhiteSpace($destination) -or
      -not [System.IO.Directory]::Exists($destination)) {
    throw 'The selected private backup folder does not exist.'
  }

  $stamp = (Get-Date).ToString('yyyy-MM-dd-HHmmss')
  $backupName = 'Naxxramas-Website-Git-Backup-' + $stamp + '.bundle'
  $backupPath = Join-Path $destination $backupName
  if ([System.IO.File]::Exists($backupPath)) {
    throw 'That private backup filename already exists. No existing backup will be overwritten.'
  }

  # Call the established, reviewed Node.js backup tool directly: no shell,
  # remote URL, token, path interpolation into an eval or GitHub request.
  $savedOutput = & $node.Source $createTool '--output' $backupPath
  if ($LASTEXITCODE -ne 0) {
    throw 'The Git history backup was refused. Use a clean, complete website Git checkout.'
  }
  $saved = ($savedOutput -join [Environment]::NewLine) | ConvertFrom-Json
  if ($saved.bundleAndTwoSidecarsCreated -ne $true -or
      $saved.independentlyRecoveredTwice -ne $true -or
      $saved.githubWritten -ne $false -or
      $saved.serverModified -ne $false) {
    throw 'The newly created Git history bundle was not independently verified.'
  }

  # Independently reread the three SAVED files and restore from the bundle
  # again, rather than relying only on the creator's success receipt.
  $checkOutput = & $node.Source $verifyTool '--backup' $backupPath
  if ($LASTEXITCODE -ne 0) {
    throw 'The retained Git backup failed its separate verification.'
  }
  $verified = ($checkOutput -join [Environment]::NewLine) | ConvertFrom-Json
  if ($verified.existingBundleAndSidecarsIntact -ne $true -or
      $verified.restoredAgainFromExistingBundle -ne $true -or
      $verified.exactGitCheckoutBound -ne $true -or
      $verified.originalCheckoutUnchanged -ne $true -or
      $verified.realSaveEnabled -ne $false -or
      $verified.githubWrites -ne 0 -or
      $saved.sourceCommit -ne $verified.verifiedOriginalCommit) {
    throw 'The selected original Git commit or separate saved-file restore did not match.'
  }

  $allFiles = @(
    $backupPath,
    ($backupPath + '.receipt.json'),
    ($backupPath + '.READ_ME_FIRST.txt')
  )
  foreach ($file in $allFiles) {
    if (-not [System.IO.File]::Exists($file)) {
      throw 'A required recovery file was not found after verification.'
    }
  }

  Write-Host 'Private Git history bundle created and restored successfully.'
  Write-Host 'Three recovery files were written to your selected folder.'
  Write-Host 'No GitHub upload, website edit or publication took place.'

  Show-OwnerNotice (
    'Local Git-history backup verified and restore-tested!' +
    [Environment]::NewLine + [Environment]::NewLine +
    'Three files were saved in your chosen PRIVATE folder.' +
    [Environment]::NewLine +
    'Keep the .bundle, .receipt.json and .READ_ME_FIRST.txt together.' +
    [Environment]::NewLine + [Environment]::NewLine +
    'IMPORTANT: Copy all three to a separate private/offline drive.' +
    [Environment]::NewLine +
    'That separate copy is NOT yet verified by this helper.' +
    [Environment]::NewLine + [Environment]::NewLine +
    'This backs up fetched Git history, not the entire server or GitHub settings.' +
    [Environment]::NewLine +
    'No website or GitHub files were changed.'
  ) 'Naxxramas — backup verified locally' 'Information'
} catch {
  # Never show raw exceptions that might contain a private folder path,
  # repository metadata or sensitive source content.
  Write-Warning 'The private Git backup did not complete verification.'
  Write-Warning 'If three backup files were created, keep them private but do not rely on them yet.'
  Write-Warning 'A clean complete Git checkout, Node.js and Git are required.'
  if ([type]::GetType('System.Windows.Forms.MessageBox, System.Windows.Forms')) {
    Show-OwnerNotice (
      'The backup did not pass all safety checks.' +
      [Environment]::NewLine + [Environment]::NewLine +
      'No website publication or GitHub upload took place.' +
      [Environment]::NewLine +
      'Check that this is a complete, clean Git copy of the Resource Hub,' +
      [Environment]::NewLine +
      'that Node.js and Git are installed, and that the private destination is writable.' +
      [Environment]::NewLine +
      'Do NOT treat any partial output as a verified backup.'
    ) 'Naxxramas — backup not verified' 'Warning'
  }
  exit 1
}
