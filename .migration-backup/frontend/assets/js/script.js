const API = 'http://localhost:8000';

// ====== Component Loader ======
async function loadComponents() {
  const elements = document.querySelectorAll('[data-component]');
  for (const el of elements) {
    const file = el.getAttribute('data-component');
    try {
      const response = await fetch('./components/' + file);
      if (response.ok) {
        const html = await response.text();
        el.outerHTML = html;
      } else {
        console.warn(`Component ${file} not found.`);
      }
    } catch (e) {
      console.error('Error loading component:', file, e);
    }
  }

  // After components are loaded, do any necessary wiring
  api('/health').then(d => {
    const statusEl = document.getElementById('api-status');
    if(statusEl) {
      statusEl.textContent = d ? 'API LIVE' : 'MOCK DATA';
      statusEl.className = d ? 'api-badge live' : 'api-badge mock';
    }
  });

  document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
}

function toggleMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  if(sidebar) {
    sidebar.classList.toggle('open');
  }
}

// ====== Navigation ======
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const sectionEl = document.getElementById('sec-' + name);
  if (sectionEl) sectionEl.classList.add('active');
  
  const titles = {dashboard:'Market Dashboard',stocks:'Stock Analysis — NSE/BSE',mf:'Mutual Funds',sip:'SIP Calculator',tax:'Tax Planner',portfolio:'Portfolio',expenses:'Expense Tracker',budget:'Budget Manager',debt:'Debt / EMI',retirement:'Retirement Planner',insurance:'Insurance Analyzer',chat:'AI Financial Advisor'};
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = titles[name] || name;
  
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }

  // Close mobile sidebar if open
  const sidebar = document.querySelector('.sidebar');
  if(sidebar) sidebar.classList.remove('open');

  // Lazy load
  if (name === 'mf') loadMF();
  if (name === 'budget') loadBudget();
  if (name === 'retirement') loadRetirementStrategies();
  if (name === 'insurance') loadInsuranceComparison();
  if (name === 'debt' && document.getElementById('debt-analysis-content') && document.getElementById('debt-analysis-content').querySelector('.loading')) loadDebtAnalysis();
  if (name === 'portfolio') refreshPortfolio();
}

function switchTab(el, prefix) {
  const parent = el.closest('.tabs');
  const idx = Array.from(parent.children).indexOf(el);
  parent.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', i===idx));
  const sec = el.closest('.section');
  if(sec) {
    sec.querySelectorAll('.tab-content').forEach((c,i) => c.classList.toggle('active', i===idx));
  }
}

// ====== Formatting ======
const fmt = n => isNaN(n) ? n : '₹' + Number(n).toLocaleString('en-IN', {maximumFractionDigits:2});
const fmtN = n => isNaN(n) ? n : Number(n).toLocaleString('en-IN', {maximumFractionDigits:2});
const chgClass = n => n > 0 ? 'up' : n < 0 ? 'dn' : 'neu';
const chgArrow = n => n > 0 ? '▲' : n < 0 ? '▼' : '—';

// ====== API helper ======
async function api(path, method='GET', body=null) {
  const opts = {method, headers:{'Content-Type':'application/json'}};
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(API + path, opts);
    return await r.json();
  } catch(e) {
    console.warn('API error:', e.message);
    return null;
  }
}

// ====== STOCKS ======
let priceChart = null;
async function fetchStock() {
  const symInput = document.getElementById('stock-sym-input');
  if(!symInput) return;
  const sym = symInput.value.trim().toUpperCase();
  const ex = document.getElementById('stock-ex').value;
  const period = document.getElementById('stock-period').value;
  if (!sym) return;

  const resultArea = document.getElementById('stock-result-area');
  resultArea.innerHTML = '<div class="loading">Fetching data for ' + sym + '...</div>';

  const [quote, hist, tech, news] = await Promise.all([
    api(`/api/v1/stocks/quote/${sym}?exchange=${ex}`),
    api(`/api/v1/stocks/history/${sym}?exchange=${ex}&period=${period}`),
    api(`/api/v1/stocks/technical-analysis/${sym}?exchange=${ex}`),
    api(`/api/v1/stocks/news-sentiment/${sym}`)
  ]);

  if (!quote) { resultArea.innerHTML = '<div class="error-msg">Could not fetch data. Make sure the backend is running.</div>'; return; }

  const chg = quote.change || 0;
  const chgP = quote.change_percent || 0;
  const signal = tech?.overall_signal || 'NEUTRAL';
  const signalClass = signal === 'BUY' ? 'pill-buy' : signal === 'SELL' ? 'pill-sell' : 'pill-hold';

  let html = `
  <div class="detail-card" style="margin-bottom:16px;background:var(--card2);border-color:var(--border2)">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-family:var(--font-display);font-size:1.5rem;color:var(--text)">${quote.company_name}</div>
        <div style="font-size:0.78rem;color:var(--text3);margin-top:3px">${sym} · ${ex} · ${quote.sector || ''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:var(--font-mono);font-size:2rem;color:var(--text)">${fmt(quote.current_price)}</div>
        <div class="${chgClass(chg)}" style="font-size:0.9rem">${chgArrow(chg)} ${fmt(Math.abs(chg))} (${chgP > 0 ? '+' : ''}${chgP}%)</div>
      </div>
      <span class="pill ${signalClass}" style="font-size:0.85rem;padding:6px 16px">${signal}</span>
    </div>
  </div>
  <div class="stock-detail-grid">
    <div class="detail-card"><div class="detail-label">Prev Close</div><div class="detail-val">${fmt(quote.previous_close)}</div></div>
    <div class="detail-card"><div class="detail-label">Day High / Low</div><div class="detail-val">${fmt(quote.day_high)} / ${fmt(quote.day_low)}</div></div>
    <div class="detail-card"><div class="detail-label">52W High / Low</div><div class="detail-val">${fmt(quote['52_week_high'])} / ${fmt(quote['52_week_low'])}</div></div>
    <div class="detail-card"><div class="detail-label">P/E Ratio</div><div class="detail-val">${quote.pe_ratio ? fmtN(quote.pe_ratio) : 'N/A'}</div></div>
    <div class="detail-card"><div class="detail-label">Volume</div><div class="detail-val">${fmtN(quote.volume)}</div></div>
    <div class="detail-card"><div class="detail-label">Market Cap</div><div class="detail-val">${quote.market_cap ? '₹' + (quote.market_cap / 10000000).toFixed(0) + ' Cr' : 'N/A'}</div></div>
    <div class="detail-card"><div class="detail-label">MA 20</div><div class="detail-val">${tech ? fmt(tech.indicators.ma20) : 'N/A'}</div></div>
    <div class="detail-card"><div class="detail-label">RSI (14)</div><div class="detail-val" style="color:${tech?.indicators.rsi > 70 ? 'var(--red)' : tech?.indicators.rsi < 30 ? 'var(--green)' : 'var(--text)'}">${tech ? tech.indicators.rsi : 'N/A'}</div></div>
  </div>
  <div class="grid-2-1">
    <div class="card">
      <div class="card-header"><span class="card-title">Price History with MA</span></div>
      <div class="chart-wrap-lg"><canvas id="price-chart"></canvas></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">News Sentiment</span></div>`;

  if (news && news.news) {
    const sColor = news.overall_sentiment === 'Positive' ? 'var(--green)' : news.overall_sentiment === 'Negative' ? 'var(--red)' : 'var(--gold)';
    html += `<div style="text-align:center;padding:12px 0"><div style="font-family:var(--font-mono);font-size:2rem;color:${sColor}">${news.overall_sentiment}</div><div style="color:var(--text3);font-size:0.78rem">Score: ${news.sentiment_score}</div></div>`;
    news.news.slice(0,4).forEach(n => {
      const sc = n.sentiment === 'Positive' ? 'badge-green' : n.sentiment === 'Negative' ? 'badge-red' : 'badge-gold';
      html += `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:0.78rem"><span class="badge ${sc}">${n.sentiment}</span><span style="color:var(--text2);margin-left:8px">${n.title}</span><div style="color:var(--text3);margin-top:3px;font-size:0.72rem">${n.source}</div></div>`;
    });
  }
  html += `</div></div></div>`;

  resultArea.innerHTML = html;

  // Draw chart
  if (hist && hist.data) {
    const labels = hist.data.map(d => d.date.slice(5));
    const closes = hist.data.map(d => d.close);
    const ma20 = hist.data.map(d => d.ma20);
    const ma50 = hist.data.map(d => d.ma50);
    if (priceChart) priceChart.destroy();
    priceChart = new Chart(document.getElementById('price-chart'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {label: 'Price', data: closes, borderColor: '#c9a84c', backgroundColor: 'rgba(201,168,76,0.06)', borderWidth: 2, pointRadius: 0, tension: 0.1},
          {label: 'MA 20', data: ma20, borderColor: '#22c55e', backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, tension: 0.3, borderDash: [4,3]},
          {label: 'MA 50', data: ma50, borderColor: '#3b82f6', backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, tension: 0.3, borderDash: [8,4]},
        ]
      },
      options: chartOpts()
    });
  }
}

// ====== MUTUAL FUNDS ======
let mfLoaded = false;
async function loadMF() {
  const cat = document.getElementById('mf-category')?.value || '';
  const risk = document.getElementById('mf-risk')?.value || '';
  let url = '/api/v1/mutual-funds/list';
  const params = [];
  if (cat) params.push('category=' + cat);
  if (risk) params.push('risk=' + risk);
  if (params.length) url += '?' + params.join('&');
  const data = await api(url);
  if (!data) return;
  const tb = document.getElementById('mf-table-body');
  if (!tb) return;
  tb.innerHTML = data.funds.map(f => `
    <tr>
      <td>${f.name}</td>
      <td>${f.category}</td>
      <td style="font-family:var(--font-mono)">₹${f.nav}</td>
      <td class="${f['1yr']>0?'up':'dn'}">${f['1yr']}%</td>
      <td class="${f['3yr']>0?'up':'dn'}">${f['3yr']}%</td>
      <td class="${f['5yr']>0?'up':'dn'}">${f['5yr']}%</td>
      <td><span class="badge ${f.risk==='Low'?'badge-green':f.risk==='High'?'badge-red':'badge-gold'}">${f.risk}</span></td>
    </tr>`).join('');
}

async function compareFunds() {
  const f1 = document.getElementById('cmp-f1').value;
  const f2 = document.getElementById('cmp-f2').value;
  const sip = document.getElementById('cmp-sip').value;
  const yrs = document.getElementById('cmp-yrs').value;
  const data = await api(`/api/v1/mutual-funds/compare?fund1=${encodeURIComponent(f1)}&fund2=${encodeURIComponent(f2)}&monthly_sip=${sip}&years=${yrs}`);
  if (!data) return;
  const c = data.comparison;
  document.getElementById('cmp-result').innerHTML = `
    <div class="result-box" style="margin-top:14px">
      <div class="result-row"><span class="result-label">${c.fund1.name}</span><span class="result-value up">${fmt(c.fund1.sip_projection.expected_corpus)}</span></div>
      <div class="result-row"><span class="result-label">${c.fund2.name}</span><span class="result-value up">${fmt(c.fund2.sip_projection.expected_corpus)}</span></div>
      <div class="result-row"><span class="result-label" style="color:var(--gold2);font-weight:600">Recommended</span><span class="result-value text-gold">${data.recommendation}</span></div>
    </div>`;
  document.getElementById('cmp-chart-card').style.display = 'block';
  const yw1 = c.fund1.sip_projection.year_wise_growth;
  const yw2 = c.fund2.sip_projection.year_wise_growth;
  const ctx = document.getElementById('cmp-chart');
  if (ctx._chart) ctx._chart.destroy();
  ctx._chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: yw1.map(y => 'Yr ' + y.year),
      datasets: [
        {label: c.fund1.name.split(' ').slice(0,2).join(' '), data: yw1.map(y=>y.corpus), borderColor: '#c9a84c', backgroundColor:'transparent', borderWidth:2, pointRadius:0},
        {label: c.fund2.name.split(' ').slice(0,2).join(' '), data: yw2.map(y=>y.corpus), borderColor:'#22c55e', backgroundColor:'transparent', borderWidth:2, pointRadius:0},
      ]
    },
    options: chartOpts()
  });
}

function calcSIP2() {
  const amt = +document.getElementById('sip2-amt').value;
  const ret = +document.getElementById('sip2-ret').value;
  const yrs = +document.getElementById('sip2-yrs').value;
  const data = localSIP(amt, ret, yrs, 0);
  document.getElementById('sip2-result').innerHTML = resultBox([
    ['Total Invested', fmt(data.total_invested)],
    ['Expected Corpus', fmt(data.expected_corpus)],
    ['Total Returns', fmt(data.total_returns)],
  ]);
  drawSIPChart('sip2-chart', data.year_wise_growth);
}

// ====== SIP ======
function localSIP(monthly, annualRet, years, stepUp=0) {
  let corpus = 0, invested = 0;
  const mr = annualRet / 12 / 100;
  const yw = [];
  for (let y = 1; y <= years; y++) {
    const m = monthly * Math.pow(1 + stepUp/100, y-1);
    for (let i = 0; i < 12; i++) { invested += m; corpus = (corpus + m) * (1 + mr); }
    yw.push({year:y, invested:Math.round(invested), corpus:Math.round(corpus)});
  }
  return {total_invested:Math.round(invested), expected_corpus:Math.round(corpus), total_returns:Math.round(corpus-invested), year_wise_growth:yw};
}

function calcSIPBasic() {
  const amt = +document.getElementById('sip-amt').value;
  const ret = +document.getElementById('sip-ret').value;
  const yrs = +document.getElementById('sip-yrs').value;
  const d = localSIP(amt, ret, yrs);
  document.getElementById('sip-basic-result').innerHTML = resultHighlight(fmt(d.expected_corpus), 'Expected Corpus') + resultBox([
    ['Total Invested', fmt(d.total_invested)],
    ['Total Returns', fmt(d.total_returns)],
    ['Wealth Multiple', (d.expected_corpus/d.total_invested).toFixed(2) + 'x'],
  ]);
  drawSIPChart('sip-chart', d.year_wise_growth);
}

function calcGoalSIP() {
  const target = +document.getElementById('goal-amt').value;
  const yrs = +document.getElementById('goal-yrs').value;
  const ret = +document.getElementById('goal-ret').value;
  const mr = ret / 12 / 100;
  const months = yrs * 12;
  const sip = target * mr / (((1 + mr)**months - 1) * (1 + mr));
  document.getElementById('goal-result').innerHTML = resultHighlight(fmt(Math.round(sip)), 'Required Monthly SIP') + resultBox([
    ['Target Amount', fmt(target)],
    ['Total Investment', fmt(Math.round(sip*months))],
    ['Returns Generated', fmt(Math.round(target - sip*months))],
  ]);
}

function setGoal(amt, yrs) {
  document.getElementById('goal-amt').value = amt;
  document.getElementById('goal-yrs').value = yrs;
  const tabs = document.querySelectorAll('#sec-sip .tab');
  if(tabs.length > 1) tabs[1].click();
  calcGoalSIP();
}

function calcStepUpSIP() {
  const amt = +document.getElementById('sup-amt').value;
  const pct = +document.getElementById('sup-pct').value;
  const ret = +document.getElementById('sup-ret').value;
  const yrs = +document.getElementById('sup-yrs').value;
  const su = localSIP(amt, ret, yrs, pct);
  const regular = localSIP(amt, ret, yrs, 0);
  document.getElementById('sup-result').innerHTML = resultHighlight(fmt(su.expected_corpus), 'Step-Up SIP Corpus') + resultBox([
    ['Regular SIP Corpus', fmt(regular.expected_corpus)],
    ['Extra Gained', fmt(su.expected_corpus - regular.expected_corpus)],
    ['Step-Up Invested', fmt(su.total_invested)],
  ]);
  const ctx = document.getElementById('sup-chart');
  if (ctx._chart) ctx._chart.destroy();
  ctx._chart = new Chart(ctx, {
    type:'line',
    data:{
      labels: su.year_wise_growth.map(y=>'Yr '+y.year),
      datasets:[
        {label:'Step-Up SIP', data:su.year_wise_growth.map(y=>y.corpus), borderColor:'#c9a84c', backgroundColor:'rgba(201,168,76,0.06)', borderWidth:2.5, pointRadius:0},
        {label:'Regular SIP', data:regular.year_wise_growth.map(y=>y.corpus), borderColor:'#64748b', backgroundColor:'transparent', borderWidth:1.5, pointRadius:0, borderDash:[5,5]},
      ]
    },
    options: chartOpts()
  });
}

function drawSIPChart(id, yw) {
  const ctx = document.getElementById(id);
  if (ctx._chart) ctx._chart.destroy();
  ctx._chart = new Chart(ctx, {
    type:'bar',
    data:{
      labels:yw.map(y=>'Yr '+y.year),
      datasets:[
        {label:'Invested',data:yw.map(y=>y.invested),backgroundColor:'rgba(100,116,139,0.5)',borderRadius:4},
        {label:'Returns',data:yw.map(y=>y.corpus-y.invested),backgroundColor:'rgba(201,168,76,0.7)',borderRadius:4},
      ]
    },
    options:{...chartOpts(), scales:{x:{stacked:true,...axisOpts()},y:{stacked:true,...axisOpts()}}}
  });
}

// ====== TAX ======
async function calcLTCG() {
  const type = document.getElementById('ltcg-type').value;
  const buy = +document.getElementById('ltcg-buy').value;
  const sell = +document.getElementById('ltcg-sell').value;
  const units = +document.getElementById('ltcg-units').value;
  const today = new Date().toISOString().split('T')[0];
  const data = await api('/api/v1/tax/ltcg', 'POST', {asset_type:type, purchase_price:buy, sale_price:sell, units, purchase_date:'2020-01-01', sale_date:today});
  if (!data) return;
  document.getElementById('ltcg-result').innerHTML = resultHighlight(fmt(data.total_tax_liability), 'Total Tax Liability') + resultBox([
    ['Capital Gain', fmt(data.capital_gain)],
    ['Exemption', fmt(data.exemption_applied)],
    ['Taxable Gain', fmt(data.taxable_gain)],
    ['Tax Rate', data.tax_rate_percent + '%'],
    ['Cess (4%)', fmt(data.health_education_cess_4pct)],
    ['Effective Tax Rate', data.effective_tax_rate + '%'],
    ['Net Gain After Tax', fmt(data.net_gain_after_tax)],
  ]) + `<div class="warn-msg" style="margin-top:8px">💡 ${data.tax_saving_tip}</div>`;
}

async function calcSTCG() {
  const type = document.getElementById('stcg-type').value;
  const buy = +document.getElementById('stcg-buy').value;
  const sell = +document.getElementById('stcg-sell').value;
  const units = +document.getElementById('stcg-units').value;
  const data = await api('/api/v1/tax/stcg', 'POST', {asset_type:type, purchase_price:buy, sale_price:sell, units});
  if (!data) return;
  document.getElementById('stcg-result').innerHTML = resultHighlight(fmt(data.total_tax_liability), 'Total Tax Liability') + resultBox([
    ['Capital Gain', fmt(data.capital_gain)],
    ['Tax Rate', data.tax_rate_percent + '%'],
    ['Cess (4%)', fmt(data.health_education_cess)],
    ['Net Amount', fmt(data.net_amount)],
  ]);
}

// ====== PORTFOLIO ======
async function addHolding() {
  const sym = document.getElementById('pf-sym').value.trim().toUpperCase();
  const ex = document.getElementById('pf-ex').value;
  const qty = +document.getElementById('pf-qty').value;
  const price = +document.getElementById('pf-price').value;
  if (!sym) return;
  const r = await api('/api/v1/portfolio/add-holding', 'POST', {symbol:sym, exchange:ex, quantity:qty, avg_buy_price:price});
  document.getElementById('pf-add-msg').innerHTML = r ? '<div class="success-msg">✓ Added ' + sym + ' to portfolio</div>' : '<div class="error-msg">Error adding holding</div>';
  refreshPortfolio();
}

async function refreshPortfolio() {
  const data = await api('/api/v1/portfolio/summary');
  if (!data) return;
  document.getElementById('pf-val').textContent = fmt(data.current_value);
  document.getElementById('pf-inv').textContent = fmt(data.invested_value);
  const pnlEl = document.getElementById('pf-pnl');
  pnlEl.textContent = fmt(data.total_pnl);
  pnlEl.className = 'card-value ' + chgClass(data.total_pnl);
  const pnlPEl = document.getElementById('pf-pnlp');
  pnlPEl.textContent = (data.total_pnl_percent > 0 ? '+' : '') + data.total_pnl_percent + '%';
  pnlPEl.className = 'card-value ' + chgClass(data.total_pnl_percent);

  const tb = document.getElementById('pf-table');
  if (data.holdings.length === 0) { tb.innerHTML = '<tr><td colspan="8" class="no-data">No holdings. Add stocks in "Add Holding" tab.</td></tr>'; return; }
  tb.innerHTML = data.holdings.map(h => `
    <tr>
      <td>${h.symbol} <span class="badge badge-blue" style="font-size:0.65rem">${h.exchange}</span></td>
      <td>${h.quantity}</td>
      <td style="font-family:var(--font-mono)">${fmt(h.avg_buy_price)}</td>
      <td style="font-family:var(--font-mono)">${fmt(h.current_price)}</td>
      <td>${fmt(h.invested_value)}</td>
      <td>${fmt(h.current_value)}</td>
      <td class="${chgClass(h.pnl)}">${chgArrow(h.pnl)} ${fmt(Math.abs(h.pnl))}</td>
      <td class="${chgClass(h.pnl_percent)}">${h.pnl_percent > 0 ? '+' : ''}${h.pnl_percent}%</td>
    </tr>`).join('');
}

async function addWatchlist() {
  const sym = document.getElementById('wl-sym').value.trim().toUpperCase();
  const ex = document.getElementById('wl-ex').value;
  const notes = document.getElementById('wl-notes').value;
  const r = await api('/api/v1/portfolio/watchlist/add', 'POST', {symbol:sym, exchange:ex, notes});
  document.getElementById('wl-add-msg').innerHTML = r ? '<div class="success-msg">✓ Added to watchlist</div>' : '<div class="error-msg">Error</div>';
  loadWatchlist();
}

async function loadWatchlist() {
  const data = await api('/api/v1/portfolio/watchlist');
  const el = document.getElementById('wl-list');
  if (!data || data.count === 0) { el.innerHTML = '<div class="no-data">Watchlist empty</div>'; return; }
  el.innerHTML = data.watchlist.map(w => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);font-size:0.83rem">
      <div><strong>${w.symbol}</strong> <span style="color:var(--text3);font-size:0.72rem">${w.exchange}</span>${w.notes ? '<div style="color:var(--text3);font-size:0.72rem">'+w.notes+'</div>' : ''}</div>
      <div style="text-align:right"><div style="font-family:var(--font-mono)">${fmt(w.current_price)}</div><div class="${chgClass(w.change_percent)}">${w.change_percent > 0 ? '+' : ''}${w.change_percent}%</div></div>
    </div>`).join('');
}

// ====== EXPENSES ======
let expPieChart = null;
const localExpenses = [];

function addExpense() {
  const amt = +document.getElementById('exp-amt').value;
  const cat = document.getElementById('exp-cat').value;
  const desc = document.getElementById('exp-desc').value;
  const date = document.getElementById('exp-date').value || new Date().toISOString().split('T')[0];
  const method = document.getElementById('exp-method').value;
  if (!amt || !desc) { document.getElementById('exp-msg').innerHTML = '<div class="error-msg">Please fill amount and description</div>'; return; }
  localExpenses.push({amount:amt, category:cat, description:desc, date, payment_method:method});
  api('/api/v1/expenses/add','POST',{amount:amt,category:cat,description:desc,date,payment_method:method});
  document.getElementById('exp-msg').innerHTML = '<div class="success-msg">✓ Expense added</div>';
  document.getElementById('exp-amt').value='';document.getElementById('exp-desc').value='';
  renderExpenses();
  setTimeout(()=>document.getElementById('exp-msg').innerHTML='',3000);
}

function renderExpenses() {
  const tb = document.getElementById('exp-table');
  if(!tb) return;
  if (localExpenses.length === 0) { tb.innerHTML = '<tr><td colspan="5" class="no-data">No expenses</td></tr>'; return; }
  tb.innerHTML = [...localExpenses].reverse().slice(0,20).map(e => `
    <tr><td>${e.date}</td><td><span class="badge badge-gold">${e.category}</span></td><td>${e.description}</td><td>${e.payment_method}</td><td class="dn">${fmt(e.amount)}</td></tr>`).join('');

  const cats = {};
  localExpenses.forEach(e => cats[e.category] = (cats[e.category]||0) + e.amount);
  const total = Object.values(cats).reduce((a,b)=>a+b,0);
  document.getElementById('exp-summary').innerHTML = Object.entries(cats).map(([k,v])=>`<div class="result-row"><span class="result-label">${k}</span><span class="result-value">${fmt(v)} <span style="color:var(--text3);font-size:0.75rem">(${(v/total*100).toFixed(0)}%)</span></span></div>`).join('');

  const colors = ['#c9a84c','#22c55e','#3b82f6','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];
  const ctx = document.getElementById('exp-chart');
  if (expPieChart) expPieChart.destroy();
  expPieChart = new Chart(ctx, {
    type:'doughnut',
    data:{labels:Object.keys(cats), datasets:[{data:Object.values(cats), backgroundColor:colors.slice(0,Object.keys(cats).length), borderWidth:0, hoverOffset:6}]},
    options:{plugins:{legend:{labels:{color:'#94a3b8',font:{size:11}}}}, cutout:'65%'}
  });
}

// ====== BUDGET ======
async function loadBudget() {
  const data = await api('/api/v1/budget/summary');
  if (!data) return;
  const el = document.getElementById('budget-content');
  const util = data.budget_utilization;
  el.innerHTML = `
  <div class="grid-4" style="margin-bottom:24px">
    <div class="card"><div class="card-title">Total Budget</div><div class="card-value">${fmt(data.total_budget)}</div></div>
    <div class="card"><div class="card-title">Total Spent</div><div class="card-value dn">${fmt(data.total_spent)}</div></div>
    <div class="card"><div class="card-title">Remaining</div><div class="card-value up">${fmt(data.total_remaining)}</div></div>
    <div class="card"><div class="card-title">Utilization</div><div class="card-value ${util>90?'dn':util>70?'text-gold':'up'}">${util}%</div></div>
  </div>
  ${data.alert !== 'On track' ? `<div class="warn-msg" style="margin-bottom:16px">⚠️ ${data.alert}</div>` : ''}
  <div class="card">
    <div class="card-header"><span class="card-title">Budget vs Spent</span></div>
    ${data.budgets.map(b => {
      const pct = Math.round(b.spent/b.limit*100);
      const cls = pct > 90 ? '#ef4444' : pct > 75 ? 'var(--gold)' : '#22c55e';
      return `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:5px">
          <span style="color:var(--text)">${b.category}</span>
          <span style="color:var(--text3)">${fmt(b.spent)} / ${fmt(b.limit)} <span class="${pct>90?'dn':pct>75?'text-gold':'up'}">(${pct}%)</span></span>
        </div>
        <div class="score-bar"><div class="score-fill" style="width:${Math.min(pct,100)}%;background:${cls}"></div></div>
      </div>`;
    }).join('')}
  </div>`;
}

// ====== EMI ======
async function calcEMI() {
  const type = document.getElementById('emi-type').value;
  const p = +document.getElementById('emi-principal').value;
  const r = +document.getElementById('emi-rate').value;
  const t = +document.getElementById('emi-tenure').value;
  const data = await api(`/api/v1/debt/calculate-emi?debt_type=${encodeURIComponent(type)}&principal=${p}&interest_rate=${r}&tenure_months=${t}`,'POST');
  if (!data) return;
  document.getElementById('emi-result').innerHTML = resultHighlight(fmt(data.monthly_emi), 'Monthly EMI') + resultBox([
    ['Total Interest', fmt(data.total_interest)],
    ['Total Amount Payable', fmt(data.total_amount)],
    ['Payoff Date', data.payoff_date?.split('T')[0]],
  ]);
  const ctx = document.getElementById('emi-chart');
  if (ctx._chart) ctx._chart.destroy();
  ctx._chart = new Chart(ctx, {
    type:'doughnut',
    data:{labels:['Principal','Interest'],datasets:[{data:[p, data.total_interest], backgroundColor:['#3b82f6','#c9a84c'], borderWidth:0}]},
    options:{plugins:{legend:{labels:{color:'#94a3b8'}}}, cutout:'60%'}
  });
}

async function calcPrepayment() {
  const p = +document.getElementById('pp-prin').value;
  const r = +document.getElementById('pp-rate').value;
  const t = +document.getElementById('pp-tenure').value;
  const extra = +document.getElementById('pp-extra').value;
  const data = await api(`/api/v1/debt/prepayment-strategy?principal=${p}&interest_rate=${r}&tenure_months=${t}&extra_payment=${extra}`,'POST');
  if (!data) return;
  document.getElementById('pp-result').innerHTML = resultHighlight(fmt(data.interest_saved), 'Interest Saved') + resultBox([
    ['Normal EMI', fmt(data.normal_emi)],
    ['New EMI (with extra)', fmt(data.new_emi_with_extra)],
    ['Months Saved', data.months_saved],
    ['New Tenure', data.new_tenure_months + ' months'],
  ]) + `<div class="success-msg" style="margin-top:8px">✓ ${data.recommendation}</div>`;
}

async function loadDebtAnalysis() {
  const data = await api('/api/v1/reports/debt-analysis');
  if (!data) return;
  document.getElementById('debt-analysis-content').innerHTML = `
  <div class="grid-3" style="margin-bottom:20px">
    <div class="card"><div class="card-title">Total Debt</div><div class="card-value dn">${fmt(data.total_debt)}</div></div>
    <div class="card"><div class="card-title">Monthly EMI</div><div class="card-value">${fmt(data.total_monthly_emi)}</div></div>
    <div class="card"><div class="card-title">DTI Ratio</div><div class="card-value ${data.dti_ratio>40?'dn':'up'}">${data.dti_ratio}%</div></div>
  </div>
  <div class="table-responsive"><div class="card"><table><thead><tr><th>Loan Type</th><th>Principal</th><th>Outstanding</th><th>Rate</th><th>EMI</th><th>Tenure Left</th></tr></thead>
  <tbody>${data.debts.map(d=>`<tr><td>${d.type}</td><td>${fmt(d.principal)}</td><td class="dn">${fmt(d.outstanding)}</td><td>${d.rate}%</td><td>${fmt(d.monthly_emi)}</td><td>${d.remaining_tenure} months</td></tr>`).join('')}</tbody></table></div></div>
  <div class="warn-msg" style="margin-top:12px">💡 ${data.recommendation}</div>`;
}

// ====== RETIREMENT ======
async function calcRetirement() {
  const ca = +document.getElementById('ret-age').value;
  const ra = +document.getElementById('ret-retage').value;
  const cs = +document.getElementById('ret-savings').value;
  const ms = +document.getElementById('ret-monthly').value;
  const er = +document.getElementById('ret-return').value;
  const ae = +document.getElementById('ret-expense').value;
  const data = await api(`/api/v1/retirement/corpus-calculation?current_age=${ca}&retirement_age=${ra}&current_savings=${cs}&monthly_savings=${ms}&expected_return=${er}&annual_expense=${ae}`,'POST');
  if (!data) return;
  const isGood = data.shortfall === 0;
  document.getElementById('ret-result').innerHTML = resultHighlight(fmt(data.corpus_at_retirement), 'Estimated Corpus at Retirement') + resultBox([
    ['Years to Retirement', data.years_to_retirement],
    ['Corpus Needed', fmt(data.corpus_needed)],
    ['Shortfall', data.shortfall > 0 ? fmt(data.shortfall) : '—'],
    ['Surplus', data.surplus > 0 ? fmt(data.surplus) : '—'],
    ['Annual Expense at Retirement', fmt(data.annual_expense_at_retirement)],
  ]) + `<div class="${isGood?'success-msg':'warn-msg'}" style="margin-top:8px">${data.status}</div>`;
}

async function loadRetirementStrategies() {
  const data = await api('/api/v1/retirement/strategies');
  if (!data) return;
  document.getElementById('ret-strategies').innerHTML = data.strategies.map(s => `
    <div style="padding:14px;border:1px solid var(--border);border-radius:8px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-weight:600;color:var(--text)">${s.name}</span>
        <span class="badge ${s.risk==='Low'?'badge-green':s.risk.includes('High')?'badge-red':'badge-gold'}">${s.risk} Risk</span>
      </div>
      <div style="font-size:0.8rem;color:var(--text3);margin-bottom:4px">${s.allocation}</div>
      <div style="font-size:0.8rem;color:var(--text2)">Expected: <span class="up">${s.expected_return}</span> · ${s.suitable_for}</div>
      <div style="font-size:0.75rem;color:var(--text3);margin-top:5px">${s.instruments.join(' · ')}</div>
    </div>`).join('');
}

// ====== INSURANCE ======
async function calcInsurance() {
  const age = +document.getElementById('ins-age').value;
  const inc = +document.getElementById('ins-income').value;
  const dep = +document.getElementById('ins-dep').value;
  const ex = +document.getElementById('ins-existing').value;
  const data = await api(`/api/v1/insurance/needs-analysis?age=${age}&annual_income=${inc}&dependents=${dep}&existing_coverage=${ex}`,'POST');
  if (!data) return;
  const gap = data.coverage_gap > 0;
  document.getElementById('ins-result').innerHTML = resultHighlight(fmt(data.recommended_coverage), 'Recommended Life Cover') + resultBox([
    ['Income Replacement Need', fmt(data.income_replacement_need)],
    ['Education Fund', fmt(data.education_fund_need)],
    ['Spouse Security', fmt(data.spouse_security_need)],
    ['Total Need', fmt(data.total_need)],
    ['Existing Coverage', fmt(data.existing_coverage)],
    ['Coverage Gap', fmt(data.coverage_gap)],
  ]) + `<div class="${gap?'warn-msg':'success-msg'}" style="margin-top:8px">💡 ${data.recommendation}</div>`;
}

async function loadInsuranceComparison() {
  const data = await api('/api/v1/insurance/comparison');
  if (!data) return;
  document.getElementById('ins-comparison').innerHTML = data.products.map(p => `
    <div style="padding:12px;border:1px solid var(--border);border-radius:8px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-weight:600;color:var(--text);font-size:0.88rem">${p.name}</span>
        <span style="font-family:var(--font-mono);color:var(--gold2);font-size:0.85rem">₹${p.premium_monthly}/mo</span>
      </div>
      <div style="font-size:0.78rem;color:var(--text3);margin-bottom:6px">Cover: ${p.coverage} · Best for: ${p.best_for}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${p.features.map(f=>`<span class="badge badge-blue" style="font-size:0.67rem">${f}</span>`).join('')}</div>
    </div>`).join('');
}

// ====== CHAT ======
async function sendChat() {
  const inp = document.getElementById('chat-inp');
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = '';

  const msgsEl = document.getElementById('chat-msgs');
  msgsEl.innerHTML += `<div class="msg user"><div class="msg-label">You</div><div class="msg-bubble">${msg.replace(/\n/g,'<br>')}</div></div>`;

  const typId = 'typ-' + Date.now();
  msgsEl.innerHTML += `<div class="msg ai" id="${typId}"><div class="msg-label">Artha AI</div><div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>`;
  msgsEl.scrollTop = msgsEl.scrollHeight;

  const data = await api('/api/v1/chat','POST',{message:msg});
  document.getElementById(typId).remove();

  const reply = data?.response || 'Sorry, I could not process your request right now. Please ensure the backend is running.';
  msgsEl.innerHTML += `<div class="msg ai"><div class="msg-label">Artha AI</div><div class="msg-bubble">${reply.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>')}</div></div>`;
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

// ====== Chart helpers ======
function chartOpts() {
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#94a3b8',font:{size:11},boxWidth:16}}, tooltip:{backgroundColor:'#1a2230',borderColor:'#243447',borderWidth:1,titleColor:'#e8edf2',bodyColor:'#94a3b8'}},
    scales:{x:{...axisOpts()}, y:{...axisOpts()}}
  };
}
function axisOpts() {
  return {grid:{color:'rgba(30,45,61,0.8)'}, ticks:{color:'#64748b',font:{size:10}}, border:{color:'rgba(30,45,61,0.5)'}};
}
function resultBox(rows) {
  return '<div class="result-box">' + rows.map(([l,v]) => `<div class="result-row"><span class="result-label">${l}</span><span class="result-value">${v}</span></div>`).join('') + '</div>';
}
function resultHighlight(val, label) {
  return `<div class="result-highlight" style="margin-top:12px"><div class="result-main-label">${label}</div><div class="result-main">${val}</div></div>`;
}

// ====== Init ======
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
});
