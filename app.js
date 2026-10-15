'use strict';
// Reopen the last active account's offline snapshot after the APK is restarted.
// No Drive uploads occur until Google verifies the account again.
const LAST_ACCOUNT_KEY='myfitness-last-active-account-v2';
const savedAccountKey=(()=>{
  try {
    const v=localStorage.getItem(LAST_ACCOUNT_KEY);
    return v && /^myfitness-account-.+-v2$/.test(v) ? v : null;
  } catch {
    return null;
  }
})();
let KEY=savedAccountKey||'myfitness-guest-v2';
let editingWorkoutIndex=null, editingExercises=[];
// Clear unsaved editors whenever account ownership changes.
function resetAccountEditors(){
 resetWorkoutEditor();activeRoutine=null;clearTemplateForm();$('profileStatus').textContent='';
 for(const id of ['templateName','templateExercise','templateReps','foodName','foodCal','foodProt','weightValue','exName','exReps','exWeight'])$(id).value='';
 routineRender();templateRender();
}
const ROUTINES={
'Full Body — Beginner':[['Leg press',3,'10-12'],['Seated cable row',3,'10-12'],['Chest press machine',3,'10-12'],['Seated leg curl',2,'12'],['Lat pulldown',2,'10-12'],['Glute bridge',3,'12'],['Standing calf raise',2,'12-15'],['Dead bug',2,'8 each side']],
"Arnold - Chest + Back A":[["Barbell bench press", 4, "6-10"], ["Wide-grip pull-ups", 3, "6-12"], ["Incline barbell bench press", 3, "8-12"], ["Bent-over barbell row", 3, "8-12"], ["Dumbbell flyes", 3, "10-15"], ["Dumbbell pullover", 3, "10-15"]],
"Arnold - Shoulders + Arms A":[["Standing barbell military press", 3, "6-10"], ["Dumbbell lateral raise", 3, "10-15"], ["Bent-over dumbbell rear delt fly", 3, "12-15"], ["Standing barbell curl", 3, "8-12"], ["Close-grip bench press", 3, "8-12"], ["Incline dumbbell curl", 3, "10-12"], ["Lying EZ-bar triceps extension", 3, "10-12"]],
"Arnold - Legs + Abs A":[["Barbell back squat", 4, "6-10"], ["Barbell Romanian deadlift", 3, "8-12"], ["Walking dumbbell lunge", 3, "10 each leg"], ["Lying leg curl", 3, "10-15"], ["Standing calf raise", 4, "12-20"], ["Hanging leg raise", 3, "10-15"], ["Decline sit-up", 3, "12-15"]],
"Arnold - Chest + Back B":[["Incline dumbbell bench press", 4, "8-12"], ["T-bar row", 4, "8-12"], ["Flat dumbbell bench press", 3, "8-12"], ["Underhand chin-ups", 3, "6-12"], ["Flat dumbbell flyes", 3, "10-15"], ["One-arm dumbbell row", 3, "10-12"]],
"Arnold - Shoulders + Arms B":[["Arnold dumbbell press", 3, "8-12"], ["Seated dumbbell lateral raise", 3, "12-15"], ["Bent-over rear delt raise", 3, "12-15"], ["EZ-bar preacher curl", 3, "8-12"], ["Dumbbell overhead triceps extension", 3, "10-12"], ["Concentration curl", 3, "10-12"], ["Parallel bar triceps dips", 3, "8-12"]],
"Arnold - Legs + Abs B":[["Barbell front squat", 4, "6-10"], ["Barbell hip thrust", 3, "8-12"], ["Bulgarian split squat", 3, "8-12 each leg"], ["Stiff-leg dumbbell deadlift", 3, "8-12"], ["Seated calf raise", 4, "12-20"], ["Roman chair sit-up", 3, "12-15"], ["Back extension", 3, "10-15"]],
'Rest':[]};
let activeRoutine=null, templateDraft=[], selectedTemplateName=null;
const fresh=()=>({version:2,profile:{name:'',unit:'kg',accent:'#48644e',categories:Object.keys(ROUTINES)},goals:{calories:2000,protein:120,weight:null,fat:null,date:''},workouts:[],foods:[],weights:[],templates:[]});
const valid=d=>d&&d.version===2&&d.profile&&d.goals&&Array.isArray(d.workouts)&&Array.isArray(d.foods)&&Array.isArray(d.weights);
let state;try{const a=JSON.parse(localStorage.getItem(KEY));state=valid(a)?a:fresh()}catch{state=fresh()}
if(!Array.isArray(state.templates)) state.templates=[];
const $=id=>document.getElementById(id),dateToday=()=>{const x=new Date();return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
for(const id of ['wDate','nDate','weightDate','routineDate'])$(id).value=dateToday();
const fmtDate=s=>new Date(s+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
const txt=(tag,value)=>{const a=document.createElement(tag);a.textContent=String(value);return a};
const td=(tr,v)=>tr.append(txt('td',v));
const num=(v)=>Number.isFinite(Number(v))?Number(v):0;
const displayWeight=kg=>state.profile.unit==='lb'?kg*2.2046226218:kg;
const inputWeight=n=>state.profile.unit==='lb'?n/2.2046226218:n;
const unit=()=>state.profile.unit;
function removeBtn(callback){const b=txt('button','Delete');b.className='btn danger small';b.onclick=()=>{if(confirm('Delete this record?')){callback();persist()}};return b}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));render();window.dispatchEvent(new Event('myfitness:changed'))}catch(e){alert('Could not save data: '+e.message)}}
function jump(tab){document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===tab))}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>jump(b.dataset.tab));document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>jump(b.dataset.goto));
const logMonday=d=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
const logIso=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
const logShift=(iso,delta)=>{const x=new Date(iso+'T12:00:00');x.setDate(x.getDate()+delta);return logIso(x)};
const logMonthStart=val=>val+'-01';
let logWeek={wlog:logIso(logMonday(dateToday())),nlog:logIso(logMonday(dateToday()))};
function drawWeek(which){const root=$(which+'Days');if(!root)return;root.replaceChildren();const start=logWeek[which],last=logShift(start,6);$(which+'Range').textContent=`${fmtDate(start)} – ${fmtDate(last)}`;const selected=which==='wlog'?$('wDate').value:$('nDate').value;const summary=$(which+'Detail');for(let n=0;n<7;n++){const iso=logShift(start,n),x=new Date(iso+'T12:00:00'),button=document.createElement('button');button.type='button';button.className='day-tile'+(iso===selected?' selected':'');const day=document.createElement('strong');day.textContent=x.toLocaleDateString(undefined,{weekday:'short'});const number=document.createElement('span');number.className='day-num';number.textContent=x.getDate();const small=document.createElement('small');if(which==='nlog'){const foods=state.foods.filter(f=>f.date===iso),cal=foods.reduce((a,b)=>a+num(b.calories),0),prot=foods.reduce((a,b)=>a+num(b.protein),0);small.textContent=foods.length?`${Math.round(cal)} kcal · ${Math.round(prot)}g`:'—';if(foods.length)button.classList.add('has-entry')}else{const workouts=state.workouts.filter(w=>w.date===iso);small.textContent=workouts.length?workouts.map(w=>w.status==='Rest'?'Rest':w.name).join(' / '):'—';if(workouts.length)button.classList.add('has-entry')}button.append(day,number,small);button.onclick=()=>{if(which==='nlog'){$('nDate').value=iso}else{$('wDate').value=iso;$('routineDate').value=iso}render()};root.append(button)}if(which==='nlog'){const entries=state.foods.filter(f=>f.date===selected),cal=entries.reduce((a,b)=>a+num(b.calories),0),prot=entries.reduce((a,b)=>a+num(b.protein),0);summary.textContent=`Selected ${fmtDate(selected)} · ${Math.round(cal)} kcal · ${prot.toFixed(1)} g protein · ${entries.length} food entries`}else{const entries=state.workouts.filter(w=>w.date===selected);summary.textContent=`Selected ${fmtDate(selected)} · ${entries.length?entries.map(w=>w.name+' ('+w.status+')').join('; '):'No workout recorded'}`}}
for(const which of ['wlog','nlog']){const m=$(which+'Month');m.value=dateToday().slice(0,7);m.onchange=()=>{if(!m.value)return;logWeek[which]=logIso(logMonday(logMonthStart(m.value)));render()};$(which+'Prev').onclick=()=>{logWeek[which]=logShift(logWeek[which],-7);m.value=logWeek[which].slice(0,7);render()};$(which+'Next').onclick=()=>{logWeek[which]=logShift(logWeek[which],7);m.value=logWeek[which].slice(0,7);render()}}
function render(){displayedGoalUnit=unit();if(!Array.isArray(state.templates))state.templates=[];if(typeof refreshTemplates==='function')refreshTemplates();if($('greeting'))$('greeting').textContent='Today at a glance';document.querySelectorAll('.unit').forEach(x=>x.textContent=unit());
const todayFoods=state.foods.filter(f=>f.date===dateToday());const sum=items=>({cal:items.reduce((s,f)=>s+num(f.calories),0),prot:items.reduce((s,f)=>s+num(f.protein),0)});
let ov=sum(todayFoods);$('ovCalories').textContent=Math.round(ov.cal);$('ovProtein').textContent=`${ov.prot.toFixed(1)} g`;$('ovCalGoal').textContent=`Goal ${state.goals.calories} kcal`;$('ovProteinGoal').textContent=`Goal ${state.goals.protein} g`;
const weights=[...state.weights].sort((a,b)=>a.date.localeCompare(b.date));const latest=weights.at(-1);$('ovWeight').textContent=latest?`${displayWeight(latest.kg).toFixed(1)} ${unit()}`:'—';$('ovWeightGoal').textContent=state.goals.weight?`Target ${displayWeight(state.goals.weight).toFixed(1)} ${unit()}`:'No target weight set';const weekStart=logIso(logMonday(dateToday()));const weekly=state.workouts.filter(w=>w.date>=weekStart&&w.date<=logShift(weekStart,6));const counted=[...new Set(weekly.filter(w=>w.status==='Done').map(w=>w.date))].length;const rested=[...new Set(weekly.filter(w=>w.status==='Rest').map(w=>w.date))].length;const planned=[...new Set(weekly.filter(w=>w.status==='Planned').map(w=>w.date))].length;$('ovSessions').textContent=`This week (${fmtDate(weekStart)} – ${fmtDate(logShift(weekStart,6))}): ${counted} training days · ${rested} rest days · ${planned} planned`;if($('weeklyTraining')){$('weeklyTraining').replaceChildren();for(let n=0;n<7;n++){const iso=logShift(weekStart,n),entries=weekly.filter(w=>w.date===iso),day=document.createElement('div');day.className='weekly-day';const label=txt('strong',new Date(iso+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'}));const value=txt('span',entries.length?entries.some(w=>w.status==='Done')?'✓ Trained':entries.some(w=>w.status==='Rest')?'☾ Rest':entries.some(w=>w.status==='Planned')?'· Planned':'–':iso>dateToday()?'Upcoming':'—');const dayClass=entries.some(w=>w.status==='Done')?'trained':entries.some(w=>w.status==='Rest')?'rested':null;if(dayClass)day.classList.add(dayClass);day.append(label,value);$('weeklyTraining').append(day)}};
if($('weeklyCalories')){
 const root=$('weeklyCalories');root.replaceChildren();const goal=Number(state.goals.calories)||0;let totals=0,tracked=0;
 for(let n=0;n<7;n++){
   const iso=logShift(weekStart,n),entries=state.foods.filter(f=>f.date===iso),total=entries.reduce((acc,f)=>acc+num(f.calories),0),day=document.createElement('div');
   day.className='weekly-day';
   const dayName=txt('strong',new Date(iso+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'}));
   const amount=txt('span',entries.length?`${Math.round(total).toLocaleString()} kcal`:'—');amount.className='weekly-kcal';
   const note=txt('small',entries.length?(goal?(total>goal?`+${Math.round(total-goal)} above`:`${Math.round(goal-total)} left`):'Logged'):iso>dateToday()?'Upcoming':'No food logged');note.className='weekly-sub';
   if(entries.length){totals+=total;tracked++;day.classList.add(goal?(total>goal?'cal-over':total===goal?'cal-goal':'cal-under'):'cal-goal')}
   day.append(dayName,amount,note);root.append(day);
 }
 const summary=$('ovCaloriesWeekSummary');if(summary)summary.textContent=tracked?`${Math.round(totals).toLocaleString()} kcal across ${tracked} logged day${tracked===1?'':'s'} · Daily target ${goal?goal.toLocaleString()+' kcal':'not set'}`:`No meals logged this week · Daily target ${goal?goal.toLocaleString()+' kcal':'not set'}`;
}
$('workoutRows').replaceChildren();
for(let dayOffset=6;dayOffset>=0;dayOffset--){
 const date=logShift(logWeek.wlog,dayOffset);
 const day=document.createElement('div');day.className='training-day';
 const head=document.createElement('div');head.className='training-day-header';
 const title=txt('h3',new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'}));head.append(title);
 const matching=state.workouts.map((w,i)=>[i,w]).filter(([,w])=>w.date===date);
 if(!matching.length){const add=txt('button','+ Add');add.className='btn secondary small';add.onclick=()=>openNewHistorySession(date);head.append(add);day.append(head,txt('p','No workout recorded for this day.'));}
 else{day.append(head);for(const [i,w] of matching){
  const session=document.createElement('div');session.className='session-header';
  const name=txt('strong',w.name||'Workout');session.append(name);
  const tag=txt('span',w.status||'Done');tag.className='tag';session.append(tag);
  const edit=txt('button','Edit');edit.className='btn secondary small';edit.onclick=()=>loadWorkout(i);session.append(edit);
  session.append(removeBtn(()=>{state.workouts.splice(i,1);if(editingWorkoutIndex===i)resetWorkoutEditor();else if(editingWorkoutIndex!==null&&editingWorkoutIndex>i)editingWorkoutIndex--;}));day.append(session);
  if(Array.isArray(w.exercises)&&w.exercises.length){const list=document.createElement('div');list.className='ex-list';for(const ex of w.exercises){const row=document.createElement('div');row.className='training-ex';row.append(txt('span',(ex.done?'✓  ':'')+(ex.name||'Exercise')));const stats=[ex.sets!=null?ex.sets+' sets':null,ex.reps?'× '+ex.reps+' reps':null,ex.weight!==null&&ex.weight!==undefined&&ex.weight!==''?ex.weight+' kg':null].filter(Boolean).join('  ·  ');const detail=txt('span',stats||'Details not entered');detail.className='ex-stats';row.append(detail,makeDemoButton(ex.name));list.append(row)}day.append(list)}
  else if(w.status!=='Rest'){const empty=txt('p','Exercise details not recorded for this session. Press Edit to add sets, reps and weights.');empty.className='training-day-empty';day.append(empty)}
  if(w.notes&&w.status!=='Rest'){const note=txt('p',w.notes);note.className='training-day-empty';day.append(note)}
 }}$('workoutRows').append(day)
}
drawWeek('wlog');$('workoutSummary').textContent=`${state.workouts.filter(w=>w.status==='Done').length} completed · ${state.workouts.filter(w=>w.status==='Rest').length} rest`;
const foods=state.foods.filter(f=>f.date===$('nDate').value),daily=sum(foods);$('calCount').textContent=`${Math.round(daily.cal)} / ${state.goals.calories}`;$('proteinCount').textContent=`${daily.prot.toFixed(1)} / ${state.goals.protein} g`;$('calBar').style.width=`${Math.min(100,100*daily.cal/(state.goals.calories||1))}%`;$('remaining').textContent=`${Math.round(state.goals.calories-daily.cal)} kcal remaining · ${(state.goals.protein-daily.prot).toFixed(1)} g protein remaining`;$('foodRows').replaceChildren();for(const [i,f] of state.foods.map((f,i)=>[i,f]).filter(([i,f])=>f.date===$('nDate').value)){const tr=txt('tr','');td(tr,f.name);td(tr,f.calories);td(tr,`${f.protein}g`);let end=txt('td','');end.append(removeBtn(()=>state.foods.splice(i,1)));tr.append(end);$('foodRows').append(tr)}
drawWeek('nlog');$('weightLatest').textContent=latest?`${displayWeight(latest.kg).toFixed(2)} ${unit()}`:'No weigh-ins yet';$('weightTrend').textContent=weights.length>1?`${(displayWeight(weights.at(-1).kg)-displayWeight(weights[0].kg)).toFixed(2)} ${unit()} since first weigh-in`:'';$('weightRows').replaceChildren();for(const w of [...weights].reverse()){let tr=txt('tr','');td(tr,fmtDate(w.date));td(tr,`${displayWeight(w.kg).toFixed(2)} ${unit()}`);let end=txt('td','');end.append(removeBtn(()=>{state.weights=state.weights.filter(x=>x.date!==w.date)}));tr.append(end);$('weightRows').append(tr)}
for(const [id,value] of [['profileName',state.profile.name],['weightUnit',unit()],['goalCal',state.goals.calories],['goalProt',state.goals.protein],['goalWeight',state.goals.weight?displayWeight(state.goals.weight).toFixed(1):''],['goalFat',state.goals.fat??''],['goalDate',state.goals.date]])if(document.activeElement!==$(id))$(id).value=value;
// Workout suggestions field was removed from Settings; categories remain in saved data.
}
function makeDemoButton(name){
  const group=document.createElement('span');group.className='exercise-media-actions';
  for(const [label,url] of [['▧ Pictures','https://www.google.com/search?tbm=isch&q='+encodeURIComponent(name+' exercise proper form')],['▶ Video','https://www.youtube.com/results?search_query='+encodeURIComponent(name+' exercise proper form tutorial')]]){
    const a=document.createElement('a');a.className='exercise-demo-btn';a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',label+' for '+name);group.append(a);
  }
  return group;
}
function refreshExerciseGallery(){window.myFitnessMedia?.refresh();}
const ARNOLD_ORDER=['Chest + Back A','Shoulders + Arms A','Legs + Abs A','Chest + Back B','Shoulders + Arms B','Legs + Abs B'];
function routineRank(name){if(/^full body\b/i.test(name))return 0;if(/^arnold\b/i.test(name))return 1;if(/^rest$/i.test(name))return 3;return 2;}
function compareRoutines(a,b){const rank=routineRank(a.name)-routineRank(b.name);if(rank)return rank;if(routineRank(a.name)===1){const index=name=>{const suffix=name.replace(/^arnold\s*[-–—]?\s*/i,'');const i=ARNOLD_ORDER.findIndex(n=>n.toLowerCase()===suffix.toLowerCase());return i<0?ARNOLD_ORDER.length:i;};const sequence=index(a.name)-index(b.name);if(sequence)return sequence;}return a.name.localeCompare(b.name);}
function templateList(){const hidden=new Set(state.profile.hiddenTemplates||[]);return [...new Map([...Object.entries(ROUTINES).map(([name,rows])=>[name,{name,exercises:rows.map(([name,sets,reps])=>({name,sets,reps}))}]),...state.templates.map(t=>[t.name,t])]).values()].filter(t=>!hidden.has(t.name)).sort(compareRoutines);}
function savedTemplatePreview(){const t=templateList().find(t=>t.name===$('templatePicker').value),root=$('savedTemplatePreview');root.replaceChildren();$('editTemplate').disabled=$('deleteTemplate').disabled=!t;if(!t){root.append(txt('p','No saved templates yet. Add one with ChatGPT or create one below.'));return;}if(!t.exercises.length){root.append(txt('p','Rest day · no exercises.'));return;}const list=document.createElement('ul');for(const ex of t.exercises)list.append(txt('li',`${ex.name} · ${ex.sets} × ${ex.reps}`));root.append(list);}
function refreshTemplates(){const current=$('routineSelect').value,edit=$('templatePicker').value;for(const [id,templates] of [['routineSelect',templateList()],['templatePicker',templateList()]]){$(id).replaceChildren();for(const t of templates){const o=document.createElement('option');o.value=t.name;o.textContent=t.name;$(id).append(o)}}if(templateList().some(t=>t.name===current))$('routineSelect').value=current;if(templateList().some(t=>t.name===edit))$('templatePicker').value=edit;savedTemplatePreview();}
$('templatePicker').onchange=savedTemplatePreview;
function templateRender(){const root=$('templateEditor');root.replaceChildren();templateDraft.forEach((ex,i)=>{const row=document.createElement('div');row.className='card';row.style.padding='10px';const fields=document.createElement('div');fields.className='grid';for(const [label,key,type] of [['Exercise','name','text'],['Sets','sets','number'],['Reps','reps','text']]){const box=document.createElement('div'),l=txt('label',label),input=document.createElement('input');input.type=type;input.value=ex[key];if(type==='number')input.min='1';input.oninput=()=>{ex[key]=key==='sets'?Number(input.value):input.value};box.append(l,input);fields.append(box)}const actions=document.createElement('div');actions.className='buttonrow spaced';for(const [label,fn] of [['↑',()=>{if(i){[templateDraft[i-1],templateDraft[i]]=[templateDraft[i],templateDraft[i-1]];templateRender()}}],['↓',()=>{if(i<templateDraft.length-1){[templateDraft[i+1],templateDraft[i]]=[templateDraft[i],templateDraft[i+1]];templateRender()}}],['Remove',()=>{templateDraft.splice(i,1);templateRender()}]]){const b=txt('button',label);b.className='btn secondary small';b.type='button';b.onclick=fn;actions.append(b)}actions.append(makeDemoButton(ex.name));row.append(fields,actions);root.append(row)})}
function chooseTemplate(name){const template=templateList().find(t=>t.name===name);if(!template)return;$('templateName').value=name;selectedTemplateName=name;templateDraft=template.exercises.map(e=>({...e}));$('templateFormTitle').textContent='Edit template';$('templateSave').textContent='Save changes';templateRender();}
$('editTemplate').onclick=()=>{chooseTemplate($('templatePicker').value);$('manualTemplate').scrollIntoView({behavior:'smooth',block:'start'});$('templateName').focus({preventScroll:true})};
function clearTemplateForm(){selectedTemplateName=null;templateDraft=[];for(const id of ['templateName','templateExercise','templateReps'])$(id).value='';$('templateSets').value='3';$('templateFormTitle').textContent='New template';$('templateSave').textContent='Save new template';templateRender();}
$('newTemplate').onclick=()=>{clearTemplateForm();$('templateName').focus()};
$('templateAdd').onclick=()=>{const name=$('templateExercise').value.trim(),sets=Number($('templateSets').value),reps=$('templateReps').value.trim();if(!name||!reps||!Number.isInteger(sets)||sets<1)return alert('Enter exercise name, sets and reps');templateDraft.push({name,sets,reps});$('templateExercise').value='';$('templateReps').value='';templateRender()};
function saveTemplate(t,oldName=null){if(!t.name||!Array.isArray(t.exercises)||(!t.exercises.length&&String(t.name).trim()!=='Rest')||t.exercises.length>50)throw Error('Provide a routine name and 1–50 exercises, or use Rest for an empty rest-day template.');const exercises=t.exercises.map(x=>{const name=String(x.name||'').trim().slice(0,100),sets=Number(x.sets),reps=String(x.reps||'').trim().slice(0,50);if(!name||!Number.isInteger(sets)||sets<1||sets>30||!reps)throw Error('Each exercise needs a name, sets (1–30) and reps.');return {name,sets,reps}});const name=String(t.name).trim().slice(0,80);state.profile.hiddenTemplates=(state.profile.hiddenTemplates||[]).filter(n=>n!==name);if(oldName&&oldName!==name&&Object.hasOwn(ROUTINES,oldName))state.profile.hiddenTemplates.push(oldName);if(oldName&&oldName!==name)state.templates=state.templates.filter(x=>x.name!==oldName);state.templates=state.templates.filter(x=>x.name!==name);state.templates.push({name,exercises});if(!state.profile.categories.includes(name))state.profile.categories.push(name);persist();refreshTemplates();$('routineSelect').value=name;$('templatePicker').value=name;savedTemplatePreview();clearTemplateForm();$('templateMessage').textContent='Template saved. It will sync to Google Drive when connected.';refreshExerciseGallery();}
$('templateSave').onclick=()=>{try{saveTemplate({name:$('templateName').value,exercises:templateDraft},selectedTemplateName)}catch(e){alert(e.message)}};
$('deleteTemplate').onclick=()=>{const name=$('templatePicker').value;if(!templateList().some(x=>x.name===name))return;if(!confirm('Delete the saved template '+name+'? Logged workouts will remain.'))return;state.templates=state.templates.filter(t=>t.name!==name);if(Object.hasOwn(ROUTINES,name))state.profile.hiddenTemplates=[...new Set([...(state.profile.hiddenTemplates||[]),name])];if(selectedTemplateName===name)clearTemplateForm();persist();refreshTemplates();$('templateMessage').textContent='Template deleted; workout history preserved.';refreshExerciseGallery()};
function chatgptPrompt(task){const url='https://chatgpt.com/?q='+encodeURIComponent(task);window.open(url,'_blank','noopener,noreferrer')}
$('chatgptRoutine').onclick=()=>chatgptPrompt('Help me create or modify a myFitness routine. Provide an Add to myFitness clickable link with this exact format: https://celconac.github.io/MyFitness/?addRoutine=1&payload=ENCODED_JSON . ENCODED_JSON is encodeURIComponent(JSON.stringify({name:"Full Body",exercises:[{name:"Leg press",sets:3,reps:"10-12"}]})). Include all agreed exercises. The user reviews and confirms before saving; never claim saved before confirmation. A matching routine name will replace its template after confirmation, without changing past workouts. Do not use Google Drive for this method.');
$('chatgptFoodLink').onclick=()=>chatgptPrompt('Help me log food in myFitness for '+($('nDate').value||dateToday())+'. I will tell you what I ate or send a meal photo. Estimate calories and protein. Then give me a clickable Add to myFitness link using https://celconac.github.io/MyFitness/?addFood=1&date=YYYY-MM-DD&name=ENCODED_FOOD_DESCRIPTION&calories=NUMBER&protein=NUMBER&entryId=UNIQUE_ID . URL-encode the food name and use the date above. Do NOT claim you saved it: I must tap the link, review and confirm in myFitness. Do not use Google Drive for this method.');
// Food coach uses the selected date and the CURRENT active profile only.
// It creates suggestions, never edits the diary or talks to Google Drive directly.
$('chatgptCoach').onclick=()=>{
 const date=$('nDate').value||dateToday();
 const meal=$('coachMeal').value;
 const entries=state.foods.filter(f=>f.date===date);
 const eatenCal=entries.reduce((n,f)=>n+num(f.calories),0);
 const eatenProt=entries.reduce((n,f)=>n+num(f.protein),0);
 const targetCal=num(state.goals.calories), targetProt=num(state.goals.protein);
 const remainingCal=Math.round(targetCal-eatenCal);
 const remainingProt=Math.round((targetProt-eatenProt)*10)/10;
 const foods=entries.length?entries.map(f=>`${String(f.name).slice(0,110)} (${Math.round(num(f.calories))} kcal, ${num(f.protein)}g protein)`).join('; ').slice(0,2500):'Nothing logged yet';
 const request=[
  'Help me choose what to eat for '+meal+' on '+date+' using my actual myFitness stats below.',
  'Daily goal: '+targetCal+' kcal and '+targetProt+' g protein.',
  'Already eaten: '+Math.round(eatenCal)+' kcal and '+eatenProt.toFixed(1)+' g protein.',
  'Remaining: '+remainingCal+' kcal and '+remainingProt+' g protein.',
  'Food logged today: '+foods+'.',
  'Give 3 realistic high-protein meal ideas with portion sizes and approximate calories and protein for each. Consider what I already ate and prioritize reaching protein while staying within the calorie goal if feasible. If my remaining calories are very low or negative, say so, avoid proposing an extreme restriction, and offer sensible alternatives. Ask dietary preferences only if needed.',
  'If I choose and eat a meal, help me log it using the one-tap Add to myFitness link. Do not claim anything is saved until I review and confirm in the app.'
 ].join('\n');
 chatgptPrompt(request);
};
$('chatgptWorkout').onclick=()=>chatgptPrompt('Help me log a myFitness workout for '+($('routineDate').value||dateToday())+'. Ask for workout name, individual exercises, sets, reps and weights in kg. Then give a clickable Add to myFitness link with exactly this format: https://celconac.github.io/MyFitness/?addWorkout=1&payload=ENCODED_JSON . ENCODED_JSON is encodeURIComponent(JSON.stringify({date:"'+($('routineDate').value||dateToday())+'",name:"Chest + Biceps",status:"Done",exercises:[{name:"Incline press",sets:3,reps:"10",weight:20,done:true}]})). Replace all example data with my actual session. Rest days can have status Rest and no exercises. The user reviews before saving; do not claim a save until they confirm inside myFitness. Do not use Google Drive for this method.');
function routineRender(){const target=$('routineChecklist');target.replaceChildren();if(!activeRoutine){target.append(txt('p','Choose a workout and click Load routine.'));return}if(activeRoutine.name==='Rest'){target.append(txt('p','Recovery day. No exercise checklist needed — save to record a rest day.'));return}activeRoutine.exercises.forEach((ex,i)=>{const row=document.createElement('div');row.className='card';row.style.padding='12px';row.style.marginBottom='8px';const header=document.createElement('div');header.className='buttonrow';const check=document.createElement('input');check.type='checkbox';check.checked=!!ex.done;check.style.cssText='width:23px;height:23px';check.onchange=()=>{ex.done=check.checked;routineRender()};header.append(check,txt('strong',`${i+1}. ${ex.name}`),makeDemoButton(ex.name));const fields=document.createElement('div');fields.className='grid';for(const [label,key,type] of [['Sets','sets','number'],['Reps completed','reps','text'],['Weight (kg)','weight','number']]){const box=document.createElement('div');const input=document.createElement('input');input.type=type;if(type==='number')input.min='0';if(key==='weight')input.step='0.5';input.value=ex[key]??'';input.oninput=()=>{ex[key]=key==='sets'?Number(input.value):key==='weight'?(input.value===''?null:Number(input.value)):input.value};box.append(txt('label',label),input);fields.append(box)}row.append(header,fields);target.append(row)});const count=activeRoutine.exercises.filter(e=>e.done).length;target.append(txt('p',`${count} / ${activeRoutine.exercises.length} exercises ticked`))}
refreshTemplates();clearTemplateForm();
$('startRoutine').onclick=()=>{const date=$('routineDate').value,name=$('routineSelect').value;if(!date)return alert('Choose a date');const template=templateList().find(t=>t.name===name);if(!template)return alert('Choose a routine');const existing=state.workouts.find(w=>w.date===date&&w.name===name&&w.exercises?.length);activeRoutine={date,name,exercises:existing?existing.exercises.map(e=>({...e})):template.exercises.map(e=>({...e,weight:null,done:false}))};$('routineStatus').textContent=name==='Rest'?'Rest day ready — press Save rest day to add it to your workout log.':existing?'Loaded saved workout. Edit your sets, reps and weights.':'Enter sets, reps and weights, tick exercises, then save.';$('saveRoutine').textContent=name==='Rest'?'Save rest day':"Save today's checklist";routineRender()};
$('saveRoutine').onclick=()=>{if(!activeRoutine)return alert('Load a routine first');const r=activeRoutine;const completed=r.exercises.filter(e=>e.done).length;const isRest=r.name==='Rest';const record={date:r.date,name:isRest?'Rest day':r.name,status:isRest?'Rest':completed===r.exercises.length?'Done':'Planned',notes:isRest?'Rest day':`${completed}/${r.exercises.length} exercises completed`,exercises:r.exercises.map(e=>({...e}))};const idx=state.workouts.findIndex(w=>w.date===r.date&&(w.name===r.name||(isRest&&w.status==='Rest')));if(idx>=0)state.workouts[idx]=record;else state.workouts.push(record);persist();$('routineStatus').textContent='Saved for '+r.date+'. Google Drive auto-syncs when connected.'};
$('routineDate').onchange=()=>{activeRoutine=null;routineRender()};$('routineSelect').onchange=()=>{activeRoutine=null;$('saveRoutine').textContent="Save today's checklist";routineRender()};routineRender();
$('nDate').onchange=render;
function resetWorkoutEditor(){$('inlineSessionEditor').hidden=true;editingWorkoutIndex=null;editingExercises=[];$('wDate').value=dateToday();$('wName').value='';$('wStatus').value='Done';$('wNotes').value='';$('addWorkout').textContent='Save workout';renderExercises()}
function loadWorkout(i){const w=state.workouts[i];if(!w)return;$('inlineSessionEditor').hidden=false;$('sessionEditorTitle').textContent='Edit '+fmtDate(w.date)+' session';editingWorkoutIndex=i;editingExercises=(w.exercises||[]).map(e=>({...e}));$('wDate').value=w.date;$('wName').value=w.name;$('wStatus').value=w.status;$('wNotes').value=w.notes||'';$('addWorkout').textContent='Update workout';renderExercises();document.getElementById('inlineSessionEditor').scrollIntoView({behavior:'smooth',block:'start'})}
function renderExercises(){const root=$('exerciseEditor');root.replaceChildren();if(!editingExercises.length){root.append(txt('p','No exercises added yet.'));return}editingExercises.forEach((ex,i)=>{const wrap=document.createElement('div');wrap.className='card';wrap.style.padding='10px';wrap.append(txt('strong',`${i+1}. ${ex.name} · ${ex.sets} sets × ${ex.reps}${ex.weight!==null&&ex.weight!==''?' · '+ex.weight+' kg':''}`));const row=document.createElement('div');row.className='buttonrow';[['↑',-1],['↓',1]].forEach(([label,delta])=>{const b=txt('button',label);b.className='btn secondary small';b.disabled=i+delta<0||i+delta>=editingExercises.length;b.onclick=()=>{const other=i+delta;[editingExercises[i],editingExercises[other]]=[editingExercises[other],editingExercises[i]];renderExercises()};row.append(b)});const change=txt('button','Edit');change.className='btn secondary small';change.onclick=()=>{const a=editingExercises.splice(i,1)[0];$('exName').value=a.name;$('exSets').value=a.sets;$('exReps').value=a.reps;$('exWeight').value=a.weight??'';renderExercises();$('exName').focus()};row.append(change);const del=txt('button','Remove');del.className='btn danger small';del.onclick=()=>{editingExercises.splice(i,1);renderExercises()};row.append(del,makeDemoButton(ex.name));wrap.append(row);root.append(wrap)})}
$('addExercise').onclick=()=>{const name=$('exName').value.trim(),sets=Number($('exSets').value),reps=$('exReps').value.trim(),weight=$('exWeight').value===''?null:Number($('exWeight').value);if(!name||!reps||!Number.isInteger(sets)||sets<1||weight!==null&&(!Number.isFinite(weight)||weight<0))return alert('Enter an exercise, valid sets, and reps/duration');editingExercises.push({name,sets,reps,weight});$('exName').value='';$('exReps').value='';$('exWeight').value='';renderExercises()};
function openNewHistorySession(date){resetWorkoutEditor();$('wDate').value=date;$('sessionEditorTitle').textContent='Add session · '+fmtDate(date);$('inlineSessionEditor').hidden=false;$('inlineSessionEditor').scrollIntoView({behavior:'smooth',block:'start'})}
$('newHistorySession').onclick=()=>openNewHistorySession($('wDate').value||dateToday());
$('clearWorkoutEdit').onclick=resetWorkoutEditor;
$('addWorkout').onclick=()=>{const date=$('wDate').value,name=$('wName').value.trim(),status=$('wStatus').value,notes=$('wNotes').value.trim();if(!date||!name)return alert('Enter a date and workout name');const record={date,name,status,notes,exercises:editingExercises.map(e=>({...e}))};if(editingWorkoutIndex===null)state.workouts.push(record);else state.workouts[editingWorkoutIndex]=record;resetWorkoutEditor();logWeek.wlog=logIso(logMonday(date));$('wlogMonth').value=date.slice(0,7);persist()};
$('addFood').onclick=()=>{const date=$('nDate').value,name=$('foodName').value.trim(),cal=Number($('foodCal').value),protein=Number($('foodProt').value);if(!date||!name||$('foodCal').value===''||$('foodProt').value===''||!Number.isFinite(cal)||cal<0||!Number.isFinite(protein)||protein<0)return alert('Enter a food, calories and protein');state.foods.push({id:Date.now()+Math.random(),date,name,calories:cal,protein});$('foodName').value='';$('foodCal').value='';$('foodProt').value='';persist()};
$('addWeight').onclick=()=>{const date=$('weightDate').value,raw=$('weightValue').value,kg=inputWeight(Number(raw));if(!date||raw===''||!Number.isFinite(kg)||kg<=0)return alert('Enter a valid weight');state.weights=state.weights.filter(w=>w.date!==date);state.weights.push({date,kg});$('weightValue').value='';persist()};
$('saveProfile').onclick=()=>{const cal=Number($('goalCal').value),prot=Number($('goalProt').value),raw=$('goalWeight').value,weight=raw===''?null:($('weightUnit').value==='lb'?Number(raw)/2.2046226218:Number(raw)),fat=$('goalFat').value===''?null:Number($('goalFat').value);if(!Number.isFinite(cal)||cal<=0||!Number.isFinite(prot)||prot<=0||(weight!==null&&(!Number.isFinite(weight)||weight<=0))||(fat!==null&&(!Number.isFinite(fat)||fat<0||fat>100)))return alert('Check your goal values');state.profile={...state.profile,name:$('profileName').value.trim().slice(0,80),unit:$('weightUnit').value};state.goals={calories:cal,protein:prot,weight,fat,date:$('goalDate').value};persist();$('profileStatus').textContent='Profile and goals saved'};
let displayedGoalUnit=unit();
$('weightUnit').onchange=()=>{const next=$('weightUnit').value,raw=$('goalWeight').value;if(raw!==''&&displayedGoalUnit!==next){const kg=displayedGoalUnit==='lb'?Number(raw)/2.2046226218:Number(raw);$('goalWeight').value=(next==='lb'?kg*2.2046226218:kg).toFixed(1);}displayedGoalUnit=next;document.querySelectorAll('#settings .unit').forEach(x=>x.textContent=next)};
const importControl=$('importBackup').parentNode;importControl.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('importBackup').click()}};
$('exportBackup').onclick=()=>download('myFitness-backup.json',JSON.stringify(state,null,2),'application/json');
$('exportCSV').onclick=()=>{const q=v=>'"'+String(v).replaceAll('"','""')+'"';download('myFitness-foods.csv',['Date,Food,Calories,Protein (g)',...state.foods.map(f=>[f.date,f.name,f.calories,f.protein].map(q).join(','))].join('\r\n'),'text/csv')};
$('importBackup').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!valid(data))throw Error('This is not a myFitness v2 backup');if(confirm('Replace all current data with this backup?')){state=data;persist();$('status').textContent='Backup imported'}}catch(err){alert('Could not import: '+err.message)}e.target.value=''};
$('resetAll').onclick=()=>{if(confirm('Erase ALL your local myFitness entries and settings? This cannot be undone unless you have a backup.')){state=fresh();persist();$('status').textContent='Started fresh'}};

// One-tap ChatGPT food import: query parameters are untrusted, so validate and
// require explicit confirmation. Never automatically write data from a link.
function oneTapFoodImport(){
 const url=new URL(window.location.href),params=url.searchParams;
 if(params.get('addFood')!=='1')return;
 const clear=()=>{for(const k of ['addFood','date','name','calories','protein','entryId'])params.delete(k);history.replaceState(null,'',url.pathname+(params.toString()?'?'+params:'')+url.hash)};
 const date=params.get('date')||'', name=(params.get('name')||'').trim();
 const cal=Number(params.get('calories')), protein=Number(params.get('protein'));
 const entryId=(params.get('entryId')||'').trim();
 const validDate=/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(new Date(date+'T12:00:00').getTime())&&new Date(date+'T12:00:00').toISOString().slice(0,10)===date;
 if(!validDate||!name||name.length>180||!Number.isFinite(cal)||cal<0||cal>10000||!Number.isFinite(protein)||protein<0||protein>1000||entryId.length>120){clear();alert('Invalid food link. Nothing has been saved.');return;}
 // Do not save into an anonymous profile that may later belong to somebody else.
 if(!/^myfitness-account-.+-v2$/.test(KEY)){
  alert('Connect your own Google account in myFitness Settings first, then open this food link again. Nothing was saved.');return;
 }
 const matching=state.foods.find(f=>f.id===entryId&&entryId)||state.foods.find(f=>f.date===date&&f.name.trim().toLowerCase()===name.toLowerCase()&&Number(f.calories)===cal&&Number(f.protein)===protein);
 if(matching){clear();$('nDate').value=date;logWeek.nlog=logIso(logMonday(date));$('nlogMonth').value=date.slice(0,7);jump('nutrition');render();alert('This food is already in your diary. No duplicate was added.');return;}
 const overlay=document.createElement('div');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Review food entry');overlay.style.cssText='position:fixed;inset:0;background:rgba(10,20,38,.68);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
 const panel=document.createElement('div');panel.style.cssText='width:min(100%,430px);background:white;color:#162238;border-radius:20px;padding:24px;box-shadow:0 24px 64px #0005';
 const h=txt('h2','Add food to myFitness?'),intro=txt('p',fmtDate(date));intro.style.color='#64748b';
 const food=txt('p',name);food.style.cssText='font-size:19px;font-weight:700;margin:18px 0 8px';
 const macros=txt('p',`${cal} kcal · ${protein} g protein`);macros.style.cssText='font-size:17px;margin:8px 0 22px';
 const message=txt('p','Saves to your current profile and syncs with Google Drive when connected.');message.style.cssText='color:#64748b;font-size:13px';
 const row=document.createElement('div');row.style.cssText='display:flex;gap:10px;flex-wrap:wrap;margin-top:18px';
 const cancel=txt('button','Cancel');cancel.className='btn secondary';
 const accept=txt('button','Add to food diary');accept.className='btn';
 const close=()=>{overlay.remove();clear()};cancel.onclick=close;
 accept.onclick=()=>{
  // Repeat duplicate check immediately before mutation.
  const dupe=state.foods.some(f=>(entryId&&f.id===entryId)||(f.date===date&&f.name.trim().toLowerCase()===name.toLowerCase()&&Number(f.calories)===cal&&Number(f.protein)===protein));
  if(dupe){close();alert('Already saved. No duplicate added.');return;}
  state.foods.push({id:entryId||'chatgpt-'+date+'-'+Date.now(),date,name,calories:cal,protein});
  $('nDate').value=date;logWeek.nlog=logIso(logMonday(date));$('nlogMonth').value=date.slice(0,7);
  close();jump('nutrition');persist();
 };
 row.append(cancel,accept);panel.append(h,intro,food,macros,message,row);overlay.append(panel);document.body.append(overlay);accept.focus();
}


// One-tap workout/routine imports use encoded JSON only as proposed data.
// Validation, active-account checks and explicit review are mandatory.
function oneTapTrainingImport(){
 const url=new URL(location.href),p=url.searchParams;
 const kind=p.get('addWorkout')==='1'?'workout':p.get('addRoutine')==='1'?'routine':null;
 if(!kind)return;
 const clear=()=>{['addWorkout','addRoutine','payload'].forEach(k=>p.delete(k));history.replaceState(null,'',url.pathname+(p.toString()?'?'+p:'')+url.hash)};
 let data;
 try{
  const raw=p.get('payload')||'';
  if(!raw||raw.length>12000)throw Error('Link is missing data or too long');
  data=JSON.parse(raw);
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid entry');
  if(typeof data.name!=='string'||!data.name.trim()||data.name.length>80)throw Error('Invalid name');
  if(!Array.isArray(data.exercises)||data.exercises.length>50)throw Error('Too many exercises');
  const rest=kind==='workout'&&(data.status==='Rest'||data.name.toLowerCase()==='rest');
  if(!rest&&!data.exercises.length)throw Error('No exercises included');
  data.exercises=data.exercises.map(e=>{
   if(!e||typeof e.name!=='string'||!e.name.trim()||e.name.length>100||!Number.isInteger(Number(e.sets))||Number(e.sets)<1||Number(e.sets)>30||!String(e.reps??'').trim()||String(e.reps).length>50)throw Error('Invalid exercise');
   const weight=e.weight===null||e.weight===undefined||e.weight===''?null:Number(e.weight);
   if(kind==='workout'&&weight!==null&&(!Number.isFinite(weight)||weight<0||weight>1000))throw Error('Invalid weight');
   return {name:e.name.trim(),sets:Number(e.sets),reps:String(e.reps).trim(),...(kind==='workout'?{weight,done:e.done===true}:{})};
  });
  data.name=data.name.trim();
  if(kind==='workout'){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(data.date||'')||Number.isNaN(Date.parse(data.date+'T12:00:00'))||new Date(data.date+'T12:00:00').toISOString().slice(0,10)!==data.date)throw Error('Invalid workout date');
   if(!['Done','Planned','Skipped','Rest'].includes(data.status))throw Error('Invalid workout status');
   if(rest){data.status='Rest';data.exercises=[];data.name='Rest day';}
  }
 }catch(err){clear();alert('Invalid '+kind+' link: '+err.message+'. Nothing was saved.');return;}
 if(!/^myfitness-account-.+-v2$/.test(KEY)){alert('Connect your own Google account under Settings first, then open this link again. Nothing was saved.');return;}
 const overlay=document.createElement('div');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Review '+kind);
 overlay.style.cssText='position:fixed;inset:0;background:rgba(10,20,38,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:14px';
 const panel=document.createElement('div');panel.style.cssText='width:min(100%,500px);max-height:90vh;overflow-y:auto;background:white;color:#162238;border-radius:20px;padding:23px;box-shadow:0 24px 64px #0005';
 const current=kind==='routine'?state.templates.find(t=>t.name===data.name):state.workouts.find(w=>w.date===data.date&&w.name===data.name);
 panel.append(txt('h2',kind==='routine'?'Review routine':'Review workout'),txt('p',(kind==='workout'?fmtDate(data.date)+' · ':'')+data.name+(kind==='workout'?' · '+data.status:'')));
 if(current){const warning=txt('p','A '+kind+' with this name'+(kind==='workout'?' on this date':'')+' already exists. Saving will replace that entry only.');warning.style.cssText='color:#9a4b04;font-weight:600';panel.append(warning)}
 const list=document.createElement('div');list.style.cssText='display:grid;gap:8px;margin:12px 0';
 for(const e of data.exercises){const line=txt('div',e.name+' · '+e.sets+' sets × '+e.reps+(kind==='workout'&&e.weight!==null?' · '+e.weight+' kg':''));line.style.cssText='border-radius:10px;background:#f1f5f9;padding:10px';list.append(line)}
 if(!data.exercises.length)list.append(txt('p','Rest day · No exercises'));
 panel.append(list,txt('p','This saves into the currently connected myFitness profile. Your other entries remain unchanged.'));
 const buttons=document.createElement('div');buttons.className='buttonrow';const cancel=txt('button','Cancel');cancel.className='btn secondary';const accept=txt('button',kind==='routine'?'Save routine':'Save workout');accept.className='btn';
 const close=()=>{overlay.remove();clear()};cancel.onclick=close;
 accept.onclick=()=>{
  if(kind==='routine'){
   try{saveTemplate({name:data.name,exercises:data.exercises},data.name)}catch(e){alert(e.message);return;}
   jump('routines');
  }else{
   const record={date:data.date,name:data.name,status:data.status,notes:'Added with ChatGPT one-tap link',exercises:data.exercises};
   const index=state.workouts.findIndex(w=>w.date===record.date&&w.name===record.name);
   if(index>=0)state.workouts[index]=record;else state.workouts.push(record);
   $('wDate').value=data.date;$('routineDate').value=data.date;logWeek.wlog=logIso(logMonday(data.date));$('wlogMonth').value=data.date.slice(0,7);
   persist();jump('workouts');
  }
  close();
 };
 buttons.append(cancel,accept);panel.append(buttons);overlay.append(panel);document.body.append(overlay);accept.focus();
}

renderExercises();render();oneTapFoodImport();oneTapTrainingImport();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
