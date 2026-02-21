// ==========================================
// Chris The Rocket Guy - Launch Tracker
// script.js - Complete Application Logic
// ==========================================

// --- Configuration ---
const LL2_API_BASE = "https://ll.thespacedevs.com/2.2.0";
const SNAPI_BASE = "https://api.spaceflightnewsapi.net/v4";
const FLORIDA_LOCATION_IDS = [12, 27];
const LAUNCH_FETCH_LIMIT = 50;

// --- State ---
let allLaunches = [];
let filteredLaunches = [];
let currentTab = "upcoming";
let currentStatusFilter = "all";
let launchExtras = {};

// --- DOM References ---
const launchList = document.getElementById("launch-list");
const tabButtons = document.querySelectorAll(".tab-btn");
const statusFilter = document.getElementById("status-filter");
const searchInput = document.getElementById("search-input");
const modal = document.getElementById("launch-modal");
const modalBody = document.getElementById("modal-body");
const modalClose = document.querySelector(".modal-close");

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    loadLaunchExtras();
    fetchLaunches();

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.getAttribute("data-tab");
            switchTab(tab);
        });
    });

    if (statusFilter) {
        statusFilter.addEventListener("change", (e) => {
            setStatusFilter(e.target.value);
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", debounce(() => {
            applyFilters();
        }, 300));
    }

    if (modalClose) {
        modalClose.addEventListener("click", () => closeModal());
    }

    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
    });
});

// --- Load Launch Extras JSON ---
async function loadLaunchExtras() {
    try {
        const response = await fetch("launch-extras.json");
        if (response.ok) {
            launchExtras = await response.json();
        }
    } catch (err) {
        console.warn("Could not load launch-extras.json:", err);
    }
}

// --- Fetch Launches ---
async function fetchLaunches() {
    showLoading();
    try {
        const [upcomingData, previousData] = await Promise.all([
            fetchAPI(`${LL2_API_BASE}/launch/upcoming/?limit=${LAUNCH_FETCH_LIMIT}&location__ids=${FLORIDA_LOCATION_IDS.join(",")}`),
            fetchAPI(`${LL2_API_BASE}/launch/previous/?limit=${LAUNCH_FETCH_LIMIT}&location__ids=${FLORIDA_LOCATION_IDS.join(",")}`)
        ]);

        const upcoming = (upcomingData.results || []).map(l => ({ ...l, _tab: "upcoming" }));
        const previous = (previousData.results || []).map(l => ({ ...l, _tab: "previous" }));

        allLaunches = [...upcoming, ...previous];
        applyFilters();
    } catch (err) {
        showError("Unable to load launches. Please try again later.");
        console.error("Fetch error:", err);
    }
}

async function fetchAPI(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
}

// --- Filtering ---
function applyFilters() {
    let launches = allLaunches.filter(l => l._tab === currentTab);

    if (currentStatusFilter !== "all") {
        launches = launches.filter(l => {
            const statusName = (l.status && l.status.name) ? l.status.name.toLowerCase() : "";
            return statusName.includes(currentStatusFilter.toLowerCase());
        });
    }

    if (searchInput && searchInput.value.trim()) {
        const query = searchInput.value.trim().toLowerCase();
        launches = launches.filter(l => {
            const name = (l.name || "").toLowerCase();
            const provider = (l.launch_service_provider && l.launch_service_provider.name) ? l.launch_service_provider.name.toLowerCase() : "";
            const padName = (l.pad && l.pad.name) ? l.pad.name.toLowerCase() : "";
            return name.includes(query) || provider.includes(query) || padName.includes(query);
        });
    }

    if (currentTab === "upcoming") {
        launches.sort((a, b) => new Date(a.net) - new Date(b.net));
    } else {
        launches.sort((a, b) => new Date(b.net) - new Date(a.net));
    }

    filteredLaunches = launches;
    renderLaunches();
}

function switchTab(tab) {
    currentTab = tab;
    tabButtons.forEach(btn => {
        if (btn.getAttribute("data-tab") === tab) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
    applyFilters();
}

function setStatusFilter(value) {
    currentStatusFilter = value;
    applyFilters();
}

// --- Rendering ---
function renderLaunches() {
    if (!launchList) return;

    if (filteredLaunches.length === 0) {
        launchList.innerHTML = `
            <div class="no-results">
                <p>🔭 No launches found matching your criteria.</p>
            </div>
        `;
        return;
    }

    launchList.innerHTML = filteredLaunches.map(launch => createLaunchCard(launch)).join("");
}

function createLaunchCard(launch) {
    const launchName = launch.name || "Unknown Launch";
    const providerName = (launch.launch_service_provider && launch.launch_service_provider.name) || "Unknown Provider";
    const padName = (launch.pad && launch.pad.name) || "Unknown Pad";
    const statusName = (launch.status && launch.status.name) || "Unknown";
    const statusAbbrev = (launch.status && launch.status.abbrev) || "UNK";
    const netDate = launch.net ? new Date(launch.net) : null;
    const imageUrl = launch.image || "";

    const missionName = launchName.split("|")[0].trim();
    const payload = launchName.includes("|") ? launchName.split("|")[1].trim() : "";

    const flags = getAutoFlags(launch);
    const extras = launchExtras[launch.id] || {};
    const trajectory = getTrajectory(launch);

    const dateStr = netDate ? formatDate(netDate) : "TBD";
    const countdownStr = netDate && currentTab === "upcoming" ? getCountdown(netDate) : "";

    return `
        <div class="launch-card" onclick="openModal('${launch.id}')">
            ${imageUrl ? `<div class="card-image" style="background-image: url('${imageUrl}')"></div>` : ""}
            <div class="card-body">
                <div class="card-header-row">
                    <span class="status-badge status-${statusAbbrev.toLowerCase()}">${statusName}</span>
                    ${flags.map(f => `<span class="flag-badge">${f}</span>`).join("")}
                </div>
                <h3 class="card-title">${missionName}</h3>
                ${payload ? `<p class="card-payload">${payload}</p>` : ""}
                <div class="card-meta">
                    <span>🏢 ${providerName}</span>
                    <span>📍 ${padName}</span>
                    <span>📅 ${dateStr}</span>
                </div>
                ${trajectory ? `<div class="card-trajectory">🧭 Trajectory: ${trajectory}</div>` : ""}
                ${countdownStr ? `<div class="card-countdown">${countdownStr}</div>` : ""}
            </div>
        </div>
    `;
}

// --- Auto Flags ---
function getAutoFlags(launch) {
    const flags = [];
    const name = (launch.name || "").toLowerCase();
    const providerName = (launch.launch_service_provider && launch.launch_service_provider.name || "").toLowerCase();

    if (name.includes("crew") && (providerName.includes("nasa") || providerName.includes("spacex"))) {
        flags.push("👨‍🚀 Crew Mission");
    }

    if (name.includes("falcon heavy")) {
        flags.push("🔥 Falcon Heavy");
    }

    if (name.includes("starship") || name.includes("superheavy")) {
        flags.push("⭐ Starship");
    }

    if (name.includes("starlink")) {
        flags.push("🛰️ Starlink");
    }

    const extras = launchExtras[launch.id] || {};
    if (extras.flags) {
        extras.flags.forEach(f => flags.push(f));
    }

    return flags;
}

// --- Trajectory Engine ---
function getTrajectory(launch) {
    const name = (launch.name || "").toLowerCase();
    const orbit = (launch.mission && launch.mission.orbit && launch.mission.orbit.abbrev) ? launch.mission.orbit.abbrev.toUpperCase() : "";

    const extras = launchExtras[launch.id] || {};
    if (extras.trajectory) return extras.trajectory;

    if (orbit === "GTO" || orbit === "GEO" || name.includes("gto") || name.includes("geo")) {
        return "East over the Atlantic – visible for a long arc across the sky";
    }

    if (orbit === "SSO" || name.includes("sun-synchronous") || name.includes("polar")) {
        return "South-Southeast along the coast – hugs the shoreline";
    }

    if (orbit === "ISS" || name.includes("iss") || name.includes("space station")) {
        return "Northeast over the Atlantic – ISS rendezvous trajectory";
    }

    if (name.includes("starlink")) {
        const groupMatch = name.match(/group\s*(\d+)/i);
        if (groupMatch) {
            const group = parseInt(groupMatch[1]);
            if ([6, 10, 12].includes(group)) {
                return "Southeast over the Atlantic – Starlink shell deployment";
            }
        }
        return "East-Northeast over the Atlantic – Starlink train visible after deployment";
    }

    if (orbit === "LEO" || orbit === "MEO") {
        return "East over the Atlantic – low/medium Earth orbit insertion";
    }

    if (orbit === "TLI" || name.includes("lunar") || name.includes("moon") || name.includes("artemis")) {
        return "East over the Atlantic – translunar injection burn";
    }

    if (name.includes("mars") || name.includes("interplanetary")) {
        return "East over the Atlantic – interplanetary departure trajectory";
    }

    return null;
}

// --- Sunset Calculator (Cape Canaveral) ---
function getSunsetTime(date) {
    const lat = 28.3922;
    const lng = -80.6077;

    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
    const latRad = lat * (Math.PI / 180);
    const decRad = declination * (Math.PI / 180);

    const hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(decRad));
    const hourAngleDeg = hourAngle * (180 / Math.PI);

    const solarNoon = 12 - (lng / 15) - (getEquationOfTime(dayOfYear) / 60);
    const sunsetUTC = solarNoon + (hourAngleDeg / 15);

    const sunsetET = sunsetUTC - 5;
    const isDST = isDaylightSaving(date);
    const sunsetLocal = isDST ? sunsetET + 1 : sunsetET;

    const hours = Math.floor(sunsetLocal);
    const minutes = Math.round((sunsetLocal - hours) * 60);

    return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

function getEquationOfTime(dayOfYear) {
    const b = (360 / 365) * (dayOfYear - 81) * (Math.PI / 180);
    return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

function isDaylightSaving(date) {
    const year = date.getFullYear();
    const marchSecondSunday = new Date(year, 2, 8 + (7 - new Date(year, 2, 8).getDay()) % 7);
    const novFirstSunday = new Date(year, 10, 1 + (7 - new Date(year, 10, 1).getDay()) % 7);
    return date >= marchSecondSunday && date < novFirstSunday;
}

// --- Viewing Tips ---
function getViewingTips(launch) {
    const tips = [];
    const netDate = launch.net ? new Date(launch.net) : null;

    if (netDate) {
        const sunset = getSunsetTime(netDate);
        tips.push(`🌅 Sunset at Cape Canaveral: ~${sunset} ET`);

        const launchHour = netDate.getUTCHours() - 5 + (isDaylightSaving(netDate) ? 1 : 0);
        const sunsetParts = sunset.split(":").map(Number);
        const sunsetDecimal = sunsetParts[0] + sunsetParts[1] / 60;

        if (Math.abs(launchHour - sunsetDecimal) < 1.5) {
            tips.push("🎨 Twilight launch — expect stunning jellyfish or rocket plume effects!");
        }

        if (launchHour >= 0 && launchHour < 6) {
            tips.push("🌙 Night launch — flame and exhaust will be vividly visible");
        } else if (launchHour >= 6 && launchHour < 10) {
            tips.push("🌅 Morning launch — arrive early, great lighting for photography");
        } else if (launchHour >= 16 && launchHour < 19) {
            tips.push("🌇 Late afternoon launch — golden hour lighting possible");
        }
    }

    const name = (launch.name || "").toLowerCase();
    if (name.includes("falcon heavy")) {
        tips.push("🔥 Falcon Heavy — watch for triple booster separation and dual landing burns!");
    }
    if (name.includes("starlink")) {
        tips.push("🛰️ Starlink — look for the satellite train in the sky 15-30 min after launch");
    }
    if (name.includes("crew")) {
        tips.push("👨‍🚀 Crew mission — expect extra security and larger crowds. Arrive very early!");
    }
    if (name.includes("starship")) {
        tips.push("⭐ Starship — the most powerful rocket ever flown. Expect intense sound and vibration!");
    }

    return tips;
}

// --- Viewing Spots ---
function getViewingSpots(launch) {
    const padName = (launch.pad && launch.pad.name) ? launch.pad.name.toLowerCase() : "";

    const spots = [
        { name: "Jetty Park Beach", icon: "🏖️", distance: "~6 mi", notes: "Great for families, parking available ($)" },
        { name: "Playalinda Beach", icon: "🏝️", distance: "~3 mi", notes: "Closest public beach to pads — arrive very early" },
        { name: "Space View Park (Titusville)", icon: "🌳", distance: "~12 mi", notes: "Free, iconic spot along Indian River" },
        { name: "Max Brewer Bridge", icon: "🌉", distance: "~12 mi", notes: "Elevated view, can get crowded" },
        { name: "KSC Visitor Complex", icon: "🚀", distance: "Varies", notes: "Official viewing — tickets required, premium experience" }
    ];

    if (padName.includes("39a") || padName.includes("39b")) {
        spots.unshift({
            name: "NASA Causeway (LC-39 area)",
            icon: "🛣️",
            distance: "~5 mi",
            notes: "Sometimes open for special launches — check KSC site"
        });
    }

    return spots;
}

// --- Modal ---
function openModal(launchId) {
    const launch = allLaunches.find(l => l.id === launchId);
    if (!launch || !modal || !modalBody) return;

    const data = extractModalData(launch);
    let bodyHTML = "";

    // Header image
    if (data.imageUrl) {
        bodyHTML += `<div class="modal-hero" style="background-image: url('${data.imageUrl}')"></div>`;
    }

    // Title and status
    bodyHTML += `
        <div class="modal-header-section">
            <span class="status-badge status-${data.statusAbbrev.toLowerCase()}">${data.statusName}</span>
            ${data.flags.map(f => `<span class="flag-badge">${f}</span>`).join("")}
            <h2>${data.missionName}</h2>
            ${data.payload ? `<p class="modal-payload">${data.payload}</p>` : ""}
        </div>
    `;

    // Key details
    bodyHTML += `
        <div class="modal-details">
            <div class="detail-row"><span class="detail-label">🏢 Provider</span><span>${data.providerName}</span></div>
            <div class="detail-row"><span class="detail-label">🚀 Vehicle</span><span>${data.rocketName}</span></div>
            <div class="detail-row"><span class="detail-label">📍 Pad</span><span>${data.padName}</span></div>
            <div class="detail-row"><span class="detail-label">📅 Date</span><span>${data.dateStr}</span></div>
            ${data.windowStart ? `<div class="detail-row"><span class="detail-label">🕐 Window Opens</span><span>${data.windowStart}</span></div>` : ""}
            ${data.windowEnd ? `<div class="detail-row"><span class="detail-label">🕐 Window Closes</span><span>${data.windowEnd}</span></div>` : ""}
        </div>
    `;

    // Mission description
    if (data.missionDescription) {
        bodyHTML += `
            <div class="modal-section">
                <h3>📋 Mission Overview</h3>
                <p>${data.missionDescription}</p>
            </div>
        `;
    }

    // Trajectory
    if (data.trajectory) {
        bodyHTML += `
            <div class="modal-section">
                <h3>🧭 Trajectory</h3>
                <p>${data.trajectory}</p>
            </div>
        `;
    }

    // Countdown (upcoming only)
    if (data.netDate && currentTab === "upcoming") {
        const countdown = getCountdown(data.netDate);
        if (countdown) {
            bodyHTML += `
                <div class="modal-section countdown-section">
                    <h3>⏱️ Countdown</h3>
                    <p class="countdown-display">${countdown}</p>
                </div>
            `;
        }
    }

    // Viewing tips
    const tips = getViewingTips(launch);
    if (tips.length > 0) {
        bodyHTML += `
            <div class="modal-section">
                <h3>👀 Viewing Tips</h3>
                <ul class="tips-list">
                    ${tips.map(t => `<li>${t}</li>`).join("")}
                </ul>
            </div>
        `;
    }

    // Viewing spots
    const spots = getViewingSpots(launch);
    if (spots.length > 0) {
        bodyHTML += `
            <div class="modal-section">
                <h3>📍 Best Viewing Spots</h3>
                <ul class="spots-list">
                    ${spots.map(s => `
                        <li>
                            <span class="spot-icon">${s.icon}</span>
                            <div class="spot-info">
                                <strong>${s.name}</strong> <span class="spot-distance">(${s.distance})</span>
                                <p>${s.notes}</p>
                            </div>
                        </li>
                    `).join("")}
                </ul>
            </div>
        `;
    }

    // Live feeds as bulleted list with distinct icons per source
    if (data.vidURLs && data.vidURLs.length > 0) {
        const feedItems = data.vidURLs.map(url => {
            let label = "Live Stream";
            let icon  = "📺";

            if (url.includes("youtube.com") || url.includes("youtu.be")) {
                label = "YouTube Live Stream";
                icon  = "▶️";
            } else if (url.includes("nasa.gov") || url.includes("nasatv")) {
                label = "NASA TV";
                icon  = "🛰️";
            } else if (url.includes("spacex.com")) {
                label = "SpaceX Webcast";
                icon  = "🚀";
            } else if (url.includes("twitter.com") || url.includes("x.com")) {
                label = "X (Twitter) Live";
                icon  = "🐦";
            } else if (url.includes("facebook.com") || url.includes("fb.watch")) {
                label = "Facebook Live";
                icon  = "📘";
            } else if (url.includes("twitch.tv")) {
                label = "Twitch Stream";
                icon  = "🎮";
            } else if (url.includes("reddit.com")) {
                label = "Reddit Live Thread";
                icon  = "💬";
            } else if (url.includes("ula") || url.includes("ulalaunch")) {
                label = "ULA Webcast";
                icon  = "🏗️";
            } else if (url.includes("rocketlab")) {
                label = "Rocket Lab Webcast";
                icon  = "⚡";
            } else if (url.includes("blueorigin")) {
                label = "Blue Origin Webcast";
                icon  = "🪶";
            } else if (url.includes("arianespace")) {
                label = "Arianespace Webcast";
                icon  = "🇪🇺";
            } else if (url.includes("isro")) {
                label = "ISRO Webcast";
                icon  = "🇮🇳";
            } else if (url.includes("dailymotion")) {
                label = "Dailymotion Stream";
                icon  = "🎬";
            }

            return `<li><span class="feed-icon">${icon}</span> <a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a></li>`;
        }).join("");

        bodyHTML += `
            <div class="modal-video">
                <h3>📡 Live Feeds</h3>
                <ul class="live-feeds-list">
                    ${feedItems}
                </ul>
            </div>
        `;
    }

    // News articles
    if (data.newsArticles && data.newsArticles.length > 0) {
        bodyHTML += `
            <div class="modal-section">
                <h3>📰 Related News</h3>
                <ul class="news-list">
                    ${data.newsArticles.map(a => `<li><a href="${a.url}" target="_blank" rel="noopener noreferrer">${a.title}</a></li>`).join("")}
                </ul>
            </div>
        `;
    }

    modalBody.innerHTML = bodyHTML;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    // Fetch news for this launch
    fetchNewsForLaunch(launch);
}

function extractModalData(launch) {
    const launchName = launch.name || "Unknown Launch";
    const missionName = launchName.split("|")[0].trim();
    const payload = launchName.includes("|") ? launchName.split("|")[1].trim() : "";
    const providerName = (launch.launch_service_provider && launch.launch_service_provider.name) || "Unknown Provider";
    const rocketName = (launch.rocket && launch.rocket.configuration && launch.rocket.configuration.full_name) || "Unknown Vehicle";
    const padName = (launch.pad && launch.pad.name) || "Unknown Pad";
    const statusName = (launch.status && launch.status.name) || "Unknown";
    const statusAbbrev = (launch.status && launch.status.abbrev) || "UNK";
    const imageUrl = launch.image || "";
    const netDate = launch.net ? new Date(launch.net) : null;
    const dateStr = netDate ? formatDate(netDate) : "TBD";
    const missionDescription = (launch.mission && launch.mission.description) || "";
    const trajectory = getTrajectory(launch);
    const flags = getAutoFlags(launch);

    const windowStart = launch.window_start ? formatTime(new Date(launch.window_start)) : "";
    const windowEnd = launch.window_end ? formatTime(new Date(launch.window_end)) : "";

    // Video URLs
    let vidURLs = [];
    if (launch.vid_urls && launch.vid_urls.length > 0) {
        vidURLs = launch.vid_urls.map(v => (typeof v === "object" && v.url) ? v.url : v).filter(Boolean);
    } else if (launch.vidURLs && launch.vidURLs.length > 0) {
        vidURLs = launch.vidURLs.map(v => (typeof v === "object" && v.url) ? v.url : v).filter(Boolean);
    }

    return {
        missionName,
        payload,
        providerName,
        rocketName,
        padName,
        statusName,
        statusAbbrev,
        imageUrl,
        netDate,
        dateStr,
        missionDescription,
        trajectory,
        flags,
        windowStart,
        windowEnd,
        vidURLs,
        newsArticles: []
    };
}

function closeModal() {
    if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
    }
}

// --- News Fetching ---
async function fetchNewsForLaunch(launch) {
    const name = (launch.name || "").split("|")[0].trim();
    try {
        const data = await fetchAPI(`${SNAPI_BASE}/articles/?limit=5&search=${encodeURIComponent(name)}`);
        if (data.results && data.results.length > 0 && modalBody) {
            const newsSection = modalBody.querySelector(".news-list");
            if (newsSection) {
                newsSection.innerHTML = data.results.map(a =>
                    `<li><a href="${a.url}" target="_blank" rel="noopener noreferrer">${a.title}</a></li>`
                ).join("");
            } else {
                const newsHTML = `
                    <div class="modal-section">
                        <h3>📰 Related News</h3>
                        <ul class="news-list">
                            ${data.results.map(a => `<li><a href="${a.url}" target="_blank" rel="noopener noreferrer">${a.title}</a></li>`).join("")}
                        </ul>
                    </div>
                `;
                modalBody.insertAdjacentHTML("beforeend", newsHTML);
            }
        }
    } catch (err) {
        console.warn("News fetch failed:", err);
    }
}

// --- Utility Functions ---
function formatDate(date) {
    return date.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short"
    });
}

function formatTime(date) {
    return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short"
    });
}

function getCountdown(targetDate) {
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) return null;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
        return `T-${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `T-${hours}h ${minutes}m`;
    } else {
        return `T-${minutes}m`;
    }
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showLoading() {
    if (launchList) {
        launchList.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Loading launches from the Space Coast...</p>
            </div>
        `;
    }
}

function showError(message) {
    if (launchList) {
        launchList.innerHTML = `
            <div class="error-message">
                <p>⚠️ ${message}</p>
                <button onclick="fetchLaunches()">Try Again</button>
            </div>
        `;
    }
}
