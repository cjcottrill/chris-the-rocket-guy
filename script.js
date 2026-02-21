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

// --- Initialization ---
document.addEventListener("DOMContentLoaded", function () {
    loadLaunchExtras();
    fetchLaunches();

    // Tab buttons
    var tabButtons = document.querySelectorAll(".tab-btn");
    if (tabButtons) {
        tabButtons.forEach(function (btn) {
            btn.addEventListener("click", function () {
                switchTab(btn.getAttribute("data-tab"));
            });
        });
    }

    // Status filter
    var statusFilter = document.getElementById("status-filter");
    if (statusFilter) {
        statusFilter.addEventListener("change", function () {
            setStatusFilter(statusFilter.value);
        });
    }

    // Search
    var searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", debounce(function () {
            applyFilters();
        }, 300));
    }

    // Modal close button
    var modalClose = document.querySelector(".modal-close");
    if (modalClose) {
        modalClose.addEventListener("click", function () {
            closeModal();
        });
    }

    // Modal backdrop click
    var modal = document.getElementById("launch-modal");
    if (modal) {
        modal.addEventListener("click", function (e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Escape key
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            closeModal();
        }
    });
});

// --- Load Launch Extras JSON ---
async function loadLaunchExtras() {
    try {
        var response = await fetch("launch-extras.json");
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
        var upcomingData = await fetchAPI(
            LL2_API_BASE + "/launch/upcoming/?limit=" + LAUNCH_FETCH_LIMIT + "&location__ids=" + FLORIDA_LOCATION_IDS.join(",")
        );
        var previousData = await fetchAPI(
            LL2_API_BASE + "/launch/previous/?limit=" + LAUNCH_FETCH_LIMIT + "&location__ids=" + FLORIDA_LOCATION_IDS.join(",")
        );

        var upcoming = (upcomingData.results || []).map(function (l) {
            l._tab = "upcoming";
            return l;
        });
        var previous = (previousData.results || []).map(function (l) {
            l._tab = "previous";
            return l;
        });

        allLaunches = upcoming.concat(previous);
        applyFilters();
    } catch (err) {
        showError("Unable to load launches. Please try again later.");
        console.error("Fetch error:", err);
    }
}

async function fetchAPI(url) {
    var response = await fetch(url);
    if (!response.ok) throw new Error("API error: " + response.status);
    return response.json();
}

// --- Filtering ---
function applyFilters() {
    var searchInput = document.getElementById("search-input");
    var launches = allLaunches.filter(function (l) {
        return l._tab === currentTab;
    });

    if (currentStatusFilter !== "all") {
        launches = launches.filter(function (l) {
            var statusName = (l.status && l.status.name) ? l.status.name.toLowerCase() : "";
            return statusName.indexOf(currentStatusFilter.toLowerCase()) !== -1;
        });
    }

    if (searchInput && searchInput.value.trim()) {
        var query = searchInput.value.trim().toLowerCase();
        launches = launches.filter(function (l) {
            var name = (l.name || "").toLowerCase();
            var provider = (l.launch_service_provider && l.launch_service_provider.name) ? l.launch_service_provider.name.toLowerCase() : "";
            var padName = (l.pad && l.pad.name) ? l.pad.name.toLowerCase() : "";
            return name.indexOf(query) !== -1 || provider.indexOf(query) !== -1 || padName.indexOf(query) !== -1;
        });
    }

    if (currentTab === "upcoming") {
        launches.sort(function (a, b) { return new Date(a.net) - new Date(b.net); });
    } else {
        launches.sort(function (a, b) { return new Date(b.net) - new Date(a.net); });
    }

    filteredLaunches = launches;
    renderLaunches();
}

function switchTab(tab) {
    currentTab = tab;
    var tabButtons = document.querySelectorAll(".tab-btn");
    if (tabButtons) {
        tabButtons.forEach(function (btn) {
            if (btn.getAttribute("data-tab") === tab) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }
    applyFilters();
}

function setStatusFilter(value) {
    currentStatusFilter = value;
    applyFilters();
}

// --- Rendering ---
function renderLaunches() {
    var launchList = document.getElementById("launch-list");
    if (!launchList) return;

    if (filteredLaunches.length === 0) {
        launchList.innerHTML = '<div class="no-results"><p>No launches found matching your criteria.</p></div>';
        return;
    }

    launchList.innerHTML = filteredLaunches.map(function (launch) {
        return createLaunchCard(launch);
    }).join("");

    // Attach click handlers AFTER rendering
    var cards = launchList.querySelectorAll(".launch-card");
    cards.forEach(function (card) {
        card.addEventListener("click", function () {
            var id = card.getAttribute("data-launch-id");
            openModal(id);
        });
    });
}

function createLaunchCard(launch) {
    var launchName = launch.name || "Unknown Launch";
    var providerName = (launch.launch_service_provider && launch.launch_service_provider.name) || "Unknown Provider";
    var padName = (launch.pad && launch.pad.name) || "Unknown Pad";
    var statusName = (launch.status && launch.status.name) || "Unknown";
    var statusAbbrev = (launch.status && launch.status.abbrev) || "UNK";
    var netDate = launch.net ? new Date(launch.net) : null;
    var imageUrl = launch.image || "";

    var missionName = launchName.split("|")[0].trim();
    var payload = launchName.indexOf("|") !== -1 ? launchName.split("|")[1].trim() : "";

    var flags = getAutoFlags(launch);
    var trajectory = getTrajectory(launch);
    var dateStr = netDate ? formatDate(netDate) : "TBD";
    var countdownStr = (netDate && currentTab === "upcoming") ? getCountdown(netDate) : "";

    var flagsHTML = flags.map(function (f) {
        return '<span class="flag-badge">' + f + '</span>';
    }).join("");

    var html = '<div class="launch-card" data-launch-id="' + launch.id + '">';

    if (imageUrl) {
        html += '<div class="card-image" style="background-image: url(' + imageUrl + ')"></div>';
    }

    html += '<div class="card-body">';
    html += '<div class="card-header-row">';
    html += '<span class="status-badge status-' + statusAbbrev.toLowerCase() + '">' + statusName + '</span>';
    html += flagsHTML;
    html += '</div>';
    html += '<h3 class="card-title">' + missionName + '</h3>';

    if (payload) {
        html += '<p class="card-payload">' + payload + '</p>';
    }

    html += '<div class="card-meta">';
    html += '<span>🏢 ' + providerName + '</span>';
    html += '<span>📍 ' + padName + '</span>';
    html += '<span>📅 ' + dateStr + '</span>';
    html += '</div>';

    if (trajectory) {
        html += '<div class="card-trajectory">🧭 Trajectory: ' + trajectory + '</div>';
    }

    if (countdownStr) {
        html += '<div class="card-countdown">' + countdownStr + '</div>';
    }

    html += '</div></div>';
    return html;
}

// --- Auto Flags ---
function getAutoFlags(launch) {
    var flags = [];
    var name = (launch.name || "").toLowerCase();
    var providerName = "";
    if (launch.launch_service_provider && launch.launch_service_provider.name) {
        providerName = launch.launch_service_provider.name.toLowerCase();
    }

    if (name.indexOf("crew") !== -1 && (providerName.indexOf("nasa") !== -1 || providerName.indexOf("spacex") !== -1)) {
        flags.push("👨‍🚀 Crew Mission");
    }
    if (name.indexOf("falcon heavy") !== -1) {
        flags.push("🔥 Falcon Heavy");
    }
    if (name.indexOf("starship") !== -1 || name.indexOf("superheavy") !== -1) {
        flags.push("⭐ Starship");
    }
    if (name.indexOf("starlink") !== -1) {
        flags.push("🛰️ Starlink");
    }

    var extras = launchExtras[launch.id] || {};
    if (extras.flags) {
        extras.flags.forEach(function (f) { flags.push(f); });
    }

    return flags;
}

// --- Trajectory Engine ---
function getTrajectory(launch) {
    var name = (launch.name || "").toLowerCase();
    var orbit = "";
    if (launch.mission && launch.mission.orbit && launch.mission.orbit.abbrev) {
        orbit = launch.mission.orbit.abbrev.toUpperCase();
    }

    var extras = launchExtras[launch.id] || {};
    if (extras.trajectory) return extras.trajectory;

    if (orbit === "GTO" || orbit === "GEO" || name.indexOf("gto") !== -1 || name.indexOf("geo") !== -1) {
        return "East over the Atlantic – visible for a long arc across the sky";
    }
    if (orbit === "SSO" || name.indexOf("sun-synchronous") !== -1 || name.indexOf("polar") !== -1) {
        return "South-Southeast along the coast – hugs the shoreline";
    }
    if (orbit === "ISS" || name.indexOf("iss") !== -1 || name.indexOf("space station") !== -1) {
        return "Northeast over the Atlantic – ISS rendezvous trajectory";
    }
    if (name.indexOf("starlink") !== -1) {
        var groupMatch = name.match(/group\s*(\d+)/i);
        if (groupMatch) {
            var group = parseInt(groupMatch[1]);
            if (group === 6 || group === 10 || group === 12) {
                return "Southeast over the Atlantic – Starlink shell deployment";
            }
        }
        return "East-Northeast over the Atlantic – Starlink train visible after deployment";
    }
    if (orbit === "LEO" || orbit === "MEO") {
        return "East over the Atlantic – low/medium Earth orbit insertion";
    }
    if (orbit === "TLI" || name.indexOf("lunar") !== -1 || name.indexOf("moon") !== -1 || name.indexOf("artemis") !== -1) {
        return "East over the Atlantic – translunar injection burn";
    }
    if (name.indexOf("mars") !== -1 || name.indexOf("interplanetary") !== -1) {
        return "East over the Atlantic – interplanetary departure trajectory";
    }

    return null;
}

// --- Sunset Calculator (Cape Canaveral) ---
function getSunsetTime(date) {
    var lat = 28.3922;
    var lng = -80.6077;

    var start = new Date(date.getFullYear(), 0, 0);
    var diff = date - start;
    var oneDay = 1000 * 60 * 60 * 24;
    var dayOfYear = Math.floor(diff / oneDay);

    var declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
    var latRad = lat * (Math.PI / 180);
    var decRad = declination * (Math.PI / 180);

    var hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(decRad));
    var hourAngleDeg = hourAngle * (180 / Math.PI);

    var solarNoon = 12 - (lng / 15) - (getEquationOfTime(dayOfYear) / 60);
    var sunsetUTC = solarNoon + (hourAngleDeg / 15);

    var sunsetET = sunsetUTC - 5;
    var dst = isDaylightSaving(date);
    var sunsetLocal = dst ? sunsetET + 1 : sunsetET;

    var hours = Math.floor(sunsetLocal);
    var minutes = Math.round((sunsetLocal - hours) * 60);

    return hours + ":" + (minutes < 10 ? "0" : "") + minutes;
}

function getEquationOfTime(dayOfYear) {
    var b = (360 / 365) * (dayOfYear - 81) * (Math.PI / 180);
    return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

function isDaylightSaving(date) {
    var year = date.getFullYear();
    var marchSecondSunday = new Date(year, 2, 8 + (7 - new Date(year, 2, 8).getDay()) % 7);
    var novFirstSunday = new Date(year, 10, 1 + (7 - new Date(year, 10, 1).getDay()) % 7);
    return date >= marchSecondSunday && date < novFirstSunday;
}

// --- Viewing Tips ---
function getViewingTips(launch) {
    var tips = [];
    var netDate = launch.net ? new Date(launch.net) : null;

    if (netDate) {
        var sunset = getSunsetTime(netDate);
        tips.push("🌅 Sunset at Cape Canaveral: ~" + sunset + " ET");

        var launchHour = netDate.getUTCHours() - 5 + (isDaylightSaving(netDate) ? 1 : 0);
        var sunsetParts = sunset.split(":").map(Number);
        var sunsetDecimal = sunsetParts[0] + sunsetParts[1] / 60;

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

    var name = (launch.name || "").toLowerCase();
    if (name.indexOf("falcon heavy") !== -1) {
        tips.push("🔥 Falcon Heavy — watch for triple booster separation and dual landing burns!");
    }
    if (name.indexOf("starlink") !== -1) {
        tips.push("🛰️ Starlink — look for the satellite train in the sky 15-30 min after launch");
    }
    if (name.indexOf("crew") !== -1) {
        tips.push("👨‍🚀 Crew mission — expect extra security and larger crowds. Arrive very early!");
    }
    if (name.indexOf("starship") !== -1) {
        tips.push("⭐ Starship — the most powerful rocket ever flown. Expect intense sound and vibration!");
    }

    return tips;
}

// --- Viewing Spots ---
function getViewingSpots(launch) {
    var padName = (launch.pad && launch.pad.name) ? launch.pad.name.toLowerCase() : "";

    var spots = [
        { name: "Jetty Park Beach", icon: "🏖️", distance: "~6 mi", notes: "Great for families, parking available ($)" },
        { name: "Playalinda Beach", icon: "🏝️", distance: "~3 mi", notes: "Closest public beach to pads — arrive very early" },
        { name: "Space View Park (Titusville)", icon: "🌳", distance: "~12 mi", notes: "Free, iconic spot along Indian River" },
        { name: "Max Brewer Bridge", icon: "🌉", distance: "~12 mi", notes: "Elevated view, can get crowded" },
        { name: "KSC Visitor Complex", icon: "🚀", distance: "Varies", notes: "Official viewing — tickets required, premium experience" }
    ];

    if (padName.indexOf("39a") !== -1 || padName.indexOf("39b") !== -1) {
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
    var modal = document.getElementById("launch-modal");
    var modalBody = document.getElementById("modal-body");
    if (!modal || !modalBody) return;

    var launch = null;
    for (var i = 0; i < allLaunches.length; i++) {
        if (String(allLaunches[i].id) === String(launchId)) {
            launch = allLaunches[i];
            break;
        }
    }
    if (!launch) return;

    var launchName = launch.name || "Unknown Launch";
    var missionName = launchName.split("|")[0].trim();
    var payload = launchName.indexOf("|") !== -1 ? launchName.split("|")[1].trim() : "";
    var providerName = (launch.launch_service_provider && launch.launch_service_provider.name) || "Unknown Provider";
    var rocketName = (launch.rocket && launch.rocket.configuration && launch.rocket.configuration.full_name) || "Unknown Vehicle";
    var padName = (launch.pad && launch.pad.name) || "Unknown Pad";
    var statusName = (launch.status && launch.status.name) || "Unknown";
    var statusAbbrev = (launch.status && launch.status.abbrev) || "UNK";
    var imageUrl = launch.image || "";
    var netDate = launch.net ? new Date(launch.net) : null;
    var dateStr = netDate ? formatDate(netDate) : "TBD";
    var missionDescription = (launch.mission && launch.mission.description) || "";
    var trajectory = getTrajectory(launch);
    var flags = getAutoFlags(launch);
    var windowStart = launch.window_start ? formatTime(new Date(launch.window_start)) : "";
    var windowEnd = launch.window_end ? formatTime(new Date(launch.window_end)) : "";

    // Video URLs - handle both array-of-strings and array-of-objects
    var vidURLs = [];
    if (launch.vid_urls && launch.vid_urls.length > 0) {
        for (var v = 0; v < launch.vid_urls.length; v++) {
            var item = launch.vid_urls[v];
            if (typeof item === "string") {
                vidURLs.push(item);
            } else if (item && item.url) {
                vidURLs.push(item.url);
            }
        }
    }

    // Build modal HTML
    var html = "";

    if (imageUrl) {
        html += '<div class="modal-hero" style="background-image: url(' + imageUrl + ')"></div>';
    }

    // Header
    html += '<div class="modal-header-section">';
    html += '<span class="status-badge status-' + statusAbbrev.toLowerCase() + '">' + statusName + '</span>';
    for (var f = 0; f < flags.length; f++) {
        html += ' <span class="flag-badge">' + flags[f] + '</span>';
    }
    html += '<h2>' + missionName + '</h2>';
    if (payload) {
        html += '<p class="modal-payload">' + payload + '</p>';
    }
    html += '</div>';

    // Details
    html += '<div class="modal-details">';
    html += '<div class="detail-row"><span class="detail-label">🏢 Provider</span><span>' + providerName + '</span></div>';
    html += '<div class="detail-row"><span class="detail-label">🚀 Vehicle</span><span>' + rocketName + '</span></div>';
    html += '<div class="detail-row"><span class="detail-label">📍 Pad</span><span>' + padName + '</span></div>';
    html += '<div class="detail-row"><span class="detail-label">📅 Date</span><span>' + dateStr + '</span></div>';
    if (windowStart) {
        html += '<div class="detail-row"><span class="detail-label">🕐 Window Opens</span><span>' + windowStart + '</span></div>';
    }
    if (windowEnd) {
        html += '<div class="detail-row"><span class="detail-label">🕐 Window Closes</span><span>' + windowEnd + '</span></div>';
    }
    html += '</div>';

    // Mission description
    if (missionDescription) {
        html += '<div class="modal-section"><h3>📋 Mission Overview</h3><p>' + missionDescription + '</p></div>';
    }

    // Trajectory
    if (trajectory) {
        html += '<div class="modal-section"><h3>🧭 Trajectory</h3><p>' + trajectory + '</p></div>';
    }

    // Countdown
    if (netDate && currentTab === "upcoming") {
        var countdown = getCountdown(netDate);
        if (countdown) {
            html += '<div class="modal-section countdown-section"><h3>⏱️ Countdown</h3>';
            html += '<p class="countdown-display">' + countdown + '</p></div>';
        }
    }

    // Viewing tips
    var tips = getViewingTips(launch);
    if (tips.length > 0) {
        html += '<div class="modal-section"><h3>👀 Viewing Tips</h3><ul class="tips-list">';
        for (var t = 0; t < tips.length; t++) {
            html += '<li>' + tips[t] + '</li>';
        }
        html += '</ul></div>';
    }

    // Viewing spots
    var spots = getViewingSpots(launch);
    if (spots.length > 0) {
        html += '<div class="modal-section"><h3>📍 Best Viewing Spots</h3><ul class="spots-list">';
        for (var s = 0; s < spots.length; s++) {
            html += '<li><span class="spot-icon">' + spots[s].icon + '</span>';
            html += '<div class="spot-info"><strong>' + spots[s].name + '</strong>';
            html += ' <span class="spot-distance">(' + spots[s].distance + ')</span>';
            html += '<p>' + spots[s].notes + '</p></div></li>';
        }
        html += '</ul></div>';
    }

    // Live feeds with source-specific icons
    if (vidURLs.length > 0) {
        html += '<div class="modal-section"><h3>📡 Live Feeds</h3><ul class="live-feeds-list">';
        for (var u = 0; u < vidURLs.length; u++) {
            var url = vidURLs[u];
            var feedLabel = "Live Stream";
            var feedIcon = "📺";

            if (url.indexOf("youtube.com") !== -1 || url.indexOf("youtu.be") !== -1) {
                feedLabel = "YouTube Live Stream";
                feedIcon = "▶️";
            } else if (url.indexOf("nasa.gov") !== -1 || url.indexOf("nasatv") !== -1) {
                feedLabel = "NASA TV";
                feedIcon = "🛰️";
            } else if (url.indexOf("spacex.com") !== -1) {
                feedLabel = "SpaceX Webcast";
                feedIcon = "🚀";
            } else if (url.indexOf("twitter.com") !== -1 || url.indexOf("x.com") !== -1) {
                feedLabel = "X (Twitter) Live";
                feedIcon = "🐦";
            } else if (url.indexOf("facebook.com") !== -1 || url.indexOf("fb.watch") !== -1) {
                feedLabel = "Facebook Live";
                feedIcon = "📘";
            } else if (url.indexOf("twitch.tv") !== -1) {
                feedLabel = "Twitch Stream";
                feedIcon = "🎮";
            } else if (url.indexOf("reddit.com") !== -1) {
                feedLabel = "Reddit Live Thread";
                feedIcon = "💬";
            } else if (url.indexOf("ula") !== -1 || url.indexOf("ulalaunch") !== -1) {
                feedLabel = "ULA Webcast";
                feedIcon = "🏗️";
            } else if (url.indexOf("rocketlab") !== -1) {
                feedLabel = "Rocket Lab Webcast";
                feedIcon = "⚡";
            } else if (url.indexOf("blueorigin") !== -1) {
                feedLabel = "Blue Origin Webcast";
                feedIcon = "🪶";
            } else if (url.indexOf("arianespace") !== -1) {
                feedLabel = "Arianespace Webcast";
                feedIcon = "🇪🇺";
            } else if (url.indexOf("isro") !== -1) {
                feedLabel = "ISRO Webcast";
                feedIcon = "🇮🇳";
            } else if (url.indexOf("dailymotion") !== -1) {
                feedLabel = "Dailymotion Stream";
                feedIcon = "🎬";
            }

            html += '<li><span class="feed-icon">' + feedIcon + '</span> ';
            html += '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + feedLabel + '</a></li>';
        }
        html += '</ul></div>';
    }

    // News placeholder
    html += '<div class="modal-section" id="modal-news-section"></div>';

    modalBody.innerHTML = html;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    // Fetch news async
    fetchNewsForLaunch(launch);
}

function closeModal() {
    var modal = document.getElementById("launch-modal");
    if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
    }
}

// --- News Fetching ---
async function fetchNewsForLaunch(launch) {
    var name = (launch.name || "").split("|")[0].trim();
    try {
        var data = await fetchAPI(SNAPI_BASE + "/articles/?limit=5&search=" + encodeURIComponent(name));
        if (data.results && data.results.length > 0) {
            var newsSection = document.getElementById("modal-news-section");
            if (newsSection) {
                var newsHTML = '<h3>📰 Related News</h3><ul class="news-list">';
                for (var n = 0; n < data.results.length; n++) {
                    newsHTML += '<li><a href="' + data.results[n].url + '" target="_blank" rel="noopener noreferrer">' + data.results[n].title + '</a></li>';
                }
                newsHTML += '</ul>';
                newsSection.innerHTML = newsHTML;
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
    var now = new Date();
    var diff = targetDate - now;

    if (diff <= 0) return null;

    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
        return "T-" + days + "d " + hours + "h " + minutes + "m";
    } else if (hours > 0) {
        return "T-" + hours + "h " + minutes + "m";
    } else {
        return "T-" + minutes + "m";
    }
}

function debounce(func, wait) {
    var timeout;
    return function () {
        var context = this;
        var args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function () {
            func.apply(context, args);
        }, wait);
    };
}

function showLoading() {
    var launchList = document.getElementById("launch-list");
    if (launchList) {
        launchList.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Loading launches from the Space Coast...</p></div>';
    }
}

function showError(message) {
    var launchList = document.getElementById("launch-list");
    if (launchList) {
        launchList.innerHTML = '<div class="error-message"><p>⚠️ ' + message + '</p><button onclick="fetchLaunches()">Try Again</button></div>';
    }
}
