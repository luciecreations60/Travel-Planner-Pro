let activeDay = 1;
let currentLang = localStorage.getItem('lang') || 'fr';
let tripData = JSON.parse(localStorage.getItem('travelPlannerData')) || {};
let map;
let itemMarkers = [];
let selectedTransportType = 'Train';

// 1. CARTE
function initMap(center = [46, 2], zoom = 3) {
    if(map) map.remove();
    map = L.map('map').setView(center, zoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
}

window.onload = () => {
    ['dateStart', 'dateEnd', 'cityStart', 'cityEnd', 'currency', 'budgetMax', 'pax'].forEach(f => { 
        if(localStorage.getItem(f)) document.getElementById(f).value = localStorage.getItem(f); 
    });
    initMap(); 
    generateTimeline(); 
};

function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }

// 2. TIMELINE GENERATOR
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

// 3. RECHERCHE AVEC DISTANCE EN KM (NOMINATIM / OVERPASS)
async function searchPlacesInApp() {
    const query = document.getElementById('wanderQuery').value.trim();
    const cityEnd = document.getElementById('cityEnd').value.trim();
    const radius = document.getElementById('searchRadius').value; // Rayon en KM

    if (!query) return;

    const panel = document.getElementById('search-results-panel');
    const list = document.getElementById('results-list');
    panel.style.display = 'block';
    list.innerHTML = `<div>🔍 Recherche dans un rayon de ${radius} km autour de ${cityEnd || 'la destination'}...</div>`;

    // 1. Obtenir les coordonnées de la ville cible
    let lat = 41.9272, lon = 8.7346; // Ajaccio par défaut si non renseigné
    if (cityEnd) {
        try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityEnd)}&limit=1`);
            const geoData = await geoRes.json();
            if (geoData.length > 0) {
                lat = geoData[0].lat;
                lon = geoData[0].lon;
            }
        } catch(e) {}
    }

    // 2. Chercher les lieux autour de cette coordonnée avec le terme saisi
    try {
        const searchQuery = `${query}, ${cityEnd}`;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`);
        const data = await res.json();
        
        list.innerHTML = "";
        if (data.length === 0) {
            list.innerHTML = `<div style="padding:10px;">Aucun résultat à moins de ${radius} km. <button class="chip" onclick="addCustomBlock('${query}')">+ Créer manuellement</button></div>`;
            return;
        }

        data.forEach(place => {
            let div = document.createElement('div');
            div.className = "place-card-result";
            div.innerHTML = `
                <div>
                    <strong>${place.display_name.split(',')[0]}</strong><br>
                    <small style="color:var(--text-muted);">${place.display_name.split(',').slice(1,3).join(',')}</small>
                </div>
                <button class="btn-main" style="width:auto; padding:5px 10px; background:var(--accent);" onclick="addBlockFromSearch('${place.display_name.split(',')[0].replace(/'/g, "\\'")}', ${place.lat}, ${place.lon})">+ Ajouter</button>
            `;
            list.appendChild(div);
        });

    } catch(e) {
        list.innerHTML = "Erreur de connexion.";
    }
}

function addCustomBlock(name) {
    addBlock('activ', name);
    closeResults();
}

function addBlockFromSearch(name, lat, lon) {
    addBlock('activ', name, lat, lon);
    closeResults();
}

function closeResults() { document.getElementById('search-results-panel').style.display = 'none'; }

// 4. GESTION DES HÔTELS MULTI-JOURS (Dates début & fin)
function openHotelModal() { document.getElementById('hotelModal').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function saveHotel() {
    const name = document.getElementById('hotelName').value || 'Hôtel';
    const start = document.getElementById('hotelStart').value;
    const end = document.getElementById('hotelEnd').value;
    const price = parseFloat(document.getElementById('hotelPrice').value) || 0;
    const payer = document.getElementById('hotelPayer').value || 'Moi';

    if (!start || !end) { alert("Saisis les dates de séjour !"); return; }

    const startDate = new Date(start);
    const endDate = new Date(end);
    const tripStart = new Date(document.getElementById('dateStart').value);

    // Calculer le nombre de nuits
    const totalNights = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
    const pricePerNight = price / totalNights;

    // Associer automatiquement l'hôtel à chaque jour du voyage correspondant
    let curr = new Date(startDate);
    while (curr < endDate) {
        let dayNum = Math.round((curr - tripStart) / (1000 * 60 * 60 * 24)) + 1;
        if (dayNum >= 1) {
            if (!tripData[dayNum]) tripData[dayNum] = [];
            tripData[dayNum].push({
                id: Date.now() + Math.random(),
                type: 'hotel',
                name: `🏨 ${name} (Nuit)`,
                price: pricePerNight,
                time: '15:00',
                notes: `Séjour du ${start} au ${end}`,
                paidBy: payer
            });
        }
        curr.setDate(curr.getDate() + 1);
    }

    closeModal('hotelModal');
    renderBlocks();
    save();
}

// 5. GESTION DES TRANSPORTS MULTIPLES (Ferry, Train, Bus...)
function toggleTransportMenu() {
    const menu = document.getElementById('transportMenu');
    menu.style.display = menu.style.display === 'none' ? 'grid' : 'none';
}

function openTransportModal(type, icon) {
    selectedTransportType = type;
    document.getElementById('transportModalTitle').innerText = `${icon} Ajouter un Transport (${type})`;
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

// 6. BLOCS DU JOUR ET RENDU
function addBlock(type, name = '', lat = null, lon = null) {
    if(!tripData[activeDay]) tripData[activeDay] = [];
    tripData[activeDay].push({
        id: Date.now(),
        type,
        name: name || 'Nouvel événement',
        price: 0,
        time: '10:00',
        notes: '',
        paidBy: 'Moi',
        lat, lon
    });
    renderBlocks();
    save();
}

function renderBlocks() {
    const list = document.getElementById('blocksList');
    list.innerHTML = "";
    const cur = document.getElementById('currency').value;

    (tripData[activeDay] || []).forEach(b => {
        let div = document.createElement('div');
        div.className = `trip-block block-${b.type}`;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:0.95rem;">${b.name}</strong>
                <div>
                    <span style="font-weight:bold; color:var(--accent);">${b.price.toFixed(2)}${cur}</span>
                    <button onclick="delB(${b.id})" style="border:none; background:none; cursor:pointer; margin-left:10px;">✕</button>
                </div>
            </div>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:5px;">
                ⏱️ ${b.time} | 👤 Payé par : ${b.paidBy || 'Moi'}
            </div>
            ${b.notes ? `<div style="font-size:0.8rem; background:var(--bg-app); padding:5px 8px; border-radius:6px; margin-top:5px;">${b.notes}</div>` : ''}
        `;
        list.appendChild(div);
    });
    updateTotal();
    updateMapMarkers();
}

function delB(id) {
    tripData[activeDay] = tripData[activeDay].filter(x => x.id !== id);
    renderBlocks();
    save();
}

// 7. CALCULS & CARTE
function updateTotal() {
    let total = 0;
    let paidByPerson = {};
    const cur = document.getElementById('currency').value;
    const pax = parseInt(document.getElementById('pax').value) || 1;

    Object.values(tripData).forEach(dayBlocks => {
        dayBlocks.forEach(b => {
            let p = parseFloat(b.price) || 0;
            total += p;
            let payer = (b.paidBy || 'Moi').trim();
            paidByPerson[payer] = (paidByPerson[payer] || 0) + p;
        });
    });

    document.getElementById('totalLabel').innerText = total.toFixed(2) + cur;
    const perPerson = total / pax;

    const recapList = document.getElementById('recap-list');
    recapList.innerHTML = `<div style="display:flex; justify-content:space-between;"><strong>Total par personne :</strong> <span><strong>${perPerson.toFixed(2)}${cur}</strong></span></div>`;

    const splitDiv = document.getElementById('split-summary');
    splitDiv.innerHTML = "";
    Object.entries(paidByPerson).forEach(([person, amount]) => {
        let diff = amount - perPerson;
        let color = diff >= 0 ? "#10b981" : "#ef4444";
        splitDiv.innerHTML += `<div style="display:flex; justify-content:space-between;"><span>${person}</span> <span style="color:${color}; font-weight:bold;">${diff >= 0 ? '+' : ''}${diff.toFixed(2)}${cur}</span></div>`;
    });
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
    ['dateStart', 'dateEnd', 'cityStart', 'cityEnd', 'currency', 'budgetMax', 'pax'].forEach(f => {
        let el = document.getElementById(f); if(el) localStorage.setItem(f, el.value);
    });
}

function saveAndRefresh() { save(); updateTotal(); }
function clearAll() { if(confirm("Tout effacer ?")) { localStorage.clear(); location.reload(); } }
function downloadData() {
    const blob = new Blob([JSON.stringify(tripData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Voyage.json`; a.click();
}
