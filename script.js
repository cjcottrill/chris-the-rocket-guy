// =============================================
// CHRIS THE ROCKET GUY - MAIN SCRIPT
// =============================================

// =============================================
// CONFIGURATION
// =============================================
const API_BASE = 'https://ll.thespacedevs.com/2.2.0';
const RESULTS_PER_PAGE = 12;

// =============================================
// LAUNCH EXTRAS - Manual overrides & notes
// Loaded from launch-extras.json at startup
// =============================================
let launchExtras = {};

async function loadLaunchExtras() {
    try {
        const response = await fetch('launch-extras.json');
        if (!response.ok) throw new Error('No extras file found');
        launchExtras = await response.json();
        console.log('📋 Loaded launch-extras.json —', Object.keys(launchExtras).length, 'entries');
    } catch (error) {
        console.log('📋 No launch-extras.json found — using auto-detection only');
        launchExtras = {};
    }
}

// =============================================
// LAUNCH EXTRAS LOOKUP HELPER
// =============================================
function findLaunchExtras(launch) {
    const launchId = launch.id || '';
    const slug = launch.slug || '';
    const nameSlug = (launch.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const extras = launchExtras[launchId] || launchExtras[slug] || launchExtras[nameSlug];

    if (extras) {
        console.log(`📋 Found extras for "${launch.name}" via key match`);
    }

    return extras || null;
}

// =============================================
// SUNSET CALCULATOR (Cape Canaveral)
// =============================================
function getSunsetTime(dateObj) {
    const lat = 28.3922;
    const lng = -80.6077;

    const dayOfYear = Math.floor((dateObj - new Date(dateObj.getFullYear(), 0, 0)) / 86400000);

    // Solar declination
    const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);

    // Hour angle for sunset
    const latRad = lat * Math.PI / 180;
    const declRad = declination * Math.PI / 180;
    const hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(declRad)) * 180 / Math.PI;

    // Solar noon in UTC (approximate)
    const solarNoonUTC = 12 - (lng / 15);

    // Sunset in UTC hours
    const sunsetUTC = solarNoonUTC + (hourAngle / 15);

    // Convert to EST/EDT
    const isDST = isDaylightSavingTime(dateObj);
    const offset = isDST ? 4 : 5;
    const sunsetLocal = sunsetUTC - offset;

    // Build a Date object for sunset on that day
    const sunset = new Date(dateObj);
    const sunsetHours = Math.floor(sunsetLocal);
    const sunsetMins = Math.round((sunsetLocal - sunsetHours) * 60);
    sunset.setHours(sunsetHours, sunsetMins, 0, 0);

    console.log(`🌅 Sunset for ${dateObj.toDateString()}: ${sunset.toLocaleTimeString()} (${isDST ? 'EDT' : 'EST'})`);
    return sunset;
}

function isDaylightSavingTime(date) {
    const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
    const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
    return date.getTimezoneOffset() < Math.max(jan, jul);
}

function isBeforeSunset(launchDate) {
    if (!launchDate) return true; // default to daytime tips
    const launch = new Date(launchDate);
    const sunset = getSunsetTime(launch);
    const isBefore = launch < sunset;
    console.log(`🌅 Launch at ${launch.toLocaleTimeString()} is ${isBefore ? 'BEFORE' : 'AFTER'} sunset`);
    return isBefore;
}

// =============================================
// TRAJECTORY DETECTION ENGINE
// =============================================

function getTrajectoryInfo(launch) {
    const missionName = (launch.name || '').toLowerCase();
    const missionDesc = (launch.mission?.description || '').toLowerCase();
    const rocketName = (launch.rocket?.configuration?.name || '').toLowerCase();

    const extras = findLaunchExtras(launch);

    if (extras) {
        return {
            trajectory: extras.trajectory || null,
            direction: extras.direction || null,
            isRTLS: extras.rtls || false,
            chrisSays: extras.chrisSays || null,
            videoUrl: extras.video_url || null,
            launchNet: launch.net || null,
            source: 'manual'
        };
    }

    const starlinkMatch = missionName.match(/starlink\s+group\s+(\d+)/i);
    if (starlinkMatch) {
        const groupNum = parseInt(starlinkMatch[1]);

        if ([6, 10, 12].includes(groupNum)) {
            return {
                trajectory: 'southeast',
                direction: null,
                isRTLS: false,
                chrisSays: null,
                videoUrl: null,
                launchNet: launch.net || null,
                source: 'auto-starlink'
            };
        }

        if ([8].includes(groupNum)) {
            return {
                trajectory: 'northeast',
                direction: '👈 Look LEFT from the beach',
                isRTLS: false,
                chrisSays: buildStarlinkTips('northeast', groupNum),
                videoUrl: null,
                launchNet: launch.net || null,
                source: 'auto-starlink'
            };
        }

        if ([9, 11].includes(groupNum)) {
            return {
                trajectory: 'vandenberg',
                direction: 'Launches from California — not visible from Florida',
                isRTLS: false,
                chrisSays: null,
                videoUrl: null,
                launchNet: launch.net || null,
                source: 'auto-starlink'
            };
        }

        return {
            trajectory: 'unknown',
            direction: null,
            isRTLS: false,
            chrisSays: {
                summary: 'This is a Starlink mission. Watch for the first stage landing on the drone ship about 8.5 minutes after launch!',
                tips: []
            },
            videoUrl: null,
            launchNet: launch.net || null,
            source: 'auto-starlink'
        };
    }

    const isCrewMission = /crew[\s-]*\d/i.test(missionName) ||
                          /crew\s+dragon/i.test(missionName) ||
                          missionName.includes('uscv') ||
                          (missionDesc.includes('crew') && missionDesc.includes('station'));

    if (isCrewMission && rocketName.includes('falcon')) {
        return {
            trajectory: 'northeast',
            direction: '👈 Look LEFT from the beach',
            isRTLS: true,
            chrisSays: buildRTLSTips('crew'),
            videoUrl: null,
            launchNet: launch.net || null,
            source: 'auto-crew'
        };
    }

    const isHeavy = rocketName.includes('falcon heavy');
    if (isHeavy) {
        return {
            trajectory: 'variable',
            direction: null,
            isRTLS: true,
            chrisSays: buildRTLSTips('heavy'),
            videoUrl: null,
            launchNet: launch.net || null,
            source: 'auto-heavy'
        };
    }

    return {
        trajectory: null,
        direction: null,
        isRTLS: false,
        chrisSays: null,
        videoUrl: null,
        launchNet: launch.net || null,
        source: 'none'
    };
}

// =============================================
// BUILD SOUTHEAST STARLINK TIPS (time-aware)
// =============================================

function buildSoutheastTips(launchNet) {
    const daytime = isBeforeSunset(launchNet);

    const baseSummary = 'Facing north on the beach (spot the Jetty Park lifeguard shack), the rocket will lift off from about your 11 o\'clock and head out over the ocean southward toward your 5 o\'clock.';

    let timeTip = '';
    if (daytime) {
        timeTip = 'Assuming clear skies prevail, you may see some of the second stage burn, but it\'s very faint and high in altitude, so the view won\'t last long. Enjoy the view of the rocket\'s body in the sunlight!';
    } else {
        timeTip = 'Watch for developing colors in the rocket\'s plume as it gains altitude — you should expect to see lots of orange and yellow, but you may also see blue, purple, and green!';
    }

    const tips = [timeTip];

    if (!daytime) {
        tips.push('At T+ 00:06:15, watch close to the horizon — you might just see the booster perform its "return burn," slowing itself as it begins its free fall back to Earth. This event appears low on the horizon, but it\'s actually happening at an altitude of 40 miles!');
    }

    return {
        summary: baseSummary,
        tips: tips,
        balconies: {
            intro: 'Preferred balcony viewing:',
            spots: [
                { building: 'Building 1', detail: 'Levels 3 & 4, pool-facing — best views' },
                { building: 'Building 2', detail: 'Levels 3 & 4, ocean-facing — best views' }
            ],
            beachNote: 'For everyone else, I recommend the beach. Unless you have a beach at home with a rocket launch facility next door, you can\'t have this experience anywhere else in the world.',
            balconyNote: 'Some north-facing balconies will have a view of the launch site — you may find this view equally satisfying without seeing the longer duration of the flight.'
        },
        isDaytime: daytime
    };
}

// =============================================
// BUILD CHRIS'S TIPS (non-southeast)
// =============================================

function buildStarlinkTips(direction, groupNum) {
    const dirText = direction === 'northeast'
        ? 'This Starlink mission heads NORTHEAST along the coast. From the beach, look to your LEFT.'
        : 'This Starlink mission heads SOUTHEAST over the ocean.';

    return {
        summary: dirText,
        tips: [
            'The rocket will be visible for about 3-4 minutes after launch.',
            'Watch for stage separation — you\'ll see the second stage engine ignite as a bright dot pulling away.',
            'The first stage will land on a drone ship in the Atlantic about 8.5 minutes after launch.',
            'Best spot: anywhere on the beach with a clear view of the horizon toward the launch pads.'
        ]
    };
}

function buildRTLSTips(type) {
    const intro = type === 'crew'
        ? 'This is a crew mission! The booster comes BACK to the Cape — you get a double show!'
        : 'This is a Falcon Heavy mission! The side boosters often come BACK to the Cape — double sonic booms!';

    return {
        summary: intro,
        tips: [
            'The booster returns to Landing Zone 1, right at the Cape.',
            'Listen for the sonic boom around T+8 to 9 minutes — it\'s LOUD!',
            'You\'ll hear the engines roar TWICE — once at launch, once at landing.'
        ],
        rtlsTimeline: [
            { time: 'T+2:30', desc: 'Stage separation — look for the "SpaceX Nebula" (puff of gas in the sky)' },
            { time: 'T+6:30', desc: 'Entry burn — 3 engines light up at ~40 miles altitude' },
            { time: 'T+8:30', desc: 'Landing burn — single engine, about 2 miles from the pad' },
            { time: 'T+9:00', desc: '💥 SONIC BOOM + engine roar — you\'ll feel it in your chest!' }
        ]
    };
}

// =============================================
// RENDER "CHRIS SAYS" HTML (Card view)
// =============================================

function renderChrisSaysCard(trajectoryInfo) {
    // Southeast gets special rendering
    if (trajectoryInfo.trajectory === 'southeast') {
        return renderSoutheastCard(trajectoryInfo);
    }

    if (!trajectoryInfo.chrisSays && !trajectoryInfo.direction) return '';

    const info = trajectoryInfo.chrisSays;
    const uniqueId = 'cs-' + Math.random().toString(36).substr(2, 9);

    let contentHtml = '';

    if (trajectoryInfo.direction) {
        contentHtml += `
            <div class="tip-box">
                <div class="tip-label">📍 Where to Look</div>
                <p>${trajectoryInfo.direction}</p>
            </div>
        `;
    }

    if (info && info.summary) {
        contentHtml += `<p>${info.summary}</p>`;
    }

    if (info && info.tips && info.tips.length > 0) {
        contentHtml += `<p>💡 ${info.tips[0]}</p>`;
    }

    if (info && info.rtlsTimeline) {
        contentHtml += `
            <div class="rtls-timeline">
                ${info.rtlsTimeline.map(event => `
                    <div class="rtls-event">
                        <span class="rtls-time">${event.time}</span>
                        <span class="rtls-desc">${event.desc}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    return `
        <div class="chris-says" onclick="event.stopPropagation()">
            <button class="chris-says-toggle" onclick="toggleChrisSays('${uniqueId}', this)">
                <span class="arrow" id="arrow-${uniqueId}">▶</span>
                🎙️ Chris says...
            </button>
            <div class="chris-says-content" id="${uniqueId}">
                ${contentHtml}
            </div>
        </div>
    `;
}

function renderSoutheastCard(trajectoryInfo) {
    const seTips = buildSoutheastTips(trajectoryInfo.launchNet);
    const uniqueId = 'cs-' + Math.random().toString(36).substr(2, 9);

    let contentHtml = `
        <div class="tip-box">
            <div class="tip-label">📍 Where to Look</div>
            <p>${seTips.summary}</p>
        </div>
        <p>${seTips.isDaytime ? '☀️' : '🌙'} ${seTips.tips[0]}</p>
    `;

    return `
        <div class="chris-says" onclick="event.stopPropagation()">
            <button class="chris-says-toggle" onclick="toggleChrisSays('${uniqueId}', this)">
                <span class="arrow" id="arrow-${uniqueId}">▶</span>
                🎙️ Chris says...
            </button>
            <div class="chris-says-content" id="${uniqueId}">
                ${contentHtml}
            </div>
        </div>
    `;
}

// =============================================
// RENDER "CHRIS SAYS" HTML (Modal view - full detail)
// =============================================

function renderChrisSaysModal(trajectoryInfo) {
    // Southeast gets special full rendering
    if (trajectoryInfo.trajectory === 'southeast') {
        return renderSoutheastModal(trajectoryInfo);
    }

    if (!trajectoryInfo.chrisSays && !trajectoryInfo.direction) return '';

    const info = trajectoryInfo.chrisSays;

    let contentHtml = '';

    if (trajectoryInfo.direction) {
        contentHtml += `
            <div class="tip-box">
                <div class="tip-label">📍 Where to Look</div>
                <p>${trajectoryInfo.direction}</p>
            </div>
        `;
    }

    if (trajectoryInfo.isRTLS) {
        contentHtml += `
            <div class="tip-box">
                <div class="tip-label">🔁 Return to Launch Site</div>
                <p>The booster lands back at the Cape — watch AND listen!</p>
            </div>
        `;
    }

    if (info && info.summary) {
        contentHtml += `<p>${info.summary}</p>`;
    }

    if (info && info.tips) {
        info.tips.forEach(tip => {
            contentHtml += `<p>💡 ${tip}</p>`;
        });
    }

    if (info && info.rtlsTimeline) {
        contentHtml += `
            <div class="rtls-timeline">
                <div class="tip-label" style="margin-bottom: 6px;">⏱️ RTLS Timeline</div>
                ${info.rtlsTimeline.map(event => `
                    <div class="rtls-event">
                        <span class="rtls-time">${event.time}</span>
                        <span class="rtls-desc">${event.desc}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    return `
        <div class="modal-chris-says">
            <h4>🎙️ Chris Says...</h4>
            ${contentHtml}
        </div>
    `;
}

function renderSoutheastModal(trajectoryInfo) {
    const seTips = buildSoutheastTips(trajectoryInfo.launchNet);

    let contentHtml = `
        <div class="tip-box">
            <div class="tip-label">📍 Where to Look</div>
            <p>${seTips.summary}</p>
        </div>
    `;

    // Time-of-day section
    contentHtml += `
        <div class="tip-box">
            <div class="tip-label">${seTips.isDaytime ? '☀️ Daytime Launch' : '🌙 Night Launch'}</div>
            <p>${seTips.tips[0]}</p>
        </div>
    `;

    // Night launch bonus: entry burn detail
    if (!seTips.isDaytime && seTips.tips.length > 1) {
        contentHtml += `
            <div class="tip-box">
                <div class="tip-label">🔥 Booster Return Burn</div>
                <p>${seTips.tips[1]}</p>
            </div>
        `;
    }

    // Balcony & beach viewing guide
    if (seTips.balconies) {
        contentHtml += `
            <div class="tip-box">
                <div class="tip-label">🏨 Viewing Guide</div>
                <p><strong>${seTips.balconies.intro}</strong></p>
                <ul class="balcony-list">
                    ${seTips.balconies.spots.map(spot => `
                        <li><strong>${spot.building}</strong> — ${spot.detail}</li>
                    `).join('')}
                </ul>
                <p style="margin-top: 10px;">🏖️ ${seTips.balconies.beachNote}</p>
                <p style="margin-top: 8px; font-size: 0.9em; opacity: 0.85;">📝 ${seTips.balconies.balconyNote}</p>
            </div>
        `;
    }

    return `
        <div class="modal-chris-says">
            <h4>🎙️ Chris Says...</h4>
            ${contentHtml}
        </div>
    `;
}

function toggleChrisSays(id, button) {
    const content = document.getElementById(id);
    const arrow = document.getElementById('arrow-' + id);

    content.classList.toggle('open');
    arrow.classList.toggle('open');
}

// =============================================
// TRAJECTORY BADGE HTML
// =============================================
function renderTrajectoryBadge(trajectoryInfo) {
    if (!trajectoryInfo.trajectory) return '';

    let badgeClass = '';
    let badgeText = '';

    switch (trajectoryInfo.trajectory) {
        case 'southeast':
            badgeClass = 'trajectory-southeast';
            badgeText = '↗ SE Trajectory';
            break;
        case 'northeast':
            badgeClass = 'trajectory-northeast';
            badgeText = '↗ NE Trajectory';
            break;
        case 'variable':
            badgeClass = 'trajectory-northeast';
            badgeText = '↕ Variable';
            break;
        default:
            return '';
    }

    let html = `<span class="trajectory-badge ${badgeClass}">${badgeText}</span>`;

    if (trajectoryInfo.isRTLS) {
        html += `<span class="trajectory-badge trajectory-rtls">🔁 RTLS</span>`;
    }

    return html;
}

// =============================================
// CACHE SYSTEM
// =============================================
const cache = {};

const CACHE_DURATIONS = {
    upcoming: 5,
    previous: 30,
    news: 15
};

function getCacheKey(type, page) {
    return `${type}_page${page}`;
}

function getCachedData(key, type) {
    const cached = cache[key];
    if (!cached) return null;

    const now = Date.now();
    const ageInMinutes = (now - cached.timestamp) / 1000 / 60;
    const maxAge = CACHE_DURATIONS[type] || 5;

    if (ageInMinutes < maxAge) {
        const remainingMins = Math.round(maxAge - ageInMinutes);
        console.log(`💾 Cache HIT for "${key}" — ${remainingMins} min until refresh`);
        return cached.data;
    } else {
        console.log(`🗑️ Cache EXPIRED for "${key}" — fetching fresh data`);
        delete cache[key];
        return null;
    }
}

function setCachedData(key, data) {
    cache[key] = {
        data: data,
        timestamp: Date.now()
    };
    console.log(`💾 Cached "${key}"`);
}

function showCacheIndicator(fromCache, type) {
    const indicator = document.getElementById('cacheIndicator');
    if (fromCache) {
        const maxAge = CACHE_DURATIONS[type] || 5;
        indicator.textContent = `⚡ Loaded instantly from cache (refreshes every ${maxAge} min)`;
        indicator.className = 'cache-indicator from-cache';
    } else {
        indicator.textContent = `🌐 Fetched fresh data from API`;
        indicator.className = 'cache-indicator';
    }
    setTimeout(() => {
        indicator.textContent = '';
    }, 3000);
}

// =============================================
// APPLICATION STATE
// =============================================
let state = {
    currentTab: 'upcoming',
    currentPage: 1,
    totalResults: 0,
    nextUrl: null,
    previousUrl: null,
    launches: [],
    filteredLaunches: [],
    statusFilter: 'all',
    searchQuery: '',
    nextLaunchDate: null,
    countdownInterval: null
};

// =============================================
// TAB SWITCHING
// =============================================
function switchTab(tab) {
    state.currentTab = tab;
    state.currentPage = 1;
    state.statusFilter = 'all';
    state.searchQuery = '';

    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('searchInput').value = '';

    document.querySelectorAll('.status-filters button').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.status-filters button:first-child').classList.add('active');

    const isNews = tab === 'news';
    document.getElementById('countdownSection').style.display = tab === 'upcoming' ? 'block' : 'none';
    document.getElementById('searchContainer').style.display = isNews ? 'none' : 'block';
    document.getElementById('statusFilters').style.display = isNews ? 'none' : 'flex';

    if (isNews) {
        loadNews();
    } else {
        loadLaunches();
    }
}

// =============================================
// LOAD LAUNCHES FROM API (with caching)
// =============================================
async function loadLaunches() {
    const content = document.getElementById('mainContent');
    const pagination = document.getElementById('pagination');

    const cacheKey = getCacheKey(state.currentTab, state.currentPage);
    const cachedData = getCachedData(cacheKey, state.currentTab);

    if (cachedData) {
        state.launches = cachedData.results || [];
        state.totalResults = cachedData.count || 0;
        state.nextUrl = cachedData.next;
        state.previousUrl = cachedData.previous;

        if (state.currentTab === 'upcoming' && state.currentPage === 1 && state.launches.length > 0) {
            console.log('⏱️ [CACHE] Setting up countdown for:', state.launches[0].name);
            setupCountdown(state.launches[0]);
        }

        applyFilters();
        showCacheIndicator(true, state.currentTab);
        return;
    }

    content.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Fetching launch data from the cosmos...</p>
        </div>
    `;
    pagination.style.display = 'none';

    try {
        const offset = (state.currentPage - 1) * RESULTS_PER_PAGE;
        let url;

        if (state.currentTab === 'upcoming') {
            url = `${API_BASE}/launch/upcoming/?limit=${RESULTS_PER_PAGE}&offset=${offset}&mode=detailed&location__ids=12,27`;
        } else {
            url = `${API_BASE}/launch/previous/?limit=${RESULTS_PER_PAGE}&offset=${offset}&mode=detailed&location__ids=12,27`;
        }

        console.log('🌐 Fetching:', url);
        const response = await fetch(url, {
            headers: {
                'Authorization': 'Token 4ac401f3abc3ea11ca947c1c2d69a2bba08a5e5d'
            }
        });

        if (!response.ok) {
            throw new Error(`API responded with status ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ API returned', data.results?.length, 'launches');
        console.log('🔍 First launch:', data.results?.[0]?.name, '| NET:', data.results?.[0]?.net);

        setCachedData(cacheKey, data);

        state.launches = data.results || [];
        state.totalResults = data.count || 0;
        state.nextUrl = data.next;
        state.previousUrl = data.previous;

        if (state.currentTab === 'upcoming' && state.currentPage === 1 && state.launches.length > 0) {
            console.log('⏱️ [FRESH] Setting up countdown for:', state.launches[0].name);
            setupCountdown(state.launches[0]);
        }

        applyFilters();
        showCacheIndicator(false, state.currentTab);

    } catch (error) {
        console.error('❌ Error loading launches:', error);
        content.innerHTML = `
            <div class="error-message">
                <h2>😞 Oops! Something went wrong</h2>
                <p>Could not load launch data. This might be because:</p>
                <ul style="text-align: left; max-width: 400px; margin: 15px auto; color: #aaaacc;">
                    <li>The API rate limit has been reached</li>
                    <li>Your internet connection has an issue</li>
                    <li>The API might be temporarily down</li>
                </ul>
                <p style="margin-top: 15px;">
                    <button onclick="loadLaunches()" style="background: #ff6b35; color: white; border: none; padding: 10px 25px; border-radius: 25px; cursor: pointer; font-size: 1em;">
                        Try Again
                    </button>
                </p>
            </div>
        `;
    }
}

// =============================================
// LOAD NEWS (with caching)
// =============================================
async function loadNews() {
    const content = document.getElementById('mainContent');
    const pagination = document.getElementById('pagination');

    const cacheKey = getCacheKey('news', state.currentPage);
    const cachedData = getCachedData(cacheKey, 'news');

    if (cachedData) {
        state.totalResults = cachedData.count || 0;
        state.nextUrl = cachedData.next;
        state.previousUrl = cachedData.previous;

        renderNews(cachedData.results || []);
        updatePagination();
        showCacheIndicator(true, 'news');
        return;
    }

    content.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Fetching space news...</p>
        </div>
    `;
    pagination.style.display = 'none';

    try {
        const offset = (state.currentPage - 1) * RESULTS_PER_PAGE;
        const url = `https://api.spaceflightnewsapi.net/v4/articles/?limit=${RESULTS_PER_PAGE}&offset=${offset}`;

        console.log('🌐 Fetching:', url);
        const response = await fetch(url);
        if (!response.ok) throw new Error('News API error');

        const data = await response.json();
        setCachedData(cacheKey, data);

        state.totalResults = data.count || 0;
        state.nextUrl = data.next;
        state.previousUrl = data.previous;

        renderNews(data.results || []);
        updatePagination();
        showCacheIndicator(false, 'news');

    } catch (error) {
        console.error('Error loading news:', error);
        content.innerHTML = `
            <div class="error-message">
                <h2>📰 Could not load news</h2>
                <p>Please try again later.</p>
            </div>
        `;
    }
}

// =============================================
// SEARCH & FILTER
// =============================================
function handleSearch() {
    state.searchQuery = document.getElementById('searchInput').value.toLowerCase();
    applyFilters();
}

function setStatusFilter(filter) {
    state.statusFilter = filter;

    document.querySelectorAll('.status-filters button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    applyFilters();
}

function applyFilters() {
    let launches = [...state.launches];

    if (state.statusFilter !== 'all') {
        launches = launches.filter(launch => {
            const statusName = launch.status?.name || '';
            return statusName.toLowerCase().includes(state.statusFilter.toLowerCase());
        });
    }

    if (state.searchQuery) {
        launches = launches.filter(launch => {
            const name = (launch.name || '').toLowerCase();
            const provider = (launch.launch_service_provider?.name || '').toLowerCase();
            const pad = (launch.pad?.name || '').toLowerCase();
            const location = (launch.pad?.location?.name || '').toLowerCase();
            const rocketName = (launch.rocket?.configuration?.name || '').toLowerCase();
            const query = state.searchQuery;

            return name.includes(query) ||
                   provider.includes(query) ||
                   pad.includes(query) ||
                   location.includes(query) ||
                   rocketName.includes(query);
        });
    }

    state.filteredLaunches = launches;
    renderLaunches(launches);
    updatePagination();
}

// =============================================
// RENDER LAUNCHES
// =============================================
function renderLaunches(launches) {
    const content = document.getElementById('mainContent');

    if (launches.length === 0) {
        content.innerHTML = `
            <div class="error-message">
                <h2>🔍 No launches found</h2>
                <p>Try changing your search or filter.</p>
            </div>
        `;
        return;
    }

    let html = '<div class="launches-grid">';

    launches.forEach((launch, index) => {
        const imageUrl = launch.image || 'https://via.placeholder.com/400x200/0a0a2e/666699?text=No+Image';
        const date = launch.net ? new Date(launch.net).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        }) : 'TBD';

        const statusName = launch.status?.name || 'Unknown';
        const statusClass = getStatusClass(statusName);
        const provider = launch.launch_service_provider?.name || 'Unknown Provider';
        const location = launch.pad?.location?.name || 'Unknown Location';
        const rocketName = launch.rocket?.configuration?.name || 'Unknown Rocket';

        const trajectoryInfo = getTrajectoryInfo(launch);
        const trajectoryBadgeHtml = renderTrajectoryBadge(trajectoryInfo);
        const chrisSaysHtml = renderChrisSaysCard(trajectoryInfo);

        html += `
            <div class="launch-card" onclick="openModal(${index})">
                <img class="launch-card-image" src="${imageUrl}" alt="${launch.name}" 
                     onerror="this.src='https://via.placeholder.com/400x200/0a0a2e/666699?text=No+Image'">
                <div class="launch-card-body">
                    <h3>${launch.name || 'Unnamed Launch'}</h3>
                    <div class="launch-meta">
                        <div class="meta-row">
                            <span class="icon">🚀</span>
                            <span>${rocketName}</span>
                        </div>
                        <div class="meta-row">
                            <span class="icon">🏢</span>
                            <span>${provider}</span>
                        </div>
                        <div class="meta-row">
                            <span class="icon">📍</span>
                            <span>${location}</span>
                        </div>
                        <div class="meta-row">
                            <span class="icon">📅</span>
                            <span>${date}</span>
                        </div>
                    </div>
                    <span class="status-badge ${statusClass}">${statusName}</span>
                    ${trajectoryBadgeHtml}
                    ${chrisSaysHtml}
                </div>
            </div>
        `;
    });

    html += '</div>';
    content.innerHTML = html;
}

// =============================================
// RENDER NEWS
// =============================================
function renderNews(articles) {
    const content = document.getElementById('mainContent');

    if (articles.length === 0) {
        content.innerHTML = `
            <div class="error-message">
                <h2>📰 No news found</h2>
            </div>
        `;
        return;
    }

    let html = '<div class="news-grid">';

    articles.forEach(article => {
        const imageUrl = article.image_url || 'https://via.placeholder.com/400x200/0a0a2e/666699?text=Space+News';
        const date = article.published_at ? new Date(article.published_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : '';

        const summary = article.summary
            ? (article.summary.length > 150 ? article.summary.substring(0, 150) + '...' : article.summary)
            : '';

        html += `
            <div class="news-card">
                <img src="${imageUrl}" alt="${article.title}" 
                     onerror="this.src='https://via.placeholder.com/400x200/0a0a2e/666699?text=Space+News'">
                <div class="news-card-body">
                    <h3><a href="${article.url}" target="_blank">${article.title}</a></h3>
                    <p>${summary}</p>
                    <div class="news-date">📰 ${article.news_site || ''} · ${date}</div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    content.innerHTML = html;
}

// =============================================
// COUNTDOWN TIMER
// =============================================
function setupCountdown(launch) {
    console.log('⏱️ setupCountdown() called');
    console.log('⏱️ Launch name:', launch?.name);
    console.log('⏱️ Launch NET:', launch?.net);

    if (state.countdownInterval) {
        clearInterval(state.countdownInterval);
        state.countdownInterval = null;
        console.log('⏱️ Cleared previous interval');
    }

    const nameEl = document.getElementById('countdownName');
    const daysEl = document.getElementById('cd-days');
    const hoursEl = document.getElementById('cd-hours');
    const minsEl = document.getElementById('cd-mins');
    const secsEl = document.getElementById('cd-secs');

    console.log('⏱️ DOM check — countdownName:', !!nameEl);
    console.log('⏱️ DOM check — cd-days:', !!daysEl);
    console.log('⏱️ DOM check — cd-hours:', !!hoursEl);
    console.log('⏱️ DOM check — cd-mins:', !!minsEl);
    console.log('⏱️ DOM check — cd-secs:', !!secsEl);

    if (!nameEl || !daysEl || !hoursEl || !minsEl || !secsEl) {
        console.error('❌ COUNTDOWN DOM ELEMENTS MISSING — cannot start timer');
        return;
    }

    nameEl.textContent = launch.name || 'Unknown Mission';
    console.log('⏱️ Set countdown name to:', nameEl.textContent);

    const section = document.getElementById('countdownSection');
    if (section) {
        section.style.display = 'block';
        console.log('⏱️ Countdown section visibility: block');
    }

    if (!launch.net) {
        console.warn('⏱️ No NET date — showing TBD');
        daysEl.textContent = '--';
        hoursEl.textContent = '--';
        minsEl.textContent = '--';
        secsEl.textContent = '--';
        return;
    }

    state.nextLaunchDate = new Date(launch.net);
    console.log('⏱️ Parsed launch date:', state.nextLaunchDate);
    console.log('⏱️ Launch date valid:', !isNaN(state.nextLaunchDate.getTime()));

    if (isNaN(state.nextLaunchDate.getTime())) {
        console.error('❌ Invalid date from NET:', launch.net);
        daysEl.textContent = '--';
        hoursEl.textContent = '--';
        minsEl.textContent = '--';
        secsEl.textContent = '--';
        return;
    }

    updateCountdown();
    state.countdownInterval = setInterval(updateCountdown, 1000);
    console.log('⏱️ Countdown interval started ✅');
}

function updateCountdown() {
    const now = new Date();
    const diff = state.nextLaunchDate - now;

    const daysEl = document.getElementById('cd-days');
    const hoursEl = document.getElementById('cd-hours');
    const minsEl = document.getElementById('cd-mins');
    const secsEl = document.getElementById('cd-secs');

    if (!daysEl || !hoursEl || !minsEl || !secsEl) {
        console.error('❌ Countdown elements disappeared from DOM');
        if (state.countdownInterval) {
            clearInterval(state.countdownInterval);
            state.countdownInterval = null;
        }
        return;
    }

    if (diff <= 0) {
        daysEl.textContent = '0';
        hoursEl.textContent = '00';
        minsEl.textContent = '00';
        secsEl.textContent = '00';
        if (state.countdownInterval) {
            clearInterval(state.countdownInterval);
            state.countdownInterval = null;
            console.log('⏱️ Countdown reached zero — stopped');
        }
        return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    daysEl.textContent = days;
    hoursEl.textContent = hours.toString().padStart(2, '0');
    minsEl.textContent = mins.toString().padStart(2, '0');
    secsEl.textContent = secs.toString().padStart(2, '0');
}

// =============================================
// LAUNCH DETAIL MODAL
// =============================================
function openModal(index) {
    const launch = state.filteredLaunches[index];
    if (!launch) return;

    console.log('🔍 Modal opened for:', launch.name);
    console.log('🔍 Launch ID:', launch.id);
    console.log('🔍 Launch slug:', launch.slug);

    const modal = document.getElementById('modalOverlay');
    const imageUrl = launch.image || 'https://via.placeholder.com/700x300/0a0a2e/666699?text=No+Image';

    document.getElementById('modalTitle').textContent = launch.name || 'Launch Details';
    document.getElementById('modalImage').src = imageUrl;

    const date = launch.net ? new Date(launch.net).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    }) : 'TBD';

    const provider = launch.launch_service_provider?.name || 'Unknown';
    const providerType = launch.launch_service_provider?.type || '';
    const rocketName = launch.rocket?.configuration?.name || 'Unknown';
    const rocketFamily = launch.rocket?.configuration?.family || '';
    const padName = launch.pad?.name || 'Unknown';
    const location = launch.pad?.location?.name || 'Unknown';
    const statusName = launch.status?.name || 'Unknown';
    const statusDesc = launch.status?.description || '';
    const missionName = launch.mission?.name || 'N/A';
    const missionDesc = launch.mission?.description || 'No mission description available.';
    const missionType = launch.mission?.type || 'N/A';
    const orbit = launch.mission?.orbit?.name || 'N/A';

    const trajectoryInfo = getTrajectoryInfo(launch);
    const chrisSaysModalHtml = renderChrisSaysModal(trajectoryInfo);

    // ---- BUILD WATCH LIVE SECTION ----
    let webcastHtml = '';

    // Check for manual video URL from launch-extras.json
    if (trajectoryInfo.videoUrl) {
        webcastHtml = `
            <div style="margin-top: 20px;">
                <strong>📺 Watch Live:</strong><br>
                <a href="${trajectoryInfo.videoUrl}" target="_blank" 
                   style="color: #ff6b35; font-weight: bold; font-size: 1.1em;">
                   🔴 Live Stream
                </a>
            </div>
        `;
    }

    // Also include any API-provided video URLs
    if (launch.vidURLs && launch.vidURLs.length > 0) {
        if (!webcastHtml) {
            webcastHtml = '<div style="margin-top: 20px;"><strong>📺 Watch Live:</strong><br>';
        } else {
            webcastHtml += '<div style="margin-top: 10px;">';
        }
        launch.vidURLs.forEach(vid => {
            webcastHtml += `<a href="${vid.url}" target="_blank" style="color: #ff6b35; margin-right: 10px;">${vid.title || 'Webcast'}</a> `;
        });
        webcastHtml += '</div>';
    }

    document.getElementById('modalBody').innerHTML = `
        <h3>${missionName}</h3>
        <p>${missionDesc}</p>

        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">📅 Date</div>
                <div class="detail-value">${date}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">📊 Status</div>
                <div class="detail-value">${statusName}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">🚀 Rocket</div>
                <div class="detail-value">${rocketName}${rocketFamily ? ' (' + rocketFamily + ')' : ''}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">🏢 Provider</div>
                <div class="detail-value">${provider}${providerType ? ' (' + providerType + ')' : ''}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">📍 Launch Pad</div>
                <div class="detail-value">${padName}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">🌍 Location</div>
                <div class="detail-value">${location}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">🎯 Mission Type</div>
                <div class="detail-value">${missionType}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">🌌 Orbit</div>
                <div class="detail-value">${orbit}</div>
            </div>
        </div>

        ${statusDesc ? `<p style="margin-top: 15px; font-size: 0.85em;"><em>${statusDesc}</em></p>` : ''}
        ${webcastHtml}
        ${chrisSaysModalHtml}
    `;

    modal.classList.add('open');
}

function closeModal(event) {
    if (event.target === document.getElementById('modalOverlay')) {
        document.getElementById('modalOverlay').classList.remove('open');
    }
}

// =============================================
// PAGINATION
// =============================================
function updatePagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(state.totalResults / RESULTS_PER_PAGE);

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    document.getElementById('pageInfo').textContent = `Page ${state.currentPage} of ${totalPages}`;
    document.getElementById('prevBtn').disabled = state.currentPage <= 1;
    document.getElementById('nextBtn').disabled = state.currentPage >= totalPages;
}

function changePage(direction) {
    state.currentPage += direction;
    if (state.currentTab === 'news') {
        loadNews();
    } else {
        loadLaunches();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// HELPER: Get CSS class for status badge
// =============================================
function getStatusClass(status) {
    const s = status.toLowerCase();
    if (s.includes('go for launch') || s.includes('go')) return 'status-go';
    if (s.includes('tbd')) return 'status-tbd';
    if (s.includes('tbc')) return 'status-tbc';
    if (s.includes('success')) return 'status-success';
    if (s.includes('fail') || s.includes('partial')) return 'status-failure';
    return 'status-default';
}

// =============================================
// INITIALIZE
// =============================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Chris The Rocket Guy is launching...');
    console.log('💾 Cache system active — durations:', CACHE_DURATIONS);

    await loadLaunchExtras();
    loadLaunches();
});
