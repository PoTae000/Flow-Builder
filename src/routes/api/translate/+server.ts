import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';
import { validateEntityLimits } from '$lib/server/ai-limits';
import type { DiagramType } from '$lib/types/diagram';

const ER_TRANSLATE_PROMPT = `You are a professional translator specializing in database terminology and ER diagram naming conventions.

Your task: Translate all entity names, attribute names, and relationship names to the target language.

Rules:
1. Translate names accurately while keeping them appropriate for database/ER diagrams.
2. For Thai → English: use PascalCase for entities (e.g. "นักศึกษา" → "Student"), snake_case for attributes (e.g. "รหัสนักศึกษา" → "student_id"), and camelCase or short English for relationships.
3. For English → Thai: use natural Thai terms (e.g. "Student" → "นักศึกษา", "student_id" → "รหัสนักศึกษา", "enrolls" → "ลงทะเบียน").
4. Keep technical abbreviations like "id", "pk", "fk" when translating to English.
5. If a name is already in the target language, keep it unchanged.

You MUST return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "entities": { "OriginalName": "TranslatedName" },
  "attributes": { "original_attr": "translated_attr" },
  "relationships": { "original_rel": "translated_rel" }
}

Include ALL names from the input, even if unchanged.`;

const FLOWCHART_TRANSLATE_PROMPT = `You are a professional translator specializing in flowchart terminology.

Your task: Translate all node names and edge labels to the target language.

Rules:
1. For Thai → English: use clear action verbs and questions (e.g. "เริ่มต้น" → "Start", "ตรวจสอบข้อมูล" → "Validate Data", "ข้อมูลถูกต้องหรือไม่?" → "Is Data Valid?")
2. For English → Thai: use natural Thai terms (e.g. "Start" → "เริ่มต้น", "Process Data" → "ประมวลผลข้อมูล", "End" → "จบ")
3. Keep technical terms when appropriate.
4. If a name is already in the target language, keep it unchanged.

You MUST return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "entities": { "OriginalNodeName": "TranslatedNodeName" },
  "attributes": { "original_label": "translated_label" },
  "relationships": {}
}

Include ALL names from the input, even if unchanged.`;

const DFD_TRANSLATE_PROMPT = `You are a professional translator specializing in Data Flow Diagram (DFD) terminology.

Your task: Translate all node names and data flow labels to the target language.

Rules:
1. For Thai → English: use clear process names and data labels (e.g. "ประมวลผลคำสั่งซื้อ" → "Process Order", "ข้อมูลลูกค้า" → "Customer Data")
2. For English → Thai: use natural Thai terms (e.g. "Process Order" → "ประมวลผลคำสั่งซื้อ", "Customer DB" → "ฐานข้อมูลลูกค้า")
3. Keep technical terms when appropriate.
4. If a name is already in the target language, keep it unchanged.

You MUST return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "entities": { "OriginalNodeName": "TranslatedNodeName" },
  "attributes": { "original_flow_label": "translated_flow_label" },
  "relationships": {}
}

Include ALL names from the input, even if unchanged.`;

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => {
			const type: DiagramType = body.diagramType || 'er';
			if (typeof body.targetLang !== 'string' || !['th', 'en'].includes(body.targetLang)) return false;

			// Type-specific validation
			if (type === 'er') {
				if (!Array.isArray(body.entities) || body.entities.length === 0) return false;
			} else if (type === 'flowchart') {
				if (!Array.isArray(body.flowNodes) || body.flowNodes.length === 0) return false;
			} else if (type === 'context') {
				if (!Array.isArray(body.dfdNodes) || body.dfdNodes.length === 0) return false;
			}

			return validateEntityLimits(body);
		},
		buildMessages: (body) => {
			const type: DiagramType = body.diagramType || 'er';
			const { targetLang } = body;

			let names: string[];
			let systemPrompt: string;

			if (type === 'er') {
				systemPrompt = ER_TRANSLATE_PROMPT;
				const { entities, relationships } = body;
				const entityNames = entities.map((e: any) => e.name);
				const attributeNames = [...new Set(entities.flatMap((e: any) => e.attributes.map((a: any) => a.name)))];
				const relationshipNames = [...new Set((relationships || []).map((r: any) => r.name))];
				names = [...entityNames, ...attributeNames, ...relationshipNames];
			} else if (type === 'flowchart') {
				systemPrompt = FLOWCHART_TRANSLATE_PROMPT;
				const { flowNodes, flowEdges } = body;
				const nodeNames = flowNodes.map((n: any) => n.name);
				const edgeLabels = (flowEdges || []).map((e: any) => e.label).filter(Boolean);
				names = [...nodeNames, ...edgeLabels];
			} else {
				systemPrompt = DFD_TRANSLATE_PROMPT;
				const { dfdNodes, dfdFlows } = body;
				const nodeNames = dfdNodes.map((n: any) => n.name);
				const flowLabels = (dfdFlows || []).map((f: any) => f.label).filter(Boolean);
				names = [...nodeNames, ...flowLabels];
			}

			if (names.length === 0) {
				return [{ role: 'user', content: '' }];
			}

			const targetLabel = targetLang === 'th' ? 'Thai (ภาษาไทย)' : 'English';
			const userMessage = `Translate the following names to ${targetLabel}:\n\nNames: ${JSON.stringify([...new Set(names)])}`;

			return [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userMessage }
			];
		},
		transformResponse: (text, body) => {
			const type: DiagramType = body.diagramType || 'er';
			const translation = JSON.parse(text);

			// Return ER format for all types (for backward compatibility with TranslateModal)
			// The modal expects entities, attributes, relationships format
			return {
				entities: translation.entities || translation.nodes || {},
				attributes: translation.attributes || translation.labels || translation.flows || {},
				relationships: translation.relationships || {}
			};
		},
		temperature: 0.2
	});
};
