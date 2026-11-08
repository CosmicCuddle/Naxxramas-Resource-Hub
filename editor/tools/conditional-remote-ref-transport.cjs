'use strict';
/*
 * EXACT-OLD-HEAD REMOTE COMMIT TRANSPORT — isolated test only.
 * No browser export, credentials, GitHub network client, writer in the
 * production repository or automatic retry. An external test harness must
 * inject the remote transport and use a NON-PRODUCTION test repository.
 *
 * GitHub GraphQL updateRefs + RefUpdate.beforeOid provides server-enforced
 * expected-old-head semantics; REST PATCH force:false is insufficient.
 */
const PRODUCTION='CosmicCuddle/Naxxramas-Resource-Hub';
const FORMAT='naxx-disposable-exact-old-github-ref-test-v1';
const SHA=/^[0-9a-f]{40}$/;
const REPO=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BRANCH=/^editor-saves\/[a-z0-9][a-z0-9._/-]{0,100}$/;
const MUTATION='mutation NaxxramasConditionalEditorRef($input: UpdateRefsInput!) { updateRefs(input: $input) { clientMutationId } }';
function safeBranch(branch) {
  return typeof branch==='string' && BRANCH.test(branch) &&
    branch.length<=114 && !branch.endsWith('.')&&!branch.endsWith('/')&&
    !branch.includes('..')&&!branch.includes('//')&&
    !branch.split('/').some(part=>part.endsWith('.lock'));
}
function createSandboxProposal(input) {
  if(!input || typeof input!=='object' || Array.isArray(input) ||
     input.targetRepository===PRODUCTION ||
     !REPO.test(input.targetRepository||'') ||
     !safeBranch(input.branch) ||
     typeof input.repositoryId!=='string'||input.repositoryId.length<3||
     input.repositoryId.length>180||
     !/^[A-Za-z0-9_=+-]+$/.test(input.repositoryId) ||
     !SHA.test(input.oldCommit||'') ||
     !SHA.test(input.newCommit||'') ||
     !SHA.test(input.parentCommit||'') ||
     !SHA.test(input.expectedTree||'') ||
     !SHA.test(input.actualTree||'') ||
     input.oldCommit===input.newCommit ||
     input.parentCommit!==input.oldCommit ||
     input.expectedTree!==input.actualTree ||
     input.fullSiteVerified!==true ||
     input.originalGitHistoryVerified!==true ||
     input.disposableTestOnly!==true ||
     input.boundedSourcePathsVerified!==true)
    throw Error('A complete isolated-test commit and unchanged expected tree are required.');
  const name='refs/heads/'+input.branch;
  const beforeOid=input.oldCommit,afterOid=input.newCommit;
  const clientMutationId='naxx-sandbox-'+afterOid.slice(0,16);
  const variables={input:{
    repositoryId:input.repositoryId,
    clientMutationId,
    refUpdates:[{name,beforeOid,afterOid,force:false}]
  }};
  return Object.freeze({
    format:FORMAT,
    targetRepository:input.targetRepository,branch:input.branch,
    targetRepositoryNodeId:input.repositoryId,
    beforeOid,afterOid,independentlyExpectedTreeOid:input.expectedTree,
    graphqlQuery:MUTATION,graphqlVariables:JSON.parse(JSON.stringify(variables)),
    sourceRepositoryWriteAllowed:false,
    actualGitHubWriteApproved:false,canExecuteOnProduction:false,
    githubWritesMade:0,canPublish:false
  });
}
function checkRefObservation(value,proposal) {
  if(!value||value.repository!==proposal.targetRepository||
     value.branch!==proposal.branch||!SHA.test(value.oid||''))
    throw Error('Remote test reference could not be independently identified.');
  return value.oid;
}
function checkCommitObservation(value,proposal) {
  if(!value||value.repository!==proposal.targetRepository||
     value.commit!==proposal.afterOid||
     value.parentCommit!==proposal.beforeOid||
     value.treeOid!==proposal.independentlyExpectedTreeOid||
     value.checkedBlobsAndPaths!==true)
    throw Error('Remote test commit did not match the independently reviewed tree.');
}
function validateProposal(proposal) {
  if(!proposal||proposal.format!==FORMAT||
     proposal.targetRepository===PRODUCTION||
     !REPO.test(proposal.targetRepository||'')||
     typeof proposal.targetRepositoryNodeId!=='string'||
     !safeBranch(proposal.branch)||
     proposal.beforeOid===proposal.afterOid||
     !SHA.test(proposal.beforeOid||'')||
     !SHA.test(proposal.afterOid||'')||
     !SHA.test(proposal.independentlyExpectedTreeOid||'')||
     proposal.actualGitHubWriteApproved!==false||
     proposal.canExecuteOnProduction!==false||
     proposal.sourceRepositoryWriteAllowed!==false||
     proposal.githubWritesMade!==0||proposal.canPublish!==false||
     !proposal.graphqlVariables||!proposal.graphqlVariables.input||
     proposal.graphqlQuery!==MUTATION)
    throw Error('Only independently constructed sandbox-ref proposals are permitted.');
  const input=proposal.graphqlVariables.input;
  if(!/^[A-Za-z0-9_=+-]{3,180}$/.test(input.repositoryId||'')||
     input.repositoryId!==proposal.targetRepositoryNodeId||
     input.clientMutationId!=='naxx-sandbox-'+proposal.afterOid.slice(0,16)||
     !Array.isArray(input.refUpdates)||input.refUpdates.length!==1||
     input.refUpdates[0].name!=='refs/heads/'+proposal.branch||
     input.refUpdates[0].beforeOid!==proposal.beforeOid||
     input.refUpdates[0].afterOid!==proposal.afterOid||
     input.refUpdates[0].force!==false)
    throw Error('Expected-old-ref GraphQL payload is missing or unsafe.');
  return input;
}
async function attemptSandboxLease(proposal,remote) {
  const input=validateProposal(proposal);
  if(!remote||typeof remote.readRef!=='function'||
     typeof remote.updateRefs!=='function'||
     typeof remote.readCommit!=='function')
    throw Error('An explicitly injected disposable test repository adapter is required.');
  const oldHead=checkRefObservation(await remote.readRef(),proposal);
  if(oldHead!==proposal.beforeOid)
    throw Error('The disposable test branch moved before the conditional attempt.');
  try {
    // Exactly ONE invocation; never retry after timeout or ambiguous result.
    const outcome=await remote.updateRefs(proposal.graphqlQuery,
      JSON.parse(JSON.stringify(proposal.graphqlVariables)));
    if(!outcome||Array.isArray(outcome.errors)&&outcome.errors.length||
       !outcome.data||!outcome.data.updateRefs||
       outcome.data.updateRefs.clientMutationId!==input.clientMutationId)
      throw Error('No verified conditional ref update acknowledgement.');
  }catch(_) {
    throw Error('REMOTE_OUTCOME_UNCERTAIN: freeze the draft; do not retry.');
  }
  try {
    const observed=checkRefObservation(await remote.readRef(),proposal);
    if(observed!==proposal.afterOid)
      throw Error('The expected new remote commit was not observed.');
    checkCommitObservation(await remote.readCommit(),proposal);
  }catch(_) {
    throw Error('REMOTE_OUTCOME_UNCERTAIN: cannot independently verify the new commit.');
  }
  return Object.freeze({
    format:'naxx-disposable-verified-ref-update-v1',
    sandboxOnly:true,targetRepository:proposal.targetRepository,
    branch:proposal.branch,verifiedNewHead:proposal.afterOid,
    independentlyVerifiedTree:proposal.independentlyExpectedTreeOid,
    oldHeadWasPinned:true,expectedOldHeadSent:true,force:false,
    refAndCommitReadBackVerified:true,
    productionGitHubSaveProven:false,canPublish:false
  });
}
module.exports=Object.freeze({
  FORMAT,MUTATION,createSandboxProposal,attemptSandboxLease,
  safeBranch,checkRefObservation,checkCommitObservation
});
