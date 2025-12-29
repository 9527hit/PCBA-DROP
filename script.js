const macroCanvas = document.getElementById('macroCanvas');
const macroCtx = macroCanvas.getContext('2d');
const microCanvas = document.getElementById('microCanvas');
const microCtx = microCanvas.getContext('2d');

const btnDrop = document.getElementById('btnDrop');
const btnAnalysis = document.getElementById('btnAnalysis');
const btnReset = document.getElementById('btnReset');
const failureModeSelect = document.getElementById('failureMode');
const speedControl = document.getElementById('speedControl');
const speedDisplay = document.getElementById('speedDisplay');
const macroStatus = document.getElementById('macroStatus');
const microStatus = document.getElementById('microStatus');
const explanationText = document.getElementById('explanationText');

let animationId;
let state = 'IDLE'; // IDLE, BENDING, FRACTURED, REBOUND, PULLING
let time = 0;
let bendAmount = 0; // 0 to 1 (max bend)
let pullHeight = 0; // For pull simulation
let fractureOccurred = false;
let currentMode = 'imc';

// Configuration
const CONFIG = {
    bendSpeed: 0.15,
    pullSpeed: 0.5,
    reboundDamping: 0.95,
    reboundFreq: 0.3,
    maxBendY: 60
};

function init() {
    resizeCanvas();
    draw();
    
    btnDrop.addEventListener('click', startSimulation);
    btnAnalysis.addEventListener('click', showAnalysis);
    btnReset.addEventListener('click', reset);
    failureModeSelect.addEventListener('change', () => {
        currentMode = failureModeSelect.value;
        // Update button text based on mode
        if (currentMode.startsWith('pull')) {
            btnDrop.textContent = "开始拆机 (Pull)";
        } else {
            btnDrop.textContent = "开始跌落 (Drop)";
        }
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

function startSimulation() {
    if (state !== 'IDLE' && state !== 'ANALYSIS') return;
    
    if (currentMode.startsWith('pull')) {
        state = 'PULLING';
    } else {
        state = 'BENDING';
    }
    
    time = 0;
    fractureOccurred = false;
    animate();
    btnDrop.disabled = true;
    btnAnalysis.disabled = true;
    failureModeSelect.disabled = true;
}

function showAnalysis() {
    console.log("Showing Analysis View");
    state = 'ANALYSIS';
    cancelAnimationFrame(animationId);
    draw();
    updateText('analysis');
    btnDrop.disabled = false;
    btnAnalysis.disabled = true;
}

function reset() {
    cancelAnimationFrame(animationId);
    state = 'IDLE';
    time = 0;
    bendAmount = 0;
    pullHeight = 0;
    fractureOccurred = false;
    btnDrop.disabled = false;
    btnAnalysis.disabled = false;
    failureModeSelect.disabled = false;
    macroStatus.textContent = "状态: 静止";
    microStatus.textContent = "微观变化: 无";
    explanationText.textContent = "点击按钮以观察微观变化。";
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
    } else if (state === 'PULLING') {
        // Simulate vertical pull
        pullHeight += CONFIG.pullSpeed * speedMult;
        
        // Fracture happens at a certain height
        if (pullHeight >= 20 && !fractureOccurred) {
            state = 'FRACTURE';
            fractureOccurred = true;
            setTimeout(() => {
                state = 'PULL_FINISHED';
            }, 500 / speedMult);
        }
        updateText('pulling');
    } else if (state === 'PULL_FINISHED') {
        // Continue pulling component away
        pullHeight += CONFIG.pullSpeed * speedMult;
        if (pullHeight > 100) {
            state = 'FINISHED';
            cancelAnimationFrame(animationId);
            btnDrop.disabled = false;
            failureModeSelect.disabled = false;
            updateText('finished');
        }
    }
}

function updateText(phase) {
    if (phase === 'bending') {
        macroStatus.textContent = "状态: 剧烈弯曲 (High Strain Rate)";
        microStatus.textContent = "微观变化: 焊点拉伸，应力集中，焊料变脆";
        explanationText.innerHTML = "<strong>0-0.5ms:</strong> PCB受到冲击发生剧烈弯曲。由于高应变率，焊料表现出<strong>脆性</strong>，无法通过形变释放应力。巨大的拉伸应力传递到界面。";
    } else if (phase === 'pulling') {
        macroStatus.textContent = "状态: 垂直拉拔/剥离 (Pull/Peel)";
        microStatus.textContent = "微观变化: 形状因子 S≈6.1，凝胶硬化";
        explanationText.innerHTML = "<strong>参数代入:</strong> 凝胶厚度0.5mm，计算形状因子 <strong>S = 6.1</strong>。在此约束下，凝胶的表观刚度提升数十倍，表现出<strong>静水压力硬化</strong>效应。它不再是软胶，而是像液压油一样将拉力完整传递给芯片。";
    } else if (state === 'FRACTURE') {
        macroStatus.textContent = "状态: 达到极限";
        if (currentMode === 'pull_cratering') {
            microStatus.textContent = "失效: 焊盘坑裂 (Pad Cratering) - 逐排撕裂";
            explanationText.innerHTML = "<strong>失效计算:</strong> 剥离时应力集中在最外侧一排焊点。单排焊点强度 (约100N) < 凝胶传递的剥离力。<strong>失效模式为“拉链式”逐排断裂</strong>，最终导致芯片整体脱落。";
        } else {
            microStatus.textContent = currentMode === 'imc' ? "失效: IMC层脆性断裂！" : "失效: 焊盘坑裂 (Pad Cratering)！";
            explanationText.innerHTML = currentMode === 'imc' 
                ? "<strong>失效瞬间:</strong> 脆弱的<strong>IMC层 (Cu6Sn5)</strong> 无法承受拉力，像玻璃一样发生解理断裂。裂纹瞬间贯穿。"
                : "<strong>失效瞬间:</strong> 焊点强度高于PCB基材。铜焊盘下的<strong>树脂和玻纤</strong>被撕裂，形成弹坑状剥离。";
        }
    } else if (phase === 'rebound') {
        macroStatus.textContent = "状态: 阻尼振荡回弹";
        microStatus.textContent = "微观变化: 裂纹闭合/张开 (接触不良)";
        explanationText.innerHTML = "<strong>后续:</strong> PCB回弹并进行阻尼振荡。裂纹可能会在振荡中闭合，导致电路出现<strong>间歇性故障 (Intermittent Failure)</strong>。";
    } else if (phase === 'finished') {
        macroStatus.textContent = "状态: 静止 (已失效)";
    } else if (phase === 'analysis') {
        macroStatus.textContent = "状态: 受力分析 (Force Analysis)";
        microStatus.textContent = "视图: 芯片俯视 (Top View)";
        explanationText.innerHTML = "<strong>悬空区 (Overhang) 效应:</strong> UFS芯片边缘没有锡球，存在显著的悬空区域。<br>凝胶粘接了整个芯片底面（包括悬空区）。当凝胶拉动悬空区时，它就像一个<strong>撬棍 (Crowbar)</strong>，以最外圈焊球为支点，产生额外的<strong>剥离力矩</strong>。这进一步加剧了边缘焊球的断裂风险。";
    }
}

function draw() {
    // Clear Canvases
    macroCtx.clearRect(0, 0, macroCanvas.width, macroCanvas.height);
    microCtx.clearRect(0, 0, microCanvas.width, microCanvas.height);

    if (state === 'ANALYSIS') {
        drawAnalysisView();
    } else {
        drawMacroView();
        drawMicroView();
    }
}

function drawAnalysisView() {
    // Use Macro Canvas for Top View Diagram
    const ctx = macroCtx;
    const w = macroCanvas.width;
    const h = macroCanvas.height;
    const cx = w / 2;
    const cy = h / 2;

    // Draw Chip Outline
    const chipW = 200;
    const chipH = 220; // 11.5 x 13 ratio approx
    const left = cx - chipW/2;
    const top = cy - chipH/2;

    ctx.fillStyle = '#eee';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.fillRect(left, top, chipW, chipH);
    ctx.strokeRect(left, top, chipW, chipH);

    // Draw Solder Balls (Perimeter Array)
    ctx.fillStyle = '#e74c3c'; // Red for stress points
    const ballSize = 4;
    const pitch = 12;
    
    // Simulate the pattern from the image (Perimeter dense, center empty)
    // Rows: 0 to 18 approx
    // Cols: 0 to 16 approx
    for(let r=0; r<18; r++) {
        for(let c=0; c<16; c++) {
            // Logic to create empty center
            // Keep outer 3-4 rows/cols
            const isOuter = r < 4 || r > 13 || c < 4 || c > 11;
            // Also some corner logic or specific pattern
            if (isOuter) {
                const x = left + 10 + c * pitch;
                const y = top + 10 + r * pitch;
                ctx.beginPath();
                ctx.arc(x, y, ballSize, 0, Math.PI*2);
                ctx.fill();
            }
        }
    }

    // Draw Gel Force (Blue Gradient in Center)
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 80);
    grad.addColorStop(0, 'rgba(52, 152, 219, 0.8)'); // Strong blue center
    grad.addColorStop(1, 'rgba(52, 152, 219, 0.1)');
    ctx.fillStyle = grad;
    ctx.fillRect(left, top, chipW, chipH);

    // Annotations
    ctx.fillStyle = '#000';
    ctx.font = "14px Arial";
    ctx.fillText("Gel Suction Force (Center)", cx - 80, cy);
    
    ctx.fillStyle = '#c0392b';
    ctx.fillText("High Stress (Perimeter)", left - 10, top - 10);
    
    // Add text about Overhang
    ctx.fillStyle = '#d35400';
    ctx.font = "12px Arial";
    ctx.fillText("Overhang (悬空区)", left - 40, top + chipH/2);
    ctx.fillText("Leverage Arm", left - 40, top + chipH/2 + 15);

    // Draw Force Arrows
    // Center Up
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 20);
    ctx.lineTo(cx, cy - 20);
    ctx.lineTo(cx - 10, cy - 10);
    ctx.moveTo(cx, cy - 20);
    ctx.lineTo(cx + 10, cy - 10);
    ctx.stroke();

    // Edge Resistance
    // Draw small arrows on corners pointing down (resistance)
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    // Top Left
    ctx.beginPath();
    ctx.moveTo(left + 20, top + 20);
    ctx.lineTo(left + 20, top + 40); // Down
    ctx.stroke();
    // Top Right
    ctx.beginPath();
    ctx.moveTo(left + chipW - 20, top + 20);
    ctx.lineTo(left + chipW - 20, top + 40); // Down
    ctx.stroke();
    // Bottom Left
    ctx.beginPath();
    ctx.moveTo(left + 20, top + chipH - 40);
    ctx.lineTo(left + 20, top + chipH - 20); // Down
    ctx.stroke();
    // Bottom Right
    ctx.beginPath();
    ctx.moveTo(left + chipW - 20, top + chipH - 40);
    ctx.lineTo(left + chipW - 20, top + chipH - 20); // Down
    ctx.stroke();

    // --- Micro Canvas for Side Profile Analysis ---
    const mCtx = microCtx;
    const mw = microCanvas.width;
    const mh = microCanvas.height;
    const mcx = mw / 2;
    const mcy = mh / 2;

    // Draw Side Profile (Leverage Effect)
    // PCB
    mCtx.fillStyle = '#2E8B57';
    mCtx.fillRect(50, mcy + 50, mw - 100, 20);
    mCtx.fillStyle = '#fff';
    mCtx.fillText("PCB Substrate", 60, mcy + 65);

    // Chip (Bowed)
    mCtx.beginPath();
    mCtx.moveTo(50, mcy); // Left edge
    mCtx.quadraticCurveTo(mcx, mcy - 30, mw - 50, mcy); // Bowed up in center
    mCtx.lineWidth = 10;
    mCtx.strokeStyle = '#555';
    mCtx.stroke();
    mCtx.fillStyle = '#000';
    mCtx.fillText("Chip (Bowing Deformation)", mcx - 70, mcy - 40);

    // Gel (Filling the gap)
    mCtx.fillStyle = 'rgba(52, 152, 219, 0.5)';
    mCtx.beginPath();
    mCtx.moveTo(50, mcy);
    mCtx.quadraticCurveTo(mcx, mcy - 30, mw - 50, mcy); // Top curve
    mCtx.lineTo(mw - 50, mcy + 50);
    mCtx.lineTo(50, mcy + 50);
    mCtx.fill();

    // Solder Balls (Only at edges - but indented)
    // UFS balls are NOT at the very edge. There is an overhang.
    // Let's move balls inward to show overhang.
    const overhang = 30; 
    mCtx.fillStyle = '#e74c3c';
    // Left Ball (Stretched)
    mCtx.fillRect(60 + overhang, mcy + 5, 10, 45); // Moved in
    // Right Ball (Stretched)
    mCtx.fillRect(mw - 70 - overhang, mcy + 5, 10, 45); // Moved in

    // Draw Overhang Annotation
    mCtx.strokeStyle = '#d35400';
    mCtx.lineWidth = 2;
    mCtx.beginPath();
    mCtx.moveTo(50, mcy + 60);
    mCtx.lineTo(60 + overhang, mcy + 60);
    mCtx.stroke();
    mCtx.fillStyle = '#d35400';
    mCtx.font = "12px Arial";
    mCtx.fillText("Overhang", 50, mcy + 75);

    // Force Arrows
    // Big Blue Arrow Up in Center
    mCtx.fillStyle = '#3498db';
    mCtx.font = "20px Arial";
    mCtx.fillText("↑ Gel Force", mcx - 40, mcy + 20);

    // Red Arrows Down at Edges
    mCtx.fillStyle = '#e74c3c';
    mCtx.fillText("↓ Stress", 40, mcy - 10);
    mCtx.fillText("↓ Stress", mw - 100, mcy - 10);
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

    if (currentMode.startsWith('pull')) {
        // --- PULL SIMULATION DRAWING ---
        
        // Draw PCB (Flat or slightly bowed up)
        ctx.beginPath();
        ctx.moveTo(0, cy + 40);
        // Slight bow up if pulling hard
        const bow = Math.min(10, pullHeight * 0.5);
        ctx.quadraticCurveTo(w/2, cy + 40 - bow, w, cy + 40);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#2E8B57'; // PCB Green
        ctx.stroke();

        // Draw Component
        const compY = cy + 40 - 15 - pullHeight; // Moves up
        const midX = w / 2;
        
        // Draw Heatsink/Case above component
        const heatsinkY = compY - 20;
        ctx.fillStyle = '#444'; // Dark Grey Heatsink
        ctx.fillRect(midX - 60, heatsinkY - 30, 120, 30);
        ctx.fillStyle = '#fff';
        ctx.font = "10px Arial";
        ctx.fillText("Heatsink / Case", midX - 35, heatsinkY - 12);

        // Draw Thermal Gel (Stretching)
        ctx.fillStyle = '#87CEEB'; // Light Blue Gel
        ctx.beginPath();
        ctx.moveTo(midX - 30, heatsinkY);
        ctx.lineTo(midX + 30, heatsinkY);
        // Gel stretches between heatsink and component
        ctx.lineTo(midX + 30, compY); 
        ctx.lineTo(midX - 30, compY);
        ctx.fill();

        // Draw Component Body
        ctx.fillStyle = '#333';
        ctx.fillRect(midX - 40, compY, 80, 10); 

        // Draw Balls
        // If fractured, balls stay with component or PCB?
        // Pad Cratering: Balls stay with component, Pad rips out.
        const ballY = compY + 10;
        
        ctx.fillStyle = '#C0C0C0';
        // Left Ball
        ctx.beginPath();
        ctx.arc(midX - 30, ballY + 4, 4, 0, Math.PI * 2);
        ctx.fill();
        // Right Ball
        ctx.beginPath();
        ctx.arc(midX + 30, ballY + 4, 4, 0, Math.PI * 2);
        ctx.fill();

        // Ground line
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, h - 20);
        ctx.lineTo(w, h - 20);
        ctx.stroke();
        ctx.setLineDash([]);

        return; // Exit macro view for pull mode
    }

    // --- DROP SIMULATION DRAWING (Original) ---
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

    if (currentMode.startsWith('pull')) {
        // --- PULL MICRO VIEW ---
        const stretch = pullHeight * 2; // Visual scale
        
        // 1. Component (Top) - Moves UP
        const compY = 50 - stretch; 
        
        // Draw Heatsink & Gel in Micro view too? Maybe just component up.
        // Let's show the upward force arrow
        ctx.fillStyle = '#e74c3c';
        ctx.font = "20px Arial";
        ctx.fillText("↑ Pull Force", cx - 40, compY - 10);

        ctx.fillStyle = '#555';
        ctx.fillRect(50, compY, w - 100, 80);
        ctx.fillStyle = '#fff';
        ctx.font = "14px Arial";
        ctx.fillText("Component Body (UFS)", 60, compY + 30);

        // 2. PCB (Bottom) - Stays fixed mostly
        const pcbY = 250;
        ctx.fillStyle = '#2E8B57'; // Green FR4
        ctx.fillRect(50, pcbY, w - 100, 100);
        
        // Fiber weave
        ctx.strokeStyle = '#1e5e3a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let i=60; i<w-60; i+=20) {
            ctx.moveTo(i, pcbY);
            ctx.lineTo(i+10, pcbY+100);
        }
        ctx.stroke();

        // 3. Copper Pad & Solder
        // In Pull Cratering: Pad moves UP with Solder
        let padY = pcbY;
        let ballY = compY + 80; // Bottom of component
        
        if (fractureOccurred) {
            // Pad is ripped out, moves with component
            padY = ballY + 100; // Solder height approx 100
        } else {
            // Stretching solder
            // Pad is fixed at pcbY
        }

        // Let's calculate positions based on stretch
        // Top of solder = compY + 80
        // Bottom of solder = pcbY (if not broken) OR moves up (if broken)
        
        let solderTop = compY + 80;
        let solderBottom = pcbY;
        
        if (fractureOccurred) {
            solderBottom = solderTop + 100; // Fixed height solder, moving up
            padY = solderBottom; // Pad attached to bottom of solder
        }

        // Draw Pad
        const padX = cx - 60;
        const padW = 120;
        const padH = 15;
        
        ctx.fillStyle = '#B87333'; // Copper
        ctx.fillRect(padX, padY, padW, padH);

        // Draw Solder
        ctx.fillStyle = '#C0C0C0';
        ctx.beginPath();
        
        if (!fractureOccurred) {
            // Stretching hourglass
            ctx.moveTo(cx - 50, solderTop);
            ctx.quadraticCurveTo(cx - 20, (solderTop+solderBottom)/2, cx - 50, solderBottom);
            ctx.lineTo(cx + 50, solderBottom);
            ctx.quadraticCurveTo(cx + 20, (solderTop+solderBottom)/2, cx + 50, solderTop);
        } else {
            // Broken off, normal shape but moved up
            ctx.ellipse(cx, (solderTop+solderBottom)/2, 55, 50, 0, 0, Math.PI * 2);
        }
        ctx.fill();

        // IMC
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(padX + 5, padY - 4, padW - 10, 4);

        // Cratering Fracture
        if (fractureOccurred) {
            // Draw the crater in PCB
            ctx.fillStyle = '#1a4a2e'; // Dark hole
            ctx.beginPath();
            ctx.ellipse(cx, pcbY + 5, 50, 8, 0, 0, Math.PI*2);
            ctx.fill();

            // Draw resin chunk on pad
            ctx.fillStyle = '#2E8B57';
            ctx.beginPath();
            ctx.moveTo(padX, padY + padH);
            for(let i=0; i<=padW; i+=10) {
                ctx.lineTo(padX + i, padY + padH + Math.random()*10);
            }
            ctx.lineTo(padX + padW, padY + padH);
            ctx.fill();
        }

        return;
    }

    // --- DROP MICRO VIEW (Original) ---
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