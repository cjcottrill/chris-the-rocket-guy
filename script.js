// ==========================================
// Chris The Rocket Guy - Launch Tracker
// script.js - DIAGNOSTIC VERSION
// ==========================================

console.log("script.js loaded");

var LL2_API_BASE = "https://ll.thespacedevs.com/2.2.0";
var SNAPI_BASE = "https://api.spaceflightnewsapi.net/v4";
var FLORIDA_LOCATION_IDS = "12,27";
var LAUNCH_FETCH_LIMIT = 50;

var allLaunches = [];
var filteredLaunches = [];
var currentTab = "upcoming";
var currentStatusFilter = "all";
var launchExtras = {};

document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM ready");

    try {
        setupEventListeners();
        console.log("Event listeners attached");
    } catch (e) {
        console.error("Event listener setup failed:", e);
    }

    try {
        loadLaunchExtras();
    } catch (e) {
        console.error("Extras load failed:", e);
    }

    try {
        fetchLaunches();
    } catch (e) {
        console.error("Fetch failed:", e);
    }
});

function setupEventListeners() {
    var tabBtns = document.querySelectorAll(".tab-btn");
    for (var i = 0; i < tabBtns.length; i++) {
        (function (btn) {
            btn.addEventListener("click", function () {
                switchTab(btn.getAttribute("data-tab"));
            });
        })(tabBtns[i]);
    }

    var statusFilter = document.getElementById("status-filter");
    if (statusFilter) {
        statusFilter.addEventListener("change", function () {
            currentStatusFilter = this.value;
            applyFilters();
        });
    }

    var searchInput = document.getElementById("search-input");
    if (searchInput) {
        var searchTimer = null;
        searchInput.addEventListener("input", function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                applyFilters();
            }, 300);
        });
    }

    var modalClose = document.querySelector(".modal-close");
    if (modalClose) {
        modalClose.addEventListener("click", closeModal);
    }

    var modal = document.getElementById("launch-modal");
    if (modal) {
        modal.addEventListener("click", function (e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            closeModal();
        }
    });
}

function loadLaunchExtras() {
    fetch("launch-extras.json")
        .then(function (r) {
            if (r.ok) return r.json();
            return {};
        })
        .then(function (data) {
            launchExtras = data || {};
            console.log("Extras loaded");
        })
        .catch(function () {
            launchExtras = {};
            console.log("No extras file, continuing");
        });
}

function fetchLaunches() {
    showLoading();
    console.log("Fetching launches...");

    var upcomingURL = LL2_API_BASE + "/launch/upcoming/?limit=" + LAUNCH_FETCH_LIMIT + "&location__ids=" + FLORIDA_LOCATION_IDS;
    var previousURL = LL2_API_BASE + "/launch/previous/?limit=" + LAUNCH_FETCH_LIMIT + "&location__ids=" + FLORIDA_LOCATION_IDS;

    console.log("URL:", upcomingURL);

    Promise.all([
        fetch(upcomingURL).then(function (r) {
            console.log("Upcoming response status:", r.status);
            return r.json();
        }),
        fetch(previousURL).then(function (r) {
            console.log("Previous response status:", r.status);
            return r.json();
        })
    ])
        .then(function (results) {
            console.log("API responses received");
            var upcomingData = results[0];
            var previousData = results[1];

            console.log("Upcoming count:", upcomingData.results ? upcomingData.results.length : 0);
            console.log("Previous count:", previousData.results ? previousData.results.length : 0);

            var upcoming = [];
            if (upcomingData.results) {
                for (var i = 0; i < upcomingData.results.length; i++) {
                    upcomingData.results[i]._tab = "upcoming";
                    upcoming.push(upcomingData.results[i]);
                }
            }

            var previous = [];
            if (previousData.results) {
                for (var j = 0; j < previousData.results.length; j++) {
                    previousData.results[j]._tab = "previous";
                    previous.push(previousData.results[j]);
                }
            }

            allLaunches = upcoming.concat(previous);
            console.log("Total launches:", allLaunches.length);

            if (allLaunches.length > 0) {
                console.log("First launch:", JSON.stringify(allLaunches[0]).substring(0, 200));
            }

            applyFilters();
        })
        .catch(function (err) {
            console.error("Fetch error:", err);
            showError("Unable to load launches. " + err.message);
        });
}

function applyFilters() {
    console.log("Applying filters, tab:", currentTab, "status:", currentStatusFilter);

    var searchInput = document.getElementById("search-input");
    var query = (searchInput && searchInput.value) ? searchInput.value.trim().toLowerCase() : "";

    filteredLaunches = [];
    for (var i = 0; i < allLaunches.length; i++) {
        var l = allLaunches[i];
        if (l._tab !== currentTab) continue;

        if (currentStatusFilter !== "all") {
            var sName = (l.status && l.status.name) ? l.status.name.toLowerCase() : "";
            if (sName.indexOf(currentStatusFilter.toLowerCase()) === -1) continue;
        }

        if (query) {
            var name = (l.name || "").toLowerCase();
            var provider = (l.launch_service_provider && l.launch_service_provider.name) ? l.launch_service_provider.name.toLowerCase() : "";
            var pad = (l.pad && l.pad.name) ? l.pad.name.toLowerCase() : "";
            if (name.indexOf(query) === -1 && provider.indexOf(query) === -1 && pad.indexOf(query) === -1) continue;
        }

        filteredLaunches.push(l);
    }

    if (currentTab === "upcoming") {
        filteredLaunches.sort(function (a, b) { return new Date(a.net) - new Date(b.net); });
    } else {
        filteredLaunches.sort(function (a, b) { return new Date(b.net) - new Date(a.net); });
    }

    console.log("Filtered count:", filteredLaunches.length);
    renderLaunches();
}

function switchTab(tab) {
    console.log("Switching to tab:", tab);
    currentTab = tab;
    var tabBtns = document.querySelectorAll(".tab-btn");
    for (var i = 0; i < tabBtns.length; i++) {
        if (tabBtns[i].getAttribute("data-tab") === tab) {
            tabBtns[i].classList.add("active");
        } else {
            tabBtns[i].classList.remove("active");
        }
    }
    applyFilters();
}

function renderLaunches() {
    var container = document.getElementById("launch-list");
    if (!container) {
        console.error("launch-list element not found!");
        return;
    }

    if (filteredLaunches.length === 0) {
        container.innerHTML = '<div class="no-results"><p>No launches found.</p></div>';
        return;
    }

    var html = "";
    for (var i = 0; i < filteredLaunches.length; i++) {
        try {
            html += buildCard(filteredLaunches[i]);
        } catch (e) {
            console.error("Error building card for launch index " + i + ":", e);
        }
    }

    container.innerHTML = html;

    // Attach click handlers
    var cards = container.querySelectorAll(".launch-card");
    for (var j = 0; j < cards.length; j++) {
        (function (card) {
            card.addEventListener("click", function () {
                var id = card.getAttribute("data-id");
                openModal(id);
            });
        })(cards[j]);
    }

    console.log("Rendered " + cards.length + " cards");
}

function buildCard(launch) {
    var name = launch.name || "Unknown";
    var parts = name.split("|");
    var mission = parts[0].trim();
    var payload = parts.length > 1 ? parts[1].trim() : "";
    var provider = (launch.launch_service_provider && launch.launch_service_provider.name) || "Unknown";
    var padName = (launch.pad && launch.pad.name) || "Unknown Pad";
    var statusName = (launch.status && launch.status.name) || "Unknown";
    var statusAbbrev = (launch.status && launch.status.abbrev) || "UNK";
    var img = launch.image || "";
    var netDate = launch.net ? new Date(launch.net) : null;
    var dateStr = netDate ? formatDate(netDate) : "TBD";

    var flags = getAutoFlags(launch);
    var trajectory = getTrajectory(launch);
    var countdown = (netDate && currentTab === "upcoming") ? getCountdown(netDate) : "";

    var h = '<div class="launch-card" data-id="' + escapeAttr(String(launch.id)) + '">';

    if (img) {
        h += '<div class="card-image" style="background-image:url(\'' + escapeAttr(img) + '\')"></div>';
    }

    h += '<div class="card-body">';
    h += '<div class="card-header-row">';
    h += '<span class="status-badge status-' + escapeAttr(statusAbbrev.toLowerCase()) + '">' + escapeHTML(statusName) + '</span>';

    for (var f = 0; f < flags.length; f++) {
        h += ' <span class="flag-badge">' + escapeHTML(flags[f]) + '</span>';
    }

    h += '</div>';
    h += '<h3 class="card-title">' + escapeHTML(mission) + '</h3>';

    if (payload) {
        h += '<p class="card-payload">' + escapeHTML(payload) + '</p>';
    }

    h += '<div class="card-meta">';
    h += '<span>🏢 ' + escapeHTML(provider) + '</span>';
    h += '<span>📍 ' + escapeHTML(padName) + '</span>';
    h += '<span>📅 ' + escapeHTML(dateStr) + '</span>';
    h += '</div>';

    if (trajectory) {
        h += '<div class="card-trajectory">🧭 ' + escapeHTML(trajectory) + '</div>';
    }

    if (countdown) {
        h += '<div class="card-countdown">' + escapeHTML(countdown) + '</div>';
    }

    h += '</div></div>';
    return h;
}

function getAutoFlags(launch) {
    var flags = [];
    var name = (launch.name || "").toLowerCase();
    var prov = (launch.launch_service_provider && launch.launch_service_provider.name) ? launch.launch_service_provider.name.toLowerCase() : "";

    if (name.indexOf("crew") !== -1 && (prov.indexOf("nasa") !== -1 || prov.indexOf("spacex") !== -1)) {
        flags.push("👨‍🚀 Crew");
    }
    if (name.indexOf("falcon heavy") !== -1) flags.push("🔥 Falcon Heavy");
    if (name.indexOf("starship") !== -1) flags.push("⭐ Starship");
    if (name.indexOf("starlink") !== -1) flags.push("🛰️ Starlink");

    var extras = launchExtras[launch.id];
    if (extras && extras.flags) {
        for (var i = 0; i < extras.flags.length; i++) {
            flags.push(extras.flags[i]);
        }
    }

    return flags;
}

function getTrajectory(launch) {
    var name = (launch.name || "").toLowerCase();
    var orbit = "";
    if (launch.mission && launch.mission.orbit && launch.mission.orbit.abbrev) {
        orbit = launch.mission.orbit.abbrev.toUpperCase();
    }

    var extras = launchExtras[launch.id];
    if (extras && extras.trajectory) return extras.trajectory;

    if (orbit === "GTO" || orbit === "GEO") return "East over the Atlantic – geostationary transfer arc";
    if (orbit === "SSO") return "South-Southeast along the coast – sun-synchronous";
    if (orbit === "ISS" || name.indexOf("iss") !== -1 || name.indexOf("station") !== -1) return "Northeast – ISS rendezvous trajectory";
    if (name.indexOf("starlink") !== -1) return "East-Northeast – Starlink deployment";
    if (orbit === "LEO") return "East over the Atlantic – low Earth orbit";
    if (name.indexOf("lunar") !== -1 || name.indexOf("moon") !== -1 || name.indexOf("artemis") !== -1) return "East – translunar injection";

    return "";
}

function getSunsetTime(date) {
    var lat = 28.3922;
    var lng = -80.6077;
    var start = new Date(date.getFullYear(), 0, 0);
    var dayOfYear = Math.floor((date - start) / 86400000);
    var declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);
    var latRad = lat * Math.PI / 180;
    var decRad = declination * Math.PI / 180;
    var hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(decRad)) * 180 / Math.PI;
    var b = (360 / 365) * (dayOfYear - 81) * Math.PI / 180;
    var eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
    var solarNoon = 12 - (lng / 15) - (eot / 60);
    var sunsetUTC = solarNoon + (hourAngle / 15);
    var year = date.getFullYear();
    var mar = new Date(year, 2, 8 + (7 - new Date(year, 2, 8).getDay()) % 7);
    var nov = new Date(year, 10, 1 + (7 - new Date(year, 10, 1).getDay()) % 7);
    var dst = (date >= mar && date < nov) ? 1 : 0;
    var sunsetLocal = sunsetUTC - 5 + dst;
    var hrs = Math.floor(sunsetLocal);
    var mins = Math.round((sunsetLocal - hrs) * 60);
    return hrs + ":" + (mins < 10 ? "0" : "") + mins;
}

function getViewingTips(launch) {
    var tips = [];
    var netDate = launch.net ? new Date(launch.net) : null;
    if (netDate) {
        tips.push("🌅 Sunset at Cape Canaveral: ~" + getSunsetTime(netDate) + " ET");
    }
    var name = (launch.name || "").toLowerCase();
    if (name.indexOf("falcon heavy") !== -1) tips.push("🔥 Triple booster separation and dual landing burns!");
    if (name.indexOf("starlink") !== -1) tips.push("🛰️ Watch for satellite train 15-30 min after launch");
    if (name.indexOf("crew") !== -1) tips.push("👨‍🚀 Crew mission – expect larger crowds, arrive early");
    if (name.indexOf("starship") !== -1) tips.push("⭐ Most powerful rocket ever – intense sound and vibration!");
    return tips;
}

function getViewingSpots() {
    return [
        { name: "Jetty Park Beach", icon: "🏖️", dist: "~6 mi", note: "Great for families, parking available" },
        { name: "Playalinda Beach", icon: "🏝️", dist: "~3 mi", note: "Closest public beach – arrive very early" },
        { name: "Space View Park", icon: "🌳", dist: "~12 mi", note: "Free, iconic spot in Titusville" },
        { name: "Max Brewer Bridge", icon: "🌉", dist: "~12 mi", note: "Elevated view, can get crowded" },
        { name: "KSC Visitor Complex", icon: "🚀", dist: "Varies", note: "Official viewing – tickets required" }
    ];
}

function openModal(launchId) {
    console.log("Opening modal for:", launchId);
    var modal = document.getElementById("launch-modal");
    var body = document.getElementById("modal-body");
    if (!modal || !body) return;

    var launch = null;
    for (var i = 0; i < allLaunches.length; i++) {
        if (String(allLaunches[i].id) === String(launchId)) {
            launch = allLaunches[i];
            break;
        }
    }
    if (!launch) {
        console.error("Launch not found:", launchId);
        return;
    }

    var name = launch.name || "Unknown";
    var parts = name.split("|");
    var mission = parts[0].trim();
    var payload = parts.length > 1 ? parts[1].trim() : "";
    var provider = (launch.launch_service_provider && launch.launch_service_provider.name) || "Unknown";
    var rocket = (launch.rocket && launch.rocket.configuration && launch.rocket.configuration.full_name) || "Unknown";
    var padName = (launch.pad && launch.pad.name) || "Unknown";
    var statusName = (launch.status && launch.status.name) || "Unknown";
    var statusAbbrev = (launch.status && launch.status.abbrev) || "UNK";
    var img = launch.image || "";
    var netDate = launch.net ? new Date(launch.net) : null;
    var dateStr = netDate ? formatDate(netDate) : "TBD";
    var desc = (launch.mission && launch.mission.description) || "";
    var trajectory = getTrajectory(launch);
    var flags = getAutoFlags(launch);

    // Collect video URLs
    var vidURLs = [];
    if (launch.vid_urls) {
        for (var v = 0; v < launch.vid_urls.length; v++) {
            var item = launch.vid_urls[v];
            if (typeof item === "string") {
                vidURLs.push(item);
            } else if (item && item.url) {
                vidURLs.push(item.url);
            }
        }
    }
    // Also check vidURLs property
    if (launch.vidURLs) {
        for (var v2 = 0; v2 < launch.vidURLs.length; v2++) {
            var item2 = launch.vidURLs[v2];
            if (typeof item2 === "string") {
                vidURLs.push(item2);
            } else if (item2 && item2.url) {
                vidURLs.push(item2.url);
            }
        }
    }

    var h = "";

    if (img) {
        h += '<div class="modal-hero" style="background-image:url(\'' + escapeAttr(img) + '\')"></div>';
    }

    h += '<div class="modal-header-section">';
    h += '<span class="status-badge status-' + escapeAttr(statusAbbrev.toLowerCase()) + '">' + escapeHTML(statusName) + '</span>';
    for (var f = 0; f < flags.length; f++) {
        h += ' <span class="flag-badge">' + escapeHTML(flags[f]) + '</span>';
    }
    h += '<h2>' + escapeHTML(mission) + '</h2>';
    if (payload) h += '<p class="modal-payload">' + escapeHTML(payload) + '</p>';
    h += '</div>';

    h += '<div class="modal-details">';
    h += '<div class="detail-row"><span class="detail-label">🏢 Provider</span><span>' + escapeHTML(provider) + '</span></div>';
    h += '<div class="detail-row"><span class="detail-label">🚀 Vehicle</span><span>' + escapeHTML(rocket) + '</span></div>';
    h += '<div class="detail-row"><span class="detail-label">📍 Pad</span><span>' + escapeHTML(padName) + '</span></div>';
    h += '<div class="detail-row"><span class="detail-label">📅 Date</span><span>' + escapeHTML(dateStr) + '</span></div>';
    h += '</div>';

    if (desc) {
        h += '<div class="modal-section"><h3>📋 Mission Overview</h3><p>' + escapeHTML(desc) + '</p></div>';
    }

    if (trajectory) {
        h += '<div class="modal-section"><h3>🧭 Trajectory</h3><p>' + escapeHTML(trajectory) + '</p></div>';
    }

    if (netDate && currentTab === "upcoming") {
        var cd = getCountdown(netDate);
        if (cd) {
            h += '<div class="modal-section"><h3>⏱️ Countdown</h3><p class="countdown-display">' + escapeHTML(cd) + '</p></div>';
        }
    }

    var tips = getViewingTips(launch);
    if (tips.length > 0) {
        h += '<div class="modal-section"><h3>👀 Viewing Tips</h3><ul class="tips-list">';
        for (var t = 0; t < tips.length; t++) {
            h += '<li>' + escapeHTML(tips[t]) + '</li>';
        }
        h += '</ul></div>';
    }

    var spots = getViewingSpots();
    h += '<div class="modal-section"><h3>📍 Best Viewing Spots</h3><ul class="spots-list">';
    for (var s = 0; s < spots.length; s++) {
        h += '<li>' + spots[s].icon + ' <strong>' + escapeHTML(spots[s].name) + '</strong> (' + spots[s].dist + ') – ' + escapeHTML(spots[s].note) + '</li>';
    }
    h += '</ul></div>';

    if (vidURLs.length > 0) {
        h += '<div class="modal-section"><h3>📡 Live Feeds</h3><ul class="live-feeds-list">';
        for (var u = 0; u < vidURLs.length; u++) {
            var url = vidURLs[u];
            var label = "Live Stream";
            var icon = "📺";
            if (url.indexOf("youtube") !== -1 || url.indexOf("youtu.be") !== -1) { label = "YouTube"; icon = "▶️"; }
            else if (url.indexOf("nasa") !== -1) { label = "NASA TV"; icon = "🛰️"; }
            else if (url.indexOf("spacex") !== -1) { label = "SpaceX"; icon = "🚀"; }
            else if (url.indexOf("twitter") !== -1 || url.indexOf("x.com") !== -1) { label = "X/Twitter"; icon = "🐦"; }
            h += '<li>' + icon + ' <a href="' + escapeAttr(url) + '" target="_blank" rel="noopener">' + escapeHTML(label) + '</a></li>';
        }
        h += '</ul></div>';
    }

    h += '<div id="modal-news-section"></div>';

    body.innerHTML = h;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    fetchNews(launch);
}

function closeModal() {
    var modal = document.getElementById("launch-modal");
    if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
    }
}

function fetchNews(launch) {
    var q = (launch.name || "").split("|")[0].trim();
    fetch(SNAPI_BASE + "/articles/?limit=5&search=" + encodeURIComponent(q))
        .then(function (r) { return r.json(); })
        .then(function (data) {
            var section = document.getElementById("modal-news-section");
            if (section && data.results && data.results.length > 0) {
                var nh = '<div class="modal-section"><h3>📰 Related News</h3><ul class="news-list">';
                for (var n = 0; n < data.results.length; n++) {
                    nh += '<li><a href="' + escapeAttr(data.results[n].url) + '" target="_blank" rel="noopener">' + escapeHTML(data.results[n].title) + '</a></li>';
                }
                nh += '</ul></div>';
                section.innerHTML = nh;
            }
        })
        .catch(function (e) {
            console.warn("News fetch error:", e);
        });
}

// --- Helpers ---
function formatDate(d) {
    try {
        return d.toLocaleDateString("en-US", {
            weekday: "short", year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit", timeZoneName: "short"
        });
    } catch (e) {
        return d.toString();
    }
}

function getCountdown(target) {
    var diff = target - new Date();
    if (diff <= 0) return "";
    var days = Math.floor(diff / 86400000);
    var hrs = Math.floor((diff % 86400000) / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return "T-" + days + "d " + hrs + "h " + mins + "m";
    if (hrs > 0) return "T-" + hrs + "h " + mins + "m";
    return "T-" + mins + "m";
}

function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showLoading() {
    var el = document.getElementById("launch-list");
    if (el) {
        el.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Loading launches from the Space Coast...</p></div>';
    }
}

function showError(msg) {
    var el = document.getElementById("launch-list");
    if (el) {
        el.innerHTML = '<div class="error-message"><p>⚠️ ' + escapeHTML(msg) + '</p></div>';
    }
}
