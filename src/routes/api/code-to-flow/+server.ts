import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { aiRequest } from '$lib/server/ai-request';

const MAX_CODE = 20000; 

const CODE_TO_FLOW_PROMPT = `You convert source code into a flowchart, expressed as Mermaid \`flowchart TD\` syntax.

Read the code's control flow — entry point, sequential statements, if/else branches, loops (for/while), switch/match, early returns, and function calls — and produce a flowchart that a developer would draw on a whiteboard to explain what the code does.

OUTPUT RULES — follow exactly:
- Output ONLY Mermaid code. No prose, no explanation, no markdown code fences (no \`\`\`).
- First line MUST be: flowchart TD
- Use these node shapes to convey meaning:
  - Start/End (terminators): A([Start]) and Z([End])
  - Process / statement blocks: B[do something]
  - Decisions (if / while condition / switch): C{condition?}
  - Input/Output: D[/read input/]
- Label decision branches with edge labels: C -->|yes| D and C -->|no| E
- For loops: draw the body then an edge back to the loop-condition node to show iteration.
- Keep node labels SHORT (a few words) but faithful to the code — summarise statements, don't paste raw code lines.
- Keep node ids simple (A, B, C, … or short words). Every node must be reachable from Start.
- Model the SIGNIFICANT control flow, not every trivial line. Aim for a readable chart (typically 5–25 nodes).
- Always include a single Start and reach at least one End.

Example:
flowchart TD
    A([Start]) --> B[read n]
    B --> C{n > 0?}
    C -->|yes| D[print n]
    D --> E[n = n - 1]
    E --> C
    C -->|no| Z([End])`;

export const POST: RequestHandler = async ({ request }) => {
	const body: any = await request.json();

	if (typeof body?.code !== 'string' || !body.code.trim()) {
		throw error(400, 'กรุณาวางโค้ด');
	}
	if (body.code.length > MAX_CODE) {
		throw error(413, 'โค้ดยาวเกินไป — ลดขนาดลงก่อน');
	}

	const language = typeof body.language === 'string' ? body.language.slice(0, 40) : '';

	return aiRequest({
		request: new Request(request.url, {
			method: 'POST',
			headers: request.headers,
			body: JSON.stringify(body)
		}),
		validateBody: (b) => typeof b?.code === 'string' && b.code.trim().length > 0,
		buildMessages: (b) => [
			{ role: 'system', content: CODE_TO_FLOW_PROMPT },
			{
				role: 'user',
				content: `Convert this${language ? ' ' + language : ''} code into a Mermaid flowchart:\n\n${b.code}`
			}
		],
		temperature: 0.2,
		maxTokens: 2048,
		jsonMode: false,
		
		transformResponse: (text: string) => {
			let mermaid = text.trim();
			
			mermaid = mermaid.replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```$/i, '').trim();
			return { mermaid };
		}
	});
};
