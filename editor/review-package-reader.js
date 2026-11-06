/* Naxxramas private combined review ZIP inspector.
 * In-browser STORE-only ZIP validation. No extraction to disk or network.
 * This verifies archive integrity, NOT the imported original website files
 * or authorization to apply edits, GitHub writes or deployment.
 */
(function(root,factory){
  'use strict';
  const result=factory();
  if(typeof module==='object'&&module.exports)module.exports=result;
  else root.NaxxReviewArchive=result;
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const FORMAT='naxx-private-review-package-v1';
  const BASE='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
  const P='REVIEW-PAGE-DRAFT.json',R='REVIEW-RESOURCE-DRAFT.json',
    M='REVIEW-MANIFEST.json',I='READ_ME_FIRST.txt';
  const PAGE_PATHS=['new-players/content.html','rules/content.html',
    'apply/content.html','game-clients/content.html'];
  const PATHS=new Set([P,R,M,I]);
  const MAX_ARCHIVE=20*1024*1024,MAX_ENTRY=16*1024*1024;
  const TABLE=new Uint32Array(256);
  for(let i=0;i<256;i++){
    let c=i;
    for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
    TABLE[i]=c>>>0;
  }
  function crc32(bytes){
    let c=0xffffffff;
    for(let i=0;i<bytes.length;i++)c=TABLE[(c^bytes[i])&255]^(c>>>8);
    return (c^0xffffffff)>>>0;
  }
  function fail(){throw Error('Combined review ZIP is incomplete, unsafe or corrupted. No drafts were restored.');}
  function exactly(value,names){
    return !!value&&typeof value==='object'&&!Array.isArray(value)&&
      Object.keys(value).sort().join(',')===names.slice().sort().join(',');
  }
  function decodeUtf8(bytes){
    try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
    catch(_){fail();}
  }
  function decodeZip(bytes){
    if(!(bytes instanceof Uint8Array)||bytes.length<22||
      bytes.length>MAX_ARCHIVE)fail();
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const u16=i=>view.getUint16(i,true),u32=i=>view.getUint32(i,true);
    const end=bytes.length-22;
    if(u32(end)!==0x06054b50||u16(end+4)!==0||u16(end+6)!==0||
       u16(end+20)!==0)fail();
    const count=u16(end+10),dirCount=u16(end+8),
      dirSize=u32(end+12),dirAt=u32(end+16);
    if(count<3||count>4||count!==dirCount||
      dirAt+dirSize!==end||dirAt>bytes.length)fail();
    let cursor=dirAt,locNext=0;
    const out=new Map();
    for(let n=0;n<count;n++){
      if(cursor+46>end||u32(cursor)!==0x02014b50)fail();
      const flags=u16(cursor+8),method=u16(cursor+10),
        crc=u32(cursor+16),size=u32(cursor+20),
        uncompressed=u32(cursor+24),nameLen=u16(cursor+28),
        extraLen=u16(cursor+30),commentLen=u16(cursor+32),
        disk=u16(cursor+34),localAt=u32(cursor+42);
      const nameAt=cursor+46;
      if(flags!==0x0800||method!==0||size!==uncompressed||
        size<1||size>MAX_ENTRY||nameLen<1||nameLen>80||
        extraLen||commentLen||disk||nameAt+nameLen>end||localAt!==locNext)
        fail();
      const name=decodeUtf8(bytes.subarray(nameAt,nameAt+nameLen));
      if(!PATHS.has(name)||out.has(name))fail();
      if(localAt+30+nameLen+size>dirAt||
        u32(localAt)!==0x04034b50||
        u16(localAt+6)!==flags||u16(localAt+8)!==method||
        u32(localAt+14)!==crc||u32(localAt+18)!==size||
        u32(localAt+22)!==uncompressed||
        u16(localAt+26)!==nameLen||u16(localAt+28)!==0||
        decodeUtf8(bytes.subarray(localAt+30,localAt+30+nameLen))!==name)
        fail();
      const start=localAt+30+nameLen;
      const data=bytes.subarray(start,start+size);
      if(crc32(data)!==crc)fail();
      out.set(name,decodeUtf8(data));
      locNext=start+size;
      cursor=nameAt+nameLen;
    }
    if(cursor!==end||locNext!==dirAt||!out.has(M)||!out.has(I)||
      (!out.has(P)&&!out.has(R)))fail();
    const order=[...out.keys()],expected=[P,R,M,I].filter(x=>out.has(x));
    if(order.join('|')!==expected.join('|'))fail();
    return out;
  }
  async function inspect(bytes,zipTools,review){
    if(!zipTools||typeof zipTools.sha256!=='function'||
       !review||typeof review.validatePageDraft!=='function'||
       typeof review.validateResourceDraft!=='function')fail();
    const files=decodeZip(bytes);
    let manifest,page=null,resource=null;
    try{
      manifest=JSON.parse(files.get(M));
      if(files.has(P))page=review.validatePageDraft(JSON.parse(files.get(P)));
      if(files.has(R))resource=review.validateResourceDraft(JSON.parse(files.get(R)));
    }catch(_){fail();}
    if(!exactly(manifest,[
      'format','publishable','githubReady','fullRepositoryBackup',
      'originalsVerifiedByGitCommit','generatedAt','originalResourceSha256',
      'pageFilePaths','resourceEdits','payloads','note'
    ])||manifest.format!==FORMAT||manifest.publishable!==false||
      manifest.githubReady!==false||manifest.fullRepositoryBackup!==false||
      manifest.originalsVerifiedByGitCommit!==false||
      typeof manifest.generatedAt!=='string'||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$/.test(manifest.generatedAt)||
      Number.isNaN(Date.parse(manifest.generatedAt))||
      manifest.note!=='Private draft review only. Never copy this ZIP into a live website.'||
      manifest.originalResourceSha256!==(resource?BASE:null)||
      !Array.isArray(manifest.pageFilePaths)||
      manifest.pageFilePaths.join('|')!==(page?PAGE_PATHS.join('|'):'')||
      manifest.resourceEdits!==(resource?resource.changes.length:0)||
      !Array.isArray(manifest.payloads)||
      manifest.payloads.length!==Number(!!page)+Number(!!resource))
      fail();
    const expected=[P,R].filter(name=>files.has(name));
    if(manifest.payloads.map(p=>p&&p.path).join('|')!==expected.join('|'))
      fail();
    for(const p of manifest.payloads){
      if(!exactly(p,['path','sha256','utf8Bytes'])||
        !/^[0-9a-f]{64}$/.test(p.sha256)||
        !Number.isSafeInteger(p.utf8Bytes)||
        p.utf8Bytes<1||p.utf8Bytes>MAX_ENTRY)
        fail();
      const text=files.get(p.path);
      if(new TextEncoder().encode(text).byteLength!==p.utf8Bytes)
        fail();
      let actual;
      try{actual=await zipTools.sha256(text);}
      catch(_){fail();}
      if(actual!==p.sha256)fail();
    }
    return Object.freeze({
      format:'naxx-local-verified-review-zip-v1',
      reviewOnly:true,githubReady:false,websiteFilesVerified:false,
      draftCount:expected.length,
      hasPageDraft:!!page,hasResourceDraft:!!resource,
      pageDraftText:page?files.get(P):null,
      resourceDraftText:resource?files.get(R):null,
      canApply:false,canPublish:false,networkRequests:0
    });
  }
  return Object.freeze({MAX_ARCHIVE,decodeZip,inspect});
});
