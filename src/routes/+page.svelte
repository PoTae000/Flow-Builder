<script lang="ts">
	import { onMount } from 'svelte';
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
	import type { DiagramType } from '$lib/types/diagram';
	import { theme } from '$lib/stores/theme.svelte';
	import { session } from '$lib/stores/session.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { sync } from '$lib/stores/sync.svelte';
	import { collab, registerSession } from '$lib/stores/collab.svelte';
	import { registerCollabForSession } from '$lib/stores/session.svelte';
	import { initGoogleAuth } from '$lib/utils/google-auth';
	import { dialog } from '$lib/stores/dialog.svelte';
	import { parseShareHash } from '$lib/utils/share';
	import { highlight } from '$lib/stores/highlight.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import OnboardingOverlayComponent from '$lib/components/ui/OnboardingOverlay.svelte';
	import CollabIndicator from '$lib/components/ui/CollabIndicator.svelte';
	import ToastContainer from '$lib/components/ui/ToastContainer.svelte';
	import { autoSave, registerSession as registerAutoSaveSession } from '$lib/stores/auto-save.svelte';
	import { pickSaveLocation, writeToFile } from '$lib/utils/file-system';
	import { suggestions } from '$lib/stores/suggestions.svelte';
	import SuggestionBar from '$lib/components/ui/SuggestionBar.svelte';


	let ready = $state(false);
	let showLogin = $state(false);
	let showChooser = $state(false);
	let pendingNewTab = $state(false);
	let canvasComponent: DiagramCanvas | undefined = $state();
	let showRelForm = $state(false);
	let showImportModal = $state(false);
	let showExportModal = $state(false);
	let showAnalysis = $state(false);
	let showTranslateModal = $state(false);
	let showGenerateCode = $state(false);
	let showChat = $state(false);
	let showPresentation = $state(false);
	let showCollab = $state(false);
	let showHistory = $state(false);
	let showTemplates = $state(false);
	let showDataDict = $state(false);
	let showDomainStarter = $state(false);
	let showMatrix = $state(false);
	let showSqlQuery = $state(false);
	let showQuiz = $state(false);
	let mobileFormOpen = $state(false);
	let showSearch = $state(false);
	let searchQuery = $state('');
	let searchIndex = $state(0);
	let showOnboarding = $state(false);

	// A8: Lazy-loaded modal components
	let ImportModal: any = $state(null);
	let ExportModal: any = $state(null);
	let AnalysisPanel: any = $state(null);
	let TranslateModal: any = $state(null);
	let GenerateCodeModal: any = $state(null);
	let ChatPanel: any = $state(null);
	let PresentationMode: any = $state(null);
	let HistoryPanel: any = $state(null);
	let TemplatesModal: any = $state(null);
	let DataDictionaryPanel: any = $state(null);
	let DomainStarterModal: any = $state(null);
	let RelationshipMatrixPanel: any = $state(null);
	let SqlQueryPanel: any = $state(null);
	let QuizPanel: any = $state(null);

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
		if (showPresentation && !PresentationMode) {
			PresentationMode = (await import('$lib/components/ui/PresentationMode.svelte')).default;
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
		if (showMatrix && !RelationshipMatrixPanel) {
			RelationshipMatrixPanel = (await import('$lib/components/ui/RelationshipMatrixPanel.svelte')).default;
		}
		if (showSqlQuery && !SqlQueryPanel) {
			SqlQueryPanel = (await import('$lib/components/ui/SqlQueryPanel.svelte')).default;
		}
		if (showQuiz && !QuizPanel) {
			QuizPanel = (await import('$lib/components/ui/QuizPanel.svelte')).default;
		}
	}

	$effect(() => {
		showImportModal; showExportModal; showAnalysis; showTranslateModal;
		showGenerateCode; showChat; showPresentation; showHistory; showTemplates;
		showDataDict; showDomainStarter; showMatrix; showSqlQuery; showQuiz;
		lazyImport();
	});

	function getSvgElement() {
		return canvasComponent?.getSvgElement();
	}



	// Get all selectable node IDs based on diagram type
	function getAllNodeIds(): string[] {
		if (diagram.diagramType === 'er') return diagram.entities.map((e) => e.id);
		if (diagram.diagramType === 'flowchart') return diagram.flowNodes.map((n) => n.id);
		if (diagram.diagramType === 'context') return diagram.dfdNodes.map((n) => n.id);
		return [];
	}

	// Get search results filtered by query
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
		// Find position of the node to center on it
		let pos: { x: number; y: number } | undefined;
		if (diagram.diagramType === 'er') pos = diagram.entities.find((e) => e.id === id)?.position;
		else if (diagram.diagramType === 'flowchart') pos = diagram.flowNodes.find((n) => n.id === id)?.position;
		else pos = diagram.dfdNodes.find((n) => n.id === id)?.position;
		if (pos) {
			diagram.panX = -pos.x * diagram.zoom + (diagram.canvasWidth) / 2;
			diagram.panY = -pos.y * diagram.zoom + (diagram.canvasHeight) / 2;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (showPresentation || diagram.viewOnly) return;
		const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
		const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';
		// If user has text selected on the page, let browser handle copy/paste natively
		const hasTextSelection = (window.getSelection()?.toString().length ?? 0) > 0;

		// Handle search overlay keys
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
			return; // Let other keys go to the search input
		}

		// Use e.code for Ctrl shortcuts — works with any keyboard layout (Thai, etc.)
		if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
			e.preventDefault();
			diagram.undo();
		} else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && e.shiftKey) {
			e.preventDefault();
			diagram.redo();
		} else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
			e.preventDefault();
			diagram.redo();
		} else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC' && !isInput && !hasTextSelection) {
			e.preventDefault();
			diagram.copySelected();
		} else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV' && !isInput && !hasTextSelection) {
			e.preventDefault();
			diagram.paste();
		} else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA' && !isInput && !hasTextSelection) {
			e.preventDefault();
			diagram.selectAll();
		} else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
			e.preventDefault();
			handleSave();
		} else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyD' && !isInput) {
			e.preventDefault();
			diagram.toggleDataFlow();
		} else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyD' && !isInput) {
			e.preventDefault();
			diagram.duplicateSelected();
		} else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
			e.preventDefault();
			showSearch = !showSearch;
			searchQuery = '';
			searchIndex = 0;
		} else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyL' && !isInput) {
			e.preventDefault();
			if (collab.connected && collab.users.length > 1) {
				collab.requestPermission('auto-layout').then(granted => {
					if (granted) diagram.animateLayout();
				});
			} else {
				diagram.animateLayout();
			}
		} else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyG' && !isInput) {
			e.preventDefault();
			diagram.toggleGrid();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			diagram.clearSelection();
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
				const hasRels = diagram.relationships.some(r =>
					ids.includes(r.entityIds[0]) || ids.includes(r.entityIds[1])
				);
				const msg = count === 1
					? `ลบ "${diagram.entities.find(e => e.id === ids[0])?.name}"${hasRels ? ' และความสัมพันธ์ที่เกี่ยวข้อง' : ''}?`
					: `ลบ ${count} เอนทิตี${hasRels ? ' และความสัมพันธ์ที่เกี่ยวข้อง' : ''}?`;
				dialog.confirm({ title: 'ยืนยันการลบ', message: msg, confirmText: 'ลบ', variant: 'danger' })
					.then(ok => { if (ok) diagram.removeEntities(ids); });
			} else if (diagram.selectedEdgeId) {
				const relId = diagram.selectedEdgeId;
				const rel = diagram.relationships.find(r => r.id === relId);
				dialog.confirm({
					title: 'ยืนยันการลบ',
					message: `ลบความสัมพันธ์ "${rel?.name}"?`,
					confirmText: 'ลบ',
					variant: 'danger'
				}).then(ok => { if (ok) diagram.removeRelationship(relId); });
			}
		}
	}

	function handleNewDiagram() {
		pendingNewTab = true;
		showChooser = true;
	}

	function handleChoose(type: DiagramType, name: string) {
		const isFirstChoose = !pendingNewTab; // first-time user choosing their first diagram
		if (pendingNewTab) {
			session.createDiagram(name, type);
			pendingNewTab = false;
		} else {
			diagram.diagramType = type;
			// Rename active tab
			if (session.activeDiagramId) {
				session.renameDiagram(session.activeDiagramId, name);
			}
			session.saveNow();
		}
		showChooser = false;

		// Trigger onboarding after first-time chooser closes
		if (isFirstChoose && !localStorage.getItem('onboarding-done')) {
			triggerOnboarding();
		}

		// Prompt for auto-save after choosing diagram type
		promptForAutoSaveLocation();
	}

	function triggerOnboarding() {
		showOnboarding = true;
	}

	function enterApp() {
		showLogin = false;
		session.initSession();
		collab.loadUserName();
		registerSession(session);
		registerCollabForSession(collab);
		registerAutoSaveSession(session);

		// Auto-join: URL param ?room=xxx&token=yyy takes priority, then saved room from refresh
		const params = new URLSearchParams(window.location.search);
		const roomParam = params.get('room');
		const tokenParam = params.get('token');
		if (roomParam) {
			// Check if we're already in this room (refresh) or joining fresh
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
			// Only show modal for fresh joins, not refreshes
			if (!isRejoin) showCollab = true;
			collab.joinRoom(roomParam.toLowerCase(), isHost, tokenParam || undefined);
		} else {
			collab.tryRejoin();
		}

		// Start periodic cloud sync polling
		if (sync.canSync) {
			sync.startPolling(
				() => session.triggerFullSync(),
				() => !session.hasPendingSave
			);
		}

		// Show chooser only for first-time users (no saved diagrams in localStorage)
		if (session.isFirstTime) {
			showChooser = true;
		}

		ready = true;
	}

	// Re-sync when tab regains focus; pause polling when hidden
	function handleVisibility() {
		if (document.visibilityState === 'visible' && ready && auth.isSignedIn && sync.canSync) {
			session.triggerFullSync();
			sync.startPolling(
				() => session.triggerFullSync(),
				() => !session.hasPendingSave
			);
		} else {
			sync.stopPolling();
		}
	}

	onMount(async () => {
		document.addEventListener('visibilitychange', handleVisibility);

		// Check for share link first
		const shareData = await parseShareHash(window.location.hash);
		if (shareData) {
			diagram.entities = shareData.entities ?? [];
			diagram.relationships = shareData.relationships ?? [];
			diagram.notes = shareData.notes ?? [];
			diagram.notation = shareData.notation ?? 'crows-foot';
			diagram.diagramFont = shareData.diagramFont ?? "'TH Sarabun PSK', 'Sarabun', sans-serif";
			diagram.panX = shareData.panX ?? 0;
			diagram.panY = shareData.panY ?? 0;
			diagram.zoom = shareData.zoom ?? 1;
			diagram.viewOnly = true;
			ready = true;
			return;
		}

		// Init Google Auth early so the button renders on login screen
		initGoogleAuth();

		// If already signed in (restored from localStorage), skip login
		if (auth.isSignedIn) {
			enterApp();
		} else {
			showLogin = true;
		}
	});

	// Cleanup polling on component destroy (client-only via $effect)
	$effect(() => {
		return () => {
			sync.stopPolling();
		};
	});

	// Sync auto-save with active diagram
	$effect(() => {
		if (session.activeDiagramId) {
			autoSave.onDiagramSwitch();
		}
	});

	// Auto-start/stop auto-save timer when file handle or enabled state changes
	$effect(() => {
		if (autoSave.fileHandle && autoSave.enabled) {
			autoSave.start();
		}
		return () => autoSave.stop();
	});

	async function handleSave() {
		// If auto-save file handle exists, save there directly
		if (autoSave.fileHandle) {
			const ok = await autoSave.saveNow();
			if (ok) toast.success(`บันทึกแล้ว: ${autoSave.fileHandle.fileName}`);
			return;
		}

		// No file handle yet — open save picker
		const name = diagram.diagramName || 'diagram';
		const handle = await pickSaveLocation(`${name}.erd`);
		if (handle) {
			autoSave.setFileHandle(handle);
			toast.success(`บันทึกแล้ว: ${handle.fileName}`);
		}
	}

	// Track if user has dismissed auto-save prompt (per session)
	let autoSavePromptDismissed = $state(false);

	async function promptForAutoSaveLocation() {
		if (!autoSave.isSupported || diagram.viewOnly) return;
		if (autoSavePromptDismissed || autoSave.hasAutoSave) return;

		autoSavePromptDismissed = true;

		// Ask user if they want to set up auto-save
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

	// Watch for Google sign-in completing while on login screen
	$effect(() => {
		if (showLogin && auth.isSignedIn) {
			enterApp();
		}
	});

	// Sync local selection → collab awareness
	$effect(() => {
		const ids = diagram.selectedNodeIds;
		if (collab.connected) {
			collab.updateSelection(ids);
		}
	});

	// Sync presentation mode from collab
	$effect(() => {
		if (collab.connected && collab.presentationActive && !showPresentation) {
			showPresentation = true;
		}
		if (collab.connected && !collab.presentationActive && showPresentation) {
			showPresentation = false;
		}
	});

	// Auto-save on diagram DATA changes (skip during sync pull to avoid push-back loop)
	$effect(() => {
		diagram.entities;
		diagram.relationships;
		diagram.notes;
		diagram.notation;
		diagram.diagramFont;
		diagram.diagramType;
		diagram.flowNodes;
		diagram.flowEdges;
		diagram.dfdNodes;
		diagram.dfdFlows;

		if (session.activeDiagramId && !session.suppressAutoSave && !diagram.timelinePreviewActive) {
			session.scheduleSave();
		}
	});

	// Smart suggestions: auto-fetch after diagram changes (debounced 3s)
	let suggestionTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		// Track entity/relationship changes
		const entityCount = diagram.entities.length;
		const relCount = diagram.relationships.length;
		// Trigger only when: ER mode, >=3 entities, not in collab, cooldown passed, not dismissed
		if (diagram.diagramType !== 'er' || entityCount < 3 || collab.connected || !suggestions.canFetch) {
			return;
		}
		if (suggestionTimer) clearTimeout(suggestionTimer);
		suggestionTimer = setTimeout(() => {
			suggestionTimer = null;
			if (diagram.diagramType === 'er' && diagram.entities.length >= 3 && !collab.connected && suggestions.canFetch) {
				suggestions.fetchSuggestions(
					$state.snapshot(diagram.entities),
					$state.snapshot(diagram.relationships)
				);
			}
		}, 3000);
		return () => { if (suggestionTimer) { clearTimeout(suggestionTimer); suggestionTimer = null; } };
	});


	// Save viewport (pan/zoom) separately with longer debounce — no cloud push
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
	onbeforeunload={() => session.saveNow()}
/>

<svelte:head>
	<title>Flow Builder</title>
</svelte:head>

{#if showLogin}
	<div class="h-screen w-screen font-sans {theme.isDark ? 'dark' : ''}">
		<LoginScreen onskip={enterApp} />
	</div>
{:else if !ready}
	<!-- Skeleton loading -->
	<div class="flex h-screen w-screen flex-col overflow-hidden font-sans {theme.isDark ? 'dark' : ''}">
		<!-- Skeleton tab bar -->
		<div class="flex h-11 items-center border-b border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)] px-2">
			<div class="h-5 w-28 animate-pulse rounded bg-[var(--ui-border)]"></div>
			<div class="ml-auto h-6 w-6 animate-pulse rounded-full bg-[var(--ui-border)]"></div>
		</div>
		<div class="flex min-h-0 flex-1">
			<!-- Skeleton form panel (hidden on mobile) -->
			<div class="hidden lg:block w-72 shrink-0 border-r border-[var(--ui-border)] bg-[var(--ui-bg)] p-4">
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
			<!-- Skeleton canvas -->
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
		<!-- View-only banner -->
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

		<!-- Tab bar -->
		{#if !diagram.viewOnly}
			<DiagramTabs onnewdiagram={handleNewDiagram} />
		{/if}

		<!-- Main content -->
		<div class="flex min-h-0 flex-1">
			<!-- Left: Form Panel (desktop sidebar + mobile bottom sheet) — hidden in view-only -->
			{#if !diagram.viewOnly}
				<FormPanel mobileOpen={mobileFormOpen} onclose={() => mobileFormOpen = false} />
			{/if}

			<!-- Right: Canvas -->
			<main class="relative flex flex-1 flex-col overflow-hidden">
				<!-- Toolbar -->
				{#if diagram.viewOnly}
					<!-- Minimal view-only toolbar -->
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
					<div data-onboarding="toolbar" class="absolute top-3 right-3 z-10 max-w-[calc(100vw-1.5rem)]" class:hidden={showChat}>
						<Toolbar
							onexport={() => showExportModal = true}
							onimport={async () => {
								if (await collab.requestPermission('import')) showImportModal = true;
							}}
							onanalyze={async () => {
								if (await collab.requestPermission('ai-analysis')) showAnalysis = true;
							}}
							ontranslate={async () => {
								if (await collab.requestPermission('translate')) showTranslateModal = true;
							}}
							ongenerate={() => showGenerateCode = true}
						onchat={() => {
							console.log("[DEBUG] Chat clicked, showChat:", showChat, "ChatPanel:", !!ChatPanel);
							showChat = !showChat;
						}}
							oncollab={() => showCollab = !showCollab}
							onpresent={async () => {
								if (await collab.requestPermission('presentation')) {
									if (collab.connected) collab.pushPresentationStart();
									// Pre-load component before showing to avoid two-click issue
									if (!PresentationMode) {
										PresentationMode = (await import('$lib/components/ui/PresentationMode.svelte')).default;
									}
									showPresentation = true;
								}
							}}
							onhistory={() => showHistory = !showHistory}
							ontemplates={async () => {
								if (await collab.requestPermission('templates')) showTemplates = true;
							}}
							onaddrelationship={() => showRelForm = true}
							onaddnote={() => diagram.addNote('โน้ต')}
							ondatadict={() => showDataDict = !showDataDict}
							ondomainstarter={async () => {
								if (await collab.requestPermission('domain-starter')) showDomainStarter = true;
							}}
							onfitcontent={() => canvasComponent?.fitToContent()}
							onmatrix={() => showMatrix = !showMatrix}
							onsqlquery={() => showSqlQuery = !showSqlQuery}
							onquiz={() => showQuiz = !showQuiz}
							ontutorial={() => triggerOnboarding()}
						/>
					</div>
				{/if}

				<!-- Smart suggestions bar -->
				{#if !showPresentation && !diagram.viewOnly && diagram.diagramType === 'er' && !showChat}
					<SuggestionBar />
				{/if}

				<!-- SVG Canvas -->
				<DiagramCanvas bind:this={canvasComponent} />

				<!-- Minimap -->
				{#if !showPresentation && diagram.entities.length > 0}
					<Minimap />
				{/if}


				<!-- Collab indicator -->
				{#if collab.connected}
					<div class="absolute bottom-3 left-3 z-10">
						<CollabIndicator />
					</div>
				{/if}

				<!-- Mobile FAB: open form panel -->
				{#if !showPresentation && !diagram.viewOnly}
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

<!-- Toast notifications -->
<ToastContainer />

<!-- Welcome chooser -->
{#if showChooser}
	<WelcomeChooser onchoose={handleChoose} onclose={pendingNewTab ? () => { showChooser = false; pendingNewTab = false; } : undefined} />
{/if}

<!-- Relationship popup -->
{#if showRelForm}
	<RelationshipForm onclose={() => showRelForm = false} />
{/if}

<!-- Import modal (lazy) -->
{#if showImportModal && ImportModal}
	<ImportModal onclose={() => showImportModal = false} />
{/if}

<!-- Export modal (lazy) -->
{#if showExportModal && ExportModal}
	<ExportModal onclose={() => showExportModal = false} {getSvgElement} />
{/if}

<!-- AI Analysis panel (lazy) -->
{#if showAnalysis && AnalysisPanel}
	<AnalysisPanel onclose={() => showAnalysis = false} />
{/if}

<!-- Translate modal (lazy) -->
{#if showTranslateModal && TranslateModal}
	<TranslateModal onclose={() => showTranslateModal = false} />
{/if}

<!-- Generate Code modal (lazy) -->
{#if showGenerateCode && GenerateCodeModal}
	<GenerateCodeModal onclose={() => showGenerateCode = false} />
{/if}

<!-- AI Chat panel (lazy) -->
{#if showChat && ChatPanel}
	<ChatPanel onclose={() => showChat = false} />
{/if}

<!-- Presentation mode (lazy) -->
{#if showPresentation && PresentationMode}
	<PresentationMode onclose={() => showPresentation = false} />
{/if}

<!-- History panel (lazy) -->
{#if showHistory && HistoryPanel}
	<HistoryPanel onclose={() => showHistory = false} />
{/if}

<!-- Templates modal (lazy) -->
{#if showTemplates && TemplatesModal}
	<TemplatesModal onclose={() => showTemplates = false} />
{/if}

<!-- Domain Starter modal (lazy) -->
{#if showDomainStarter && DomainStarterModal}
	<DomainStarterModal onclose={() => showDomainStarter = false} />
{/if}

<!-- Data Dictionary panel (lazy) -->
{#if showDataDict && DataDictionaryPanel}
	<DataDictionaryPanel onclose={() => showDataDict = false} />
{/if}

<!-- Relationship Matrix panel (lazy) -->
{#if showMatrix && RelationshipMatrixPanel}
	<RelationshipMatrixPanel onclose={() => showMatrix = false} />
{/if}

<!-- SQL Query Visualizer panel (lazy) -->
{#if showSqlQuery && SqlQueryPanel}
	<SqlQueryPanel onclose={() => { showSqlQuery = false; highlight.clear(); }} />
{/if}

<!-- Quiz panel (lazy) — stays mounted to preserve state -->
{#if QuizPanel}
	<QuizPanel visible={showQuiz} onclose={() => showQuiz = false} onopen={() => showQuiz = true} />
{/if}

<!-- Collaboration panel -->
{#if showCollab}
	<CollabPanel onclose={() => showCollab = false} />
{/if}

<!-- Permission vote modal -->
<PermissionVoteModal />

<!-- Search overlay -->
{#if showSearch}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-start justify-center pt-20" onkeydown={() => {}}>
		<div class="w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-2xl">
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

<!-- Onboarding overlay -->
{#if showOnboarding}
	<OnboardingOverlayComponent onclose={() => { showOnboarding = false; localStorage.setItem('onboarding-done', '1'); }} />
{/if}

<!-- Global dialog -->
<DialogModal />
