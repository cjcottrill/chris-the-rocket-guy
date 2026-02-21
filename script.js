// script.js

// A function to fetch launch data from the LL2 API
async function fetchLaunchData() {
    const response = await fetch('https://llapi.thurst.network/launches?location=12,27&token=4ac401f3abc3ea11ca947c1c2d69a2bba08a5e5d');
    const data = await response.json();
    return data;
}

// Function to find launch extras from launch-extras.json
function findLaunchExtras(launch) {
    // Logic to find extras from local JSON file
    // ... (implementation-specific code here)
}

// Main function to get trajectory information for a launch
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

    // Additional condition checks for other types of launches can go here
    return {
        trajectory: 'unknown',
        direction: null,
        isRTLS: false,
        chrisSays: null,
        videoUrl: null,
        launchNet: launch.net || null,
        source: 'undefined'
    };
}

// Helper functions for building tips and rendering the card and modal for Southeast launches
function buildSoutheastTips() {
    // Logic to generate tips for Southeast trajectory launches
    // ... (implementation-specific code here)
}

function renderSoutheastCard() {
    // Logic to render the Southeast card
    // ... (implementation-specific code here)
}

function renderSoutheastModal() {
    // Logic to render the modal for Southeast launches
    // ... (implementation-specific code here)
}

// Function to get sunset time for Cape Canaveral
function getCapeCanaveralSunset(date) {
    const latitude = 28.3922;
    const longitude = -80.6077;
    // Logic to calculate sunset based on date, latitude, and longitude
    // ... (implementation-specific code here)
}

// Function to initialize the launch tracking system
async function initLaunchTracker() {
    const launches = await fetchLaunchData();
    launches.forEach(launch => {
        const trajectoryInfo = getTrajectoryInfo(launch);
        // Render launch info based on trajectory info
        // ... (implementation-specific code here)
    });
}

// Start the launch tracker
document.addEventListener('DOMContentLoaded', initLaunchTracker);
