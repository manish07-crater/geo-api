// ========== SERVER INTEGRATION ==========
let API_KEY = localStorage.getItem("geo_api_key") || "";
let JWT_TOKEN = localStorage.getItem("geo_user_token") || null;
let USER_EMAIL = localStorage.getItem("geo_user_email") || null;
const BASE_URL = "http://localhost:3000";

function updateNavUI() {
  const authNav = document.getElementById("authNavSection");
  if(JWT_TOKEN) {
     authNav.innerHTML = `<span style="color:var(--text-muted);margin-right:15px;font-size:14px;">${USER_EMAIL}</span>
     <button class="nav-cta" onclick="openModal()">+ New Key</button>
     <button class="nav-link" onclick="logout()" style="margin-left:10px;">Logout</button>`;
  } else {
     authNav.innerHTML = `<button class="nav-cta" onclick="openAuthModal('login')">Sign In</button>`;
  }
}

// ========== ANIMATED STARS BACKGROUND ==========
const starsEl = document.getElementById('stars');
if(starsEl) {
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

if(searchInput) {
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => performSearch(searchInput.value), 250);
    });
}

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

        searchResults.innerHTML = data.map(v => {
            const encodedV = encodeURIComponent(JSON.stringify(v));
            return `
            <div class="search-result-item" style="cursor: pointer;" onclick="openBiodataModal('${encodedV}')">
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
            `;
        }).join('');

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
        if(!JWT_TOKEN) return; // Need login for dashboard

        const res = await fetch(`${BASE_URL}/admin/keys`, {
            headers: { "Authorization": "Bearer " + JWT_TOKEN }
        });

        if (!res.ok) {
            console.error("Dashboard error:", await res.text());
            return;
        }

        const data = await res.json();

        // Populate Table
        const tbody = document.getElementById('keysTableBody');
        if(tbody) {
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
        }
        
        const keyCountEl = document.getElementById('keyCount');
        if(keyCountEl) keyCountEl.textContent = data.length + ' keys';

        // Also load the DB Stats to populate the dashboard top squares
        const statsRes = await fetch(`${BASE_URL}/admin/stats`); // Public stats endpoint
        if (statsRes.ok) {
            const stats = await statsRes.json();
            
            // Populate Dashboard Cards
            document.getElementById('dash-users').textContent = stats.users.toLocaleString();
            document.getElementById('dash-keys').textContent = stats.totalKeys.toLocaleString();
            document.getElementById('dash-revenue').textContent = stats.revenue;
            
            // Calc current usage for the "Your Quota" card (using first key as sample or avg)
            if(data.length > 0) {
                const firstKey = data[0];
                const usage = parseInt(firstKey.usage_count);
                const limit = parseInt(firstKey.daily_limit);
                const pct = Math.floor((usage / limit) * 100);
                document.getElementById('dash-quota').textContent = pct + '%';
            } else {
                document.getElementById('dash-quota').textContent = '0%';
            }

            // Populate Charts with static API usage data to match the image
            const lineLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const lineCounts = [8000, 10000, 11000, 10500, 13000, 7000, 9000];
            initRealCharts(lineLabels, lineCounts);
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
async function startPaymentFlow(plan) {
    if(!JWT_TOKEN) {
        showToast("Please Sign In first to upgrade");
        return openAuthModal('login');
    }
    
    // Ensure the dashboard inputs are updated if they exist
    const planInput = document.getElementById('upgradeSelectedPlan');
    if(planInput) planInput.value = plan;

    // If they have an API key in localStorage, use it. Otherwise, prompt them.
    let key = localStorage.getItem("geo_api_key");
    if(!key) {
        alert("Please generate or select an API Key in the dashboard first to upgrade it.");
        showSection('dashboard'); // Need to go to dashboard to generate key
        return;
    }

    const keyInput = document.getElementById("upgradeApiKey");
    if(keyInput) keyInput.value = key;
    
    // Trigger the real razorpay logic
    upgradeDashboardPlan();
}

async function upgradeDashboardPlan() {
    if(!JWT_TOKEN) return openAuthModal('login');

    const key = document.getElementById("upgradeApiKey").value;
    const newPlan = document.getElementById("upgradeSelectedPlan").value;
    
    if(!key) return alert("Please enter API Key to upgrade");
    
    showToast("Initializing payment for " + newPlan + "...");
    try {
        // 1. Create order
        const orderRes = await fetch(`${BASE_URL}/api/payments/create-order`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": "Bearer " + JWT_TOKEN
            },
            body: JSON.stringify({ apiKey: key, plan: newPlan })
        });
        const orderData = await orderRes.json();
        
        if(!orderData.success) {
            return alert("Order Creation Failed: " + orderData.error);
        }

        // 2. Open Razorpay UI
        const options = {
            "key": "rzp_live_SedaygfjNqrMwu", // Matching backend key id
            "amount": orderData.order.amount,
            "currency": "INR",
            "name": "GeoPin SaaS",
            "description": "Upgrade API Plan to " + newPlan,
            "order_id": orderData.order.id,
            "handler": async function (response) {
                // 3. Verify Payment
                try {
                    const verifyRes = await fetch(`${BASE_URL}/api/payments/verify`, {
                        method: "POST",
                        headers: { 
                            "Content-Type": "application/json",
                            "Authorization": "Bearer " + JWT_TOKEN
                        },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            plan: newPlan,
                            apiKey: key
                        })
                    });
                    
                    const verifyData = await verifyRes.json();
                    if(verifyData.success) {
                        showToast(verifyData.message);
                        loadDashboardData();
                    } else {
                        alert("Payment Verification Failed: " + verifyData.error);
                    }
                } catch(e) {
                     alert("Error verifying payment: " + e.message);
                }
            },
            "theme": { "color": "#5B8DEF" }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response){
            alert("Payment Cancelled or Failed");
        });
        rzp.open();

    } catch(e) {
        alert("Checkout Initialization Failed: " + e.message);
    }
}


// ========== CHARTS UTILS ==========
function initRealCharts(labels, usages) {
  if (usageChartInstance) usageChartInstance.destroy();
  if (endpointChartInstance) endpointChartInstance.destroy();

  const usageCtx = document.getElementById('usageChart');
  if(usageCtx) {
    usageChartInstance = new Chart(usageCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: usages,
            backgroundColor: 'rgba(91, 141, 239, 0.1)',
            borderColor: '#5B8DEF',
            borderWidth: 2,
            pointBackgroundColor: '#5B8DEF',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            tension: 0.4, // Smooth curve
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } }
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.05)', borderDash: [4, 4] },
              ticks: { 
                 color: 'rgba(255,255,255,0.5)', 
                 font: { size: 11 },
                 callback: function(value) {
                     return (value / 1000) + 'k'; // Formatting to '10k'
                 }
              }
            }
          }
        }
      });
  }

  const endpointCtx = document.getElementById('endpointChart');
  if(endpointCtx) {
    endpointChartInstance = new Chart(endpointCtx, {
        type: 'doughnut',
        data: {
          labels: ['/api/villages', '/api/search', '/api/states', '/api/districts', 'Other'],
          datasets: [{
            data: [35, 20, 15, 10, 20], 
            backgroundColor: ['#5B8DEF', '#F59E0B', '#34D399', '#A78BFA', '#F472B6'],
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
}

// ========== UTILS & MODALS ==========
function openModal() {
  const el = document.getElementById('keyModal');
  if(el) el.classList.add('active');
}
function closeModal() {
  const el = document.getElementById('keyModal');
  if(el) el.classList.remove('active');
}

// Biodata Modal Handling
function openBiodataModal(encodedData) {
  const data = JSON.parse(decodeURIComponent(encodedData));
  document.getElementById('bioVillage').textContent = data.village;
  document.getElementById('bioSubDistrict').textContent = data.sub_district;
  document.getElementById('bioDistrict').textContent = data.district;
  document.getElementById('bioState').textContent = data.state;
  document.getElementById('bioCountry').textContent = data.country || "India";
  
  document.getElementById('biodataModal').classList.add('active');
}

function closeBiodataModal() {
  document.getElementById('biodataModal').classList.remove('active');
}

const bioModal = document.getElementById('biodataModal');
if(bioModal) {
    bioModal.addEventListener('click', e => {
      if (e.target === bioModal) closeBiodataModal();
    });
}

async function generateApiKey() {
  if(!JWT_TOKEN) return openAuthModal("login");

  const name = document.getElementById("newKeyName").value;
  if(!name) return showToast("Please enter an App Name");

  try {
      const res = await fetch(`${BASE_URL}/api/auth/generate-key`, {
          method: "POST",
          headers: { 
              "Content-Type": "application/json",
              "Authorization": "Bearer " + JWT_TOKEN
          },
          body: JSON.stringify({ name: name })
      });
      
      const data = await res.json();
      if(data.success) {
          API_KEY = data.data.apiKey;
          localStorage.setItem("geo_api_key", API_KEY);
          showToast("Key generated! " + API_KEY.substring(0,8) + "...");
          closeModal();
          document.getElementById("newKeyName").value = ''; // reset input
          loadDashboardData(); // reload the dashboard
      } else {
          alert("Error: " + data.error);
      }
  } catch(e) {
      alert("Generation Failed: " + e.message);
  }
}

const keyModal = document.getElementById('keyModal');
if(keyModal) {
    keyModal.addEventListener('click', e => {
      if (e.target === keyModal) closeModal();
    });
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  if(toast && toastMsg) {
    toastMsg.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
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
    updateNavUI();
    if(JWT_TOKEN) loadDashboardData();
    loadGlobalStats();
});

// ========== AUTHENTICATION LOGIC ==========
let authMode = 'login';
function openAuthModal(mode) {
    authMode = mode;
    const _name = document.getElementById("authName");
    const _nameLbl = document.getElementById("authNameLabel");
    const _title = document.getElementById("authModalTitle");
    const _desc = document.getElementById("authModalDesc");
    const _btn = document.getElementById("authSubmitBtn");
    const _tog = document.getElementById("authToggleText");

    if(!_name || !_nameLbl || !_title || !_desc || !_btn || !_tog) return;

    if(mode === 'register') {
        _name.style.display = 'block';
        _nameLbl.style.display = 'block';
        _title.textContent = "Create an Account";
        _desc.textContent = "Start your free API journey.";
        _btn.textContent = "Sign Up";
        _tog.textContent = "Already have an account? Login";
    } else {
        _name.style.display = 'none';
        _nameLbl.style.display = 'none';
        _title.textContent = "Sign In";
        _desc.textContent = "Welcome back to GeoPin.";
        _btn.textContent = "Login";
        _tog.textContent = "Don't have an account? Sign up";
    }
    document.getElementById("authModal").classList.add("active");
}

function toggleAuthMode() {
    openAuthModal(authMode === 'login' ? 'register' : 'login');
}

function closeAuthModal() {
    document.getElementById("authModal").classList.remove("active");
}

async function submitAuth() {
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;
    const name = document.getElementById("authName").value;

    if(!email || !password) return showToast("Email and password required");
    if(authMode === 'register' && !name) return showToast("Name required");

    try {
        const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
        const bodyData = authMode === 'login' ? {email, password} : {name, email, password};

        const res = await fetch(BASE_URL + endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyData)
        });
        const data = await res.json();
        
        if(data.success) {
            if(authMode === 'register') {
                showToast("Account created! Please log in.");
                openAuthModal('login');
            } else {
                JWT_TOKEN = data.token;
                USER_EMAIL = data.user.email;
                localStorage.setItem("geo_user_token", JWT_TOKEN);
                localStorage.setItem("geo_user_email", USER_EMAIL);
                closeAuthModal();
                updateNavUI();
                loadDashboardData();
                showToast("Logged in successfully");
            }
        } else {
            alert(data.error);
        }
    } catch(e) {
        alert("Error connecting to auth servers");
    }
}

function logout() {
    JWT_TOKEN = null;
    USER_EMAIL = null;
    localStorage.removeItem("geo_user_token");
    localStorage.removeItem("geo_user_email");
    localStorage.removeItem("geo_api_key"); // also remove active key
    updateNavUI();
    showSection('home');
    showToast("Logged out");
}

const authModal = document.getElementById('authModal');
if(authModal) {
    authModal.addEventListener('click', e => {
      if (e.target === authModal) closeAuthModal();
    });
}
