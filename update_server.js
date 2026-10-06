const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { spawn } = require('child_process');
const localtunnel = require('localtunnel');

const PORT = 8080;
const ROOT_DIR = __dirname;
const PRIMARY_SUBDOMAIN = 'cse-d-timetable-ota';
const BACKUP_SUBDOMAIN = 'cse-d-timetable-live';

function getAppVersionInfo() {
  try {
    const vPath = path.join(ROOT_DIR, 'version.json');
    if (fs.existsSync(vPath)) {
      const data = JSON.parse(fs.readFileSync(vPath, 'utf8'));
      return {
        versionName: data.versionName || '6.0.0',
        versionCode: data.versionCode || 76,
        releaseNotes: data.releaseNotes || 'Latest update'
      };
    }
  } catch (e) {}
  return { versionName: '6.0.0', versionCode: 76, releaseNotes: 'Latest update' };
}
const GITHUB_APK_SHARE_URL = 'https://raw.githubusercontent.com/krishnapanday4196-gif/sec-d-timetable/main/SecD_Timetable.apk';
const GOOGLE_DRIVE_SHARE_URL = GITHUB_APK_SHARE_URL;

let currentPublicUrl = `https://${PRIMARY_SUBDOMAIN}.loca.lt`;
let cloudflareDirectUrl = '';

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

function getFileHash(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(data).digest('hex').slice(0, 12);
  } catch (e) {
    return '0';
  }
}

function getApkSizeFormatted(apkPath) {
  try {
    if (fs.existsSync(apkPath)) {
      const bytes = fs.statSync(apkPath).size;
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
  } catch (e) { }
  return '3.22 MB';
}

const exportStore = new Map();

// Helper to format HTTP request logs with color and timing
function logRequest(req, status, durationMs) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const cleanIp = ip.replace(/^.*:/, '');
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const statusColor = status < 400 ? '\x1b[32m' : '\x1b[31m';
  console.log(` \x1b[90m[${time}]\x1b[0m \x1b[36m${req.method.padEnd(4)}\x1b[0m ${req.url.padEnd(28)} ${statusColor}${status}\x1b[0m \x1b[90m(${durationMs}ms - ${cleanIp})\x1b[0m`);
}

function generateUpdateHtml(meta) {
  const { versionName, versionCode, apkSize, lastUpdated, directUrl, apkDirectUrl, htmlHash } = meta;

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>CSE D Timetable — Official Release v${versionName}</title>
  <meta name="description" content="Download the official CSE D Timetable Android APK v${versionName}. Features Daylight Pearl White theme, 5-minute class alarms, and real-time bento schedule.">
  <link rel="icon" type="image/png" href="/icon-192.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
      --radius-2xl: 28px;
      --radius-xl: 22px;
      --radius-lg: 16px;
      --radius-md: 12px;
      --transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* Dark Mode (Midnight Luxe) */
    [data-theme="dark"] {
      --bg-body: #060913;
      --bg-radial: radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.18) 0%, transparent 60%),
                   radial-gradient(circle at 90% 25%, rgba(16, 185, 129, 0.12) 0%, transparent 50%),
                   radial-gradient(circle at 10% 70%, rgba(99, 102, 241, 0.12) 0%, transparent 50%);
      --card-bg: rgba(15, 23, 42, 0.72);
      --card-inner: rgba(30, 41, 59, 0.45);
      --card-border: rgba(255, 255, 255, 0.09);
      --card-border-glow: rgba(56, 189, 248, 0.25);
      --card-hover: rgba(30, 41, 59, 0.75);
      --text-main: #f8fafc;
      --text-sub: #94a3b8;
      --text-muted: #64748b;
      --accent: #38bdf8;
      --accent-grad: linear-gradient(135deg, #38bdf8 0%, #2563eb 50%, #4f46e5 100%);
      --emerald: #10b981;
      --badge-bg: rgba(56, 189, 248, 0.12);
      --badge-border: rgba(56, 189, 248, 0.35);
      --badge-text: #38bdf8;
      --shadow-main: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08);
      --stat-bg: rgba(30, 41, 59, 0.5);
      --stat-border: rgba(255, 255, 255, 0.06);
      --orb-1-color: rgba(56, 189, 248, 0.22);
      --orb-2-color: rgba(168, 85, 247, 0.18);
      --orb-3-color: rgba(16, 185, 129, 0.14);
      --aurora-opacity: 0.65;
    }

    /* Light Mode (Daylight Pearl White) */
    [data-theme="light"] {
      --bg-body: #f8fafc;
      --bg-radial: radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.09) 0%, transparent 60%),
                   radial-gradient(circle at 90% 25%, rgba(16, 185, 129, 0.07) 0%, transparent 50%),
                   radial-gradient(circle at 10% 70%, rgba(99, 102, 241, 0.07) 0%, transparent 50%);
      --card-bg: rgba(255, 255, 255, 0.88);
      --card-inner: rgba(241, 245, 249, 0.85);
      --card-border: rgba(226, 232, 240, 0.95);
      --card-border-glow: rgba(37, 99, 235, 0.22);
      --card-hover: rgba(248, 250, 252, 1);
      --text-main: #0f172a;
      --text-sub: #475569;
      --text-muted: #94a3b8;
      --accent: #2563eb;
      --accent-grad: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      --emerald: #059669;
      --badge-bg: rgba(37, 99, 235, 0.08);
      --badge-border: rgba(37, 99, 235, 0.25);
      --badge-text: #1d4ed8;
      --shadow-main: 0 20px 45px -12px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(226, 232, 240, 0.85);
      --stat-bg: rgba(241, 245, 249, 0.7);
      --stat-border: rgba(226, 232, 240, 0.9);
      --orb-1-color: rgba(37, 99, 235, 0.13);
      --orb-2-color: rgba(139, 92, 246, 0.11);
      --orb-3-color: rgba(16, 185, 129, 0.09);
      --aurora-opacity: 0.55;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

    /* Animated Aurora Mesh Background */
    .aurora-ambient-bg {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      z-index: 0;
      pointer-events: none;
      background-color: var(--bg-body);
      transition: background-color 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .aurora-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(85px);
      -webkit-filter: blur(85px);
      opacity: var(--aurora-opacity, 0.6);
      transform: translate3d(0, 0, 0);
      will-change: transform;
      pointer-events: none;
    }
    .orb-primary {
      width: 400px; height: 400px;
      background: var(--orb-1-color);
      top: -70px; left: -70px;
      animation: auroraFloat1 20s ease-in-out infinite alternate;
    }
    .orb-secondary {
      width: 460px; height: 460px;
      background: var(--orb-2-color);
      top: 30%; right: -90px;
      animation: auroraFloat2 26s ease-in-out infinite alternate;
    }
    .orb-accent {
      width: 380px; height: 380px;
      background: var(--orb-3-color);
      bottom: 8%; left: 10%;
      animation: auroraFloat3 22s ease-in-out infinite alternate;
    }
    @keyframes auroraFloat1 {
      0% { transform: translate3d(0, 0, 0) scale(1); }
      50% { transform: translate3d(85px, 110px, 0) scale(1.16); }
      100% { transform: translate3d(30px, 45px, 0) scale(0.92); }
    }
    @keyframes auroraFloat2 {
      0% { transform: translate3d(0, 0, 0) scale(1); }
      50% { transform: translate3d(-105px, 75px, 0) scale(1.12); }
      100% { transform: translate3d(-35px, -50px, 0) scale(0.94); }
    }
    @keyframes auroraFloat3 {
      0% { transform: translate3d(0, 0, 0) scale(1); }
      50% { transform: translate3d(65px, -75px, 0) scale(1.15); }
      100% { transform: translate3d(-45px, 35px, 0) scale(0.9); }
    }

    /* Silky-smooth theme transition */
    html.theme-animating *, html.theme-animating *::before, html.theme-animating *::after {
      transition: background-color 0.45s cubic-bezier(0.16, 1, 0.3, 1),
                  border-color 0.45s cubic-bezier(0.16, 1, 0.3, 1),
                  color 0.35s ease,
                  box-shadow 0.45s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }

    .theme-btn-spinning {
      animation: themeSpinBounce 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    @keyframes themeSpinBounce {
      0% { transform: scale(0.78) rotate(0deg); }
      55% { transform: scale(1.28) rotate(220deg); }
      80% { transform: scale(0.94) rotate(340deg); }
      100% { transform: scale(1) rotate(360deg); }
    }

    body {
      font-family: var(--font-sans);
      background-color: var(--bg-body);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 24px 16px 48px;
      line-height: 1.5;
      position: relative;
    }

    /* Container */
    .app-container {
      width: 100%;
      max-width: 520px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Top Nav Bar */
    .top-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 4px 2px;
    }
    .brand-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      padding: 6px 14px;
      border-radius: 99px;
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--text-main);
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: var(--emerald);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--emerald);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.25); opacity: 1; box-shadow: 0 0 14px var(--emerald); }
      100% { transform: scale(0.95); opacity: 0.8; }
    }
    .theme-toggle-btn {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 8px 14px;
      border-radius: 99px;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: var(--transition);
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .theme-toggle-btn:hover {
      border-color: var(--accent);
      transform: translateY(-1px);
    }

    /* Main Glass Card */
    .glass-card {
      background: var(--card-bg);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-2xl);
      padding: 32px 24px;
      box-shadow: var(--shadow-main);
      position: relative;
      overflow: hidden;
      transition: var(--transition);
    }
    .glass-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: var(--accent-grad);
      opacity: 0.8;
    }

    /* Hero Header */
    .hero-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .logo-frame {
      position: relative;
      width: 92px;
      height: 92px;
      margin-bottom: 16px;
    }
    .logo-aura {
      position: absolute;
      inset: -6px;
      border-radius: 50%;
      background: var(--accent-grad);
      filter: blur(14px);
      opacity: 0.55;
      animation: spinSlow 12s linear infinite;
    }
    @keyframes spinSlow {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .app-logo {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 24px;
      border: 2px solid var(--card-border);
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      object-fit: cover;
      background: #0f172a;
    }
    .app-title {
      font-size: 1.65rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
      background: linear-gradient(180deg, var(--text-main) 30%, var(--text-sub) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .app-subtitle {
      font-size: 0.88rem;
      color: var(--text-sub);
      font-weight: 500;
      margin-bottom: 14px;
    }
    .version-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--badge-bg);
      border: 1px solid var(--badge-border);
      color: var(--badge-text);
      padding: 5px 14px;
      border-radius: 99px;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      margin-bottom: 22px;
    }

    /* Specs Bento Grid */
    .specs-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      width: 100%;
      margin-bottom: 24px;
    }
    .spec-item {
      background: var(--stat-bg);
      border: 1px solid var(--stat-border);
      border-radius: var(--radius-md);
      padding: 10px 6px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .spec-label {
      font-size: 0.68rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .spec-val {
      font-size: 0.84rem;
      color: var(--text-main);
      font-weight: 700;
      font-family: var(--font-mono);
    }

    /* Primary Download CTA */
    .cta-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }
    .btn-download-primary {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 16px 20px;
      border-radius: var(--radius-xl);
      font-weight: 800;
      box-shadow: 0 12px 30px rgba(16, 185, 129, 0.4);
      transition: var(--transition);
      cursor: pointer;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.25);
    }
    .btn-download-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 36px rgba(16, 185, 129, 0.5);
    }
    .btn-download-primary:active {
      transform: translateY(0);
      box-shadow: 0 6px 18px rgba(16, 185, 129, 0.4);
    }
    .btn-title {
      font-size: 1.1rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-sub {
      font-size: 0.76rem;
      font-weight: 600;
      opacity: 0.9;
      margin-top: 2px;
    }

    /* Secondary Action Bar */
    .quick-actions-bar {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      width: 100%;
    }
    .btn-action {
      background: var(--card-inner);
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 10px 8px;
      border-radius: var(--radius-md);
      font-size: 0.78rem;
      font-weight: 700;
      text-decoration: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      cursor: pointer;
      transition: var(--transition);
    }
    .btn-action:hover {
      background: var(--card-hover);
      border-color: var(--card-border-glow);
      transform: translateY(-1px);
    }
    .btn-action svg {
      width: 18px;
      height: 18px;
    }

    /* Tab Switcher */
    .tab-nav {
      display: flex;
      background: var(--card-inner);
      border: 1px solid var(--card-border);
      border-radius: 99px;
      padding: 4px;
      gap: 4px;
      margin-bottom: 16px;
    }
    .tab-btn {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-sub);
      padding: 8px 12px;
      border-radius: 99px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      transition: var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .tab-btn.active {
      background: var(--card-bg);
      color: var(--text-main);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    /* Features Bento Grid */
    .features-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .feature-card {
      background: var(--card-inner);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: 14px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: var(--transition);
    }
    .feature-card:hover {
      border-color: var(--card-border-glow);
      transform: translateY(-2px);
    }
    .feature-icon-badge {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.15rem;
      background: var(--badge-bg);
      border: 1px solid var(--badge-border);
    }
    .feature-title {
      font-size: 0.86rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .feature-desc {
      font-size: 0.74rem;
      color: var(--text-sub);
      line-height: 1.4;
    }

    /* Install Guide Steps */
    .steps-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: var(--card-inner);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: 14px;
    }
    .step-num {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--accent);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.82rem;
      font-weight: 800;
      flex-shrink: 0;
    }
    .step-content h4 {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 2px;
    }
    .step-content p {
      font-size: 0.76rem;
      color: var(--text-sub);
      line-height: 1.4;
    }

    /* QR Code Card */
    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: var(--card-inner);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-xl);
      text-align: center;
      gap: 14px;
    }
    .qr-box {
      background: #ffffff;
      padding: 14px;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      border: 1px solid rgba(0,0,0,0.1);
    }
    .qr-box img {
      display: block;
      width: 170px;
      height: 170px;
      border-radius: 8px;
    }
    .qr-hint {
      font-size: 0.8rem;
      color: var(--text-sub);
      max-width: 280px;
    }

    /* Toast Notification */
    .toast-msg {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #0f172a;
      color: #ffffff;
      border: 1px solid rgba(56, 189, 248, 0.4);
      padding: 12px 22px;
      border-radius: 99px;
      font-size: 0.84rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 16px 36px rgba(0,0,0,0.4);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
      z-index: 1000;
    }
    .toast-msg.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
      pointer-events: auto;
    }

    /* Footer Info */
    .server-footer {
      text-align: center;
      font-size: 0.74rem;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 4px;
    }
    .server-footer a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }

    @media (max-width: 480px) {
      .features-grid { grid-template-columns: 1fr; }
      .specs-grid { grid-template-columns: repeat(2, 1fr); gap: 6px; }
      .glass-card { padding: 24px 18px; }
    }
  </style>
</head>
<body>

  <!-- DYNAMIC ANIMATED AURORA THEME CANVAS -->
  <div class="aurora-ambient-bg" aria-hidden="true">
    <div class="aurora-orb orb-primary"></div>
    <div class="aurora-orb orb-secondary"></div>
    <div class="aurora-orb orb-accent"></div>
  </div>

  <div class="app-container">
    <!-- Top Bar -->
    <header class="top-nav">
      <div class="brand-pill">
        <span class="status-dot"></span>
        <span>OTA Hub Active</span>
      </div>
      <button class="theme-toggle-btn" id="themeToggleBtn" onclick="toggleTheme()">
        <span id="themeIcon">☀️</span>
        <span id="themeLabel">Light</span>
      </button>
    </header>

    <!-- Main Hero Card -->
    <main class="glass-card">
      <div class="hero-header">
        <div class="logo-frame">
          <div class="logo-aura"></div>
          <img src="/icon-192.png" alt="CSE D Icon" class="app-logo" onerror="this.src='/logo.png'">
        </div>
        <h1 class="app-title">CSE D Timetable</h1>
        <p class="app-subtitle">Section D • Department of Computer Science &amp; Engineering</p>
        
        <div class="version-badge">
          <span>✨ Pro v${versionName}</span>
          <span style="opacity:0.5">•</span>
          <span>Build ${versionCode}</span>
        </div>
      </div>

      <!-- Specs Grid -->
      <div class="specs-grid">
        <div class="spec-item">
          <span class="spec-label">Package</span>
          <span class="spec-val">${apkSize}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Target OS</span>
          <span class="spec-val">Android 8+</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">OTA Sync</span>
          <span class="spec-val" style="color:var(--emerald);">Enabled</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Integrity</span>
          <span class="spec-val">${htmlHash.slice(0, 6).toUpperCase()}</span>
        </div>
      </div>

      <!-- Primary Download CTA -->
      <div class="cta-container">
        <a href="/CSE_D_Timetable.apk" download="CSE_D_Timetable.apk" class="btn-download-primary" id="downloadApkBtn" onclick="handleDownloadClick()">
          <span class="btn-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download APK (v${versionName})
          </span>
          <span class="btn-sub">Direct High-Speed APK • Instant 1-Tap Install</span>
        </a>

        <!-- Quick Secondary Actions -->
        <div class="quick-actions-bar">
          <button class="btn-action" onclick="copyShareLink()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy Link</span>
          </button>
          <a class="btn-action" href="https://api.whatsapp.com/send?text=${encodeURIComponent('🎓 *Download CSE D Timetable App Pro (B.Tech CSE Sec-D)*\n\n📲 *Direct GitHub Download Link (24/7 Fast Download):*\n' + GITHUB_APK_SHARE_URL)}" target="_blank">
            <svg viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            <span>WhatsApp</span>
          </a>
          <a class="btn-action" href="${GITHUB_APK_SHARE_URL}" target="_blank">
            <svg viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
            <span>GitHub</span>
          </a>
          <a class="btn-action" href="/index.html">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <span>Web App</span>
          </a>
        </div>
      </div>

      <!-- Tab Navigator -->
      <nav class="tab-nav">
        <button class="tab-btn active" id="tabBtnFeatures" onclick="switchTab('features')">✨ What's New</button>
        <button class="tab-btn" id="tabBtnInstall" onclick="switchTab('install')">📋 How to Install</button>
        <button class="tab-btn" id="tabBtnQr" onclick="switchTab('qr')">📲 QR Scan</button>
      </nav>

      <!-- Tab Content: Features -->
      <div id="tabContentFeatures" class="tab-pane">
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon-badge">💎</div>
            <div class="feature-title">Daylight Pearl Theme</div>
            <div class="feature-desc">Apple &amp; Linear inspired crisp light mode with zero eye fatigue in bright classrooms.</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon-badge">🔔</div>
            <div class="feature-title">5-Min Class Alarms</div>
            <div class="feature-desc">Background phone notifications 5 min prior to every lecture with room &amp; faculty info.</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon-badge">📚</div>
            <div class="feature-title">Notification Library</div>
            <div class="feature-desc">All past 5-minute class reminders &amp; schedule alerts are saved in a permanent archive with 1-tap timetable jump.</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon-badge">🅰️</div>
            <div class="feature-title">Batch Isolation</div>
            <div class="feature-desc">1-Tap toggle for Set-A, Set-B, or Combined lectures and lab practicals.</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon-badge">⚡</div>
            <div class="feature-title">Live Orbit Stepper</div>
            <div class="feature-desc">Circular countdown ring &amp; 8-period status highlights in 60fps bento layout.</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon-badge">📅</div>
            <div class="feature-title">Calendar Sync</div>
            <div class="feature-desc">1-Click export to Google Calendar, Apple Calendar, and Outlook (.ICS).</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon-badge">🔄</div>
            <div class="feature-title">Wireless OTA Hub</div>
            <div class="feature-desc">Instant schedule updates inside the app without needing to reinstall the APK.</div>
          </div>
        </div>
      </div>

      <!-- Tab Content: Install Guide -->
      <div id="tabContentInstall" class="tab-pane" style="display:none;">
        <div class="steps-container">
          <div class="step-item">
            <div class="step-num">1</div>
            <div class="step-content">
              <h4>Download APK</h4>
              <p>Tap the green download button above. If Chrome warns "File might be harmful", tap <b>Download anyway</b>.</p>
            </div>
          </div>
          <div class="step-item">
            <div class="step-num">2</div>
            <div class="step-content">
              <h4>Allow Install</h4>
              <p>Open the downloaded file. If prompted with "Install unknown apps", switch toggle to <b>Allow from this source</b>.</p>
            </div>
          </div>
          <div class="step-item">
            <div class="step-num">3</div>
            <div class="step-content">
              <h4>Tap Update / Install</h4>
              <p>Tap <b>Update</b>. Your timetable, batch settings, and class alarm preferences are 100% saved!</p>
            </div>
          </div>
          <div class="step-item" style="border-left: 3px solid #f59e0b; background: rgba(245, 158, 11, 0.08);">
            <div class="step-num" style="background: #f59e0b; color: #000;">⚠️</div>
            <div class="step-content">
              <h4 style="color: #f59e0b;">"Package appears to be invalid" Fix</h4>
              <p>1. <b>File Size:</b> Downloads me check karein file <b>${apkSize}</b> honi chahiye (agar 2 KB hai toh wo incomplete web page hai).<br>
                 2. <b>Old App:</b> Agar phone me purana app hai, pehle use <b>Uninstall</b> karein.<br>
                 3. <b>Play Protect:</b> Popup par <b>More details &rarr; Install anyway</b> tap karein.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Content: QR Scan -->
      <div id="tabContentQr" class="tab-pane" style="display:none;">
        <div class="qr-container">
          <div style="display:flex; background:var(--card-inner); border:1px solid var(--card-border); border-radius:99px; padding:3px; gap:4px; margin-bottom:4px; max-width:300px; width:100%;">
            <button id="qrModeDirectBtn" type="button" class="tab-btn active" style="font-size:0.75rem; padding:6px 12px; border-radius:99px;" onclick="setQrMode('direct')">⚡ Direct Server</button>
            <button id="qrModeDriveBtn" type="button" class="tab-btn" style="font-size:0.75rem; padding:6px 12px; border-radius:99px;" onclick="setQrMode('drive')">☁️ Google Drive</button>
          </div>
          <div class="qr-box">
            <img id="qrCodeImg" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(directUrl)}" alt="Scan to Download APK">
          </div>
          <p class="qr-hint" id="qrHintText">Scan with Mobile Camera or Google Lens to directly download full <b>${apkSize}</b> APK without warnings.</p>
          <div id="qrDriveWarning" style="display:none; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); border-radius:12px; padding:10px 14px; font-size:0.74rem; color:#f59e0b; text-align:left; max-width:300px; line-height:1.4;">
            ⚠️ <b>Google Drive Tip:</b> Drive page khulne par <b>"Download anyway"</b> zaroor dabayein. Agar click nahi kiya toh sirf 2KB ki corrupt file download hoti hai aur Android <i>"package appears to be invalid"</i> error deta hai.
          </div>
        </div>
      </div>

    </main>

    <!-- Footer -->
    <footer class="server-footer">
      <div>CSE-D Timetable Engine v${versionName} • Build ${versionCode}</div>
      <div>Zero-Lag Direct Server • <a href="/version.json">View version.json</a></div>
    </footer>
  </div>

  <!-- Toast Element -->
  <div class="toast-msg" id="toastMsg">
    <span>✅</span>
    <span id="toastText">Download link copied!</span>
  </div>

  <script>
    // Theme Management
    function initTheme() {
      const saved = localStorage.getItem('secD_update_theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      applyTheme(saved);
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('secD_update_theme', theme);
      const icon = document.getElementById('themeIcon');
      const label = document.getElementById('themeLabel');
      if (theme === 'light') {
        icon.textContent = '🌙';
        label.textContent = 'Dark';
      } else {
        icon.textContent = '☀️';
        label.textContent = 'Light';
      }
    }

    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';

      const btn = document.getElementById('themeToggleBtn');
      if (btn) {
        btn.classList.remove('theme-btn-spinning');
        void btn.offsetWidth;
        btn.classList.add('theme-btn-spinning');
        setTimeout(() => btn.classList.remove('theme-btn-spinning'), 600);
      }

      document.documentElement.classList.add('theme-animating');
      applyTheme(next);
      setTimeout(() => {
        document.documentElement.classList.remove('theme-animating');
      }, 500);
    }

    // Tab Navigation
    function switchTab(tab) {
      ['features', 'install', 'qr'].forEach(t => {
        const pane = document.getElementById('tabContent' + t.charAt(0).toUpperCase() + t.slice(1));
        const btn = document.getElementById('tabBtn' + t.charAt(0).toUpperCase() + t.slice(1));
        if (pane && btn) {
          if (t === tab) {
            pane.style.display = 'block';
            btn.classList.add('active');
          } else {
            pane.style.display = 'none';
            btn.classList.remove('active');
          }
        }
      });
    }

    // Toast
    function showToast(text) {
      const toast = document.getElementById('toastMsg');
      const label = document.getElementById('toastText');
      if (!toast || !label) return;
      label.textContent = text;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2600);
    }

    // Copy Link (GitHub Direct Download Link)
    function copyShareLink() {
      const url = '${GITHUB_APK_SHARE_URL}';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => showToast('GitHub download link copied! 📋'));
      } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('GitHub download link copied! 📋');
      }
    }

    // QR Mode Switcher
    const QR_DIRECT_URL = '${directUrl}';
    const QR_DRIVE_URL = '${GITHUB_APK_SHARE_URL}';

    function setQrMode(mode) {
      const img = document.getElementById('qrCodeImg');
      const hint = document.getElementById('qrHintText');
      const warn = document.getElementById('qrDriveWarning');
      const btnDirect = document.getElementById('qrModeDirectBtn');
      const btnDrive = document.getElementById('qrModeDriveBtn');
      if (mode === 'drive') {
        if (img) img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(QR_DRIVE_URL);
        if (hint) hint.innerHTML = 'Scan to download directly from 24/7 GitHub High-Speed CDN.';
        if (warn) warn.style.display = 'none';
        if (btnDrive) btnDrive.classList.add('active');
        if (btnDirect) btnDirect.classList.remove('active');
      } else {
        if (img) img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(QR_DIRECT_URL);
        if (hint) hint.innerHTML = 'Scan with Mobile Camera or Google Lens to directly download full <b>${apkSize}</b> APK without warnings.';
        if (warn) warn.style.display = 'none';
        if (btnDirect) btnDirect.classList.add('active');
        if (btnDrive) btnDrive.classList.remove('active');
      }
    }

    initTheme();
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const startTime = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  res.on('finish', () => {
    logRequest(req, res.statusCode, Date.now() - startTime);
  });

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];

  if (urlPath === '/store-export' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { fileName, content, mimeType } = JSON.parse(body);
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        exportStore.set(id, { fileName, content, mimeType });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ downloadUrl: `/download-export?id=${id}&file=${encodeURIComponent(fileName)}` }));
      } catch (e) {
        res.writeHead(400);
        res.end('Invalid payload');
      }
    });
    return;
  }

  if (urlPath === '/download-export') {
    const query = new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams;
    const id = query.get('id');
    const entry = exportStore.get(id);
    if (entry) {
      res.writeHead(200, {
        'Content-Type': `${entry.mimeType || 'text/csv'}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${entry.fileName.replace(/"/g, '')}"`
      });
      res.end(entry.content);
      return;
    }
    res.writeHead(404);
    res.end('Export file expired or not found');
    return;
  }

  const CANCELLED_FILE = path.join(ROOT_DIR, 'cancelled_classes.json');

  if (urlPath === '/api/cancelled-classes') {
    if (req.method === 'GET') {
      try {
        const data = fs.existsSync(CANCELLED_FILE) ? fs.readFileSync(CANCELLED_FILE, 'utf8') : '{"cancellations":[]}';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message, cancellations: [] }));
      }
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          let current = { cancellations: [] };
          if (fs.existsSync(CANCELLED_FILE)) {
            try { current = JSON.parse(fs.readFileSync(CANCELLED_FILE, 'utf8')); } catch (e) {}
          }
          if (!Array.isArray(current.cancellations)) current.cancellations = [];

          if (payload.action === 'cancel' && payload.data) {
            const d = payload.data;
            // Remove existing duplicate for same section, date, period, batch
            current.cancellations = current.cancellations.filter(c => 
              !(c.section === d.section && c.date === d.date && c.period === d.period && (c.batch === d.batch || d.batch === 'ALL' || c.batch === 'ALL'))
            );
            current.cancellations.unshift(d);
          } else if (payload.action === 'restore') {
            const id = payload.id;
            current.cancellations = current.cancellations.filter(c => 
              c.id !== id && !(c.section === payload.section && c.date === payload.date && c.period === payload.period)
            );
          } else if (Array.isArray(payload.cancellations)) {
            current.cancellations = payload.cancellations;
          }

          current.updatedAt = Date.now();
          fs.writeFileSync(CANCELLED_FILE, JSON.stringify(current, null, 2), 'utf8');
          console.log(` \x1b[32m✔\x1b[0m [CLASS CANCEL SYNC] Updated cancellations count: ${current.cancellations.length}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, cancellations: current.cancellations, updatedAt: current.updatedAt }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid payload: ' + e.message }));
        }
      });
      return;
    }
  }

  const htmlPath = path.join(ROOT_DIR, 'index.html');
  const apkPath = path.join(ROOT_DIR, 'CSE_D_Timetable.apk');
  const htmlHash = getFileHash(htmlPath);
  const apkHash = getFileHash(apkPath);
  const apkSize = getApkSizeFormatted(apkPath);
  const bestPublicUrl = cloudflareDirectUrl || currentPublicUrl;

  if (urlPath === '/version.json') {
    let mtime = Date.now();
    try {
      mtime = fs.statSync(htmlPath).mtimeMs;
    } catch (e) { }

    const verInfo = getAppVersionInfo();
    const payload = {
      versionName: verInfo.versionName,
      versionCode: verInfo.versionCode,
      apkVersionCode: verInfo.versionCode,
      htmlHash,
      apkHash,
      apkSize,
      updatedAt: mtime,
      publicUrl: bestPublicUrl,
      cloudflareUrl: cloudflareDirectUrl,
      localtunnelUrl: currentPublicUrl,
      apkUrl: '/CSE_D_Timetable.apk',
      htmlUrl: '/index.html',
      downloadUrl: '/update',
      releaseNotes: verInfo.releaseNotes
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload, null, 2));
    return;
  }

  if (urlPath === '/update' || urlPath === '/download') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const directUrl = `${bestPublicUrl}/update`;
    const apkDirectUrl = `${bestPublicUrl}/CSE_D_Timetable.apk`;
    const verInfo = getAppVersionInfo();
    res.end(generateUpdateHtml({
      versionName: verInfo.versionName,
      versionCode: verInfo.versionCode,
      apkSize,
      lastUpdated: new Date().toLocaleDateString(),
      directUrl,
      apkDirectUrl,
      htmlHash
    }));
    return;
  }

  let filePath = path.join(ROOT_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.csv': 'text/csv; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.apk': 'application/vnd.android.package-archive'
  };

  const headers = {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Content-Length': fs.statSync(filePath).size
  };
  if (ext === '.apk') {
    headers['Content-Disposition'] = 'attachment; filename="CSE_D_Timetable.apk"';
  }

  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
});

function startCloudflareTunnel() {
  const cfExe = path.join(ROOT_DIR, 'cloudflared.exe');
  if (!fs.existsSync(cfExe)) return;

  const cf = spawn(cfExe, ['tunnel', '--url', `http://127.0.0.1:${PORT}`]);
  const handleOutput = (data) => {
    const str = data.toString();
    const match = str.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/i);
    if (match && !cloudflareDirectUrl) {
      cloudflareDirectUrl = match[0];
      console.log('\x1b[35m' + '┌────────────────────────────────────────────────────────────┐' + '\x1b[0m');
      console.log(`\x1b[35m│\x1b[0m \x1b[1m\x1b[32m🚀 CLOUDFLARE DIRECT UPDATE\x1b[0m : \x1b[36m${cloudflareDirectUrl}/update\x1b[0m`);
      console.log(`\x1b[35m│\x1b[0m \x1b[1m\x1b[32m📦 DIRECT APK DOWNLOAD     \x1b[0m : \x1b[36m${cloudflareDirectUrl}/CSE_D_Timetable.apk\x1b[0m`);
      console.log('\x1b[35m' + '└────────────────────────────────────────────────────────────┘' + '\x1b[0m');
    }
  };
  cf.stdout.on('data', handleOutput);
  cf.stderr.on('data', handleOutput);
  cf.on('close', () => {
    cloudflareDirectUrl = '';
    setTimeout(startCloudflareTunnel, 3000);
  });
}

async function startPublicTunnel(subdomain) {
  try {
    const tunnel = await localtunnel({ port: PORT, subdomain, local_host: '127.0.0.1' });
    if (subdomain === PRIMARY_SUBDOMAIN || !currentPublicUrl) {
      currentPublicUrl = tunnel.url;
    }
    console.log(` \x1b[32m✔\x1b[0m OTA Tunnel Connected : \x1b[36m${tunnel.url}\x1b[0m`);

    tunnel.on('close', () => {
      setTimeout(() => startPublicTunnel(subdomain), 3000);
    });
    tunnel.on('error', () => {
      try { tunnel.close(); } catch (e) { }
    });
  } catch (err) {
    setTimeout(() => startPublicTunnel(subdomain), 5000);
  }
}

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('\x1b[36m' + '╔════════════════════════════════════════════════════════════╗' + '\x1b[0m');
  console.log('\x1b[36m║\x1b[0m   \x1b[1m\x1b[37mCSE D Timetable — Ultra-Premium Update & OTA Server\x1b[0m      \x1b[36m║\x1b[0m');
  console.log('\x1b[36m║\x1b[0m   Version \x1b[32m4.6.0 (Build 18)\x1b[0m • Port \x1b[33m8080\x1b[0m                        \x1b[36m║\x1b[0m');
  console.log('\x1b[36m╚════════════════════════════════════════════════════════════╝' + '\x1b[0m');
  ips.forEach(ip => {
    console.log(` \x1b[33m📶 [LOCAL WI-FI]\x1b[0m Update Page : \x1b[36mhttp://${ip}:${PORT}/update\x1b[0m`);
  });
  startCloudflareTunnel();
  startPublicTunnel(PRIMARY_SUBDOMAIN);
  startPublicTunnel(BACKUP_SUBDOMAIN);
});
