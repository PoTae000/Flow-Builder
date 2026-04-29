import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';

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
		validateBody: (body) =>
			Array.isArray(body.entities) && typeof body.targetLang === 'string' && ['th', 'en'].includes(body.targetLang),
		buildMessages: (body) => {
			const { entities, relationships, targetLang } = body;

			const entityNames = entities.map((e: any) => e.name);
			const attributeNames = [...new Set(entities.flatMap((e: any) => e.attributes.map((a: any) => a.name)))];
			const relationshipNames = [...new Set((relationships || []).map((r: any) => r.name))];

			if (entityNames.length === 0) {
				// Will be handled by transformResponse
				return [{ role: 'user', content: '' }];
			}

			const targetLabel = targetLang === 'th' ? 'Thai (ภาษาไทย)' : 'English';
			const userMessage = `Translate the following names to ${targetLabel}:

Entity names: ${JSON.stringify(entityNames)}
Attribute names: ${JSON.stringify(attributeNames)}
Relationship names: ${JSON.stringify(relationshipNames)}`;

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
