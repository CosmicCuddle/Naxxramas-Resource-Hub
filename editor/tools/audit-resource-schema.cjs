'use strict';
/*
 * Read-only resource schema inventory.
 * Does not execute source, export records, print IDs, or print unknown field names.
 * Requires the full, fingerprint-verified original HTML file.
 */
const fs = require('node:fs');
const path = require('node:path');
const {splitInMemory} = require('./check-legacy-roundtrip.cjs');
const {enclosingParts, property, kind} = require('./audit-legacy-shape.cjs');
const {readJsString} = require('./audit-legacy-json.cjs');

const FIELDS = ['id','title','section','classes','content','description','category',
  'icon','image','type','name','expansion','tier','dungeon','raid','enabled','visible'];
const TYPES = ['object','array','string','numberLike','expression','other','unparsed'];
function space(source, i) { while (i < source.length && /\s/.test(source[i])) i++; return i; }
function counts(values) {
  if (!values.length) return {min:0,max:0,meanRounded:0};
  return {min:Math.min(...values),max:Math.max(...values),
    meanRounded:Math.round(values.reduce((a,b)=>a+b,0)/values.length)};
}
function stringValue(text) {
  const raw = text.trim();
  const q = raw[0];
  if (q === '"' || q === "'") {
    const parsed = readJsString(raw,0);
    return parsed && parsed.end===raw.length ? parsed.value : null;
  }
  if (/^(?:0|[1-9]\d*)$/.test(raw)) return raw;
  return null;
}
function summarize(bytes) {
  const {records} = splitInMemory(bytes);
  const fieldKinds = {}, occurrences = {}, propertyCounts = [], unknownPerRecord = [];
  const ids = new Set(), sections = new Set(), classes = new Set();
  let idMissing=0,idUnparseable=0,idRepeated=0,sectionsUnparseable=0,classesUnparseable=0;
  let classTokens=0,recordsWithClasses=0,resourcesWithEmbeddedImages=0,imagesInResources=0;
  let totalUnknown=0,unparsedFields=0,recordWithUnknown=0;
  for (const key of FIELDS) {
    occurrences[key]=0;
    fieldKinds[key]=Object.fromEntries(TYPES.map(t=>[t,0]));
  }
  for (const record of records) {
    const first=space(record,0), root=enclosingParts(record,first);
    const props=root.segments.map(r=>({range:r, field:property(record,r)}));
    propertyCounts.push(props.length);
    let foundId=false,unknown=0,hasClasses=false;
    for (const {range,field} of props) {
      if (!field.key) {unparsedFields++;continue;}
      const value=record.slice(field.valueStart,range[1]);
      if (!FIELDS.includes(field.key)) {unknown++;continue;}
      occurrences[field.key]++;
      const fieldKind=TYPES.includes(field.type)?field.type:'other';
      fieldKinds[field.key][fieldKind]++;
      if (field.key==='id') {
        foundId=true;
        const normalized=stringValue(value);
        if (normalized===null)idUnparseable++;
        else if (ids.has(normalized))idRepeated++;
        else ids.add(normalized);
      }
      if (field.key==='section') {
        const normalized=stringValue(value);
        if (normalized===null) sectionsUnparseable++;
        else sections.add(normalized);
      }
      if (field.key==='classes') {
        hasClasses=true;
        if (field.type==='array') {
          const child=enclosingParts(record,space(record,field.valueStart));
          for (const item of child.segments) {
            const normalized=stringValue(record.slice(item[0],item[1]));
            if (normalized===null)classesUnparseable++;
            else {classes.add(normalized);classTokens++;}
          }
        } else classesUnparseable++;
      }
    }
    if (!foundId)idMissing++;
    if (hasClasses)recordsWithClasses++;
    if (unknown)recordWithUnknown++;
    unknownPerRecord.push(unknown);
    totalUnknown+=unknown;
    const imageCount=[...record.matchAll(/data:image\/(?:png|jpe?g|gif|webp);base64,/gi)].length;
    if (imageCount) resourcesWithEmbeddedImages++;
    imagesInResources+=imageCount;
  }
  return {
    format:'naxx-legacy-resource-schema-v1',
    readOnly:true,sourceCodeEvaluated:false,
    originalSourceVerified:true,
    recordsInspected:records.length,
    resourceFieldOccurrences:occurrences,
    fieldValueTypeCounts:fieldKinds,
    numberOfPropertiesPerRecord:counts(propertyCounts),
    unknownFieldOccurrences:totalUnknown,
    unknownFieldOccurrencesPerRecord:counts(unknownPerRecord),
    recordsWithAdditionalFields:recordWithUnknown,
    fieldsCouldNotBeParsed:unparsedFields,
    idFieldPresent:records.length-idMissing,
    idNormalization:{decodedDistinctIdCount:ids.size,repeatedDecodedIdCount:idRepeated,
      missingIdFields:idMissing,unparseableIdValues:idUnparseable},
    sectionNormalization:{distinctSectionValues:sections.size,unparseableSectionValues:sectionsUnparseable},
    classAssociationShape:{recordsWithClasses,decodedDistinctClassTokens:classes.size,
      decodedClassTokenOccurrences:classTokens,unparseableClassReferences:classesUnparseable},
    inlineImageMarkers:{resourceRecordsContainingAtLeastOne:resourcesWithEmbeddedImages,
      markersWithinResourceFragments:imagesInResources},
    note:'Aggregate-only lexical inventory. Unknown custom fields and live runtime relationships must still be preserved and tested.'
  };
}
if (require.main === module) {
  try {
    const file=path.resolve(__dirname,'..','..','site-content.html');
    process.stdout.write(JSON.stringify(summarize(fs.readFileSync(file)),null,2)+'\n');
  } catch (_) {
    process.stderr.write('Resource-schema audit stopped safely; no source data was printed.\n');
    process.exitCode=1;
  }
}
module.exports={summarize,stringValue};
