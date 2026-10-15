import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const names=['Full Body — Beginner','Arnold - Chest + Back A','Arnold - Shoulders + Arms A','Arnold - Legs + Abs A','Arnold - Chest + Back B','Arnold - Shoulders + Arms B','Arnold - Legs + Abs B','Rest'];
function catalog(state={profile:{categories:[]},templates:[],workouts:[]}){
 const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:''});return elements.get(id)};
 const ctx={state,$,confirm:()=>true,selectedTemplateName:null,persist(){},refreshTemplates(){},refreshExerciseGallery(){},clearTemplateForm(){}};
 vm.createContext(ctx);
 const constants=source.slice(source.indexOf('const ROUTINES='),source.indexOf('let activeRoutine='));
 const catalog=source.slice(source.indexOf('const ARNOLD_ORDER='),source.indexOf('function savedTemplatePreview()'));
 const save=source.slice(source.indexOf('function saveTemplate('),source.indexOf("$('templateSave').onclick="));
 const del=source.slice(source.indexOf("$('deleteTemplate').onclick="),source.indexOf('function chatgptPrompt('));
 vm.runInContext(constants+catalog+'function savedTemplatePreview(){};'+save+del+';globalThis.list=templateList;globalThis.save=saveTemplate;',ctx);
 return {ctx,$,state,list:()=>JSON.parse(JSON.stringify(ctx.list()))};
}
test('new users see eight complete starter templates in the photo order',()=>{
 const h=catalog();assert.deepEqual(h.list().map(t=>t.name),names);
 for(const t of h.list().slice(0,-1))assert.ok(t.exercises.length>=6);
 assert.equal(h.list().at(-1).exercises.length,0);
 assert.equal(h.list()[1].exercises[0].name,'Barbell bench press');
});
test('personal edits override defaults without mutating saved records or changing order',()=>{
 const state={profile:{},templates:[{name:names[4],exercises:[{name:'My row',sets:2,reps:'8'}]}],workouts:[{date:'2026-10-15',name:names[4],exercises:[{name:'Historical row',sets:3,reps:'10'}]}]};
 const original=JSON.stringify(state),h=catalog(state);
 assert.deepEqual(h.list().map(t=>t.name),names);assert.equal(h.list()[4].exercises[0].name,'My row');assert.equal(JSON.stringify(state),original);
});
test('deleting a starter persists per account and preserves workout history',()=>{
 const state={profile:{},templates:[],workouts:[{name:names[0],exercises:[{name:'Historical exercise'}]}]},h=catalog(state);
 const history=JSON.stringify(state.workouts);h.$('templatePicker').value=names[0];h.$('deleteTemplate').onclick();
 const reopened=catalog(JSON.parse(JSON.stringify(state)));
 assert.ok(!reopened.list().some(t=>t.name===names[0]));assert.equal(JSON.stringify(state.workouts),history);
 assert.deepEqual(catalog().list().map(t=>t.name),names);
});
test('Rest can be edited as an empty rest-day template and renamed defaults stay removed',()=>{
 const h=catalog();h.ctx.save({name:'Rest',exercises:[]},'Rest');assert.equal(h.list().at(-1).name,'Rest');
 h.ctx.save({name:'My full body',exercises:[{name:'Leg press',sets:3,reps:'10'}]},names[0]);
 assert.ok(!h.list().some(t=>t.name===names[0]));assert.ok(h.list().some(t=>t.name==='My full body'));
});
