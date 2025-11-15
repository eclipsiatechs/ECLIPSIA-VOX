// script.js
// ==================================================================================
// ELITE AI VOICE SYNTHESIS PLATFORM - ECLIPSIA-VOX
// ==================================================================================

// ----------------------------------------------------------------------------------
// API CONFIGURATION
// ----------------------------------------------------------------------------------
const PLACEHOLDER_KEY = "AIzaSyDSzlDGFWjfzgIGBxwgAMdIRWbgoLdgg7M";
const apiKey = "AIzaSyCk3kELMbxNQupAtGmvX5dePa3gVxXgB2Q";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

// --- ACTUAL Google TTS Voices (Only voices that exist in the API) ---
const VOICES = [
    { name: "Kore", label: "Kore (Standard - Firm)" },
    { name: "Fenrir", label: "Fenrir (Standard - Energetic)" },
    { name: "Zephyr", label: "Zephyr (Standard - Bright)" },
    { name: "Puck", label: "Puck (Standard - Upbeat)" },
    { name: "Charon", label: "Charon (Standard - Calm)" },
    { name: "Leda", label: "Leda (Standard - Youthful)" },
    { name: "Alnilam", label: "Alnilam (Standard - Serious)" },
    { name: "Sulafat", label: "Sulafat (Standard - Warm)" },
    { name: "Achernar", label: "Achernar (Clear - Professional)" },
    { name: "Algieba", label: "Algieba (Warm - Expressive)" },
    { name: "Schedar", label: "Schedar (Deep - Authoritative)" },
    { name: "Gacrux", label: "Gacrux (Smooth - Calming)" },
    { name: "Vindemiatrix", label: "Vindemiatrix (Elegant - Sophisticated)" }
];

// Global state management
let currentAudioBlob = null;
let audioChunks = [];
const MAX_RETRIES = 3;
const CHUNK_SIZE = 1800;

// DOM Elements Cache
const elements = {
    textInput: document.getElementById('text-input'),
    readButton: document.getElementById('read-button'),
    loadingIndicator: document.getElementById('loading-indicator'),
    buttonText: document.getElementById('button-text'),
    statusMessage: document.getElementById('status-message'),
    audioPlayer: document.getElementById('audio-player'),
    audioControlsContainer: document.getElementById('audio-player-controls'),
    charCount: document.getElementById('char-count'),
    voiceSelector: document.getElementById('voice-selector'),
    selectedVoiceInfo: document.getElementById('selected-voice-info'),
    appGatekeeper: document.getElementById('app-gatekeeper'),
    appCardMain: document.getElementById('app-card-main'),
    downloadButton: document.getElementById('download-button'),
    joinState: document.getElementById('join-state'),
    accessState: document.getElementById('access-state')
};

// ----------------------------------------------------------------------------------
// PREMIUM GATEKEEPER LOGIC
// ----------------------------------------------------------------------------------

/**
 * Elite access protocol - opens Telegram channel and transitions UI
 */
window.promptAccess = function() {
    // Enhanced telemetry with animation
    animateButtonPress(elements.joinState.querySelector('button'));
    
    // Open Telegram in new tab with enhanced user experience
    const telegramWindow = window.open('https://t.me/eclipsia_techs', '_blank');
    
    // Add visual feedback
    elements.joinState.style.opacity = '0.7';
    setTimeout(() => {
        elements.joinState.classList.add('hidden');
        elements.accessState.classList.remove('hidden');
        elements.accessState.style.opacity = '0';
        setTimeout(() => {
            elements.accessState.style.opacity = '1';
            elements.accessState.style.transition = 'opacity 0.5s ease-in-out';
        }, 50);
    }, 300);
}

/**
 * Unlocks the premium application interface
 */
window.unlockApp = function() {
    // Add unlock animation
    animateButtonPress(elements.accessState.querySelector('button'));
    
    // Set persistence with enhanced security
    localStorage.setItem('eclipsiaVoxAccess', 'true');
    localStorage.setItem('accessTimestamp', Date.now().toString());
    
    // Premium transition animation
    elements.appGatekeeper.style.transform = 'scale(0.9)';
    elements.appGatekeeper.style.opacity = '0';
    
    setTimeout(() => {
        elements.appGatekeeper.classList.add('hidden');
        elements.appCardMain.classList.remove('hidden');
        elements.appCardMain.style.opacity = '0';
        elements.appCardMain.style.transform = 'scale(0.8) translateY(20px)';
        
        setTimeout(() => {
            elements.appCardMain.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            elements.appCardMain.style.opacity = '1';
            elements.appCardMain.style.transform = 'scale(1) translateY(0)';
        }, 50);
    }, 300);
}

// ----------------------------------------------------------------------------------
// VOICE MANAGEMENT SYSTEM
// ----------------------------------------------------------------------------------

/**
 * Populates voice selector with actual available options
 */
function populateVoiceSelector() {
    VOICES.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = voice.label;
        option.style.background = 'rgba(15, 23, 42, 0.9)';
        option.style.color = '#e2e8f0';
        elements.voiceSelector.appendChild(option);
        
        // Add subtle entrance animation
        setTimeout(() => {
            option.style.transition = 'all 0.3s ease';
            option.style.opacity = '1';
        }, index * 100);
    });
    
    updateSelectedVoiceInfo(VOICES[0]);
}

/**
 * Updates voice information display with animation
 */
function updateSelectedVoiceInfo(selectedVoice) {
    elements.selectedVoiceInfo.textContent = selectedVoice.label;
    elements.selectedVoiceInfo.style.animation = 'none';
    setTimeout(() => {
        elements.selectedVoiceInfo.style.animation = 'fade-loop-dark 3s ease-in-out infinite';
    }, 10);
}

// Voice selector event with enhanced feedback
elements.voiceSelector.addEventListener('change', () => {
    const selectedVoice = VOICES.find(v => v.name === elements.voiceSelector.value);
    if (selectedVoice) {
        updateSelectedVoiceInfo(selectedVoice);
        // Add selection feedback
        elements.voiceSelector.style.boxShadow = '0 0 15px rgba(30, 64, 175, 0.4)';
        setTimeout(() => {
            elements.voiceSelector.style.boxShadow = '';
        }, 1000);
    }
});

// ----------------------------------------------------------------------------------
// AUDIO PROCESSING ENGINE
// ----------------------------------------------------------------------------------

/**
 * Converts Base64 to ArrayBuffer with error handling
 */
function base64ToArrayBuffer(base64) {
    try {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (error) {
        throw new Error('Invalid audio data format');
    }
}

/**
 * Converts PCM to WAV format
 */
function pcmToWav(pcm16, sampleRate = 24000) {
    const numChannels = 1;
    const bytesPerSample = 2;
    const dataLength = pcm16.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    let offset = 0;

    // RIFF chunk descriptor
    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, 36 + dataLength, true); offset += 4;
    writeString(view, offset, 'WAVE'); offset += 4;

    // FMT chunk
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, numChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * numChannels * bytesPerSample, true); offset += 4;
    view.setUint16(offset, numChannels * bytesPerSample, true); offset += 2;
    view.setUint16(offset, bytesPerSample * 8, true); offset += 2;

    // DATA chunk
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, dataLength, true); offset += 4;

    // Write PCM data
    for (let i = 0; i < pcm16.length; i++, offset += bytesPerSample) {
        view.setInt16(offset, pcm16[i], true);
    }

    return new Blob([view], { type: 'audio/wav' });

    function writeString(view, offset, str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }
}

/**
 * Smart text chunking that preserves sentence boundaries
 */
function splitTextIntoChunks(text, chunkSize = CHUNK_SIZE) {
    if (text.length <= chunkSize) {
        return [text];
    }

    const chunks = [];
    let currentChunk = '';

    // Split by sentences first
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = sentence;
        } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Generate audio for a single text chunk
 */
async function generateAudioChunk(text, voiceName, retryCount = 0) {
    const payload = {
        contents: [{
            parts: [{ text: text }]
        }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName }
                }
            }
        },
        model: "gemini-2.5-flash-preview-tts"
    };

    try {
        console.log(`Generating audio chunk with voice: ${voiceName}`);
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Client-Version': 'ECLIPSIA-VOX-PREMIUM-1.0'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error ${response.status}:`, errorText);
            
            if (response.status === 429) {
                throw new Error(`API rate limit exceeded (429)`);
            } else if (response.status === 400) {
                throw new Error(`Voice ${voiceName} is not supported by the API`);
            }
            throw new Error(`API returned status ${response.status}`);
        }

        const result = await response.json();
        console.log('API Response received successfully');
        
        const part = result?.candidates?.[0]?.content?.parts?.[0];
        const audioData = part?.inlineData?.data;
        
        if (!audioData) {
            throw new Error("No audio data in response");
        }

        return audioData;

    } catch (error) {
        console.error(`Chunk generation error (attempt ${retryCount + 1}):`, error);
        
        if (retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 1000;
            console.log(`Retrying chunk in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return generateAudioChunk(text, voiceName, retryCount + 1);
        }
        throw error;
    }
}

// ----------------------------------------------------------------------------------
// SIMPLE AUDIO PLAYBACK
// ----------------------------------------------------------------------------------

/**
 * Combine all audio chunks into a single playable WAV file
 */
function combineAudioChunks(audioChunksData) {
    try {
        const allPcmData = [];
        let totalLength = 0;
        
        // Convert all chunks to PCM and calculate total length
        for (const audioData of audioChunksData) {
            const pcmBuffer = base64ToArrayBuffer(audioData);
            const pcm16 = new Int16Array(pcmBuffer);
            allPcmData.push(pcm16);
            totalLength += pcm16.length;
        }
        
        // Combine all PCM data
        const combinedPcm = new Int16Array(totalLength);
        let offset = 0;
        for (const pcmChunk of allPcmData) {
            combinedPcm.set(pcmChunk, offset);
            offset += pcmChunk.length;
        }
        
        // Convert to WAV
        return pcmToWav(combinedPcm, 24000);
        
    } catch (error) {
        console.error('Audio combination error:', error);
        throw new Error('Failed to combine audio: ' + error.message);
    }
}

/**
 * Play audio using the HTML5 audio element
 */
function playAudio(wavBlob) {
    return new Promise((resolve, reject) => {
        try {
            const audioUrl = URL.createObjectURL(wavBlob);
            elements.audioPlayer.src = audioUrl;
            elements.audioControlsContainer.classList.add('visible');
            
            // Set up event listeners
            const onCanPlay = () => {
                elements.audioPlayer.play().then(() => {
                    showStatus("Audio playback started! 🎵", 'success');
                    resolve();
                }).catch(playError => {
                    console.error('Play failed:', playError);
                    showStatus("Click the play button to start audio", 'info');
                    resolve(); // Still resolve so download works
                });
            };
            
            const onError = (error) => {
                console.error('Audio error:', error);
                reject(new Error('Audio playback failed'));
            };
            
            elements.audioPlayer.addEventListener('canplaythrough', onCanPlay, { once: true });
            elements.audioPlayer.addEventListener('error', onError, { once: true });
            
            // Fallback in case events don't fire
            setTimeout(() => {
                if (elements.audioPlayer.readyState >= 3) {
                    onCanPlay();
                }
            }, 1000);
            
        } catch (error) {
            reject(error);
        }
    });
}

// ----------------------------------------------------------------------------------
// DOWNLOAD MANAGEMENT
// ----------------------------------------------------------------------------------

/**
 * Premium download handler
 */
window.downloadAudio = function() {
    if (!currentAudioBlob) {
        showStatus("No audio generated yet. Please synthesize text first.", 'error');
        return;
    }

    try {
        animateButtonPress(elements.downloadButton);
        
        const url = URL.createObjectURL(currentAudioBlob);
        const a = document.createElement('a');
        a.href = url;
        
        // Generate premium filename with timestamp
        const now = new Date();
        const filename = `ECLIPSIA_VOX_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}.wav`;
        a.download = filename;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        showStatus("Premium WAV download initiated! 📥", 'success');
        
    } catch (error) {
        console.error("Download Error:", error);
        showStatus("Download failed. Please try again.", 'error');
    }
}

// ----------------------------------------------------------------------------------
// UI ENHANCEMENTS & ANIMATIONS
// ----------------------------------------------------------------------------------

/**
 * Character counter with premium styling
 */
elements.textInput.addEventListener('input', () => {
    const count = elements.textInput.value.length;
    elements.charCount.textContent = `${count} Characters`;
    
    // Dynamic color based on length
    if (count > 3000) {
        elements.charCount.style.color = '#f87171';
        elements.charCount.style.textShadow = '0 0 8px rgba(248, 113, 113, 0.6)';
    } else if (count > 2000) {
        elements.charCount.style.color = '#fbbf24';
        elements.charCount.style.textShadow = '0 0 8px rgba(251, 191, 36, 0.6)';
    } else {
        elements.charCount.style.color = '#94a3b8';
        elements.charCount.style.textShadow = 'none';
    }
});

/**
 * Enhanced loading state management
 */
function setLoadingState(isLoading) {
    elements.readButton.disabled = isLoading;
    elements.loadingIndicator.classList.toggle('hidden', !isLoading);
    elements.buttonText.textContent = isLoading ? 'Synthesizing...' : 'Synthesize & Read Aloud';
    
    if (isLoading) {
        elements.readButton.style.background = 'linear-gradient(135deg, #1e40af 0%, #3730a3 100%)';
        elements.readButton.style.animation = 'pulse 2s infinite';
    } else {
        elements.readButton.style.animation = 'none';
    }
}

/**
 * Premium status display system
 */
function showStatus(message, type = 'info') {
    elements.statusMessage.textContent = message;
    elements.statusMessage.classList.remove('hidden', 'status-error', 'status-success', 'status-info');
    
    let classes = 'mt-4 text-center p-3 rounded-xl text-sm border';
    if (type === 'error') {
        classes += ' status-error';
        elements.statusMessage.style.animation = 'shake 0.5s ease-in-out';
    } else if (type === 'success') {
        classes += ' status-success';
        elements.statusMessage.style.animation = 'fade-in-dark 0.5s ease-out';
    } else {
        classes += ' status-info';
        elements.statusMessage.style.animation = 'fade-in-dark 0.5s ease-out';
    }
    
    elements.statusMessage.className = classes;
    
    // Auto-clear success/info messages
    if (type !== 'error') {
        setTimeout(() => {
            clearStatus();
        }, 5000);
    }
}

function clearStatus() {
    elements.statusMessage.classList.add('hidden');
    elements.statusMessage.style.animation = '';
}

/**
 * Button press animation
 */
function animateButtonPress(button) {
    button.style.transform = 'scale(0.95)';
    button.style.transition = 'transform 0.1s ease';
    
    setTimeout(() => {
        button.style.transform = 'scale(1)';
    }, 100);
}

// ----------------------------------------------------------------------------------
// CORE SYNTHESIS ENGINE
// ----------------------------------------------------------------------------------

/**
 * Elite audio generation with proper error handling
 */
async function generateAndPlayAudio(text, voiceName, voiceLabel) {
    // Reset state for new generation
    currentAudioBlob = null;
    elements.downloadButton.disabled = true;
    audioChunks = [];

    // Clear previous audio
    elements.audioPlayer.src = '';
    elements.audioControlsContainer.classList.remove('visible');

    // API key validation
    if (apiKey === PLACEHOLDER_KEY || !apiKey) {
        setLoadingState(false);
        showStatus("CRITICAL ERROR: Invalid API configuration. Please contact support.", 'error');
        return;
    }

    try {
        // Split text into manageable chunks
        const textChunks = splitTextIntoChunks(text);
        
        if (textChunks.length > 1) {
            showStatus(`Processing ${textChunks.length} audio segments...`, 'info');
        } else {
            showStatus(`Synthesizing with ${voiceLabel}...`, 'info');
        }

        const audioChunksData = [];
        
        // Process each chunk with progress updates
        for (let i = 0; i < textChunks.length; i++) {
            if (textChunks.length > 1) {
                showStatus(`Generating segment ${i + 1} of ${textChunks.length}...`, 'info');
            }
            
            const audioData = await generateAudioChunk(textChunks[i], voiceName);
            audioChunksData.push(audioData);
            
            // Small delay between API calls to avoid rate limiting
            if (i < textChunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Create combined audio file
        showStatus("Combining audio segments...", 'info');
        const combinedWavBlob = combineAudioChunks(audioChunksData);
        currentAudioBlob = combinedWavBlob;
        elements.downloadButton.disabled = false;

        // Play the audio
        showStatus("Preparing audio playback...", 'info');
        await playAudio(combinedWavBlob);

    } catch (error) {
        console.error("TTS API Error:", error);
        
        if (error.message.includes('429')) {
            showStatus("Rate limit reached. Please wait 60 seconds before retrying.", 'error');
        } else if (error.message.includes('not supported')) {
            showStatus(`Voice error: ${error.message}. Please select a different voice.`, 'error');
        } else if (error.message.includes('No audio data')) {
            showStatus("API returned no audio data. Please check your text and try again.", 'error');
        } else {
            showStatus(`Synthesis failed: ${error.message}`, 'error');
        }
    } finally {
        setLoadingState(false);
    }
}

// ----------------------------------------------------------------------------------
// MAIN APPLICATION HANDLER
// ----------------------------------------------------------------------------------

/**
 * Elite synthesis handler with premium user experience
 */
window.handleGenerate = function() {
    // Stop any current playback
    if (elements.audioPlayer.src) {
        elements.audioPlayer.pause();
        elements.audioPlayer.src = '';
    }
    
    clearStatus();
    const text = elements.textInput.value.trim();
    
    if (text.length === 0) {
        showStatus("Please enter text to synthesize.", 'error');
        animateButtonPress(elements.readButton);
        return;
    }

    // Get selected voice
    const selectedVoiceName = elements.voiceSelector.value;
    const selectedVoice = VOICES.find(v => v.name === selectedVoiceName);
    const selectedVoiceLabel = selectedVoice ? selectedVoice.label : selectedVoiceName;

    setLoadingState(true);
    animateButtonPress(elements.readButton);
    generateAndPlayAudio(text, selectedVoiceName, selectedVoiceLabel);
};

// ----------------------------------------------------------------------------------
// APPLICATION INITIALIZATION
// ----------------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // Initialize voice system
    populateVoiceSelector();
    
    // Check access status with enhanced security
    const hasAccess = localStorage.getItem('eclipsiaVoxAccess');
    const accessTime = localStorage.getItem('accessTimestamp');
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (hasAccess === 'true' && accessTime && (Date.now() - parseInt(accessTime)) < oneDay) {
        // Grant immediate access
        elements.appGatekeeper.classList.add('hidden');
        elements.appCardMain.classList.remove('hidden');
        showStatus("Welcome back to ECLIPSIA-VOX Premium", 'success');
    } else {
        // Show gatekeeper with enhanced security
        elements.appGatekeeper.classList.remove('hidden');
        elements.appCardMain.classList.add('hidden');
        localStorage.removeItem('eclipsiaVoxAccess');
        localStorage.removeItem('accessTimestamp');
    }
    
    // Initialize UI state
    elements.audioControlsContainer.classList.remove('visible');
    elements.charCount.textContent = `${elements.textInput.value.length} Characters`;
    
    // Add audio event listeners for better UX
    elements.audioPlayer.addEventListener('play', () => {
        showStatus("Audio playing... 🎵", 'info');
    });
    
    elements.audioPlayer.addEventListener('ended', () => {
        showStatus("Playback completed! ✅", 'success');
    });
    
    elements.audioPlayer.addEventListener('pause', () => {
        showStatus("Playback paused ⏸️", 'info');
    });
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-3px); }
            75% { transform: translateX(3px); }
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
        }
    `;
    document.head.appendChild(style);
    
    console.log('ECLIPSIA-VOX Premium Audio with Valid Voices initialized successfully');
});