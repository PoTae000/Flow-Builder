# การเปรียบเทียบกับเครื่องมือแข่งขัน (Competitor Comparison)

## ภาพรวมระบบของเรา: ER Diagram Builder

| คุณสมบัติ | รายละเอียด |
|-----------|------------|
| ประเภทแผนภาพ | ER Diagram (8 notations), Flowchart (12 node types), DFD |
| AI | Groq LLM — วิเคราะห์, แนะนำ, แชท, สร้างโค้ด, Import จากรูปภาพ/ข้อความ |
| Collaboration | Y.js CRDT + WebRTC (Real-time, ไม่ผ่านเซิร์ฟเวอร์กลาง) |
| ราคา | ฟรี (ระบบ Collab ฟรี) |
| Import/Export | รูปภาพ, ข้อความ, SQL, JSON — Export เป็น PNG/SVG/JSON/SQL |
| Notation | Chen, Crow's Foot, UML, Barker, Arrow, IDEF1X, Bachman, Min-Max, Merise |
| Layout | AI-powered auto layout + manual drag |
| Quiz | ระบบทดสอบความรู้ ER Diagram |
| Code Generation | สร้าง SQL, TypeScript, Python, Java, C#, Go, Rust, Prisma, Django |

---

## 1. Lucidchart

| หัวข้อ | Lucidchart | ER Diagram Builder (ของเรา) |
|--------|-----------|---------------------------|
| **ราคา** | เริ่มต้น $7.95/เดือน (Individual), $9/เดือน (Team) | **ฟรี** |
| **ประเภทแผนภาพ** | หลากหลาย (Flowchart, UML, ER, Network, etc.) | ER Diagram, Flowchart, DFD |
| **AI** | Lucidchart AI — สร้างแผนภาพอัตโนมัติ, สรุปข้อมูล | Groq LLM — วิเคราะห์, แนะนำ, Import จากรูปภาพ |
| **Collaboration** | Real-time (ผ่าน Cloud, ต้องสมัครแพ็กเกจ Team) | Real-time (Y.js P2P, **ฟรีไม่จำกัด**) |
| **Import** | Visio, CSV, Omnigraffle | รูปภาพ, ข้อความ, SQL, JSON |
| **Export** | PNG, PDF, SVG, Visio | PNG, SVG, JSON, SQL, Code (7+ ภาษา) |
| **Notation** | Crow's Foot, Chen (จำกัด) | **8 notations** (Chen, Crow's Foot, UML, Barker, Arrow, IDEF1X, Bachman, Min-Max, Merise) |

### สิ่งที่มีเหมือนกัน
- ระบบ AI ช่วยสร้างและวิเคราะห์แผนภาพ
- ระบบ Collaboration แบบ Real-time
- รองรับ ER Diagram และ Flowchart
- Export เป็นรูปภาพ (PNG, SVG)

### สิ่งที่ของเราดีกว่า
- **Collaboration ฟรี** — Lucidchart ต้องสมัครแพ็กเกจ Team ($9/เดือน/คน) ถึงจะใช้ Collab ได้เต็มรูปแบบ ของเราฟรีทั้งหมด
- **ระบบ Import/Export** — ของเรารองรับ Import จากรูปภาพ (AI อ่าน ER Diagram จากภาพถ่าย), Import จาก SQL, Export เป็นโค้ด 7+ ภาษา ซึ่ง Lucidchart ไม่มี
- **Notation หลากหลายกว่า** — 8 notations vs Lucidchart ที่มีแค่ Crow's Foot เป็นหลัก
- **Code Generation** — สร้างโค้ดจาก ER Diagram ได้ทันที (SQL, TypeScript, Python, etc.)
- **ไม่ต้องสมัครสมาชิก** — ใช้งานได้ทันทีโดยไม่ต้องล็อกอิน

### สิ่งที่ Lucidchart ดีกว่า
- รองรับแผนภาพหลากหลายประเภทมากกว่า (Network, Org Chart, Wireframe, etc.)
- มี Template สำเร็จรูปจำนวนมาก
- Integration กับ Google Workspace, Microsoft 365, Atlassian, Slack
- มีระบบ Data Linking จากแหล่งข้อมูลภายนอก

---

## 2. dbdiagram.io

| หัวข้อ | dbdiagram.io | ER Diagram Builder (ของเรา) |
|--------|-------------|---------------------------|
| **ราคา** | ฟรี (จำกัด 10 diagrams), Pro $14/เดือน | **ฟรีไม่จำกัด** |
| **ประเภทแผนภาพ** | ER Diagram เท่านั้น | ER Diagram, Flowchart, DFD |
| **AI** | ไม่มี AI | Groq LLM — วิเคราะห์, แนะนำ, Import จากรูปภาพ |
| **Collaboration** | แชร์ link (ไม่ใช่ Real-time) | **Real-time P2P Collaboration** |
| **Import** | SQL, DBML | รูปภาพ, ข้อความ, SQL, JSON |
| **Export** | PNG, PDF, SQL, DBML | PNG, SVG, JSON, SQL, Code (7+ ภาษา) |
| **วิธีสร้าง** | เขียนโค้ด DBML | GUI ลากวาง + AI + Import |
| **Layout** | Auto layout อัตโนมัติ | **AI-powered layout** + manual drag |

### สิ่งที่มีเหมือนกัน
- แปลง SQL เป็น ER Diagram ได้
- Export เป็น SQL ได้
- เน้นการออกแบบฐานข้อมูล

### สิ่งที่ของเราดีกว่า
- **ระบบ Collaboration** — dbdiagram.io ไม่มี Real-time collab ของเราทำงานร่วมกันได้แบบ Real-time ผ่าน WebRTC
- **ระบบการจัดวาง Layout** — ของเรามี AI-powered auto layout ที่จัดวางอัตโนมัติตาม pattern ที่เหมาะสม dbdiagram.io ใช้ auto layout พื้นฐาน
- **ระบบ AI** — ของเรามี AI วิเคราะห์, แนะนำการปรับปรุง, Import จากรูปภาพ dbdiagram.io ไม่มี AI
- **GUI ลากวาง** — ของเราใช้ GUI แบบ drag-and-drop สร้าง entity ได้ง่าย dbdiagram.io ต้องเขียนโค้ด DBML
- **Code Generation** — สร้างโค้ดได้ 7+ ภาษา ไม่ใช่แค่ SQL
- **หลาย Notation** — 8 notations vs dbdiagram.io ที่มีแค่แบบเดียว

### สิ่งที่ dbdiagram.io ดีกว่า
- DBML language เป็นมาตรฐานที่ใช้กันแพร่หลาย
- ใช้งานง่ายสำหรับ developer ที่ชอบเขียนโค้ดมากกว่าลากวาง
- มี Version history ใน Pro plan

---

## 3. Miro

| หัวข้อ | Miro | ER Diagram Builder (ของเรา) |
|--------|------|---------------------------|
| **ราคา** | ฟรี (3 boards), Business $12-20/เดือน/คน | **ฟรีไม่จำกัด** |
| **ประเภท** | Whiteboard อเนกประสงค์ | เครื่องมือเฉพาะทาง ER/Flowchart/DFD |
| **AI** | Miro AI — สรุป, จัดกลุ่ม sticky notes, สร้าง mind map | Groq LLM — วิเคราะห์ ER, แนะนำ, สร้างโค้ด |
| **Collaboration** | Real-time (ผ่าน Cloud) | Real-time (Y.js P2P, ฟรี) |
| **ER Diagram** | ต้องวาดเอง (ไม่มี template เฉพาะ) | **เครื่องมือเฉพาะทาง** พร้อม entity/relationship management |
| **Export** | PNG, PDF, SVG | PNG, SVG, JSON, SQL, Code |

### สิ่งที่มีเหมือนกัน
- ระบบ Collaboration แบบ Real-time
- ระบบ AI ช่วยเหลือ
- มี Flowchart

### สิ่งที่ของเราดีกว่า
- **เฉพาะทาง ER Diagram** — Miro เป็น whiteboard ทั่วไป ไม่มีเครื่องมือเฉพาะสำหรับ ER Diagram (ต้องวาดเอง) ของเรามีระบบจัดการ Entity, Attribute, Relationship โดยเฉพาะ
- **Notation ที่ถูกต้อง** — ของเราวาด ER Diagram ตาม notation มาตรฐาน 8 แบบ Miro วาดได้แค่รูปทรงพื้นฐาน
- **SQL Import/Export** — ของเราแปลง SQL ↔ ER Diagram ได้ Miro ไม่มี
- **Code Generation** — สร้างโค้ดจาก diagram ได้ทันที
- **AI วิเคราะห์ ER** — AI ของเราเข้าใจโครงสร้าง ER Diagram เฉพาะทาง แนะนำการ normalize, ตรวจสอบ cardinality
- **ฟรีไม่จำกัด** — Miro ฟรีแค่ 3 boards

### สิ่งที่ Miro ดีกว่า
- Whiteboard อเนกประสงค์ — ใช้ได้หลายงาน (brainstorm, planning, retrospective, etc.)
- Integration มากมาย (Jira, Slack, Google, Microsoft, etc.)
- Video chat ในตัว
- มี Template หลายร้อยแบบ
- Presentation mode

---

## 4. draw.io (diagrams.net)

| หัวข้อ | draw.io | ER Diagram Builder (ของเรา) |
|--------|---------|---------------------------|
| **ราคา** | ฟรี (Open source) | ฟรี |
| **ประเภทแผนภาพ** | หลากหลายมาก (UML, ER, Network, Floor plan, etc.) | ER Diagram, Flowchart, DFD |
| **AI** | ไม่มี AI | **Groq LLM — วิเคราะห์, แนะนำ, Import จากรูปภาพ** |
| **Collaboration** | ผ่าน Google Drive/OneDrive (ไม่ใช่ Real-time โดยตรง) | **Real-time P2P** |
| **Import** | XML, Visio, CSV, Gliffy | รูปภาพ, ข้อความ, SQL, JSON |
| **Export** | PNG, SVG, PDF, XML, Visio | PNG, SVG, JSON, SQL, Code |

### สิ่งที่มีเหมือนกัน
- ฟรีทั้งคู่
- มี Flowchart
- มี ER Diagram
- ลากวาง drag-and-drop

### สิ่งที่ของเราดีกว่า
- **ระบบ AI** — draw.io ไม่มี AI เลย ของเรามี AI วิเคราะห์, แนะนำ, Import จากรูปภาพ, สร้างโค้ด
- **Real-time Collaboration** — draw.io collab ต้องผ่าน Google Drive/OneDrive (save-based ไม่ใช่ real-time) ของเราเป็น P2P real-time
- **SQL Import/Export** — ของเราแปลง SQL ↔ ER Diagram ได้ draw.io ไม่มี
- **Code Generation** — สร้างโค้ดจาก ER Diagram ได้ 7+ ภาษา
- **Notation หลากหลาย** — 8 ER notations ที่สลับได้ทันที
- **Quiz System** — ระบบทดสอบความรู้สำหรับการเรียนการสอน

### สิ่งที่ draw.io ดีกว่า
- รองรับแผนภาพหลากหลายมาก (Network, Floor plan, Mockup, etc.)
- Open source — ปรับแต่งได้อิสระ
- ทำงาน Offline ได้ (Desktop app)
- Integration กับ Confluence, Jira, Google Drive, OneDrive
- Shape library ขนาดใหญ่

---

## 5. Eraser.io

| หัวข้อ | Eraser.io | ER Diagram Builder (ของเรา) |
|--------|-----------|---------------------------|
| **ราคา** | ฟรี (จำกัด), Pro $12/เดือน/คน | **ฟรีไม่จำกัด** |
| **ประเภท** | Diagram + Docs (code-first) | ER Diagram, Flowchart, DFD (GUI-first) |
| **AI** | AI diagram generation จาก prompt | Groq LLM — วิเคราะห์, แนะนำ, Import จากรูปภาพ |
| **Collaboration** | Real-time (ผ่าน Cloud) | Real-time (P2P, ฟรี) |
| **วิธีสร้าง** | เขียน code (DSL) + AI generate | GUI ลากวาง + AI |

### สิ่งที่มีเหมือนกัน
- ระบบ AI สร้างแผนภาพ
- รองรับ ER Diagram
- Collaboration

### สิ่งที่ของเราดีกว่า
- **GUI ลากวาง** — Eraser.io เน้น code-first (ต้องเขียน DSL) ของเราใช้ GUI สะดวกกว่า
- **Notation หลากหลาย** — 8 ER notations vs Eraser ที่มีแบบเดียว
- **SQL Import** — แปลง SQL เป็น ER Diagram ได้
- **Collaboration ฟรี** — Eraser Pro เสียเงิน
- **Code Generation** — Export เป็นโค้ด 7+ ภาษา

### สิ่งที่ Eraser.io ดีกว่า
- Documentation รวมกับ Diagram ได้ในที่เดียว
- AI generate diagram จาก prompt ภาษาธรรมชาติ
- สวยงาม minimal design

---

## 6. Visual Paradigm

| หัวข้อ | Visual Paradigm | ER Diagram Builder (ของเรา) |
|--------|----------------|---------------------------|
| **ราคา** | Community (ฟรี, จำกัดมาก), Standard $6/เดือน, Professional $19/เดือน, Enterprise $89/เดือน | **ฟรีไม่จำกัด** |
| **ประเภท** | UML, ER, BPMN, SysML, etc. (Enterprise-grade) | ER Diagram, Flowchart, DFD |
| **AI** | AI assistant (แพ็กเกจสูง) | Groq LLM (ฟรี) |
| **Collaboration** | Team collaboration (แพ็กเกจ Enterprise) | **Real-time P2P (ฟรี)** |
| **Code Generation** | Java, C++, C#, SQL | SQL, TypeScript, Python, Java, C#, Go, Rust, Prisma, Django |

### สิ่งที่มีเหมือนกัน
- ER Diagram พร้อม notation มาตรฐาน
- Code generation จาก diagram
- รองรับ SQL

### สิ่งที่ของเราดีกว่า
- **ฟรีทั้งหมด** — Visual Paradigm ราคาแพง (Enterprise $89/เดือน)
- **Real-time Collaboration ฟรี** — VP ต้องใช้ Enterprise plan
- **ใช้งานง่าย** — VP ซับซ้อน เรียนรู้ยาก ของเราใช้งานง่ายผ่าน web browser
- **AI Import จากรูปภาพ** — ถ่ายรูป ER Diagram แล้ว AI แปลงให้เป็น digital
- **Code Generation หลากหลายกว่า** — 7+ ภาษา vs VP ที่เน้น Java/C++

### สิ่งที่ Visual Paradigm ดีกว่า
- Enterprise-grade tool ครบวงจร
- รองรับ UML ทุกประเภท (14 diagram types)
- BPMN, SysML, ArchiMate
- Reverse engineering จาก source code
- Database modeling ขั้นสูง (forward/reverse engineering)

---

## ตารางสรุปเปรียบเทียบ

| คุณสมบัติ | ของเรา | Lucidchart | dbdiagram.io | Miro | draw.io | Eraser.io | Visual Paradigm |
|-----------|--------|------------|-------------|------|---------|-----------|-----------------|
| **ราคา** | ฟรี | $7.95+/เดือน | ฟรี/$14/เดือน | ฟรี/$12+/เดือน | ฟรี | ฟรี/$12/เดือน | ฟรี/$6-89/เดือน |
| **AI วิเคราะห์** | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ (แพง) |
| **AI Import รูปภาพ** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Real-time Collab** | ✅ ฟรี | ✅ เสียเงิน | ❌ | ✅ เสียเงิน | ❌ | ✅ เสียเงิน | ✅ เสียเงิน |
| **ER Notation (จำนวน)** | 8 | 2 | 1 | 0 | 2 | 1 | 3+ |
| **SQL Import** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Code Generation** | 7+ ภาษา | ❌ | ❌ | ❌ | ❌ | ❌ | 3 ภาษา |
| **Flowchart** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **DFD** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Quiz System** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Offline** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |

---

## จุดเด่นที่ไม่มีใครมี (Unique Selling Points)

1. **AI Import จากรูปภาพ** — ถ่ายรูป ER Diagram ที่วาดบนกระดาษ แล้ว AI แปลงเป็น digital diagram อัตโนมัติ ไม่มีคู่แข่งรายใดมีฟีเจอร์นี้
2. **8 ER Notations สลับได้ทันที** — รองรับ notation มากที่สุดในตลาด (Chen, Crow's Foot, UML, Barker, Arrow, IDEF1X, Bachman, Min-Max, Merise) สลับได้ real-time โดยไม่ต้องวาดใหม่
3. **Code Generation 7+ ภาษา** — สร้าง SQL, TypeScript, Python, Java, C#, Go, Rust, Prisma, Django จาก ER Diagram ได้ทันที
4. **Real-time Collaboration ฟรี** — ใช้ Y.js + WebRTC เป็น P2P ไม่ต้องพึ่งเซิร์ฟเวอร์กลาง ทำให้ฟรีได้โดยไม่มีค่าใช้จ่ายเซิร์ฟเวอร์
5. **Quiz System** — ระบบทดสอบความรู้ ER Diagram สำหรับการเรียนการสอน ไม่มีเครื่องมือใดในตลาดที่มีฟีเจอร์นี้
6. **3-in-1** — รองรับทั้ง ER Diagram, Flowchart, DFD ในเครื่องมือเดียว พร้อม AI ช่วยเหลือทุกประเภท
