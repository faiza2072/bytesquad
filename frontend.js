/* ═══════════════════════════════════════════════════════════
   REIMS — Rural Education Impact & Monitoring System
   Frontend Application
═══════════════════════════════════════════════════════════ */

const API = 'http://127.0.0.1:5000/api';

// ── Chart instances (kept so we can destroy before redraw) ──
const charts = {};

// ── Cached data ──
let schoolsCache = [];
let insightsCache = [];
let riskCache = [];

// ══════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════
function showLoading() { document.getElementById('loadingOverlay').classList.add('show'); }
function hideLoading() { document.getElementById('loadingOverlay').classList.remove('show'); }

function setLastUpdated() {
  document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function riskColor(label) {
  return { Critical: '#f85149', High: '#f0883e', Medium: '#e3b341', Low: '#3fb950' }[label] || '#8b949e';
}

function engagementColor(score) {
  if (score >= 70) return '#3fb950';
  if (score >= 50) return '#e3b341';
  return '#f85149';
}

// ══════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════
const pageTitles = {
  dashboard:    'Dashboard Overview',
  schools:      'School Directory',
  'ai-insights':'AI Insights Panel',
  partnerships: 'Partnership Simulation',
  'risk-alerts':'Risk Alert System',
  regions:      'Regional Overview',
};

function navigate(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const sec = document.getElementById(`section-${sectionId}`);
  if (sec) sec.classList.add('active');

  const nav = document.querySelector(`[data-section="${sectionId}"]`);
  if (nav) nav.classList.add('active');

  document.getElementById('pageTitle').textContent = pageTitles[sectionId] || '';

  // Lazy-load section data
  if (sectionId === 'schools')      renderSchools();
  if (sectionId === 'ai-insights')  renderInsights();
  if (sectionId === 'partnerships') renderPartnerships();
  if (sectionId === 'risk-alerts')  renderRiskAlerts();
  if (sectionId === 'regions')      renderRegions();

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
}

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
async function loadDashboard() {
  showLoading();
  try {
    const [summary, schools, risk] = await Promise.all([
      fetchJSON(`${API}/dashboard/summary`),
      fetchJSON(`${API}/schools`),
      fetchJSON(`${API}/ai/dropout-risk`),
    ]);
    schoolsCache = schools;
    riskCache    = risk;

    // KPI cards
    document.getElementById('kpi-schools').textContent    = summary.total_schools;
    document.getElementById('kpi-students').textContent   = summary.total_students.toLocaleString();
    document.getElementById('kpi-attendance').textContent = summary.avg_attendance + '%';
    document.getElementById('kpi-dropout').textContent    = summary.avg_dropout_rate + '%';
    document.getElementById('kpi-ngo').textContent        = summary.avg_ngo_support + '/10';
    document.getElementById('kpi-internet').textContent   = summary.internet_enabled_schools;

    drawAttendanceChart(schools);
    drawRiskDonut(summary.risk_distribution);
    drawResourceBar(schools);
    drawTeacherChart(schools);
    drawPartnershipRadar(schools);

    setLastUpdated();
  } catch (e) {
    console.error('Dashboard load error:', e);
  } finally {
    hideLoading();
  }
}

// ── Attendance Trends ──
function drawAttendanceChart(schools) {
  destroyChart('attendance');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const colors = ['#58a6ff','#3fb950','#f0883e','#bc8cff','#f85149','#e3b341','#39d353','#79c0ff'];

  const datasets = schools.slice(0, 5).map((s, i) => ({
    label: s.school_name.split(' ')[0],
    data: s.monthly_attendance,
    borderColor: colors[i],
    backgroundColor: colors[i] + '22',
    borderWidth: 2,
    pointRadius: 3,
    tension: 0.4,
    fill: false,
  }));

  const ctx = document.getElementById('attendanceChart').getContext('2d');
  charts['attendance'] = new Chart(ctx, {
    type: 'line',
    data: { labels: months, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b949e', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e', callback: v => v + '%' }, grid: { color: '#21262d' }, min: 30, max: 100 },
      },
    },
  });
}

// ── Risk Donut ──
function drawRiskDonut(dist) {
  destroyChart('riskDonut');
  const ctx = document.getElementById('riskDonut').getContext('2d');
  charts['riskDonut'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Critical', 'High', 'Medium', 'Low'],
      datasets: [{
        data: [dist.Critical, dist.High, dist.Medium, dist.Low],
        backgroundColor: ['#f85149','#f0883e','#e3b341','#3fb950'],
        borderColor: '#161b22',
        borderWidth: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8b949e', padding: 12, font: { size: 11 } } },
      },
    },
  });
}

// ── Resource Bar ──
function drawResourceBar(schools) {
  destroyChart('resourceBar');
  const ctx = document.getElementById('resourceBar').getContext('2d');
  charts['resourceBar'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: schools.map(s => s.school_name.split(' ')[0]),
      datasets: [
        { label: 'Infrastructure', data: schools.map(s => s.infrastructure_score), backgroundColor: '#58a6ff99', borderColor: '#58a6ff', borderWidth: 1 },
        { label: 'Books', data: schools.map(s => s.books_availability), backgroundColor: '#3fb95099', borderColor: '#3fb950', borderWidth: 1 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b949e', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, max: 100 },
      },
    },
  });
}

// ── Teacher Chart ──
function drawTeacherChart(schools) {
  destroyChart('teacherChart');
  const ctx = document.getElementById('teacherChart').getContext('2d');
  const ratios = schools.map(s => Math.round(s.students / Math.max(s.teacher_count, 1)));
  const colors = ratios.map(r => r > 60 ? '#f85149' : r > 40 ? '#f0883e' : '#3fb950');

  charts['teacherChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: schools.map(s => s.school_name.split(' ')[0]),
      datasets: [{
        label: 'Students per Teacher',
        data: ratios,
        backgroundColor: colors,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
      },
    },
  });
}

// ── Partnership Radar ──
function drawPartnershipRadar(schools) {
  destroyChart('partnershipRadar');
  const avg = key => Math.round(schools.reduce((a, s) => a + s[key], 0) / schools.length);
  const ctx = document.getElementById('partnershipRadar').getContext('2d');

  charts['partnershipRadar'] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Govt Partnership', 'NGO Partnership', 'School Partnership', 'Community', 'Infrastructure'],
      datasets: [{
        label: 'Avg Score',
        data: [
          avg('govt_partnership'), avg('ngo_partnership'), avg('school_partnership'),
          avg('community_participation'), avg('infrastructure_score'),
        ],
        backgroundColor: 'rgba(88,166,255,0.2)',
        borderColor: '#58a6ff',
        pointBackgroundColor: '#58a6ff',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          ticks: { color: '#8b949e', backdropColor: 'transparent', font: { size: 9 } },
          grid: { color: '#21262d' },
          pointLabels: { color: '#8b949e', font: { size: 10 } },
          min: 0, max: 100,
        },
      },
    },
  });
}

// ══════════════════════════════════════════════════════════
// SCHOOLS SECTION
// ══════════════════════════════════════════════════════════
function computeRisk(s) {
  let score = 0;
  const att = s.attendance_rate;
  if (att < 50) score += 35; else if (att < 65) score += 20; else if (att < 75) score += 10;
  const ratio = s.students / Math.max(s.teacher_count, 1);
  if (ratio > 60) score += 20; else if (ratio > 40) score += 12; else if (ratio > 25) score += 6;
  if (s.ngo_support_level <= 2) score += 15; else if (s.ngo_support_level <= 5) score += 8;
  if (s.funding_status === 'none') score += 15; else if (s.funding_status === 'partial') score += 8;
  if (s.infrastructure_score < 35) score += 10; else if (s.infrastructure_score < 55) score += 5;
  if (s.community_participation < 30) score += 5; else if (s.community_participation < 50) score += 2;
  return Math.min(score, 100);
}

function riskLabel(score) {
  if (score >= 65) return 'Critical';
  if (score >= 40) return 'High';
  if (score >= 20) return 'Medium';
  return 'Low';
}

function engagementScore(s) {
  return Math.round(
    s.attendance_rate * 0.30 +
    s.community_participation * 0.20 +
    (s.ngo_support_level * 10) * 0.15 +
    s.infrastructure_score * 0.20 +
    s.books_availability * 0.15
  );
}

function renderSchools() {
  const grid = document.getElementById('schoolsGrid');
  const regionSel = document.getElementById('regionFilter');
  const riskSel   = document.getElementById('riskFilter');

  // Populate region filter once
  if (regionSel.options.length === 1 && schoolsCache.length) {
    const regions = [...new Set(schoolsCache.map(s => s.region))];
    regions.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r; opt.textContent = r;
      regionSel.appendChild(opt);
    });
  }

  const regionVal = regionSel.value;
  const riskVal   = riskSel.value;

  let filtered = schoolsCache.filter(s => {
    const risk = riskLabel(computeRisk(s));
    return (!regionVal || s.region === regionVal) && (!riskVal || risk === riskVal);
  });

  grid.innerHTML = filtered.map(s => {
    const risk  = riskLabel(computeRisk(s));
    const score = computeRisk(s);
    const eng   = engagementScore(s);
    const attColor = s.attendance_rate >= 75 ? '#3fb950' : s.attendance_rate >= 60 ? '#e3b341' : '#f85149';
    return `
      <div class="school-card risk-${risk}" onclick="openSchoolModal('${s.school_id}')">
        <div class="school-card-header">
          <div>
            <div class="school-name">${s.school_name}</div>
            <div class="school-region">📍 ${s.region}</div>
          </div>
          <span class="risk-badge ${risk}">${risk}</span>
        </div>
        <div class="school-metrics">
          <div class="metric-item">
            <span class="metric-label">Students</span>
            <span class="metric-value" style="color:#58a6ff">${s.students}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Teachers</span>
            <span class="metric-value" style="color:#3fb950">${s.teacher_count}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Dropout Rate</span>
            <span class="metric-value" style="color:#f85149">${s.dropout_rate}%</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">NGO Support</span>
            <span class="metric-value" style="color:#bc8cff">${s.ngo_support_level}/10</span>
          </div>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-label">
            <span>Attendance</span><span style="color:${attColor}">${s.attendance_rate}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${s.attendance_rate}%;background:${attColor}"></div>
          </div>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-label">
            <span>Engagement</span><span style="color:${engagementColor(eng)}">${eng}/100</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${eng}%;background:${engagementColor(eng)}"></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── School Modal ──
async function openSchoolModal(schoolId) {
  const s = schoolsCache.find(x => x.school_id === schoolId);
  if (!s) return;

  const risk  = riskLabel(computeRisk(s));
  const score = computeRisk(s);
  const eng   = engagementScore(s);
  const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];

  document.getElementById('modalContent').innerHTML = `
    <div class="modal-title">${s.school_name} <span class="risk-badge ${risk}" style="font-size:13px">${risk} Risk</span></div>
    <div class="modal-region">📍 ${s.region} &nbsp;|&nbsp; ID: ${s.school_id} &nbsp;|&nbsp; Funding: <b>${s.funding_status}</b> &nbsp;|&nbsp; Internet: ${s.internet_access ? '✅' : '❌'}</div>
    <div class="modal-grid">
      <div class="modal-metric"><div class="modal-metric-label">Students</div><div class="modal-metric-value" style="color:#58a6ff">${s.students}</div></div>
      <div class="modal-metric"><div class="modal-metric-label">Teachers</div><div class="modal-metric-value" style="color:#3fb950">${s.teacher_count}</div></div>
      <div class="modal-metric"><div class="modal-metric-label">Attendance Rate</div><div class="modal-metric-value" style="color:#f0883e">${s.attendance_rate}%</div></div>
      <div class="modal-metric"><div class="modal-metric-label">Dropout Rate</div><div class="modal-metric-value" style="color:#f85149">${s.dropout_rate}%</div></div>
      <div class="modal-metric"><div class="modal-metric-label">Dropout Risk Score</div><div class="modal-metric-value" style="color:${riskColor(risk)}">${score}/100</div></div>
      <div class="modal-metric"><div class="modal-metric-label">Engagement Score</div><div class="modal-metric-value" style="color:${engagementColor(eng)}">${eng}/100</div></div>
      <div class="modal-metric"><div class="modal-metric-label">Infrastructure</div><div class="modal-metric-value" style="color:#bc8cff">${s.infrastructure_score}/100</div></div>
      <div class="modal-metric"><div class="modal-metric-label">NGO Support</div><div class="modal-metric-value" style="color:#39d353">${s.ngo_support_level}/10</div></div>
    </div>
    <div class="chart-header"><h3>📈 Monthly Attendance & Performance</h3></div>
    <div class="modal-chart-wrap"><canvas id="modalChart"></canvas></div>
  `;

  document.getElementById('modalOverlay').classList.add('open');

  setTimeout(() => {
    destroyChart('modalChart');
    const ctx = document.getElementById('modalChart').getContext('2d');
    charts['modalChart'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          { label: 'Attendance %', data: s.monthly_attendance, borderColor: '#58a6ff', backgroundColor: '#58a6ff22', tension: 0.4, fill: true, borderWidth: 2, pointRadius: 3 },
          { label: 'Performance %', data: s.monthly_performance, borderColor: '#3fb950', backgroundColor: '#3fb95022', tension: 0.4, fill: true, borderWidth: 2, pointRadius: 3 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#8b949e', font: { size: 11 } } } },
        scales: {
          x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
          y: { ticks: { color: '#8b949e', callback: v => v + '%' }, grid: { color: '#21262d' } },
        },
      },
    });
  }, 50);
}

// ══════════════════════════════════════════════════════════
// AI INSIGHTS SECTION
// ══════════════════════════════════════════════════════════
async function renderInsights() {
  if (!insightsCache.length) {
    try {
      const data = await fetchJSON(`${API}/ai/insights`);
      insightsCache = data.insights;
      document.getElementById('insight-badge').textContent = data.total;
    } catch (e) {
      insightsCache = generateLocalInsights();
    }
  }

  const counts = { critical: 0, warning: 0, weak_zone: 0, info: 0 };
  insightsCache.forEach(i => { if (counts[i.type] !== undefined) counts[i.type]++; });

  document.getElementById('insightsSummary').innerHTML = `
    <div class="insight-stat"><div class="insight-stat-value" style="color:#f85149">${counts.critical}</div><div class="insight-stat-label">Critical Alerts</div></div>
    <div class="insight-stat"><div class="insight-stat-value" style="color:#f0883e">${counts.warning}</div><div class="insight-stat-label">Warnings</div></div>
    <div class="insight-stat"><div class="insight-stat-value" style="color:#bc8cff">${counts.weak_zone}</div><div class="insight-stat-label">Weak Zones</div></div>
    <div class="insight-stat"><div class="insight-stat-value" style="color:#58a6ff">${counts.info}</div><div class="insight-stat-label">Info Notices</div></div>
    <div class="insight-stat"><div class="insight-stat-value" style="color:#3fb950">${insightsCache.length}</div><div class="insight-stat-label">Total Insights</div></div>
  `;

  document.getElementById('insightsList').innerHTML = insightsCache.map(i => `
    <div class="insight-item ${i.type}">
      <div class="insight-icon">${i.icon}</div>
      <div class="insight-body">
        <div class="insight-message">${i.message}</div>
        <div class="insight-meta">
          <span class="insight-tag">📍 ${i.region}</span>
          <span class="insight-metric">${i.metric}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// Local fallback if backend is offline
function generateLocalInsights() {
  const insights = [];
  schoolsCache.forEach(s => {
    const score = computeRisk(s);
    const eng   = engagementScore(s);
    const label = riskLabel(score);
    if (label === 'Critical') insights.push({ type: 'critical', icon: '🚨', school: s.school_name, region: s.region, message: `${s.school_name} is at CRITICAL dropout risk (score: ${score}). Immediate intervention required.`, metric: `Dropout Risk: ${score}%` });
    else if (label === 'High') insights.push({ type: 'warning', icon: '⚠️', school: s.school_name, region: s.region, message: `${s.school_name} shows HIGH dropout risk. Attendance at ${s.attendance_rate}% needs attention.`, metric: `Dropout Risk: ${score}%` });
    if (eng < 40) insights.push({ type: 'weak_zone', icon: '📉', school: s.school_name, region: s.region, message: `Weak engagement zone detected at ${s.school_name} in ${s.region}. Engagement score: ${eng}.`, metric: `Engagement: ${eng}/100` });
    if (s.ngo_support_level <= 2) insights.push({ type: 'info', icon: '🤝', school: s.school_name, region: s.region, message: `NGO involvement is critically low at ${s.school_name}. Support level: ${s.ngo_support_level}/10.`, metric: `NGO Support: ${s.ngo_support_level}/10` });
    if (s.teacher_count < 5 && s.students > 150) insights.push({ type: 'warning', icon: '👩‍🏫', school: s.school_name, region: s.region, message: `Teacher shortage at ${s.school_name}: only ${s.teacher_count} teachers for ${s.students} students.`, metric: `Ratio: 1:${Math.round(s.students / s.teacher_count)}` });
  });
  const order = { critical: 0, weak_zone: 1, warning: 2, info: 3 };
  return insights.sort((a, b) => (order[a.type] || 4) - (order[b.type] || 4));
}

// ══════════════════════════════════════════════════════════
// PARTNERSHIPS SECTION
// ══════════════════════════════════════════════════════════
async function renderPartnerships() {
  let data;
  try {
    data = await fetchJSON(`${API}/partnerships`);
  } catch (e) {
    // fallback from cache
    data = buildLocalPartnershipData();
  }

  const { current_strength, timeline, network, weak_areas } = data;

  // Strength cards
  document.getElementById('partnerCards').innerHTML = `
    <div class="partner-card">
      <div class="partner-icon">🏛️</div>
      <div class="partner-name">Government</div>
      <div class="partner-score" style="color:#58a6ff">${current_strength.government}</div>
      <div class="partner-label">Collaboration Score / 100</div>
    </div>
    <div class="partner-card">
      <div class="partner-icon">🤝</div>
      <div class="partner-name">NGOs</div>
      <div class="partner-score" style="color:#bc8cff">${current_strength.ngo}</div>
      <div class="partner-label">Collaboration Score / 100</div>
    </div>
    <div class="partner-card">
      <div class="partner-icon">🏫</div>
      <div class="partner-name">Schools</div>
      <div class="partner-score" style="color:#3fb950">${current_strength.school}</div>
      <div class="partner-label">Collaboration Score / 100</div>
    </div>
  `;

  // Timeline chart
  destroyChart('partnershipTimeline');
  const ctx = document.getElementById('partnershipTimeline').getContext('2d');
  charts['partnershipTimeline'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: timeline.map(t => t.month),
      datasets: [
        { label: 'Government', data: timeline.map(t => t.government), borderColor: '#58a6ff', backgroundColor: '#58a6ff22', tension: 0.4, fill: true, borderWidth: 2 },
        { label: 'NGOs',       data: timeline.map(t => t.ngo),        borderColor: '#bc8cff', backgroundColor: '#bc8cff22', tension: 0.4, fill: true, borderWidth: 2 },
        { label: 'Schools',    data: timeline.map(t => t.school),     borderColor: '#3fb950', backgroundColor: '#3fb95022', tension: 0.4, fill: true, borderWidth: 2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b949e' } } },
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, min: 0, max: 100 },
      },
    },
  });

  // Network table
  document.getElementById('networkViz').innerHTML = `
    <table class="network-table">
      <thead><tr><th>From</th><th>To</th><th>Strength</th><th>Score</th></tr></thead>
      <tbody>
        ${network.map(n => `
          <tr>
            <td><b>${n.from}</b></td>
            <td>${n.to}</td>
            <td>
              <div class="strength-bar">
                <div class="strength-fill" style="width:${n.strength}px;max-width:200px"></div>
                <span style="font-size:12px;color:#8b949e">${n.strength}%</span>
              </div>
            </td>
            <td><span style="color:${n.strength >= 70 ? '#3fb950' : n.strength >= 50 ? '#e3b341' : '#f85149'};font-weight:700">${n.strength >= 70 ? 'Strong' : n.strength >= 50 ? 'Moderate' : 'Weak'}</span></td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  // Weak areas
  document.getElementById('weakAreas').innerHTML = weak_areas.length
    ? `<div class="weak-areas-list">${weak_areas.map(w => `
        <div class="weak-area-item">
          <div>
            <div class="weak-area-info">⚠️ ${w.school} — <b>${w.type}</b></div>
            <div class="weak-area-region">📍 ${w.region}</div>
          </div>
          <span class="weak-area-score">${w.score}/100</span>
        </div>`).join('')}</div>`
    : `<p style="color:#3fb950;padding:16px">✅ No critically weak partnership areas detected.</p>`;
}

function buildLocalPartnershipData() {
  const avg = key => Math.round(schoolsCache.reduce((a, s) => a + s[key], 0) / schoolsCache.length);
  return {
    current_strength: { government: avg('govt_partnership'), ngo: avg('ngo_partnership'), school: avg('school_partnership') },
    timeline: [
      {month:'Jan',government:65,ngo:58,school:70},{month:'Feb',government:67,ngo:60,school:71},
      {month:'Mar',government:70,ngo:62,school:73},{month:'Apr',government:68,ngo:55,school:72},
      {month:'May',government:66,ngo:50,school:70},{month:'Jun',government:64,ngo:48,school:68},
      {month:'Jul',government:69,ngo:52,school:71},{month:'Aug',government:72,ngo:56,school:74},
      {month:'Sep',government:75,ngo:60,school:76},{month:'Oct',government:73,ngo:58,school:75},
      {month:'Nov',government:71,ngo:55,school:73},{month:'Dec',government:74,ngo:59,school:76},
    ],
    network: [
      { from: 'Government', to: 'Schools', strength: avg('govt_partnership') },
      { from: 'NGOs',       to: 'Schools', strength: avg('ngo_partnership') },
      { from: 'Government', to: 'NGOs',    strength: Math.round((avg('govt_partnership') + avg('ngo_partnership')) / 2) },
    ],
    weak_areas: schoolsCache.filter(s => s.ngo_partnership < 30 || s.govt_partnership < 35).map(s => ({
      school: s.school_name, region: s.region,
      type: s.ngo_partnership < 30 ? 'NGO Partnership' : 'Government Partnership',
      score: Math.min(s.ngo_partnership, s.govt_partnership),
    })),
  };
}

// ══════════════════════════════════════════════════════════
// RISK ALERTS SECTION
// ══════════════════════════════════════════════════════════
async function renderRiskAlerts() {
  if (!riskCache.length) {
    try {
      riskCache = await fetchJSON(`${API}/ai/dropout-risk`);
    } catch (e) {
      riskCache = schoolsCache.map(s => ({
        school_id: s.school_id,
        school_name: s.school_name,
        region: s.region,
        dropout_risk_score: computeRisk(s),
        risk_label: riskLabel(computeRisk(s)),
        engagement_score: engagementScore(s),
        attendance_rate: s.attendance_rate,
        dropout_rate: s.dropout_rate,
      })).sort((a, b) => b.dropout_risk_score - a.dropout_risk_score);
    }
  }

  // Bar chart
  destroyChart('riskBarChart');
  const ctx = document.getElementById('riskBarChart').getContext('2d');
  charts['riskBarChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: riskCache.map(s => s.school_name.replace(' School','').replace(' Academy','')),
      datasets: [{
        label: 'Dropout Risk Score',
        data: riskCache.map(s => s.dropout_risk_score),
        backgroundColor: riskCache.map(s => riskColor(s.risk_label) + 'cc'),
        borderColor: riskCache.map(s => riskColor(s.risk_label)),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` Risk Score: ${ctx.raw} — ${riskCache[ctx.dataIndex].risk_label}` } },
      },
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, max: 100 },
        y: { ticks: { color: '#8b949e', font: { size: 11 } }, grid: { color: '#21262d' } },
      },
    },
  });

  // Table
  document.getElementById('riskTableBody').innerHTML = riskCache.map(s => `
    <tr>
      <td><b>${s.school_name}</b></td>
      <td style="color:#8b949e">${s.region}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:${s.dropout_risk_score}px;max-width:80px;height:6px;border-radius:3px;background:${riskColor(s.risk_label)}"></div>
          <b style="color:${riskColor(s.risk_label)}">${s.dropout_risk_score}</b>
        </div>
      </td>
      <td><span class="risk-badge ${s.risk_label}">${s.risk_label}</span></td>
      <td style="color:${s.attendance_rate >= 75 ? '#3fb950' : s.attendance_rate >= 60 ? '#e3b341' : '#f85149'}">${s.attendance_rate}%</td>
      <td style="color:#f85149">${s.dropout_rate}%</td>
      <td style="color:${engagementColor(s.engagement_score)}">${s.engagement_score}/100</td>
    </tr>
  `).join('');
}

// ══════════════════════════════════════════════════════════
// REGIONS SECTION
// ══════════════════════════════════════════════════════════
async function renderRegions() {
  let regions;
  try {
    regions = await fetchJSON(`${API}/regions`);
  } catch (e) {
    // Build locally
    const map = {};
    schoolsCache.forEach(s => {
      if (!map[s.region]) map[s.region] = { region: s.region, schools: 0, total_students: 0, avg_attendance: 0, avg_dropout: 0, avg_ngo: 0, school_list: [] };
      map[s.region].schools++;
      map[s.region].total_students += s.students;
      map[s.region].avg_attendance += s.attendance_rate;
      map[s.region].avg_dropout    += s.dropout_rate;
      map[s.region].avg_ngo        += s.ngo_support_level;
      map[s.region].school_list.push(s.school_name);
    });
    regions = Object.values(map).map(r => ({
      ...r,
      avg_attendance: +(r.avg_attendance / r.schools).toFixed(1),
      avg_dropout:    +(r.avg_dropout    / r.schools).toFixed(1),
      avg_ngo:        +(r.avg_ngo        / r.schools).toFixed(1),
    }));
  }

  document.getElementById('regionsGrid').innerHTML = regions.map(r => `
    <div class="region-card">
      <div class="region-name">🗺️ ${r.region}</div>
      <div class="region-stats">
        <div class="region-stat"><span class="region-stat-label">Schools</span><span class="region-stat-value" style="color:#58a6ff">${r.schools}</span></div>
        <div class="region-stat"><span class="region-stat-label">Total Students</span><span class="region-stat-value">${r.total_students.toLocaleString()}</span></div>
        <div class="region-stat"><span class="region-stat-label">Avg Attendance</span><span class="region-stat-value" style="color:${r.avg_attendance >= 70 ? '#3fb950' : '#f0883e'}">${r.avg_attendance}%</span></div>
        <div class="region-stat"><span class="region-stat-label">Avg Dropout</span><span class="region-stat-value" style="color:#f85149">${r.avg_dropout}%</span></div>
        <div class="region-stat"><span class="region-stat-label">Avg NGO Support</span><span class="region-stat-value" style="color:#bc8cff">${r.avg_ngo}/10</span></div>
      </div>
      <div class="region-schools">Schools: ${r.school_list.join(', ')}</div>
    </div>
  `).join('');

  // Region comparison chart
  destroyChart('regionChart');
  const ctx = document.getElementById('regionChart').getContext('2d');
  charts['regionChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: regions.map(r => r.region),
      datasets: [
        { label: 'Avg Attendance %', data: regions.map(r => r.avg_attendance), backgroundColor: '#58a6ff99', borderColor: '#58a6ff', borderWidth: 1, borderRadius: 4 },
        { label: 'Avg Dropout %',    data: regions.map(r => r.avg_dropout),    backgroundColor: '#f8514999', borderColor: '#f85149', borderWidth: 1, borderRadius: 4 },
        { label: 'NGO Support ×10',  data: regions.map(r => r.avg_ngo * 10),   backgroundColor: '#bc8cff99', borderColor: '#bc8cff', borderWidth: 1, borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b949e' } } },
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
      },
    },
  });
}

// ══════════════════════════════════════════════════════════
// EVENT LISTENERS & INIT
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Nav clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigate(item.dataset.section);
    });
  });

  // Mobile menu toggle
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Refresh button
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('spinning');
    schoolsCache = []; insightsCache = []; riskCache = [];
    await loadDashboard();
    btn.classList.remove('spinning');
  });

  // Modal close
  document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('modalOverlay').classList.remove('open');
    destroyChart('modalChart');
  });
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) {
      document.getElementById('modalOverlay').classList.remove('open');
      destroyChart('modalChart');
    }
  });

  // School filters
  document.getElementById('regionFilter').addEventListener('change', renderSchools);
  document.getElementById('riskFilter').addEventListener('change', renderSchools);

  // Initial load
  loadDashboard();
});