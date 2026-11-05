'use strict';
/*
 * Inventory embedded base64 images without writing files or exposing images,
 * URLs, source snippets, pixel contents, or individual hashes.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {splitInMemory}=require('./check-legacy-roundtrip.cjs');

function validSignature(mime,bytes){
  if(mime==='png')return bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
  if(mime==='jpeg')return bytes.length>=3 && bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(mime==='gif')return bytes.subarray(0,6).toString('ascii')==='GIF87a' ||
    bytes.subarray(0,6).toString('ascii')==='GIF89a';
  if(mime==='webp')return bytes.subarray(0,4).toString('ascii')==='RIFF' &&
    bytes.subarray(8,12).toString('ascii')==='WEBP';
  return false;
}
function inventory(bytes){
  const parsed=splitInMemory(bytes);
  const source=parsed.source;
  const regex=/data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=]+)/gi;
  const unique=new Set();
  const formats={png:0,jpeg:0,gif:0,webp:0};
  const location={beforeResources:0,withinResources:0,afterResources:0};
  let total=0,exactRoundTrips=0,validImageHeaders=0,failedImageHeaders=0;
  let rawByteTotal=0,minBytes=Infinity,maxBytes=0,matchingRecordFragments=0;
  for(const match of source.matchAll(regex)){
    total++;
    if(total>1000)throw new Error('Too many inline assets; audit stopped.');
    const mime=match[1].toLowerCase()==='jpg'?'jpeg':match[1].toLowerCase();
    const payload=match[2];
    const binary=Buffer.from(payload,'base64');
    const normalized=binary.toString('base64').replace(/=+$/,'');
    if(normalized===payload.replace(/=+$/,''))exactRoundTrips++;
    if(validSignature(mime,binary))validImageHeaders++;else failedImageHeaders++;
    const digest=crypto.createHash('sha256').update(binary).digest('hex');
    unique.add(mime+':'+digest);
    formats[mime]++;
    rawByteTotal+=binary.length;
    minBytes=Math.min(minBytes,binary.length);
    maxBytes=Math.max(maxBytes,binary.length);
    if(match.index<parsed.arrayBegin)location.beforeResources++;
    else if(match.index>=parsed.arrayEnd)location.afterResources++;
    else {location.withinResources++;matchingRecordFragments++;}
  }
  return {
    reportFormat:'naxx-inline-media-audit-v1',
    sourceBaselineVerified:true,readOnly:true,
    imageMarkersFound:total,
    distinctImagePayloadsByHash:unique.size,
    mimeCounts:formats,
    originalPositions:location,
    completeBase64RoundTrips:exactRoundTrips,
    validDeclaredImageHeaders:validImageHeaders,
    invalidOrUnrecognizedHeaders:failedImageHeaders,
    totalDecodedImageBytes:rawByteTotal,
    smallestDecodedImageBytes:Number.isFinite(minBytes)?minBytes:0,
    largestDecodedImageBytes:maxBytes,
    resourcesWithMarkerOccurrences:matchingRecordFragments,
    note:'Source-based analysis only. Duplicate payload hashes count unique images, not image usage or external referenced assets.'
  };
}
if(require.main===module){
  try{
    const source=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    process.stdout.write(JSON.stringify(inventory(source),null,2)+'\n');
  }catch(_){
    process.stderr.write('Inline-media audit stopped safely; no media content was printed.\n');
    process.exitCode=1;
  }
}
module.exports={inventory,validSignature};
