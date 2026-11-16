/* ZIP32 with per-file DEFLATE, safe stored fallback, no dependencies. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NaxxEasySaveZip=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const table=new Uint32Array(256);
 for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[i]=c>>>0;}
 function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
 const assert=(x,m)=>{if(!x)throw Error(m);};
 const max=0xffffffff;
 function header(size){const b=new Uint8Array(size);return {b,v:new DataView(b.buffer)};}
 async function archive(entries){
  assert(Array.isArray(entries)&&entries.length>0&&entries.length<65535,'Invalid ZIP entries.');
  const enc=new TextEncoder(),local=[],central=[],seen=new Set();let offset=0,centralSize=0;
  for(const entry of entries){
   assert(entry&&typeof entry.name==='string'&&/^(?:COPY-INTO-REPOSITORY\/[^/]+(?:\/[^/]+)*|UPLOAD-INSTRUCTIONS\.txt)$/.test(entry.name)&&!entry.name.split('/').some(x=>x==='.'||x==='..')&&!/[\\\x00-\x1f]/.test(entry.name)&&!seen.has(entry.name),'Unsafe ZIP path.');
   seen.add(entry.name);const name=enc.encode(entry.name),raw=typeof entry.data==='string'?enc.encode(entry.data):entry.data;
   assert(name.length<=65535&&raw instanceof Uint8Array&&raw.length<max,'Invalid ZIP file.');
   let packed=raw,method=0;
   if(raw.length&&typeof CompressionStream==='function'){
    try{const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'));const compressed=new Uint8Array(await new Response(stream).arrayBuffer());if(compressed.length<raw.length){packed=compressed;method=8;}}catch(_){/* Older browsers retain exact bytes using ZIP STORE. */}
   }
   const crc=crc32(raw),l=header(30),c=header(46);
   l.v.setUint32(0,0x04034b50,true);l.v.setUint16(4,20,true);l.v.setUint16(6,0x800,true);l.v.setUint16(8,method,true);l.v.setUint16(12,33,true);l.v.setUint32(14,crc,true);l.v.setUint32(18,packed.length,true);l.v.setUint32(22,raw.length,true);l.v.setUint16(26,name.length,true);
   c.v.setUint32(0,0x02014b50,true);c.v.setUint16(4,20,true);c.v.setUint16(6,20,true);c.v.setUint16(8,0x800,true);c.v.setUint16(10,method,true);c.v.setUint16(14,33,true);c.v.setUint32(16,crc,true);c.v.setUint32(20,packed.length,true);c.v.setUint32(24,raw.length,true);c.v.setUint16(28,name.length,true);c.v.setUint32(42,offset,true);
   local.push(l.b,name,packed);central.push(c.b,name);offset+=30+name.length+packed.length;centralSize+=46+name.length;
   assert(offset<max&&offset+centralSize+22<max,'ZIP32 size limit exceeded.');
  }
  const end=header(22);end.v.setUint32(0,0x06054b50,true);end.v.setUint16(8,entries.length,true);end.v.setUint16(10,entries.length,true);end.v.setUint32(12,centralSize,true);end.v.setUint32(16,offset,true);
  return new Blob([...local,...central,end.b],{type:'application/zip'});
 }
 return Object.freeze({crc32,archive});
});
