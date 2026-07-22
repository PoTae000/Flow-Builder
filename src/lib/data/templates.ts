import type { Entity, Relationship } from '$lib/types/er';
import type { FlowNode, FlowEdge } from '$lib/types/flowchart';
import type { DFDNode, DFDFlow } from '$lib/types/context-diagram';

export interface DiagramTemplate {
	name: string;
	description: string;
	entities: Entity[];
	relationships: Relationship[];
}

export interface FlowchartTemplate {
	name: string;
	description: string;
	flowNodes: FlowNode[];
	flowEdges: FlowEdge[];
}

export interface DFDTemplate {
	name: string;
	description: string;
	dfdNodes: DFDNode[];
	dfdFlows: DFDFlow[];
}

export const templates: DiagramTemplate[] = [
	{
		name: 'E-commerce',
		description: 'ระบบร้านค้าออนไลน์ — ลูกค้า, สินค้า, คำสั่งซื้อ',
		entities: [
			{
				id: 't1e1',
				name: 'Customer',
				attributes: [
					{ id: 't1a1', name: 'id', type: 'primary_key' },
					{ id: 't1a2', name: 'name', type: 'regular' },
					{ id: 't1a3', name: 'email', type: 'regular' }
				],
				position: { x: 60, y: 60 },
				isWeak: false
			},
			{
				id: 't1e2',
				name: 'Product',
				attributes: [
					{ id: 't1a4', name: 'id', type: 'primary_key' },
					{ id: 't1a5', name: 'name', type: 'regular' },
					{ id: 't1a6', name: 'price', type: 'regular' },
					{ id: 't1a7', name: 'stock', type: 'regular' }
				],
				position: { x: 340, y: 60 },
				isWeak: false
			},
			{
				id: 't1e3',
				name: 'Order',
				attributes: [
					{ id: 't1a8', name: 'id', type: 'primary_key' },
					{ id: 't1a9', name: 'order_date', type: 'regular' },
					{ id: 't1a10', name: 'total', type: 'regular' }
				],
				position: { x: 60, y: 260 },
				isWeak: false
			},
			{
				id: 't1e4',
				name: 'OrderItem',
				attributes: [
					{ id: 't1a11', name: 'id', type: 'primary_key' },
					{ id: 't1a12', name: 'quantity', type: 'regular' },
					{ id: 't1a13', name: 'unit_price', type: 'regular' }
				],
				position: { x: 340, y: 260 },
				isWeak: false
			}
		],
		relationships: [
			{
				id: 't1r1',
				name: 'places',
				entityIds: ['t1e1', 't1e3'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't1r2',
				name: 'contains',
				entityIds: ['t1e3', 't1e4'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't1r3',
				name: 'includes',
				entityIds: ['t1e2', 't1e4'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			}
		]
	},
	{
		name: 'Blog',
		description: 'ระบบบล็อก — ผู้ใช้, โพสต์, ความคิดเห็น, หมวดหมู่',
		entities: [
			{
				id: 't2e1',
				name: 'User',
				attributes: [
					{ id: 't2a1', name: 'id', type: 'primary_key' },
					{ id: 't2a2', name: 'username', type: 'regular' },
					{ id: 't2a3', name: 'email', type: 'regular' },
					{ id: 't2a4', name: 'password', type: 'regular' }
				],
				position: { x: 60, y: 60 },
				isWeak: false
			},
			{
				id: 't2e2',
				name: 'Post',
				attributes: [
					{ id: 't2a5', name: 'id', type: 'primary_key' },
					{ id: 't2a6', name: 'title', type: 'regular' },
					{ id: 't2a7', name: 'content', type: 'regular' },
					{ id: 't2a8', name: 'created_at', type: 'regular' }
				],
				position: { x: 340, y: 60 },
				isWeak: false
			},
			{
				id: 't2e3',
				name: 'Comment',
				attributes: [
					{ id: 't2a9', name: 'id', type: 'primary_key' },
					{ id: 't2a10', name: 'content', type: 'regular' },
					{ id: 't2a11', name: 'created_at', type: 'regular' }
				],
				position: { x: 60, y: 260 },
				isWeak: false
			},
			{
				id: 't2e4',
				name: 'Category',
				attributes: [
					{ id: 't2a12', name: 'id', type: 'primary_key' },
					{ id: 't2a13', name: 'name', type: 'regular' }
				],
				position: { x: 340, y: 260 },
				isWeak: false
			}
		],
		relationships: [
			{
				id: 't2r1',
				name: 'writes',
				entityIds: ['t2e1', 't2e2'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't2r2',
				name: 'has',
				entityIds: ['t2e2', 't2e3'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't2r3',
				name: 'comments',
				entityIds: ['t2e1', 't2e3'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't2r4',
				name: 'categorized',
				entityIds: ['t2e2', 't2e4'],
				cardinalities: ['N', 'M'],
				isIdentifying: false
			}
		]
	},
	{
		name: 'School',
		description: 'ระบบโรงเรียน — นักเรียน, วิชา, อาจารย์, การลงทะเบียน',
		entities: [
			{
				id: 't3e1',
				name: 'Student',
				attributes: [
					{ id: 't3a1', name: 'id', type: 'primary_key' },
					{ id: 't3a2', name: 'name', type: 'regular' },
					{ id: 't3a3', name: 'email', type: 'regular' },
					{ id: 't3a4', name: 'gpa', type: 'regular' }
				],
				position: { x: 60, y: 60 },
				isWeak: false
			},
			{
				id: 't3e2',
				name: 'Course',
				attributes: [
					{ id: 't3a5', name: 'id', type: 'primary_key' },
					{ id: 't3a6', name: 'course_name', type: 'regular' },
					{ id: 't3a7', name: 'credits', type: 'regular' }
				],
				position: { x: 340, y: 60 },
				isWeak: false
			},
			{
				id: 't3e3',
				name: 'Teacher',
				attributes: [
					{ id: 't3a8', name: 'id', type: 'primary_key' },
					{ id: 't3a9', name: 'name', type: 'regular' },
					{ id: 't3a10', name: 'department', type: 'regular' }
				],
				position: { x: 60, y: 260 },
				isWeak: false
			},
			{
				id: 't3e4',
				name: 'Enrollment',
				attributes: [
					{ id: 't3a11', name: 'id', type: 'primary_key' },
					{ id: 't3a12', name: 'grade', type: 'regular' },
					{ id: 't3a13', name: 'semester', type: 'regular' }
				],
				position: { x: 340, y: 260 },
				isWeak: false
			}
		],
		relationships: [
			{
				id: 't3r1',
				name: 'enrolls',
				entityIds: ['t3e1', 't3e4'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't3r2',
				name: 'for',
				entityIds: ['t3e2', 't3e4'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't3r3',
				name: 'teaches',
				entityIds: ['t3e3', 't3e2'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			}
		]
	},
	{
		name: 'Hospital',
		description: 'ระบบโรงพยาบาล — ผู้ป่วย, แพทย์, นัดหมาย, แผนก',
		entities: [
			{
				id: 't4e1',
				name: 'Patient',
				attributes: [
					{ id: 't4a1', name: 'id', type: 'primary_key' },
					{ id: 't4a2', name: 'name', type: 'regular' },
					{ id: 't4a3', name: 'dob', type: 'regular' },
					{ id: 't4a4', name: 'phone', type: 'regular' }
				],
				position: { x: 60, y: 60 },
				isWeak: false
			},
			{
				id: 't4e2',
				name: 'Doctor',
				attributes: [
					{ id: 't4a5', name: 'id', type: 'primary_key' },
					{ id: 't4a6', name: 'name', type: 'regular' },
					{ id: 't4a7', name: 'specialty', type: 'regular' }
				],
				position: { x: 340, y: 60 },
				isWeak: false
			},
			{
				id: 't4e3',
				name: 'Appointment',
				attributes: [
					{ id: 't4a8', name: 'id', type: 'primary_key' },
					{ id: 't4a9', name: 'date', type: 'regular' },
					{ id: 't4a10', name: 'time', type: 'regular' },
					{ id: 't4a11', name: 'status', type: 'regular' }
				],
				position: { x: 60, y: 260 },
				isWeak: false
			},
			{
				id: 't4e4',
				name: 'Department',
				attributes: [
					{ id: 't4a12', name: 'id', type: 'primary_key' },
					{ id: 't4a13', name: 'name', type: 'regular' },
					{ id: 't4a14', name: 'floor', type: 'regular' }
				],
				position: { x: 340, y: 260 },
				isWeak: false
			}
		],
		relationships: [
			{
				id: 't4r1',
				name: 'books',
				entityIds: ['t4e1', 't4e3'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't4r2',
				name: 'attends',
				entityIds: ['t4e2', 't4e3'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't4r3',
				name: 'belongs_to',
				entityIds: ['t4e2', 't4e4'],
				cardinalities: ['N', '1'],
				isIdentifying: false
			}
		]
	},
	{
		name: 'Library',
		description: 'ระบบห้องสมุด — หนังสือ, สมาชิก, การยืม-คืน, ผู้แต่ง',
		entities: [
			{
				id: 't5e1',
				name: 'Book',
				attributes: [
					{ id: 't5a1', name: 'isbn', type: 'primary_key' },
					{ id: 't5a2', name: 'title', type: 'regular' },
					{ id: 't5a3', name: 'publisher', type: 'regular' },
					{ id: 't5a4', name: 'year', type: 'regular' }
				],
				position: { x: 60, y: 60 },
				isWeak: false
			},
			{
				id: 't5e2',
				name: 'Member',
				attributes: [
					{ id: 't5a5', name: 'id', type: 'primary_key' },
					{ id: 't5a6', name: 'name', type: 'regular' },
					{ id: 't5a7', name: 'phone', type: 'regular' }
				],
				position: { x: 340, y: 60 },
				isWeak: false
			},
			{
				id: 't5e3',
				name: 'Loan',
				attributes: [
					{ id: 't5a8', name: 'id', type: 'primary_key' },
					{ id: 't5a9', name: 'borrow_date', type: 'regular' },
					{ id: 't5a10', name: 'return_date', type: 'regular' }
				],
				position: { x: 340, y: 260 },
				isWeak: false
			},
			{
				id: 't5e4',
				name: 'Author',
				attributes: [
					{ id: 't5a11', name: 'id', type: 'primary_key' },
					{ id: 't5a12', name: 'name', type: 'regular' },
					{ id: 't5a13', name: 'nationality', type: 'regular' }
				],
				position: { x: 60, y: 260 },
				isWeak: false
			}
		],
		relationships: [
			{
				id: 't5r1',
				name: 'borrows',
				entityIds: ['t5e2', 't5e3'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't5r2',
				name: 'includes',
				entityIds: ['t5e1', 't5e3'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't5r3',
				name: 'written_by',
				entityIds: ['t5e1', 't5e4'],
				cardinalities: ['N', 'M'],
				isIdentifying: false
			}
		]
	},
	{
		name: 'Restaurant',
		description: 'ระบบร้านอาหาร — เมนู, โต๊ะ, ออเดอร์, พนักงาน',
		entities: [
			{
				id: 't6e1',
				name: 'Menu',
				attributes: [
					{ id: 't6a1', name: 'id', type: 'primary_key' },
					{ id: 't6a2', name: 'name', type: 'regular' },
					{ id: 't6a3', name: 'price', type: 'regular' },
					{ id: 't6a4', name: 'category', type: 'regular' }
				],
				position: { x: 60, y: 60 },
				isWeak: false
			},
			{
				id: 't6e2',
				name: 'Table',
				attributes: [
					{ id: 't6a5', name: 'id', type: 'primary_key' },
					{ id: 't6a6', name: 'seats', type: 'regular' },
					{ id: 't6a7', name: 'zone', type: 'regular' }
				],
				position: { x: 340, y: 60 },
				isWeak: false
			},
			{
				id: 't6e3',
				name: 'Order',
				attributes: [
					{ id: 't6a8', name: 'id', type: 'primary_key' },
					{ id: 't6a9', name: 'order_time', type: 'regular' },
					{ id: 't6a10', name: 'total', type: 'regular' }
				],
				position: { x: 340, y: 260 },
				isWeak: false
			},
			{
				id: 't6e4',
				name: 'Staff',
				attributes: [
					{ id: 't6a11', name: 'id', type: 'primary_key' },
					{ id: 't6a12', name: 'name', type: 'regular' },
					{ id: 't6a13', name: 'role', type: 'regular' }
				],
				position: { x: 60, y: 260 },
				isWeak: false
			}
		],
		relationships: [
			{
				id: 't6r1',
				name: 'ordered_at',
				entityIds: ['t6e2', 't6e3'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't6r2',
				name: 'contains',
				entityIds: ['t6e1', 't6e3'],
				cardinalities: ['N', 'M'],
				isIdentifying: false
			},
			{
				id: 't6r3',
				name: 'serves',
				entityIds: ['t6e4', 't6e3'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			}
		]
	},
	{
		name: 'Hotel',
		description: 'ระบบโรงแรม — ห้องพัก, แขก, การจอง, บริการ',
		entities: [
			{
				id: 't7e1',
				name: 'Room',
				attributes: [
					{ id: 't7a1', name: 'room_no', type: 'primary_key' },
					{ id: 't7a2', name: 'type', type: 'regular' },
					{ id: 't7a3', name: 'price', type: 'regular' },
					{ id: 't7a4', name: 'floor', type: 'regular' }
				],
				position: { x: 60, y: 60 },
				isWeak: false
			},
			{
				id: 't7e2',
				name: 'Guest',
				attributes: [
					{ id: 't7a5', name: 'id', type: 'primary_key' },
					{ id: 't7a6', name: 'name', type: 'regular' },
					{ id: 't7a7', name: 'phone', type: 'regular' },
					{ id: 't7a8', name: 'email', type: 'regular' }
				],
				position: { x: 340, y: 60 },
				isWeak: false
			},
			{
				id: 't7e3',
				name: 'Reservation',
				attributes: [
					{ id: 't7a9', name: 'id', type: 'primary_key' },
					{ id: 't7a10', name: 'check_in', type: 'regular' },
					{ id: 't7a11', name: 'check_out', type: 'regular' },
					{ id: 't7a12', name: 'status', type: 'regular' }
				],
				position: { x: 60, y: 260 },
				isWeak: false
			},
			{
				id: 't7e4',
				name: 'Service',
				attributes: [
					{ id: 't7a13', name: 'id', type: 'primary_key' },
					{ id: 't7a14', name: 'name', type: 'regular' },
					{ id: 't7a15', name: 'price', type: 'regular' }
				],
				position: { x: 340, y: 260 },
				isWeak: false
			}
		],
		relationships: [
			{
				id: 't7r1',
				name: 'booked_for',
				entityIds: ['t7e1', 't7e3'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't7r2',
				name: 'makes',
				entityIds: ['t7e2', 't7e3'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't7r3',
				name: 'requests',
				entityIds: ['t7e2', 't7e4'],
				cardinalities: ['N', 'M'],
				isIdentifying: false
			}
		]
	},
	{
		name: 'Social Media',
		description: 'ระบบโซเชียล — ผู้ใช้, โพสต์, ไลค์, ข้อความ',
		entities: [
			{
				id: 't8e1',
				name: 'User',
				attributes: [
					{ id: 't8a1', name: 'id', type: 'primary_key' },
					{ id: 't8a2', name: 'username', type: 'regular' },
					{ id: 't8a3', name: 'bio', type: 'regular' }
				],
				position: { x: 60, y: 60 },
				isWeak: false
			},
			{
				id: 't8e2',
				name: 'Post',
				attributes: [
					{ id: 't8a4', name: 'id', type: 'primary_key' },
					{ id: 't8a5', name: 'content', type: 'regular' },
					{ id: 't8a6', name: 'created_at', type: 'regular' }
				],
				position: { x: 340, y: 60 },
				isWeak: false
			},
			{
				id: 't8e3',
				name: 'Like',
				attributes: [
					{ id: 't8a7', name: 'id', type: 'primary_key' },
					{ id: 't8a8', name: 'liked_at', type: 'regular' }
				],
				position: { x: 60, y: 260 },
				isWeak: false
			},
			{
				id: 't8e4',
				name: 'Message',
				attributes: [
					{ id: 't8a9', name: 'id', type: 'primary_key' },
					{ id: 't8a10', name: 'text', type: 'regular' },
					{ id: 't8a11', name: 'sent_at', type: 'regular' }
				],
				position: { x: 340, y: 260 },
				isWeak: false
			}
		],
		relationships: [
			{
				id: 't8r1',
				name: 'creates',
				entityIds: ['t8e1', 't8e2'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't8r2',
				name: 'likes',
				entityIds: ['t8e1', 't8e3'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't8r3',
				name: 'on_post',
				entityIds: ['t8e2', 't8e3'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			},
			{
				id: 't8r4',
				name: 'sends',
				entityIds: ['t8e1', 't8e4'],
				cardinalities: ['1', 'N'],
				isIdentifying: false
			}
		]
	}
];

export const flowchartTemplates: FlowchartTemplate[] = [
	{
		name: 'User Login',
		description: 'กระบวนการเข้าสู่ระบบ — ตรวจสอบ username/password',
		flowNodes: [
			{ id: 'fc1n1', name: 'Start', type: 'start-end', position: { x: 200, y: 50 } },
			{ id: 'fc1n2', name: 'Enter Credentials', type: 'input-output', position: { x: 200, y: 150 } },
			{ id: 'fc1n3', name: 'Valid?', type: 'decision', position: { x: 200, y: 250 } },
			{ id: 'fc1n4', name: 'Show Dashboard', type: 'process', position: { x: 350, y: 350 } },
			{ id: 'fc1n5', name: 'Show Error', type: 'process', position: { x: 50, y: 350 } },
			{ id: 'fc1n6', name: 'End', type: 'start-end', position: { x: 200, y: 450 } }
		],
		flowEdges: [
			{ id: 'fc1e1', label: '', fromNodeId: 'fc1n1', toNodeId: 'fc1n2' },
			{ id: 'fc1e2', label: '', fromNodeId: 'fc1n2', toNodeId: 'fc1n3' },
			{ id: 'fc1e3', label: 'yes', fromNodeId: 'fc1n3', toNodeId: 'fc1n4', condition: 'yes' },
			{ id: 'fc1e4', label: 'no', fromNodeId: 'fc1n3', toNodeId: 'fc1n5', condition: 'no' },
			{ id: 'fc1e5', label: '', fromNodeId: 'fc1n4', toNodeId: 'fc1n6' },
			{ id: 'fc1e6', label: '', fromNodeId: 'fc1n5', toNodeId: 'fc1n6' }
		]
	},
	{
		name: 'Order Processing',
		description: 'กระบวนการสั่งซื้อสินค้า — ตรวจสอบสต็อกและชำระเงิน',
		flowNodes: [
			{ id: 'fc2n1', name: 'Start', type: 'start-end', position: { x: 200, y: 50 } },
			{ id: 'fc2n2', name: 'Receive Order', type: 'input-output', position: { x: 200, y: 130 } },
			{ id: 'fc2n3', name: 'Check Stock', type: 'process', position: { x: 200, y: 210 } },
			{ id: 'fc2n4', name: 'In Stock?', type: 'decision', position: { x: 200, y: 290 } },
			{ id: 'fc2n5', name: 'Process Payment', type: 'process', position: { x: 350, y: 370 } },
			{ id: 'fc2n6', name: 'Notify Out of Stock', type: 'process', position: { x: 50, y: 370 } },
			{ id: 'fc2n7', name: 'Payment OK?', type: 'decision', position: { x: 350, y: 470 } },
			{ id: 'fc2n8', name: 'Ship Order', type: 'process', position: { x: 500, y: 550 } },
			{ id: 'fc2n9', name: 'Cancel Order', type: 'process', position: { x: 200, y: 550 } },
			{ id: 'fc2n10', name: 'End', type: 'start-end', position: { x: 350, y: 630 } }
		],
		flowEdges: [
			{ id: 'fc2e1', label: '', fromNodeId: 'fc2n1', toNodeId: 'fc2n2' },
			{ id: 'fc2e2', label: '', fromNodeId: 'fc2n2', toNodeId: 'fc2n3' },
			{ id: 'fc2e3', label: '', fromNodeId: 'fc2n3', toNodeId: 'fc2n4' },
			{ id: 'fc2e4', label: 'yes', fromNodeId: 'fc2n4', toNodeId: 'fc2n5', condition: 'yes' },
			{ id: 'fc2e5', label: 'no', fromNodeId: 'fc2n4', toNodeId: 'fc2n6', condition: 'no' },
			{ id: 'fc2e6', label: '', fromNodeId: 'fc2n5', toNodeId: 'fc2n7' },
			{ id: 'fc2e7', label: 'yes', fromNodeId: 'fc2n7', toNodeId: 'fc2n8', condition: 'yes' },
			{ id: 'fc2e8', label: 'no', fromNodeId: 'fc2n7', toNodeId: 'fc2n9', condition: 'no' },
			{ id: 'fc2e9', label: '', fromNodeId: 'fc2n6', toNodeId: 'fc2n10' },
			{ id: 'fc2e10', label: '', fromNodeId: 'fc2n8', toNodeId: 'fc2n10' },
			{ id: 'fc2e11', label: '', fromNodeId: 'fc2n9', toNodeId: 'fc2n10' }
		]
	},
	{
		name: 'Grade Calculator',
		description: 'คำนวณเกรด — รับคะแนน ตรวจสอบเกณฑ์',
		flowNodes: [
			{ id: 'fc3n1', name: 'Start', type: 'start-end', position: { x: 200, y: 50 } },
			{ id: 'fc3n2', name: 'Input Score', type: 'input-output', position: { x: 200, y: 130 } },
			{ id: 'fc3n3', name: 'Score >= 80?', type: 'decision', position: { x: 200, y: 210 } },
			{ id: 'fc3n4', name: 'Grade = A', type: 'process', position: { x: 350, y: 290 } },
			{ id: 'fc3n5', name: 'Score >= 70?', type: 'decision', position: { x: 200, y: 310 } },
			{ id: 'fc3n6', name: 'Grade = B', type: 'process', position: { x: 350, y: 390 } },
			{ id: 'fc3n7', name: 'Score >= 60?', type: 'decision', position: { x: 200, y: 410 } },
			{ id: 'fc3n8', name: 'Grade = C', type: 'process', position: { x: 350, y: 490 } },
			{ id: 'fc3n9', name: 'Grade = F', type: 'process', position: { x: 200, y: 510 } },
			{ id: 'fc3n10', name: 'Display Grade', type: 'input-output', position: { x: 275, y: 590 } },
			{ id: 'fc3n11', name: 'End', type: 'start-end', position: { x: 275, y: 670 } }
		],
		flowEdges: [
			{ id: 'fc3e1', label: '', fromNodeId: 'fc3n1', toNodeId: 'fc3n2' },
			{ id: 'fc3e2', label: '', fromNodeId: 'fc3n2', toNodeId: 'fc3n3' },
			{ id: 'fc3e3', label: 'yes', fromNodeId: 'fc3n3', toNodeId: 'fc3n4', condition: 'yes' },
			{ id: 'fc3e4', label: 'no', fromNodeId: 'fc3n3', toNodeId: 'fc3n5', condition: 'no' },
			{ id: 'fc3e5', label: 'yes', fromNodeId: 'fc3n5', toNodeId: 'fc3n6', condition: 'yes' },
			{ id: 'fc3e6', label: 'no', fromNodeId: 'fc3n5', toNodeId: 'fc3n7', condition: 'no' },
			{ id: 'fc3e7', label: 'yes', fromNodeId: 'fc3n7', toNodeId: 'fc3n8', condition: 'yes' },
			{ id: 'fc3e8', label: 'no', fromNodeId: 'fc3n7', toNodeId: 'fc3n9', condition: 'no' },
			{ id: 'fc3e9', label: '', fromNodeId: 'fc3n4', toNodeId: 'fc3n10' },
			{ id: 'fc3e10', label: '', fromNodeId: 'fc3n6', toNodeId: 'fc3n10' },
			{ id: 'fc3e11', label: '', fromNodeId: 'fc3n8', toNodeId: 'fc3n10' },
			{ id: 'fc3e12', label: '', fromNodeId: 'fc3n9', toNodeId: 'fc3n10' },
			{ id: 'fc3e13', label: '', fromNodeId: 'fc3n10', toNodeId: 'fc3n11' }
		]
	},
	{
		name: 'ATM Withdrawal',
		description: 'ถอนเงิน ATM — ตรวจสอบยอดและ PIN',
		flowNodes: [
			{ id: 'fc4n1', name: 'Start', type: 'start-end', position: { x: 200, y: 50 } },
			{ id: 'fc4n2', name: 'Insert Card', type: 'input-output', position: { x: 200, y: 130 } },
			{ id: 'fc4n3', name: 'Enter PIN', type: 'input-output', position: { x: 200, y: 210 } },
			{ id: 'fc4n4', name: 'PIN Correct?', type: 'decision', position: { x: 200, y: 290 } },
			{ id: 'fc4n5', name: 'Enter Amount', type: 'input-output', position: { x: 200, y: 390 } },
			{ id: 'fc4n6', name: 'Balance OK?', type: 'decision', position: { x: 200, y: 470 } },
			{ id: 'fc4n7', name: 'Dispense Cash', type: 'process', position: { x: 350, y: 550 } },
			{ id: 'fc4n8', name: 'Show Error', type: 'process', position: { x: 50, y: 470 } },
			{ id: 'fc4n9', name: 'Eject Card', type: 'process', position: { x: 200, y: 630 } },
			{ id: 'fc4n10', name: 'End', type: 'start-end', position: { x: 200, y: 710 } }
		],
		flowEdges: [
			{ id: 'fc4e1', label: '', fromNodeId: 'fc4n1', toNodeId: 'fc4n2' },
			{ id: 'fc4e2', label: '', fromNodeId: 'fc4n2', toNodeId: 'fc4n3' },
			{ id: 'fc4e3', label: '', fromNodeId: 'fc4n3', toNodeId: 'fc4n4' },
			{ id: 'fc4e4', label: 'yes', fromNodeId: 'fc4n4', toNodeId: 'fc4n5', condition: 'yes' },
			{ id: 'fc4e5', label: 'no', fromNodeId: 'fc4n4', toNodeId: 'fc4n8', condition: 'no' },
			{ id: 'fc4e6', label: '', fromNodeId: 'fc4n5', toNodeId: 'fc4n6' },
			{ id: 'fc4e7', label: 'yes', fromNodeId: 'fc4n6', toNodeId: 'fc4n7', condition: 'yes' },
			{ id: 'fc4e8', label: 'no', fromNodeId: 'fc4n6', toNodeId: 'fc4n8', condition: 'no' },
			{ id: 'fc4e9', label: '', fromNodeId: 'fc4n7', toNodeId: 'fc4n9' },
			{ id: 'fc4e10', label: '', fromNodeId: 'fc4n8', toNodeId: 'fc4n9' },
			{ id: 'fc4e11', label: '', fromNodeId: 'fc4n9', toNodeId: 'fc4n10' }
		]
	}
];

export const dfdTemplates: DFDTemplate[] = [
	{
		name: 'Online Store',
		description: 'ระบบร้านค้าออนไลน์ — ลูกค้า, สั่งซื้อ, จัดส่ง',
		dfdNodes: [
			{ id: 'dfd1n1', name: 'Customer', type: 'external-entity', position: { x: 50, y: 100 } },
			{ id: 'dfd1n2', name: 'Process Order', type: 'process', processNumber: '1.0', position: { x: 250, y: 100 } },
			{ id: 'dfd1n3', name: 'Manage Inventory', type: 'process', processNumber: '2.0', position: { x: 450, y: 100 } },
			{ id: 'dfd1n4', name: 'Orders DB', type: 'data-store', position: { x: 250, y: 250 } },
			{ id: 'dfd1n5', name: 'Products DB', type: 'data-store', position: { x: 450, y: 250 } }
		],
		dfdFlows: [
			{ id: 'dfd1f1', label: 'Order Details', fromNodeId: 'dfd1n1', toNodeId: 'dfd1n2' },
			{ id: 'dfd1f2', label: 'Confirmation', fromNodeId: 'dfd1n2', toNodeId: 'dfd1n1' },
			{ id: 'dfd1f3', label: 'Order Data', fromNodeId: 'dfd1n2', toNodeId: 'dfd1n4' },
			{ id: 'dfd1f4', label: 'Stock Check', fromNodeId: 'dfd1n2', toNodeId: 'dfd1n3' },
			{ id: 'dfd1f5', label: 'Availability', fromNodeId: 'dfd1n3', toNodeId: 'dfd1n2' },
			{ id: 'dfd1f6', label: 'Product Info', fromNodeId: 'dfd1n5', toNodeId: 'dfd1n3' },
			{ id: 'dfd1f7', label: 'Update Stock', fromNodeId: 'dfd1n3', toNodeId: 'dfd1n5' }
		]
	},
	{
		name: 'Library System',
		description: 'ระบบห้องสมุด — ยืม-คืนหนังสือ',
		dfdNodes: [
			{ id: 'dfd2n1', name: 'Member', type: 'external-entity', position: { x: 50, y: 100 } },
			{ id: 'dfd2n2', name: 'Librarian', type: 'external-entity', position: { x: 50, y: 280 } },
			{ id: 'dfd2n3', name: 'Borrow Book', type: 'process', processNumber: '1.0', position: { x: 250, y: 100 } },
			{ id: 'dfd2n4', name: 'Return Book', type: 'process', processNumber: '2.0', position: { x: 250, y: 280 } },
			{ id: 'dfd2n5', name: 'Books DB', type: 'data-store', position: { x: 450, y: 100 } },
			{ id: 'dfd2n6', name: 'Loans DB', type: 'data-store', position: { x: 450, y: 280 } }
		],
		dfdFlows: [
			{ id: 'dfd2f1', label: 'Borrow Request', fromNodeId: 'dfd2n1', toNodeId: 'dfd2n3' },
			{ id: 'dfd2f2', label: 'Book Receipt', fromNodeId: 'dfd2n3', toNodeId: 'dfd2n1' },
			{ id: 'dfd2f3', label: 'Book Info', fromNodeId: 'dfd2n5', toNodeId: 'dfd2n3' },
			{ id: 'dfd2f4', label: 'Loan Record', fromNodeId: 'dfd2n3', toNodeId: 'dfd2n6' },
			{ id: 'dfd2f5', label: 'Return Book', fromNodeId: 'dfd2n1', toNodeId: 'dfd2n4' },
			{ id: 'dfd2f6', label: 'Return Receipt', fromNodeId: 'dfd2n4', toNodeId: 'dfd2n1' },
			{ id: 'dfd2f7', label: 'Update Loan', fromNodeId: 'dfd2n4', toNodeId: 'dfd2n6' },
			{ id: 'dfd2f8', label: 'Manage Books', fromNodeId: 'dfd2n2', toNodeId: 'dfd2n5' }
		]
	},
	{
		name: 'Student Enrollment',
		description: 'ระบบลงทะเบียนเรียน — นักศึกษา, วิชา',
		dfdNodes: [
			{ id: 'dfd3n1', name: 'Student', type: 'external-entity', position: { x: 50, y: 180 } },
			{ id: 'dfd3n2', name: 'Registrar', type: 'external-entity', position: { x: 550, y: 180 } },
			{ id: 'dfd3n3', name: 'Enroll Course', type: 'process', processNumber: '1.0', position: { x: 220, y: 100 } },
			{ id: 'dfd3n4', name: 'Check Prerequisites', type: 'process', processNumber: '2.0', position: { x: 380, y: 100 } },
			{ id: 'dfd3n5', name: 'Courses DB', type: 'data-store', position: { x: 220, y: 260 } },
			{ id: 'dfd3n6', name: 'Enrollments DB', type: 'data-store', position: { x: 380, y: 260 } }
		],
		dfdFlows: [
			{ id: 'dfd3f1', label: 'Enrollment Request', fromNodeId: 'dfd3n1', toNodeId: 'dfd3n3' },
			{ id: 'dfd3f2', label: 'Confirmation', fromNodeId: 'dfd3n3', toNodeId: 'dfd3n1' },
			{ id: 'dfd3f3', label: 'Course Info', fromNodeId: 'dfd3n5', toNodeId: 'dfd3n3' },
			{ id: 'dfd3f4', label: 'Check Request', fromNodeId: 'dfd3n3', toNodeId: 'dfd3n4' },
			{ id: 'dfd3f5', label: 'Check Result', fromNodeId: 'dfd3n4', toNodeId: 'dfd3n3' },
			{ id: 'dfd3f6', label: 'Enrollment Data', fromNodeId: 'dfd3n3', toNodeId: 'dfd3n6' },
			{ id: 'dfd3f7', label: 'Course Approval', fromNodeId: 'dfd3n2', toNodeId: 'dfd3n5' }
		]
	}
];
