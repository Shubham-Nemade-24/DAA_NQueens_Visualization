/* ============================================================
   N-QUEENS VISUALIZER — Complete JS Engine v5
   Shubham Nemade | PRN: 123B1B020 | DAA FA Presentation

   Key architecture:
   - Board: inline styles only, no CSS class colors
   - Tree: built ONCE as static SVG with viewBox scaling
           → entire tree visible at all times, no scroll needed
           → per-step updates only modify node attributes
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    // ─── DOM ────────────────────────────────────────────────
    const nInput         = document.getElementById('nInput');
    const nDec           = document.getElementById('nDec');
    const nInc           = document.getElementById('nInc');
    const speedInput     = document.getElementById('speedInput');
    const startBtn       = document.getElementById('startBtn');
    const stepBtn        = document.getElementById('stepBtn');
    const autoBtn        = document.getElementById('autoBtn');
    const resetBtn       = document.getElementById('resetBtn');
    const chessGrid      = document.getElementById('chessGrid');
    const colLabels      = document.getElementById('colLabels');
    const rowLabels      = document.getElementById('rowLabels');
    const boardTitle     = document.getElementById('boardTitle');
    const statusBadge    = document.getElementById('statusBadge');
    const stepCount      = document.getElementById('stepCount');
    const stepText       = document.getElementById('stepText');
    const stepLogWrap    = document.getElementById('stepLogWrap');
    const stepLog        = document.getElementById('stepLog');
    const treeSvg        = document.getElementById('treeSvg');
    const treeContainer  = document.getElementById('treeContainer');
    const treeHint       = document.getElementById('treeHint');
    const statSol        = document.getElementById('statSolutions');
    const statBT         = document.getElementById('statBacktracks');
    const statNode       = document.getElementById('statNodes');
    const solutionsOutput= document.getElementById('solutionsOutput');
    const solBoardsGrid  = document.getElementById('solBoardsGrid');
    const solOutCount    = document.getElementById('solOutCount');
    const solOutTotal    = document.getElementById('solOutTotal');

    // ─── STATE ──────────────────────────────────────────────
    let N            = 4;
    let cellPx       = 64;
    let steps        = [];
    let curStep      = 0;
    let autoTimer    = null;
    let solCount     = 0;
    let btCount      = 0;
    let nodeCount    = 0;
    let allSolutions = [];
    let algoMode     = 'backtrack';  // 'backtrack' or 'brute'

    // Algorithm data
    let tNodes = [];   // { id, pid, row, col, type }
    let tEdges = [];   // { from, to }
    let nodeSeq= 0;

    // Tree layout (computed once)
    let nodeX = {};
    let nodeY = {};
    let svgW  = 600;
    let svgH  = 400;

    // Camera viewport — fixed-size window that pans to follow active node
    const CAM_W = 500;   // viewport width in SVG coords
    const CAM_H = 350;   // viewport height in SVG coords
    let camX = 0;        // current camera top-left X
    let camY = 0;        // current camera top-left Y
    let camAnimId = null; // requestAnimationFrame ID

    // Tree render state  (updated per-step without full SVG rebuild)
    let nodeTypeState = {};  // id → current visual type
    let prevActiveId  = -1;  // id of previously highlighted node

    // Chess colors
    const CHESS_LIGHT = '#f0d9b5';
    const CHESS_DARK  = '#b58863';

    // Node visual styles
    const N_STYLE = {
        root:     { fill:'#6366f1', stroke:'#4338ca', text:'#fff' },
        unexplored:{ fill:'#f1f5f9', stroke:'#cbd5e1', text:'#64748b' },
        placed:   { fill:'#d1fae5', stroke:'#6ee7b7', text:'#065f46' },
        backtrack:{ fill:'#fef9c3', stroke:'#fde047', text:'#713f12' },
        pruned:   { fill:'#fee2e2', stroke:'#fca5a5', text:'#7f1d1d' },
        solution: { fill:'#bbf7d0', stroke:'#4ade80', text:'#064e3b' },
        active:   { fill:'#6366f1', stroke:'#312e81', text:'#fff' }
    };

    // ─── INIT ───────────────────────────────────────────────
    initParticles();
    buildBoard();

    // ─── EVENTS ─────────────────────────────────────────────
    const algoBacktrackBtn = document.getElementById('algoBacktrack');
    const algoBruteBtn     = document.getElementById('algoBrute');

    nDec.addEventListener('click',    () => setN(N - 1));
    nInc.addEventListener('click',    () => setN(N + 1));
    nInput.addEventListener('change', () => setN(parseInt(nInput.value) || 4));
    startBtn.addEventListener('click',  onStart);
    stepBtn.addEventListener('click',   onStep);
    autoBtn.addEventListener('click',   onAuto);
    resetBtn.addEventListener('click',  onReset);

    algoBacktrackBtn.addEventListener('click', () => setAlgo('backtrack'));
    algoBruteBtn.addEventListener('click',     () => setAlgo('brute'));

    function setAlgo(mode) {
        algoMode = mode;
        algoBacktrackBtn.classList.toggle('active', mode === 'backtrack');
        algoBruteBtn.classList.toggle('active', mode === 'brute');
        onReset();
    }

    function setN(v) {
        N = Math.max(4, Math.min(10, v));
        nInput.value = N;
        onReset();
    }

    // ════════════════════════════════════════════════════════
    //  BUILD CHESS BOARD
    // ════════════════════════════════════════════════════════
    function buildBoard() {
        cellPx = N <= 4 ? 72 : N <= 5 ? 62 : N <= 6 ? 54 : N <= 7 ? 48 : N <= 8 ? 42 : 36;

        // Title
        const svg = boardTitle.querySelector('svg');
        boardTitle.innerHTML = '';
        if (svg) boardTitle.appendChild(svg);
        boardTitle.appendChild(document.createTextNode(` Chessboard — ${N} × ${N}`));

        // Column labels
        colLabels.innerHTML = '';
        const sp = document.createElement('div');
        sp.style.cssText = 'width:26px;flex-shrink:0';
        colLabels.appendChild(sp);
        for (let c = 0; c < N; c++) {
            const d = document.createElement('div');
            d.className = 'col-lbl';
            d.style.width = cellPx + 'px';
            d.textContent = String.fromCharCode(97 + c);
            colLabels.appendChild(d);
        }

        // Row labels
        rowLabels.innerHTML = '';
        for (let r = 0; r < N; r++) {
            const d = document.createElement('div');
            d.className = 'row-lbl';
            d.style.height = cellPx + 'px';
            d.style.lineHeight = cellPx + 'px';
            d.textContent = r + 1;
            rowLabels.appendChild(d);
        }

        // Chess cells
        chessGrid.innerHTML = '';
        chessGrid.style.gridTemplateColumns = `repeat(${N}, ${cellPx}px)`;
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const cell = document.createElement('div');
                cell.id         = `cc-${r}-${c}`;
                cell.className  = 'chess-cell';
                cell.style.width    = cellPx + 'px';
                cell.style.height   = cellPx + 'px';
                cell.style.fontSize = Math.round(cellPx * 0.60) + 'px';
                cell.style.background = (r + c) % 2 === 0 ? CHESS_LIGHT : CHESS_DARK;
                chessGrid.appendChild(cell);
            }
        }
    }

    function $cell(r, c) { return document.getElementById(`cc-${r}-${c}`); }

    function resetCellStyle(r, c) {
        const el = $cell(r, c);
        if (!el) return;
        el.style.background = (r + c) % 2 === 0 ? CHESS_LIGHT : CHESS_DARK;
        el.style.boxShadow = '';
        el.style.outline   = '';
        el.style.opacity   = '1';
        el.innerHTML       = '';
    }

    // ════════════════════════════════════════════════════════
    //  PRE-COMPUTE ALL STEPS — BACKTRACKING
    // ════════════════════════════════════════════════════════
    function computeSteps() {
        steps  = [];
        tNodes = []; tEdges = []; nodeSeq = 0;

        const board = Array(N).fill(-1);
        const rootId = nodeSeq++;
        tNodes.push({ id:rootId, pid:null, row:-1, col:-1, type:'root' });

        function isSafe(row, col) {
            for (let r = 0; r < row; r++) {
                if (board[r] === col) return false;
                if (Math.abs(board[r] - col) === Math.abs(r - row)) return false;
            }
            return true;
        }

        function getAttackers(row, col) {
            const list = [];
            for (let r = 0; r < row; r++) {
                if (board[r] === -1) continue;
                if (board[r] === col || Math.abs(board[r] - col) === Math.abs(r - row))
                    list.push({ r, c: board[r] });
            }
            return list;
        }

        function queens(upTo) {
            const q = [];
            for (let r = 0; r < upTo; r++)
                if (board[r] !== -1) q.push({ r, c: board[r] });
            return q;
        }

        function bt(row, pid) {
            if (row === N) {
                steps.push({ type:'solution', row:row-1, col:board[row-1],
                    queens:queens(N), atk:[], nid:pid,
                    msg:`♛ Solution: [${board.join(', ')}]` });
                return;
            }
            for (let col = 0; col < N; col++) {
                const nid = nodeSeq++;
                tNodes.push({ id:nid, pid, row, col, type:'unexplored' });
                tEdges.push({ from:pid, to:nid });

                const safe = isSafe(row, col);
                const atk  = safe ? [] : getAttackers(row, col);

                steps.push({ type:'try', row, col, safe, atk,
                    queens:queens(row), nid, msg:`→ Try (${row},${col})` });

                if (safe) {
                    board[row] = col;
                    steps.push({ type:'place', row, col, atk:[],
                        queens:queens(row+1), nid, msg:`✔ Place at (${row},${col})` });
                    bt(row + 1, nid);
                    board[row] = -1;
                    steps.push({ type:'backtrack', row, col, atk:[],
                        queens:queens(row), nid, msg:`← Backtrack from (${row},${col})` });
                } else {
                    steps.push({ type:'conflict', row, col, atk,
                        queens:queens(row), nid, msg:`✘ Conflict at (${row},${col})` });
                }
            }
        }

        bt(0, rootId);
    }

    // ════════════════════════════════════════════════════════
    //  PRE-COMPUTE ALL STEPS — BRUTE FORCE (N^N combos)
    // ════════════════════════════════════════════════════════
    function computeStepsBrute() {
        steps  = [];
        tNodes = []; tEdges = []; nodeSeq = 0;

        // Root node for tree (still build a tree for visual continuity)
        const rootId = nodeSeq++;
        tNodes.push({ id:rootId, pid:null, row:-1, col:-1, type:'root' });

        const totalCombos = Math.pow(N, N);
        let comboNum = 0;

        // Generate all N^N column combos
        function enumerate(cols) {
            if (cols.length === N) {
                comboNum++;
                const queens = cols.map((c, r) => ({ r, c }));
                const nid = nodeSeq++;
                tNodes.push({ id:nid, pid:rootId, row:N-1, col:cols[N-1], type:'unexplored' });
                tEdges.push({ from:rootId, to:nid });

                // Find ALL conflicts in this full placement
                const conflicts = [];
                for (let i = 0; i < N; i++) {
                    for (let j = i + 1; j < N; j++) {
                        if (cols[i] === cols[j] ||
                            Math.abs(cols[i] - cols[j]) === Math.abs(i - j)) {
                            conflicts.push({ r1:i, c1:cols[i], r2:j, c2:cols[j] });
                        }
                    }
                }

                const isValid = conflicts.length === 0;

                // Step 1: Place all queens on board
                steps.push({
                    type: 'bf_place',
                    queens, conflicts, isValid, nid, comboNum, totalCombos,
                    cols: [...cols],
                    msg: `Board #${comboNum}/${totalCombos}: [${cols.join(',')}]`
                });

                // Step 2: Result
                if (isValid) {
                    steps.push({
                        type: 'bf_valid',
                        queens, conflicts, isValid, nid, comboNum, totalCombos,
                        cols: [...cols],
                        msg: `✔ Solution #${comboNum}: [${cols.join(',')}]`
                    });
                } else {
                    steps.push({
                        type: 'bf_invalid',
                        queens, conflicts, isValid, nid, comboNum, totalCombos,
                        cols: [...cols],
                        msg: `✘ Invalid — ${conflicts.length} conflict(s)`
                    });
                }
                return;
            }
            for (let c = 0; c < N; c++) {
                enumerate([...cols, c]);
            }
        }
        enumerate([]);
    }

    // ════════════════════════════════════════════════════════
    //  RENDER BOARD STATE
    // ════════════════════════════════════════════════════════
    function renderBoard(step) {
        // 1. Full reset to chess colors
        for (let r = 0; r < N; r++)
            for (let c = 0; c < N; c++) resetCellStyle(r, c);

        // 2. Amber row highlight
        if (step.type !== 'solution' && step.row >= 0) {
            for (let c = 0; c < N; c++) {
                const el = $cell(step.row, c);
                if (!el) continue;
                el.style.background = (step.row + c) % 2 === 0
                    ? 'rgba(245,158,11,0.30)' : 'rgba(245,158,11,0.48)';
            }
        }

        // 3. Placed queens (rows above current)
        step.queens.forEach(({ r, c }) => {
            if (r !== step.row) paintQueen(r, c, '#6366f1',
                '0 0 14px rgba(99,102,241,0.5),inset 0 0 0 2px rgba(99,102,241,0.9)', 'white');
        });

        // 4. Step-specific
        switch (step.type) {
            case 'try': {
                const el = $cell(step.row, step.col);
                if (el) {
                    el.style.outline    = '3px dashed rgba(99,102,241,0.7)';
                    el.style.background = (step.row + step.col) % 2 === 0
                        ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.22)';
                }
                break;
            }
            case 'place':
                paintQueen(step.row, step.col, '#6366f1',
                    '0 0 18px rgba(99,102,241,0.6),inset 0 0 0 2px rgba(99,102,241,0.9)', 'white');
                break;

            case 'conflict': {
                // Attack lines
                step.atk.forEach(({ r: ar, c: ac }) => {
                    drawAttackLine(ar, ac, step.row, step.col);
                    paintQueen(ar, ac, '#ef4444',
                        '0 0 16px rgba(239,68,68,0.55),inset 0 0 0 2px #ef4444', 'white');
                });
                // Re-draw non-attacker queens
                step.queens.forEach(({ r, c }) => {
                    if (step.atk.some(a => a.r === r && a.c === c)) return;
                    paintQueen(r, c, '#6366f1',
                        '0 0 14px rgba(99,102,241,0.5),inset 0 0 0 2px rgba(99,102,241,0.9)', 'white');
                });
                const el = $cell(step.row, step.col);
                if (el) {
                    el.style.background = 'rgba(239,68,68,0.62)';
                    el.style.outline    = '3px solid #ef4444';
                    el.style.boxShadow  = '0 0 18px rgba(239,68,68,0.4)';
                }
                nodeCount++; statNode.textContent = nodeCount;
                break;
            }
            case 'backtrack': {
                const el = $cell(step.row, step.col);
                if (el) {
                    el.style.background = 'rgba(245,158,11,0.28)';
                    el.style.outline    = '2px dashed rgba(245,158,11,0.8)';
                    const icon = document.createElement('span');
                    icon.className = 'queen-sym';
                    icon.textContent = '↩';
                    icon.style.cssText = 'color:#f59e0b;font-size:0.7em;opacity:0.9';
                    el.appendChild(icon);
                }
                btCount++; statBT.textContent = btCount;
                break;
            }
            case 'solution':
                step.queens.forEach(({ r, c }) =>
                    paintQueen(r, c, '#10b981',
                        '0 0 22px rgba(16,185,129,0.6),inset 0 0 0 2px rgba(16,185,129,0.9)', 'white'));
                solCount++; statSol.textContent = solCount;
                allSolutions.push([...step.queens]);
                addSolutionCard(allSolutions.length, step.queens);
                break;
        }
    }

    function paintQueen(r, c, bg, shadow, color) {
        const el = $cell(r, c);
        if (!el) return;
        el.style.background = bg;
        el.style.boxShadow  = shadow;
        el.style.outline    = '';
        el.innerHTML = '';
        const sp = document.createElement('span');
        sp.className   = 'queen-sym';
        sp.textContent = '♛';
        sp.style.cssText = `color:${color};text-shadow:0 1px 4px rgba(0,0,0,0.4);font-size:${Math.round(cellPx*0.60)}px`;
        el.appendChild(sp);
    }

    function drawAttackLine(ar, ac, row, col) {
        if (ac === col) {
            for (let rr = ar + 1; rr < row; rr++) {
                const el = $cell(rr, ac);
                if (el) el.style.background = 'rgba(239,68,68,0.22)';
            }
        } else {
            const dr = row > ar ? 1 : -1, dc = col > ac ? 1 : -1;
            let rr = ar + dr, cc = ac + dc;
            while (rr !== row) {
                const el = $cell(rr, cc);
                if (el) el.style.background = 'rgba(239,68,68,0.22)';
                rr += dr; cc += dc;
            }
        }
    }

    // ════════════════════════════════════════════════════════
    //  RENDER BOARD STATE — BRUTE FORCE
    // ════════════════════════════════════════════════════════
    function renderBoardBrute(step) {
        // 1. Full reset
        for (let r = 0; r < N; r++)
            for (let c = 0; c < N; c++) resetCellStyle(r, c);

        switch (step.type) {
            case 'bf_place': {
                // Place all N queens — show them in blue/indigo
                step.queens.forEach(({ r, c }) => {
                    paintQueen(r, c, '#6366f1',
                        '0 0 14px rgba(99,102,241,0.5),inset 0 0 0 2px rgba(99,102,241,0.9)', 'white');
                });
                nodeCount++; statNode.textContent = nodeCount;
                break;
            }
            case 'bf_invalid': {
                // Place all queens first
                step.queens.forEach(({ r, c }) => {
                    paintQueen(r, c, '#6366f1',
                        '0 0 14px rgba(99,102,241,0.5),inset 0 0 0 2px rgba(99,102,241,0.9)', 'white');
                });

                // Draw conflict lines between each attacking pair
                step.conflicts.forEach(({ r1, c1, r2, c2 }) => {
                    // Highlight both queens in red
                    paintQueen(r1, c1, '#ef4444',
                        '0 0 16px rgba(239,68,68,0.55),inset 0 0 0 2px #ef4444', 'white');
                    paintQueen(r2, c2, '#ef4444',
                        '0 0 16px rgba(239,68,68,0.55),inset 0 0 0 2px #ef4444', 'white');

                    // Visual attack path between the two
                    drawAttackLine(r1, c1, r2, c2);
                });
                break;
            }
            case 'bf_valid': {
                // Solution found — show all queens in green
                step.queens.forEach(({ r, c }) => {
                    paintQueen(r, c, '#10b981',
                        '0 0 22px rgba(16,185,129,0.6),inset 0 0 0 2px rgba(16,185,129,0.9)', 'white');
                });
                solCount++; statSol.textContent = solCount;
                allSolutions.push([...step.queens]);
                addSolutionCard(allSolutions.length, step.queens);
                break;
            }
        }
    }

    // ════════════════════════════════════════════════════════
    //  STEP EXPLANATION
    // ════════════════════════════════════════════════════════
    function explain(step) {
        // Brute force steps
        if (step.type === 'bf_place') {
            return `<strong>Combo ${step.comboNum}/${step.totalCombos}</strong> — placing queens at columns <code>[${step.cols.join(',')}]</code>. Checking…`;
        }
        if (step.type === 'bf_valid') {
            return `<strong style="color:#10b981">✔ Valid!</strong> Board <code>[${step.cols.join(',')}]</code> — no conflicts! <strong>Solution found!</strong>`;
        }
        if (step.type === 'bf_invalid') {
            return `<strong style="color:#ef4444">✘ Invalid!</strong> Board <code>[${step.cols.join(',')}]</code> — <strong>${step.conflicts.length}</strong> conflict(s) found.`;
        }

        // Backtracking steps
        const pos = `(${step.row+1},${String.fromCharCode(97+step.col)})`;
        switch (step.type) {
            case 'try':      return `<strong>Trying</strong> cell <code>${pos}</code> — calling <code>is_safe(board, ${step.row}, ${step.col})</code>…`;
            case 'place':    return `<strong style="color:#10b981">✔ Placed!</strong> Queen at <code>${pos}</code> is safe. Recursing to row ${step.row+1}.`;
            case 'conflict': return `<strong style="color:#ef4444">✘ Conflict!</strong> <code>${pos}</code> attacked by ${step.atk.length} queen(s). <em>Pruning subtree.</em>`;
            case 'backtrack':return `<strong style="color:#f59e0b">↩ Backtrack</strong> — row ${step.row} exhausted. Removing queen from <code>${pos}</code>.`;
            case 'solution': return `<strong style="color:#10b981">🎉 Solution #${solCount}!</strong> All ${N} queens placed. Board: <code>[${step.queens.map(q=>q.c).join(', ')}]</code>`;
        }
        return '';
    }

    // ════════════════════════════════════════════════════════
    //  STEP LOG
    // ════════════════════════════════════════════════════════
    const LOG_CLS = { try:'ltry', place:'lplace', conflict:'lconflict', backtrack:'lbacktrack', solution:'lsolution',
                      bf_place:'ltry', bf_valid:'lsolution', bf_invalid:'lconflict' };
    const LOG_ICO = { try:'→', place:'✔', conflict:'✘', backtrack:'↩', solution:'♛',
                      bf_place:'▶', bf_valid:'✔', bf_invalid:'✘' };

    function addLog(num, step) {
        let txt = step.msg;
        if (step.type === 'solution') txt = `♛ Solution #${solCount}: [${step.queens.map(q=>q.c).join(', ')}]`;
        if (step.type === 'bf_valid') txt = `✔ Solution #${solCount}: [${step.cols.join(',')}]`;
        const e = document.createElement('div');
        e.className = `log-entry ${LOG_CLS[step.type]||''} current`;
        e.innerHTML = `<span class="log-icon">${LOG_ICO[step.type]||num}</span><span class="log-text">${txt}</span>`;
        stepLog.querySelectorAll('.current').forEach(x=>x.classList.remove('current'));
        stepLog.appendChild(e);
        stepLog.scrollTop = stepLog.scrollHeight;
    }

    // ════════════════════════════════════════════════════════
    //  AUTO-RUN
    // ════════════════════════════════════════════════════════
    function onAuto() {
        if (autoTimer) { pauseAuto(); return; }
        const delay = Math.max(40, 1050 - parseInt(speedInput.value) * 100);
        autoBtn.textContent = 'Pause';
        autoTimer = setInterval(()=>{ onStep(); if(curStep>=steps.length) pauseAuto(); }, delay);
    }
    function pauseAuto() {
        clearInterval(autoTimer); autoTimer = null;
        autoBtn.textContent = 'Auto';
    }

    // ════════════════════════════════════════════════════════
    //  MAIN CONTROLS
    // ════════════════════════════════════════════════════════
    function onStart() {
        // Cap N for brute force (N^N grows fast)
        if (algoMode === 'brute' && N > 6) {
            alert(`Brute Force is limited to N ≤ 6 (N=${N} would need ${Math.pow(N,N).toLocaleString()} combinations).\nSwitching to N=6.`);
            setN(6);
            return;
        }

        clearBoardVisuals();

        if (algoMode === 'brute') {
            computeStepsBrute();
        } else {
            computeSteps();
        }

        curStep = 0; solCount = 0; btCount = 0; nodeCount = 0;
        allSolutions = []; nodeTypeState = {}; prevActiveId = -1;
        statSol.textContent = '0'; statBT.textContent = '0'; statNode.textContent = '0';

        startBtn.disabled = true; stepBtn.disabled = false; autoBtn.disabled = false;
        algoBacktrackBtn.disabled = true; algoBruteBtn.disabled = true;
        statusBadge.textContent = 'Running'; statusBadge.className = 'status-badge running';
        stepCount.textContent = `0 / ${steps.length}`;

        const algoLabel = algoMode === 'brute' ? 'Brute Force' : 'Backtracking';
        stepText.innerHTML = `<strong>${algoLabel}</strong> — <strong>${steps.length}</strong> steps computed. Press <strong>Step</strong> or <strong>Auto</strong>.`;
        stepLogWrap.style.display = 'block'; stepLog.innerHTML = '';

        solutionsOutput.style.display = 'none';
        solBoardsGrid.innerHTML = '';
        solOutCount.textContent = '0';
        const solStepTypes = algoMode === 'brute' ? ['bf_valid'] : ['solution'];
        solOutTotal.textContent = steps.filter(s => solStepTypes.includes(s.type)).length;

        if (algoMode === 'brute') {
            treeHint.textContent = `Brute Force: testing all ${Math.pow(N,N)} combinations. No pruning.`;
            // No tree for brute force — hide it / show a flat progress
            clearSvg();
        } else {
            treeHint.textContent = 'Backtracking tree. Camera follows the active node.';
            layoutTree();
            buildTreeSvg();
        }
    }

    function onStep() {
        if (curStep >= steps.length) { onFinish(); return; }
        const step = steps[curStep];
        curStep++;

        if (algoMode === 'brute') {
            renderBoardBrute(step);
        } else {
            renderBoard(step);
        }

        stepCount.textContent = `${curStep} / ${steps.length}`;
        stepText.innerHTML    = explain(step);
        addLog(curStep, step);

        if (algoMode !== 'brute') {
            updateTreeStep(step);
        }

        if (curStep >= steps.length) onFinish();
    }

    function onFinish() {
        pauseAuto();
        stepBtn.disabled = true; autoBtn.disabled = true;
        statusBadge.textContent = 'Complete'; statusBadge.className = 'status-badge done';

        if (algoMode === 'brute') {
            const totalCombos = Math.pow(N, N);
            stepText.innerHTML = `✅ <strong>Done!</strong> Checked all <strong>${totalCombos}</strong> combinations. Found <strong>${solCount}</strong> solution(s), <strong>${totalCombos - solCount}</strong> invalid.`;
        } else {
            stepText.innerHTML = `✅ <strong>Done!</strong> ${solCount} solution(s), ${nodeCount} nodes, ${btCount} backtracks.`;
        }

        const fin = document.createElement('div');
        fin.className = 'log-entry lsolution current';
        fin.innerHTML = `<span class="log-icon">✅</span><span class="log-text"><strong>Complete — ${solCount} solution(s)!</strong></span>`;
        stepLog.querySelectorAll('.current').forEach(x=>x.classList.remove('current'));
        stepLog.appendChild(fin); stepLog.scrollTop = stepLog.scrollHeight;
    }

    function onReset() {
        pauseAuto();
        curStep = 0; steps = []; solCount = 0; btCount = 0; nodeCount = 0;
        allSolutions = []; nodeTypeState = {}; prevActiveId = -1;
        startBtn.disabled = false; stepBtn.disabled = true; autoBtn.disabled = true;
        algoBacktrackBtn.disabled = false; algoBruteBtn.disabled = false;
        statusBadge.textContent = 'Ready'; statusBadge.className = 'status-badge';
        stepCount.textContent = '0 / 0';
        stepText.innerHTML = 'Click <strong>Start</strong> to begin.';
        statSol.textContent = '0'; statBT.textContent = '0'; statNode.textContent = '0';
        stepLog.innerHTML = ''; stepLogWrap.style.display = 'none';
        solutionsOutput.style.display = 'none'; solBoardsGrid.innerHTML = '';
        treeHint.textContent = algoMode === 'brute'
            ? `Brute Force: will test all ${Math.pow(N,N)} combinations.`
            : 'Tree appears after clicking Start. Shows complete backtracking structure.';
        clearSvg(); buildBoard();
    }

    function clearBoardVisuals() {
        for (let r = 0; r < N; r++)
            for (let c = 0; c < N; c++) resetCellStyle(r, c);
    }

    // ════════════════════════════════════════════════════════
    //  TREE — LAYOUT (compute x,y for all nodes once)
    // ════════════════════════════════════════════════════════
    function layoutTree() {
        nodeX = {}; nodeY = {};
        if (tNodes.length === 0) return;

        const R    = 16;  // node radius
        const VGAP = 56;  // vertical gap between rows
        const HGAP = 44;  // horizontal gap between leaves

        const kids = {};
        tNodes.forEach(n => { kids[n.id] = []; });
        tEdges.forEach(e => { if (kids[e.from]) kids[e.from].push(e.to); });

        const depth = {}; depth[0] = 0; let maxDepth = 0;
        const q = [0];
        while (q.length) {
            const id = q.shift();
            (kids[id] || []).forEach(cid => {
                depth[cid] = depth[id] + 1;
                if (depth[cid] > maxDepth) maxDepth = depth[cid];
                q.push(cid);
            });
        }

        let leafX = R + 10;
        function assignX(id) {
            const ch = kids[id] || [];
            if (ch.length === 0) { nodeX[id] = leafX; leafX += HGAP; return; }
            ch.forEach(c => assignX(c));
            nodeX[id] = (nodeX[ch[0]] + nodeX[ch[ch.length-1]]) / 2;
        }
        assignX(0);

        tNodes.forEach(n => {
            if (nodeX[n.id] == null) nodeX[n.id] = 0;
            nodeY[n.id] = R + 14 + (depth[n.id] || 0) * VGAP;
        });

        svgW = Math.max(400, leafX + R + 10);
        svgH = Math.max(300, (maxDepth + 1) * VGAP + R * 4);
    }

    // ════════════════════════════════════════════════════════
    //  TREE — BUILD SVG ONCE (static, nodes have IDs for updates)
    //  Uses a CAMERA VIEWPORT — a fixed-size window that pans
    //  to follow the active node, keeping nodes readable.
    // ════════════════════════════════════════════════════════
    function clearSvg() {
        // Safe SVG clearing (cross-browser)
        while (treeSvg.firstChild) treeSvg.removeChild(treeSvg.firstChild);
        if (camAnimId) { cancelAnimationFrame(camAnimId); camAnimId = null; }
        camX = 0; camY = 0;
        // Set an initial empty viewBox
        treeSvg.setAttribute('viewBox', `0 0 ${CAM_W} ${CAM_H}`);
    }

    function buildTreeSvg() {
        // Clear any previous content safely
        while (treeSvg.firstChild) treeSvg.removeChild(treeSvg.firstChild);

        // Camera starts centered on root node
        const rootCx = nodeX[0] || svgW / 2;
        const rootCy = nodeY[0] || 30;
        camX = Math.max(0, rootCx - CAM_W / 2);
        camY = Math.max(0, rootCy - CAM_H / 3);

        // Set the camera viewBox — this is the "window" into the full SVG world
        treeSvg.setAttribute('viewBox', `${camX} ${camY} ${CAM_W} ${CAM_H}`);
        treeSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        const R = 16;

        // Full-size background rect covering entire SVG world
        const bg = mksvg('rect');
        bg.setAttribute('x', -50);
        bg.setAttribute('y', -50);
        bg.setAttribute('width', svgW + 100);
        bg.setAttribute('height', svgH + 100);
        bg.setAttribute('fill', '#fafafa');
        treeSvg.appendChild(bg);

        // Draw edges first
        tEdges.forEach(({ from, to }) => {
            if (nodeX[from] == null || nodeX[to] == null) return;
            const line = mksvg('line');
            line.setAttribute('id', `te-${to}`);
            line.setAttribute('x1', nodeX[from]);
            line.setAttribute('y1', nodeY[from] + R);
            line.setAttribute('x2', nodeX[to]);
            line.setAttribute('y2', nodeY[to]   - R);
            line.setAttribute('stroke',       '#e2e8f0');
            line.setAttribute('stroke-width', '1.6');
            treeSvg.appendChild(line);
        });

        // Draw nodes
        tNodes.forEach(nd => {
            if (nodeX[nd.id] == null) return;
            const cx = nodeX[nd.id];
            const cy = nodeY[nd.id];

            const g = mksvg('g');
            g.setAttribute('id', `tg-${nd.id}`);

            // Halo (initially invisible, shown for active/solution)
            const halo = mksvg('circle');
            halo.setAttribute('id', `th-${nd.id}`);
            halo.setAttribute('cx', cx); halo.setAttribute('cy', cy);
            halo.setAttribute('r',  R + 7);
            halo.setAttribute('fill', 'none');
            g.appendChild(halo);

            // Main circle
            const sty = nd.type === 'root' ? N_STYLE.root : N_STYLE.unexplored;
            const cir = mksvg('circle');
            cir.setAttribute('id', `tc-${nd.id}`);
            cir.setAttribute('cx', cx); cir.setAttribute('cy', cy); cir.setAttribute('r', R);
            cir.setAttribute('fill',         sty.fill);
            cir.setAttribute('stroke',       sty.stroke);
            cir.setAttribute('stroke-width', nd.type === 'root' ? '2.5' : '1.5');
            g.appendChild(cir);

            // Label
            const txt = mksvg('text');
            txt.setAttribute('id', `tt-${nd.id}`);
            txt.setAttribute('x', cx); txt.setAttribute('y', cy);
            txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('dominant-baseline', 'central');
            txt.setAttribute('font-family', "'JetBrains Mono',monospace");
            txt.setAttribute('font-weight', '700');
            txt.setAttribute('font-size', nd.type === 'root' ? '11' : '10');
            txt.setAttribute('fill', sty.text);
            txt.textContent = nd.type === 'root' ? 'S' : '';
            g.appendChild(txt);

            // Small row label below node
            if (nd.row >= 0) {
                const sub = mksvg('text');
                sub.setAttribute('x', cx); sub.setAttribute('y', cy + R + 9);
                sub.setAttribute('text-anchor', 'middle');
                sub.setAttribute('dominant-baseline', 'central');
                sub.setAttribute('font-size', '7');
                sub.setAttribute('font-family', 'Inter,sans-serif');
                sub.setAttribute('fill', '#94a3b8');
                sub.textContent = `r${nd.row}`;
                g.appendChild(sub);
            }

            treeSvg.appendChild(g);
        });

        // Initialize nodeTypeState
        tNodes.forEach(n => {
            nodeTypeState[n.id] = n.type === 'root' ? 'root' : 'unexplored';
        });
    }

    // ════════════════════════════════════════════════════════
    //  TREE — UPDATE PER STEP (no SVG rebuild)
    // ════════════════════════════════════════════════════════

    // Map step type → node visual type
    const STEP_TO_NODE_TYPE = {
        try:      'unexplored',
        place:    'placed',
        conflict: 'pruned',
        backtrack:'backtrack',
        solution: 'solution'
    };

    function updateTreeStep(step) {
        const nid  = step.nid;
        const newNodeType = STEP_TO_NODE_TYPE[step.type] || 'unexplored';

        // Update this node's visual type
        nodeTypeState[nid] = newNodeType;
        setNodeVisual(nid, newNodeType);

        // Update the edge leading to this node
        updateEdgeColor(nid, newNodeType);

        // Highlight as active (overrides fill) + pan camera
        setActiveNode(nid);
    }

    function setNodeVisual(nid, type) {
        const sty = N_STYLE[type] || N_STYLE.unexplored;
        const cir = document.getElementById(`tc-${nid}`);
        const txt = document.getElementById(`tt-${nid}`);
        const nd  = tNodes.find(n => n.id === nid);
        if (!cir || !nd) return;

        cir.setAttribute('fill',   sty.fill);
        cir.setAttribute('stroke', sty.stroke);

        if (txt) {
            txt.setAttribute('fill', sty.text);
            // Show column number in node
            if (nd.type !== 'root') {
                const label = type === 'pruned'   ? '✕'
                            : type === 'solution' ? '♛'
                            : nd.col >= 0         ? String(nd.col)
                            : '';
                txt.textContent = label;
            }
        }
    }

    function updateEdgeColor(toNid, nodeType) {
        const edge = document.getElementById(`te-${toNid}`);
        if (!edge) return;
        const col = nodeType === 'pruned'    ? '#fca5a5'
                  : nodeType === 'backtrack'  ? '#fde047'
                  : nodeType === 'solution'   ? '#4ade80'
                  : nodeType === 'placed'     ? '#6ee7b7'
                  : '#e2e8f0';
        edge.setAttribute('stroke', col);
        edge.setAttribute('stroke-width', '1.8');
    }

    function setActiveNode(nid) {
        const R = 16;

        // De-highlight previous active node → restore its saved type color
        if (prevActiveId >= 0 && prevActiveId !== nid) {
            const prevType = nodeTypeState[prevActiveId] || 'unexplored';
            const prevSty  = N_STYLE[prevType] || N_STYLE.unexplored;
            const prevCir  = document.getElementById(`tc-${prevActiveId}`);
            const prevHalo = document.getElementById(`th-${prevActiveId}`);
            const prevTxt  = document.getElementById(`tt-${prevActiveId}`);
            if (prevCir) {
                prevCir.setAttribute('fill',         prevSty.fill);
                prevCir.setAttribute('stroke',       prevSty.stroke);
                prevCir.setAttribute('stroke-width', '1.5');
            }
            if (prevHalo) prevHalo.setAttribute('fill', 'none');
            if (prevTxt)  prevTxt.setAttribute('fill', prevSty.text);
        }

        // Apply active highlight to current node
        const cir  = document.getElementById(`tc-${nid}`);
        const halo = document.getElementById(`th-${nid}`);
        const txt  = document.getElementById(`tt-${nid}`);
        const nd   = tNodes.find(n => n.id === nid);

        if (cir) {
            cir.setAttribute('fill',         N_STYLE.active.fill);
            cir.setAttribute('stroke',       N_STYLE.active.stroke);
            cir.setAttribute('stroke-width', '3');
        }
        if (halo) halo.setAttribute('fill', 'rgba(99,102,241,0.18)');
        if (txt) {
            txt.setAttribute('fill', N_STYLE.active.text);
            if (nd && nd.type !== 'root')
                txt.textContent = nd.col >= 0 ? String(nd.col) : 'S';
        }

        prevActiveId = nid;

        // ── PAN CAMERA to center on this node ──
        panCameraTo(nid);
    }

    // Smoothly animate the viewBox to center on the given node
    function panCameraTo(nid) {
        const cx = nodeX[nid];
        const cy = nodeY[nid];
        if (cx == null || cy == null) return;

        // Target: center the node in the viewport
        const targetX = Math.max(0, Math.min(cx - CAM_W / 2, svgW - CAM_W));
        const targetY = Math.max(0, Math.min(cy - CAM_H / 3, svgH - CAM_H));

        // Cancel any ongoing animation
        if (camAnimId) { cancelAnimationFrame(camAnimId); camAnimId = null; }

        // Smooth lerp animation
        const startX = camX, startY = camY;
        const dx = targetX - startX, dy = targetY - startY;

        // Skip animation if distance is trivial
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
            camX = targetX; camY = targetY;
            treeSvg.setAttribute('viewBox', `${camX} ${camY} ${CAM_W} ${CAM_H}`);
            return;
        }

        const duration = 200; // ms
        const startTime = performance.now();

        function animate(now) {
            const t = Math.min(1, (now - startTime) / duration);
            // Ease-out cubic
            const ease = 1 - Math.pow(1 - t, 3);
            camX = startX + dx * ease;
            camY = startY + dy * ease;
            treeSvg.setAttribute('viewBox', `${camX.toFixed(1)} ${camY.toFixed(1)} ${CAM_W} ${CAM_H}`);
            if (t < 1) {
                camAnimId = requestAnimationFrame(animate);
            } else {
                camAnimId = null;
            }
        }
        camAnimId = requestAnimationFrame(animate);
    }

    // ════════════════════════════════════════════════════════
    //  SOLUTIONS OUTPUT BOX
    // ════════════════════════════════════════════════════════
    function addSolutionCard(num, queens) {
        const miniPx  = Math.max(28, Math.min(44, Math.floor(230 / N)));
        const fontPx  = Math.round(miniPx * 0.60);
        const qSet    = new Set(queens.map(q => `${q.r},${q.c}`));

        const card = document.createElement('div');
        card.className = 'sol-card';

        const lbl = document.createElement('div');
        lbl.className = 'sol-label';
        lbl.textContent = `Solution #${num}`;
        card.appendChild(lbl);

        const grid = document.createElement('div');
        grid.className = 'mini-grid';
        grid.style.gridTemplateColumns = `repeat(${N}, ${miniPx}px)`;

        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const cell = document.createElement('div');
                cell.className = 'mini-cell';
                cell.style.width    = miniPx + 'px';
                cell.style.height   = miniPx + 'px';
                cell.style.fontSize = fontPx  + 'px';
                if (qSet.has(`${r},${c}`)) {
                    cell.style.background = '#10b981';
                    cell.style.boxShadow  = 'inset 0 0 0 1.5px rgba(16,185,129,0.9)';
                    cell.style.color      = 'white';
                    cell.style.textShadow = '0 1px 3px rgba(0,0,0,0.4)';
                    cell.textContent      = '♛';
                } else {
                    cell.style.background = (r + c) % 2 === 0 ? CHESS_LIGHT : CHESS_DARK;
                }
                grid.appendChild(cell);
            }
        }
        card.appendChild(grid);

        const nota = document.createElement('div');
        nota.className   = 'sol-notation';
        nota.textContent = '[' + queens.map(q => q.c).join(', ') + ']';
        card.appendChild(nota);

        solBoardsGrid.appendChild(card);
        solutionsOutput.style.display = 'block';
        solOutCount.textContent = num;

        setTimeout(() => solutionsOutput.scrollIntoView({ behavior:'smooth', block:'nearest' }), 80);
    }

    // ════════════════════════════════════════════════════════
    //  BACKGROUND PARTICLES
    // ════════════════════════════════════════════════════════
    function initParticles() {
        const container = document.getElementById('bgParticles');
        const colors = ['#6366f1','#a855f7','#10b981','#0ea5e9','#f59e0b'];
        for (let i = 0; i < 20; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const sz  = (Math.random()*5+2).toFixed(1);
            const col = colors[i % colors.length];
            p.style.cssText = [
                `width:${sz}px`, `height:${sz}px`,
                `left:${(Math.random()*100).toFixed(1)}%`,
                `background:${col}`,
                `animation-duration:${(Math.random()*22+16).toFixed(1)}s`,
                `animation-delay:-${(Math.random()*18).toFixed(1)}s`,
                `box-shadow:0 0 ${parseFloat(sz)*4}px ${col}40`
            ].join(';');
            container.appendChild(p);
        }
    }

    function mksvg(tag) {
        return document.createElementNS('http://www.w3.org/2000/svg', tag);
    }

}); // end DOMContentLoaded
