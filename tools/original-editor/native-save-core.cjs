'use strict';
/*
 * Preserve the original visual editor. The only persisted website change is
 * the JSON inside its existing embedded-data script. The local preview
 * redirects the original export action; it does not export the rendered DOM.
 */
const DATA_TAG='<script id="embedded-data">';
const DATA_PREFIX='window.NAXX_DATA = ';
const EXPORT_START='function exportUpdatedHtml(){';
const EXPORT_END='\n}\n\ninit();\n</script>';
const MAX_CHARS=70*1024*1024;
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const type=v=>Array.isArray(v)?'array':v===null?'null':typeof v;

function locateData(html){
  if(typeof html!=='string'||html.length===0||html.length>MAX_CHARS)
    throw Error('Unsupported original website source.');
  const tag=html.indexOf(DATA_TAG);
  if(tag<0||html.indexOf(DATA_TAG,tag+1)>=0)
    throw Error('Original embedded website data was not uniquely found.');
  const start=tag+DATA_TAG.length;
  const close=html.indexOf('</script>',start);
  if(close<0||!html.startsWith(DATA_PREFIX,start)||html[close-1]!==';')
    throw Error('Original website data format has changed.');
  const from=start+DATA_PREFIX.length,to=close-1;
  let data;
  try{data=JSON.parse(html.slice(from,to));}
  catch(_){throw Error('The original website data is not valid JSON.');}
  if(type(data)!=='object'||!Array.isArray(data.resources)||
     !Array.isArray(data.dungeonHandbooks)||typeof data.adminPassword!=='string'||
     typeof data.siteTitle!=='string')
    throw Error('The original editor data schema is incomplete.');
  return {from,to,data};
}

function encodeData(data){
  // Same JSON data semantics as the existing native exporter, with dangerous
  // HTML script tokenizer sequences escaped without changing decoded strings.
  return JSON.stringify(data).replace(/<!--|<\/?script\b/gi,
    text=>'\\u003c'+text.slice(1));
}

function prepareSavedSource(html,submittedJson){
  const old=locateData(html);
  let next;
  if(typeof submittedJson!=='string'||submittedJson.length>MAX_CHARS)
    throw Error('The saved editor data is missing or too large.');
  try{next=JSON.parse(submittedJson);}
  catch(_){throw Error('The editor did not submit valid website data.');}
  if(type(next)!=='object')throw Error('The editor data must remain an object.');
  // All legacy root fields, including unknown/custom fields, must survive.
  // Native add/delete/reorder operations within collections remain supported.
  for(const key of Object.keys(old.data)){
    if(!own(next,key)||type(next[key])!==type(old.data[key]))
      throw Error('An original website data field is missing or incompatible.');
  }
  if(next.adminPassword!==old.data.adminPassword)
    throw Error('Admin password changes cannot be published through this public-repository Save.');
  if(JSON.stringify(next)===JSON.stringify(old.data))
    return Object.freeze({html,changed:false});
  const encoded=encodeData(next);
  const saved=html.slice(0,old.from)+encoded+html.slice(old.to);
  const parsed=locateData(saved);
  if(JSON.stringify(parsed.data)!==JSON.stringify(next)||
     saved.slice(0,parsed.from)!==html.slice(0,old.from)||
     saved.slice(parsed.to)!==html.slice(old.to))
    throw Error('The original website shell or edited data could not be preserved.');
  return Object.freeze({html:saved,changed:true});
}

function sameShell(a,b){
  const x=locateData(a),y=locateData(b);
  return a.slice(0,x.from)===b.slice(0,y.from)&&
    a.slice(x.to)===b.slice(y.to);
}

function replaceExactly(text,from,to,expected){
  if(text.split(from).length-1!==expected)
    throw Error('The original visual editor Save controls have changed.');
  return text.split(from).join(to);
}

function localPreview(html){
  const data=locateData(html);
  // Keep the data block byte-for-byte unchanged while altering the local-only
  // UI shell. The original export wrappers still close their native modals.
  let before=html.slice(0,data.from),after=html.slice(data.to);
  const start=after.indexOf(EXPORT_START);
  const end=after.indexOf(EXPORT_END,start);
  if(start<0||end<start||after.indexOf(EXPORT_START,start+1)>=0||
     !after.slice(start,end).includes('const clone = document.documentElement.cloneNode(true);')||
     !after.slice(start,end).includes('JSON.stringify(DATA)')||
     !after.includes('let unlocked = false'))
    throw Error('The original editor export implementation has changed. Update the Save adapter before use.');
  const replacement=[
    'function exportUpdatedHtml(){',
    '  if(!unlocked) return;',
    '  if(typeof window.NaxxOriginalEditorSave !== "function"){',
    '    window.alert("Save connection unavailable. Your current edits are kept.");',
    '    return;',
    '  }',
    '  return window.NaxxOriginalEditorSave(DATA);',
    '}'
  ].join('\n');
  after=after.slice(0,start)+replacement+after.slice(end+2);
  before=replaceExactly(before,'⬇ Export Updated HTML','Save to GitHub',2);
  before=replaceExactly(before,'⬇ Download Updated Naxxramas HTML','Save to GitHub',1);
  before=replaceExactly(before,
    'It downloads a new copy of this HTML file containing all of your changes. Replace the old website HTML with the newly downloaded one.',
    'Saves your current edits to a GitHub review branch. Your live website is unchanged until you approve the update.',1);
  const closing=after.toLowerCase().lastIndexOf('</body>');
  if(closing<0)throw Error('The original editor document is incomplete.');
  after=after.slice(0,closing)+'<script src="/__naxx_editor/bridge.js"></script>\n'+after.slice(closing);
  return before+html.slice(data.from,data.to)+after;
}
module.exports=Object.freeze({locateData,prepareSavedSource,sameShell,localPreview,encodeData,MAX_CHARS});
