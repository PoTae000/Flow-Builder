
export type CommentTargetType =
	| 'entity'
	| 'relationship'
	| 'flowNode'
	| 'flowEdge'
	| 'dfdNode'
	| 'dfdFlow';


export interface Comment {
	id: string;
	targetId: string;
	targetType: CommentTargetType;
	text: string;
	authorName: string;
	createdAt: number;
	resolved?: boolean;
	
	parentId?: string | null;
}
