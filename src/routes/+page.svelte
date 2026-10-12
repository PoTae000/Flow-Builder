<script lang="ts">
	import { shortcutCode } from '$lib/utils/keyboard';
	import { onMount, tick } from 'svelte';
	import { PUBLIC_SIGNALING_URL } from '$env/static/public';
	import FormPanel from '$lib/components/form/FormPanel.svelte';
	import DiagramCanvas from '$lib/components/diagram/DiagramCanvas.svelte';
	import Toolbar from '$lib/components/ui/Toolbar.svelte';
	import DiagramTabs from '$lib/components/ui/DiagramTabs.svelte';
	import WelcomeChooser from '$lib/components/ui/WelcomeChooser.svelte';
	import LoginScreen from '$lib/components/ui/LoginScreen.svelte';
	import RelationshipForm from '$lib/components/form/RelationshipForm.svelte';
	import CollabPanel from '$lib/components/ui/CollabPanel.svelte';
	import PermissionVoteModal from '$lib/components/ui/PermissionVoteModal.svelte';
	import DialogModal from '$lib/components/ui/DialogModal.svelte';
	import Minimap from '$lib/components/diagram/Minimap.svelte';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { flowSim } from '$lib/stores/flow-sim.svelte';
	import type { DiagramType } from '$lib/types/diagram';
	import { theme } from '$lib/stores/theme.svelte';
	import { session } from '$lib/stores/session.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { startGuestPing, stopGuestPing, clearGuestSession } from '$lib/utils/guest-ping';
	import { sync } from '$lib/stores/sync.svelte';
	import { collab, registerSession } from '$lib/stores/collab.svelte';
	import type { PermissionAction } from '$lib/stores/collab.svelte';
	import { registerCollabForSession } from '$lib/stores/session.svelte';
	import { initGoogleAuth, triggerSignOut, restoreSessionFromStoredToken, ensureValidSession } from '$lib/utils/google-auth';
	import { dialog } from '$lib/stores/dialog.svelte';
	import { resolveShareData } from '$lib/utils/share';
	import { highlight } from '$lib/stores/highlight.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { i18n } from '$lib/i18n';
	import OnboardingOverlayComponent from '$lib/components/ui/OnboardingOverlay.svelte';
	import CollabIndicator from '$lib/components/ui/CollabIndicator.svelte';
	import ToastContainer from '$lib/components/ui/ToastContainer.svelte';
	import { autoSave, registerSession as registerAutoSaveSession } from '$lib/stores/auto-save.svelte';
	import { pickSaveLocation, writeToFile, isFileSystemSupported, isInIframe, downloadAsFile } from '$lib/utils/file-system';
	import { ui } from '$lib/stores/ui.svelte';
	import { goto } from '$app/navigation';
	import UpgradeModal from '$lib/components/ui/UpgradeModal.svelte';
	import AdminPanel from '$lib/components/ui/AdminPanel.svelte';
	import CommandPalette, { type Command } from '$lib/components/ui/CommandPalette.svelte';


	let ready = $state(false);
	let showLogin = $state(false);
	let guestChosen = $state(false);







	let enterAppGuardAt = 0;
	let showChooser = $state(false);
	let pendingNewTab = $state(false);
	let canvasComponent: DiagramCanvas | undefined = $state();
	let showRelForm = $state(false);
	let showImportModal = $state(false);
	let importInitialTab = $state<'sketch' | undefined>();
	async function openPenDrawing() { if (await requireAi('import')) { importInitialTab = 'sketch'; showImportModal = true; } }
	let showExportModal = $state(false);
	let showAnalysis = $state(false);
	let showTranslateModal = $state(false);
	let showGenerateCode = $state(false);
	let showChat = $state(false);
	let showCollab = $state(false);
	let showHistory = $state(false);
	let showTemplates = $state(false);
	let showDataDict = $state(false);
	let showDomainStarter = $state(false);
	let showSqlQuery = $state(false);
	let showQuiz = $state(false);
	let showExplain = $state(false);
	let showPlayground = $state(false);
	let showComments = $state(false);
	let showLiveSql = $state(false);
	let showSampleData = $state(false);
	const dockWidth = $derived(Math.max(
		showComments ? 400 : 0, showAnalysis ? 420 : 0, showChat ? 380 : 0,
		showDataDict ? 480 : 0, showSqlQuery ? 480 : 0, showQuiz ? 480 : 0,
		showPlayground ? 560 : 0, showLiveSql ? 560 : 0, showSampleData ? 640 : 0
	));
	let previousDockPanels: boolean[] = [];
	$effect(() => {
		const panels = [showComments, showAnalysis, showChat, showDataDict, showSqlQuery, showQuiz, showPlayground, showLiveSql, showSampleData];
		const opened = panels.findIndex((value, i) => value && !previousDockPanels[i]);
		previousDockPanels = panels;
		if (opened < 0) return;
		showComments = opened === 0; showAnalysis = opened === 1; showChat = opened === 2;
		showDataDict = opened === 3; showSqlQuery = opened === 4; showQuiz = opened === 5;
		showPlayground = opened === 6; showLiveSql = opened === 7; showSampleData = opened === 8;
	});
	let showCodeToFlow = $state(false);
	let showOptimize = $state(false);
	let mobileFormOpen = $state(false);
	let showCommandPalette = $state(false);
	let showSearch = $state(false);
	let searchQuery = $state('');
	let searchIndex = $state(0);
	let showOnboarding = $state(false);


	let kickedByDevice = $state<string | null>(null);


	let ImportModal: any = $state(null);
	let ExportModal: any = $state(null);
	let AnalysisPanel: any = $state(null);
	let TranslateModal: any = $state(null);
	let GenerateCodeModal: any = $state(null);
	let ChatPanel: any = $state(null);
	let HistoryPanel: any = $state(null);
	let TemplatesModal: any = $state(null);
	let DataDictionaryPanel: any = $state(null);
	let DomainStarterModal: any = $state(null);
	let SqlQueryPanel: any = $state(null);
	let QuizPanel: any = $state(null);
	let ExplainPanel: any = $state(null);
	let SchemaPlaygroundPanel: any = $state(null);
	let CommentsPanel: any = $state(null);
	let CodeToFlowModal: any = $state(null);
	let OptimizePanel: any = $state(null);
	let LiveSqlPanel: any = $state(null);
	let SampleDataPanel: any = $state(null);

	async function lazyImport() {
		if (showImportModal && !ImportModal) {
			ImportModal = (await import('$lib/components/ui/ImportModal.svelte')).default;
		}
		if (showExportModal && !ExportModal) {
			ExportModal = (await import('$lib/components/ui/ExportModal.svelte')).default;
		}
		if (showAnalysis && !AnalysisPanel) {
			AnalysisPanel = (await import('$lib/components/ui/AnalysisPanel.svelte')).default;
		}
		if (showTranslateModal && !TranslateModal) {
			TranslateModal = (await import('$lib/components/ui/TranslateModal.svelte')).default;
		}
		if (showGenerateCode && !GenerateCodeModal) {
			GenerateCodeModal = (await import('$lib/components/ui/GenerateCodeModal.svelte')).default;
		}
		if (showChat && !ChatPanel) {
			ChatPanel = (await import('$lib/components/ui/ChatPanel.svelte')).default;
		}
		if (showHistory && !HistoryPanel) {
			HistoryPanel = (await import('$lib/components/ui/HistoryPanel.svelte')).default;
		}
		if (showTemplates && !TemplatesModal) {
			TemplatesModal = (await import('$lib/components/ui/TemplatesModal.svelte')).default;
		}
		if (showDataDict && !DataDictionaryPanel) {
			DataDictionaryPanel = (await import('$lib/components/ui/DataDictionaryPanel.svelte')).default;
		}
		if (showDomainStarter && !DomainStarterModal) {
			DomainStarterModal = (await import('$lib/components/ui/DomainStarterModal.svelte')).default;
		}
		if (showSqlQuery && !SqlQueryPanel) {
			SqlQueryPanel = (await import('$lib/components/ui/SqlQueryPanel.svelte')).default;
		}
		if (showQuiz && !QuizPanel) {
			QuizPanel = (await import('$lib/components/ui/QuizPanel.svelte')).default;
		}
		if (showExplain && !ExplainPanel) {
			ExplainPanel = (await import('$lib/components/ui/ExplainPanel.svelte')).default;
		}
		if (showPlayground && !SchemaPlaygroundPanel) {
			SchemaPlaygroundPanel = (await import('$lib/components/ui/SchemaPlaygroundPanel.svelte')).default;
		}
		if (showComments && !CommentsPanel) {
			CommentsPanel = (await import('$lib/components/ui/CommentsPanel.svelte')).default;
		}
		if (showCodeToFlow && !CodeToFlowModal) {
			CodeToFlowModal = (await import('$lib/components/ui/CodeToFlowModal.svelte')).default;
		}
		if (showOptimize && !OptimizePanel) {
			OptimizePanel = (await import('$lib/components/ui/OptimizePanel.svelte')).default;
		}
		if (showLiveSql && !LiveSqlPanel) {
			LiveSqlPanel = (await import('$lib/components/ui/LiveSqlPanel.svelte')).default;
		}
		if (showSampleData && !SampleDataPanel) {
			SampleDataPanel = (await import('$lib/components/ui/SampleDataPanel.svelte')).default;
		}
	}

	$effect(() => {
		showImportModal; showExportModal; showAnalysis; showTranslateModal;
		showGenerateCode; showChat; showHistory; showTemplates;
		showDataDict; showDomainStarter; showSqlQuery; showQuiz; showExplain; showPlayground; showComments; showCodeToFlow; showOptimize; showLiveSql; showSampleData;
		lazyImport();
	});


	$effect(() => {
		if (diagram.diagramType !== 'flowchart' && flowSim.running) flowSim.reset();
	});

	function getSvgElement() {
		return canvasComponent?.getSvgElement();
	}




	function getAllNodeIds(): string[] {
		if (diagram.diagramType === 'er') return diagram.entities.map((e) => e.id);
		if (diagram.diagramType === 'flowchart') return diagram.flowNodes.map((n) => n.id);
		if (diagram.diagramType === 'context') return diagram.dfdVisibleNodes.map((n) => n.id);
		return [];
	}


	function getSearchResults(): { id: string; name: string }[] {
		if (!searchQuery.trim()) return [];
		const q = searchQuery.toLowerCase();
		if (diagram.diagramType === 'er') {
			return diagram.entities.filter((e) => e.name.toLowerCase().includes(q)).map((e) => ({ id: e.id, name: e.name }));
		} else if (diagram.diagramType === 'flowchart') {
			return diagram.flowNodes.filter((n) => n.name.toLowerCase().includes(q)).map((n) => ({ id: n.id, name: n.name }));
		} else {
			return diagram.dfdNodes.filter((n) => n.name.toLowerCase().includes(q)).map((n) => ({ id: n.id, name: n.name }));
		}
	}

	function selectAndPanTo(id: string) {
		diagram.selectEntity(id);

		let pos: { x: number; y: number } | undefined;
		if (diagram.diagramType === 'er') pos = diagram.entities.find((e) => e.id === id)?.position;
		else if (diagram.diagramType === 'flowchart') pos = diagram.flowNodes.find((n) => n.id === id)?.position;
		else pos = diagram.dfdNodes.find((n) => n.id === id)?.position;
		if (pos) {
			diagram.panX = -pos.x * diagram.zoom + (diagram.canvasWidth) / 2;
			diagram.panY = -pos.y * diagram.zoom + (diagram.canvasHeight) / 2;
		}
	}









	$effect(() => {
		if (ui.loginRequested) { ui.loginRequested = false; ui.showUpgradeModal = false; showLogin = true; }
	});


	async function requireAi(action: PermissionAction): Promise<boolean> {
		if (!auth.isSignedIn) {
			ui.showUpgradeModal = true;
			return false;
		}
		if (!auth.isAdmin && auth.plan !== 'advanced') {
			ui.showUpgradeModal = true;
			return false;
		}
		return await collab.requestPermission(action);
	}




	function buildCommands(): Command[] {
		const t = diagram.diagramType;
		const isER = t === 'er';
		const isFlow = t === 'flowchart';
		const isDFD = t === 'context';
		const list: Command[] = [

			{ id: 'add-entity', group: 'สร้าง', label: 'เพิ่ม Entity', keywords: 'add entity table เอนทิตี ตาราง', enabled: isER,
				icon: 'M12 4v16m8-8H4', run: () => { diagram.addEntity('Entity'); } },
			{ id: 'add-rel', group: 'สร้าง', label: 'เพิ่มความสัมพันธ์', keywords: 'add relationship relation ความสัมพันธ์', enabled: isER,
				icon: 'M13 7l5 5m0 0l-5 5m5-5H6', run: () => { showRelForm = true; } },
			{ id: 'add-flow', group: 'สร้าง', label: 'เพิ่ม Node', keywords: 'add node process flowchart โหนด', enabled: isFlow,
				icon: 'M12 4v16m8-8H4', run: () => { diagram.addFlowNode('Process'); } },
			{ id: 'add-dfd', group: 'สร้าง', label: 'เพิ่ม Node', keywords: 'add node process dfd โหนด', enabled: isDFD,
				icon: 'M12 4v16m8-8H4', run: () => { diagram.addDFDNode('Process'); } },
			{ id: 'dfd-drill-up', group: 'มุมมอง', label: 'ขึ้นหนึ่งระดับ (DFD)', keywords: 'dfd drill up level back parent ระดับ ขึ้น ย้อน กลับ',
				enabled: isDFD && diagram.dfdDrillPath.length > 0, hint: 'Esc',
				icon: 'M5 15l7-7 7 7', run: () => { diagram.drillUpDFD(); tick().then(() => canvasComponent?.fitToContent()); } },
			{ id: 'dfd-drill-root', group: 'มุมมอง', label: 'กลับไป Level 0 (DFD)', keywords: 'dfd drill root level 0 context ระดับ บนสุด',
				enabled: isDFD && diagram.dfdDrillPath.length > 0,
				icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3', run: () => { diagram.drillToDFDLevel(0); tick().then(() => canvasComponent?.fitToContent()); } },
			{ id: 'add-note', group: 'สร้าง', label: 'เพิ่มโน้ต', keywords: 'add note comment โน้ต',
				icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5', run: () => { diagram.addNote('โน้ต'); } },
			{ id: 'templates', group: 'สร้าง', label: 'Templates', keywords: 'template เทมเพลต ตัวอย่าง',
				icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z',
				run: async () => { if (await collab.requestPermission('templates')) showTemplates = true; } },


			{ id: 'ai-domain', group: 'AI', label: 'AI Domain Starter', keywords: 'ai generate domain starter สร้างจากคำอธิบาย',
				icon: 'M13 10V3L4 14h7v7l9-11h-7z', run: async () => { if (await requireAi('domain-starter')) showDomainStarter = true; } },
			{ id: 'ai-analyze', group: 'AI', label: 'AI วิเคราะห์', keywords: 'ai analyze review วิเคราะห์ ตรวจ',
				icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
				run: async () => { if (await requireAi('ai-analysis')) showAnalysis = true; } },
			{ id: 'ai-explain', group: 'AI', label: 'AI อธิบาย', keywords: 'ai explain อธิบาย',
				icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
				run: async () => { if (await requireAi('ai-analysis')) showExplain = true; } },
			{ id: 'ai-chat', group: 'AI', label: 'AI Chat', keywords: 'ai chat assistant ผู้ช่วย คุย',
				icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
				run: async () => { if (await requireAi('ai-analysis')) showChat = !showChat; } },
			{ id: 'ai-translate', group: 'AI', label: 'AI แปลชื่อ', keywords: 'ai translate แปล ภาษา', enabled: isER,
				icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129',
				run: async () => { if (await requireAi('translate')) showTranslateModal = true; } },
			{ id: 'ai-code-to-flow', group: 'AI', label: 'โค้ด → Flowchart', keywords: 'code to flowchart convert source parse โค้ด แปลง flow',
				icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
				run: async () => { if (await requireAi('code-to-flow')) showCodeToFlow = true; } },
			{ id: 'ai-optimize', group: 'AI', label: 'AI แนะนำ Index & Optimization', keywords: 'ai index optimize performance normalization query แนะนำ ปรับ ประสิทธิภาพ อินเด็กซ์', enabled: isER,
				icon: 'M13 10V3L4 14h7v7l9-11h-7z',
				run: async () => { if (await requireAi('ai-analysis')) showOptimize = true; } },


			{ id: 'auto-layout', group: 'มุมมอง', label: 'จัดวางอัตโนมัติ (Magic Arrange)', keywords: 'auto layout arrange magic จัดวาง', hint: 'Ctrl+L',
				icon: 'M4 6h16M4 10h16M4 14h16M4 18h16', run: () => { diagram.animateLayout(); } },
			{ id: 'fit', group: 'มุมมอง', label: 'พอดีเนื้อหา', keywords: 'fit content zoom พอดี',
				icon: 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4', run: () => { canvasComponent?.fitToContent(); } },
			{ id: 'reset-view', group: 'มุมมอง', label: 'รีเซ็ตมุมมอง', keywords: 'reset view zoom รีเซ็ต',
				icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', run: () => { diagram.resetView(); } },
			{ id: 'toggle-grid', group: 'มุมมอง', label: 'สลับ Grid + Snap', keywords: 'grid snap toggle เส้นตาราง', hint: 'Ctrl+G',
				icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 9h16M4 15h16M9 4v16M15 4v16', run: () => { diagram.toggleGrid(); } },
			{ id: 'toggle-dataflow', group: 'มุมมอง', label: 'สลับ Data Flow', keywords: 'data flow particles animation ไหล', enabled: isDFD, hint: 'Ctrl+Shift+D',
				icon: 'M13 10V3L4 14h7v7l9-11h-7z', run: () => { diagram.toggleDataFlow(); } },
			{ id: 'toggle-sketch', group: 'AI', label: 'วาดด้วยมือ', keywords: 'sketch handwriting apple pencil วาดมือ ปากกา ไอแพด',
				icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', run: openPenDrawing },
			{ id: 'flow-sim', group: 'มุมมอง', label: flowSim.running ? 'หยุดจำลอง Flow' : 'จำลองการทำงาน Flow', keywords: 'simulate flow play run token animation จำลอง เล่น รัน', enabled: isFlow,
				icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
				run: () => { flowSim.toggle($state.snapshot(diagram.flowNodes), $state.snapshot(diagram.flowEdges)); } },
			{ id: 'smart-routing', group: 'มุมมอง', label: diagram.smartRouting ? 'ปิดเส้นเลี่ยงกล่อง (Smart Routing)' : 'เส้นเลี่ยงกล่องอัตโนมัติ (Smart Routing)', keywords: 'smart routing obstacle avoid edge เส้น เลี่ยง หลบ กล่อง', enabled: isFlow,
				icon: 'M4 6h5l3 6 3-6h5M4 18h5l3-6', run: () => { diagram.toggleSmartRouting(); } },
			{ id: 'toggle-theme', group: 'มุมมอง', label: 'สลับธีมสว่าง/มืด', keywords: 'theme dark light mode ธีม มืด สว่าง',
				icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z', run: () => { theme.toggle(); } },


			{ id: 'playground', group: 'เครื่องมือ', label: 'ทดลอง Schema (SQL)', keywords: 'schema playground sql query ทดลอง', enabled: isER,
				icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4', run: () => { showPlayground = true; } },
			{ id: 'live-sql', group: 'เครื่องมือ', label: 'Live SQL Real Time (แก้สองทาง)', keywords: 'live sql real time realtime two-way ddl create table แก้ไข ซิงก์ สองทาง', enabled: isER,
				icon: 'M4 7v10c0 2 1.5 3 4 3h8c2.5 0 4-1 4-3V7M4 7c0 2 1.5 3 4 3h8c2.5 0 4-1 4-3M4 7c0-2 1.5-3 4-3h8c2.5 0 4 1 4 3', run: () => { showLiveSql = true; } },
			{ id: 'sample-data', group: 'เครื่องมือ', label: i18n.t('toolbar.sampleData'), keywords: 'sample data rows table ข้อมูล ตัวอย่าง ตาราง แถว generate', enabled: isER,
				icon: 'M4 6h16M4 10h16M4 14h16M4 18h16', run: () => { showSampleData = true; } },
			{ id: 'quiz', group: 'เครื่องมือ', label: 'โหมด Quiz', keywords: 'quiz test practice แบบทดสอบ ฝึก',
				icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', run: () => { showQuiz = !showQuiz; } },
			{ id: 'datadict', group: 'เครื่องมือ', label: 'Data Dictionary', keywords: 'data dictionary docs เอกสาร', enabled: isER,
				icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.247m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.247', run: () => { showDataDict = !showDataDict; } },
			{ id: 'history', group: 'เครื่องมือ', label: 'ประวัติการแก้ไข', keywords: 'history version timeline ประวัติ',
				icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', run: () => { showHistory = !showHistory; } },
			{ id: 'comments', group: 'เครื่องมือ', label: 'ความคิดเห็น', keywords: 'comments annotation ความคิดเห็น',
				icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z', run: () => { showComments = true; } },
			{ id: 'collab', group: 'เครื่องมือ', label: 'ทำงานร่วมกัน (Collab)', keywords: 'collab collaboration realtime ทำงานร่วม',
				icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z', run: () => { showCollab = !showCollab; } },


			{ id: 'export', group: 'ไฟล์', label: 'ส่งออก (PNG / SVG / PDF)', keywords: 'export png svg pdf save ส่งออก บันทึกรูป',
				icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4', run: () => { showExportModal = true; } },
			{ id: 'import', group: 'ไฟล์', label: 'นำเข้า (SQL / Mermaid / รูป)', keywords: 'import sql mermaid image นำเข้า',
				icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12', run: async () => { if (await collab.requestPermission('import')) showImportModal = true; } },
			{ id: 'generate-code', group: 'ไฟล์', label: 'Generate Code (SQL / ORM)', keywords: 'generate code sql orm prisma django สร้างโค้ด',
				icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', run: async () => { if (await requireAi('ai-analysis')) showGenerateCode = true; } },
			{ id: 'save', group: 'ไฟล์', label: 'บันทึก', keywords: 'save บันทึก', hint: 'Ctrl+S',
				icon: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4', run: () => { handleSave(); } },


			{ id: 'undo', group: 'แก้ไข', label: 'ย้อนกลับ (Undo)', keywords: 'undo ย้อน', hint: 'Ctrl+Z',
				icon: 'M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H9m-6-15l-4 4m0 0l4 4m-4-4h6', run: () => { diagram.undo(); } },
			{ id: 'redo', group: 'แก้ไข', label: 'ทำซ้ำ (Redo)', keywords: 'redo ทำซ้ำ', hint: 'Ctrl+Y',
				icon: 'M21 10H11a5 5 0 00-5 5v0a5 5 0 005 5h6m6-15l4 4m0 0l-4 4m4-4h-6', run: () => { diagram.redo(); } },
			{ id: 'select-all', group: 'แก้ไข', label: 'เลือกทั้งหมด', keywords: 'select all เลือกทั้งหมด', hint: 'Ctrl+A',
				icon: 'M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m-4 12h2a2 2 0 002-2v-2', run: () => { diagram.selectAll(); } },
			{ id: 'duplicate', group: 'แก้ไข', label: 'ทำสำเนาที่เลือก', keywords: 'duplicate copy สำเนา', hint: 'Ctrl+D',
				icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
				enabled: diagram.selectedNodeIds.length > 0, run: () => { diagram.duplicateSelected(); } },


			{ id: 'tutorial', group: 'ช่วยเหลือ', label: 'สอนใช้งาน', keywords: 'tutorial onboarding help สอน ช่วยเหลือ',
				icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13', run: () => { triggerOnboarding(); } }
		];
		return list.filter(command => auth.isSignedIn || (command.group !== 'AI' && command.id !== 'collab'));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.defaultPrevented || e.isComposing) return;
		const code = shortcutCode(e);

		if ((e.ctrlKey || e.metaKey) && code === 'KeyK') {
			e.preventDefault();
			showCommandPalette = !showCommandPalette;
			return;
		}
		if (diagram.viewOnly) return;
		const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
		const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

		const hasTextSelection = (window.getSelection()?.toString().length ?? 0) > 0;


		if (showSearch) {
			if (e.key === 'Escape') {
				e.preventDefault();
				showSearch = false;
				searchQuery = '';
				return;
			}
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				const results = getSearchResults();
				if (results.length > 0) searchIndex = (searchIndex + 1) % results.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				const results = getSearchResults();
				if (results.length > 0) searchIndex = (searchIndex - 1 + results.length) % results.length;
				return;
			}
			if (e.key === 'Enter') {
				e.preventDefault();
				const results = getSearchResults();
				if (results.length > 0 && results[searchIndex]) {
					selectAndPanTo(results[searchIndex].id);
					showSearch = false;
					searchQuery = '';
				}
				return;
			}
			return;
		}


		if ((e.ctrlKey || e.metaKey) && code === 'KeyZ' && !e.shiftKey && !isInput) {
			e.preventDefault();
			diagram.undo();
		} else if ((e.ctrlKey || e.metaKey) && code === 'KeyZ' && e.shiftKey && !isInput) {
			e.preventDefault();
			diagram.redo();
		} else if ((e.ctrlKey || e.metaKey) && code === 'KeyY' && !isInput) {
			e.preventDefault();
			diagram.redo();
		} else if ((e.ctrlKey || e.metaKey) && code === 'KeyC' && !isInput && !hasTextSelection) {
			e.preventDefault();
			diagram.copySelected();
		} else if ((e.ctrlKey || e.metaKey) && code === 'KeyV' && !isInput && !hasTextSelection) {
			e.preventDefault();
			diagram.paste();
		} else if ((e.ctrlKey || e.metaKey) && code === 'KeyA' && !isInput && !hasTextSelection) {
			e.preventDefault();
			diagram.selectAll();
		} else if ((e.ctrlKey || e.metaKey) && code === 'KeyS') {
			e.preventDefault();
			handleSave();
		} else if ((e.ctrlKey || e.metaKey) && e.shiftKey && code === 'KeyD' && !isInput) {
			e.preventDefault();
			diagram.toggleDataFlow();
		} else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && code === 'KeyD' && !isInput) {
			e.preventDefault();
			diagram.duplicateSelected();
		} else if ((e.ctrlKey || e.metaKey) && code === 'KeyF') {
			e.preventDefault();
			showSearch = !showSearch;
			searchQuery = '';
			searchIndex = 0;
		} else if ((e.ctrlKey || e.metaKey) && code === 'KeyL' && !isInput) {
			e.preventDefault();
			if (collab.connected && collab.users.length > 1) {
				collab.requestPermission('auto-layout').then(granted => {
					if (granted) diagram.animateLayout();
				});
			} else {
				diagram.animateLayout();
			}
		} else if ((e.ctrlKey || e.metaKey) && code === 'KeyG' && !isInput) {
			e.preventDefault();
			diagram.toggleGrid();
		} else if (e.key === 'Escape') {
			e.preventDefault();


			if (diagram.stampShape) diagram.stampShape = null;
			else if (
				diagram.selectedNodeIds.length === 0 &&
				!diagram.selectedEdgeId && diagram.selectedFlowEdgeIds.length === 0 &&
				diagram.diagramType === 'context' &&
				diagram.dfdDrillPath.length > 0
			) diagram.drillUpDFD();
			else diagram.clearSelection();
		} else if (e.key === 'Tab' && !isInput) {
			e.preventDefault();
			const ids = getAllNodeIds();
			if (ids.length === 0) return;
			const currentId = diagram.selectedNodeIds[0];
			const currentIdx = currentId ? ids.indexOf(currentId) : -1;
			const nextIdx = e.shiftKey
				? (currentIdx - 1 + ids.length) % ids.length
				: (currentIdx + 1) % ids.length;
			diagram.selectEntity(ids[nextIdx]);
		} else if (e.key === 'Delete') {
			if (isInput) return;
			if (diagram.selectedNodeIds.length > 0) {
				const ids = [...diagram.selectedNodeIds];
				const count = ids.length;
				if (diagram.diagramType === 'er') {
					const hasRels = diagram.relationships.some(r =>
						ids.includes(r.entityIds[0]) || ids.includes(r.entityIds[1])
					);
					const msg = count === 1
						? `ลบ "${diagram.entities.find(e => e.id === ids[0])?.name}"${hasRels ? ' และความสัมพันธ์ที่เกี่ยวข้อง' : ''}?`
						: `ลบ ${count} เอนทิตี${hasRels ? ' และความสัมพันธ์ที่เกี่ยวข้อง' : ''}?`;
					dialog.confirm({ title: 'ยืนยันการลบ', message: msg, confirmText: 'ลบ', variant: 'danger' })
						.then(ok => { if (ok) diagram.removeEntities(ids); });
				} else if (diagram.diagramType === 'flowchart') {
					const msg = count === 1 ? `ลบ Node นี้?` : `ลบ ${count} Node?`;
					dialog.confirm({ title: 'ยืนยันการลบ', message: msg, confirmText: 'ลบ', variant: 'danger' })
						.then(ok => { if (ok) for (const id of ids) diagram.removeFlowNode(id); });
				} else if (diagram.diagramType === 'context') {
					const msg = count === 1 ? `ลบ Node นี้?` : `ลบ ${count} Node?`;
					dialog.confirm({ title: 'ยืนยันการลบ', message: msg, confirmText: 'ลบ', variant: 'danger' })
						.then(ok => { if (ok) for (const id of ids) diagram.removeDFDNode(id); });
				}
			} else if (diagram.diagramType === 'flowchart' && diagram.selectedFlowEdgeIds.length > 1) {
				const ids = [...diagram.selectedFlowEdgeIds];
				dialog.confirm({ title: 'ยืนยันการลบ', message: `ลบ ${ids.length} เส้น?`, confirmText: 'ลบ', variant: 'danger' })
					.then(ok => { if (ok) { for (const id of ids) diagram.removeFlowEdge(id); diagram.clearSelection(); } });
			} else if (diagram.selectedEdgeId) {
				const edgeId = diagram.selectedEdgeId;
				if (diagram.diagramType === 'er') {
					const rel = diagram.relationships.find(r => r.id === edgeId);
					dialog.confirm({
						title: 'ยืนยันการลบ',
						message: `ลบความสัมพันธ์ "${rel?.name}"?`,
						confirmText: 'ลบ',
						variant: 'danger'
					}).then(ok => { if (ok) diagram.removeRelationship(edgeId); });
				} else if (diagram.diagramType === 'flowchart') {
					dialog.confirm({ title: 'ยืนยันการลบ', message: 'ลบ Edge นี้?', confirmText: 'ลบ', variant: 'danger' })
						.then(ok => { if (ok) diagram.removeFlowEdge(edgeId); });
				} else if (diagram.diagramType === 'context') {
					dialog.confirm({ title: 'ยืนยันการลบ', message: 'ลบ Flow นี้?', confirmText: 'ลบ', variant: 'danger' })
						.then(ok => { if (ok) diagram.removeDFDFlow(edgeId); });
				}
			}
		}
	}

	function handleNewDiagram() {
		pendingNewTab = true;
		showChooser = true;
	}

	function handleChoose(type: DiagramType, name: string) {
		const isFirstChoose = !pendingNewTab;
		if (pendingNewTab) {
			session.createDiagram(name, type);
			pendingNewTab = false;
		} else {
			diagram.diagramType = type;

			if (session.activeDiagramId) {
				session.renameDiagram(session.activeDiagramId, name);
			}
			session.saveNow();
		}
		showChooser = false;


		if (isFirstChoose && !localStorage.getItem('onboarding-done')) {
			triggerOnboarding();
		}


		promptForAutoSaveLocation();
	}

	function triggerOnboarding() {
		showOnboarding = true;
	}

	function enterApp() {



		const now = Date.now();
		if (now - enterAppGuardAt < 1000) return;
		enterAppGuardAt = now;

		showLogin = false;





		try {
			session.initSession();
			collab.loadUserName();
			registerSession(session);
			registerCollabForSession(collab);
			registerAutoSaveSession(session);



			sync.registerPreflush(() => session.saveNow());


			if (session.isFirstTime) {
				showChooser = true;
			}
		} catch (e) {
			console.error('enterApp: session init failed', e);
		}



		try {

			const params = new URLSearchParams(window.location.search);
			const roomParam = params.get('room');
			const tokenParam = params.get('token');
			if (auth.isSignedIn && roomParam) {

				let isHost = false;
				let isRejoin = false;
				try {
					const saved = localStorage.getItem('collab-room');
					if (saved) {
						const parsed = JSON.parse(saved);
						if (parsed.roomId === roomParam.toLowerCase()) {
							isRejoin = true;
							if (parsed.isHost) isHost = true;
						}
					}
				} catch { /* ignore */ }

				if (!isRejoin) showCollab = true;
				collab.joinRoom(roomParam.toLowerCase(), isHost, tokenParam || undefined);
			} else {
				if (auth.isSignedIn) collab.tryRejoin();
			}







			if (sync.canSync) {
				void sync.claimDevice();
				void sync.startEventStream(() => session.triggerFullSync()).catch(() => {});
				sync.startPolling(
					() => session.triggerFullSync(),
					() => !session.hasPendingSave,
					5_000
				);
			}
		} catch (e) {
			console.error('enterApp: collab/sync setup failed', e);
		}

		ready = true;
	}


	function handleVisibility() {
		if (document.visibilityState === 'visible' && ready && auth.isSignedIn && sync.canSync) {


			void sync.claimDevice();
			session.triggerFullSync();
			void sync.startEventStream(() => session.triggerFullSync()).catch(() => {});
			sync.startPolling(
				() => session.triggerFullSync(),
				() => !session.hasPendingSave,
				5_000
			);
		} else {


			sync.flushNow();
			sync.stopPolling();
			sync.stopEventStream();
		}
	}

	onMount(async () => {
		document.addEventListener('visibilitychange', handleVisibility);



		diagram.openCommentsPanel = () => { showComments = true; };





		try {
			if (PUBLIC_SIGNALING_URL && PUBLIC_SIGNALING_URL.includes('onrender.com')) {
				fetch(PUBLIC_SIGNALING_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'), {
					mode: 'no-cors',
					cache: 'no-store'
				}).catch(() => {});
			}
		} catch { /* ignore */ }


		const params = new URLSearchParams(window.location.search);
		if (params.get('checkout') === 'success') {

			window.history.replaceState({}, '', window.location.pathname);

			pollPlanUpdate();
		}



		const shareData = await resolveShareData(window.location.search, window.location.hash);
		if (shareData) {
			diagram.entities = shareData.entities ?? [];
			diagram.relationships = shareData.relationships ?? [];
			diagram.notes = shareData.notes ?? [];
			diagram.notation = shareData.notation ?? 'crows-foot';
			diagram.diagramFont = shareData.diagramFont ?? "'TH Sarabun PSK', 'Sarabun', sans-serif";
			diagram.diagramFontSize = shareData.diagramFontSize ?? 14;


			diagram.diagramType = shareData.diagramType ?? 'er';
			diagram.flowNodes = shareData.flowNodes ?? [];
			diagram.flowEdges = shareData.flowEdges ?? [];
			diagram.dfdNodes = shareData.dfdNodes ?? [];
			diagram.dfdFlows = shareData.dfdFlows ?? [];
			diagram.panX = shareData.panX ?? 0;
			diagram.panY = shareData.panY ?? 0;
			diagram.zoom = shareData.zoom ?? 1;
			diagram.viewOnly = true;
			ready = true;
			return;
		}




		try {

			initGoogleAuth();




			if (params.get('signedin') === '1') {
				restoreSessionFromStoredToken();
				window.history.replaceState({}, '', window.location.pathname);
				const loginReturn = sessionStorage.getItem('er-diagram:login-return');
				sessionStorage.removeItem('er-diagram:login-return');
				if (loginReturn === '/pro') void goto('/pro');
			} else {
				sessionStorage.removeItem('er-diagram:login-return');
			}







			if (auth.isSignedIn && ensureValidSession()) {
				enterApp();
			} else {
				showLogin = true;
			}
		} catch (e) {
			console.error('onMount: auth init failed, showing login', e);
			if (!ready) showLogin = true;
		}
	});


	$effect(() => {
		return () => {
			sync.stopPolling();
		};
	});



	$effect(() => {
		if (auth.isSignedIn) {
			guestChosen = false;
			stopGuestPing();
			void clearGuestSession();
			return;
		}
		if (!ready || showLogin || !guestChosen) return;
		return startGuestPing();
	});


	$effect(() => {
		if (ui.isOnline && ready && auth.isSignedIn && sync.canSync) {
			sync.drainQueue().then(() => {
				ui.refreshQueueCount();
				session.triggerFullSync();
			});
		}
		if (!ui.isOnline) {
			ui.refreshQueueCount();
		}
	});


	$effect(() => {
		if (session.activeDiagramId) {
			autoSave.onDiagramSwitch();
		}
	});


	$effect(() => {
		if (autoSave.fileHandle && autoSave.enabled) {
			autoSave.start();
		}
		return () => autoSave.stop();
	});

	async function handleSave(): Promise<boolean> {

		if (autoSave.fileHandle) {
			const ok = await autoSave.saveNow();
			if (ok) toast.success(`บันทึกแล้ว: ${autoSave.fileHandle.fileName}`);
			return ok;
		}


		if (!isFileSystemSupported()) {
			const name = session.activeDiagramName || 'diagram';
			const data = {
				version: '1.0',
				diagramType: diagram.diagramType,
				name,
				entities: diagram.entities,
				relationships: diagram.relationships,
				notes: diagram.notes,
				comments: diagram.comments,
				flowNodes: diagram.flowNodes,
				flowEdges: diagram.flowEdges,
				dfdNodes: diagram.dfdNodes,
				dfdFlows: diagram.dfdFlows,
				notation: diagram.notation,
				showGrid: diagram.showGrid,
				diagramFont: diagram.diagramFont,
				diagramFontSize: diagram.diagramFontSize,
				customFonts: diagram.customFonts,
				panX: diagram.panX,
				panY: diagram.panY,
				zoom: diagram.zoom,
				savedAt: new Date().toISOString()
			};
			downloadAsFile(data, `${name}.erd`);
			autoSave.markFileSaved(data);
			toast.success(`ดาวน์โหลดแล้ว: ${name}.erd`);
			return true;
		}


		const name = session.activeDiagramName || 'diagram';
		const handle = await pickSaveLocation(`${name}.erd`);
		if (handle) {
			const ok = await autoSave.setFileHandle(handle);
			if (ok) toast.success(`บันทึกแล้ว: ${handle.fileName}`);
			return ok;
		}
		return false;
	}

	async function saveBeforeDelete(id: string): Promise<boolean> {
		const previousId = session.activeDiagramId;
		try {
			if (id !== previousId) session.switchDiagram(id);
			autoSave.onDiagramSwitch();
			return await handleSave();
		} catch {
			toast.error('บันทึกไม่สำเร็จ โครงการยังไม่ถูกลบ');
			return false;
		} finally {
			if (previousId && previousId !== id) {
				session.switchDiagram(previousId);
				autoSave.onDiagramSwitch();
			}
		}
	}


	let autoSavePromptDismissed = $state(false);

	async function promptForAutoSaveLocation() {
		if (!autoSave.isSupported || diagram.viewOnly) return;
		if (autoSavePromptDismissed || autoSave.hasAutoSave) return;

		autoSavePromptDismissed = true;


		const wantsAutoSave = await dialog.confirm({
			title: 'ตั้งค่า Auto-Save',
			message: 'คุณต้องการเปิดใช้งาน Auto-Save สำหรับไดอะแกรมนี้หรือไม่?\n\nไฟล์จะถูกบันทึกอัตโนมัติทุก 10 วินาที',
			confirmText: 'เปิดใช้งาน',
			cancelText: 'ไม่ใช่ตอนนี้'
		});

		if (wantsAutoSave) {
			const handle = await pickSaveLocation();
			if (handle) {
				autoSave.setFileHandle(handle);
				toast.success(`Auto-Save เปิดใช้งานแล้ว: ${handle.fileName}`);
			}
		}
	}


	async function pollPlanUpdate() {
		const token = sessionStorage.getItem('er-diagram:id-token');
		if (!token) return;
		for (let i = 0; i < 10; i++) {
			await new Promise(r => setTimeout(r, 3000));
			try {
				const res = await fetch('/api/user/plan', {
					headers: { 'Authorization': `Bearer ${token}` }
				});
				if (res.ok) {
					const data = await res.json();
					if (data.plan === 'advanced') {
						auth.updatePlan('advanced', undefined, data.planExpiresAt ?? null);
						return;
					}
				}
			} catch { /* continue polling */ }
		}
	}


	$effect(() => {
		if (showLogin && auth.isSignedIn) {
			enterApp();
		}
	});





	$effect(() => {
		if (sync.kickedBy && ready && !showLogin) {
			const by = sync.kickedBy;
			triggerSignOut();
			sync.clearKicked();
			showLogin = true;
			ready = true;



			kickedByDevice = by;
		}
	});


	$effect(() => {
		const ids = [...diagram.selectedNodeIds, ...(diagram.selectedEdgeId ? [diagram.selectedEdgeId] : [])];
		if (collab.connected) {
			collab.updateSelection(ids);
		}
	});


	$effect(() => {
		diagram.entities;
		diagram.relationships;
		diagram.notes;
		diagram.notation;
		diagram.diagramFont;
		diagram.diagramFontSize;
		diagram.diagramType;
		diagram.flowNodes;
		diagram.flowEdges;
		diagram.dfdNodes;
		diagram.dfdFlows;

		if (session.activeDiagramId && !session.suppressAutoSave && !diagram.timelinePreviewActive) {
			session.scheduleSave();
		}
	});


	let viewportTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		diagram.panX;
		diagram.panY;
		diagram.zoom;

		if (session.activeDiagramId && !session.suppressAutoSave) {
			if (viewportTimer) clearTimeout(viewportTimer);
			viewportTimer = setTimeout(() => {
				session.saveViewport();
				viewportTimer = null;
			}, 1000);
		}
	});
</script>

<svelte:window
	onkeydown={handleKeydown}
	onbeforeunload={() => { session.saveNow(); sync.flushNow(); }}
	onpagehide={() => { session.saveNow(); sync.flushNow(); }}
/>

<svelte:head>
	<title>สร้างแผนภาพ Flowchart, DFD และ ER Diagram ออนไลน์ | Flow Builder</title>
	<meta
		name="description"
		content="Flow Builder เครื่องมือสร้าง ER Diagram, Flowchart และ Context Diagram (DFD) ออนไลน์ฟรี ใช้งานง่ายบนมือถือ มี AI ช่วยออกแบบ ตรวจงาน และโหมด Quiz ฝึกทำโจทย์ ส่งออกเป็น SQL และรูปภาพได้"
	/>
	<meta
		name="keywords"
		content="ER Diagram, Flowchart, DFD, Context Diagram, สร้าง ER Diagram, ออกแบบฐานข้อมูล, database design, entity relationship, ผังงาน, diagram online, Flow Builder"
	/>
	<link rel="canonical" href="https://suepskun.online/" />


	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Flow Builder" />
	<meta property="og:title" content="สร้างแผนภาพ Flowchart, DFD และ ER Diagram ออนไลน์ | Flow Builder" />
	<meta
		property="og:description"
		content="เครื่องมือสร้าง ER Diagram, Flowchart และ DFD ออนไลน์ฟรี พร้อม AI ช่วยออกแบบและโหมด Quiz ใช้งานง่ายบนมือถือ"
	/>
	<meta property="og:url" content="https://suepskun.online/" />
	<meta property="og:image" content="https://suepskun.online/og-image.png" />
	<meta property="og:locale" content="th_TH" />


	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="สร้างแผนภาพ Flowchart, DFD และ ER Diagram ออนไลน์ | Flow Builder" />
	<meta
		name="twitter:description"
		content="เครื่องมือสร้าง ER Diagram, Flowchart และ DFD ออนไลน์ฟรี พร้อม AI ช่วยออกแบบและโหมด Quiz"
	/>
	<meta name="twitter:image" content="https://suepskun.online/og-image.png" />


	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'Flow Builder',
		url: 'https://suepskun.online/',
		description:
			'เครื่องมือสร้าง ER Diagram, Flowchart และ Context Diagram (DFD) ออนไลน์ฟรี พร้อม AI ช่วยออกแบบและโหมด Quiz',
		applicationCategory: 'DesignApplication',
		operatingSystem: 'Web',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'THB' },
		inLanguage: 'th'
	})}<\/script>`}
</svelte:head>



{#if showLogin}
	<div class="h-screen w-screen font-sans {theme.isDark ? 'dark' : ''}">
		<LoginScreen onskip={() => { guestChosen = true; enterApp(); }} />
	</div>
{:else if !ready}

	<div class="flex h-screen w-screen flex-col overflow-hidden font-sans {theme.isDark ? 'dark' : ''}">

		<div class="flex h-11 items-center border-b border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] px-2">
			<div class="h-5 w-28 animate-pulse rounded bg-[var(--ui-border)]"></div>
			<div class="ml-auto h-6 w-6 animate-pulse rounded-full bg-[var(--ui-border)]"></div>
		</div>
		<div class="flex min-h-0 flex-1">

			<div class="hidden lg:block w-72 lg:w-[300px] 2xl:w-80 shrink-0 border-r border-[var(--ui-border)] bg-[var(--ui-bg)] p-4">
				<div class="space-y-4">
					<div class="h-4 w-20 animate-pulse rounded bg-[var(--ui-border)]"></div>
					<div class="h-8 w-full animate-pulse rounded-lg bg-[var(--ui-border)]"></div>
					<div class="h-8 w-full animate-pulse rounded-lg bg-[var(--ui-border)]"></div>
					<div class="h-4 w-24 animate-pulse rounded bg-[var(--ui-border)]"></div>
					<div class="h-8 w-full animate-pulse rounded-lg bg-[var(--ui-border)]"></div>
					<div class="h-4 w-16 animate-pulse rounded bg-[var(--ui-border)]"></div>
					<div class="h-20 w-full animate-pulse rounded-lg bg-[var(--ui-border)]"></div>
				</div>
			</div>

			<div class="flex-1 bg-[var(--ui-bg)]">
				<div class="flex h-full items-center justify-center">
					<div class="flex flex-col items-center gap-3">
						<svg class="h-8 w-8 animate-spin text-[var(--ui-border)]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
						<span class="text-xs text-[var(--ui-text-muted)]">Loading...</span>
					</div>
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="flex h-screen w-screen flex-col overflow-hidden font-sans {theme.isDark ? 'dark' : ''}">

		{#if diagram.viewOnly}
			<div class="flex items-center justify-center gap-2 bg-amber-100 dark:bg-amber-900/40 px-4 py-1.5 text-xs text-amber-800 dark:text-amber-200">
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
				กำลังดูอย่างเดียว (Read-Only)
				<button
					onclick={() => { window.location.hash = ''; window.location.reload(); }}
					class="ml-2 rounded bg-amber-200 dark:bg-amber-800 px-2 py-0.5 text-[10px] font-medium hover:opacity-80 transition"
				>สร้างใหม่</button>
			</div>
		{/if}


		{#if !diagram.viewOnly}
			<DiagramTabs onnewdiagram={handleNewDiagram} onsavebeforedelete={saveBeforeDelete} />
		{/if}


		<div class="flex min-h-0 flex-1">

			{#if !diagram.viewOnly}
				<FormPanel mobileOpen={mobileFormOpen} onclose={() => mobileFormOpen = false} />
			{/if}


			<main class="canvas-workspace relative flex min-w-0 flex-1 flex-col overflow-hidden" style={`--dock-width: ${dockWidth}px; --dock-open: ${dockWidth > 0 ? 1 : 0}`}>

				{#if diagram.viewOnly}

					<div class="absolute top-3 right-3 z-10">
						<div class="flex items-center gap-1 rounded-lg bg-[var(--ui-bg-secondary)] border border-[var(--ui-border)] p-1 shadow-sm">
							<button
								class="rounded px-2 py-1.5 text-xs font-light text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
								onclick={() => theme.toggle()}
								aria-label={theme.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
							>
								{#if theme.isDark}
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
								{:else}
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
								{/if}
							</button>
							<div class="mx-1 h-4 w-px bg-[var(--ui-border)]"></div>
							<button class="rounded px-2 py-1.5 text-xs font-light text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]" onclick={() => diagram.setZoom(diagram.zoom / 1.2)} aria-label="Zoom Out">
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" /></svg>
							</button>
							<span class="min-w-[3rem] text-center text-xs font-light text-[var(--ui-text-muted)]">{Math.round(diagram.zoom * 100)}%</span>
							<button class="rounded px-2 py-1.5 text-xs font-light text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]" onclick={() => diagram.setZoom(diagram.zoom * 1.2)} aria-label="Zoom In">
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
							</button>
							<div class="mx-1 h-4 w-px bg-[var(--ui-border)]"></div>
							<button class="rounded px-2 py-1.5 text-xs font-light text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]" onclick={() => showExportModal = true} aria-label="ส่งออก">
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
							</button>
						</div>
					</div>
				{:else}
					<div data-onboarding="toolbar" class="toolbar-container absolute top-3 right-3 z-[60] max-w-[calc(100%-1.5rem)]" class:hidden={showChooser || showChat || ui.userMenuOpen || showLiveSql}>
						<Toolbar
							onexport={() => showExportModal = true}
							onimport={async () => {
								if (await collab.requestPermission('import')) showImportModal = true;
							}}
							onanalyze={async () => {
								if (await requireAi('ai-analysis')) showAnalysis = true;
							}}
							ontranslate={async () => {
								if (await requireAi('translate')) showTranslateModal = true;
							}}
							ongenerate={async () => { if (await requireAi('ai-analysis')) showGenerateCode = true; }}
						onchat={async () => {
							if (await requireAi('ai-analysis')) showChat = !showChat;
						}}
							oncollab={() => { if (auth.isSignedIn) showCollab = !showCollab; }}
							onhistory={() => showHistory = !showHistory}
							ontemplates={async () => {
								if (await collab.requestPermission('templates')) showTemplates = true;
							}}
							onaddrelationship={() => showRelForm = true}
							onaddnote={() => diagram.addNote('โน้ต')}
							ondatadict={() => showDataDict = !showDataDict}
							ondomainstarter={async () => {
								if (await requireAi('domain-starter')) showDomainStarter = true;
							}}
							onfitcontent={() => canvasComponent?.fitToContent()}
								onsqlquery={() => showSqlQuery = !showSqlQuery}
							onquiz={async () => { if (await requireAi('ai-analysis')) showQuiz = !showQuiz; }}
							onexplain={async () => { if (await requireAi('ai-analysis')) showExplain = true; }}
							onplayground={() => showPlayground = true}
							oncomments={() => showComments = true}
							ontutorial={() => triggerOnboarding()}
							oncommand={() => showCommandPalette = true}
							onlivesql={() => showLiveSql = true}
							onsampledata={() => showSampleData = true}
							onoptimize={async () => { if (await requireAi('ai-analysis')) showOptimize = true; }}
							onsketch={openPenDrawing}
							onflowsim={() => flowSim.toggle($state.snapshot(diagram.flowNodes), $state.snapshot(diagram.flowEdges))}
							onsmartrouting={() => diagram.toggleSmartRouting()}
							oncodetoflow={async () => { if (await requireAi('code-to-flow')) showCodeToFlow = true; }}
						/>
					</div>
				{/if}




				{#if diagram.diagramType === 'context' && diagram.dfdDrillPath.length > 0}
					<div class="pointer-events-none absolute top-3 left-3 z-20 md:left-[60px]">
						<nav class="pointer-events-auto flex max-w-[min(55vw,26rem)] items-center gap-1 overflow-x-auto rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] px-2 py-1.5 text-xs shadow-sm" aria-label="DFD level breadcrumb">
							{#each diagram.dfdBreadcrumb as crumb, i (crumb.id ?? 'root')}
								{#if i > 0}
									<svg class="h-3 w-3 shrink-0 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
								{/if}
								<button
									class="shrink-0 whitespace-nowrap rounded px-2 py-0.5 font-light transition hover:bg-[var(--ui-hover)] {i === diagram.dfdBreadcrumb.length - 1 ? 'font-normal text-[var(--ui-text)]' : 'text-[var(--ui-text-secondary)]'}"
									onclick={() => { diagram.drillToDFDLevel(i); tick().then(() => canvasComponent?.fitToContent()); }}
									disabled={i === diagram.dfdBreadcrumb.length - 1}
								>
									{crumb.name}
								</button>
							{/each}
						</nav>
					</div>
				{/if}


				<DiagramCanvas bind:this={canvasComponent} />


				{#if diagram.entities.length > 0 || diagram.flowNodes.length > 0 || diagram.dfdNodes.length > 0}
					<Minimap />
				{/if}



				{#if collab.connected}
					<div class="absolute bottom-3 left-3 z-10">
						<CollabIndicator />
					</div>
				{/if}


				{#if !diagram.viewOnly}
					<button
						data-onboarding="form-toggle"
						class="fixed bottom-5 left-5 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ui-accent)] text-[var(--ui-accent-text)] shadow-lg transition hover:opacity-90 active:opacity-80 lg:hidden"
						onclick={() => mobileFormOpen = !mobileFormOpen}
						aria-label="เปิดแผงฟอร์ม"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
					</button>
				{/if}

				</main>
		</div>
	</div>
{/if}


{#if showCommandPalette}
	<CommandPalette commands={buildCommands()} onclose={() => (showCommandPalette = false)} />
{/if}


<ToastContainer />


{#if showChooser}
	<WelcomeChooser onchoose={handleChoose} onclose={pendingNewTab ? () => { showChooser = false; pendingNewTab = false; } : undefined} />
{/if}


{#if showRelForm}
	<RelationshipForm onclose={() => showRelForm = false} />
{/if}


{#if showImportModal && ImportModal}
	<ImportModal initialTab={importInitialTab} onclose={() => { showImportModal = false; importInitialTab = undefined; }} />
{/if}


{#if showExportModal && ExportModal}
	<ExportModal onclose={() => showExportModal = false} {getSvgElement} />
{/if}


{#if showAnalysis && AnalysisPanel}
	<AnalysisPanel onclose={() => showAnalysis = false} />
{/if}


{#if showTranslateModal && TranslateModal}
	<TranslateModal onclose={() => showTranslateModal = false} />
{/if}


{#if showGenerateCode && GenerateCodeModal}
	<GenerateCodeModal onclose={() => showGenerateCode = false} />
{/if}


{#if showChat && ChatPanel}
	<ChatPanel onclose={() => showChat = false} />
{/if}


{#if showHistory && HistoryPanel}
	<HistoryPanel onclose={() => showHistory = false} />
{/if}


{#if showTemplates && TemplatesModal}
	<TemplatesModal onclose={() => showTemplates = false} />
{/if}


{#if showDomainStarter && DomainStarterModal}
	<DomainStarterModal onclose={() => showDomainStarter = false} />
{/if}


{#if showCodeToFlow && CodeToFlowModal}
	<CodeToFlowModal onclose={() => showCodeToFlow = false} />
{/if}

{#if showOptimize && OptimizePanel}
	<OptimizePanel onclose={() => showOptimize = false} />
{/if}


{#if showDataDict && DataDictionaryPanel}
	<DataDictionaryPanel onclose={() => showDataDict = false} />
{/if}



{#if SqlQueryPanel}
	<SqlQueryPanel visible={showSqlQuery} onclose={() => { showSqlQuery = false; }} />
{/if}


{#if highlight.active && !showSqlQuery}
	<div class="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--ui-border)] bg-[var(--ui-bg)] py-1 pl-3 pr-1 shadow-lg animate-slide-up">
		<button
			type="button"
			class="text-xs text-[var(--ui-text-secondary)] transition hover:text-[var(--ui-text)]"
			style="padding:0;min-width:0;min-height:0;"
			onclick={() => showSqlQuery = true}
		>
			<span class="inline-flex items-center gap-1.5">
				<span class="h-2 w-2 rounded-full bg-blue-500"></span>
				{highlight.entityIds.size} highlighted
			</span>
		</button>
		<button
			type="button"
			class="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
			style="padding:0;min-width:0;min-height:0;"
			aria-label="Clear highlight"
			onclick={() => highlight.clear()}
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>
	</div>
{/if}


{#if QuizPanel}
	<QuizPanel visible={showQuiz} onclose={() => showQuiz = false} onopen={() => showQuiz = true} />
{/if}


{#if showPlayground && SchemaPlaygroundPanel}
	<SchemaPlaygroundPanel onclose={() => showPlayground = false} />
{/if}

{#if showComments && CommentsPanel}
	<CommentsPanel onclose={() => showComments = false} />
{/if}

{#if showExplain && ExplainPanel}
	<ExplainPanel onclose={() => showExplain = false} />
{/if}


{#if showLiveSql && LiveSqlPanel}
	<LiveSqlPanel onclose={() => showLiveSql = false} />
{/if}


{#if showSampleData && SampleDataPanel}
	<SampleDataPanel onclose={() => showSampleData = false} />
{/if}


{#if auth.isSignedIn && showCollab}
	<CollabPanel onclose={() => showCollab = false} />
{/if}


<PermissionVoteModal />


{#if showSearch}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-start justify-center pt-20" onkeydown={() => {}}>
		<div class="search-overlay w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl">
			<div class="flex items-center gap-2 border-b border-[var(--ui-border)] px-4 py-3">
				<svg class="h-4 w-4 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search entities..."
					class="flex-1 bg-transparent text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-text-placeholder)] focus:outline-none"
					autofocus
				/>
				<button onclick={() => { showSearch = false; searchQuery = ''; }} class="rounded p-1 text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]" aria-label="Close search">
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			</div>
			{#if searchQuery.trim()}
				{@const results = getSearchResults()}
				<div class="max-h-60 overflow-y-auto p-1">
					{#if results.length === 0}
						<div class="px-4 py-3 text-xs text-[var(--ui-text-muted)]">No results</div>
					{:else}
						{#each results as result, i}
							<button
								class="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-left text-sm text-[var(--ui-text)] transition {i === searchIndex ? 'bg-[var(--ui-accent)]/10' : 'hover:bg-[var(--ui-hover)]'}"
								onclick={() => { selectAndPanTo(result.id); showSearch = false; searchQuery = ''; }}
							>
								{result.name}
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}


{#if showOnboarding}
	<OnboardingOverlayComponent onclose={() => { showOnboarding = false; localStorage.setItem('onboarding-done', '1'); }} />
{/if}


{#if kickedByDevice}
	<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-fade-in">
		<div class="w-full max-w-md rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg)] p-6 shadow-2xl animate-scale-in">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
					<svg class="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
					</svg>
				</div>
				<h2 class="text-lg font-semibold text-[var(--ui-text)]">
					{i18n.isEn ? 'Signed out on this device' : 'ออกจากระบบบนอุปกรณ์นี้'}
				</h2>
			</div>
			<p class="mb-2 text-sm leading-relaxed text-[var(--ui-text-secondary)]">
				{i18n.isEn
					? `Your account was opened on another device (${kickedByDevice}). To keep your data consistent, only one device can be signed in at a time.`
					: `บัญชีของคุณถูกเปิดใช้งานจากอีกอุปกรณ์ (${kickedByDevice}) เพื่อให้ข้อมูลตรงกัน จึงเข้าใช้ได้ทีละ 1 อุปกรณ์เท่านั้น`}
			</p>
			<p class="mb-5 flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
				<svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>
				{i18n.isEn ? 'Your work was saved to the cloud before signing out.' : 'งานของคุณถูกบันทึกขึ้นคลาวด์เรียบร้อยก่อนออกจากระบบ'}
			</p>
			<button
				onclick={() => { kickedByDevice = null; }}
				class="w-full rounded-xl bg-[var(--ui-accent)] px-4 py-2.5 text-sm font-medium text-[var(--ui-accent-text)] transition hover:opacity-90 active:scale-[0.98]"
			>
				{i18n.isEn ? 'Got it' : 'รับทราบ'}
			</button>
		</div>
	</div>
{/if}





{#if auth.isAdmin && ui.showAdminPanel}
	<AdminPanel />
{/if}


{#if ui.showUpgradeModal}
	<UpgradeModal onsubscribe={async () => {
		const token = sessionStorage.getItem('er-diagram:id-token');
		if (!auth.isSignedIn || !token) { ui.loginRequested = true; return; }
		try {
			const response = await fetch('/api/user/pro-session', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
			if (!response.ok) { ui.loginRequested = true; return; }
		} catch { return; }
		session.saveNow();
		ui.showUpgradeModal = false;
		void goto('/pro');
	}} />
{/if}

<DialogModal />

