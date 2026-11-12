'use strict';
/*
 * The original editor's one-file GitHub Save. The only writable ref is
 * editor-saves/native-<exact current main prefix>. No merge or Pages API.
 * The caller supplies the already-authorised owner's local GH credential;
 * it is never passed to the browser or printed.
 */
const https=require('node:https'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const REPO='CosmicCuddle/Naxxramas-Resource-Hub';
const API='/repos/'+REPO;
const SOURCE='site-content.html';
const SHA=/^[a-f0-9]{40}$/;
const BRANCH=/^editor-saves\/native-[a-f0-9]{12}$/;
const MAX_FILE=65*1024*1024,MAX_RESPONSE=100*1024*1024;
const MUTATION='mutation NaxxramasNativeSave($input: UpdateRefsInput!) { updateRefs(input: $input) { clientMutationId } }';
const oid=x=>typeof x==='string'&&SHA.test(x);
const blobOid=b=>crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
function gitRootTreeOid(entries){
  const sorted=entries.slice().sort((a,b)=>Buffer.compare(
    Buffer.from(a.path+(a.type==='tree'?'/':'')),Buffer.from(b.path+(b.type==='tree'?'/':''))));
  const parts=[];
  for(const e of sorted){
    if(typeof e.path!=='string'||!e.path||e.path.includes('/')||e.path.includes('\0')||
       !oid(e.sha)||!((e.type==='tree'&&e.mode==='040000')||
         (e.type==='blob'&&['100644','100755','120000'].includes(e.mode))||
         (e.type==='commit'&&e.mode==='160000')))
      throw Error('Unsupported original root tree entry.');
    const mode=e.mode==='040000'?'40000':e.mode;
    parts.push(Buffer.from(mode+' '+e.path+'\0'),Buffer.from(e.sha,'hex'));
  }
  const body=Buffer.concat(parts);
  return crypto.createHash('sha1').update('tree '+body.length+'\0').update(body).digest('hex');
}
function getToken(){
  const r=spawnSync('gh',['auth','token','--hostname','github.com'],
    {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,maxBuffer:128*1024});
  const token=r.status===0&&!r.error&&typeof r.stdout==='string'?r.stdout.trim():'';
  if(token.length<12||/[\x00-\x20\x7f]/.test(token))
    throw Error('GitHub CLI login is unavailable. Sign in on your computer first.');
  return token;
}
function allowed(method,p){
  if(p==='/graphql')return method==='POST';
  if(!p.startsWith(API))return false;
  const suffix=p.slice(API.length);
  if(method==='GET')return suffix===''||
    /^\/git\/ref\/heads\/(?:main|editor-saves\/native-[a-f0-9]{12})$/.test(suffix)||
    /^\/git\/(?:commits|blobs)\/[a-f0-9]{40}$/.test(suffix)||
    /^\/git\/trees\/[a-f0-9]{40}(?:\?recursive=1)?$/.test(suffix)||
    /^\/compare\/[a-f0-9]{40}\.\.\.[a-f0-9]{40}\?per_page=1$/.test(suffix)||
    /^\/pulls\?state=open&head=CosmicCuddle%3Aeditor-saves%2Fnative-[a-f0-9]{12}&base=main&per_page=10$/.test(suffix);
  return method==='POST'&&['/git/blobs','/git/trees','/git/commits','/git/refs','/pulls'].includes(suffix);
}
function transport(token){
  return async function request(method,p,payload,raw=false,allowMissing=false){
    if(!allowed(method,p))throw Error('Unapproved GitHub Save route.');
    const body=payload===undefined?null:Buffer.from(JSON.stringify(payload));
    if(body&&body.length>MAX_RESPONSE)throw Error('GitHub Save is too large.');
    return new Promise((resolve,reject)=>{
      const req=https.request({hostname:'api.github.com',protocol:'https:',port:443,
        method,path:p,timeout:120000,rejectUnauthorized:true,headers:{
          'Authorization':'Bearer '+token,
          'Accept':raw?'application/vnd.github.raw+json':'application/vnd.github+json',
          'X-GitHub-Api-Version':'2022-11-28','User-Agent':'Naxxramas-Original-Editor',
          ...(body?{'Content-Type':'application/json','Content-Length':body.length}:{})
        }},res=>{
          let size=0;const chunks=[];
          res.on('data',chunk=>{
            size+=chunk.length;
            if(size>MAX_RESPONSE){req.destroy();reject(Error('GitHub response is too large.'));}
            else chunks.push(chunk);
          });
          res.on('end',()=>{
            if(allowMissing&&res.statusCode===404)return resolve(null);
            if(res.statusCode<200||res.statusCode>=300)
              return reject(Error('GitHub refused or did not confirm the request ('+res.statusCode+').'));
            const bytes=Buffer.concat(chunks);
            if(raw)return resolve(bytes);
            try{resolve(JSON.parse(bytes.toString('utf8')));}
            catch(_){reject(Error('GitHub response could not be verified.'));}
          });
        });
      req.on('error',()=>reject(Error('GitHub connection failed; check the saved branch before retrying.')));
      req.on('timeout',()=>req.destroy());
      req.end(body||undefined);
    });
  };
}
function createStore(request){
  if(typeof request!=='function')throw Error('A local authenticated GitHub connection is required.');
  const call=(method,p,body,raw=false,missing=false)=>request(method,p,body,raw,missing);
  async function ref(branch,missing=false){
    if(branch!=='main'&&!BRANCH.test(branch))throw Error('Unapproved branch.');
    const r=await call('GET',API+'/git/ref/heads/'+branch,undefined,false,missing);
    if(r===null&&missing)return null;
    if(!r||r.ref!=='refs/heads/'+branch||r.object?.type!=='commit'||!oid(r.object.sha))
      throw Error('GitHub branch identity was not verified.');
    return r.object.sha;
  }
  async function commit(sha){
    if(!oid(sha))throw Error('Invalid Git commit identity.');
    const c=await call('GET',API+'/git/commits/'+sha);
    if(!c||c.sha!==sha||!oid(c.tree?.sha)||!Array.isArray(c.parents)||
       c.parents.some(p=>!oid(p.sha)))
      throw Error('GitHub commit was not verified.');
    return c;
  }
  async function tree(sha,recursive=false){
    if(!oid(sha))throw Error('Invalid Git tree identity.');
    const t=await call('GET',API+'/git/trees/'+sha+(recursive?'?recursive=1':''));
    if(!t||t.sha!==sha||t.truncated!==false||!Array.isArray(t.tree)||
       t.tree.some(e=>!oid(e.sha)||typeof e.path!=='string'))
      throw Error('Complete GitHub website tree was not verified.');
    if(!recursive&&gitRootTreeOid(t.tree)!==sha)
      throw Error('GitHub root tree hash did not match its contents.');
    return t;
  }
  function sourceEntry(t){
    const e=t.tree.filter(x=>x.path===SOURCE);
    if(e.length!==1||e[0].type!=='blob'||e[0].mode!=='100644')
      throw Error('The original website source file was not found.');
    return e[0];
  }
  function unchangedOthers(a,b){
    const canon=t=>t.tree.filter(e=>e.path!==SOURCE).map(e=>
      [e.path,e.mode,e.type,e.sha].join('\0')).sort().join('\n');
    return canon(a)===canon(b);
  }
  async function blob(sha){
    if(!oid(sha))throw Error('Invalid Git blob identity.');
    const b=await call('GET',API+'/git/blobs/'+sha,undefined,true);
    if(!Buffer.isBuffer(b)||b.length>MAX_FILE||blobOid(b)!==sha)
      throw Error('GitHub file bytes did not match their Git identity.');
    return b;
  }
  async function identify(){
    const r=await call('GET',API);
    if(!r||r.full_name!==REPO||r.private!==false||r.archived!==false||
       r.disabled!==false||r.default_branch!=='main'||
       !r.permissions||r.permissions.push!==true||
       typeof r.node_id!=='string'||!/^[A-Za-z0-9_=+-]{3,180}$/.test(r.node_id))
      throw Error('The original Resource Hub repository or owner write permission could not be verified.');
    return r.node_id;
  }
  async function open(){
    const nodeId=await identify();
    const base=await ref('main'),baseCommit=await commit(base);
    const mainTree=await tree(baseCommit.tree.sha);
    const branch='editor-saves/native-'+base.slice(0,12);
    const existing=await ref(branch,true);
    let head=base,currentTree=mainTree;
    if(existing){
      if(existing!==base){
        const comparison=await call('GET',API+'/compare/'+base+'...'+existing+'?per_page=1');
        if(!comparison||comparison.status!=='ahead'||comparison.behind_by!==0||
           comparison.merge_base_commit?.sha!==base)
          throw Error('The existing editor branch is not based on current main.');
      }
      head=existing;
      currentTree=await tree((await commit(head)).tree.sha);
      if(!unchangedOthers(mainTree,currentTree))
        throw Error('The editor branch contains unrelated website changes.');
    }
    const listing=await tree(mainTree.sha,true);
    return {nodeId,base,branch,head,existing:!!existing,mainTree,
      currentTree,listing,mainSource:sourceEntry(mainTree).sha,
      source:sourceEntry(currentTree).sha,uncertain:false};
  }
  function branchUrl(state){
    return 'https://github.com/'+REPO+'/tree/'+state.branch;
  }
  function prMatches(pr,state){
    return pr&&Number.isSafeInteger(pr.number)&&pr.number>0&&
      pr.state==='open'&&pr.head?.ref===state.branch&&pr.head?.sha===state.head&&
      pr.head?.repo?.full_name===REPO&&pr.base?.ref==='main'&&
      pr.base?.repo?.full_name===REPO;
  }
  async function ensureReview(state){
    try{
      const query='?state=open&head='+encodeURIComponent('CosmicCuddle:'+state.branch)+'&base=main&per_page=10';
      const found=await call('GET',API+'/pulls'+query);
      if(!Array.isArray(found))return null;
      if(found.length){
        if(found.length!==1||!prMatches(found[0],state))return null;
        return 'https://github.com/'+REPO+'/pull/'+found[0].number;
      }
      const pr=await call('POST',API+'/pulls',{
        title:'Website edits — original visual editor',
        body:'Website content saved through the original Naxxramas visual editor. Only site-content.html is updated. Review before merging.',
        head:state.branch,base:'main',draft:true
      });
      return prMatches(pr,state)?'https://github.com/'+REPO+'/pull/'+pr.number:null;
    }catch(_){return null;}
  }
  async function save(state,bytes){
    if(!state||state.uncertain||!BRANCH.test(state.branch)||!oid(state.base)||
       !oid(state.head)||!Buffer.isBuffer(bytes)||bytes.length>MAX_FILE)
      throw Error('The editor Save session is unavailable.');
    const oldHead=state.head,oldTree=state.currentTree;
    if((await identify())!==state.nodeId||await ref('main')!==state.base||
       await ref(state.branch,true)!==(state.existing?state.head:null))
      throw Error('GitHub changed while you were editing. Keep your edits and reopen after reviewing the current branch.');
    const nextBlob=blobOid(bytes);
    if(nextBlob===sourceEntry(oldTree).sha)
      return {changed:false,commit:state.head,branchUrl:branchUrl(state),published:false};
    // From here an unknown result must not trigger an automatic retry.
    state.uncertain=true;
    const uploaded=await call('POST',API+'/git/blobs',{content:bytes.toString('base64'),encoding:'base64'});
    if(uploaded?.sha!==nextBlob)throw Error('GitHub did not confirm the exact website file.');
    const expectedEntries=oldTree.tree.map(e=>e.path===SOURCE?{...e,sha:nextBlob}:e);
    const expectedTree=gitRootTreeOid(expectedEntries);
    const createdTree=await call('POST',API+'/git/trees',{
      base_tree:oldTree.sha,tree:[{path:SOURCE,mode:'100644',type:'blob',sha:nextBlob}]
    });
    if(createdTree?.sha!==expectedTree)throw Error('GitHub proposed an unexpected website tree.');
    const created=await call('POST',API+'/git/commits',{
      message:'Save website content from original visual editor',tree:expectedTree,parents:[oldHead]
    });
    if(!oid(created?.sha)||created.tree?.sha!==expectedTree||
       created.parents?.length!==1||created.parents[0].sha!==oldHead)
      throw Error('GitHub did not verify the new website commit.');
    // Independently read back commit and exact whole root tree before moving a ref.
    const checked=await commit(created.sha),checkedTree=await tree(checked.tree.sha);
    if(checked.parents.length!==1||checked.parents[0].sha!==oldHead||
       checkedTree.sha!==expectedTree||!unchangedOthers(state.mainTree,checkedTree)||
       sourceEntry(checkedTree).sha!==nextBlob)
      throw Error('The candidate commit changed an unrelated website file.');
    if(await ref('main')!==state.base||
       await ref(state.branch,true)!==(state.existing?oldHead:null))
      throw Error('The GitHub branch changed before Save.');
    if(!state.existing){
      const createdRef=await call('POST',API+'/git/refs',
        {ref:'refs/heads/'+state.branch,sha:created.sha});
      if(createdRef?.ref!=='refs/heads/'+state.branch||createdRef.object?.sha!==created.sha)
        throw Error('GitHub branch creation was not confirmed.');
    }else{
      const clientMutationId='naxx-native-'+created.sha.slice(0,16);
      const result=await call('POST','/graphql',{query:MUTATION,variables:{input:{
        repositoryId:state.nodeId,clientMutationId,
        refUpdates:[{name:'refs/heads/'+state.branch,beforeOid:oldHead,
          afterOid:created.sha,force:false}]
      }}});
      if(result?.errors?.length||result?.data?.updateRefs?.clientMutationId!==clientMutationId)
        throw Error('GitHub conditional branch update was not confirmed.');
    }
    if(await ref(state.branch)!==created.sha)
      throw Error('The saved GitHub branch could not be independently verified.');
    state.head=created.sha;state.existing=true;state.currentTree=checkedTree;
    state.source=nextBlob;state.uncertain=false;
    // A PR failure is not a failed Save: the verified source commit exists.
    const reviewUrl=await ensureReview(state);
    return {changed:true,commit:state.head,branchUrl:branchUrl(state),
      reviewUrl,published:false};
  }
  return Object.freeze({open,blob,save,ensureReview});
}
module.exports={REPO,SOURCE,MAX_FILE,blobOid,gitRootTreeOid,getToken,allowed,
  transport,createStore};
