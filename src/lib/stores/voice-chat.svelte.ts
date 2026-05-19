import type * as Y from 'yjs';

/**
 * Voice Chat State Management
 *
 * TODO: Full WebRTC Audio Implementation Needed
 *
 * Current implementation provides:
 * - Microphone access and control (mute/unmute/deafen)
 * - Voice activity detection (speaking indicator)
 * - State synchronization via Y.js
 * - UI controls and visual feedback
 *
 * Missing for production-ready voice chat:
 * - WebRTC peer-to-peer connections for audio streaming
 * - SDP offer/answer exchange via Y.js signaling
 * - ICE candidate gathering and exchange
 * - Audio track management on peer connections
 * - Connection quality monitoring
 * - Echo cancellation tuning
 *
 * For full implementation, consider using:
 * - simple-peer library for WebRTC abstraction
 * - Or native RTCPeerConnection API
 * - Y.js maps for signaling (offers, answers, ICE candidates)
 */

interface AudioPeer {
	clientId: number;
	userName: string;
	stream: MediaStream | null;
	audio: HTMLAudioElement | null;
	speaking: boolean;
}

export class VoiceChatState {
	enabled = $state(false);
	muted = $state(true);
	deafened = $state(false);
	myStream = $state<MediaStream | null>(null);
	peers = $state<Map<number, AudioPeer>>(new Map());
	error = $state<string | null>(null);

	private _doc: Y.Doc | null = null;
	private _localClientId: number = -1;
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private speakingCheckInterval: ReturnType<typeof setInterval> | null = null;

	async toggleVoice() {
		if (this.enabled) {
			this.stopVoice();
		} else {
			await this.startVoice();
		}
	}

	async startVoice() {
		if (!this._doc) {
			this.error = 'Not connected to room';
			return;
		}

		try {
			// Request microphone permission
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			});

			this.myStream = stream;
			this.enabled = true;
			this.muted = true; // Start muted by default
			this.error = null;

			// Create audio context for voice activity detection
			this.audioContext = new AudioContext();
			const source = this.audioContext.createMediaStreamSource(stream);
			this.analyser = this.audioContext.createAnalyser();
			this.analyser.fftSize = 256;
			source.connect(this.analyser);

			// Start speaking detection
			this.startSpeakingDetection();

			// Broadcast that I've enabled voice
			this.broadcastVoiceState();
		} catch (err) {
			console.error('Failed to start voice:', err);
			this.error = 'ไม่สามารถเข้าถึงไมโครโฟนได้';
			this.enabled = false;
		}
	}

	stopVoice() {
		// Stop my stream
		if (this.myStream) {
			this.myStream.getTracks().forEach(track => track.stop());
			this.myStream = null;
		}

		// Stop audio context
		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}

		// Stop speaking detection
		if (this.speakingCheckInterval) {
			clearInterval(this.speakingCheckInterval);
			this.speakingCheckInterval = null;
		}

		// Stop all peer streams
		this.peers.forEach(peer => {
			if (peer.audio) {
				peer.audio.pause();
				peer.audio.srcObject = null;
				peer.audio = null;
			}
		});
		this.peers.clear();

		this.enabled = false;
		this.muted = true;
		this.error = null;

		// Broadcast that I've disabled voice
		this.broadcastVoiceState();
	}

	toggleMute() {
		if (!this.enabled || !this.myStream) return;
		this.muted = !this.muted;
		// Enable/disable audio track
		this.myStream.getAudioTracks().forEach(track => {
			track.enabled = !this.muted;
		});
		this.broadcastVoiceState();
	}

	toggleDeafen() {
		this.deafened = !this.deafened;
		// Mute/unmute all peer audio elements
		this.peers.forEach(peer => {
			if (peer.audio) {
				peer.audio.muted = this.deafened;
			}
		});
	}

	private startSpeakingDetection() {
		if (!this.analyser) return;

		const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
		const SPEAKING_THRESHOLD = 30; // Adjust based on testing

		this.speakingCheckInterval = setInterval(() => {
			if (!this.analyser || !this.enabled || this.muted) return;

			this.analyser.getByteFrequencyData(dataArray);
			const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

			const isSpeaking = average > SPEAKING_THRESHOLD;

			// Broadcast speaking state if changed
			this.broadcastVoiceState(isSpeaking);
		}, 100);
	}

	private broadcastVoiceState(speaking = false) {
		if (!this._doc) return;

		const yVoice = this._doc.getMap('voice');
		const myState = {
			enabled: this.enabled,
			muted: this.muted,
			speaking: speaking && !this.muted,
			clientId: this._localClientId
		};

		yVoice.set(`client-${this._localClientId}`, myState);
	}

	/** Set up voice chat for a room (called from collab.svelte.ts) */
	connect(doc: Y.Doc, localClientId: number) {
		this._doc = doc;
		this._localClientId = localClientId;

		// Observe voice state changes from other users
		const yVoice = doc.getMap('voice');
		yVoice.observe((event) => {
			event.changes.keys.forEach((change, key) => {
				if (key.startsWith('client-')) {
					const clientId = parseInt(key.replace('client-', ''));
					if (clientId === this._localClientId) return; // Skip self

					const state = yVoice.get(key) as { enabled: boolean; muted: boolean; speaking: boolean };

					if (state && state.enabled) {
						// Peer enabled voice - set up audio playback
						if (!this.peers.has(clientId)) {
							this.peers.set(clientId, {
								clientId,
								userName: 'User',
								stream: null,
								audio: null,
								speaking: state.speaking
							});
						} else {
							// Update speaking state
							const peer = this.peers.get(clientId);
							if (peer) peer.speaking = state.speaking;
						}
					} else {
						// Peer disabled voice
						const peer = this.peers.get(clientId);
						if (peer && peer.audio) {
							peer.audio.pause();
							peer.audio.srcObject = null;
							peer.audio = null;
						}
						this.peers.delete(clientId);
					}
				}
			});
		});
	}

	disconnect() {
		this.stopVoice();
		this._doc = null;
		this._localClientId = -1;
	}
}

export const voiceChat = new VoiceChatState();
