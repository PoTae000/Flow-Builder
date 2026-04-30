import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';
import { validateEntityLimits } from '$lib/server/ai-limits';
import type { DiagramType } from '$lib/types/diagram';

const TRANSLATE_PROMPT = `You are a professional translator specializing in database terminology and ER diagram naming conventions.

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

			if (type === 'er') {
				const { entities, relationships } = body;
				const entityNames = entities.map((e: any) => e.name);
				const attributeNames = [...new Set(entities.flatMap((e: any) => e.attributes.map((a: any) => a.name)))];
				const relationshipNames = [...new Set((relationships || []).map((r: any) => r.name))];
				names = [...entityNames, ...attributeNames, ...relationshipNames];
			} else if (type === 'flowchart') {
				const { flowNodes, flowEdges } = body;
				const nodeNames = flowNodes.map((n: any) => n.name);
				const edgeLabels = flowEdges.map((e: any) => e.label).filter(Boolean);
				names = [...nodeNames, ...edgeLabels];
			} else {
				const { dfdNodes, dfdFlows } = body;
				const nodeNames = dfdNodes.map((n: any) => n.name);
				const flowLabels = dfdFlows.map((f: any) => f.label).filter(Boolean);
				names = [...nodeNames, ...flowLabels];
			}

			if (names.length === 0) {
				return [{ role: 'user', content: '' }];
			}

			const targetLabel = targetLang === 'th' ? 'Thai (ภาษาไทย)' : 'English';
			const userMessage = `Translate the following names to ${targetLabel}:\n\nNames: ${JSON.stringify([...new Set(names)])}`;

			return [
				{ role: 'system', content: TRANSLATE_PROMPT },
				{ role: 'user', content: userMessage }
			];
		},
		transformResponse: (text, body) => {
			const { entities } = body;
			if (!entities || entities.length === 0) {
				return { entities: {}, attributes: {}, relationships: {} };
			}
			const translation = JSON.parse(text);
			return {
				entities: translation.entities || {},
				attributes: translation.attributes || {},
				relationships: translation.relationships || {}
			};
		},
		temperature: 0.2
	});
};
