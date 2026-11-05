'use strict';
/*
 * Minimal deterministic ZIP/STORE codec for an explicitly allowlisted private
 * source-tree REVIEW archive. No compression, extraction to disk, networking,
 * arbitrary entry names, external libraries or ZIP64. The verifier checks
 * both local and central entries, CRC32 and canonical re-encoding.
 */
const crypto=require('node:crypto');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
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
const MAX_ENTRIES=500,MAX_TOTAL=128*1024*1024,MAX_FILE=64*1024*1024;
function allowedPath(name,allowed){
  return typeof name==='string'&&name.length>0&&name.length<240&&
    /^[A-Za-z0-9._/-]+$/.test(name)&&
    !name.startsWith('/')&&!name.includes('\\')&&
    !name.endsWith('/')&&!name.split('/').some(x=>!x||x==='.'||x==='..')&&
    allowed instanceof Set&&allowed.has(name);
}
function checkList(entries,allowed){
  if(!Array.isArray(entries)||entries.length<1||entries.length>MAX_ENTRIES||
     !allowed||allowed.size!==entries.length||allowed.size>MAX_ENTRIES)
    throw Error('Private source ZIP file list does not match approved inventory.');
  const used=new Set();let total=0;
  for(const e of entries){
    if(!e||!allowedPath(e.name,allowed)||
       used.has(e.name.toLowerCase())||!Buffer.isBuffer(e.bytes)||
       e.bytes.length>MAX_FILE)
      throw Error('Unsafe, duplicate or oversized private ZIP entry.');
    used.add(e.name.toLowerCase());
    total+=e.bytes.length;
  }
  if(total>MAX_TOTAL)throw Error('Private ZIP exceeds size limit.');
}
function encode(entries,allowed){
  checkList(entries,allowed);
  const ordered=entries.slice().sort((a,b)=>a.name.localeCompare(b.name,'en'));
  const local=[],central=[];let offset=0,centralBytes=0;
  for(const entry of ordered){
    const name=Buffer.from(entry.name,'utf8'),data=entry.bytes,crc=crc32(data);
    const header=Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50,0);
    header.writeUInt16LE(20,4);
    header.writeUInt16LE(0x0800,6);
    header.writeUInt16LE(0,8);
    header.writeUInt16LE(0,10);
    header.writeUInt16LE(33,12); // DOS 1980-01-01, deterministic
    header.writeUInt32LE(crc,14);
    header.writeUInt32LE(data.length,18);
    header.writeUInt32LE(data.length,22);
    header.writeUInt16LE(name.length,26);
    local.push(header,name,data);
    const c=Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50,0);
    c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);
    c.writeUInt16LE(0x0800,8);c.writeUInt16LE(0,10);
    c.writeUInt16LE(0,12);c.writeUInt16LE(33,14);
    c.writeUInt32LE(crc,16);
    c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);
    c.writeUInt16LE(name.length,28);
    c.writeUInt32LE(offset,42);
    central.push(c,name);
    const chunk=header.length+name.length+data.length;
    offset+=chunk;
    centralBytes+=c.length+name.length;
    if(offset+centralBytes>MAX_TOTAL+500000)throw Error('Private ZIP container exceeds limit.');
  }
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(ordered.length,8);
  end.writeUInt16LE(ordered.length,10);
  end.writeUInt32LE(centralBytes,12);
  end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,...central,end]);
}
function decode(buffer,allowed){
  if(!Buffer.isBuffer(buffer)||buffer.length<22||
     buffer.length>MAX_TOTAL+600000||!(allowed instanceof Set)||
     allowed.size<1||allowed.size>MAX_ENTRIES)
    throw Error('Unapproved private source archive.');
  const endAt=buffer.length-22;
  if(buffer.readUInt32LE(endAt)!==0x06054b50||
     buffer.readUInt16LE(endAt+4)!==0||
     buffer.readUInt16LE(endAt+6)!==0||
     buffer.readUInt16LE(endAt+20)!==0)
    throw Error('ZIP end record invalid.');
  const count=buffer.readUInt16LE(endAt+10),onDisk=buffer.readUInt16LE(endAt+8);
  const centralSize=buffer.readUInt32LE(endAt+12),centralAt=buffer.readUInt32LE(endAt+16);
  if(count!==allowed.size||onDisk!==count||centralAt+centralSize!==endAt)
    throw Error('ZIP central directory size or entry count invalid.');
  const parsed=[];let at=centralAt,localNext=0;
  const seen=new Set();
  for(let i=0;i<count;i++){
    if(at+46>endAt||buffer.readUInt32LE(at)!==0x02014b50)
      throw Error('ZIP central header missing.');
    const flags=buffer.readUInt16LE(at+8),method=buffer.readUInt16LE(at+10);
    const crc=buffer.readUInt32LE(at+16),size=buffer.readUInt32LE(at+20);
    const usize=buffer.readUInt32LE(at+24),nlen=buffer.readUInt16LE(at+28);
    const extra=buffer.readUInt16LE(at+30),comment=buffer.readUInt16LE(at+32);
    const disk=buffer.readUInt16LE(at+34),loc=buffer.readUInt32LE(at+42);
    const nameAt=at+46;
    if(flags!==0x0800||method!==0||usize!==size||size>MAX_FILE||
       extra||comment||disk||nlen<1||nameAt+nlen>endAt)
      throw Error('ZIP compression, flags or metadata are not approved.');
    const name=buffer.subarray(nameAt,nameAt+nlen).toString('utf8');
    if(!allowedPath(name,allowed)||seen.has(name.toLowerCase())||loc!==localNext)
      throw Error('ZIP path, order or offset is invalid.');
    seen.add(name.toLowerCase());
    if(loc+30+nlen+size>centralAt||buffer.readUInt32LE(loc)!==0x04034b50||
       buffer.readUInt16LE(loc+6)!==flags||
       buffer.readUInt16LE(loc+8)!==method||
       buffer.readUInt32LE(loc+14)!==crc||
       buffer.readUInt32LE(loc+18)!==size||
       buffer.readUInt32LE(loc+22)!==size||
       buffer.readUInt16LE(loc+26)!==nlen||
       buffer.readUInt16LE(loc+28)!==0)
      throw Error('ZIP local header differs from the verified central directory.');
    if(buffer.subarray(loc+30,loc+30+nlen).toString('utf8')!==name)
      throw Error('ZIP local filename mismatch.');
    const bytes=Buffer.from(buffer.subarray(loc+30+nlen,loc+30+nlen+size));
    if(crc32(bytes)!==crc)throw Error('ZIP entry checksum mismatch.');
    parsed.push({name,bytes});
    localNext=loc+30+nlen+size;
    at=nameAt+nlen;
  }
  if(localNext!==centralAt||at!==endAt||seen.size!==allowed.size||
     [...allowed].some(name=>!seen.has(name.toLowerCase())))
    throw Error('ZIP has missing, extra or overlapping paths.');
  // Reject non-canonical ZIPs, hidden trailers, changed timestamps or
  // header-only tampering even when CRCs happen to match.
  if(!encode(parsed,allowed).equals(buffer))
    throw Error('ZIP does not match the canonical private source archive.');
  return {entries:parsed,archiveSha256:sha256(buffer),entryCount:count};
}
module.exports={encode,decode,crc32,allowedPath};
