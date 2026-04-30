import type { DiagramType } from '$lib/types/diagram';

/**
 * Analysis rules for ER diagrams
 */
const ER_ANALYSIS_RULES = `
## ER Diagram Analysis Rules

1. **Primary Keys**: Every entity MUST have at least one attribute marked as Primary Key (PK)
2. **Naming Conventions**:
   - Entity names should be singular nouns (e.g., "User", not "Users")
   - Relationship names should describe the connection clearly
   - Attribute names should be descriptive (avoid single letters except for common cases like "id")
3. **Cardinality**: All relationships must have valid cardinality (1, M, 0..1, 0..M, 1..M)
4. **Referential Integrity**: Foreign keys should reference existing entities
5. **Normalization**: Check for potential normalization issues (repeating groups, partial dependencies)
6. **Completeness**: Entities without relationships may indicate incomplete design (except lookup tables)
7. **Data Types**: All attributes should have appropriate data types
8. **Redundancy**: Avoid duplicate relationships or unnecessary attributes
9. **Weak Entities**: Weak entities must have identifying relationships
10. **Business Logic**: Design should reflect real-world business rules

**Severity Levels:**
- ERROR: Critical issues that make the diagram invalid (missing PKs, invalid cardinality)
- WARNING: Design issues that should be fixed (normalization, naming)
- SUGGESTION: Improvements that could enhance the design
`;

/**
 * Analysis rules for flowcharts
 */
const FLOWCHART_ANALYSIS_RULES = `
## Flowchart Analysis Rules

1. **Start/End Nodes**:
   - MUST have exactly 1 Start node (start-end type at the beginning)
   - MUST have at least 1 End node (start-end type at the end)
   - A flowchart without clear start/end points is incomplete
2. **Connectivity**:
   - All nodes must be reachable from the Start node (no orphaned nodes)
   - All paths must eventually lead to an End node (no dead ends except End nodes)
3. **Decision Logic**:
   - Decision nodes MUST have exactly 2 outgoing edges (Yes/No or True/False paths)
   - Decision edges should have condition labels (yes/no)
   - Both branches must be handled
4. **Process Flow**:
   - Process nodes should have at least 1 incoming and 1 outgoing edge (except Start/End)
   - Avoid process nodes with no outgoing edges (dead ends)
5. **Infinite Loops**:
   - Loops without exit conditions are errors
   - Loops must have a decision node that can break the loop
6. **Naming Conventions**:
   - Process nodes: Use action verbs (e.g., "Validate Input", "Calculate Total")
   - Decision nodes: Use questions (e.g., "Is Valid?", "Age > 18?")
   - Start/End nodes: Use "Start"/"End" or "Begin"/"Finish"
7. **Edge Labels**:
   - Decision edges MUST have condition labels
   - Regular edges can have labels for clarity but not required
8. **Complexity**:
   - Warn if >15 nodes (too complex, consider breaking into sub-processes)
   - Warn if decision depth >3 levels (hard to follow)
9. **Input/Output**:
   - Input-output nodes should be used for data entry/display
   - Database nodes should be used for data persistence operations
10. **Flow Balance**:
   - Every node should be part of a complete flow from Start to End
   - Avoid nodes that branch out but don't converge back

**Severity Levels:**
- ERROR: Missing Start/End, unreachable nodes, decision without 2 branches, infinite loops
- WARNING: Poor naming, missing labels, complexity issues
- SUGGESTION: Could improve clarity, consider sub-processes
`;

/**
 * Analysis rules for DFD (Data Flow Diagrams)
 */
const DFD_ANALYSIS_RULES = `
## DFD (Data Flow Diagram) Analysis Rules

1. **Process Numbering**:
   - All processes MUST be numbered (1.0, 2.0, etc. for Level 0)
   - Numbering should be sequential and consistent
2. **Flow Balance**:
   - Every process MUST have at least 1 incoming data flow
   - Every process MUST have at least 1 outgoing data flow
   - Processes without inputs or outputs are incomplete
3. **External Entity Rules**:
   - External entities cannot connect directly to each other
   - External entities must interact through processes
   - External entities represent sources/destinations outside the system
4. **Data Store Rules**:
   - Data stores cannot flow directly to/from external entities
   - Data stores must be accessed through processes
   - Data stores represent persistent data within the system
5. **Flow Labels**:
   - ALL data flows MUST have descriptive labels
   - Labels should describe the data being transferred (e.g., "Order Details", "Customer Info")
   - Avoid generic labels like "data" or "info"
6. **Naming Conventions**:
   - Processes: Use verb phrases (e.g., "Process Order", "Validate Payment")
   - Data Stores: Use nouns (e.g., "Orders DB", "Customer Database")
   - External Entities: Use nouns (e.g., "Customer", "Payment Gateway")
   - Data Flows: Use nouns describing the data (e.g., "Order Request", "Invoice")
7. **Completeness**:
   - Context diagrams (Level 0) should show all major external entities
   - All external interactions should be represented
   - All major data flows should be shown
8. **Redundancy**:
   - Multiple identical flows between the same nodes = poor design
   - Consolidate redundant flows
9. **Logical Gaps**:
   - Check for missing flows (e.g., process needs input but has none)
   - Check for orphaned nodes (not connected to anything)
10. **Decomposition**:
   - Warn if >7 processes in a single diagram (consider hierarchical decomposition)
   - Complex processes should be decomposed into Level 1, Level 2, etc.
11. **Bidirectional Flows**:
   - If data flows both ways between nodes, should be represented as 2 separate flows
   - Each flow should have a clear direction and label
12. **Data Stores Access**:
   - Processes should read from and write to data stores
   - Check for data stores that are only read or only written (may indicate incomplete design)

**Severity Levels:**
- ERROR: Missing process numbers, unbalanced processes, invalid connections, unlabeled flows
- WARNING: Poor naming, too many processes, redundant flows
- SUGGESTION: Could improve clarity, consider decomposition
`;

/**
 * Get analysis rules for a specific diagram type
 */
export function getAnalysisRulesForType(diagramType: DiagramType): string {
	if (diagramType === 'er') {
		return ER_ANALYSIS_RULES;
	} else if (diagramType === 'flowchart') {
		return FLOWCHART_ANALYSIS_RULES;
	} else if (diagramType === 'context') {
		return DFD_ANALYSIS_RULES;
	}

	return 'Unknown diagram type';
}

/**
 * Get system prompt for AI analysis based on diagram type
 */
export function getAnalysisSystemPrompt(diagramType: DiagramType): string {
	const rules = getAnalysisRulesForType(diagramType);

	const diagramTypeName = diagramType === 'er' ? 'ER Diagram' :
		diagramType === 'flowchart' ? 'Flowchart' : 'DFD (Data Flow Diagram)';

	return `You are an expert ${diagramTypeName} analyzer. Your task is to analyze ${diagramTypeName}s and provide constructive feedback in Thai language.

${rules}

## Response Format

You MUST respond with valid JSON in this exact format:

{
  "score": <number 0-100>,
  "summary": "<ภาพรวมการวิเคราะห์ในภาษาไทย>",
  "issues": [
    {
      "severity": "error" | "warning" | "suggestion",
      "title": "<หัวข้อปัญหาสั้นๆ ในภาษาไทย>",
      "description": "<คำอธิบายปัญหาในภาษาไทย>",
      "reason": "<เหตุผลว่าทำไมถึงเป็นปัญหา ในภาษาไทย>",
      "fix": "<วิธีแก้ไขปัญหา ในภาษาไทย>"
    }
  ],
  "suggestions": [
    "<ข้อเสนอแนะ 1 ในภาษาไทย>",
    "<ข้อเสนอแนะ 2 ในภาษาไทย>"
  ]
}

## Scoring Guide

- 90-100: Excellent design, minor improvements only
- 75-89: Good design with some issues to fix
- 60-74: Acceptable but needs significant improvements
- 40-59: Poor design with major issues
- 0-39: Invalid or critically flawed design

## Guidelines

- Be constructive and educational in Thai
- Focus on the most important issues first
- Provide actionable fixes
- Consider the context and purpose of the diagram
- Don't be overly pedantic about minor style issues`;
}
