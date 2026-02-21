document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const screenHome = document.getElementById('screen-home');
    const screenDifficulty = document.getElementById('screen-difficulty');
    const screenGame = document.getElementById('screen-game');
    const modalResult = document.getElementById('modal-result');
    const resultTitle = document.getElementById('result-title');
    const resultMessage = document.getElementById('result-message');

    const imageCards = document.querySelectorAll('.image-card');
    const difficultyBtns = document.querySelectorAll('.difficulty-btn');
    const btnBackHome = document.getElementById('btn-back-home');
    const btnQuit = document.getElementById('btn-quit');
    const btnRestart = document.getElementById('btn-restart');
    const btnViewPuzzle = document.getElementById('btn-view-puzzle');

    const gameBoard = document.getElementById('game-board');
    const timerDisplay = document.getElementById('timer');
    const miniPreview = document.getElementById('mini-preview');

    // Game State
    let selectedImage = '';
    let gridSize = 0;
    let totalPieces = 0;
    let pieces = [];
    let timerInterval = null;
    let initialTime = 300;
    let timeRemaining = 300; // 5 minutes in seconds
    let pieceWidth = 0;
    let pieceHeight = 0;

    let isDragging = false;
    let dragGroup = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialPositions = {}; // Store starting positions for drag calculation

    const SNAP_TOLERANCE = 20; // pixels

    // --- Screen Navigation ---
    function showScreen(screen) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }

    imageCards.forEach(card => {
        card.addEventListener('click', () => {
            selectedImage = card.dataset.image;
            showScreen(screenDifficulty);
        });
    });

    btnBackHome.addEventListener('click', () => {
        showScreen(screenHome);
    });

    btnQuit.addEventListener('click', () => {
        clearInterval(timerInterval);
        showScreen(screenHome);
    });

    btnRestart.addEventListener('click', () => {
        modalResult.classList.remove('active');
        showScreen(screenHome);
    });

    if (btnViewPuzzle) {
        btnViewPuzzle.addEventListener('click', () => {
            modalResult.classList.remove('active');
            // User can now look at the puzzle, the timer is stopped, and they can click "Quitter" at any point.
        });
    }

    difficultyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            gridSize = parseInt(btn.dataset.grid);
            totalPieces = parseInt(btn.dataset.pieces);
            initialTime = parseInt(btn.dataset.time);
            startGame();
        });
    });

    // --- Game Logic ---
    function startGame() {
        showScreen(screenGame);
        gameBoard.innerHTML = '';
        pieces = [];
        timeRemaining = initialTime;
        updateTimerDisplay();

        // Show mini preview
        miniPreview.style.backgroundImage = `url(${selectedImage})`;

        // Load image to get dimensions
        const img = new Image();
        img.src = selectedImage;
        img.onload = () => {
            // Define puzzle board size
            const boardSize = Math.min(window.innerWidth * 0.8, window.innerHeight * 0.7, 800);
            pieceWidth = boardSize / gridSize;
            pieceHeight = boardSize / gridSize;

            createPieces(boardSize);
            startTimer();
        };
    }

    // Generate puzzle SVG clip path string
    function getPuzzlePath(row, col, grid, w, h, offset, tabHeight) {
        // Simple shape generator with curves
        // For a true jigsaw, we need to know if tabs go IN or OUT
        // We can determine this deterministically based on row/col to ensure they interlock
        const rightTab = col === grid - 1 ? 0 : ((row + col) % 2 === 0 ? 1 : -1);
        const bottomTab = row === grid - 1 ? 0 : ((row + col) % 2 !== 0 ? 1 : -1);
        const topTab = row === 0 ? 0 : -((row - 1 + col) % 2 !== 0 ? 1 : -1);
        const leftTab = col === 0 ? 0 : -((row + col - 1) % 2 === 0 ? 1 : -1);

        const startX = offset;
        const startY = offset;

        let path = `M ${startX} ${startY} `;

        // Top edge
        if (topTab === 0) {
            path += `L ${startX + w} ${startY} `;
        } else {
            path += `L ${startX + w * 0.35} ${startY} `;
            path += `C ${startX + w * 0.35} ${startY - tabHeight * topTab}, ${startX + w * 0.3} ${startY - tabHeight * topTab * 1.5}, ${startX + w * 0.5} ${startY - tabHeight * topTab * 1.5} `;
            path += `C ${startX + w * 0.7} ${startY - tabHeight * topTab * 1.5}, ${startX + w * 0.65} ${startY - tabHeight * topTab}, ${startX + w * 0.65} ${startY} `;
            path += `L ${startX + w} ${startY} `;
        }

        // Right edge
        if (rightTab === 0) {
            path += `L ${startX + w} ${startY + h} `;
        } else {
            path += `L ${startX + w} ${startY + h * 0.35} `;
            path += `C ${startX + w + tabHeight * rightTab} ${startY + h * 0.35}, ${startX + w + tabHeight * rightTab * 1.5} ${startY + h * 0.3}, ${startX + w + tabHeight * rightTab * 1.5} ${startY + h * 0.5} `;
            path += `C ${startX + w + tabHeight * rightTab * 1.5} ${startY + h * 0.7}, ${startX + w + tabHeight * rightTab} ${startY + h * 0.65}, ${startX + w} ${startY + h * 0.65} `;
            path += `L ${startX + w} ${startY + h} `;
        }

        // Bottom edge
        if (bottomTab === 0) {
            path += `L ${startX} ${startY + h} `;
        } else {
            path += `L ${startX + w * 0.65} ${startY + h} `;
            path += `C ${startX + w * 0.65} ${startY + h + tabHeight * bottomTab}, ${startX + w * 0.7} ${startY + h + tabHeight * bottomTab * 1.5}, ${startX + w * 0.5} ${startY + h + tabHeight * bottomTab * 1.5} `;
            path += `C ${startX + w * 0.3} ${startY + h + tabHeight * bottomTab * 1.5}, ${startX + w * 0.35} ${startY + h + tabHeight * bottomTab}, ${startX + w * 0.35} ${startY + h} `;
            path += `L ${startX} ${startY + h} `;
        }

        // Left edge
        if (leftTab === 0) {
            path += `L ${startX} ${startY}`;
        } else {
            path += `L ${startX} ${startY + h * 0.65} `;
            path += `C ${startX - tabHeight * leftTab} ${startY + h * 0.65}, ${startX - tabHeight * leftTab * 1.5} ${startY + h * 0.7}, ${startX - tabHeight * leftTab * 1.5} ${startY + h * 0.5} `;
            path += `C ${startX - tabHeight * leftTab * 1.5} ${startY + h * 0.3}, ${startX - tabHeight * leftTab} ${startY + h * 0.35}, ${startX} ${startY + h * 0.35} `;
            path += `L ${startX} ${startY}`;
        }

        return path;
    }

    function createPieces(boardSize) {
        // Container for SVG clip paths (invisible)
        let svgDefs = document.getElementById('puzzle-clip-paths');
        if (!svgDefs) {
            svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgDefs.id = 'puzzle-clip-paths';
            svgDefs.style.position = 'absolute';
            svgDefs.style.width = '0';
            svgDefs.style.height = '0';
            document.body.appendChild(svgDefs);
        }
        svgDefs.innerHTML = ''; // Clear old paths

        const tabHeight = Math.min(pieceWidth, pieceHeight) * 0.2;
        const offset = Math.ceil(Math.min(pieceWidth, pieceHeight) * 0.35);
        const divWidth = pieceWidth + offset * 2;
        const divHeight = pieceHeight + offset * 2;

        // Create pieces
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const id = `piece-${row}-${col}`;
                const clipId = `clip-${id}`;

                // Add SVG clipPath definitions
                const clipPathElem = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
                clipPathElem.id = clipId;
                const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathElem.setAttribute('d', getPuzzlePath(row, col, gridSize, pieceWidth, pieceHeight, offset, tabHeight));
                clipPathElem.appendChild(pathElem);
                svgDefs.appendChild(clipPathElem);

                const piece = document.createElement('div');
                piece.className = 'puzzle-piece';
                piece.id = id;
                piece.style.width = `${divWidth}px`;
                piece.style.height = `${divHeight}px`;
                piece.style.backgroundImage = `url(${selectedImage})`;
                piece.style.backgroundSize = `${boardSize}px ${boardSize}px`;
                piece.style.backgroundPosition = `${offset - col * pieceWidth}px ${offset - row * pieceHeight}px`;
                piece.style.clipPath = `url(#${clipId})`;
                piece.style.webkitClipPath = `url(#${clipId})`;

                // Random position on the white board
                const maxX = Math.max(0, window.innerWidth - divWidth);
                const maxY = Math.max(0, window.innerHeight - divHeight - 80);

                let startX, startY;
                let overlapPreview;
                do {
                    startX = Math.random() * maxX;
                    startY = Math.random() * maxY + 80;

                    // Avoid spawning under the mini preview area
                    overlapPreview = (startX < 240 && startY < 280);
                } while (overlapPreview);

                piece.style.left = `${startX}px`;
                piece.style.top = `${startY}px`;

                const pieceData = {
                    element: piece,
                    id: id,
                    row: row,
                    col: col,
                    x: startX,
                    y: startY,
                    groupId: id
                };

                pieces.push(pieceData);
                gameBoard.appendChild(piece);

                // Mouse Events
                piece.addEventListener('mousedown', (e) => startDrag(e, pieceData));
            }
        }

        // Global mouse events for drag and drop
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);
    }

    // --- Drag & Drop ---
    function startDrag(e, targetPiece) {
        if (e.target.closest('.game-header') || isDragging) return;

        isDragging = true;
        dragGroup = targetPiece.groupId;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        // Bring all pieces in this group to front
        const highestZ = getHighestZ() + 1;

        pieces.filter(p => p.groupId === dragGroup).forEach(p => {
            p.element.style.zIndex = highestZ;
            p.element.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.3)";
            initialPositions[p.id] = { x: p.x, y: p.y };
        });
    }

    function drag(e) {
        if (!isDragging || dragGroup === null) return;

        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;

        pieces.filter(p => p.groupId === dragGroup).forEach(p => {
            p.x = initialPositions[p.id].x + dx;
            p.y = initialPositions[p.id].y + dy;
            p.element.style.left = `${p.x}px`;
            p.element.style.top = `${p.y}px`;
        });
    }

    function endDrag(e) {
        if (!isDragging) return;

        // Lower styling
        pieces.filter(p => p.groupId === dragGroup).forEach(p => {
            p.element.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
        });

        // Check for snapping
        checkForSnapping();

        isDragging = false;
        dragGroup = null;
        initialPositions = {};
    }

    // --- Snapping Logic ---
    function checkForSnapping() {
        const draggedPieces = pieces.filter(p => p.groupId === dragGroup);
        const otherPieces = pieces.filter(p => p.groupId !== dragGroup);

        let hasSnapped = false;

        // Compare every piece in the dragged group with every piece outside it
        for (let dp of draggedPieces) {
            for (let op of otherPieces) {
                // Check if they are adjacent in the original grid
                const isAdjacent =
                    (Math.abs(dp.row - op.row) === 1 && dp.col === op.col) ||
                    (Math.abs(dp.col - op.col) === 1 && dp.row === op.row);

                if (isAdjacent) {
                    // Calculate expected positions based on original grid
                    const expectedOffsetX = (dp.col - op.col) * pieceWidth;
                    const expectedOffsetY = (dp.row - op.row) * pieceHeight;

                    const actualOffsetX = dp.x - op.x;
                    const actualOffsetY = dp.y - op.y;

                    // If close enough, SNAP!
                    if (Math.abs(expectedOffsetX - actualOffsetX) < SNAP_TOLERANCE &&
                        Math.abs(expectedOffsetY - actualOffsetY) < SNAP_TOLERANCE) {

                        snapGroupToPiece(dp, op);
                        hasSnapped = true;
                        break;
                    }
                }
            }
            if (hasSnapped) break; // One snap per drop is enough to merge groups
        }

        if (hasSnapped) {
            checkWinCondition();
        }
    }

    function snapGroupToPiece(draggedPiece, targetPiece) {
        // Calculate the adjustment needed to align draggedPiece perfectly next to targetPiece
        const targetX = targetPiece.x + (draggedPiece.col - targetPiece.col) * pieceWidth;
        const targetY = targetPiece.y + (draggedPiece.row - targetPiece.row) * pieceHeight;

        const dx = targetX - draggedPiece.x;
        const dy = targetY - draggedPiece.y;

        const targetGroupId = targetPiece.groupId;

        // Move all pieces in the dragged group by dx, dy, and merge them into the target group
        pieces.filter(p => p.groupId === dragGroup).forEach(p => {
            p.x += dx;
            p.y += dy;
            p.element.style.left = `${p.x}px`;
            p.element.style.top = `${p.y}px`;

            p.groupId = targetGroupId;

            // Add a brief flash animation to show they snapped
            p.element.style.transition = "transform 0.2s, box-shadow 0.2s";
            p.element.style.transform = "scale(1.02)";
            setTimeout(() => {
                p.element.style.transform = "none";
                p.element.style.transition = "box-shadow 0.2s";
            }, 200);
        });

        // Flash the target piece too
        targetPiece.element.style.transition = "transform 0.2s, box-shadow 0.2s";
        targetPiece.element.style.transform = "scale(1.02)";
        setTimeout(() => {
            targetPiece.element.style.transform = "none";
            targetPiece.element.style.transition = "box-shadow 0.2s";
        }, 200);
    }

    // --- Helpers ---
    function getHighestZ() {
        let max = 20;
        pieces.forEach(p => {
            const z = parseInt(p.element.style.zIndex || 20);
            if (z > max) max = z;
        });
        return max;
    }

    function startTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeRemaining--;
            updateTimerDisplay();

            if (timeRemaining <= 0) {
                endGame(false);
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (timeRemaining <= 60) {
            timerDisplay.style.color = '#e63946'; // Red for last minute
            timerDisplay.style.animation = 'pulse 1s infinite alternate';
        } else {
            timerDisplay.style.color = '#333';
            timerDisplay.style.animation = 'none';
        }
    }

    function checkWinCondition() {
        // If all pieces have the same groupId, the puzzle is solved!
        const firstGroupId = pieces[0].groupId;
        const isWin = pieces.every(p => p.groupId === firstGroupId);

        if (isWin) {
            endGame(true);
        }
    }

    function endGame(isWin) {
        clearInterval(timerInterval);

        if (btnViewPuzzle) {
            btnViewPuzzle.style.display = isWin ? 'inline-block' : 'none';
        }

        if (isWin) {
            resultTitle.textContent = "Félicitations !";
            resultTitle.style.background = "linear-gradient(135deg, #10b981, #3b82f6)";
            resultTitle.style.webkitBackgroundClip = "text";
            resultTitle.style.webkitTextFillColor = "transparent";
            resultMessage.textContent = `Vous avez complété le puzzle en ${initialTime - timeRemaining} secondes !`;
        } else {
            resultTitle.textContent = "Temps écoulé !";
            resultTitle.style.background = "linear-gradient(135deg, #ef4444, #f97316)";
            resultTitle.style.webkitBackgroundClip = "text";
            resultTitle.style.webkitTextFillColor = "transparent";
            const minutes = Math.floor(initialTime / 60);
            resultMessage.textContent = `Vous n'avez pas réussi à terminer avant la limite de ${minutes} minute${minutes > 1 ? 's' : ''}.`;
        }

        modalResult.classList.add('active');
    }
});
