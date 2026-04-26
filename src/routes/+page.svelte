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
	let mobileFormOpen = $state(false);

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
	}

	$effect(() => {
		showImportModal; showExportModal; showAnalysis; showTranslateModal;
		showGenerateCode; showChat; showPresentation; showHistory; showTemplates;
		showDataDict; showDomainStarter;
		lazyImport();
	});

	function getSvgElement() {
		return canvasComponent?.getSvgElement();
	}



	function handleKeydown(e: KeyboardEvent) {
		if (showPresentation || diagram.viewOnly) return;
		const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
		const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

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
		} else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC' && !isInput) {
			e.preventDefault();
			diagram.copySelected();
		} else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV' && !isInput) {
			e.preventDefault();
			diagram.paste();
		} else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA' && !isInput) {
			e.preventDefault();
			diagram.selectAll();
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
	}

	function enterApp() {
		showLogin = false;
		session.initSession();
		collab.loadUserName();
		registerSession(session);
		registerCollabForSession(collab);

		// Auto-join: URL param ?room=xxx takes priority, then saved room from refresh
		const params = new URLSearchParams(window.location.search);
		const roomParam = params.get('room');
		if (roomParam) {
			showCollab = true;
			// Check if we're the host of this room (preserved from previous session)
			let isHost = false;
			try {
				const saved = localStorage.getItem('collab-room');
				if (saved) {
					const parsed = JSON.parse(saved);
					if (parsed.roomId === roomParam.toLowerCase() && parsed.isHost) {
						isHost = true;
					}
				}
			} catch { /* ignore */ }
			collab.joinRoom(roomParam.toLowerCase(), isHost);
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

	// Watch for Google sign-in completing while on login screen
	$effect(() => {
		if (showLogin && auth.isSignedIn) {
			enterApp();
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

		if (session.activeDiagramId && !session.suppressAutoSave) {
			session.scheduleSave();
		}
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
					<div class="absolute top-3 right-3 z-10 max-w-[calc(100vw-1.5rem)]" class:hidden={showChat}>
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
							onchat={() => showChat = !showChat}
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
						/>
					</div>
				{/if}

				<!-- SVG Canvas -->
				<DiagramCanvas bind:this={canvasComponent} />

				<!-- Minimap -->
				{#if !showPresentation && diagram.entities.length > 0}
					<Minimap />
				{/if}

				<!-- Mobile FAB: open form panel -->
				{#if !showPresentation && !diagram.viewOnly}
					<button
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

<!-- Welcome chooser -->
{#if showChooser}
	<WelcomeChooser onchoose={handleChoose} />
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

<!-- Collaboration panel -->
{#if showCollab}
	<CollabPanel onclose={() => showCollab = false} />
{/if}

<!-- Permission vote modal -->
<PermissionVoteModal />

<!-- Global dialog -->
<DialogModal />
