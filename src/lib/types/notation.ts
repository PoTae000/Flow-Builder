export type NotationStyle = 'crows-foot' | 'chen' | 'uml' | 'min-max' | 'idef1x' | 'bachman' | 'barker' | 'arrow' | 'merise';

export type NotationPreviewType = 'crows-foot' | 'diamond' | 'text-multiplicity' | 'text-minmax' | 'dot' | 'arrowhead' | 'dashed' | 'double-arrow' | 'oval';

export type NotationGroup = 'popular' | 'academic' | 'other';

export interface NotationOption {
	value: NotationStyle;
	label: string;
	description: string;
	previewType: NotationPreviewType;
	group: NotationGroup;
}

export interface NotationGroupInfo {
	key: NotationGroup;
	label: string;
}

export const NOTATION_GROUPS: NotationGroupInfo[] = [
	{ key: 'popular', label: 'ยอดนิยม' },
	{ key: 'academic', label: 'เชิงวิชาการ' },
	{ key: 'other', label: 'อื่นๆ' }
];

export const NOTATION_OPTIONS: NotationOption[] = [
	{
		value: 'crows-foot',
		label: "Crow's Foot (IE)",
		description: 'ใช้สัญลักษณ์ตีนกา แสดง cardinality — นิยมในอุตสาหกรรม',
		previewType: 'crows-foot',
		group: 'popular'
	},
	{
		value: 'chen',
		label: 'Chen',
		description: 'ใช้สี่เหลี่ยมข้าวหลามตัดเป็น relationship, วงรีเป็น attribute — สอนในมหาลัย',
		previewType: 'diamond',
		group: 'popular'
	},
	{
		value: 'uml',
		label: 'UML',
		description: 'สไตล์ Class Diagram แสดง multiplicity เป็นตัวเลข เช่น 1..*',
		previewType: 'text-multiplicity',
		group: 'popular'
	},
	{
		value: 'min-max',
		label: 'Min-Max',
		description: 'แสดง cardinality เป็นคู่ (min,max) เช่น (0,N), (1,1)',
		previewType: 'text-minmax',
		group: 'academic'
	},
	{
		value: 'idef1x',
		label: 'IDEF1X',
		description: 'มาตรฐานรัฐบาลสหรัฐ — ใช้จุดแทน cardinality, เส้นทึบ/ประ',
		previewType: 'dot',
		group: 'academic'
	},
	{
		value: 'merise',
		label: 'Merise',
		description: 'วิธีของฝรั่งเศส — ใช้วงรีเป็น association พร้อม (min,max)',
		previewType: 'oval',
		group: 'academic'
	},
	{
		value: 'bachman',
		label: 'Bachman',
		description: 'ใช้ลูกศรแสดงทิศทาง — เน้น network model',
		previewType: 'arrowhead',
		group: 'other'
	},
	{
		value: 'barker',
		label: 'Barker (Oracle)',
		description: 'สไตล์ Oracle — เส้นประ = optional, เส้นทึบ = mandatory',
		previewType: 'dashed',
		group: 'other'
	},
	{
		value: 'arrow',
		label: 'Arrow',
		description: 'ลูกศรเรียบง่าย พร้อม label ตัวอักษร',
		previewType: 'double-arrow',
		group: 'other'
	}
];
