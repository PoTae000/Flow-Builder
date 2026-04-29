import type { Entity, Relationship } from '$lib/types/er';

export interface DiagramTemplate {
	name: string;
	description: string;
	entities: Entity[];
	relationships: Relationship[];
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
