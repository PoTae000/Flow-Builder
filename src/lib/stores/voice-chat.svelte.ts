import type * as Y from 'yjs';



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
			
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			});

			this.myStream = stream;
			this.enabled = true;
			this.muted = true; 
			this.error = null;

			
			this.audioContext = new AudioContext();
			const source = this.audioContext.createMediaStreamSource(stream);
			this.analyser = this.audioContext.createAnalyser();
			this.analyser.fftSize = 256;
			source.connect(this.analyser);

			
			this.startSpeakingDetection();

			
			this.broadcastVoiceState();
		} catch (err) {
			console.error('Failed to start voice:', err);
			this.error = 'ไม่สามารถเข้าถึงไมโครโฟนได้';
			this.enabled = false;
		}
	}

	stopVoice() {
		
		if (this.myStream) {
			this.myStream.getTracks().forEach(track => track.stop());
			this.myStream = null;
		}

		
		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}

		
		if (this.speakingCheckInterval) {
			clearInterval(this.speakingCheckInterval);
			this.speakingCheckInterval = null;
		}

		
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

		
		this.broadcastVoiceState();
	}

	toggleMute() {
		if (!this.enabled || !this.myStream) return;
		this.muted = !this.muted;
		
		this.myStream.getAudioTracks().forEach(track => {
			track.enabled = !this.muted;
		});
		this.broadcastVoiceState();
	}

	toggleDeafen() {
		this.deafened = !this.deafened;
		
		this.peers.forEach(peer => {
			if (peer.audio) {
				peer.audio.muted = this.deafened;
			}
		});
	}

	private startSpeakingDetection() {
		if (!this.analyser) return;

		const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
		const SPEAKING_THRESHOLD = 30; 

		this.speakingCheckInterval = setInterval(() => {
			if (!this.analyser || !this.enabled || this.muted) return;

			this.analyser.getByteFrequencyData(dataArray);
			const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

			const isSpeaking = average > SPEAKING_THRESHOLD;

			
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

	
	connect(doc: Y.Doc, localClientId: number) {
		this._doc = doc;
		this._localClientId = localClientId;

		
		const yVoice = doc.getMap('voice');
		yVoice.observe((event) => {
			event.changes.keys.forEach((change, key) => {
				if (key.startsWith('client-')) {
					const clientId = parseInt(key.replace('client-', ''));
					if (clientId === this._localClientId) return; 

					const state = yVoice.get(key) as { enabled: boolean; muted: boolean; speaking: boolean };

					if (state && state.enabled) {
						
						if (!this.peers.has(clientId)) {
							this.peers.set(clientId, {
								clientId,
								userName: 'User',
								stream: null,
								audio: null,
								speaking: state.speaking
							});
						} else {
							
							const peer = this.peers.get(clientId);
							if (peer) peer.speaking = state.speaking;
						}
					} else {
						
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
