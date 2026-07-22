# ER Diagram Builder - รายงานโปรเจค

## 1. ภาพรวมโปรเจค

**ชื่อโปรเจค:** ER Diagram Builder
**เวอร์ชัน:** 0.0.1
**ประเภท:** เว็บแอปพลิเคชัน (Full-Stack)

ER Diagram Builder เป็นเครื่องมือออกแบบไดอะแกรมบนเว็บที่ครอบคลุม เน้นการสร้าง Entity-Relationship (ER) Diagram, Flowchart และ Data Flow Diagram (DFD/Context Diagram) แอปพลิเคชันนี้ผสาน AI ผ่าน Groq LLM, ระบบทำงานร่วมกันแบบเรียลไทม์ผ่าน Y.js และ WebRTC, การซิงค์ข้อมูลบนคลาวด์ผ่าน PostgreSQL, ระบบยืนยันตัวตนผ่าน Google Sign-In และระบบสมาชิกผ่าน Stripe รองรับ 2 ภาษา (ไทย/อังกฤษ)

---

## 2. ขอบเขตโปรเจค

### 2.1 ขอบเขตงาน

โปรเจคนี้ครอบคลุมการออกแบบและพัฒนาเว็บแอปพลิเคชันสำหรับสร้างไดอะแกรมแบบโต้ตอบ โดยมีขอบเขตดังนี้:

1. **การสร้างแบบจำลองไดอะแกรม** -- รองรับ 3 ประเภทไดอะแกรม:
   - ER Diagram รองรับ 9 รูปแบบสัญลักษณ์ (Crow's Foot, Chen, UML, Min-Max, IDEF1X, Merise, Bachman, Barker, Arrow)
   - Flowchart รองรับ 13 ประเภทโหนด
   - Context Diagram (DFD Level 0) รองรับ 3 ประเภทโหนด

2. **ฟีเจอร์ AI** -- ผสาน Groq LLM สำหรับ:
   - AI Chat Assistant, วิเคราะห์ไดอะแกรม (คะแนน 0-100), นำเข้าจากข้อความ/รูปภาพ
   - สร้างโค้ด (SQL, ORM, Pseudocode), แปลภาษา (ไทย/อังกฤษ)
   - สร้างแบบทดสอบพร้อมตรวจคะแนน, คำแนะนำ, Auto-Complete
   - AI Agent อัตโนมัติสำหรับสร้างไดอะแกรมหลายขั้นตอน
   - Domain Starter (สร้าง Schema จากคำอธิบาย)

3. **การทำงานร่วมกันแบบเรียลไทม์** -- Y.js CRDT + WebRTC แบบ peer-to-peer:
   - แก้ไขร่วมกันหลายคนพร้อม remote cursors
   - ระบบห้อง, การโหวตสิทธิ์, แชทในกลุ่ม
   - โหมดนำเสนอสำหรับการสอน

4. **ซิงค์คลาวด์และยืนยันตัวตน** -- PostgreSQL backend พร้อม Google Sign-In:
   - จัดเก็บบนคลาวด์พร้อมประวัติเวอร์ชัน
   - คิวออฟไลน์ (IndexedDB) สำหรับซิงค์เมื่อไม่มีเครือข่าย
   - จัดการสมาชิกผ่าน Stripe (แผน Basic/Advanced)

5. **ส่งออกและนำเข้า** -- รองรับหลายรูปแบบ:
   - ส่งออก: SVG, PNG, PDF (รองรับหลายหน้า), JSON, `.erd`
   - นำเข้า: JSON, `.erd`, SQL DDL parsing, AI text/image import
   - แชร์ผ่าน URL แบบบีบอัด

### 2.2 สิ่งที่อยู่นอกขอบเขต

- แอปพลิเคชันมือถือแบบ Native
- เอกสารการติดตั้งแบบ Self-hosted
- การเชื่อมต่อกับระบบจัดการฐานข้อมูลภายนอก
- ระบบสตรีมเสียง/วิดีโอ WebRTC เต็มรูปแบบ (มี UI Voice Chat แต่ยังไม่ได้ implement การสตรีม)

---

## 3. วัตถุประสงค์

1. **วัตถุประสงค์หลัก:** พัฒนาเครื่องมือสร้างไดอะแกรมบนเว็บ ที่รองรับการสร้าง ER Diagram, Flowchart และ DFD ด้วยอินเทอร์เฟซแบบ Drag-and-Drop ที่ใช้งานง่าย

2. **การผสาน AI:** ใช้ Large Language Model (Groq LLM) ในการให้ความช่วยเหลืออัจฉริยะ ได้แก่ การสร้างไดอะแกรมอัตโนมัติ, การวิเคราะห์คุณภาพ, การสร้างโค้ด และฟีเจอร์แบบทดสอบเพื่อการศึกษา

3. **การทำงานร่วมกัน:** เปิดใช้งานการแก้ไขร่วมกันแบบเรียลไทม์หลายผู้ใช้ โดยใช้ CRDT (Conflict-free Replicated Data Types) เพื่อการแก้ไขพร้อมกันโดยไม่เกิดความขัดแย้ง

4. **รองรับหลายรูปแบบสัญลักษณ์:** พัฒนารูปแบบสัญลักษณ์ ER มาตรฐาน 9 แบบ เพื่อรองรับทั้งการเรียนรู้ทางวิชาการและการใช้งานในวิชาชีพ

5. **การเข้าถึงและภาษา:** รองรับอินเทอร์เฟซ 2 ภาษา (ไทย/อังกฤษ) เพื่อให้บริการผู้ใช้ที่พูดภาษาไทยในสถานศึกษา

6. **การจัดเก็บบนคลาวด์:** ให้บริการจัดเก็บไดอะแกรมบนคลาวด์พร้อมประวัติเวอร์ชัน ทำให้ผู้ใช้สามารถเข้าถึงงานจากอุปกรณ์ใดก็ได้

7. **สนับสนุนการศึกษา:** รวมฟีเจอร์สร้างแบบทดสอบ AI, วิเคราะห์ไดอะแกรมพร้อมคะแนน และโหมดนำเสนอ เพื่อสนับสนุนการเรียนการสอนแนวคิดการออกแบบฐานข้อมูล

---

## 4. เทคโนโลยีที่ใช้

### 4.1 ฝั่ง Frontend

| เทคโนโลยี | เวอร์ชัน | วัตถุประสงค์ |
|---|---|---|
| Svelte 5 | 5.55.2 | UI Framework (ใช้ Svelte 5 runes: `$state`, `$derived`, `$effect`) |
| SvelteKit | 2.57.0 | Full-stack Framework พร้อม SSR และ API routes |
| TypeScript | 6.0.2 | ภาษา JavaScript ที่มีระบบ Type |
| TailwindCSS | 4.2.2 | CSS Framework แบบ Utility-first |
| Vite | 8.0.7 | เครื่องมือ Build และ Dev Server |

### 4.2 ฝั่ง Backend / Server

| เทคโนโลยี | เวอร์ชัน | วัตถุประสงค์ |
|---|---|---|
| SvelteKit Node Adapter | 5.x | การ Deploy บน Node.js ฝั่ง Server |
| PostgreSQL (pg) | 8.16.0 | ฐานข้อมูลเชิงสัมพันธ์สำหรับผู้ใช้, ไดอะแกรม, สมาชิก |
| Groq SDK | 0.20.0 | การผสาน AI/LLM (Llama 3.3 70B, Llama 4 Scout) |
| Stripe | 22.3.1 | ระบบชำระเงินสำหรับแผนสมาชิก |

### 4.3 การทำงานร่วมกันแบบเรียลไทม์

| เทคโนโลยี | เวอร์ชัน | วัตถุประสงค์ |
|---|---|---|
| Yjs | 13.6.30 | การซิงค์ข้อมูลแบบเรียลไทม์ด้วย CRDT |
| y-webrtc | 10.3.0 | WebRTC Provider แบบ Peer-to-Peer สำหรับ Y.js |

### 4.4 Layout และการแสดงผล

| เทคโนโลยี | เวอร์ชัน | วัตถุประสงค์ |
|---|---|---|
| ELK.js | 0.11.1 | Eclipse Layout Kernel สำหรับจัดวาง Graph อัตโนมัติ |
| jsPDF | 4.2.1 | สร้างและส่งออกเอกสาร PDF |
| canvas-confetti | 1.9.4 | แอนิเมชันฉลองเมื่อทำแบบทดสอบเสร็จ |

### 4.5 การยืนยันตัวตนและความปลอดภัย

| เทคโนโลยี | วัตถุประสงค์ |
|---|---|
| Google Identity Services (GIS) | เข้าสู่ระบบด้วย Google แบบ OAuth |
| JWT ID Token | การยืนยันตัวตนฝั่ง Server |
| Content Security Policy | ป้องกัน XSS และการโจมตีแบบ Injection |

### 4.6 เครื่องมือพัฒนา

| เทคโนโลยี | เวอร์ชัน | วัตถุประสงค์ |
|---|---|---|
| Vitest | 4.1.5 | เฟรมเวิร์คทดสอบหน่วย |
| ESLint | - | ตรวจสอบคุณภาพโค้ด |
| Prettier | - | จัดรูปแบบโค้ด |
| svelte-check | - | ตรวจสอบ Type ของ Svelte |

### 4.7 Progressive Web App (PWA)

| เทคโนโลยี | วัตถุประสงค์ |
|---|---|
| Service Worker | แคชออฟไลน์ (cache-first สำหรับ assets, network-first สำหรับหน้าเว็บ) |
| IndexedDB | คิวออฟไลน์สำหรับการซิงค์ |
| localStorage | บันทึกอัตโนมัติและจัดเก็บ session |

---

## 5. อัลกอริทึม

### 5.1 อัลกอริทึมจัดวาง Graph

#### 5.1.1 ELK.js Layered Layout (อัลกอริทึม Sugiyama)

**ไฟล์:** `src/lib/utils/elk-layout.ts`

ใช้อัลกอริทึม "layered" ของ Eclipse Layout Kernel ที่อิงตามกรอบงาน Sugiyama:

1. **Cycle Removal** -- กำจัดวงจรในกราฟมีทิศทาง
2. **Layer Assignment** -- กำหนดโหนดให้อยู่ในชั้นแนวนอน/แนวตั้ง
3. **Crossing Minimization** -- ลดจำนวนเส้นตัดกันโดยใช้ LAYER_SWEEP heuristic
4. **Node Placement** -- จัดตำแหน่งโหนดภายในชั้นด้วยกลยุทธ์: NETWORK_SIMPLEX, BRANDES_KOEPF, LINEAR_SEGMENTS
5. **Edge Routing** -- เส้นเชื่อมแบบ ORTHOGONAL (หักมุม 90 องศา)

อัลกอริทึมจะหมุนเวียน 4 ทิศทาง (ลง, ขวา, ซ้าย, ขึ้น) และ 3 กลยุทธ์การจัดวางในแต่ละครั้ง พร้อมสลับลำดับโหนดเพื่อความหลากหลาย

#### 5.1.2 Force-Directed Layout (แบบจำลอง Spring-Mass)

**ไฟล์:** `src/lib/utils/physics-simulation.ts`

จำลองฟิสิกส์แบบ spring-mass:

- **แรงผลัก Coulomb:** Entity ทุกคู่ผลักกันด้วยแรงที่เป็นสัดส่วนกับ `constant / distance^2` (ค่าคงที่ = 5000)
- **สปริงตามกฎ Hooke:** Entity ที่เชื่อมกันดึงดูดด้วยแรง `k * (distance - restLength)` (k = 0.005, restLength = 200)
- **การอัปเดตความเร็ว:** ตำแหน่งอัปเดตตามความเร็วทุกเฟรมพร้อมค่าหน่วง (0.85)
- **การบรรจบ:** การจำลองหยุดเมื่อความเร็วสูงสุดลดลงต่ำกว่าเกณฑ์ (0.5)

#### 5.1.3 การจัดวางด้วย AI

**ไฟล์:** `src/lib/utils/ai-layout.ts`

1. ส่งข้อมูล entity/relationship ไปยัง Groq LLM ผ่าน API
2. LLM ส่งคืนพิกัดตำแหน่งที่คำนวณแล้ว
3. การแก้ไขการซ้อนทับหลังประมวลผล: อัลกอริทึมแบบ iterative 40 รอบ ที่ผลักสิ่งที่ซ้อนทับออกจากกันตามแกนที่มีการซ้อนทับน้อยที่สุด
4. ใช้ ELK.js เป็นทางเลือกสำรองหาก AI ไม่พร้อมใช้งาน (timeout 10 วินาที)

#### 5.1.4 อัลกอริทึมจัดวาง Flowchart

**ไฟล์:** `src/lib/utils/flowchart-layouts.ts`

- **Hierarchical (TB/LR):** กำหนดระดับด้วย BFS จากโหนดเริ่มต้น จัดตำแหน่งกึ่งกลางในแต่ละระดับ
- **Grid:** จัดเป็นตารางตามรากที่สองของจำนวนโหนด
- **Circular:** จัดโหนดเป็นวงกลม รัศมีปรับตามจำนวนโหนด
- **Force-Directed:** จำลอง 100 รอบด้วยแรงผลักและแรงดึงดูด

### 5.2 อัลกอริทึมการเดินเส้น (Routing)

#### 5.2.1 Orthogonal Edge Routing

**ไฟล์:** `src/lib/components/diagram/FlowEdgeLine.svelte`

คำนวณเส้นทาง orthogonal 4 จุด (หักมุม 90 องศา) สำหรับเส้นเชื่อม flowchart:

1. กำหนดด้านออก (บน/ล่าง/ซ้าย/ขวา) ตามตำแหน่งสัมพันธ์ของโหนด
2. คำนวณตำแหน่ง port บนขอบโหนด
3. สร้าง waypoint ตรงกลางสำหรับเส้นทาง orthogonal
4. รองรับการลาก segment แบบ draw.io (จำกัดแกนเดียว)

#### 5.2.2 DFD Flow Routing

**ไฟล์:** `src/lib/components/diagram/DiagramCanvas.svelte` (`getDFDFlowRoute`)

เส้นทาง orthogonal 4 จุดพร้อม:
- การคำนวณทิศทางธรรมชาติตามประเภทโหนดและตำแหน่งสัมพันธ์
- segment กลางที่ผู้ใช้ควบคุมได้ผ่าน waypoint เดียว (ตำแหน่ง corridor)
- การจัดการพิเศษสำหรับทิศทางออกเดียวกัน (GAP = 30px)

### 5.3 อัลกอริทึมเรขาคณิต

**ไฟล์:** `src/lib/utils/geometry.ts`

- **การคำนวณสี่เหลี่ยม Entity:** ปรับขนาดอัตโนมัติตามจำนวน attribute และความยาวชื่อ
- **การหาจุดเชื่อมต่อที่ใกล้ที่สุด:** เปรียบเทียบ O(16) ของจุดเชื่อมต่อ 4 จุดต่อ entity (กึ่งกลางด้านบน, ขวา, ล่าง, ซ้าย)
- **การสร้างเส้นทาง Orthogonal:** สร้าง SVG path พร้อมจุดหักมุมตรงกลาง

### 5.4 การบีบอัดข้อมูล

**ไฟล์:** `src/lib/utils/share.ts`

- **Deflate Compression:** ใช้ browser `CompressionStream` API บีบอัด JSON ของไดอะแกรม
- **Base64 Encoding:** เข้ารหัสข้อมูลที่บีบอัดสำหรับส่งผ่าน URL
- **ขีดจำกัดขนาด:** เข้ารหัสสูงสุด 500KB, คลายบีบอัดสูงสุด 2MB

### 5.5 SQL DDL Parsing

**ไฟล์:** `src/lib/utils/sql-parser.ts`

- Parser แบบ Regex สำหรับคำสั่ง `CREATE TABLE`
- แยก comma โดยคำนึงถึงความลึกของวงเล็บสำหรับ type definition ที่ซ้อนกัน
- ดึงข้อมูล column, primary key (inline และ composite), foreign key
- ตรวจจับ junction table: ตารางที่มี FK column 2 ตัวขึ้นไปซ้อนทับกับ PK column 2 ตัวขึ้นไป

### 5.6 อัลกอริทึม Rate Limiting

**ไฟล์:** `src/lib/server/rate-limit.ts`

- ใช้ PostgreSQL `INSERT ON CONFLICT DO UPDATE` แบบ atomic (หลีกเลี่ยง TOCTOU race conditions)
- หน้าต่างเวลาแบบ sliding window 1 นาที
- ใช้ `Map` ในหน่วยความจำเป็นทางเลือกสำรองเมื่อฐานข้อมูลไม่พร้อม
- ขีดจำกัด: ไม่ระบุตัวตน 15 req/min, ระบุตัวตน 40 req/min

### 5.7 อัลกอริทึม PDF Tiling

**ไฟล์:** `src/lib/utils/export.ts`

- คำนวณอัตราส่วนการย่อ/ขยายที่เหมาะสมตามโหมด (auto/readable/custom)
- โหมด "Readable": หาอัตราส่วนต่ำสุดที่ทำให้ข้อความอ่านได้ขณะลดจำนวนหน้าให้น้อยที่สุด
- แบ่งไดอะแกรมออกเป็นหลายหน้าพร้อม header/footer
- Snap-down heuristic: ลดจำนวนหน้าหากการลดอัตราส่วน 30% สามารถตัดแถว/คอลัมน์ tile ได้

### 5.8 การซิงค์ CRDT (Y.js)

**ไฟล์:** `src/lib/stores/collab.svelte.ts`

- ใช้ Conflict-free Replicated Data Types สำหรับการแก้ไขพร้อมกัน
- ใช้หลัก last-writer-wins สำหรับการแก้ไขที่ขัดแย้งกันระดับ field
- แลกเปลี่ยนข้อมูลแบบ WebRTC peer-to-peer (ไม่ต้องการ server กลางสำหรับซิงค์เรียลไทม์)
- Awareness protocol สำหรับตำแหน่งเคอร์เซอร์และการแสดงตนของผู้ใช้

### 5.9 การให้คะแนนวิเคราะห์ AI

**ไฟล์:** `src/lib/server/analysis-rules.ts`

ระบบวิเคราะห์ตามกฎ (rule-based) มี 3 ระดับความรุนแรง (ERROR, WARNING, SUGGESTION):

- **ER Diagram:** 10 กฎ (การมี PK, การตั้งชื่อ, cardinality, referential integrity, normalization, ความครบถ้วน, ประเภทข้อมูล, ความซ้ำซ้อน, weak entity, business logic)
- **Flowchart:** 10 กฎ (โหนดเริ่ม/จบ, การเชื่อมต่อ, ตรรกะ decision, วงวนไม่สิ้นสุด, การตั้งชื่อ, ป้ายกำกับเส้น, ความซับซ้อน, I/O, สมดุลของ flow)
- **DFD:** 12 กฎ (หมายเลข process, สมดุลของ flow, กฎ external entity, กฎ data store, การตั้งชื่อ, ความครบถ้วน, ความซ้ำซ้อน, การแยกส่วน, flow สองทิศทาง)

การให้คะแนน: สเกล 0-100 พร้อมการหักคะแนนตามน้ำหนักของแต่ละระดับความรุนแรง

---

## 6. สถาปัตยกรรมระบบ

```
+-------------------+     +-------------------+     +-------------------+
|                   |     |                   |     |                   |
|  เบราว์เซอร์ (PWA) |<--->| SvelteKit Node    |<--->|   PostgreSQL      |
|                   |     |  Server           |     |   ฐานข้อมูล        |
|  - Svelte 5 UI    |     |  - API Routes     |     |  - users          |
|  - Service Worker |     |  - Auth Verify    |     |  - diagrams       |
|  - IndexedDB      |     |  - Rate Limit     |     |  - subscriptions  |
|  - Y.js (CRDT)    |     |  - Sync Logic     |     |  - rate_limits    |
|                   |     |                   |     |  - versions       |
+--------+----------+     +--------+----------+     +-------------------+
         |                          |
         |  WebRTC (P2P)            |  HTTPS
         |                          |
+--------+----------+     +--------+----------+
|                   |     |                   |
| เบราว์เซอร์อื่น    |     |   Groq Cloud API  |
| (ทำงานร่วมกัน)     |     |   (บริการ LLM)     |
|                   |     |                   |
+-------------------+     +-------------------+

                          +-------------------+
                          |                   |
                          |   Stripe API      |
                          |   (ชำระเงิน)       |
                          |                   |
                          +-------------------+
```

---

## 7. โครงสร้างฐานข้อมูล

| ตาราง | Primary Key | วัตถุประสงค์ |
|---|---|---|
| `users` | `sub` (Google) | บัญชีผู้ใช้พร้อมข้อมูลแผนและ Stripe customer ID |
| `diagrams` | `user_sub` + `id` | จัดเก็บไดอะแกรมเป็น JSONB พร้อม timestamp |
| `user_state` | `user_sub` | ID ไดอะแกรมที่ใช้งานอยู่และตัวนับเวอร์ชันต่อผู้ใช้ |
| `rate_limits` | `key` | รายการจำกัดอัตราการร้องขอพร้อมจำนวนและเวลาหมดอายุ |
| `diagram_versions` | `id` (SERIAL) | สแนปช็อตประวัติเวอร์ชันที่อ้างอิงไดอะแกรม |
| `subscriptions` | `id` | บันทึกการสมัครสมาชิก Stripe |

---

## 8. สรุป API Endpoints

### AI Endpoints (17 endpoints, ต้องใช้แผน Advanced)

| Endpoint | คำอธิบาย |
|---|---|
| `POST /api/chat` | ผู้ช่วย AI แชท |
| `POST /api/chat-action` | AI แชทพร้อมการแก้ไขไดอะแกรม |
| `POST /api/analyze` | วิเคราะห์คุณภาพไดอะแกรม (คะแนน 0-100) |
| `POST /api/import` | นำเข้าจากข้อความ/รูปภาพ |
| `GET /api/import/check` | ตรวจสอบความพร้อมของ AI Import |
| `POST /api/generate-code` | สร้างโค้ดจากไดอะแกรม |
| `POST /api/translate` | แปลชื่อในไดอะแกรม |
| `POST /api/layout` | จัดวางตำแหน่งด้วย AI |
| `POST /api/fix` | แก้ไขปัญหาไดอะแกรมอัตโนมัติ |
| `POST /api/suggest-improvement` | คำแนะนำการปรับปรุง |
| `POST /api/suggest-name` | แนะนำชื่อ |
| `POST /api/domain-starter` | สร้างไดอะแกรมจากโดเมน |
| `POST /api/quiz` | สร้างคำถามแบบทดสอบ |
| `POST /api/quiz/grade` | ตรวจคะแนนแบบทดสอบ |
| `POST /api/agent/plan` | AI Agent วางแผน |
| `POST /api/agent/execute-step` | AI Agent ดำเนินการขั้นตอน |
| `POST /api/agent/auto-complete` | คำแนะนำ Auto-complete |

### Sync Endpoints (7 endpoints, ต้องยืนยันตัวตน)

| Endpoint | คำอธิบาย |
|---|---|
| `GET /api/sync/diagrams` | แสดงรายการไดอะแกรมบนคลาวด์ของผู้ใช้ |
| `POST /api/sync/push` | อัปโหลดไดอะแกรมไปยังคลาวด์ |
| `POST /api/sync/pull` | ดาวน์โหลดไดอะแกรมจากคลาวด์ |
| `GET /api/sync/version` | ตรวจสอบเวอร์ชันแบบเบา |
| `DELETE /api/sync/diagram/[id]` | ลบไดอะแกรมบนคลาวด์ |
| `GET /api/sync/diagram/[id]/versions` | แสดงประวัติเวอร์ชัน |
| `GET/POST /api/sync/diagram/[id]/versions/[vid]` | ดู/กู้คืนเวอร์ชัน |

### การชำระเงินและผู้ดูแลระบบ (6 endpoints)

| Endpoint | คำอธิบาย |
|---|---|
| `POST /api/stripe/checkout` | สร้าง Stripe checkout session |
| `POST /api/stripe/portal` | เข้าสู่หน้าจัดการสมาชิก |
| `POST /api/stripe/webhook` | ตัวจัดการ Stripe webhook |
| `GET /api/user/plan` | ดูข้อมูลแผนผู้ใช้ |
| `POST /api/admin/set-plan` | ผู้ดูแลระบบกำหนดแผนผู้ใช้ |
| `GET /api/health` | ตรวจสอบสถานะระบบ |

---

## 9. มาตรการรักษาความปลอดภัย

1. **CORS Enforcement** -- จำกัด API ให้เข้าถึงจาก same-origin และ trusted origins เท่านั้น
2. **Content Security Policy (CSP)** -- CSP แบบเข้มงวดพร้อม allowlist สำหรับบริการ Google
3. **Security Headers** -- HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP
4. **ป้องกัน Prompt Injection** -- ครอบ input ผู้ใช้ด้วย fencing tags (`<user_message>`, `<user_input>`)
5. **Rate Limiting** -- ใช้ PostgreSQL UPSERT แบบ atomic พร้อมทางเลือกสำรองในหน่วยความจำ
6. **ตรวจสอบ Input** -- จำกัดขนาด body (1MB), จำนวน entity, ขนาดไฟล์
7. **จัดการ Token** -- รีเฟรชอัตโนมัติพร้อมเวลาสำรอง 5 นาทีก่อนหมดอายุ
8. **ตรวจสอบการนำเข้า** -- สูงสุด 500 entity, 1000 relationship, ไฟล์ขนาดสูงสุด 10MB
9. **จำกัดขนาด Share URL** -- เข้ารหัสสูงสุด 500KB, คลายบีบอัดสูงสุด 2MB

---

## 10. สรุปฟีเจอร์หลัก

| ฟีเจอร์ | คำอธิบาย |
|---|---|
| 3 ประเภทไดอะแกรม | ER Diagram, Flowchart, Context Diagram (DFD) |
| 9 รูปแบบสัญลักษณ์ ER | Crow's Foot, Chen, UML, Min-Max, IDEF1X, Merise, Bachman, Barker, Arrow |
| 13 ประเภทโหนด Flowchart | Start/End, Process, Decision, I/O, Connector, Document, Database ฯลฯ |
| ผู้ช่วย AI | Chat, วิเคราะห์, นำเข้า, สร้างโค้ด, แปลภาษา, แบบทดสอบ, Agent, Auto-Complete |
| ทำงานร่วมกันเรียลไทม์ | Y.js CRDT + WebRTC P2P พร้อม live cursors และการโหวตสิทธิ์ |
| ซิงค์คลาวด์ | PostgreSQL พร้อมประวัติเวอร์ชันและคิวออฟไลน์ |
| รูปแบบส่งออก | SVG, PNG, PDF (หลายหน้า), JSON, .erd |
| ยืนยันตัวตน | Google Sign-In พร้อมการตรวจสอบ JWT |
| ระบบสมาชิก | แผน Basic/Advanced ผ่าน Stripe |
| PWA | Service Worker พร้อมแคชออฟไลน์ |
| 2 ภาษา | อินเทอร์เฟซภาษาไทยและอังกฤษ |
