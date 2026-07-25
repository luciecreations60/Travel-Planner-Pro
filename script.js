let activeDay = 1;
let tripData = JSON.parse(localStorage.getItem('travelPlannerData')) || {};
let map;
let itemMarkers = [];
let selectedTransportType = 'Train';

// 1. INITIALISATION DE LA CARTE AVEC EVENEMENT CLIC
function initMap(center = [41.9272, 8.7346], zoom = 9) {
    if(map) map.remove();
    map = L.map('map').setView(center, zoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);

    // Clic sur la carte pour ajouter un point d'intérêt
    map.on('click', function(e) {
        openQuickAddModal('activ', 'Lieu sur la carte', e.latlng.lat, e.latlng.lng);
    });
}

window.onload = () => {
    ['dateStart', 'dateEnd', 'cityStart', 'cityEnd', 'currency', 'pax'].forEach(f => { 
        let val = localStorage.getItem(f);
        if(val) document.getElementById(f).value = val; 
    });
    initMap(); 
    generateTimeline(); 
};

function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }

// 2. TIMELINE & SÉLECTION DU JOUR
function generateTimeline() {
    const startI = document.getElementById('dateStart').value;
    const endI = document.getElementById('dateEnd').value;
    const area = document.getElementById('timelineArea');
    if(!startI || !endI) return;
    area.innerHTML = "";
    
    let curr = new Date(startI);
    let endDate = new Date(endI);
    let d = 1;

    while(curr <= endDate) {
        if(!tripData[d]) tripData[d] = [];
        let item = document.createElement('div');
        item.className = `day-item ${d === activeDay ? 'active' : ''}`;
        let currentDayNum = d;
        item.onclick = () => { activeDay = currentDayNum; updateDayTitle(); generateTimeline(); };
        
        const dateStr = curr.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        item.innerHTML = `<strong style="color:var(--accent);">Jour ${d}</strong> <small>(${dateStr})</small>`;
        area.appendChild(item);
        curr.setDate(curr.getDate() + 1); 
        d++;
    }
    updateDayTitle(); renderBlocks(); save();
}

function updateDayTitle() { document.getElementById('currentDayTitle').innerText = 'Jour ' + activeDay; }

// 3. FONCTION DE RECHERCHE CORRIGÉE
async function searchPlacesInApp() {
    const query = document.getElementById('wanderQuery').value.trim();
    const cityEnd = document.getElementById('cityEnd').value.trim();
    const radiusKm = parseFloat(document.getElementById('searchRadius').value);

    if (!query) return;

    const panel = document.getElementById('search-results-panel');
    const list = document.getElementById('results-list');
    panel.style.display = 'block';
    list.innerHTML = `<div style="font-size:0.8rem; padding:5px;">🔍 Recherche en cours...</div>`;

    try {
        let lat = 41.9272, lon = 8.7346; // Par défaut : Corse/Ajaccio
        
        // Résolution des coordonnées de la ville si disponible
        if (cityEnd) {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityEnd)}&limit=1`, {
                headers: { 'User-Agent': 'TravelPlannerApp/1.0' }
            });
            const geoData = await geoRes.json();
            if (geoData && geoData.length > 0) {
                lat = parseFloat(geoData[0].lat);
                lon = parseFloat(geoData[0].lon);
                map.setView([lat, lon], 10);
            }
        }

        // Calcul de la Bounding Box pour le rayon
        const delta = radiusKm / 111; 
        const viewbox = `${lon - delta},${lat + delta},${lon + delta},${lat - delta}`;

        const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=${viewbox}&bounded=1&limit=6`;
        const res = await fetch(searchUrl, { headers: { 'User-Agent': 'TravelPlannerApp/1.0' } });
        const data = await res.json();

        list.innerHTML = "";
        if (!data || data.length === 0) {
            list.innerHTML = `<div style="font-size:0.8rem; padding:5px;">Aucun résultat trouvé dans ce rayon. <br><button class="btn-main btn-primary" style="margin-top:5px; font-size:0.75rem;" onclick="openQuickAddModal('activ', '${query.replace(/'/g, "\\'")}')">Ajouter manuellement</button></div>`;
            return;
        }

        data.forEach(place => {
            let title = place.display_name.split(',')[0];
            let div = document.createElement('div');
            div.className = "place-card-result";
            div.innerHTML = `
                <div>
                    <strong>${title}</strong>
                </div>
                <button class="btn-main btn-primary" style="padding:4px 8px; font-size:0.75rem;" onclick="addBlockFromSearch('${title.replace(/'/g, "\\'")}', ${place.lat}, ${place.lon})">Ajouter</button>
            `;
            list.appendChild(div);
        });

    } catch(e) {
        console.error(e);
        list.innerHTML = `<div style="font-size:0.8rem; color:red; padding:5px;">Erreur de chargement. Vérifiez votre connexion.</div>`;
    }
}

function addBlockFromSearch(name, lat, lon) {
    openQuickAddModal('activ', name, lat, lon);
    closeResults();
}

function closeResults() { document.getElementById('search-results-panel').style.display = 'none'; }

// 4. GESTION DES HÔTELS MULTI-JOURS
function openHotelModal() { document.getElementById('hotelModal').style.display = 'flex'; }

function saveHotel() {
    const name = document.getElementById('hotelName').value || 'Hôtel';
    const start = document.getElementById('hotelStart').value;
    const end = document.getElementById('hotelEnd').value;
    const price = parseFloat(document.getElementById('hotelPrice').value) || 0;
    const payer = document.getElementById('hotelPayer').value || 'Moi';

    if (!start || !end) { alert("Indiquez la date de début et de fin !"); return; }

    const startDate = new Date(start);
    const endDate = new Date(end);
    const tripStart = new Date(document.getElementById('dateStart').value);

    const totalNights = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
    const pricePerNight = price / totalNights;

    let curr = new Date(startDate);
    while (curr < endDate) {
        let dayNum = Math.round((curr - tripStart) / (1000 * 60 * 60 * 24)) + 1;
        if (dayNum >= 1) {
            if (!tripData[dayNum]) tripData[dayNum] = [];
            tripData[dayNum].push({
                id: Date.now() + Math.random(),
                type: 'hotel',
                name: `🏨 ${name}`,
                price: pricePerNight,
                time: '15:00',
                notes: `Nuitée (${start} au ${end})`,
                paidBy: payer
            });
        }
        curr.setDate(curr.getDate() + 1);
    }

    closeModal('hotelModal');
    renderBlocks();
    save();
}

// 5. GESTION TRANSPORTS
function toggleTransportMenu() {
    const menu = document.getElementById('transportMenu');
    menu.style.display = menu.style.display === 'none' ? 'grid' : 'none';
}

function openTransportModal(type, icon) {
    selectedTransportType = type;
    document.getElementById('transportModalTitle').innerText = `${icon} Transport (${type})`;
    document.getElementById('transportMenu').style.display = 'none';
    document.getElementById('transportModal').style.display = 'flex';
}

function saveTransport() {
    const from = document.getElementById('transFrom').value || 'Départ';
    const to = document.getElementById('transTo').value || 'Arrivée';
    const dateStart = document.getElementById('transDateStart').value;
    const company = document.getElementById('transCompany').value;
    const code = document.getElementById('transCode').value;
    const cost = parseFloat(document.getElementById('transCost').value) || 0;
    const payer = document.getElementById('transPayer').value || 'Moi';

    let icon = selectedTransportType === 'Ferry' ? '⛴️' : selectedTransportType === 'Bus' ? '🚌' : selectedTransportType === 'Avion' ? '✈️' : '🚆';

    if (!tripData[activeDay]) tripData[activeDay] = [];
    tripData[activeDay].push({
        id: Date.now(),
        type: 'vol',
        name: `${icon} ${selectedTransportType}: ${from} ➔ ${to}`,
        price: cost,
        time: dateStart ? dateStart.split('T')[1] || '08:00' : '08:00',
        notes: `Compagnie: ${company || 'N/A'} | Code: ${code || 'Aucun'}`,
        paidBy: payer
    });

    closeModal('transportModal');
    renderBlocks();
    save();
}

// 6. AJOUT RAPIDE & CLIC SUR CARTE
function openQuickAddModal(type, name = '', lat = null, lon = null) {
    document.getElementById('quickAddType').value = type;
    document.getElementById('quickAddName').value = name;
    document.getElementById('quickAddLat').value = lat || '';
    document.getElementById('quickAddLon').value = lon || '';
    document.getElementById('targetDayLabel').innerText = activeDay;
    document.getElementById('quickAddTitle').innerText = type === 'resto' ? '🍴 Ajouter un Restaurant' : '🎟️ Ajouter une Activité';
    document.getElementById('quickAddModal').style.display = 'flex';
}

function saveQuickAdd() {
    const type = document.getElementById('quickAddType').value;
    const name = document.getElementById('quickAddName').value || 'Élément';
    const price = parseFloat(document.getElementById('quickAddPrice').value) || 0;
    const time = document.getElementById('quickAddTime').value || '12:00';
    const lat = parseFloat(document.getElementById('quickAddLat').value) || null;
    const lon = parseFloat(document.getElementById('quickAddLon').value) || null;

    if (!tripData[activeDay]) tripData[activeDay] = [];
    tripData[activeDay].push({
        id: Date.now(),
        type,
        name: (type === 'resto' ? '🍴 ' : '🎟️ ') + name,
        price,
        time,
        notes: '',
        paidBy: 'Moi',
        lat, lon
    });

    closeModal('quickAddModal');
    renderBlocks();
    save();
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// 7. RENDU DES ÉVÉNEMENTS DU JOUR ET DU RÉSUMÉ PAR CATÉGORIES
function renderBlocks() {
    const list = document.getElementById('blocksList');
    list.innerHTML = "";
    const cur = document.getElementById('currency').value;

    (tripData[activeDay] || []).forEach(b => {
        let div = document.createElement('div');
        div.className = `trip-block block-${b.type}`;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:0.9rem;">${b.name}</strong>
                <div>
                    <span style="font-weight:bold; color:var(--accent);">${b.price.toFixed(2)}${cur}</span>
                    <button onclick="delB(${b.id})" style="border:none; background:none; cursor:pointer; margin-left:8px;">✕</button>
                </div>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
                ⏱️ ${b.time} | 👤 ${b.paidBy || 'Moi'}
            </div>
            ${b.notes ? `<div style="font-size:0.75rem; background:var(--bg-app); padding:4px 6px; border-radius:4px; margin-top:4px;">${b.notes}</div>` : ''}
        `;
        list.appendChild(div);
    });

    updateTotal();
    updateMapMarkers();
    renderCategoriesRecap();
}

function renderCategoriesRecap() {
    const categories = { hotel: [], vol: [], activ: [], resto: [] };
    const cur = document.getElementById('currency').value;

    Object.entries(tripData).forEach(([dayNum, items]) => {
        items.forEach(item => {
            if (categories[item.type]) {
                categories[item.type].push({ ...item, dayNum });
            }
        });
    });

    ['hotel', 'vol', 'activ', 'resto'].forEach(cat => {
        const catContainer = document.getElementById(`cat-list-${cat}`);
        catContainer.innerHTML = "";
        
        if (categories[cat].length === 0) {
            catContainer.innerHTML = `<small style="color:var(--text-muted); font-size:0.75rem; padding:4px;">Aucun élément</small>`;
            return;
        }

        categories[cat].forEach(item => {
            let div = document.createElement('div');
            div.className = 'cat-item';
            div.onclick = () => {
                if (item.lat && item.lon) map.setView([item.lat, item.lon], 14);
            };
            div.innerHTML = `
                <span>${item.name} <small>(J${item.dayNum})</small></span>
                <strong>${item.price.toFixed(0)}${cur}</strong>
            `;
            catContainer.appendChild(div);
        });
    });
}

function delB(id) {
    tripData[activeDay] = tripData[activeDay].filter(x => x.id !== id);
    renderBlocks();
    save();
}

function updateTotal() {
    let total = 0;
    const cur = document.getElementById('currency').value;

    Object.values(tripData).forEach(dayBlocks => {
        dayBlocks.forEach(b => total += (parseFloat(b.price) || 0));
    });

    document.getElementById('totalLabel').innerText = total.toFixed(2) + cur;
}

function updateMapMarkers() {
    itemMarkers.forEach(m => map.removeLayer(m));
    itemMarkers = [];

    (tripData[activeDay] || []).forEach(b => {
        if (b.lat && b.lon) {
            let m = L.marker([b.lat, b.lon]).addTo(map).bindPopup(`<b>${b.name}</b>`);
            itemMarkers.push(m);
        }
    });
}

function save() {
    localStorage.setItem('travelPlannerData', JSON.stringify(tripData));
    ['dateStart', 'dateEnd', 'cityStart', 'cityEnd', 'currency', 'pax'].forEach(f => {
        let el = document.getElementById(f); if(el) localStorage.setItem(f, el.value);
    });
}

function saveAndRefresh() { save(); renderBlocks(); }
function clearAll() { if(confirm("Supprimer l'intégralité du planning ?")) { localStorage.clear(); location.reload(); } }
function downloadData() {
    const blob = new Blob([JSON.stringify(tripData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Voyage.json`; a.click();
}
