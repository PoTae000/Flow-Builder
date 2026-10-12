import { describe, it, expect } from 'vitest';
import { computeELKLayout, computeFlowELKLayout } from './elk-layout';
import type { Entity, Relationship } from '$lib/types/er';
const entities: Entity[] = Array.from({length: 8}, (_, i) => ({id:`e${i}`, name:`Table${i}`, attributes:[], isWeak:false, position:{x:60, y:60}}));
const relationships: Relationship[] = Array.from({length:7}, (_,i) => ({id:`r${i}`,name:'', entityIds:[`e${Math.floor(i/2)}`,`e${i+1}`],cardinalities:['1','N'],isIdentifying:false}));
const box = () => ({w:160,h:100});
describe('stable auto layout', () => {
 it('separates decision branches and uses centered ports on the merge connector', async () => {
  const nodes = ['decision', 'left', 'right', 'merge', 'end'].map(id => ({ id, name: '', type: (id === 'decision' ? 'decision' : id === 'merge' ? 'connector' : 'process') as import('$lib/types/flowchart').FlowNodeType, position: { x: 0, y: 0 } }));
  const edges = [['decision','left'],['decision','right'],['left','merge'],['right','merge'],['merge','end']].map(([fromNodeId,toNodeId],i) => ({ id: `branch${i}`, fromNodeId, toNodeId, label: '' }));
  const result = await computeFlowELKLayout(nodes, edges);
  expect(result!.routes!.get('branch0')!.fromSide).toBe('left');
  expect(result!.routes!.get('branch1')!.fromSide).toBe('right');
  expect(result!.routes!.get('branch2')!.toSide).toBe('top');
  expect(result!.routes!.get('branch3')!.toSide).toBe('top');
  expect(result!.get('merge')!.x).toBeGreaterThan(result!.get('left')!.x);
  expect(result!.get('merge')!.x).toBeLessThan(result!.get('right')!.x);
 });
 it('returns identical ER positions regardless of previous call or input order', async () => {
  const a = await computeELKLayout(entities,relationships,'crows-foot',box);
  const b = await computeELKLayout([...entities].reverse(),[...relationships].reverse(),'crows-foot',box);
  expect([...a!].sort()).toEqual([...b!].sort());
 });
 it('keeps locked tables fixed and avoids overlaps', async () => {
  const nodes = entities.map((e,i) => ({...e,isLocked:i===0}));
  const positions = await computeELKLayout(nodes,relationships,'crows-foot',box);
  expect(positions!.get('e0')).toEqual(nodes[0].position);
  for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++) {
   const a=positions!.get(nodes[i].id)!, b=positions!.get(nodes[j].id)!;
   expect(a.x+160<=b.x || b.x+160<=a.x || a.y+100<=b.y || b.y+100<=a.y).toBe(true);
  }
 });
 it('uses larger boxes to avoid overlap in Chen', async () => {
  const positions = await computeELKLayout(entities,relationships,'chen',() => ({w:320,h:240}));
  expect(positions!.size).toBe(8);
 });
 it('lays out separate Chen relationship nodes and attribute rows without overlap', async () => {
  const nodes = entities.slice(0,4).map(e=>({...e,attributes:Array.from({length:12},(_,i)=>({id:`${e.id}:a${i}`,name:`Field ${i}`,type:'regular' as const}))}));
  const rels: Relationship[] = [0,1,2].map(i=>({id:`link${i}`,name:'Purchase',entityIds:['e0',`e${i+1}`],cardinalities:['1','N'],isIdentifying:false}));
  rels.push({...rels[0],id:'parallel'});
  const layout = await computeELKLayout(nodes,rels,'chen',()=>({w:120,h:48}));
  expect(layout!.diamonds!.size).toBe(4);
  expect(layout!.attributes!.size).toBe(48);
  const rects = nodes.map(e=>({...layout!.get(e.id)!,w:120,h:48}));
  for(const p of layout!.attributes!.values()) rects.push({x:p.x-38,y:p.y-16,w:76,h:32});
  for(const p of layout!.diamonds!.values()) rects.push({x:p.x-45,y:p.y-22,w:90,h:44});
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++) {
   const a=rects[i],b=rects[j];
   expect(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y).toBe(true);
  }
  const reversed = await computeELKLayout([...nodes].reverse(),[...rels].reverse(),'chen',()=>({w:120,h:48}));
  expect([...layout!.diamonds!].sort()).toEqual([...reversed!.diamonds!].sort());
 });
 it('changes ER arrangement with a new seed while reproducing the same seed', async () => {
  const a=await computeELKLayout(entities,relationships,'chen',box,42);
  const b=await computeELKLayout(entities,relationships,'chen',box,43);
  const repeat=await computeELKLayout(entities,relationships,'chen',box,42);
  expect([...a!]).not.toEqual([...b!]);
  expect([...a!]).toEqual([...repeat!]);
 });
 it('ignores dangling relationships without breaking layout', async () => {
  const layout = await computeELKLayout(entities,[{...relationships[0],entityIds:['e0','missing']}],'chen',box);
  expect(layout!.size).toBe(8);
  expect(layout!.diamonds!.size).toBe(0);
 });
 it('keeps flowchart direction and positions stable', async () => {
  const nodes = entities.map(e => ({id:e.id,name:e.name,type:'process' as const,position:e.position,width:140,height:60}));
  const edges = relationships.map(r => ({id:r.id,fromNodeId:r.entityIds[0],toNodeId:r.entityIds[1],label:''}));
  const a = await computeFlowELKLayout(nodes,edges);
  const b = await computeFlowELKLayout([...nodes].reverse(),[...edges].reverse());
  expect([...a!].sort()).toEqual([...b!].sort());
  expect(a!.routes!.size).toBe(edges.length);
 });
});
