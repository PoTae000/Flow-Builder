import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkExtendedEdge } from 'elkjs/lib/elk-api';
import type { Entity, Relationship } from '$lib/types/er';
import type { FlowNode, FlowEdge } from '$lib/types/flowchart';
import type { Position } from '$lib/types/geometry';

const elk = new ELK();


export type ERLayoutPositions = Map<string, Position> & {
 diamonds?: Map<string, Position>;
 attributes?: Map<string, Position>;
};
export async function computeELKLayout(
 entities: Entity[], relationships: Relationship[], notation: string,
 estimateBox: (e: Entity) => { w: number; h: number }, seed = 1
): Promise<ERLayoutPositions | null> {
 if (!entities.length) return null;
 const chen = notation === 'chen' || notation === 'merise';
 const score = (id: string) => { let n=seed|0; for(const c of id) n=Math.imul(n^c.charCodeAt(0),16777619); return n>>>0; };
 const sorted = [...entities].sort((a,b)=> seed===1 ? a.id.localeCompare(b.id) : score(a.id)-score(b.id)||a.id.localeCompare(b.id));
 const boxes = new Map<string, { w:number; h:number; padX:number; padTop:number; width:number; height:number; columns:number; topRows:number }>();
 const children = sorted.map(e => {
  const {w,h}=estimateBox(e);
  const count=chen?e.attributes.length:0;
  const columns=Math.max(1,Math.min(4,Math.ceil(Math.sqrt(count))));
  const rows=Math.ceil(count/columns), topRows=Math.ceil(rows/2), bottomRows=rows-topRows;
  const padX=count?Math.max(20,(columns*100-w)/2):0;
  const padTop=topRows?topRows*44+24:0, padBottom=bottomRows?bottomRows*44+24:0;
  const box={w,h,padX,padTop,width:w+padX*2,height:h+padTop+padBottom,columns,topRows}; boxes.set(e.id,box);
  return {id:e.id,width:box.width,height:box.height};
 });
 const ids=new Set(entities.map(e=>e.id));
 const valid=[...relationships].filter(r=>r.entityIds.every(id=>ids.has(id))).sort((a,b)=>a.id.localeCompare(b.id));
 const edges: ElkExtendedEdge[]=[];
 for (const r of valid) {
  if (chen) {
   children.push({id:`relationship:${r.id}`,width:Math.max(110,r.name.length*7+40),height:64});
   edges.push({id:`${r.id}:from`,sources:[r.entityIds[0]],targets:[`relationship:${r.id}`]},
    {id:`${r.id}:to`,sources:[`relationship:${r.id}`],targets:[r.entityIds[1]]});
  } else edges.push({id:r.id,sources:[r.entityIds[0]],targets:[r.entityIds[1]]});
 }
 const result=await elk.layout({id:'root',children,edges,layoutOptions:{
  'elk.algorithm':'layered','elk.direction': seed===1?'RIGHT':['RIGHT','DOWN','LEFT','UP'][seed%4], 'elk.randomSeed':String(seed),
  'elk.edgeRouting':'ORTHOGONAL','elk.spacing.nodeNode':'65',
  'elk.layered.spacing.nodeNodeBetweenLayers':chen?'85':'120',
  'elk.spacing.componentComponent':'100','elk.separateConnectedComponents':'true',
  'elk.layered.crossingMinimization.strategy':'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy':'NETWORK_SIMPLEX',
  'elk.layered.considerModelOrder.strategy':'NODES_AND_EDGES',
  'elk.layered.thoroughness':'20'
 }});
 if (!result.children?.length) return null;
 const minX=Math.min(...result.children.map(n=>n.x??0)),minY=Math.min(...result.children.map(n=>n.y??0));
 const footprints=new Map(result.children.map(n=>[n.id,{x:(n.x??0)-minX+60,y:(n.y??0)-minY+60,w:n.width!,h:n.height!}]));
 // Keep locked footprints fixed; resolve collisions for every entity and relationship node.
 const placed: {x:number;y:number;w:number;h:number}[]=[];
 for (const e of sorted.filter(e=>e.isLocked)) {
  const b=boxes.get(e.id)!; const p={x:e.position.x-b.padX,y:e.position.y-b.padTop,w:b.width,h:b.height};
  footprints.set(e.id,p);placed.push(p);
 }
 for (const n of result.children) {
  if (entities.find(e=>e.id===n.id)?.isLocked) continue;
  const p=footprints.get(n.id)!;
  for(let i=0;i<=result.children.length;i++) {
   const collision=placed.find(b=>p.x<b.x+b.w+24 && p.x+p.w+24>b.x && p.y<b.y+b.h+24 && p.y+p.h+24>b.y);
   if(!collision)break;
   p.y=collision.y+collision.h+24;
  }
  placed.push(p);
 }
 const positions=new Map<string,Position>() as ERLayoutPositions;
 positions.diamonds=new Map();positions.attributes=new Map();
 for(const e of sorted) {
  const f=footprints.get(e.id)!,b=boxes.get(e.id)!;
  const p={x:Math.round(f.x+b.padX),y:Math.round(f.y+b.padTop)}; positions.set(e.id,p);
  if(chen) e.attributes.forEach((a,i)=>{
   if(e.isLocked && a.position) {positions.attributes!.set(a.id,{...a.position});return;}
   const row=Math.floor(i/b.columns),col=i%b.columns;
   const count=Math.min(b.columns,e.attributes.length-row*b.columns);
   positions.attributes!.set(a.id,{x:p.x+b.w/2+(col-(count-1)/2)*100,
    y:row<b.topRows?p.y-50-(b.topRows-1-row)*44:p.y+b.h+50+(row-b.topRows)*44});
  });
 }
 if(chen)for(const r of valid){const f=footprints.get(`relationship:${r.id}`)!;positions.diamonds.set(r.id,{x:f.x+f.w/2,y:f.y+f.h/2});}
 return positions;
}

export type FlowLayoutPositions = Map<string, Position> & { routes?: Map<string, { waypoints: Position[]; fromSide: NonNullable<FlowEdge['fromSide']>; toSide: NonNullable<FlowEdge['toSide']> }> };

export async function computeFlowELKLayout(
	nodes: FlowNode[],
	edges: FlowEdge[],
	direction: 'DOWN' | 'RIGHT' = 'DOWN'
): Promise<FlowLayoutPositions | null> {
	if (nodes.length === 0) return null;

	const sizeOf = (node: FlowNode) => {

		const w = node.width || (node.type === 'connector' ? 28 : 140);
		const h = node.height || (node.type === 'connector' ? 28 : 60);
		if (node.type === 'decision') return { w: w + 20, h: h + 10 };
		return { w, h };
	};

	const boxes = new Map<string, { w: number; h: number }>();
	const sortedEdges = [...edges].sort((a,b) => a.id.localeCompare(b.id));
	const exits = new Map<string, string>();
	for (const node of nodes) {
		const outgoing = sortedEdges.filter(edge => edge.fromNodeId === node.id && edge.toNodeId !== node.id);
		for (let i = 0; i < outgoing.length; i++) {
			const branch = node.type === 'decision' && outgoing.length === 2;
			exits.set(outgoing[i].id, branch ? (i === 0 ? 'WEST' : 'EAST') : direction === 'DOWN' ? 'SOUTH' : 'EAST');
		}
	}
	const elkNodes = [...nodes].sort((a,b) => a.id.localeCompare(b.id)).map((node) => {
		const { w, h } = sizeOf(node);
		boxes.set(node.id, { w, h });
		return {
			id: node.id, width: w, height: h,
			layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
			ports: [
				{ side: 'NORTH', x: w / 2, y: 0 },
				{ side: 'SOUTH', x: w / 2, y: h },
				{ side: 'WEST', x: 0, y: h / 2 },
				{ side: 'EAST', x: w, y: h / 2 }
			].map(port => ({ id: `${node.id}:${port.side}`, x: port.x, y: port.y, width: 0, height: 0, layoutOptions: { 'elk.port.side': port.side } }))
		};
	});
	const elkEdges: ElkExtendedEdge[] = sortedEdges.map((e) => ({
		id: e.id,
		sources: [`${e.fromNodeId}:${exits.get(e.id) ?? 'EAST'}`],
		targets: [`${e.toNodeId}:${direction === 'DOWN' ? 'NORTH' : 'WEST'}`]
	}));

	const n = nodes.length;
	const graph = {
		id: 'root',
		layoutOptions: {
			'elk.algorithm': 'layered',
			'elk.direction': direction,
			'elk.randomSeed': '1',
			'elk.layered.spacing.nodeNodeBetweenLayers': '90',
			'elk.spacing.nodeNode': '70',
			'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
			'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
			'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
			'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
			'elk.edgeRouting': 'ORTHOGONAL',
			'elk.layered.thoroughness': n > 12 ? '20' : '7'
		},
		children: elkNodes,
		edges: elkEdges
	};

	const result = await elk.layout(graph);
	if (!result.children) return null;

	let minX = Infinity, minY = Infinity;
	for (const child of result.children) {
		if (child.x != null && child.y != null) {
			minX = Math.min(minX, child.x);
			minY = Math.min(minY, child.y);
		}
	}
	if (!isFinite(minX)) return null;


	const positions = new Map<string, Position>();
	for (const child of result.children) {
		if (child.x != null && child.y != null) {
			const box = boxes.get(child.id) || { w: 140, h: 60 };
			positions.set(child.id, {
				x: Math.round(child.x - minX + box.w / 2 + 60),
				y: Math.round(child.y - minY + box.h / 2 + 60)
			});
		}
	}

	const routed = positions as FlowLayoutPositions;
	routed.routes = new Map();
	const sideOf = (id: string, p: Position): NonNullable<FlowEdge['fromSide']> => {
	 const node = result.children!.find(n => n.id === id)!;
	 const distances = [{side:'left' as const,d:Math.abs(p.x-node.x!)},{side:'right' as const,d:Math.abs(p.x-node.x!-node.width!)},{side:'top' as const,d:Math.abs(p.y-node.y!)},{side:'bottom' as const,d:Math.abs(p.y-node.y!-node.height!)}];
	 return distances.sort((a,b)=>a.d-b.d)[0].side;
	};
	for (const edge of result.edges ?? []) {
	 const section = edge.sections?.[0];
	 if (!section) continue;
	 routed.routes.set(edge.id, { waypoints: (section.bendPoints ?? []).map(p => ({x:p.x-minX+60,y:p.y-minY+60})), fromSide:sideOf(edges.find(e => e.id === edge.id)!.fromNodeId,section.startPoint),toSide:sideOf(edges.find(e => e.id === edge.id)!.toNodeId,section.endPoint) });
	}

	return positions;
}
