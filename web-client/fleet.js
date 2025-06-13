// Fleet Management JavaScript

// Mock Nautilus Data - 5 robots near University of Malaya
const mockFleetData = [
    {
        id: 'NAUT-001',
        model: 'Nautilus Explorer Pro',
        ip: '192.168.1.101',
        position: {
            lat: 3.1209,
            lng: 101.6559
        },
        battery: 87,
        status: 'online',
        lastUpdate: '2024-01-15 14:30:22'
    },
    {
        id: 'NAUT-002', 
        model: 'Nautilus Scout Advanced',
        ip: '192.168.1.102',
        position: {
            lat: 3.1215,
            lng: 101.6565
        },
        battery: 63,
        status: 'online',
        lastUpdate: '2024-01-15 14:29:45'
    },
    {
        id: 'NAUT-003',
        model: 'Nautilus Deep Sea',
        ip: '192.168.1.103', 
        position: {
            lat: 3.1203,
            lng: 101.6553
        },
        battery: 94,
        status: 'online',
        lastUpdate: '2024-01-15 14:30:10'
    },
    {
        id: 'NAUT-004',
        model: 'Nautilus Research Unit',
        ip: '192.168.1.104',
        position: {
            lat: 3.1212,
            lng: 101.6550
        },
        battery: 28,
        status: 'online',
        lastUpdate: '2024-01-15 14:25:18'
    },
    {
        id: 'NAUT-005',
        model: 'Nautilus Surveyor',
        ip: '192.168.1.105',
        position: {
            lat: 3.1206,
            lng: 101.6562
        },
        battery: 75,
        status: 'online',
        lastUpdate: '2024-01-15 14:30:33'
    }
];

// Global variables
let fleetMap;
let fleetMarkers = {};
let currentHighlighted = null;

// Initialize fleet management
document.addEventListener('DOMContentLoaded', function() {
    console.log('Fleet page DOM loaded');
    
    // Add small delay to ensure all libraries are loaded
    setTimeout(() => {
        try {
            console.log('Initializing fleet management...');
            console.log('Leaflet available:', typeof L !== 'undefined');
            
            populateFleetTable();
            initializeFleetMap();
            setupTableInteractions();
            
            console.log('Fleet management initialized successfully');
        } catch (error) {
            console.error('Error initializing fleet management:', error);
            
            // Fallback: at least populate the table if map fails
            try {
                populateFleetTable();
                setupTableInteractions();
            } catch (tableError) {
                console.error('Error populating table:', tableError);
            }
        }
    }, 500);
});

// Initialize the fleet map
function initializeFleetMap() {
    try {
        console.log('Initializing map...');
        
        // Check if Leaflet is available
        if (typeof L === 'undefined') {
            throw new Error('Leaflet library not loaded');
        }
        
        // Check if map container exists
        const mapContainer = document.getElementById('fleetMap');
        if (!mapContainer) {
            throw new Error('Map container not found');
        }
        
        console.log('Creating map...');
        
        // Create map centered on University of Malaya
        fleetMap = L.map('fleetMap').setView([3.1209, 101.6559], 17);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(fleetMap);

        console.log('Map created, adding markers...');

        // Add markers for each nautilus
        mockFleetData.forEach(nautilus => {
            addNautilusMarker(nautilus);
        });

        console.log('Markers added:', Object.keys(fleetMarkers).length);

        // Fit map to show all markers
        if (Object.keys(fleetMarkers).length > 0) {
            const group = new L.featureGroup(Object.values(fleetMarkers));
            fleetMap.fitBounds(group.getBounds().pad(0.1));
        }
        
        console.log('Map initialization complete');
        
    } catch (error) {
        console.error('Error initializing map:', error);
        
        // Show error message in map container
        const mapContainer = document.getElementById('fleetMap');
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div class="d-flex align-items-center justify-content-center h-100 text-muted">
                    <div class="text-center">
                        <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                        <h6>Map Loading Error</h6>
                        <p>Unable to load map. Please refresh the page.</p>
                        <small>Error: ${error.message}</small>
                    </div>
                </div>
            `;
        }
    }
}

// Add a nautilus marker to the map
function addNautilusMarker(nautilus) {
    // Create custom marker
    const markerIcon = L.divIcon({
        className: 'nautilus-marker',
        html: `<div class="marker-content" data-id="${nautilus.id}"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    // Create marker
    const marker = L.marker([nautilus.position.lat, nautilus.position.lng], {
        icon: markerIcon
    }).addTo(fleetMap);

    // Add popup with nautilus info
    const popupContent = `
        <div class="nautilus-popup">
            <h6 class="mb-2"><i class="fas fa-robot me-1"></i>${nautilus.id}</h6>
            <p class="mb-1"><strong>Model:</strong> ${nautilus.model}</p>
            <p class="mb-1"><strong>Battery:</strong> ${nautilus.battery}%</p>
            <p class="mb-1"><strong>Status:</strong> <span class="text-capitalize">${nautilus.status}</span></p>
            <div class="mt-2">
                <button class="btn btn-primary btn-sm" onclick="controlNautilus('${nautilus.id}')">
                    <i class="fas fa-gamepad me-1"></i>Control
                </button>
            </div>
        </div>
    `;
    
    marker.bindPopup(popupContent);

    // Store marker reference
    fleetMarkers[nautilus.id] = marker;

    // Add click handler to marker
    marker.on('click', function() {
        highlightNautilus(nautilus.id);
    });
}

// Populate the fleet table
function populateFleetTable() {
    try {
        console.log('Populating fleet table...');
        
        const tableBody = document.getElementById('fleetTableBody');
        if (!tableBody) {
            throw new Error('Table body not found');
        }
        
        tableBody.innerHTML = '';

        console.log('Mock fleet data:', mockFleetData.length, 'items');

        mockFleetData.forEach((nautilus, index) => {
            console.log(`Creating row for ${nautilus.id}...`);
            const row = createTableRow(nautilus);
            tableBody.appendChild(row);
        });
        
        console.log('Fleet table populated successfully');
        
    } catch (error) {
        console.error('Error populating fleet table:', error);
    }
}

// Create a table row for a nautilus
function createTableRow(nautilus) {
    const row = document.createElement('tr');
    row.setAttribute('data-id', nautilus.id);
    
    // Battery level styling
    const batteryClass = getBatteryClass(nautilus.battery);
    const batteryIcon = getBatteryIcon(nautilus.battery);
    
    // Status styling
    const statusClass = getStatusClass(nautilus.status);
    const statusIcon = getStatusIcon(nautilus.status);

    row.innerHTML = `
        <td class="text-center">
            <span class="fw-bold text-primary">${nautilus.id}</span>
        </td>
        <td>
            <div class="nautilus-model">
                <i class="fas fa-water text-primary"></i>
                ${nautilus.model}
            </div>
        </td>
        <td>
            <span class="ip-address">${nautilus.ip}</span>
        </td>
        <td>
            <div class="coordinates">
                <span class="lat">Lat: ${nautilus.position.lat.toFixed(4)}</span>
                <span class="lng">Lng: ${nautilus.position.lng.toFixed(4)}</span>
            </div>
        </td>
        <td class="text-center">
            <div class="battery-indicator">
                <span class="battery-level ${batteryClass}">
                    <i class="fas ${batteryIcon}"></i>
                    ${nautilus.battery}%
                </span>
            </div>
        </td>
        <td class="text-center">
            <span class="status-indicator ${statusClass}">
                <i class="fas ${statusIcon}"></i>
                ${nautilus.status}
            </span>
        </td>
        <td class="text-center">
            <div class="action-buttons">
                <button class="action-btn control-btn" onclick="controlNautilus('${nautilus.id}')">
                    <i class="fas fa-gamepad"></i>
                    Control
                </button>
                <button class="action-btn info-btn" onclick="showNautilusInfo('${nautilus.id}')">
                    <i class="fas fa-info"></i>
                    Info
                </button>
            </div>
        </td>
    `;

    return row;
}

// Get battery level class
function getBatteryClass(battery) {
    if (battery >= 70) return 'battery-high';
    if (battery >= 30) return 'battery-medium';
    return 'battery-low';
}

// Get battery icon
function getBatteryIcon(battery) {
    if (battery >= 90) return 'fa-battery-full';
    if (battery >= 70) return 'fa-battery-three-quarters';
    if (battery >= 50) return 'fa-battery-half';
    if (battery >= 30) return 'fa-battery-quarter';
    return 'fa-battery-empty';
}

// Get status class
function getStatusClass(status) {
    switch (status) {
        case 'online': return 'status-online';
        case 'idle': return 'status-idle';
        case 'maintenance': return 'status-maintenance';
        case 'offline': return 'status-offline';
        default: return 'status-offline';
    }
}

// Get status icon
function getStatusIcon(status) {
    switch (status) {
        case 'online': return 'fa-circle-check';
        case 'idle': return 'fa-clock';
        case 'maintenance': return 'fa-wrench';
        case 'offline': return 'fa-circle-xmark';
        default: return 'fa-circle-xmark';
    }
}

// Setup table row interactions
function setupTableInteractions() {
    const tableBody = document.getElementById('fleetTableBody');
    
    // Add hover effects
    tableBody.addEventListener('mouseenter', function(e) {
        const row = e.target.closest('tr');
        if (row && row.dataset.id) {
            highlightNautilus(row.dataset.id);
        }
    }, true);

    tableBody.addEventListener('mouseleave', function(e) {
        const row = e.target.closest('tr');
        if (row && row.dataset.id) {
            unhighlightNautilus(row.dataset.id);
        }
    }, true);

    // Add click handlers for table rows
    tableBody.addEventListener('click', function(e) {
        const row = e.target.closest('tr');
        if (row && row.dataset.id && !e.target.closest('.action-buttons')) {
            controlNautilus(row.dataset.id);
        }
    });
}

// Highlight nautilus (both map marker and table row)
function highlightNautilus(nautilusId) {
    // Unhighlight previous
    if (currentHighlighted && currentHighlighted !== nautilusId) {
        unhighlightNautilus(currentHighlighted);
    }

    currentHighlighted = nautilusId;

    // Highlight table row
    const row = document.querySelector(`tr[data-id="${nautilusId}"]`);
    if (row) {
        row.classList.add('highlighted');
    }

    // Highlight map marker
    const marker = fleetMarkers[nautilusId];
    if (marker) {
        const markerElement = marker.getElement();
        if (markerElement) {
            const markerContent = markerElement.querySelector('.marker-content');
            if (markerContent) {
                markerContent.classList.add('highlighted');
            }
        }
    }
}

// Unhighlight nautilus
function unhighlightNautilus(nautilusId) {
    if (currentHighlighted === nautilusId) {
        currentHighlighted = null;
    }

    // Unhighlight table row
    const row = document.querySelector(`tr[data-id="${nautilusId}"]`);
    if (row) {
        row.classList.remove('highlighted');
    }

    // Unhighlight map marker
    const marker = fleetMarkers[nautilusId];
    if (marker) {
        const markerElement = marker.getElement();
        if (markerElement) {
            const markerContent = markerElement.querySelector('.marker-content');
            if (markerContent) {
                markerContent.classList.remove('highlighted');
            }
        }
    }
}

// Control nautilus - navigate to controller page
function controlNautilus(nautilusId) {
    console.log(`Controlling Nautilus: ${nautilusId}`);
    
    // Store selected nautilus in session storage for the controller page
    sessionStorage.setItem('selectedNautilus', nautilusId);
    
    // Navigate to controller page
    window.location.href = '/controller';
}

// Show nautilus info
function showNautilusInfo(nautilusId) {
    const nautilus = mockFleetData.find(n => n.id === nautilusId);
    if (!nautilus) return;

    // Focus on the nautilus on the map
    const marker = fleetMarkers[nautilusId];
    if (marker) {
        fleetMap.setView([nautilus.position.lat, nautilus.position.lng], 19);
        marker.openPopup();
    }

    // Highlight the nautilus
    highlightNautilus(nautilusId);

    // Scroll to the table row
    const row = document.querySelector(`tr[data-id="${nautilusId}"]`);
    if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Utility function to update fleet data (for future real-time updates)
function updateFleetData(newData) {
    // Update mock data
    mockFleetData.length = 0;
    mockFleetData.push(...newData);
    
    // Refresh table
    populateFleetTable();
    setupTableInteractions();
    
    // Update map markers
    Object.values(fleetMarkers).forEach(marker => {
        fleetMap.removeLayer(marker);
    });
    fleetMarkers = {};
    
    newData.forEach(nautilus => {
        addNautilusMarker(nautilus);
    });
}

// Simulate real-time updates (for demonstration)
function simulateRealTimeUpdates() {
    setInterval(() => {
        // Randomly update battery levels and status
        mockFleetData.forEach(nautilus => {
            // Small random battery change
            if (nautilus.battery > 0) {
                nautilus.battery = Math.max(0, nautilus.battery + (Math.random() - 0.6) * 2);
                nautilus.battery = Math.round(nautilus.battery);
            }
            
            // Update timestamp
            nautilus.lastUpdate = new Date().toISOString().replace('T', ' ').slice(0, 19);
        });
        
        // Refresh table to show updates
        populateFleetTable();
        setupTableInteractions();
        
    }, 30000); // Update every 30 seconds
}

// Start real-time simulation
simulateRealTimeUpdates(); 