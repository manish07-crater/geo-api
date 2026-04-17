
    // ========== SERVER INTEGRATION ==========
    const API_KEY = "a092509e3009c0da37ad95ae9b5d8e3e";
    const BASE_URL = "http://localhost:3000";

    // ========== ANIMATED STARS BACKGROUND ==========
    const starsEl = document.getElementById('stars');
    for (let i = 0; i < 200; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.setProperty('--opacity', (Math.random() * 0.5 + 0.1).toFixed(2));
        star.style.setProperty('--duration', (Math.random() * 4 + 2) + 's');
        star.style.width = star.style.height = (Math.random() * 1.5 + 0.5) + 'px';
        starsEl.appendChild(star);
    }

    // ========== ROUTING / NAVIGATION ==========
    function showSection(name) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById('section-' + name).classList.add('active');
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => {
          if (l.textContent.trim().toLowerCase() === name) l.classList.add('active');
        });
        window.scrollTo(0, 0);
        if (name === 'dashboard') loadDashboardData();
    }

    // ========== SEARCH SERVER INTEGRATION ==========
    const searchInput = document.getElementById('villageSearch');
    const searchResults = document.getElementById('searchResults');
    let searchTimeout;

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => performSearch(searchInput.value), 250);
    });

    async function performSearch(query) {
        if (!query.trim()) {
            searchResults.innerHTML = `
            <div class="search-hint">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                Start typing to search villages
            </div>`;
            return;
        }

        try {
            const res = await fetch(`${BASE_URL}/api/search?q=${query}`, {
                headers: { "x-api-key": API_KEY }
            });

            if (!res.ok) {
                console.error("Search failed:", await res.text());
                return;
            }

            const result = await res.json();
            const data = result.data || [];

            if (data.length === 0) {
                searchResults.innerHTML = `
                <div class="search-hint">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="1.5"/></svg>
                    No villages found for "${query}"
                </div>`;
                return;
            }

            searchResults.innerHTML = data.map(v => `
            <div class="search-result-item">
                <div class="result-village">${highlightMatch(v.village, query)}</div>
                <div class="result-path">
                <span>${v.state}</span>
                <span class="path-sep">›</span>
                <span>${v.district}</span>
                <span class="path-sep">›</span>
                <span>${v.sub_district}</span>
                <span class="path-sep">›</span>
                <span style="color:var(--text-primary)">${v.village}</span>
                </div>
            </div>
            `).join('');

        } catch (err) {
            console.error("Error connecting to server:", err);
            searchResults.innerHTML = `<div class="search-hint">Error connecting to server</div>`;
        }
    }

    function highlightMatch(text, query) {
        if(!text) return "";
        const idx = text.toLowerCase().indexOf(query.toLowerCase());
        if (idx === -1) return text;
        return text.slice(0, idx) + '<span style="color:var(--accent-bright);text-decoration:underline">' + text.slice(idx, idx + query.length) + '</span>' + text.slice(idx + query.length);
    }

    // ========== DASHBOARD SERVER INTEGRATION ==========
    let usageChartInstance;
    let endpointChartInstance;

    async function loadDashboardData() {
        try {
            const res = await fetch(`${BASE_URL}/admin/keys`, {
                headers: { "x-api-key": API_KEY }
            });

            if (!res.ok) {
                console.error("Dashboard error:", await res.text());
                return;
            }

            const data = await res.json();

            // Populate Table
            const tbody = document.getElementById('keysTableBody');
            tbody.innerHTML = data.map(k => {
                const limit = parseInt(k.daily_limit);
                const usage = parseInt(k.usage_count);
                const pct = Math.min((usage / limit) * 100, 100);
                const barColor = pct > 80 ? 'var(--danger)' : pct > 50 ? 'var(--warning)' : 'var(--success)';
                const planType = typeof k.plan === 'string' ? k.plan.toLowerCase() : 'free';
                const planClass = planType === 'pro' ? 'plan-pro' : planType === 'unlimited' ? 'plan-enterprise' : 'plan-free';
                
                return `
                <tr>
                    <td><span class="key-value">${k.api_key.substring(0,8)}...</span></td>
                    <td style="color:var(--text-primary);font-weight:500;">${k.name || 'API Client'}</td>
                    <td><span class="plan-badge ${planClass}">${k.plan || 'Free'}</span></td>
                    <td><span class="status-active"><span class="status-dot"></span>Active</span></td>
                    <td>
                    <div class="usage-bar-wrap"><div class="usage-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
                    ${usage.toLocaleString()} / ${limit.toLocaleString()}
                    </td>
                    <td style="color:var(--text-muted);">${new Date().toISOString().split('T')[0]}</td>
                </tr>`;
            }).join('');
            
            document.getElementById('keyCount').textContent = data.length + ' keys';

            // Also load the DB Stats to populate the dashboard top squares
            const statsRes = await fetch(`${BASE_URL}/admin/stats`, {
                headers: { "x-api-key": API_KEY }
            });
            if (statsRes.ok) {
                const stats = await statsRes.json();
                
                // Update Dashboard Top squares
                animateValue('dashTotalStates', 0, stats.states, 1000);
                animateValue('dashTotalDistricts', 0, stats.districts, 1000);
                animateValue('dashTotalSubDistricts', 0, stats.subDistricts, 1000);
                animateValue('dashTotalVillages', 0, stats.villages, 1000);

                // Populate Charts with Real Geographical data!
                const labels = [];
                const counts = [];
                if (stats.distribution && stats.distribution.length > 0) {
                    stats.distribution.forEach(d => {
                        labels.push(d.state.substring(0, 15));
                        counts.push(d.count);
                    });
                }
                initRealCharts(labels, counts);
            }

        } catch (e) {
            console.error("Could not fetch dashboard data:", e);
        }
    }

    // ========== GLOBAL STATS (Home Page) ==========
    async function loadGlobalStats() {
        try {
            const res = await fetch(`${BASE_URL}/admin/stats`, {
                headers: { "x-api-key": API_KEY }
            });
            if(res.ok) {
                const stats = await res.json();
                animateValue('stat-villages', 0, stats.villages || 0, 1500, '+');
                animateValue('stat-states', 0, stats.states || 0, 1000, '');
                animateValue('stat-districts', 0, stats.districts || 0, 1000, '');
                animateValue('stat-subdistricts', 0, stats.subDistricts || 0, 1500, '');
            }
        } catch (e) {
            console.error("Failed to load global stats:", e);
        }
    }

    // ========== UPGRADE PLAN (Server Integration) ==========
    async function upgradeDashboardPlan() {
        const key = document.getElementById("upgradeApiKey").value;
        const newPlan = document.getElementById("upgradeSelectedPlan").value;
        
        if(!key) return alert("Please enter API Key");

        try {
            const res = await fetch(`${BASE_URL}/api/auth/upgrade-plan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiKey: key, newPlan: newPlan })
            });
            
            const data = await res.json();
            if(data.success) {
                showToast(data.message);
                loadDashboardData(); // Reload
            } else {
                alert("Error: " + data.error);
            }
        } catch(e) {
            alert("Upgrade Failed: " + e.message);
        }
    }


    // ========== CHARTS UTILS ==========
    function initRealCharts(labels, usages) {
      if (usageChartInstance) usageChartInstance.destroy();
      if (endpointChartInstance) endpointChartInstance.destroy();

      usageChartInstance = new Chart(document.getElementById('usageChart'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: usages,
            backgroundColor: 'rgba(91, 141, 239, 0.4)',
            borderColor: '#5B8DEF',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } }
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.05)', borderDash: [4, 4] },
              ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } }
            }
          }
        }
      });

      endpointChartInstance = new Chart(document.getElementById('endpointChart'), {
        type: 'doughnut',
        data: {
          labels: ['/search', '/admin/keys', '/states', '/upgrade-plan'],
          datasets: [{
            data: [65, 20, 10, 5], // Mock distribution
            backgroundColor: ['#5B8DEF', '#A78BFA', '#34D399', '#F59E0B'],
            borderColor: 'transparent',
            borderWidth: 0,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: 'rgba(255,255,255,0.5)',
                font: { size: 11 },
                usePointStyle: true,
              }
            }
          }
        }
      });
    }

    // ========== UTILS & MODALS ==========
    function openModal() {
      document.getElementById('keyModal').classList.add('active');
    }
    function closeModal() {
      document.getElementById('keyModal').classList.remove('active');
    }
    document.getElementById('keyModal').addEventListener('click', e => {
      if (e.target === document.getElementById('keyModal')) closeModal();
    });

    function showToast(msg) {
      const toast = document.getElementById('toast');
      document.getElementById('toastMsg').textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    }

    function animateValue(id, start, end, duration, suffix = '') {
      const el = document.getElementById(id);
      if (!el || end === 0) {
        if(el) el.textContent = '0' + suffix;
        return;
      }
      const range = end - start;
      const increment = range / (duration / 16);
      let current = start;
      const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
          clearInterval(timer);
          current = end;
        }
        if (end >= 1000000) {
          el.textContent = (current / 1000000).toFixed(1) + 'M' + suffix;
        } else {
          el.textContent = Math.floor(current).toLocaleString() + suffix;
        }
      }, 16);
    }

    // Load dashboard natively immediately
    document.addEventListener('DOMContentLoaded', () => {
        loadDashboardData();
        loadGlobalStats();
    });

  