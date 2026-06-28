
let audioContext = null;
let audioBuffer = null;
let source = null;
let analyser = null;
let isPlaying = false;
let isPaused = false;
let animationId = null;
let spectrogramData = [];
let currentTheme = 'light';


const fileInput = document.getElementById('audioFile');
const dropZone = document.getElementById('dropZone');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const themeToggle = document.getElementById('themeToggle');
const waveCanvas = document.getElementById('waveCanvas');
const spectrumCanvas = document.getElementById('spectrumCanvas');
const spectrogramCanvas = document.getElementById('spectrogramCanvas');
const waveZoom = document.getElementById('waveZoom');
const spectrumBands = document.getElementById('spectrumBands');
const zoomValue = document.getElementById('zoomValue');
const bandsValue = document.getElementById('bandsValue');
const exportScreenshot = document.getElementById('exportScreenshot');
const detectNotesBtn = document.getElementById('detectNotesBtn');
const showPianoBtn = document.getElementById('showPianoBtn');

const ctxWave = waveCanvas.getContext('2d');
const ctxSpectrum = spectrumCanvas.getContext('2d');
const ctxSpectrogram = spectrogramCanvas.getContext('2d');


class NoteDetector {
    constructor() {
        this.noteFrequencies = {
            'C0': 16.35, 'C#0': 17.32, 'D0': 18.35, 'D#0': 19.45,
            'E0': 20.60, 'F0': 21.83, 'F#0': 23.12, 'G0': 24.50,
            'G#0': 25.96, 'A0': 27.50, 'A#0': 29.14, 'B0': 30.87,
            'C1': 32.70, 'C#1': 34.65, 'D1': 36.71, 'D#1': 38.89,
            'E1': 41.20, 'F1': 43.65, 'F#1': 46.25, 'G1': 49.00,
            'G#1': 51.91, 'A1': 55.00, 'A#1': 58.27, 'B1': 61.74,
            'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78,
            'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00,
            'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
            'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56,
            'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00,
            'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
            'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13,
            'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00,
            'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
            'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25,
            'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99,
            'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
            'C6': 1046.50, 'C#6': 1108.73, 'D6': 1174.66, 'D#6': 1244.51,
            'E6': 1318.51, 'F6': 1396.91, 'F#6': 1479.98, 'G6': 1567.98,
            'G#6': 1661.22, 'A6': 1760.00, 'A#6': 1864.66, 'B6': 1975.53,
            'C7': 2093.00, 'C#7': 2217.46, 'D7': 2349.32, 'D#7': 2489.02,
            'E7': 2637.02, 'F7': 2793.83, 'F#7': 2959.96, 'G7': 3135.96,
            'G#7': 3322.44, 'A7': 3520.00, 'A#7': 3729.31, 'B7': 3951.07,
            'C8': 4186.01
        };
        
        this.noteNames = Object.keys(this.noteFrequencies);
        this.noteValues = Object.values(this.noteFrequencies);
    }

    findNearestNote(frequency) {
        if (frequency <= 0 || !isFinite(frequency)) {
            return null;
        }

        let minDiff = Infinity;
        let nearestNote = null;
        let nearestFreq = 0;

        for (let i = 0; i < this.noteValues.length; i++) {
            const diff = Math.abs(frequency - this.noteValues[i]);
            if (diff < minDiff) {
                minDiff = diff;
                nearestNote = this.noteNames[i];
                nearestFreq = this.noteValues[i];
            }
        }

        const tolerance = 0.03;
        if (minDiff / nearestFreq > tolerance) {
            return null;
        }

        return {
            note: nearestNote,
            frequency: nearestFreq,
            detectedFrequency: frequency,
            cents: this.calculateCents(frequency, nearestFreq)
        };
    }

    calculateCents(detectedFreq, noteFreq) {
        return 1200 * Math.log2(detectedFreq / noteFreq);
    }

    detectPitch(signal, sampleRate) {
        if (signal.length < 1024) return 0;

        const correlation = new Float32Array(signal.length);
        for (let lag = 0; lag < signal.length; lag++) {
            let sum = 0;
            for (let i = 0; i < signal.length - lag; i++) {
                sum += signal[i] * signal[i + lag];
            }
            correlation[lag] = sum / (signal.length - lag);
        }

        let maxCorr = 0;
        let maxLag = 0;
        const minLag = Math.floor(sampleRate / 2000);
        const maxLagLimit = Math.floor(sampleRate / 80);

        for (let lag = minLag; lag < Math.min(maxLagLimit, correlation.length); lag++) {
            if (correlation[lag] > maxCorr) {
                maxCorr = correlation[lag];
                maxLag = lag;
            }
        }

        if (maxLag === 0) return 0;
        return sampleRate / maxLag;
    }

    analyzeBuffer(audioBuffer, numNotes = 5) {
        const signal = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const notes = [];
        
        const segmentSize = Math.floor(sampleRate * 0.5);
        const numSegments = Math.floor(signal.length / segmentSize);
        
        for (let i = 0; i < Math.min(numSegments, 10); i++) {
            const start = i * segmentSize;
            const end = Math.min(start + segmentSize, signal.length);
            const segment = signal.slice(start, end);
            
            const frequency = this.detectPitch(segment, sampleRate);
            if (frequency > 0) {
                const note = this.findNearestNote(frequency);
                if (note) {
                    const existing = notes.find(n => n.note === note.note);
                    if (existing) {
                        existing.occurrences++;
                    } else {
                        notes.push({
                            ...note,
                            occurrences: 1,
                            segment: i + 1
                        });
                    }
                }
            }
        }
        
        notes.sort((a, b) => b.occurrences - a.occurrences);
        return notes.slice(0, numNotes);
    }
}


function init() {
    setupEventListeners();
    setupTabs();
    setupDropZone();
    setupTheme();
    updateCanvasSizes();
    window.addEventListener('resize', updateCanvasSizes);
}


function setupEventListeners() {
    fileInput.addEventListener('change', handleFileLoad);
    playBtn.addEventListener('click', playAudio);
    pauseBtn.addEventListener('click', pauseAudio);
    stopBtn.addEventListener('click', stopAudio);
    themeToggle.addEventListener('click', toggleTheme);
    waveZoom.addEventListener('input', handleZoom);
    spectrumBands.addEventListener('input', handleBands);
    exportScreenshot.addEventListener('click', exportScreenshotHandler);
    detectNotesBtn.addEventListener('click', detectAndDisplayNotes);
    showPianoBtn.addEventListener('click', showPianoKeyboard);
}


function updateButtonsState(enabled) {
    const buttons = [playBtn, pauseBtn, stopBtn, exportScreenshot, detectNotesBtn, showPianoBtn];
    
    buttons.forEach(btn => {
        if (btn) btn.disabled = !enabled;
    });
}


function updateDropZoneFile(file) {
    const dropZoneContent = dropZone.querySelector('.drop-zone-content');
    
    if (file) {
        const fileSize = (file.size / (1024 * 1024)).toFixed(2);
        const fileType = file.type.split('/')[1].toUpperCase() || 'АУДИО';
        const extension = file.name.split('.').pop().toUpperCase();
        
        let icon = '🎵';
        if (extension === 'MP3') icon = '🎶';
        else if (extension === 'WAV') icon = '🔊';
        else if (extension === 'OGG') icon = '🎧';
        else if (extension === 'M4A' || extension === 'AAC') icon = '🎼';
        
        dropZoneContent.innerHTML = `
            <div class="file-info">
                <span class="file-icon">${icon}</span>
                <div class="file-details">
                    <div class="file-name" title="${file.name}">${file.name}</div>
                    <div class="file-meta">
                        <span class="file-size">📦 ${fileSize} MB</span>
                        <span class="file-type">📋 ${fileType}</span>
                        <span class="file-status">✅ Готов к воспроизведению</span>
                    </div>
                </div>
                <button class="file-remove" id="removeFile" title="Удалить файл">✕</button>
            </div>
        `;
        
        const removeBtn = document.getElementById('removeFile');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFile();
            });
        }
        
        dropZone.classList.add('has-file');
        
    } else {
        dropZoneContent.innerHTML = `
            <span class="drop-icon">📁</span>
            <p>Перетащите аудиофайл сюда</p>
            <span class="drop-hint">или нажмите для выбора</span>
        `;
        dropZone.classList.remove('has-file');
    }
}


function removeFile() {
    stopAudio();
    audioBuffer = null;
    analyser = null;
    spectrogramData = [];
    
    updateButtonsState(false);
    
    document.getElementById('duration').textContent = '--:--';
    document.getElementById('sampleRate').textContent = '-- кГц';
    document.getElementById('channels').textContent = '--';
    document.getElementById('bitrate').textContent = '-- kbps';
    
    ['waveCanvas', 'spectrumCanvas', 'spectrogramCanvas'].forEach(id => {
        const canvas = document.getElementById(id);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#f0f2f5';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
    
    document.querySelectorAll('.canvas-overlay').forEach(el => el.classList.remove('hidden'));
    updateDropZoneFile(null);
    fileInput.value = '';
}


async function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;
    await loadAudioFile(file);
}

async function loadAudioFile(file) {
    try {
        if (file.size > 100 * 1024 * 1024) {
            throw new Error('Файл слишком большой (макс. 100MB)');
        }
        if (!file.type.startsWith('audio/')) {
            throw new Error('Неверный формат файла');
        }

        updateDropZoneFile(file);

        stopAudio();
        const arrayBuffer = await file.arrayBuffer();
        initAudioContext();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        updateButtonsState(true);

        updateAudioInfo(file);
        drawWaveform();
        clearSpectrum();
        clearSpectrogram();
        document.querySelectorAll('.canvas-overlay').forEach(el => el.classList.add('hidden'));
        
    } catch (err) {
        console.error('Ошибка загрузки:', err);
        alert(`Ошибка: ${err.message}`);
        updateDropZoneFile(null);
    }
}


function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}


function playAudio() {
    if (!audioBuffer) return;
    if (isPlaying && !isPaused) return;

    initAudioContext();

    if (isPaused && source) {
        audioContext.resume();
        isPaused = false;
        updatePlayButtons();
        startVisualization();
        return;
    }

    source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    
    source.start();
    isPlaying = true;
    isPaused = false;
    updatePlayButtons();
    startVisualization();
    
    source.onended = () => {
        stopAudio();
    };
}


function pauseAudio() {
    if (!isPlaying || isPaused) return;
    
    if (audioContext.state === 'running') {
        audioContext.suspend();
        isPaused = true;
        updatePlayButtons();
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }
}


function stopAudio() {
    if (source) {
        try {
            source.stop();
        } catch (e) {}
        source.disconnect();
        source = null;
    }
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    isPlaying = false;
    isPaused = false;
    updatePlayButtons();
    clearSpectrum();
    clearSpectrogram();
}


function clearSpectrum() {
    const canvas = spectrumCanvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#f0f2f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}


function updatePlayButtons() {
    if (isPlaying && !isPaused) {
        playBtn.innerHTML = '<span class="btn-icon">▶</span> Играет';
        playBtn.classList.add('playing');
    } else if (isPlaying && isPaused) {
        playBtn.innerHTML = '<span class="btn-icon">▶</span> Продолжить';
        playBtn.classList.remove('playing');
    } else {
        playBtn.innerHTML = '<span class="btn-icon">▶</span> Воспроизвести';
        playBtn.classList.remove('playing');
    }
}


function startVisualization() {
    if (!analyser) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let frameCount = 0;

    function update() {
        if (!isPlaying || isPaused) {
            animationId = requestAnimationFrame(update);
            return;
        }

        analyser.getByteFrequencyData(dataArray);
        drawSpectrum(dataArray, bufferLength, audioContext.sampleRate);
        
        if (frameCount % 2 === 0) {
            updateSpectrogram(dataArray);
        }
        frameCount++;
        
        animationId = requestAnimationFrame(update);
    }
    update();
}


function drawWaveform() {
    if (!audioBuffer) return;
    
    const channelData = audioBuffer.getChannelData(0);
    const zoom = parseFloat(waveZoom.value);
    const canvas = waveCanvas;
    const width = canvas.width;
    const height = canvas.height;
    
    ctxWave.clearRect(0, 0, width, height);
    
    const step = Math.max(1, Math.ceil(channelData.length / (width * zoom)));
    const halfHeight = height / 2;
    
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#007bff';
    
    ctxWave.beginPath();
    ctxWave.strokeStyle = accentColor;
    ctxWave.lineWidth = 1.5;
    
    for (let i = 0; i < width; i++) {
        const startIdx = Math.floor(i * step * zoom);
        const endIdx = Math.min(startIdx + step, channelData.length);
        let min = 1.0, max = -1.0;
        
        for (let j = startIdx; j < endIdx; j++) {
            const val = channelData[j];
            if (val < min) min = val;
            if (val > max) max = val;
        }
        
        const y1 = (min * 0.5 + 0.5) * height;
        const y2 = (max * 0.5 + 0.5) * height;
        
        ctxWave.moveTo(i, y1);
        ctxWave.lineTo(i, y2);
    }
    ctxWave.stroke();
    
    ctxWave.beginPath();
    ctxWave.strokeStyle = 'rgba(128,128,128,0.2)';
    ctxWave.lineWidth = 0.5;
    ctxWave.moveTo(0, halfHeight);
    ctxWave.lineTo(width, halfHeight);
    ctxWave.stroke();
}


function drawSpectrum(dataArray, freqBinCount, sampleRate) {
    const canvas = spectrumCanvas;
    const width = canvas.width;
    const height = canvas.height;
    const bands = parseInt(spectrumBands.value);
    
    ctxSpectrum.clearRect(0, 0, width, height);
    
    if (dataArray.length === 0 || !sampleRate) {
        ctxSpectrum.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#f0f2f5';
        ctxSpectrum.fillRect(0, 0, width, height);
        return;
    }
    
    const maxFreq = Math.min(8000, sampleRate / 2);
    const maxBin = Math.min(Math.floor((maxFreq / (sampleRate / 2)) * freqBinCount), dataArray.length);
    const step = Math.max(1, Math.floor(maxBin / bands));
    const barWidth = Math.max(1, width / bands);
    
    const gradient = ctxSpectrum.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#ff6b6b');
    gradient.addColorStop(0.3, '#ffd93d');
    gradient.addColorStop(0.6, '#6bcb77');
    gradient.addColorStop(1, '#4d96ff');
    
    for (let i = 0; i < bands; i++) {
        const binIndex = i * step;
        let sum = 0;
        let count = 0;
        for (let j = 0; j < step && binIndex + j < dataArray.length; j++) {
            sum += dataArray[binIndex + j];
            count++;
        }
        const avg = count > 0 ? sum / count : 0;
        const value = avg / 255;
        const barHeight = value * height * 0.9;
        
        const x = i * barWidth;
        const y = height - barHeight;
        
        ctxSpectrum.fillStyle = gradient;
        ctxSpectrum.fillRect(x, y, Math.max(1, barWidth - 1), Math.max(1, barHeight));
        
        if (value > 0.1) {
            ctxSpectrum.fillStyle = 'rgba(255,255,255,0.1)';
            ctxSpectrum.fillRect(x, y, Math.max(1, barWidth - 1), Math.min(3, barHeight * 0.1));
        }
    }
}


function clearSpectrogram() {
    const canvas = spectrogramCanvas;
    ctxSpectrogram.clearRect(0, 0, canvas.width, canvas.height);
    ctxSpectrogram.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#f0f2f5';
    ctxSpectrogram.fillRect(0, 0, canvas.width, canvas.height);
    spectrogramData = [];
}

function updateSpectrogram(dataArray) {
    const canvas = spectrogramCanvas;
    const width = canvas.width;
    const height = canvas.height;
    
    if (spectrogramData.length >= width) {
        spectrogramData.shift();
    }
    spectrogramData.push([...dataArray]);
    
    ctxSpectrogram.clearRect(0, 0, width, height);
    
    const bands = Math.min(dataArray.length, height);
    const colWidth = Math.max(1, width / spectrogramData.length);
    
    for (let x = 0; x < spectrogramData.length; x++) {
        const colData = spectrogramData[x];
        for (let y = 0; y < bands; y++) {
            const value = colData[y] / 255;
            if (value > 0.05) {
                const hue = 240 - value * 200;
                ctxSpectrogram.fillStyle = `hsl(${hue}, 80%, ${50 + value * 40}%)`;
                const yPos = height - y - 1;
                ctxSpectrogram.fillRect(x * colWidth, yPos, Math.max(1, colWidth), 1);
            }
        }
    }
}


function detectAndDisplayNotes() {
    if (!audioBuffer) {
        showNotification('Сначала загрузите аудиофайл!', 'warning');
        return;
    }

    const detector = new NoteDetector();
    const notes = detector.analyzeBuffer(audioBuffer, 5);
    
    if (notes.length === 0) {
        showNotification('Ноты не обнаружены. Попробуйте другой файл.', 'warning');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'notes-modal';
    modal.innerHTML = `
        <div class="notes-modal-content">
            <div class="notes-modal-header">
                <h2>🎵 Обнаруженные ноты</h2>
                <button class="notes-modal-close" onclick="this.closest('.notes-modal').remove()">✕</button>
            </div>
            <div class="notes-list">
                ${notes.map((note, index) => `
                    <div class="note-item ${index === 0 ? 'primary-note' : ''}">
                        <div class="note-name">${note.note}</div>
                        <div class="note-details">
                            <span class="note-frequency">${note.detectedFrequency.toFixed(1)} Hz</span>
                            <span class="note-cents">${note.cents.toFixed(1)} ¢</span>
                            <span class="note-occurrences">${note.occurrences}x</span>
                        </div>
                        ${index === 0 ? '<div class="note-badge">Основная</div>' : ''}
                    </div>
                `).join('')}
            </div>
            <div class="notes-info">
                <p>💡 Отклонение до ±50 центов считается хорошим тоном</p>
                <p>📊 Обнаружено на основе анализа ${notes.reduce((sum, n) => sum + n.occurrences, 0)} сегментов</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function createPianoKeyboard(notes) {
    const container = document.createElement('div');
    container.className = 'piano-keyboard';
    
    const whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const blackKeys = ['C#', 'D#', 'F#', 'G#', 'A#'];
    const allKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const detectedNotes = notes.map(n => n.note);
    
    for (let octave = 3; octave <= 5; octave++) {
        allKeys.forEach(key => {
            const noteName = key + octave;
            const isBlack = blackKeys.includes(key);
            const isDetected = detectedNotes.includes(noteName);
            
            const keyEl = document.createElement('div');
            keyEl.className = `piano-key ${isBlack ? 'black' : 'white'} ${isDetected ? 'active' : ''}`;
            keyEl.title = noteName;
            keyEl.textContent = isBlack ? '' : noteName;
            
            if (isDetected) {
                const note = notes.find(n => n.note === noteName);
                if (note) {
                    const intensity = Math.min(1, note.occurrences / 5);
                    if (isBlack) {
                        keyEl.style.boxShadow = `0 0 ${20 * intensity}px rgba(255, 215, 0, ${0.3 * intensity})`;
                    } else {
                        keyEl.style.boxShadow = `0 0 ${20 * intensity}px rgba(0, 123, 255, ${0.3 * intensity})`;
                    }
                }
            }
            
            container.appendChild(keyEl);
        });
    }
    
    return container;
}

function showPianoKeyboard() {
    if (!audioBuffer) {
        showNotification('Сначала загрузите аудиофайл!', 'warning');
        return;
    }
    
    const detector = new NoteDetector();
    const notes = detector.analyzeBuffer(audioBuffer, 12);
    
    if (notes.length === 0) {
        showNotification('Ноты не обнаружены.', 'warning');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'notes-modal';
    modal.innerHTML = `
        <div class="notes-modal-content piano-modal">
            <div class="notes-modal-header">
                <h2>🎹 Пианино - обнаруженные ноты</h2>
                <button class="notes-modal-close" onclick="this.closest('.notes-modal').remove()">✕</button>
            </div>
            <div class="piano-container"></div>
            <div class="notes-info">
                <p>🎵 Подсвечены обнаруженные ноты</p>
                <p>✨ Яркость показывает частоту обнаружения</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const pianoContainer = modal.querySelector('.piano-container');
    pianoContainer.appendChild(createPianoKeyboard(notes));
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}


function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}


function updateAudioInfo(file) {
    if (!audioBuffer) return;
    
    const duration = audioBuffer.duration;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    document.getElementById('duration').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    document.getElementById('sampleRate').textContent = 
        `${(audioBuffer.sampleRate / 1000).toFixed(1)} кГц`;
    
    document.getElementById('channels').textContent = 
        audioBuffer.numberOfChannels;
    
    if (file) {
        const bitrate = (file.size * 8) / (audioBuffer.duration * 1000);
        document.getElementById('bitrate').textContent = 
            `${bitrate.toFixed(1)} kbps`;
    }
}


function exportScreenshotHandler() {
    const activeTab = document.querySelector('.viz-content.active');
    if (!activeTab) {
        alert('Нет активной визуализации для экспорта');
        return;
    }
    
    const canvas = activeTab.querySelector('canvas');
    if (!canvas) {
        alert('Не найден Canvas для экспорта');
        return;
    }
    
    try {
        const link = document.createElement('a');
        link.download = `аудио-анализ-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showNotification('📸 Скриншот сохранен!', 'success');
    } catch (err) {
        alert('Ошибка при экспорте: ' + err.message);
    }
}


function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = {
        waveform: document.getElementById('waveform'),
        spectrum: document.getElementById('spectrum'),
        spectrogram: document.getElementById('spectrogram')
    };
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            Object.values(contents).forEach(c => c.classList.remove('active'));
            const target = tab.dataset.tab;
            if (contents[target]) {
                contents[target].classList.add('active');
                setTimeout(() => {
                    if (target === 'waveform' && audioBuffer) drawWaveform();
                    if (target === 'spectrum' && analyser) {
                        const dataArray = new Uint8Array(analyser.frequencyBinCount);
                        analyser.getByteFrequencyData(dataArray);
                        drawSpectrum(dataArray, analyser.frequencyBinCount, audioContext ? audioContext.sampleRate : 44100);
                    }
                }, 50);
            }
        });
    });
}


function setupDropZone() {
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileLoad({ target: fileInput });
        }
    });
}


function setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
}

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
    
    setTimeout(() => {
        if (audioBuffer) {
            drawWaveform();
            if (analyser) {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                drawSpectrum(dataArray, analyser.frequencyBinCount, audioContext ? audioContext.sampleRate : 44100);
            }
        }
    }, 100);
}


function updateCanvasSizes() {
    const canvases = [waveCanvas, spectrumCanvas, spectrogramCanvas];
    const container = document.querySelector('.canvas-wrapper');
    if (!container) return;
    
    const width = container.clientWidth || 800;
    const height = Math.min(300, Math.max(150, width * 0.4));
    
    canvases.forEach(canvas => {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = '100%';
        canvas.style.height = `${height}px`;
    });
    
    setTimeout(() => {
        if (audioBuffer) {
            drawWaveform();
            if (analyser) {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                drawSpectrum(dataArray, analyser.frequencyBinCount, audioContext ? audioContext.sampleRate : 44100);
            }
            clearSpectrogram();
        }
    }, 50);
}


function handleZoom() {
    zoomValue.textContent = `${waveZoom.value}x`;
    if (audioBuffer) drawWaveform();
}

function handleBands() {
    bandsValue.textContent = spectrumBands.value;
    if (analyser) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        drawSpectrum(dataArray, analyser.frequencyBinCount, audioContext ? audioContext.sampleRate : 44100);
    }
}


document.addEventListener('DOMContentLoaded', init);

window.addEventListener('error', (e) => {
    console.error('Глобальная ошибка:', e.message);
});