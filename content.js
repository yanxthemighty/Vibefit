// content.js - VibeFit v5.6 (Ultimate Stopwatch History & Liquid Glass Card Generator)
let isRunning = false;
let totalWorkouts = 0;
let totalCalories = 0;
let isResting = false;
let isMusicMuted = false; // 🎵 背景音乐静音状态

let timerInterval = null;
let currentRemainingTime = 30;
let totalSessionTime = 30;

let audioCtx = null;
let synthInterval = null;
let beatCount = 0;

// 记录运动历史流（完全复刻 iOS 秒表 Lap List 数据结构）
let workoutHistory = [];

const GITHUB_USERNAME = "yanxthemighty"; 
const REPO_NAME = "vibefit-assets";
const CLOUD_VIDEO_BASE = `https://cdn.jsdelivr.net/gh/${GITHUB_USERNAME}/${REPO_NAME}/`;

const routines = [
  { 
    id: "lunge", 
    title: "Forward Lunges", 
    duration: 30, 
    steps: "1. Step forward.\n2. Lower hips.", 
    localPath: "videos/lunge.mp4", 
    remoteUrl: CLOUD_VIDEO_BASE + "lunge.mp4" 
  },
  { 
    id: "wall_squat", 
    title: "Wall Squat", 
    duration: 30, 
    steps: "1. Lean against the wall.\n2. Hold 90 degrees.", 
    localPath: "videos/wall_squat.mp4", 
    remoteUrl: CLOUD_VIDEO_BASE + "wall_squat.mp4" 
  },
  { 
    id: "jump", 
    title: "Jumping Jacks", 
    duration: 15, 
    steps: "1. Feet together.\n2. Jump wide, hands up.", 
    localPath: "videos/jump.mp4", 
    remoteUrl: CLOUD_VIDEO_BASE + "jump.mp4" 
  },
  { 
    id: "climber", 
    title: "Mountain Climbers", 
    duration: 30, 
    steps: "1. Plank position.\n2. Drive knees to chest rapidly.", 
    localPath: "videos/climber.mp4", 
    remoteUrl: CLOUD_VIDEO_BASE + "climber.mp4" 
  },
  { 
    id: "stretch", 
    title: "Chest Stretch", 
    duration: 30, 
    steps: "1. Pull elbows back bent.\n2. Extend arms wide in T-shape.", 
    localPath: "videos/stretch.mp4", 
    remoteUrl: CLOUD_VIDEO_BASE + "stretch.mp4" 
  },
  { 
    id: "neck_stretch", 
    title: "Neck Stretch", 
    duration: 15, 
    steps: "1. Sit straight.\n2. Tilt head to side with hand gently pressing.", 
    localPath: "videos/neck_stretch.mp4", 
    remoteUrl: CLOUD_VIDEO_BASE + "neck_stretch.mp4" 
  },
  { 
    id: "jingming", 
    title: "Jingming Acupoint Massage", 
    duration: 30, 
    steps: "1. Close eyes.\n2. Press index fingers on Jingming acupoints near inner eye corners.", 
    localPath: "videos/jingming.mp4", 
    remoteUrl: CLOUD_VIDEO_BASE + "jingming.mp4" 
  },
  { 
    id: "relax", 
    title: "Gazing into Distance", 
    duration: 15, 
    steps: "1. Look up from screen.\n2. Gaze out the window at the distant trees.", 
    localPath: "videos/relax.mp4", 
    remoteUrl: CLOUD_VIDEO_BASE + "relax.mp4" 
  }
];

let currentRoutine = null;

// ⚡ 双轨预检测与预载
async function getPlayableUrlWithFallback(routine) {
try {
const localUrl = chrome.runtime.getURL(routine.localPath);
const response = await fetch(localUrl, { method: 'HEAD' });
if (response.ok) return localUrl;
} catch (e) {}

const remoteUrl = routine.remoteUrl;
try {
const cache = await caches.open('vibefit-mp4-cache');
let cachedResponse = await cache.match(remoteUrl);
if (cachedResponse) {
const blob = await cachedResponse.blob();
return URL.createObjectURL(blob);
}
await cache.add(remoteUrl);
cachedResponse = await cache.match(remoteUrl);
const blob = await cachedResponse.blob();
return URL.createObjectURL(blob);
} catch (error) {
return remoteUrl; 
}
}

async function silentPreloadAllVideos() {
try {
const cache = await caches.open('vibefit-mp4-cache');
for (const r of routines) {
try {
const localUrl = chrome.runtime.getURL(r.localPath);
const res = await fetch(localUrl, { method: 'HEAD' });
if (res.ok) continue; 
} catch(e) {}
const isCached = await cache.match(r.remoteUrl);
if (!isCached) {
cache.add(r.remoteUrl).catch(() => {});
}
}
} catch (err) {}
}

function initAudio() {
if (!audioCtx) {
audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
}

// 🔊 独立倒计时音频（不受静音按钮影响）
function playBeep(isLong = false) {
initAudio();
if (!audioCtx || audioCtx.state === 'suspended') return;

const osc = audioCtx.createOscillator();
const gain = audioCtx.createGain();
osc.connect(gain);
gain.connect(audioCtx.destination);

osc.type = 'sine';
osc.frequency.setValueAtTime(800, audioCtx.currentTime); 

const duration = isLong ? 0.5 : 0.12;
gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

osc.start();
osc.stop(audioCtx.currentTime + duration);
}

// 🎵 背景 Tabata 电子低音
function startTabataBeats() {
initAudio();
if (synthInterval) clearInterval(synthInterval);
beatCount = 0;

synthInterval = setInterval(() => {
if (isMusicMuted || !audioCtx || audioCtx.state === 'suspended') return;

const osc = audioCtx.createOscillator();
const gain = audioCtx.createGain();
osc.connect(gain);
gain.connect(audioCtx.destination);

if (beatCount % 4 === 0) {
osc.frequency.setValueAtTime(120, audioCtx.currentTime); 
gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
} else {
osc.frequency.setValueAtTime(70, audioCtx.currentTime); 
gain.gain.setValueAtTime(0.10, audioCtx.currentTime);
}

osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

osc.start();
osc.stop(audioCtx.currentTime + 0.2);
beatCount++;
}, 500);
}

function stopBeats() {
if (synthInterval) {
clearInterval(synthInterval);
synthInterval = null;
}
}

// 🌟 创建主面板
function createVibeOverlay() {
if (document.getElementById('vibefit-overlay')) return;
initAudio();
silentPreloadAllVideos();

const overlay = document.createElement('div');
overlay.id = 'vibefit-overlay';
Object.assign(overlay.style, {
position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
backgroundColor: 'rgba(255, 255, 255, 0.12)',
backdropFilter: 'blur(50px) saturate(240%)', webkitBackdropFilter: 'blur(50px) saturate(240%)',
zIndex: '2147483647', display: 'flex', flexDirection: 'column',
alignItems: 'center', justifyContent: 'center', fontFamily: '"Roboto", "Segoe UI", sans-serif'
});

// 📈 顶部大尺寸看板 + 📋 历史记录入口
const statsBar = document.createElement('div');
statsBar.style.cssText = `
position: absolute; top: 40px; display: flex; gap: 24px; z-index: 10; align-items: center;
`;
statsBar.innerHTML = `
<div style="background: rgba(255, 255, 255, 0.55); padding: 12px 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.04); border: 1px solid rgba(255,255,255,0.7); display: flex; align-items: center; gap: 12px; font-size: 1.8rem; font-weight: 900; color: #1C1B1F;">
🔥 <span style="color: #D32F2F;">Calories:</span> <span id="vf-cals" style="background: linear-gradient(135deg, #FF3D00, #D32F2F); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${totalCalories}</span>
</div>
<div style="background: rgba(255, 255, 255, 0.55); padding: 12px 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.04); border: 1px solid rgba(255,255,255,0.7); display: flex; align-items: center; gap: 12px; font-size: 1.8rem; font-weight: 900; color: #1C1B1F;">
🏋️ <span style="color: #2E7D32;">Completed:</span> <span id="vf-count" style="background: linear-gradient(135deg, #4CAF50, #2E7D32); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${totalWorkouts}</span>
</div>
<button id="vf-history-toggle-btn" style="background: rgba(28, 27, 31, 0.8); color: white; border: none; padding: 14px 24px; border-radius: 20px; font-size: 1.1rem; font-weight: 700; cursor: pointer; backdrop-filter: blur(10px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); transition: all 0.2s;">
📋 View History
</button>
`;
overlay.appendChild(statsBar);

// 倒计时容器 + 🔈 静音控制按钮
const timerContainer = document.createElement('div');
timerContainer.style.cssText = 'position:absolute; top:35px; right:60px; width:130px; height:130px; z-index:10; display:flex; flex-direction:column; align-items:center;';
const canvas = document.createElement('canvas');
canvas.id = 'vf-timer-canvas';
canvas.width = 130;
canvas.height = 130;
timerContainer.appendChild(canvas);
const timerText = document.createElement('div');
timerText.id = 'vf-timer-text';
timerText.style.cssText = 'position:absolute; top:0; left:0; width:130px; height:130px; display:flex; align-items:center; justify-content:center; font-size:2.8rem; font-weight:900;';
timerContainer.appendChild(timerText);

// 🎵 静音控制专属小按钮
const muteBtn = document.createElement('button');
muteBtn.id = 'vf-audio-mute-btn';
muteBtn.style.cssText = `
margin-top: 10px; border: none; background: rgba(255,255,255,0.6); width: 40px; height: 40px; 
border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; 
font-size: 1.2rem; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid rgba(255,255,255,0.8); transition: transform 0.2s;
`;
muteBtn.innerText = isMusicMuted ? "🔇" : "🔊";
muteBtn.onclick = () => {
isMusicMuted = !isMusicMuted;
muteBtn.innerText = isMusicMuted ? "🔇" : "🔊";
if (isMusicMuted) stopBeats(); else if (!isResting) startTabataBeats();
};
muteBtn.onmouseover = () => muteBtn.style.transform = 'scale(1.1)';
muteBtn.onmouseout = () => muteBtn.style.transform = 'scale(1)';
timerContainer.appendChild(muteBtn);
overlay.appendChild(timerContainer);

// 🌟 两栏弹性视窗（用于容纳右侧弹出的历史纪录面板）
const contentFlexLayout = document.createElement('div');
contentFlexLayout.style.cssText = 'display:flex; gap:30px; width:94%; max-width:1300px; align-items:stretch; z-index:5;';

// Liquid Glass 主工作窗
const mainCard = document.createElement('div');
mainCard.id = 'vf-main-card';
mainCard.style.cssText = `
background: rgba(255, 255, 255, 0.45); padding: 50px; border-radius: 44px; 
box-shadow: 0 40px 90px rgba(0, 0, 0, 0.08), inset 0 1.5px 0 rgba(255, 255, 255, 0.8); 
backdrop-filter: blur(25px); display: flex; gap: 50px; flex: 1; align-items: center; 
border: 1px solid rgba(255, 255, 255, 0.5); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
`;
const videoWrapper = document.createElement('div');
videoWrapper.id = 'vf-video-wrapper';
videoWrapper.style.cssText = 'width:65%; aspect-ratio:16/9; background:#ffffff; border-radius:28px; overflow:hidden; box-shadow: 0 20px 48px rgba(0,0,0,0.08); border: 1px solid rgba(255,255,255,0.45); display:flex; align-items:center; justify-content:center;';
mainCard.appendChild(videoWrapper);

const infoWrapper = document.createElement('div');
infoWrapper.style.cssText = 'width:35%; text-align:left; display:flex; flex-direction:column; justify-content:center; min-height: 380px;';
infoWrapper.innerHTML = `
<h1 id="vf-title" style="margin:0 0 20px 0; color:#D32F2F; font-size:3rem; font-weight:900; letter-spacing:-1px;"></h1>
<pre id="vf-steps" style="font-family:inherit; white-space:pre-wrap; font-size:1.25rem; color:#27272A; line-height:1.7; margin:0 0 40px 0; min-height: 100px; font-weight: 600;"></pre>
<div id="vf-interaction-area" style="display:flex; flex-direction:column; gap:18px;"></div>
`;
mainCard.appendChild(infoWrapper);
contentFlexLayout.appendChild(mainCard);

// 📋 独立交互式历史流看板（完全致敬 iOS 秒表 Lap List）
const historyPanel = document.createElement('div');
historyPanel.id = 'vf-history-panel';
historyPanel.style.cssText = `
width: 0px; opacity: 0; background: rgba(255, 255, 255, 0.65); border-radius: 44px; 
box-shadow: 0 40px 90px rgba(0, 0, 0, 0.05); backdrop-filter: blur(25px); 
border: 1px solid rgba(255, 255, 255, 0.5); display: flex; flex-direction: column; 
padding: 0px; overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
`;
contentFlexLayout.appendChild(historyPanel);
overlay.appendChild(contentFlexLayout);

// 绑定查看历史点击事件
statsBar.querySelector('#vf-history-toggle-btn').onclick = () => {
const isOpened = historyPanel.style.width !== '0px';
if (isOpened) {
historyPanel.style.width = '0px';
historyPanel.style.opacity = '0';
historyPanel.style.padding = '0px';
} else {
historyPanel.style.width = '420px';
historyPanel.style.opacity = '1';
historyPanel.style.padding = '40px 24px';
renderHistoryList();
}
};

// 底部全局跳过
const skipBtn = document.createElement('button');
skipBtn.id = 'vf-skip-btn';
skipBtn.style.cssText = `
position:absolute; bottom:40px; padding:16px 48px; background: rgba(255, 255, 255, 0.35); color:#1C1B1F; 
border: 1px solid rgba(255, 255, 255, 0.55); border-radius:100px; font-size:1.1rem; cursor:pointer; font-weight:700; 
backdrop-filter: blur(8px); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05); transition: all 0.2s;
`;
skipBtn.innerText = 'Skip Workout';
skipBtn.onmouseover = () => { skipBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.6)'; skipBtn.style.transform = 'scale(1.03)'; };
skipBtn.onmouseout = () => { skipBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.35)'; skipBtn.style.transform = 'scale(1)'; };
skipBtn.onclick = () => removeVibeOverlay();
overlay.appendChild(skipBtn);

document.body.appendChild(overlay);
loadNextRoutine();
}

// 📐 动态生成并下载精美长条分享卡片（高光红色流体玻璃字 + iOS经典秒表数据）
function downloadShareCard() {
const canvas = document.createElement('canvas');
const rowHeight = 65;
const headerHeight = 200;
const footerHeight = 280;
// 重组历史数据为正序排列以便绘制
const lapsData = workoutHistory.slice().reverse().map((item, idx) => ({
index: String(idx + 1).padStart(2, '0'),
timeSlot: item.timeSlot,
duration: `${item.duration}.00s`,
calories: item.cal
}));

canvas.width = 800; // 窄长条格式，更适合手机端长图分享
canvas.height = headerHeight + (lapsData.length * rowHeight) + footerHeight;
const ctx = canvas.getContext('2d');

// 1. 纯白画布
ctx.fillStyle = '#FFFFFF';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// 🎨 红色流体玻璃字渲染公用函数
function drawGlassText(text, x, y, fontSize, align = 'left') {
ctx.save();
ctx.font = `900 ${fontSize}px "Impact", "Arial Black", "Courier New", monospace`;
ctx.textAlign = align;
// 渐变模拟玻璃内部流体折射
let grad = ctx.createLinearGradient(x, y - fontSize, x, y);
grad.addColorStop(0, '#FF3333'); // 顶部高亮
grad.addColorStop(0.5, '#D32F2F'); // 中间主红
grad.addColorStop(1, '#600000'); // 底部深邃折射暗红
ctx.fillStyle = grad;
ctx.fillText(text, x, y);
// 叠加白色玻璃边缘光圈
ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
ctx.lineWidth = fontSize * 0.035;
ctx.strokeText(text, x, y);
ctx.restore();
}

// ======= 头部 (TOP): 品牌区 =======
drawGlassText("Vibe-Fit", 60, 100, 65);
ctx.fillStyle = '#71717A';
ctx.font = '700 20px "Segoe UI", sans-serif';
ctx.fillText("Session Log", 65, 140);

// ======= 中部 (MIDDLE): 完美复刻 iOS 极简秒表流水 =======
let currentY = headerHeight;
// 顶部分割线
ctx.strokeStyle = '#E4E4E7';
ctx.lineWidth = 1.5;
ctx.beginPath(); ctx.moveTo(60, currentY - 25); ctx.lineTo(740, currentY - 25); ctx.stroke();

lapsData.forEach((lap) => {
ctx.fillStyle = '#1C1B1F';
ctx.font = '700 22px "Courier New", monospace';
ctx.textAlign = 'left';
// 左侧：序号与触发时段
ctx.fillText(`${lap.index} [ ${lap.timeSlot} ]`, 60, currentY);

// 中间：单次秒表计时
ctx.textAlign = 'center';
ctx.fillText(lap.duration, 400, currentY);

// 右侧：单次热量
ctx.textAlign = 'right';
ctx.fillStyle = '#71717A';
ctx.fillText(`${lap.calories} kcal`, 740, currentY);

// 行间轻量分割线
ctx.strokeStyle = '#F4F4F5';
ctx.lineWidth = 1;
ctx.beginPath(); ctx.moveTo(60, currentY + 18); ctx.lineTo(740, currentY + 18); ctx.stroke();

currentY += rowHeight;
});

// ======= 底部 (BOTTOM): 汇总数据区 =======
const footerY = currentY + 30;
// 底部加粗粗线
ctx.strokeStyle = '#1C1B1F';
ctx.lineWidth = 2.5;
ctx.beginPath(); ctx.moveTo(60, footerY - 20); ctx.lineTo(740, footerY - 20); ctx.stroke();

// 左下角：总运动时长 (以红色玻璃字呈现)
ctx.fillStyle = '#71717A';
ctx.font = '700 18px "Segoe UI", sans-serif';
ctx.textAlign = 'left';
ctx.fillText("TOTAL DURATION", 60, footerY + 20);
let totalSecs = workoutHistory.reduce((sum, item) => sum + item.duration, 0);
const totalMinutes = Math.floor(totalSecs / 60);
const remainingSecs = totalSecs % 60;
const durationStr = `${String(totalMinutes).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}.00`;
drawGlassText(durationStr, 60, footerY + 105, 75);

// 右下角：总卡路里 (以红色玻璃字呈现)
ctx.textAlign = 'right';
ctx.fillText("TOTAL CALORIES", 740, footerY + 20);
drawGlassText(`${totalCalories} KCAL`, 740, footerY + 105, 75, 'right');

// ======= 自动下载卡片 =======
const link = document.createElement('a');
link.download = `VibeFit-SessionLog-${new Date().toISOString().slice(0,10)}.png`;
link.href = canvas.toDataURL('image/png');
link.click();
}

// 渲染历史面板数据方法 (iOS 经典秒表 Lap List 黑白极简风 + 📥 一键分享生成长卡)
function renderHistoryList() {
const panel = document.getElementById('vf-history-panel');
if (!panel || panel.style.width === '0px') return;

if (workoutHistory.length === 0) {
panel.innerHTML = `
<h3 style="margin:0 0 20px 0; font-size:1.5rem; font-weight:900; color:#1C1B1F;">Workout Logs</h3>
<div style="flex:1; display:flex; align-items:center; justify-content:center; color:#71717A; font-weight:600;">No workouts logged yet. Start training!</div>
`;
return;
}

// 逐笔排列，完全对齐秒表列表
let listHtml = workoutHistory.map((item, index) => {
const displayIndex = String(workoutHistory.length - index).padStart(2, '0');
return `
<div style="border-bottom: 1px solid rgba(0,0,0,0.05); padding:16px 0; display:flex; font-family:'Courier New', monospace; justify-content:space-between; align-items:center;">
<div style="text-align:left; font-weight:700; color:#1C1B1F; font-size:1.1rem;">
${displayIndex} &nbsp;<span style="color:#71717A;">[ ${item.timeSlot} ]</span>
</div>
<div style="font-weight:700; color:#1C1B1F; font-size:1.1rem; text-align:center; flex:1;">
${item.duration}.00s
</div>
<div style="font-weight:700; color:#71717A; font-size:1.1rem; text-align:right;">
${item.cal} kcal
</div>
</div>
`;
}).join('');

panel.innerHTML = `
<h3 style="margin:0 0 20px 0; font-size:1.5rem; font-weight:900; color:#1C1B1F; display:flex; justify-content:space-between; align-items:center;">
<span>Workout Logs 📋</span>
<div style="display:flex; gap:16px; align-items:center;">
<span style="font-size:0.95rem; color:#D32F2F; font-weight:800; cursor:pointer;" id="vf-share-card">📥 Share</span>
<span style="font-size:0.9rem; color:#71717A; font-weight:600; cursor:pointer;" id="vf-clear-history">Clear</span>
</div>
</h3>
<div style="flex:1; overflow-y:auto; padding-right:4px;">${listHtml}</div>
`;

// 绑定分享及清理动作
panel.querySelector('#vf-share-card').onclick = () => {
downloadShareCard();
};

panel.querySelector('#vf-clear-history').onclick = () => {
workoutHistory = [];
renderHistoryList();
};
}

function updateStats() {
const calsEl = document.getElementById('vf-cals');
const countEl = document.getElementById('vf-count');
if (calsEl) calsEl.innerText = totalCalories;
if (countEl) countEl.innerText = totalWorkouts;
}

function drawCircleProgress(remaining, total, color) {
const canvas = document.getElementById('vf-timer-canvas');
if (!canvas) return;
const ctx = canvas.getContext('2d');
const size = canvas.width;
const center = size / 2;
const radius = center - 8;

ctx.clearRect(0, 0, size, size);

ctx.beginPath();
ctx.arc(center, center, radius, 0, 2 * Math.PI);
ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
ctx.lineWidth = 8;
ctx.stroke();

const percentage = remaining / total;
const endAngle = (2 * Math.PI * percentage) - (0.5 * Math.PI);
ctx.beginPath();
ctx.arc(center, center, radius, -0.5 * Math.PI, endAngle);
ctx.strokeStyle = color;
ctx.lineWidth = 8;
ctx.lineCap = 'round';
ctx.stroke();
}

async function loadNextRoutine() {
isResting = false;
currentRoutine = routines[Math.floor(Math.random() * routines.length)];
document.getElementById('vf-title').innerText = currentRoutine.title;
document.getElementById('vf-title').style.color = '#D32F2F';
document.getElementById('vf-steps').innerText = currentRoutine.steps;
resetInteractionArea(false);

const videoWrapper = document.getElementById('vf-video-wrapper');
videoWrapper.innerHTML = `
<div id="vf-loading-placeholder" style="color:#3F3F46; font-size:1.2rem; font-weight:700; text-align:center;">
🌀 Syncing HD Motion Engine...
</div>
`;

const playableUrl = await getPlayableUrlWithFallback(currentRoutine);

videoWrapper.innerHTML = `
<video id="vf-native-video" width="100%" height="100%" 
autoplay muted loop playsinline preload="auto"
style="object-fit: contain; background:#ffffff; border-radius:28px;">
<source src="${playableUrl}" type="video/mp4">
</video>
`;

const v = document.getElementById('vf-native-video');
if (v) {
v.muted = true;
v.volume = 0;
v.onended = () => { v.play(); };
}

startTabataBeats();

currentRemainingTime = currentRoutine.duration;
totalSessionTime = currentRoutine.duration;
startCountdown();
}

// 🛌 休息阶段：纯正的翡翠纯色绿 (#2E7D32) 配色
function loadRestSession() {
isResting = true;
stopBeats();

const pureGreen = "#2E7D32"; 

document.getElementById('vf-title').innerText = "REST TIME ☕";
document.getElementById('vf-title').style.color = pureGreen;
document.getElementById('vf-steps').innerText = "Take deep breaths. Relax and stretch.";

document.getElementById('vf-video-wrapper').innerHTML = `
<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; 
background: rgba(46, 125, 50, 0.05); color:${pureGreen}; 
font-size:2.5rem; font-weight:900; letter-spacing:2px; border-radius:28px; 
backdrop-filter: blur(10px); border: 2px solid ${pureGreen};">
INTERVAL REST
</div>
`;

const area = document.getElementById('vf-interaction-area');
if (area) {
area.innerHTML = `
<button id="vf-rest-next-btn" style="padding:18px 32px; background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%); color:#FFFFFF; 
border: none; border-radius:100px; font-size:1.2rem; cursor:pointer; font-weight:800; 
box-shadow: 0 8px 24px rgba(46, 125, 50, 0.3); transition: all 0.2s ease;">
Skip & Next Session
</button>
`;
const skipRestBtn = document.getElementById('vf-rest-next-btn');
skipRestBtn.onmouseover = () => { skipRestBtn.style.transform = 'scale(1.03)'; skipRestBtn.style.filter = 'brightness(1.1)'; };
skipRestBtn.onmouseout = () => { skipRestBtn.style.transform = 'scale(1)'; skipRestBtn.style.filter = 'none'; };
skipRestBtn.onclick = () => {
clearInterval(timerInterval);
handleWorkoutCompletion();
};
}

currentRemainingTime = 10;
totalSessionTime = 10;

startCountdown();
}

function resetInteractionArea(isRestOverChoice) {
const area = document.getElementById('vf-interaction-area');
if (!area) return;

if (isRestOverChoice) {
// 💡 两组做完后的选择页：“Next Session” 按钮修正为高能红色
area.innerHTML = `
<p style="font-weight:800; color:#1C1B1F; margin:0 0 16px 0; font-size:1.2rem; line-height:1.4;">Two exercises complete! Choose next:</p>
<div style="display:flex; flex-direction:column; gap:14px;">
<button id="vf-choice-next" style="padding:18px; background: linear-gradient(135deg, #FF4D4D 0%, #D32F2F 100%); color:#FFFFFF; border:none; border-radius:100px; font-size:1.15rem; cursor:pointer; font-weight:800; box-shadow: 0 8px 24px rgba(211, 47, 47, 0.3), inset 0 1px 0 rgba(255,255,255,0.4); transition: transform 0.2s, filter 0.2s;">Next Session</button>
<button id="vf-choice-pause" style="padding:18px; background: rgba(255, 255, 255, 0.5); color:#1C1B1F; border: 1px solid rgba(255, 255, 255, 0.7); border-radius:100px; font-size:1.1rem; cursor:pointer; font-weight:800; box-shadow: 0 4px 12px rgba(0,0,0,0.03); backdrop-filter: blur(10px); transition: transform 0.2s, background-color 0.2s;">Pause Here</button>
</div>
`;
const nextBtn = document.getElementById('vf-choice-next');
const pauseBtn = document.getElementById('vf-choice-pause');

nextBtn.onmouseover = () => { nextBtn.style.transform = 'scale(1.03)'; nextBtn.style.filter = 'brightness(1.1)'; };
nextBtn.onmouseout = () => { nextBtn.style.transform = 'scale(1)'; nextBtn.style.filter = 'none'; };
nextBtn.onclick = () => loadNextRoutine();

pauseBtn.onmouseover = () => { pauseBtn.style.transform = 'scale(1.03)'; pauseBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.75)'; };
pauseBtn.onmouseout = () => { pauseBtn.style.transform = 'scale(1)'; pauseBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.5)'; };
pauseBtn.onclick = () => removeVibeOverlay();

} else {
area.innerHTML = `
<button id="vf-next-btn" style="padding:18px 32px; background: linear-gradient(135deg, #FF4D4D 0%, #D32F2F 100%); color:#FFFFFF; border:none; border-radius:100px; font-size:1.2rem; cursor:pointer; font-weight:800; box-shadow: 0 8px 24px rgba(211, 47, 47, 0.3), inset 0 1px 0 rgba(255,255,255,0.4); transition: transform 0.2s, filter 0.2s;">Next Session</button>
`;
const nextBtn = document.getElementById('vf-next-btn');
nextBtn.onmouseover = () => { nextBtn.style.transform = 'scale(1.03)'; nextBtn.style.filter = 'brightness(1.1)'; };
nextBtn.onmouseout = () => { nextBtn.style.transform = 'scale(1)'; nextBtn.style.filter = 'none'; };
nextBtn.onclick = () => {
// 记录历史记录 (最新完成的插在最前面)
const now = new Date();
workoutHistory.unshift({
timeSlot: now.toTimeString().split(' ')[0].substring(0, 5),
duration: currentRoutine.duration,
cal: 10
});
renderHistoryList();

totalCalories += 10;
totalWorkouts += 1;
updateStats();
handleWorkoutCompletion();
};
}
}

function startCountdown() {
clearInterval(timerInterval);
const textEl = document.getElementById('vf-timer-text');
const themeColor = isResting ? '#2E7D32' : '#D32F2F';

if (textEl) {
textEl.innerText = currentRemainingTime;
textEl.style.color = themeColor;
}
drawCircleProgress(currentRemainingTime, totalSessionTime, themeColor);

timerInterval = setInterval(() => {
currentRemainingTime--;
if (textEl) textEl.innerText = currentRemainingTime;
drawCircleProgress(currentRemainingTime, totalSessionTime, themeColor);

// 🔊 倒计时强制报警音，确保提醒功能不受静音按钮影响
if (currentRemainingTime <= 5 && currentRemainingTime > 0) {
playBeep(false);
}

if (currentRemainingTime <= 0) {
clearInterval(timerInterval);
playBeep(true);

if (!isResting) {
const now = new Date();
workoutHistory.unshift({
timeSlot: now.toTimeString().split(' ')[0].substring(0, 5),
duration: currentRoutine.duration,
cal: 10
});
renderHistoryList();

totalCalories += 10;
totalWorkouts += 1;
updateStats();
loadRestSession();
} else {
handleWorkoutCompletion();
}
}
}, 1000);
}

function handleWorkoutCompletion() {
stopBeats();
clearInterval(timerInterval);

if (totalWorkouts > 0 && totalWorkouts % 2 === 0) {
resetInteractionArea(true);
} else {
loadNextRoutine();
}
}

function removeVibeOverlay() {
stopBeats();
clearInterval(timerInterval);
const overlay = document.getElementById('vibefit-overlay');
if (overlay) overlay.remove();
}

function showCompletionCard() {
removeVibeOverlay();
const compCard = document.createElement('div');
compCard.style.cssText = `
position:fixed; top:20px; left:50%; transform:translateX(-50%); 
background: linear-gradient(135deg, rgba(76, 175, 80, 0.85) 0%, rgba(56, 106, 32, 0.85) 100%); 
color:white; padding:18px 48px; border-radius:100px; font-size:1.2rem; font-weight:800; 
box-shadow: 0 12px 36px rgba(56, 106, 32, 0.3), inset 0 1px 0 rgba(255,255,255,0.4); 
backdrop-filter: blur(10px); z-index:2147483647; letter-spacing:0.5px; 
border: 1px solid rgba(255,255,255,0.35);
`;
compCard.innerHTML = `Coding Complete🎉 | Burned ${totalCalories} Cals!`;
document.body.appendChild(compCard);
setTimeout(() => { compCard.remove(); }, 3500);
}

const observer = new MutationObserver(() => {
const statusMatch = document.body.innerText.match(/Running for\s+(\d+)s/i);
if (statusMatch) {
if (!isRunning) {
isRunning = true;
createVibeOverlay();
}
} else if (isRunning) {
isRunning = false;
showCompletionCard();
}
});
observer.observe(document.body, { childList: true, subtree: true, characterData: true });
