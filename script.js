const macroCanvas = document.getElementById('macroCanvas');
const macroCtx = macroCanvas.getContext('2d');
const microCanvas = document.getElementById('microCanvas');
const microCtx = microCanvas.getContext('2d');

const btnDrop = document.getElementById('btnDrop');
const btnReset = document.getElementById('btnReset');
const failureModeSelect = document.getElementById('failureMode');
const speedControl = document.getElementById('speedControl');
const speedDisplay = document.getElementById('speedDisplay');
const macroStatus = document.getElementById('macroStatus');
const microStatus = document.getElementById('microStatus');
const explanationText = document.getElementById('explanationText');

let animationId;
let state = 'IDLE'; // IDLE, BENDING, FRACTURED, REBOUND
let time = 0;
let bendAmount = 0; // 0 to 1 (max bend)
let fractureOccurred = false;
let currentMode = 'imc';

// Configuration
const CONFIG = {
    bendSpeed: 0.15,
    reboundDamping: 0.95,
    reboundFreq: 0.3,
    maxBendY: 60
};

function init() {
    resizeCanvas();
    draw();
    
    btnDrop.addEventListener('click', startDrop);
    btnReset.addEventListener('click', reset);
    failureModeSelect.addEventListener('change', () => {
        currentMode = failureModeSelect.value;
        reset();
    });

    speedControl.addEventListener('input', () => {
        const val = (speedControl.value / 100).toFixed(1);
        speedDisplay.textContent = val + 'x';
    });
}

function resizeCanvas() {
    // Optional: make responsive if needed, fixed for now
}

function startDrop() {
    if (state !== 'IDLE') return;
    state = 'BENDING';
    time = 0;
    fractureOccurred = false;
    animate();
    btnDrop.disabled = true;
    failureModeSelect.disabled = true;
}

function reset() {
    cancelAnimationFrame(animationId);
    state = 'IDLE';
    time = 0;
    bendAmount = 0;
    fractureOccurred = false;
    btnDrop.disabled = false;
    failureModeSelect.disabled = false;
    macroStatus.textContent = "状态: 静止";
    microStatus.textContent = "微观变化: 无";
    explanationText.textContent = "点击“开始跌落”以观察微观变化。";
    draw();
}

function update() {
    const speedMult = speedControl.value / 100;

    if (state === 'BENDING') {
        // Simulate rapid bending downwards
        bendAmount += CONFIG.bendSpeed * speedMult;
        if (bendAmount >= 1.2) { // Overshoot slightly
            state = 'FRACTURE';
            fractureOccurred = true;
            // Pause briefly to show fracture moment? No, happens instantly.
            setTimeout(() => {
                state = 'REBOUND';
                time = 0; // Reset time for oscillation
            }, 100 / speedMult);
        }
        updateText('bending');
    } else if (state === 'REBOUND') {
        // Damped oscillation
        time += CONFIG.reboundFreq * speedMult;
        bendAmount = 1.0 * Math.exp(-time * 0.1) * Math.cos(time * 5);
        
        if (Math.abs(bendAmount) < 0.01 && time > 5) {
            state = 'FINISHED';
            cancelAnimationFrame(animationId);
            btnDrop.disabled = false;
            failureModeSelect.disabled = false;
            updateText('finished');
            draw(); // Final draw
            return;
        }
        updateText('rebound');
    }
}

function updateText(phase) {
    if (phase === 'bending') {
        macroStatus.textContent = "状态: 剧烈弯曲 (High Strain Rate)";
        microStatus.textContent = "微观变化: 焊点拉伸，应力集中，焊料变脆";
        explanationText.innerHTML = "<strong>0-0.5ms:</strong> PCB受到冲击发生剧烈弯曲。由于高应变率，焊料表现出<strong>脆性</strong>，无法通过形变释放应力。巨大的拉伸应力传递到界面。";
    } else if (state === 'FRACTURE') {
        macroStatus.textContent = "状态: 达到极限";
        microStatus.textContent = currentMode === 'imc' ? "失效: IMC层脆性断裂！" : "失效: 焊盘坑裂 (Pad Cratering)！";
        explanationText.innerHTML = currentMode === 'imc' 
            ? "<strong>失效瞬间:</strong> 脆弱的<strong>IMC层 (Cu6Sn5)</strong> 无法承受拉力，像玻璃一样发生解理断裂。裂纹瞬间贯穿。"
            : "<strong>失效瞬间:</strong> 焊点强度高于PCB基材。铜焊盘下的<strong>树脂和玻纤</strong>被撕裂，形成弹坑状剥离。";
    } else if (phase === 'rebound') {
        macroStatus.textContent = "状态: 阻尼振荡回弹";
        microStatus.textContent = "微观变化: 裂纹闭合/张开 (接触不良)";
        explanationText.innerHTML = "<strong>后续:</strong> PCB回弹并进行阻尼振荡。裂纹可能会在振荡中闭合，导致电路出现<strong>间歇性故障 (Intermittent Failure)</strong>。";
    } else if (phase === 'finished') {
        macroStatus.textContent = "状态: 静止 (已失效)";
    }
}

function draw() {
    // Clear Canvases
    macroCtx.clearRect(0, 0, macroCanvas.width, macroCanvas.height);
    microCtx.clearRect(0, 0, microCanvas.width, microCanvas.height);

    drawMacroView();
    drawMicroView();
}

function animate() {
    update();
    draw();
    if (state !== 'FINISHED') {
        animationId = requestAnimationFrame(animate);
    }
}

// --- Drawing Functions ---

function drawMacroView() {
    const ctx = macroCtx;
    const w = macroCanvas.width;
    const h = macroCanvas.height;
    const cy = h / 2;

    // Draw PCB (Curve)
    ctx.beginPath();
    ctx.moveTo(0, cy);
    
    // Quadratic curve for bending
    // Control point moves down based on bendAmount
    const bendY = cy + (bendAmount * CONFIG.maxBendY);
    
    ctx.quadraticCurveTo(w/2, bendY * 2 - cy, w, cy); // Simplified bending visual
    
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#2E8B57'; // PCB Green
    ctx.stroke();

    // Draw Component (Rigid block on top)
    // Calculate position on the curve (center)
    const midX = w / 2;
    const midY = bendY; // Approx vertex of parabola

    ctx.save();
    ctx.translate(midX, midY);
    // Component doesn't bend, it stays rigid but moves/rotates. 
    // For simple bending, it just moves down.
    
    // Draw Component Body
    ctx.fillStyle = '#333';
    ctx.fillRect(-40, -25, 80, 10); // Chip

    // Draw BGA Balls (Simplified)
    ctx.fillStyle = '#C0C0C0';
    // Left Ball
    ctx.beginPath();
    ctx.arc(-30, -10, 4, 0, Math.PI * 2);
    ctx.fill();
    // Right Ball
    ctx.beginPath();
    ctx.arc(30, -10, 4, 0, Math.PI * 2);
    ctx.fill();

    // Highlight the corner ball being analyzed
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(30, -10, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
    
    // Ground line
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, h - 20);
    ctx.lineTo(w, h - 20);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawMicroView() {
    const ctx = microCtx;
    const w = microCanvas.width;
    const h = microCanvas.height;
    const cx = w / 2;
    const cy = h / 2;

    // Scaling factor based on bendAmount for stretching effect
    // We only stretch the gap between component and PCB
    const stretch = Math.max(0, bendAmount * 20); 

    // 1. Component (Top)
    ctx.fillStyle = '#555';
    ctx.fillRect(50, 20, w - 100, 80);
    ctx.fillStyle = '#fff';
    ctx.font = "14px Arial";
    ctx.fillText("Component Body", 60, 50);

    // 2. PCB (Bottom) - Moves down based on stretch
    const pcbY = 250 + stretch;
    
    // If Cratering, the pad stays with solder or rips out?
    // Cratering: Pad rips out of PCB. So Pad stays up, PCB moves down.
    // IMC: Pad stays with PCB.
    
    // Draw PCB Resin
    ctx.fillStyle = '#2E8B57'; // Green FR4
    ctx.fillRect(50, pcbY, w - 100, 100);
    
    // Fiber weave pattern (optional detail)
    ctx.strokeStyle = '#1e5e3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=60; i<w-60; i+=20) {
        ctx.moveTo(i, pcbY);
        ctx.lineTo(i+10, pcbY+100);
    }
    ctx.stroke();

    // 3. Copper Pad
    const padX = cx - 60;
    const padW = 120;
    const padH = 15;
    let padY = pcbY; // Default: Pad is on PCB

    if (fractureOccurred && currentMode === 'cratering') {
        // Pad is detached from PCB, sticks to solder
        // Solder bottom is at roughly 250 (original pos) + some elastic deformation
        // Let's say pad stays closer to the ball
        padY = 250 + (stretch * 0.2); // Moves down slightly but less than PCB
    }

    ctx.fillStyle = '#B87333'; // Copper
    ctx.fillRect(padX, padY, padW, padH);

    // 4. Solder Ball
    // Center of ball
    const ballCy = (100 + padY) / 2; 
    const ballH = padY - 100; // Height of ball area
    
    ctx.fillStyle = '#C0C0C0'; // SAC305
    
    // Draw Solder shape (hourglass if stretched)
    ctx.beginPath();
    if (stretch > 5) {
        // Stretched shape
        ctx.moveTo(cx - 50, 100); // Top Left
        ctx.quadraticCurveTo(cx - 30, 100 + ballH/2, cx - 50, padY); // Left curve
        ctx.lineTo(cx + 50, padY); // Bottom Right
        ctx.quadraticCurveTo(cx + 30, 100 + ballH/2, cx + 50, 100); // Right curve
        ctx.closePath();
    } else {
        // Normal shape
        ctx.ellipse(cx, 100 + ballH/2, 55, ballH/2, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    // 5. IMC Layer (Between Solder and Pad)
    const imcY = padY;
    ctx.fillStyle = '#8B4513'; // Dark Brown IMC
    ctx.fillRect(padX + 5, imcY - 4, padW - 10, 4);

    // 6. Fracture Visualization
    if (fractureOccurred) {
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 3;
        ctx.beginPath();

        if (currentMode === 'imc') {
            // Crack at IMC layer
            // Zigzag line
            let startY = imcY - 2;
            ctx.moveTo(padX, startY);
            for(let i=0; i<=padW; i+=10) {
                ctx.lineTo(padX + i, startY + (Math.random()*4 - 2));
            }
            
            // Visual separation if stretched
            if (stretch > 0) {
                // We need to show a gap. 
                // Since we drew the ball connected to padY, we can just draw a white gap over it?
                // Or better, draw the crack clearly.
                // Let's draw a "Gap" polygon
                ctx.fillStyle = '#FFFFFF'; // Background color
                ctx.beginPath();
                ctx.moveTo(padX, startY);
                ctx.lineTo(padX + padW, startY);
                ctx.lineTo(padX + padW, startY - (stretch * 0.5)); // Gap opens up
                ctx.lineTo(padX, startY - (stretch * 0.5));
                ctx.fill();
            }
        } else if (currentMode === 'cratering') {
            // Crack under the pad (in the resin)
            // We already moved the pad up relative to PCB in step 3.
            // Draw the jagged resin surface
            ctx.fillStyle = '#2E8B57'; // Resin color
            ctx.beginPath();
            ctx.moveTo(padX, pcbY);
            for(let i=0; i<=padW; i+=5) {
                ctx.lineTo(padX + i, pcbY + (Math.random()*5));
            }
            ctx.lineTo(padX + padW, pcbY + 15); // Close shape
            ctx.lineTo(padX, pcbY + 15);
            ctx.fill();
            
            // Draw "Crater" on the PCB side
            ctx.fillStyle = '#1a4a2e'; // Darker hole
            ctx.beginPath();
            ctx.ellipse(cx, pcbY + 5, 50, 5, 0, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.stroke();
    }

    // Stress indicators (Color gradients)
    if (state === 'BENDING' || (state === 'REBOUND' && Math.abs(bendAmount) > 0.2)) {
        // Add red glow to corners
        const grad = ctx.createRadialGradient(cx - 50, padY, 5, cx - 50, padY, 30);
        grad.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
        grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(padX, padY - 20, 40, 40); // Left corner
        
        const grad2 = ctx.createRadialGradient(cx + 50, padY, 5, cx + 50, padY, 30);
        grad2.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
        grad2.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = grad2;
        ctx.fillRect(padX + padW - 40, padY - 20, 40, 40); // Right corner
    }
}

init();