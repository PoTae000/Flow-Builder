export type DiagramType = 'er' | 'flowchart' | 'context';

export const DIAGRAM_TYPE_OPTIONS: { value: DiagramType; label: string; description: string }[] = [
	{ value: 'er', label: 'ER Diagram', description: 'Entity-Relationship Diagram' },
	{ value: 'flowchart', label: 'Flowchart', description: 'Process flow diagram' },
	{ value: 'context', label: 'Context Diagram', description: 'DFD Level 0' }
];
