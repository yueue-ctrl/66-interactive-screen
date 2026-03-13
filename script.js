const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const video = document.getElementById('videoElement');
const sourceImage = document.getElementById('sourceImage');
const fileInput = document.getElementById('fileInput');

const btnCamera = document.getElementById('btnCamera');

const btnDownload = document.getElementById('btnDownload');
const btnBlur = document.getElementById('btnBlur');
const btnToggleControls = document.getElementById('btnToggleControls');
const controlsContainer = document.getElementById('controlsContainer');
const collapsibleControls = document.getElementById('collapsibleControls');

const sliderSize = document.getElementById('sliderSize');
const valSize = document.getElementById('valSize');
const sliderThickness = document.getElementById('sliderThickness');
const valThickness = document.getElementById('valThickness');

const selectShape = document.getElementById('selectShape');

let isCameraActive = false;
let animationId = null;
let currentColors = ['#99b94e', '#6d27bf', '#fff707', '#ff5001', '#fe86d4', '#88ff6c', '#ebd5be', '#411d15'];
let segmenter = null;
let segmentationMask = null;
let isSegmenterLoading = true;
let currentShape = selectShape.value; // Initialize currentShape
let isBlurActive = false;

const rippleColors = ['#ffc0cb', '#ffff00', '#87ceeb', '#9787ffff']; // Pink, Yellow, Sky Blue
let rippleColorIndex = 0;
let ripples = [];

// A simple pseudo-random number generator for stable patterns
function pseudoRandom(seed) {
    // A simple hash-like function to get a deterministic "random" value
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}
let lastRippleTime = 0;
const rippleInterval = 1500; // ms

// Initialize Body Segmentation
async function initSegmenter() {
    try {
        const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
        const segmenterConfig = {
            runtime: 'mediapipe',
            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation'
        };
        segmenter = await bodySegmentation.createSegmenter(model, segmenterConfig);
        isSegmenterLoading = false;
        console.log("Segmenter loaded");
    } catch (err) {
        console.error("Failed to load segmenter:", err);
        isSegmenterLoading = false; // Fallback to non-segmented
    }
}

initSegmenter();



sliderSize.addEventListener('input', (e) => {
    valSize.textContent = e.target.value;
    drawFrame();
});

sliderThickness.addEventListener('input', (e) => {
    valThickness.textContent = e.target.value;
    drawFrame();
});

btnCamera.addEventListener('click', startCamera);

btnBlur.addEventListener('click', () => {
    if (!isCameraActive) return; // Don't do anything if camera is off

    isBlurActive = !isBlurActive;
    btnBlur.textContent = isBlurActive ? 'unblur' : 'blur';

    // Redraw the frame immediately to apply/remove the blur
    drawFrame();
});

fileInput.addEventListener('change', handleFileUpload);

btnDownload.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'filter-image.png';
    link.href = canvas.toDataURL();
    link.click();
});

btnTogglePoster.addEventListener('click', () => {
    const sourceExists = isCameraActive || sourceImage.src;
    if (!sourceExists && appState === 'poster') {
        alert('Please turn on the camera or upload a picture first before switching.');
        return;
    }

    if (appState === 'interactive') {
        appState = 'transitioning_out';
        transitionStartTime = performance.now();
        loop(); // Ensure animation runs
    } else if (appState === 'poster') {
        appState = 'transitioning_in';
        transitionStartTime = performance.now();
        loop(); // Ensure animation runs
    }
    // Do nothing if in the middle of a transition
});

btnToggleControls.addEventListener('click', () => {
    controlsContainer.classList.toggle('collapsed');
});

selectShape.addEventListener('change', () => {
    currentShape = selectShape.value;
    if (appState === 'interactive') {
        drawFrame(); // Redraw immediately if in interactive mode
    }
});

// Camera Logic
async function startCamera() {
    try {
        if (isCameraActive) {
            // Stop camera
            const stream = video.srcObject;
            if (stream) {
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());
            }
            video.srcObject = null;
            isCameraActive = false;
            btnCamera.textContent = "open camera";
            btnBlur.disabled = true; // Disable blur button
            isBlurActive = false; // Reset blur state
            btnBlur.textContent = 'blur'; // Reset button text
            
            // Start the transition out
            appState = 'transitioning_out';
            transitionStartTime = performance.now();
            loop(); // Ensure the loop runs for the transition
            return; // Exit after stopping the camera
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.play();
        isCameraActive = true;
        btnCamera.textContent = "close camera";
        btnBlur.disabled = false; // Enable blur button
        
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            // Start the transition
            appState = 'transitioning_in';
            transitionStartTime = performance.now();
            loop();
        };
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("无法访问摄像头，请确保已授予权限。");
    }
}

function loop() {
    drawFrame(); // Always draw the current state

    // Continue looping if we're animating or in interactive mode (for background animation)
    const keepLooping = appState.startsWith('transitioning') || appState === 'interactive';

    if (keepLooping) {
        animationId = requestAnimationFrame(loop);
    } else {
        cancelAnimationFrame(animationId);
        // If we just finished transitioning to the poster, do one final static draw
        if (appState === 'poster') {
            drawFrame();
        }
    }
}

// Image Upload Logic
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Stop camera if running
    if (isCameraActive) {
        startCamera(); 
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        sourceImage.onload = () => {
            canvas.width = sourceImage.width;
            canvas.height = sourceImage.height;
            // Start the transition
            appState = 'transitioning_in';
            transitionStartTime = performance.now();
            loop();
        };
        sourceImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

const offscreenCanvas = document.createElement('canvas');
const offCtx = offscreenCanvas.getContext('2d');

// Helper to convert hex to RGB
function hexToRgb(hex) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result && hex.length === 4) { // Handle short hex #abc
        result = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
        if (result) {
            result = [null, result[1]+result[1], result[2]+result[2], result[3]+result[3]];
        }
    }
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Helper to find closest color in palette using Redmean approximation
function getClosestColor(r, g, b, paletteColors) {
    let minDist = Infinity;
    let closest = paletteColors[0];
    
    for (const color of paletteColors) {
        const rgb = hexToRgb(color);
        if (!rgb) continue;
        
        // Redmean color distance (better for human perception than Euclidean)
        const rmean = (r + rgb.r) / 2;
        const dr = r - rgb.r;
        const dg = g - rgb.g;
        const db = b - rgb.b;
        
        // Formula: (2 + rmean/256) * dr^2 + 4 * dg^2 + (2 + (255-rmean)/256) * db^2
        // We can use bit shifting approximations
        const weightR = 2 + (rmean / 256);
        const weightG = 4;
        const weightB = 2 + ((255 - rmean) / 256);
        
        const dist = weightR * dr * dr + weightG * dg * dg + weightB * db * db;
        
        if (dist < minDist) {
            minDist = dist;
            closest = color;
        }
    }
    return closest;
}

let appState = 'poster'; // 'poster', 'transitioning_in', 'transitioning_out', 'interactive'
let transitionStartTime = 0;
const transitionDuration = 2000; // 2 seconds

// Helper to interpolate values
const lerp = (a, b, t) => a + (b - a) * t;

// Helper to check if a small cell is part of the person
function isCellPerson(x, y, w, h, segmentationMask) {
    if (!segmentationMask || segmentationMask.width === 0) {
        return true; // Default to person if no mask
    }
    const mx = Math.floor(x * segmentationMask.width / w);
    const my = Math.floor(y * segmentationMask.height / h);
    const mIndex = (my * segmentationMask.width + mx) * 4;
    const maskVal = segmentationMask.data[mIndex + 3]; // Check Alpha
    return maskVal > 128;
}

// Helper to check if a large block is PURE background
function isBlockPureBackground(bgX, bgY, bgGridSize, w, h, segmentationMask) {
    if (!segmentationMask || segmentationMask.width === 0) {
        return false; // Default to not pure background if no mask
    }
    // Check corners/center of the large block
    const checkPoints = [
        {cx: bgX, cy: bgY},
        {cx: bgX + bgGridSize - 1, cy: bgY},
        {cx: bgX, cy: bgY + bgGridSize - 1},
        {cx: bgX + bgGridSize - 1, cy: bgY + bgGridSize - 1},
        {cx: bgX + bgGridSize/2, cy: bgY + bgGridSize/2}
    ];

    for (let pt of checkPoints) {
        if (pt.cx >= w || pt.cy >= h) continue;
        const mx = Math.floor(pt.cx * segmentationMask.width / w);
        const my = Math.floor(pt.cy * segmentationMask.height / h);
        const mIndex = (my * segmentationMask.width + mx) * 4;
        if (segmentationMask.data[mIndex + 3] > 128) {
            return false; // Found a person pixel, so not pure background
        }
    }
    return true;
}

// Helper to draw various shapes
function drawShape(ctx, shape, x, y, size, color, mode) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1; // Default line width for stroke

    const halfSize = size / 2;
    const centerX = x;
    const centerY = y;

    ctx.beginPath();

    switch (shape) {
        case 'square':
            if (mode === 'fill') {
                ctx.fillRect(centerX - halfSize, centerY - halfSize, size, size);
            } else { // stroke
                ctx.strokeRect(centerX - halfSize, centerY - halfSize, size, size);
            }
            break;
        case 'circle':
            ctx.arc(centerX, centerY, halfSize, 0, 2 * Math.PI);
            if (mode === 'fill') {
                ctx.fill();
            } else { // stroke
                ctx.stroke();
            }
            break;
        case 'triangle':
            ctx.moveTo(centerX, centerY - halfSize);
            ctx.lineTo(centerX + halfSize, centerY + halfSize);
            ctx.lineTo(centerX - halfSize, centerY + halfSize);
            ctx.closePath();
            if (mode === 'fill') {
                ctx.fill();
            } else { // stroke
                ctx.stroke();
            }
            break;
        case 'symbol-6':
        case 'symbol--':
        case 'symbol-+':
            let symbolText;
            switch (shape) {
                case 'symbol-6': symbolText = '6'; break;
                case 'symbol--': symbolText = '-'; break;
                case 'symbol-+': symbolText = '+'; break;
            }
            const fontSize = size * 0.8; // Adjust font size relative to cell size
            ctx.font = `${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (mode === 'fill') {
                ctx.fillText(symbolText, centerX, centerY);
            } else { // stroke
                ctx.strokeText(symbolText, centerX, centerY);
            }
            break;
    }
}

// Drawing Logic
async function drawFrame() {
    if (appState === 'poster') {
        ctx.fillStyle = '#ffc0cb'; // Pink
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
    }

    if (canvas.width === 0 || canvas.height === 0) return;

    // 1. Draw Source to Offscreen Canvas to get pixel data
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;

    // Apply blur if active
    if (isBlurActive) {
        offCtx.filter = 'blur(10px)';
    } else {
        offCtx.filter = 'none';
    }
    
    let sourceReady = false;
    
    if (isCameraActive) {
        offCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
        sourceReady = true;
    } else if (sourceImage.src) {
        offCtx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
        sourceReady = true;
    }

    // Don't clear main canvas here, the drawing functions will handle it

    if (!sourceReady && (appState === 'interactive' || appState === 'poster')) {
        ctx.fillStyle = '#ccc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.font = '20px Arial';
        ctx.fillText('Please turn on the camera or upload a picture', canvas.width/2, canvas.height/2);
        return;
    }

    // 2. Update segmentation mask
    if (segmenter && sourceReady) {
        try {
            const input = isCameraActive ? video : sourceImage;
            const segmentation = await segmenter.segmentPeople(input);
            if (segmentation && segmentation.length > 0) {
                 segmentationMask = await segmentation[0].mask.toImageData();
            }
        } catch (e) {
            console.warn("Segmentation failed:", e);
        }
    }
    
    // 3. Render based on state
    ctx.save();
    if (isCameraActive) {
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
    }

    if (appState.startsWith('transitioning')) {
        const elapsedTime = performance.now() - transitionStartTime;
        let progress = elapsedTime / transitionDuration;

        if (appState === 'transitioning_in') {
            progress = Math.min(progress, 1);
        } else { // transitioning_out
            progress = 1 - Math.min(progress, 1);
        }

        drawAnimatedMosaic(segmentationMask, progress);

        if (progress >= 1 && appState === 'transitioning_in') {
            appState = 'interactive';
        } else if (progress <= 0 && appState === 'transitioning_out') {
            appState = 'poster';
        }
    } else if (appState === 'interactive') {
        drawInteractiveMosaic(segmentationMask);
    } else if (appState === 'poster') {
        // This case is already handled at the very beginning of drawFrame
        // but leaving this for clarity
    }

    ctx.restore();
}

function drawAnimatedMosaic(segmentationMask, progress) {
    // Pink background for the transition
    ctx.fillStyle = '#ffc0cb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const baseGridSize = Math.max(2, parseInt(sliderSize.value, 10));
    const bgGridMultiplier = 2;
    const bgGridSize = baseGridSize * bgGridMultiplier;
    const w = canvas.width;
    const h = canvas.height;
    const currentShape = selectShape.value;

    // Easing for smoother animation
    const easedProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const imageData = offCtx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // --- Helper function to draw mosaic for person/mixed areas ---
    const drawPersonMosaic = (gridSize) => {
        for (let y = 0; y < h; y += gridSize) {
            for (let x = 0; x < w; x += gridSize) {
                const bgX = x - (x % bgGridSize);
                const bgY = y - (y % bgGridSize);
                if (!isBlockPureBackground(bgX, bgY, bgGridSize, w, h, segmentationMask)) {
                    let r = 0, g = 0, b = 0, count = 0;
                    for (let by = 0; by < gridSize; by++) {
                        if (y + by >= h) break;
                        for (let bx = 0; bx < gridSize; bx++) {
                            if (x + bx >= w) break;
                            const index = ((y + by) * w + (x + bx)) * 4;
                            r += data[index]; g += data[index + 1]; b += data[index + 2];
                            count++;
                        }
                    }
                    if (count > 0) { r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count); }
                    const color = getClosestColor(r, g, b, currentColors);
                    const centerX = x + gridSize / 2;
                    const centerY = y + gridSize / 2;
                    drawShape(ctx, currentShape, centerX, centerY, gridSize, color, 'fill'); // Use full size
                }
            }
        }
    };

    // --- Draw background shapes (always present) ---
    for (let y = 0; y < h; y += bgGridSize) {
        for (let x = 0; x < w; x += bgGridSize) {
            if (isBlockPureBackground(x, y, bgGridSize, w, h, segmentationMask)) {
                const size = bgGridSize * easedProgress; // Use full size for animation
                const centerX = x + bgGridSize / 2;
                const centerY = y + bgGridSize / 2;
                drawShape(ctx, currentShape, centerX, centerY, size, '#99b94e', 'fill');
            }
        }
    }

    // --- Animation Stages (Cross-fade) ---
    const stage1End = 0.5;

    if (easedProgress < stage1End) {
        const stage1Progress = easedProgress / stage1End;
        ctx.globalAlpha = 1 - stage1Progress;
        drawPersonMosaic(bgGridSize);
        ctx.globalAlpha = stage1Progress;
        drawPersonMosaic(baseGridSize);
    } else {
        const stage2Progress = (easedProgress - stage1End) / (1 - stage1End);
        ctx.globalAlpha = 1 - stage2Progress;
        drawPersonMosaic(baseGridSize);
        ctx.globalAlpha = stage2Progress;
        ctx.save();
        ctx.beginPath();
        for (let y = 0; y < h; y += baseGridSize) {
            for (let x = 0; x < w; x += baseGridSize) {
                if (isCellPerson(x + baseGridSize/2, y + baseGridSize/2, w, h, segmentationMask)) {
                    ctx.rect(x, y, baseGridSize, baseGridSize);
                }
            }
        }
        ctx.clip();
        ctx.drawImage(offscreenCanvas, 0, 0, w, h);
        ctx.restore();
    }
    
    ctx.globalAlpha = 1.0; // Reset global alpha

    // --- Draw Corner Dots, faded in with progress ---
    const dotSize = parseInt(sliderThickness.value, 10);
    if (dotSize > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = easedProgress; // Fade in dots

        // Function to check and draw a dot
        const checkAndDrawDot = (x, y, grid, bgGrid) => {
            const cell1_isBG = isBlockPureBackground(x - grid, y - grid, bgGrid, w, h, segmentationMask);
            const cell2_isBG = isBlockPureBackground(x, y - grid, bgGrid, w, h, segmentationMask);
            const cell3_isBG = isBlockPureBackground(x - grid, y, bgGrid, w, h, segmentationMask);
            const cell4_isBG = isBlockPureBackground(x, y, bgGrid, w, h, segmentationMask);
            if (cell1_isBG && cell2_isBG && cell3_isBG && cell4_isBG) {
                ctx.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
            }
        };

        // Draw dots for the small grid
        for (let y = baseGridSize; y < h; y += baseGridSize) {
            for (let x = baseGridSize; x < w; x += baseGridSize) {
                checkAndDrawDot(x, y, baseGridSize, bgGridSize);
            }
        }

        // Also draw for the larger grid
        for (let y = bgGridSize; y < h; y += bgGridSize) {
             for (let x = bgGridSize; x < w; x += bgGridSize) {
                checkAndDrawDot(x, y, bgGridSize, bgGridSize);
            }
        }
        ctx.globalAlpha = 1.0;
    }
}

function drawInteractiveMosaic(segmentationMask) {
    const now = performance.now();
    const baseGridSize = Math.max(2, parseInt(sliderSize.value, 10)); // Min size 2
    const bgGridMultiplier = 2;
    const bgGridSize = baseGridSize * bgGridMultiplier;
    const w = canvas.width;
    const h = canvas.height;
    const currentShape = selectShape.value;

    const imageData = offCtx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const gridW = Math.ceil(w / baseGridSize);
    const gridH = Math.ceil(h / baseGridSize);

    // --- 1. Ripple Generation ---
    if (now - lastRippleTime > rippleInterval) {
        lastRippleTime = now;
        const distanceGrid = Array(gridH).fill(null).map(() => Array(gridW).fill(Infinity));
        const queue = [];
        let maxDist = 0;
        let personDetected = false;
        for (let gy = 0; gy < gridH; gy++) {
            for (let gx = 0; gx < gridW; gx++) {
                const x = gx * baseGridSize;
                const y = gy * baseGridSize;
                const bgX = x - (x % bgGridSize);
                const bgY = y - (y % bgGridSize);
                if (!isBlockPureBackground(bgX, bgY, bgGridSize, w, h, segmentationMask)) {
                    distanceGrid[gy][gx] = 0;
                    queue.push({ gx, gy, dist: 0 });
                    personDetected = true;
                }
            }
        }
        if (personDetected) {
            let head = 0;
            while (head < queue.length) {
                const { gx, gy, dist } = queue[head++];
                maxDist = Math.max(maxDist, dist);
                const neighbors = [{ nx: gx - 1, ny: gy }, { nx: gx + 1, ny: gy }, { nx: gx, ny: gy - 1 }, { nx: gx, ny: gy + 1 }];
                for (const { nx, ny } of neighbors) {
                    if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH && distanceGrid[ny][nx] === Infinity) {
                        distanceGrid[ny][nx] = dist + 1;
                        queue.push({ gx: nx, gy: ny, dist: dist + 1 });
                    }
                }
            }
            ripples.push({
                birthTime: now,
                color: rippleColors[rippleColorIndex],
                distanceGrid: distanceGrid,
                maxDist: maxDist,
            });
            rippleColorIndex = (rippleColorIndex + 1) % rippleColors.length;
        }
    }

    // --- 2. Drawing ---
    // Clear with base green color instead of white
    ctx.fillStyle = '#99b94e';
    ctx.fillRect(0, 0, w, h);

    // --- 3. Draw Ripples (on top of the green background) ---
    for (let y = 0; y < h; y += bgGridSize) {
        for (let x = 0; x < w; x += bgGridSize) {
            if (isBlockPureBackground(x, y, bgGridSize, w, h, segmentationMask)) {
                let rippleColor = null;

                // Check active ripples for this block's color
                for (const ripple of ripples) {
                    const age = now - ripple.birthTime;
                    const waveSpeed = ripple.maxDist / 2; // Travels in 2 seconds
                    const waveHead = (age / 1000) * waveSpeed;
                    const waveWidth = 4;
                    
                    const gx = Math.floor((x + bgGridSize / 2) / baseGridSize);
                    const gy = Math.floor((y + bgGridSize / 2) / baseGridSize);

                    if (gy < ripple.distanceGrid.length && gx < ripple.distanceGrid[0].length) {
                        const dist = ripple.distanceGrid[gy][gx];
                        if (dist > waveHead - waveWidth && dist <= waveHead) {
                            rippleColor = ripple.color; // Found a ripple for this block
                        }
                    }
                }

                // Only draw if it's a ripple, since background is already green
                if (rippleColor) {
                    const size = bgGridSize; // Use full size
                    const centerX = x + bgGridSize / 2;
                    const centerY = y + bgGridSize / 2;
                    drawShape(ctx, currentShape, centerX, centerY, size, rippleColor, 'fill');
                }
            }
        }
    }

    // --- 4. Cleanup Ripples ---
    ripples = ripples.filter(ripple => {
        const age = now - ripple.birthTime;
        const waveSpeed = ripple.maxDist / 2;
        const waveHead = (age / 1000) * waveSpeed;
        return waveHead - 4 < ripple.maxDist; // Keep if still visible
    });

    // --- 5. Draw Person/Border Mosaic ---
    for (let y = 0; y < h; y += baseGridSize) {
        for (let x = 0; x < w; x += baseGridSize) {
            const bgX = x - (x % bgGridSize);
            const bgY = y - (y % bgGridSize);

            if (!isBlockPureBackground(bgX, bgY, bgGridSize, w, h, segmentationMask)) {
                const isPerson = isCellPerson(x + baseGridSize / 2, y + baseGridSize / 2, w, h, segmentationMask);
                if (isPerson) {
                    // Person's area: Draw image without an outline
                    ctx.drawImage(offscreenCanvas, x, y, baseGridSize, baseGridSize, x, y, baseGridSize, baseGridSize);
                } else {
                    // Border block
                    let r = 0, g = 0, b = 0, count = 0;
                    for (let by = 0; by < baseGridSize; by++) {
                        if (y + by >= h) break;
                        for (let bx = 0; bx < baseGridSize; bx++) {
                            if (x + bx >= w) break;
                            const index = ((y + by) * w + (x + bx)) * 4;
                            r += data[index]; g += data[index + 1]; b += data[index + 2];
                            count++;
                        }
                    }
                    if (count > 0) { r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count); }
                    const color = getClosestColor(r, g, b, currentColors);
                    const size = baseGridSize; // Use full size
                    const centerX = x + baseGridSize / 2;
                    const centerY = y + baseGridSize / 2;
                    drawShape(ctx, currentShape, centerX, centerY, size, color, 'fill');
                }
            }
        }
    }

    // --- 6. Draw Corner Dots ---
    const dotSize = parseInt(sliderThickness.value, 10);
    if (dotSize > 0) {
        ctx.fillStyle = '#ffffff';
        // Iterate over a grid and draw a dot if the grid point is in the background
        for (let y = 0; y <= h; y += baseGridSize) {
            for (let x = 0; x <= w; x += baseGridSize) {
                // Check if the grid point (x, y) is part of the background
                if (!isCellPerson(x, y, w, h, segmentationMask)) {
                    ctx.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
                }
            }
        }
    }
}

// Initial draw (poster)
drawFrame();
