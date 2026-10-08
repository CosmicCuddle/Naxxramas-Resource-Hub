/* Naxxramas server talent calculator — uses the user's custom WotLK 3.3.5 DBC.
 * No server-side writes or character/account access. Static GitHub Pages only.
 */
(function(){
  'use strict';
  const ERA={vanilla:{title:'Vanilla',level:60,maxRow:6},tbc:{title:'The Burning Crusade',level:70,maxRow:8},wotlk:{title:'Wrath of the Lich King',level:80,maxRow:10}};
  const ERA_ORDER={vanilla:0,tbc:1,wotlk:2};
  const CLASSES=[['warrior','Warrior'],['paladin','Paladin'],['hunter','Hunter'],['rogue','Rogue'],['priest','Priest'],['deathknight','Death Knight'],['shaman','Shaman'],['mage','Mage'],['warlock','Warlock'],['druid','Druid']];
  const PALETTE=['#e7c17e','#eabec3','#a8cc85','#eed29a','#e0e3e8','#da8277','#6bbadd','#a0dafa','#bb9dcf','#e7a970'];
  const BASE='NT1';const STORAGE='naxx.talent.saves.v1';const d=document;
  const els=Object.fromEntries(['era','class','level','level-display','remaining','spent-summary','trees','notice','era-explanation','tooltip','dialog-overlay','dialog-title','dialog-content','dialog-close','copy-link','copy-code','save-build','load-build','import-code','reset'].map(id=>[id,d.getElementById(id)]));
  let db=null,records={}, classData=[], activeTooltip=null, eraFirst={};
  const model={era:'vanilla',class:'warrior',level:60,points:{}};
  const cap=()=>ERA[model.era].level;
  const budget=()=>Math.max(0,model.level-9);
  const spent=(pts=model.points)=>Object.values(pts).reduce((s,x)=>s+x,0);
  const pointsInTree=(tree,pts=model.points)=>tree[3].reduce((s,t)=>s+(pts[t[0]]||0),0);
  const getTreeOf=(t)=>classData.find(tr=>tr[3].some(v=>v[0]===t[0]));
  const talentById=(id)=>records[Number(id)]||null;
  // Classify each talent by its own earliest era. Do not hide an old talent
  // simply because its later 3.3.5 dependency did not exist in the older tree.
  function availableInEra(t,era=model.era){
    return t[1]<=ERA[era].maxRow && eraFirst[t[0]]<=ERA_ORDER[era];
  }
  // Pre-Wrath trees used different prerequisite relationships. When the current
  // 3.3.5 prerequisite was introduced later, it does not apply to the historical
  // era view. Unknown DBC prerequisite IDs still require manual verification.
  function relevantPrerequisiteId(t,era=model.era,lookup=records){
    if(!t[6])return 0;
    const prerequisite=lookup[t[6]];
    return prerequisite&&!availableInEra(prerequisite,era)?0:t[6];
  }
  const levelAvailable=(cls=model.class,era=model.era)=>cls!=='deathknight'||era==='wotlk';
  const cleanHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function allTalents(){return classData.flatMap(t=>t[3]);}
  function notify(message){els.notice.textContent=message;}
  function assignClass(cls){
    model.class=cls;classData=db.classes[cls]||[];records={};
    for(const tree of classData)for(const t of tree[3])records[t[0]]=t;
  }
  function lockedReason(t,pts=model.points){
    const era=ERA[model.era],tree=getTreeOf(t);if(!tree)return 'Talent does not exist in this class.';
    if(!availableInEra(t))return 'This talent or a prerequisite is not available in '+era.title+'.';
    const below=tree[3].reduce((count,item)=>count+(item[1]<t[1]?(pts[item[0]]||0):0),0);
    if(below<t[1]*5)return 'Spend '+(t[1]*5)+' points in earlier rows of '+tree[1]+' (currently '+below+').';
    const prereqId=relevantPrerequisiteId(t);
    if(prereqId){
      const prerequisite=talentById(prereqId);
      if(!prerequisite)return 'Unresolved DBC prerequisite: talent ID '+prereqId+'. This needs verification.';
      if((pts[prereqId]||0)<t[7]+1)return 'Requires '+prerequisite[4]+' '+(t[7]+1)+'/'+prerequisite[3].length+'.';
    }
    return '';
  }
  function checkBuild(pts,era=model.era,cls=model.class,level=model.level){
    const trees=db.classes[cls];if(!trees||!levelAvailable(cls,era))return 'Class unavailable for this progression era.';
    const lookup={};for(const tree of trees)for(const t of tree[3])lookup[t[0]]=t;
    const total=Object.entries(pts).reduce((sum,[id,count])=>sum+count,0);
    if(total>level-9)return 'Build exceeds the '+(level-9)+' point budget for level '+level+'.';
    for(const [idStr,count] of Object.entries(pts)){
      const id=Number(idStr),t=lookup[id];
      if(!t||!Number.isInteger(count)||count<0||count>t[3].length)return 'Invalid rank or unknown talent ID '+id+'.';
      if(!count)continue;
      if(!availableInEra(t,era,lookup))return t[4]+' is not available in '+ERA[era].title+'. Please choose a build for the correct expansion.';
      const tree=trees.find(tr=>tr[3].includes(t));
      if(!tree)return 'Talent has no tree: '+id;
      const below=tree[3].reduce((s,x)=>s+(x[1]<t[1]?(pts[x[0]]||0):0),0);
      if(below<t[1]*5)return 'Insufficient earlier-row points for '+t[4]+'.';
      const prereqId=relevantPrerequisiteId(t,era,lookup);
      if(prereqId){
        if(!lookup[prereqId])return 'Unresolved prerequisite for '+t[4]+' (ID '+prereqId+').';
        if((pts[prereqId]||0)<t[7]+1)return t[4]+' requires '+lookup[prereqId][4]+' rank '+(t[7]+1)+'.';
      }
    }
    return '';
  }
  function validate(pts){return checkBuild(pts);}
  function adjust(id,delta){
    const t=talentById(id);if(!t)return;
    const old=model.points[id]||0,next=old+delta;
    if(next<0||next>t[3].length)return;
    if(delta>0&&spent()>=budget()){notify('No points remaining. Increase your level or remove a talent point.');return;}
    if(delta>0){const why=lockedReason(t);if(why){notify(why);return;}}
    const trial={...model.points};if(next)trial[id]=next;else delete trial[id];
    const invalid=validate(trial);if(invalid){notify(invalid);return;}
    model.points=trial;notify('');render();updateURL();
  }
  function parseBuildCode(value){
    const code=String(value||'').trim();const parts=code.split(':');
    if(parts.length!==4||parts[0]!==BASE)throw Error('Code must begin with NT1: and have an era, class and talents.');
    const [,era,cls,body]=parts;
    if(!ERA[era]||!db.classes[cls])throw Error('Unknown era or class in build code.');
    const pts={};if(body){
      const chunks=body.split('.');if(chunks.length>120)throw Error('Too many talents in build code.');
      for(const chunk of chunks){
        const found=/^([0-9a-z]+)-([1-9])$/.exec(chunk);
        if(!found)throw Error('Invalid talent entry: '+chunk);
        const id=parseInt(found[1],36),count=Number(found[2]);
        if(!Number.isSafeInteger(id)||Object.prototype.hasOwnProperty.call(pts,id))throw Error('Duplicate or invalid talent.');
        pts[id]=count;
      }
    }
    const limit=ERA[era].level;
    const err=checkBuild(pts,era,cls,limit);
    if(err)throw Error(err);
    return {era,cls,pts};
  }
  function createCode(){
    const pairs=Object.entries(model.points).filter(([,v])=>v>0).sort((a,b)=>Number(a[0])-Number(b[0]));
    return BASE+':'+model.era+':'+model.class+':'+pairs.map(([id,rank])=>Number(id).toString(36)+'-'+rank).join('.');
  }
  function buildUrl(){
    const url=new URL(window.location.href);url.searchParams.set('code',createCode());url.searchParams.set('level',String(model.level));url.searchParams.delete('era');url.searchParams.delete('class');url.hash='';return url.toString();
  }
  function updateURL(){history.replaceState(null,'',buildUrl());}
  function applyBuild(code){
    const parsed=parseBuildCode(code);assignClass(parsed.cls);model.era=parsed.era;model.level=cap();model.points=parsed.pts;
    const requested=new URLSearchParams(location.search).get('level');
    if(requested && /^\d{1,2}$/.test(requested)) {
      const level=Number(requested);if(level>=10&&level<=cap()&&!checkBuild(parsed.pts,parsed.era,parsed.cls,level))model.level=level;
    }
    syncControls();render();updateURL();notify('Build imported successfully.');
  }
  function setEra(era){
    if(!ERA[era])return;
    model.era=era;
    if(!levelAvailable()){assignClass('warrior');model.points={};notify('Death Knights are available in Wrath. Warrior selected instead.');}
    else if(Object.keys(model.points).length){model.points={};notify('Changed era: talent points reset to respect the new row limits.');}
    model.level=cap();syncControls();render();updateURL();
  }
  function setClass(cls){
    if(!db.classes[cls])return;
    if(!levelAvailable(cls,model.era)){notify('Death Knights are only available in the Wrath calculator.');syncControls();return;}
    assignClass(cls);model.points={};syncControls();render();notify('');updateURL();
  }
  function syncControls(){
    els.era.value=model.era;els.class.textContent='';
    for(const [id,label] of CLASSES){
      const opt=d.createElement('option');opt.value=id;opt.textContent=label;if(!levelAvailable(id,model.era))opt.disabled=true;
      els.class.appendChild(opt);
    }
    els.class.value=model.class;els.level.max=cap();els.level.value=model.level;els['level-display'].value=model.level;
    els['era-explanation'].textContent=ERA[model.era].title+': rows 1–'+(ERA[model.era].maxRow+1)+'; later-expansion talents are hidden, while renamed earlier talents remain visible.';
  }
  function makeTalentButton(t){
    const count=model.points[t[0]]||0,missing=!!(relevantPrerequisiteId(t)&&!talentById(t[6]));
    const reason=lockedReason(t);
    const b=d.createElement('button');b.type='button';b.className='talent'+(count?' spent':!reason?' ready':' locked')+(missing?' unknown':'');
    b.style.gridRow=t[1]+1;b.style.gridColumn=t[2]+1;b.dataset.talentId=t[0];
    b.setAttribute('aria-label',t[4]+', '+count+' of '+t[3].length+' ranks'+(reason?'. '+reason:''));
    b.innerHTML='<span class="initial" aria-hidden="true">'+cleanHTML(t[4].slice(0,1).toUpperCase())+'</span>'+
      '<span class="rank" aria-hidden="true">'+count+'/'+t[3].length+'</span>'+(missing?'<span class="lock-mark" aria-hidden="true">!</span>':'');
    b.addEventListener('click',()=>adjust(t[0],1));
    b.addEventListener('contextmenu',e=>{e.preventDefault();adjust(t[0],-1);});
    b.addEventListener('keydown',e=>{if(e.key==='Backspace'||e.key==='Delete'||e.key==='-'){e.preventDefault();adjust(t[0],-1);}});
    b.addEventListener('pointerenter',e=>showTooltip(t,e));
    b.addEventListener('pointermove',moveTooltip);
    b.addEventListener('pointerleave',hideTooltip);
    b.addEventListener('focus',e=>showTooltip(t,e));
    b.addEventListener('blur',hideTooltip);
    return b;
  }
  function showTooltip(t,event){
    const tooltip=els.tooltip,count=model.points[t[0]]||0;
    const rankIndex=Math.min(count,t[3].length-1);
    const desc=t[9][rankIndex]||t[5]||'No description in the supplied Spell.dbc.';
    tooltip.textContent='';
    const title=d.createElement('strong');title.textContent=t[4];tooltip.appendChild(title);
    const meta=d.createElement('div');meta.className='meta';meta.textContent='Rank '+count+'/'+t[3].length+' · Row '+(t[1]+1)+' · Spell '+t[3][rankIndex];tooltip.appendChild(meta);
    const p=d.createElement('p');p.textContent=desc;tooltip.appendChild(p);
    const r=lockedReason(t);if(r){const requirement=d.createElement('div');requirement.className=t[6]&&!talentById(t[6])?'warn':'req';requirement.textContent=r;tooltip.appendChild(requirement);}
    const extra=d.createElement('em');extra.textContent='Click to add · Right-click or press − to remove';tooltip.appendChild(extra);
    tooltip.hidden=false;activeTooltip=t;moveTooltip(event);
  }
  function moveTooltip(event){
    if(!activeTooltip)return;
    const box=els.tooltip;
    let x=event.clientX, y=event.clientY;
    if(x==null||y==null){const r=event.target.getBoundingClientRect();x=r.left+r.width/2;y=r.top;}
    const width=box.offsetWidth||320,height=box.offsetHeight||150;
    box.style.left=Math.max(10,Math.min(window.innerWidth-width-10,x+18))+'px';
    box.style.top=Math.max(10,Math.min(window.innerHeight-height-10,y+18))+'px';
  }
  function hideTooltip(){activeTooltip=null;els.tooltip.hidden=true;}
  function render(){
    hideTooltip();const remaining=budget()-spent();els.remaining.textContent=remaining;els['spent-summary'].textContent=spent()+' / '+budget()+' spent';
    els['level-display'].value=model.level;els.trees.textContent='';
    const frag=d.createDocumentFragment();
    classData.forEach((tree,index)=>{
      const panel=d.createElement('article');panel.className='tree';panel.style.setProperty('--tree-glow',PALETTE[(CLASSES.findIndex(x=>x[0]===model.class)+index)%PALETTE.length]);
      const count=pointsInTree(tree);const header=d.createElement('div');header.className='tree-header';
      const left=d.createElement('div');const small=d.createElement('small');small.textContent='TALENT TREE '+(index+1);const h=d.createElement('h2');h.textContent=tree[1];left.append(small,h);
      const output=d.createElement('output');output.textContent=count;output.setAttribute('aria-label',tree[1]+' points spent: '+count);header.append(left,output);
      const grid=d.createElement('div');grid.className='talent-grid';grid.setAttribute('aria-label',tree[1]+' talent tree');
      grid.style.setProperty('--visible-rows',String(ERA[model.era].maxRow+1));
      // No later-expansion buttons (not even faded placeholders). Earlier-era dependencies still matter.
      for(const t of tree[3])if(availableInEra(t))grid.appendChild(makeTalentButton(t));
      const footer=d.createElement('div');footer.className='tree-footer';footer.innerHTML='<span class="meta">'+count+' points</span> invested in '+cleanHTML(tree[1]);
      panel.append(header,grid,footer);frag.appendChild(panel);
    });
    els.trees.appendChild(frag);
  }
  function showDialog(title,buildContent){
    els['dialog-title'].textContent=title;els['dialog-content'].replaceChildren();buildContent(els['dialog-content']);els['dialog-overlay'].hidden=false;
    const focus=els['dialog-content'].querySelector('input,button');(focus||els['dialog-close']).focus();
  }
  function closeDialog(){els['dialog-overlay'].hidden=true;els['save-build'].focus();}
  function saved(){try{const x=JSON.parse(localStorage.getItem(STORAGE)||'[]');return Array.isArray(x)?x.slice(0,30):[];}catch(_){return [];}}
  function store(items){try{localStorage.setItem(STORAGE,JSON.stringify(items.slice(0,30)));return true;}catch(_){notify('Could not save builds in this browser. You can still copy the share code.');return false;}}
  function addButton(parent,title,fn,cls){const b=d.createElement('button');b.type='button';b.textContent=title;if(cls)b.className=cls;b.addEventListener('click',fn);parent.appendChild(b);return b;}
  function openSave(){
    showDialog('Save this build',body=>{
      const p=d.createElement('p');p.textContent='Give this build a name. It will be stored in this browser only.';
      const input=d.createElement('input');input.type='text';input.maxLength=60;input.placeholder='e.g. Vanilla Arms raid build';
      const actions=d.createElement('div');actions.className='dialog-actions';
      const save=()=>{const name=input.value.trim();if(!name){input.focus();return;}
        const arr=saved();arr.unshift({name,code:createCode(),date:new Date().toISOString()});
        if(store(arr)){closeDialog();notify('Build “'+name+'” saved locally. Use Copy share link to send it to someone else.');}
      };
      addButton(actions,'Save build',save);input.addEventListener('keydown',e=>{if(e.key==='Enter')save();});body.append(p,input,actions);
    });
  }
  function openSaved(){
    showDialog('My saved builds',body=>{
      const arr=saved();if(!arr.length){const p=d.createElement('p');p.textContent='No builds saved yet. Use “Save build” when you have a talent setup you like.';body.appendChild(p);return;}
      arr.forEach((entry,index)=>{
        const row=d.createElement('div');row.className='saved-entry';const main=d.createElement('div');
        const name=d.createElement('strong');name.textContent=entry.name;
        const meta=d.createElement('div');meta.textContent=entry.code.slice(0,80);meta.style.fontSize='11px';meta.style.color='#a9bccb';main.append(name,meta);
        const actions=d.createElement('div');actions.className='dialog-actions';
        addButton(actions,'Load',()=>{try{applyBuild(entry.code);closeDialog();}catch(e){notify(e.message);closeDialog();}});
        addButton(actions,'Delete',()=>{if(store(arr.filter((_,i)=>i!==index)))openSaved();},'delete');
        row.append(main,actions);body.appendChild(row);
      });
    });
  }
  function openImport(){
    showDialog('Import a build code',body=>{
      const p=d.createElement('p');p.textContent='Paste an NT1 code shared by another Naxxramas player.';
      const input=d.createElement('input');input.type='text';input.placeholder='NT1:vanilla:warrior:...';input.spellcheck=false;
      const actions=d.createElement('div');actions.className='dialog-actions';
      const submit=()=>{try{applyBuild(input.value);closeDialog();}catch(e){notify('Import failed: '+e.message);closeDialog();}};
      addButton(actions,'Import build',submit);input.addEventListener('keydown',e=>{if(e.key==='Enter')submit();});body.append(p,input,actions);
    });
  }
  async function copy(text,label){
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(text);
      else{const input=d.createElement('textarea');input.value=text;input.style.position='fixed';input.style.left='-100vw';d.body.appendChild(input);input.select();if(!d.execCommand('copy'))throw Error('Copy not supported');input.remove();}
      notify(label+' copied to clipboard.');
    }catch(_){showDialog('Copy '+label,body=>{const p=d.createElement('p');p.textContent='Select and copy this text:';const inp=d.createElement('input');inp.readOnly=true;inp.value=text;body.append(p,inp);inp.select();});}
  }
  function bind(){
    els.era.addEventListener('change',()=>setEra(els.era.value));
    els.class.addEventListener('change',()=>setClass(els.class.value));
    els.level.addEventListener('input',()=>{
      const next=Number(els.level.value);
      if(spent()>next-9){els.level.value=model.level;notify('Your current build needs at least level '+(spent()+9)+'. Remove some points before reducing the level.');return;}
      model.level=next;els['level-display'].value=model.level;render();notify('');
    });
    els.reset.addEventListener('click',()=>{if(!spent())return;if(!window.confirm('Reset all points in this build?'))return;model.points={};render();updateURL();notify('Talent points reset.');});
    els['copy-link'].addEventListener('click',()=>copy(buildUrl(),'Share link'));
    els['copy-code'].addEventListener('click',()=>copy(createCode(),'Build code'));
    els['save-build'].addEventListener('click',openSave);
    els['load-build'].addEventListener('click',openSaved);
    els['import-code'].addEventListener('click',openImport);
    els['dialog-close'].addEventListener('click',closeDialog);
    els['dialog-overlay'].addEventListener('click',e=>{if(e.target===els['dialog-overlay'])closeDialog();});
    d.addEventListener('keydown',e=>{if(e.key==='Escape'&&!els['dialog-overlay'].hidden)closeDialog();});
  }
  async function loadData(){
    const response=await fetch('data/server-talents-v1.gz.b64');
    if(!response.ok)throw Error('Data file could not be fetched ('+response.status+').');
    if(typeof DecompressionStream!=='function')throw Error('This browser does not support gzip decompression. Use an up-to-date browser.');
    const base64=(await response.text()).trim();
    const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    const content=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    const parsed=JSON.parse(content);
    if(parsed.version!==1||!parsed.classes||Object.keys(parsed.classes).length!==10)throw Error('Data format is not recognised.');
    const historyResponse=await fetch('data/era-availability-v2.json?v=2');
    if(!historyResponse.ok)throw Error('Era availability data could not be fetched ('+historyResponse.status+').');
    const availability=await historyResponse.json();
    const talentNodes=Object.values(parsed.classes).flatMap(trees=>trees.flatMap(tree=>tree[3]));
    if(availability.version!==2||!availability.earliest||talentNodes.length!==830||
      Object.keys(availability.earliest).length!==talentNodes.length||
      talentNodes.some(t=>![0,1,2].includes(availability.earliest[t[0]]))){
      throw Error('Expansion talent history does not match the server DBC snapshot.');
    }
    eraFirst=availability.earliest;
    return parsed;
  }
  async function start(){
    try{
      db=await loadData();
      let initial=new URLSearchParams(window.location.search).get('code');
      assignClass('warrior');syncControls();bind();
      if(initial){try{applyBuild(initial);}catch(e){notify('Shared build could not be loaded: '+e.message);render();}}
      else {render();}
    }catch(error){els.trees.innerHTML='<p class="tree-empty">Talent data could not be loaded. Please refresh later or report this problem to the Resource Hub administrator.</p>';notify(error.message);console.error('Naxxramas Talent Calculator:',error);}
  }
  // Expose pure logic to local automated tests only; safe readonly method collection.
  if(typeof window!=='undefined')window.NaxxTalentTest={checkBuild,parseBuildCode,createCode,lockedReason,availableInEra,relevantPrerequisiteId,setModel:(x,dataset,availability)=>{db=dataset;if(availability)eraFirst=availability;model.era=x.era;model.level=x.level;assignClass(x.class);model.points=x.points||{};},state:()=>({...model,points:{...model.points}})};
  start();
})();