(() => {
  'use strict';
  const canvas = document.getElementById('range'), ctx = canvas.getContext('2d');
  const frame = document.getElementById('rangeFrame'), scoreEl = document.getElementById('score'), bestEl = document.getElementById('best');
  const timerEl = document.getElementById('timer'), ammoEl = document.getElementById('ammo'), roundEl = document.getElementById('roundCount');
  const toast = document.getElementById('toast'), startModal = document.getElementById('startModal'), pauseModal = document.getElementById('pauseModal'), endModal = document.getElementById('endModal');
  const damage = document.getElementById('damageVignette');
  const audioApi = window.AudioContext || window.webkitAudioContext;
  let audioContext, soundOn = true, running = false, paused = false, score = 0, best = Number(localStorage.getItem('neonRangeBest') || 0), ammo = 6, timeLeft = 45;
  let width = 0, height = 0, dpr = 1, last = 0, frameId = 0, spawn = 0, recoil = 0, hitFlash = 0;
  const GROUND_Y = 0, EYE_HEIGHT = 1.65;
  const player = { x: 0, z: 1, yaw: 0, pitch: 0, moveX: 0, moveY: 0 }, keys = {}, enemies = [], sparks = [];
  const blocks = [
    { x: -5, z: -8, w: 2.2, d: 2, h: 1.6, c: '#5b6874' }, { x: 5, z: -10, w: 2.8, d: 2, h: 2, c: '#364955' },
    { x: -7, z: -18, w: 3.5, d: 2, h: 2.7, c: '#465861' }, { x: 6, z: -20, w: 3, d: 3, h: 1.8, c: '#66747b' },
    { x: 0, z: -28, w: 5, d: 2.3, h: 2.5, c: '#354a55' }, { x: -8, z: -31, w: 2.5, d: 2.5, h: 3.5, c: '#59666b' }
  ];
  const props = [
    { x: -3.2, z: -5.5, w: 1.6, d: 1.2, h: 1.1, c: '#6f7b7f' },
    { x: 3.8, z: -7.5, w: 1.4, d: 1.2, h: .9, c: '#4d5d65' },
    { x: -7.8, z: -12.5, w: 2.8, d: .35, h: .85, c: '#8b9ca0' },
    { x: 7.2, z: -14, w: 2.8, d: .35, h: .85, c: '#516a72' },
    { x: -3.8, z: -23, w: 1.8, d: 1.5, h: 1.4, c: '#68757a' },
    { x: 4.8, z: -25, w: 2.1, d: 1.4, h: 1.1, c: '#4d5d65' }
  ];
  const cover = [
    { x: -5.4, z: -5.8, w: 2.8, d: .55, h: .95, c: '#79868b' },
    { x: 5.2, z: -6.5, w: 2.8, d: .55, h: .95, c: '#79868b' },
    { x: -1.8, z: -11.5, w: 2.3, d: .7, h: .72, c: '#5d6d72' },
    { x: 2.4, z: -15.2, w: 2.8, d: .55, h: 1.05, c: '#79868b' },
    { x: -5.8, z: -18.5, w: 3.2, d: .62, h: .86, c: '#65757b' },
    { x: 5.8, z: -21.5, w: 3.2, d: .62, h: .86, c: '#65757b' },
    { x: -1.8, z: -27, w: 2.4, d: .65, h: .95, c: '#79868b' },
    { x: 3.8, z: -31, w: 3.2, d: .6, h: 1.02, c: '#65757b' }
  ];
  const urbanDetails = [
    { x: -10.5, z: -13, h: 3.4, c: '#64757d' }, { x: 10.5, z: -18, h: 4.2, c: '#53636c' },
    { x: -10.5, z: -27, h: 5, c: '#718087' }, { x: 10.5, z: -31, h: 3.7, c: '#465963' }
  ];
  bestEl.textContent = fmt(best);
  function fmt(n) { return String(Math.max(0, n)).padStart(4, '0'); }
  function resize() { const r = frame.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2); width = r.width; height = r.height; canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function beep(freq, duration, type = 'sine') { if (!soundOn || !audioApi) return; audioContext ||= new audioApi(); const o = audioContext.createOscillator(), g = audioContext.createGain(); o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(.035, audioContext.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration); o.connect(g); g.connect(audioContext.destination); o.start(); o.stop(audioContext.currentTime + duration); }
  function project(x, y, z) { const dx = x - player.x, dz = z - player.z, cos = Math.cos(player.yaw), sin = Math.sin(player.yaw); const side = dx * cos - dz * sin, depth = -(dx * sin + dz * cos); if (depth <= .25) return null; return { x: width / 2 + side * (width * .7) / depth, y: height * .5 - (y - EYE_HEIGHT - player.pitch) * (height * .8) / depth, depth }; }
  function worldDepth(item) { const dx = item.x - player.x, dz = item.z - player.z; return -(dx * Math.sin(player.yaw) + dz * Math.cos(player.yaw)); }
  function drawCube(b, now) {
    const corners = [[b.x - b.w / 2, 0, b.z - b.d / 2], [b.x + b.w / 2, 0, b.z - b.d / 2], [b.x + b.w / 2, 0, b.z + b.d / 2], [b.x - b.w / 2, 0, b.z + b.d / 2], [b.x - b.w / 2, b.h, b.z - b.d / 2], [b.x + b.w / 2, b.h, b.z - b.d / 2], [b.x + b.w / 2, b.h, b.z + b.d / 2], [b.x - b.w / 2, b.h, b.z + b.d / 2]].map(c => project(c[0], c[1], c[2])); if (corners.some(c => !c)) return;
    const shadow = project(b.x, GROUND_Y + .01, b.z);
    if (shadow) { const shadowWidth = Math.max(5, (b.w * width * .7) / shadow.depth); ctx.fillStyle = 'rgba(4,7,18,.4)'; ctx.beginPath(); ctx.ellipse(shadow.x, shadow.y + 2, shadowWidth, Math.max(3, shadowWidth * .22), 0, 0, Math.PI * 2); ctx.fill(); }
    const faces = [[0, 1, 5, 4, b.c], [1, 2, 6, 5, '#262e57'], [4, 5, 6, 7, '#7380b2'], [0, 4, 7, 3, '#3d4775']];
    faces.forEach(f => { ctx.fillStyle = f[4]; ctx.strokeStyle = 'rgba(135,231,240,.25)'; ctx.beginPath(); f.slice(0, 4).forEach((i, n) => n ? ctx.lineTo(corners[i].x, corners[i].y) : ctx.moveTo(corners[i].x, corners[i].y)); ctx.closePath(); ctx.fill(); ctx.stroke(); });
  }
  function drawUrbanDetails(now) {
    urbanDetails.forEach((p, index) => {
      const base = project(p.x, GROUND_Y, p.z), top = project(p.x, p.h, p.z);
      if (!base || !top) return;
      const w = Math.max(4, (width * .9) / base.depth);
      ctx.fillStyle = 'rgba(5,10,18,.55)'; ctx.fillRect(base.x - w * .7, base.y + 2, w * 1.4, 5);
      ctx.fillStyle = p.c; ctx.fillRect(base.x - w / 2, top.y, w, base.y - top.y);
      ctx.fillStyle = '#263942'; ctx.fillRect(base.x - w * .38, top.y + (base.y - top.y) * .18, w * .76, 4);
      ctx.fillStyle = index % 2 ? 'rgba(82,226,237,.65)' : 'rgba(255,157,132,.55)';
      for (let y = top.y + 14; y < base.y - 8; y += 18) ctx.fillRect(base.x - w * .32, y, w * .12, 4);
    });
    const poleXs = [-8.8, 8.8];
    poleXs.forEach(x => {
      const base = project(x, GROUND_Y, -9), top = project(x, 4.5, -9);
      if (!base || !top) return;
      ctx.strokeStyle = '#87969b'; ctx.lineWidth = Math.max(2, 8 / base.depth);
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      ctx.fillStyle = 'rgba(82,226,237,.85)'; ctx.fillRect(top.x - 12 / base.depth, top.y, 24 / base.depth, 5 / base.depth);
      ctx.shadowBlur = 14; ctx.shadowColor = '#52e2ed'; ctx.fillRect(top.x - 4, top.y + 2, 8, 3); ctx.shadowBlur = 0;
    });
    const sign = project(0, 2.9, -13);
    if (sign) {
      const signW = Math.max(28, width * .1 / sign.depth);
      ctx.fillStyle = '#253640'; ctx.fillRect(sign.x - signW, sign.y, signW * 2, signW * .52);
      ctx.strokeStyle = '#52e2ed'; ctx.lineWidth = 2; ctx.strokeRect(sign.x - signW, sign.y, signW * 2, signW * .52);
      ctx.fillStyle = '#a9f5f2'; ctx.font = `${Math.max(7, signW * .18)}px monospace`; ctx.textAlign = 'center'; ctx.fillText('SECTOR 38', sign.x, sign.y + signW * .32);
    }
  }
  function drawEnemy(e, now) {
    const ground = project(e.x, GROUND_Y, e.z); if (!ground || ground.depth > 45) return;
    const s = Math.max(13, Math.min(110, (height * .72) / ground.depth));
    const bob = Math.sin(now / 180 + e.phase) * s * .035;
    const feetY = ground.y + bob;
    const bodyTop = feetY - s * 1.52;
    ctx.save(); ctx.translate(ground.x, feetY); ctx.shadowBlur = 16; ctx.shadowColor = e.c;
    ctx.fillStyle = 'rgba(5,7,20,.55)'; ctx.beginPath(); ctx.ellipse(0, 2, s * .6, s * .17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#252c4b'; ctx.fillRect(-s * .34, -s * .72, s * .27, s * .72); ctx.fillRect(s * .07, -s * .72, s * .27, s * .72);
    ctx.fillStyle = '#8d9ab0'; ctx.fillRect(-s * .43, -s * .18, s * .38, s * .18); ctx.fillRect(s * .05, -s * .18, s * .38, s * .18);
    ctx.fillStyle = e.c; ctx.fillRect(-s * .42, -s * 1.06, s * .84, s * .72);
    ctx.fillStyle = '#d6b49a'; ctx.fillRect(-s * .25, -s * 1.48, s * .5, s * .43);
    ctx.fillStyle = '#252b46'; ctx.fillRect(-s * .28, -s * 1.53, s * .56, s * .15);
    ctx.fillStyle = '#e4edf6'; ctx.fillRect(-s * .15, -s * 1.36, s * .08, s * .07); ctx.fillRect(s * .07, -s * 1.36, s * .08, s * .07);
    ctx.fillStyle = '#202445'; ctx.fillRect(-s * .61, -s * 1.02, s * .19, s * .5); ctx.fillRect(s * .42, -s * 1.02, s * .19, s * .5);
    ctx.fillStyle = '#d6b49a'; ctx.fillRect(-s * .63, -s * .56, s * .23, s * .16); ctx.fillRect(s * .4, -s * .56, s * .23, s * .16);
    ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.fillRect(-s * .28, -s * .98, s * .56, s * .07);
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff3b0'; ctx.fillRect(-s * .14, -s * .85, s * .28, s * .07); ctx.restore();
    e.screen = { x: ground.x, y: bodyTop + s * .76, left: ground.x - s * .65, right: ground.x + s * .65, top: bodyTop, bottom: feetY, depth: ground.depth };
  }
  function drawViewmodel() {
    const scale = Math.min(width, height) / 420;
    const recoilY = recoil * 16 * scale;
    const x = width * .76;
    const y = height * .82 + recoilY;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.11);
    ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(4,5,18,.7)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#4b2d38';
    ctx.fillRect(-38, 35, 44, 118);
    ctx.fillStyle = '#b47b70';
    ctx.fillRect(-34, 39, 35, 108);
    ctx.fillStyle = '#75809b';
    ctx.fillRect(-55, -16, 103, 60);
    ctx.fillStyle = '#aebbd3';
    ctx.fillRect(-51, -12, 95, 52);
    ctx.fillStyle = '#34405f';
    ctx.fillRect(25, -7, 156, 24);
    ctx.fillStyle = '#aebbd3';
    ctx.fillRect(25, -7, 156, 5);
    ctx.fillStyle = '#26314f';
    ctx.fillRect(170, -3, 37, 16);
    ctx.fillStyle = '#8d9ab3';
    ctx.fillRect(181, -1, 25, 11);
    ctx.fillStyle = '#3a4562';
    ctx.beginPath();
    ctx.arc(-2, 14, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b7c5dd';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-2, 14, 31, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#1d2744';
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      ctx.fillRect(-2 + Math.cos(a) * 19 - 4, 14 + Math.sin(a) * 19 - 4, 8, 8);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d5e3f4';
    ctx.fillRect(4, -25, 10, 9);
    ctx.fillStyle = '#202b4b';
    ctx.fillRect(-16, -32, 34, 7);
    if (recoil > .02) {
      ctx.globalAlpha = Math.min(1, recoil * 1.5);
      ctx.fillStyle = '#fff1a8';
      ctx.beginPath();
      ctx.arc(218, 7, 17 + recoil * 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff9d84';
      ctx.beginPath();
      ctx.arc(218, 7, 8 + recoil * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function background(now) {
    const sky = ctx.createLinearGradient(0, 0, 0, height); sky.addColorStop(0, '#0c1830'); sky.addColorStop(.5, '#345b70'); sky.addColorStop(1, '#a2746d'); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255,190,138,.3)'; ctx.beginPath(); ctx.arc(width * .72, height * .24, width * .1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#202d3c'; ctx.fillRect(0, height * .45, width, height * .1);
    for (let i = 0; i < 14; i++) { const x = (i * 83) % width, y = height * (.29 + (i % 4) * .04), w = 18 + (i % 5) * 13, h = 18 + (i % 6) * 11; ctx.fillStyle = i % 3 ? '#273a49' : '#334957'; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(82,226,237,.35)'; ctx.fillRect(x + 5, y + 7, 3, 3); }
    ctx.fillStyle = '#151c26'; ctx.fillRect(0, height * .52, width, height * .48);
    ctx.fillStyle = '#303a43'; ctx.fillRect(0, height * .5, width, height * .04);
    ctx.strokeStyle = 'rgba(80,220,231,.14)';
    for (let z = 2; z < 46; z += 3) { const a = project(-16, GROUND_Y, -z), b = project(16, GROUND_Y, -z); if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
    for (let x = -14; x <= 14; x += 2) { const a = project(x, GROUND_Y, -1), b = project(x, GROUND_Y, -45); if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
    ctx.fillStyle = '#222c55'; ctx.fillRect(0, height * .53, width, 7);
    ctx.strokeStyle = 'rgba(255,221,147,.42)'; ctx.lineWidth = 3;
    [-2.8, 2.8].forEach(x => { const a = project(x, GROUND_Y + .01, -1), b = project(x, GROUND_Y + .01, -45); if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } });
  }
  function spawnEnemy() { const side = Math.random() > .5 ? 1 : -1; enemies.push({ x: player.x + side * (2.5 + Math.random() * 7), z: player.z - (8 + Math.random() * 28), c: Math.random() > .5 ? '#52e2ed' : '#ff9d84', phase: Math.random() * 7, value: 50 + Math.floor(Math.random() * 35), screen: null }); }
  function updateAmmo() { ammoEl.innerHTML = ''; for (let i = 0; i < 6; i++) { const s = document.createElement('i'); if (i >= ammo) s.className = 'empty'; ammoEl.appendChild(s); } roundEl.textContent = ammo; }
  function showToast(t) { toast.textContent = t; toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show'); }
  function clearInput() { keys.w = keys.a = keys.s = keys.d = false; player.moveX = 0; player.moveY = 0; }
  function togglePause() {
    if (!running) return;
    paused = !paused;
    clearInput();
    pauseModal.classList.toggle('hidden', !paused);
    document.getElementById('pauseButton').textContent = paused ? '▶' : 'Ⅱ';
    document.getElementById('pauseButton').setAttribute('aria-pressed', String(paused));
    document.getElementById('pauseButton').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    if (!paused) last = performance.now();
  }
  function fire(aimX = width / 2, aimY = height / 2) {
    if (!running || paused) return; if (!ammo) { showToast('RELOAD'); beep(120, .08, 'square'); return; } ammo--; updateAmmo(); recoil = 1; beep(150, .06, 'sawtooth');
    let picked = null, bestDepth = Infinity; enemies.forEach(e => { const target = e.screen; if (target && aimX >= target.left && aimX <= target.right && aimY >= target.top && aimY <= target.bottom && target.depth < bestDepth) { picked = e; bestDepth = target.depth; } });
    if (picked) { enemies.splice(enemies.indexOf(picked), 1); score += picked.value; scoreEl.textContent = fmt(score); showToast(`TARGET TAGGED  +${picked.value}`); beep(740, .1, 'triangle'); hitFlash = 1; for (let i = 0; i < 16; i++) sparks.push({ x: picked.screen.x, y: picked.screen.y, vx: Math.random() * 140 - 70, vy: Math.random() * 140 - 70, life: .6 }); }
  }
  function reload() { if (running && !paused && ammo < 6) { ammo = 6; updateAmmo(); showToast('READY'); beep(420, .14, 'triangle'); } }
  function move(dt) {
    const keyboardX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    const keyboardY = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
    let inputX = keyboardX;
    let inputY = keyboardY;
    const magnitude = Math.hypot(inputX, inputY);
    if (magnitude > 1) { inputX /= magnitude; inputY /= magnitude; }
    const response = Math.min(1, dt * 14);
    player.moveX += (inputX - player.moveX) * response;
    player.moveY += (inputY - player.moveY) * response;
    const speed = 5 * dt;
    player.x += (Math.sin(player.yaw) * player.moveY + Math.cos(player.yaw) * player.moveX) * speed;
    player.z += (-Math.cos(player.yaw) * player.moveY + Math.sin(player.yaw) * player.moveX) * speed;
  }
  function loop(now) {
    if (!running) return; const dt = paused ? 0 : Math.min((now - last) / 1000 || 0, .05); last = now; timeLeft -= dt; spawn -= dt; recoil = Math.max(0, recoil - dt * 7); hitFlash = Math.max(0, hitFlash - dt * 3);
    if (timeLeft <= 0) return finish();                 if (!paused && spawn <= 0) { spawnEnemy(); spawn = Math.max(.8, 1.8 - (45 - timeLeft) * .018); } if (!paused) move(dt); background(now); drawUrbanDetails(now); blocks.concat(props, cover).slice().sort((a, b) => worldDepth(b) - worldDepth(a)).forEach(b => drawCube(b, now)); enemies.sort((a, b) => worldDepth(b) - worldDepth(a)).forEach(e => drawEnemy(e, now));
    sparks.splice(0).forEach(s => { s.life -= dt; if (s.life > 0) { ctx.fillStyle = '#fff2b7'; ctx.fillRect(s.x += s.vx * dt, s.y += s.vy * dt, 3, 3); sparks.push(s); } });
    drawViewmodel();
    ctx.fillStyle = `rgba(255,255,255,${recoil * .35})`; ctx.fillRect(0, 0, width, height); damage.style.opacity = hitFlash * .35; timerEl.textContent = String(Math.ceil(timeLeft)).padStart(2, '0'); frameId = requestAnimationFrame(loop);
  }
  function start() { startModal.classList.add('hidden'); pauseModal.classList.add('hidden'); endModal.classList.add('hidden'); running = true; paused = false; score = 0; ammo = 6; timeLeft = 45; player.x = 0; player.z = 1; player.yaw = 0; clearInput(); enemies.length = 0; scoreEl.textContent = fmt(0); updateAmmo(); resize(); last = performance.now(); spawn = .1; document.getElementById('pauseButton').textContent = 'Ⅱ'; document.getElementById('pauseButton').setAttribute('aria-pressed', 'false'); cancelAnimationFrame(frameId); frameId = requestAnimationFrame(loop); beep(520, .12, 'triangle'); }
  function finish() { running = false; const newBest = score > best; if (newBest) { best = score; localStorage.setItem('neonRangeBest', best); bestEl.textContent = fmt(best); } document.getElementById('finalScore').textContent = fmt(score); document.getElementById('resultMessage').textContent = newBest ? 'New high score. The blockout belongs to you.' : 'Solid run. Drop back in and own the grid.'; endModal.classList.remove('hidden'); }
  let lookId = null, lookX = 0, lookStartX = 0, lookStartY = 0;
  frame.addEventListener('pointerdown', e => { lookId = e.pointerId; lookX = e.clientX; lookStartX = e.clientX; lookStartY = e.clientY; });
  frame.addEventListener('pointermove', e => { if (e.pointerId === lookId && running && !paused) { player.yaw += (e.clientX - lookX) * .008; lookX = e.clientX; } });
  frame.addEventListener('pointerup', e => { if (e.pointerId !== lookId) return; const moved = Math.hypot(e.clientX - lookStartX, e.clientY - lookStartY); if (running && moved < 12 && e.target === canvas) { const r = canvas.getBoundingClientRect(); fire(e.clientX - r.left, e.clientY - r.top); } lookId = null; });
  frame.addEventListener('pointercancel', () => { lookId = null; });
  document.getElementById('shootButton').addEventListener('pointerdown', e => { e.preventDefault(); fire(); }); document.getElementById('reloadButton').addEventListener('click', reload);
  document.getElementById('pauseButton').addEventListener('click', togglePause); document.getElementById('resumeButton').addEventListener('click', togglePause);
  document.getElementById('startButton').addEventListener('click', start); document.getElementById('restartButton').addEventListener('click', start);
  document.getElementById('soundToggle').addEventListener('click', e => { soundOn = !soundOn; e.currentTarget.textContent = soundOn ? '♫' : '×'; e.currentTarget.setAttribute('aria-pressed', soundOn); });
  addEventListener('keydown', e => { const key = e.key.toLowerCase(); if (key === 'p') { e.preventDefault(); togglePause(); return; } if (['w', 'a', 's', 'd'].includes(key)) { e.preventDefault(); if (running && !paused) keys[key] = true; } if (e.code === 'Space') { e.preventDefault(); if (!running && !startModal.classList.contains('hidden')) start(); else fire(); } if (key === 'r') reload(); });
  addEventListener('keyup', e => { const key = e.key.toLowerCase(); if (['w', 'a', 's', 'd'].includes(key)) { e.preventDefault(); keys[key] = false; } });
  addEventListener('blur', () => { clearInput(); if (running && !paused) togglePause(); });
  addEventListener('resize', resize); resize(); updateAmmo();
})();
