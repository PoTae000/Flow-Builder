import type { RequestHandler } from './$types';
import { aiRequest } from '$lib/server/ai-request';
import { buildDiagramDescription } from '$lib/utils/diagram-description';
import { buildUnifiedDiagramDescription } from '$lib/utils/diagram-description-multi';
import { validateEntityLimits } from '$lib/server/ai-limits';
import type { DiagramType } from '$lib/types/diagram';

const LANGUAGE_CONFIGS: Record<string, { name: string; ext: string; prompt: string }> = {
	'sql-mysql': {
		name: 'MySQL',
		ext: 'sql',
		prompt: 'Generate MySQL CREATE TABLE statements with proper data types (INT, VARCHAR, TEXT, DATETIME, DECIMAL, etc.), PRIMARY KEY, FOREIGN KEY constraints with ON DELETE/UPDATE, INDEX, AUTO_INCREMENT, ENGINE=InnoDB, DEFAULT CHARSET=utf8mb4.'
	},
	'sql-postgres': {
		name: 'PostgreSQL',
		ext: 'sql',
		prompt: 'Generate PostgreSQL CREATE TABLE statements with proper data types (SERIAL, INTEGER, VARCHAR, TEXT, TIMESTAMP, NUMERIC, etc.), PRIMARY KEY, FOREIGN KEY constraints with ON DELETE/UPDATE, indexes. Use SERIAL for auto-increment PKs.'
	},
	'sql-sqlite': {
		name: 'SQLite',
		ext: 'sql',
		prompt: 'Generate SQLite CREATE TABLE statements with proper data types (INTEGER, TEXT, REAL, BLOB), PRIMARY KEY (with AUTOINCREMENT where appropriate), FOREIGN KEY constraints. Include PRAGMA foreign_keys = ON at the top.'
	},
	'prisma': {
		name: 'Prisma Schema',
		ext: 'prisma',
		prompt: 'Generate a complete Prisma schema file. Include the generator and datasource blocks (use postgresql). Use proper Prisma types (@id, @default(autoincrement()), @relation, @unique, @map, etc.). Model names in PascalCase, field names in camelCase.'
	},
	'typeorm': {
		name: 'TypeORM',
		ext: 'ts',
		prompt: 'Generate TypeORM entity classes in TypeScript. Use decorators: @Entity(), @PrimaryGeneratedColumn(), @Column(), @ManyToOne(), @OneToMany(), @ManyToMany(), @JoinTable(), @JoinColumn(). Import from "typeorm". Use proper TypeScript types.'
	},
	'django': {
		name: 'Django Models',
		ext: 'py',
		prompt: 'Generate Django model classes in Python. Use models.Model as base. Use proper field types: CharField, IntegerField, TextField, DateTimeField, DecimalField, ForeignKey, ManyToManyField. Include Meta class, __str__ method, on_delete parameter.'
	},
	'laravel': {
		name: 'Laravel Migration',
		ext: 'php',
		prompt: 'Generate Laravel migration files. Use Schema::create with proper column types: $table->id(), $table->string(), $table->text(), $table->integer(), $table->timestamps(), $table->foreignId()->constrained(). Include both up() and down() methods.'
	},
	'sequelize': {
		name: 'Sequelize',
		ext: 'js',
		prompt: 'Generate Sequelize model definitions in JavaScript. Use DataTypes (STRING, INTEGER, TEXT, DATE, DECIMAL, BOOLEAN). Include associations (belongsTo, hasMany, belongsToMany). Use sequelize.define() syntax.'
	},

	// Flowchart code generation
	'pseudocode': {
		name: 'Pseudocode',
		ext: 'txt',
		prompt: 'Generate structured pseudocode for this flowchart. Use BEGIN/END blocks, IF/THEN/ELSE for decisions, WHILE/ENDWHILE for loops, PROCESS for actions. Make it clear and readable with proper indentation.'
	},
	'python': {
		name: 'Python',
		ext: 'py',
		prompt: 'Generate a Python function that implements this flowchart logic. Use proper Python conventions: def function_name(), if/elif/else, while loops, meaningful variable names, type hints if appropriate, and docstrings.'
	},
	'javascript': {
		name: 'JavaScript',
		ext: 'js',
		prompt: 'Generate a JavaScript function that implements this flowchart logic. Use modern ES6+ syntax: function/const/let, if/else, while loops, meaningful variable names, JSDoc comments for documentation.'
	},
	'java': {
		name: 'Java',
		ext: 'java',
		prompt: 'Generate a Java method that implements this flowchart logic. Include proper class structure, method signature with return type and parameters, if/else statements, while loops, meaningful variable names, and JavaDoc comments.'
	},
	'csharp': {
		name: 'C#',
		ext: 'cs',
		prompt: 'Generate a C# method that implements this flowchart logic. Include proper class structure, method signature with return type and parameters, if/else statements, while loops, meaningful variable names, and XML documentation comments.'
	},

	// DFD documentation generation
	'data-dictionary': {
		name: 'Data Dictionary',
		ext: 'md',
		prompt: 'Generate a complete data dictionary in Markdown format for this DFD. Include: 1) All data stores with their contents and structure, 2) All data flows with their composition (what data elements they contain), 3) All processes with inputs/outputs/descriptions, 4) All external entities with their role. Use tables and clear formatting.'
	},
	'process-specs': {
		name: 'Process Specifications',
		ext: 'md',
		prompt: 'Generate detailed process specifications in Markdown for this DFD. For each process: 1) Process number and name, 2) Description of what it does, 3) Inputs (data flows in), 4) Outputs (data flows out), 5) Processing logic/algorithm in structured English, 6) Error handling. Use clear section headers and formatting.'
	},
	'api-endpoints': {
		name: 'REST API Design',
		ext: 'md',
		prompt: 'Generate a REST API design document in Markdown based on this DFD. Convert processes to endpoints (POST/GET/PUT/DELETE), data stores to resources, data flows to request/response bodies. Include: 1) Endpoint list with HTTP methods, 2) Request/response formats (JSON), 3) Status codes, 4) Error responses. Use OpenAPI/Swagger-like format.'
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	return aiRequest({
		request,
		platform,
		validateBody: (body) => {
			const type: DiagramType = body.diagramType || 'er';
			if (!body.language || !LANGUAGE_CONFIGS[body.language]) return false;

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
			const { language } = body;
			const langConfig = LANGUAGE_CONFIGS[language];

			// Build diagram description based on type
			let diagramDesc: string;
			if (type === 'er') {
				const { entities, relationships } = body;
				diagramDesc = buildDiagramDescription(entities, relationships || []);
			} else {
				diagramDesc = buildUnifiedDiagramDescription(type, body);
			}

			// Build type-specific system prompt
			let systemPrompt: string;
			const typeLabel = type === 'er' ? 'ER diagram' :
				type === 'flowchart' ? 'flowchart' : 'DFD (Data Flow Diagram)';

			if (type === 'er') {
				systemPrompt = `You are an expert software engineer. Convert the ER diagram below into production-ready code.

${langConfig.prompt}

Rules:
1. Generate ONLY the code — no markdown, no explanation, no comments saying "generated by AI"
2. Include helpful inline comments explaining relationships and constraints
3. Handle junction/bridge tables for M:N relationships
4. Use appropriate data types based on attribute names (e.g., "email" → VARCHAR(255), "price" → DECIMAL, "created_at" → DATETIME/TIMESTAMP)
5. Add proper indexes on foreign keys
6. Handle weak entities with composite keys if applicable
7. The code must be complete, runnable, and follow best practices for ${langConfig.name}
8. If attribute names are in Thai, keep them as-is in comments but use romanized/English versions for actual column/field names where needed
9. ALWAYS properly quote/escape all identifiers (table names, column names) using the target language's quoting mechanism`;
			} else if (type === 'flowchart') {
				systemPrompt = `You are an expert software engineer. Convert the flowchart below into production-ready code.

${langConfig.prompt}

Rules:
1. Generate ONLY the code — no markdown, no explanation
2. Follow the flowchart logic precisely: Start → Process → Decision → End
3. Implement decision branches (yes/no) as if/else statements
4. Implement loops as while/for loops based on the flowchart structure
5. Add helpful comments explaining each step
6. Use meaningful variable and function names
7. The code must be complete, runnable, and follow best practices for ${langConfig.name}
8. If node names are in Thai, translate to English for code but keep Thai in comments`;
			} else {
				// DFD
				systemPrompt = `You are an expert system analyst and technical writer. Generate comprehensive documentation for the DFD below.

${langConfig.prompt}

Rules:
1. Generate ONLY the documentation — no markdown code fences
2. Use clear section headers and formatting
3. For data stores: describe what data they hold
4. For processes: describe inputs, processing logic, and outputs
5. For data flows: describe what data elements they carry
6. For external entities: describe their role in the system
7. Use professional technical writing style
8. If names are in Thai, provide both Thai and English translations`;
			}

			return [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: `Convert this ${typeLabel} to ${langConfig.name}:\n\n${diagramDesc}` }
			];
		},
		transformResponse: (text, body) => {
			const langConfig = LANGUAGE_CONFIGS[body.language];
			// Strip markdown code fences if present
			const code = text.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
			return {
				code,
				language: langConfig.name,
				extension: langConfig.ext
			};
		},
		temperature: 0.2,
		maxTokens: 8192,
		jsonMode: false
	});
};
