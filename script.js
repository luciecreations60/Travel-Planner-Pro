let activeDay = 1;
let currentLang = localStorage.getItem('lang') || 'fr';
let tripData = JSON.parse(localStorage.getItem('travelPlannerData')) || {};
let map;
let markers = {};

// 1. INITIALISATION ET CARTE
function initMap(center = [46, 2], zoom = 3) {
    if(map) map.remove();
    map = L.map('map').setView(center, zoom);
    
    // On choisit le style de carte selon le mode sombre
    const isDark = localStorage.getItem('darkMode') === 'true';
    const tileUrl = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);

    if(isDark) document.body.classList.add('dark-mode');
}

window.onload = () => {
    ['dateStart', 'dateEnd', 'cityStart', 'cityEnd', 'currency', 'budgetMax', 'pax'].forEach(f => { 
        if(localStorage.getItem(f)) document.getElementById(f).value = localStorage.getItem(f); 
    });
    
    initMap(); 
    applyLang(); 
    generateTimeline(); 
    restoreMapMarkers();
};

// 2. GESTION DU MODE SOMBRE
function toggleDarkMode() {
    const body = document.body;
    const isDark = body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark);
    
    // On change le bouton (optionnel si tu as mis un ID 'dark-btn')
    const btn = document.getElementById('dark-btn');
    if(btn) btn.innerText = isDark ? "☀️" : "🌙";

    // On recharge la couche de la carte pour qu'elle passe en sombre/clair
    const tileUrl = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    
    L.tileLayer(tileUrl, { attribution: '&copy; CARTO' }).addTo(map);
}

// 3. SAUVEGARDE ET CALCULS
function save() {
    localStorage.setItem('travelPlannerData', JSON.stringify(tripData));
    ['dateStart', 'dateEnd', 'cityStart', 'cityEnd', 'currency', 'budgetMax', 'pax'].forEach(f => {
        let el = document.getElementById(f); if(el) localStorage.setItem(f, el.value);
    });
    localStorage.setItem('lang', currentLang);
    updateTotal();
}

function saveAndRefresh() { save(); updateTotal(); }

function updateTotal() { 
    let total = 0; 
    let stats = { vol: 0, hotel: 0, activ: 0, resto: 0 };
    const cur = document.getElementById('currency').value;

    Object.values(tripData).forEach(dayBlocks => {
        dayBlocks.forEach(b => {
            let p = parseFloat(b.price) || 0;
            total += p;
            if(stats[b.type] !== undefined) stats[b.type] += p;
        });
    });

    const totalEl = document.getElementById('totalLabel');
    const budgetMax = parseFloat(document.getElementById('budgetMax').value) || 0; 
    const alertEl = document.getElementById('alertLimit'); 
    
    totalEl.innerText = total.toFixed(2) + cur; 
    
    if (budgetMax > 0 && total > budgetMax) { 
        totalEl.style.color = "#f87171"; 
        if(alertEl) alertEl.style.display = "block"; 
    } else { 
        totalEl.style.color = "white"; 
        if(alertEl) alertEl.style.display = "none"; 
    } 

    const recapList = document.getElementById('recap-list');
    const labels = currentLang === 'fr' 
        ? { vol: 'Vols', hotel: 'Hébergements', activ: 'Activités', resto: 'Restaurants' } 
        : { vol: 'Flights', hotel: 'Stays', activ: 'Activities', resto: 'Dining' };

    recapList.innerHTML = `
        <div class="recap-item"><small><span class="recap-dot" style="background:#6366f1"></span>${labels.vol}</small> <span>${stats.vol}${cur}</span></div>
        <div class="recap-item"><small><span class="recap-dot" style="background:#f59e0b"></span>${labels.hotel}</small> <span>${stats.hotel}${cur}</span></div>
        <div class="recap-item"><small><span class="recap-dot" style="background:#ec4899"></span>${labels.activ}</small> <span>${stats.activ}${cur}</span></div>
        <div class="recap-item"><small><span class="recap-dot" style="background:#10b981"></span>${labels.resto}</small> <span>${stats.resto}${cur}</span></div>
    `;
}

// 4. TIMELINE ET BLOCS
function generateTimeline() {
    const startI = document.getElementById('dateStart').value;
    const endI = document.getElementById('dateEnd').value;
    const area = document.getElementById('timelineArea');
    if(!startI || !endI) return;
    area.innerHTML = "";
    let curr = new Date(startI);
    let d = 1;
    while(curr <= new Date(endI)) {
        if(!tripData[d]) tripData[d] = [];
        let item = document.createElement('div');
        item.className = `day-item ${d === activeDay ? 'active' : ''}`;
        item.onclick = ((day) => () => { activeDay = day; updateDayTitle(); generateTimeline(); })(d);
        const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
        const dateStr = curr.toLocaleDateString(currentLang === 'fr' ? 'fr-FR' : 'en-US', dateOptions);
        item.innerHTML = `<span class="day-num">${currentLang === 'fr' ? 'Jour' : 'Day'} ${d}</span> <span class="day-date">${dateStr}</span>`;
        area.appendChild(item);
        curr.setDate(curr.getDate() + 1); d++;
    }
    updateDayTitle(); renderBlocks(); save();
}

function addBlock(type) { 
    tripData[activeDay].push({ id: Date.now(), type, name: '', price: 0, time: '00:00', address: '', bookingUrl: '', notes: '' }); 
    renderBlocks(); 
    save(); 
}

function renderBlocks() { 
    const list = document.getElementById('blocksList'); 
    list.innerHTML = ""; 
    const cur = document.getElementById('currency').value; 
    (tripData[activeDay] || []).sort((a,b) => a.time.localeCompare(b.time)).forEach(b => { 
        let div = document.createElement('div'); 
        div.className = `trip-block block-${b.type}`; 
        let icon = b.type==='vol'?'✈️':b.type==='hotel'?'🏨':b.type==='resto'?'🍴':'🎟️';
        
        let extra = b.type === 'hotel' ? `<div style="margin-top:10px; display:grid; gap:5px;"><input type="text" placeholder="Lien Booking" value="${b.bookingUrl || ''}" onchange="updateB(${b.id}, 'bookingUrl', this.value)"><input type="text" placeholder="Adresse" value="${b.address || ''}" onchange="updateB(${b.id}, 'address', this.value)"></div>` : ''; 

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <input type="time" style="width:80px" value="${b.time}" onchange="updateB(${b.id}, 'time', this.value)">
                <div style="font-size:1.2rem">${icon}</div>
                <input type="text" style="flex:1; font-weight:bold;" value="${b.name}" onchange="updateB(${b.id}, 'name', this.value)">
                <input type="number" style="width:70px" value="${b.price}" oninput="updateB(${b.id}, 'price', this.value)">${cur}
                <button onclick="delB(${b.id})" style="border:none; background:none; cursor:pointer;">✕</button>
            </div>${extra}`; 
        list.appendChild(div); 
    }); 
    updateTotal(); 
}

async function updateB(id, f, v) { 
    let block = tripData[activeDay].find(x => x.id === id); 
    if(!block) return; 
    block[f] = f === 'price' ? parseFloat(v) : v; 
    if(f === 'time') renderBlocks(); 
    save(); 
}

// 5. RECHERCHE RESTAURANTS
async function findRestaurants(filter = 'all') {
    if (!markers['end']) {
        alert(currentLang === 'fr' ? "Choisissez d'abord une destination." : "Please select a destination first.");
        return;
    }
    const resultsDiv = document.getElementById('resto-results');
    const listDiv = document.getElementById('resto-list');
    const lat = markers['end'].getLatLng().lat;
    const lng = markers['end'].getLatLng().lng;

    listDiv.innerHTML = `<div style="display:flex; align-items:center; padding:20px;"><div class="spinner"></div> ${currentLang === 'fr' ? 'Recherche...' : 'Searching...'}</div>`;
    resultsDiv.style.display = 'block';

    let amenityType = 'restaurant|cafe';
    let cuisineFilter = filter !== 'all' ? `["cuisine"~"${filter}"]` : '';

    const query = `[out:json];node["amenity"~"${amenityType}"]${cuisineFilter}(around:2000,${lat},${lng});out;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        listDiv.innerHTML = "";

        if (data.elements.length === 0) {
            listDiv.innerHTML = `<p style="padding:10px; font-size:0.8rem;">Aucun résultat.</p>`;
            return;
        }

        data.elements.slice(0, 8).forEach(item => {
            const name = item.tags.name || "Restaurant";
            const cuisine = item.tags.cuisine || "";
            const btn = document.createElement('button');
            btn.className = "btn-api";
            btn.style = "text-align:left; background:var(--card-bg); width:100%; margin-bottom:5px; justify-content:space-between;";
            btn.innerHTML = `<span><strong>${name}</strong><br><small>${cuisine}</small></span><span>+</span>`;
            btn.onclick = () => {
                addRestoToTrip(name, cuisine);
                btn.innerHTML = "✅";
                btn.disabled = true;
            };
            listDiv.appendChild(btn);
        });
    } catch (e) { listDiv.innerHTML = "Erreur réseau."; }
}

function addRestoToTrip(name, cuisine) {
    tripData[activeDay].push({
        id: Date.now(),
        type: 'resto',
        name: `🍴 ${name}`,
        price: 0,
        time: '12:30',
        address: '',
        bookingUrl: '',
        notes: cuisine || ''
    });
    renderBlocks();
    save();
}

// 6. RECHERCHE VILLES ET UTILES
async function handleSearch(q, type) { 
    const sugg = document.getElementById(type === 'start' ? 'suggestionsStart' : 'suggestionsEnd'); 
    if(q.length < 3) { sugg.style.display = 'none'; return; }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&accept-language=${currentLang}&q=${q}&limit=3`); 
    const data = await res.json(); 
    sugg.innerHTML = ""; 
    data.forEach(p => { 
        let d = document.createElement('div'); d.className = "suggest-item"; d.innerText = p.display_name; 
        d.onclick = () => { 
            document.getElementById(type === 'start' ? 'cityStart' : 'cityEnd').value = p.display_name; 
            sugg.style.display = 'none'; placeMarker(p.display_name, type); save(); 
        }; 
        sugg.appendChild(d); 
    }); 
    sugg.style.display = 'block'; 
}

async function placeMarker(query, type) { 
    try { 
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`); 
        const data = await res.json(); 
        if(data.length > 0) { 
            if(markers[type]) map.removeLayer(markers[type]); 
            markers[type] = L.marker([data[0].lat, data[0].lon]).addTo(map).bindPopup(query); 
            map.flyTo([data[0].lat, data[0].lon], type === 'end' ? 12 : 6); 
        } 
    } catch(e) {} 
}

async function restoreMapMarkers() { 
    const start = document.getElementById('cityStart').value; 
    const end = document.getElementById('cityEnd').value; 
    if(start) placeMarker(start, 'start'); 
    if(end) placeMarker(end, 'end'); 
}

function delB(id) { tripData[activeDay] = tripData[activeDay].filter(x => x.id !== id); renderBlocks(); save(); }

function applyLang() { 
    const texts = { 
        fr: { title: "Explorez le monde ✈️", 
             subtitle: "Préparez votre itinéraire sur-mesure", 
             start: "DÉPART", 
             end: "ARRIVÉE", 
             from: "DU", 
             to: "AU", 
             cur: "DEVISE", 
             total: "TOTAL", 
             budget: "Budget :", 
             pdf: "📄 PDF", 
             vol: "Vol", 
             hotel: "Hôtel", 
             activ: "Activité", 
             resto: "Restaurant",
             focusShow: "Afficher l'en-tête",
             focusHide: "Masquer l'en-tête",
             pax: "VOYAGEURS" }, 
        en: { title: "Explore the World ✈️", 
             subtitle: "Plan your custom itinerary", 
             start: "FROM", 
             end: "TO", 
             from: "START", 
             to: "END", 
             cur: "CURRENCY", 
             total: "TOTAL", 
             budget: "Budget:", 
             pdf: "📄 PDF", 
             vol: "Flight", 
             hotel: "Hotel", 
             activ: "Activity", 
             resto: "Dining", 
             focusShow: "Show Header",
             focusHide: "Hide Header",
             pax: "TRAVELERS" } 
    }; 
    const t = texts[currentLang]; 
    document.getElementById('txt-title').innerText = t.title; 
    document.getElementById('txt-subtitle').innerText = t.subtitle; 
    document.getElementById('lbl-start').innerText = t.start; 
    document.getElementById('lbl-end').innerText = t.end; 
    document.getElementById('lbl-from').innerText = t.from; 
    document.getElementById('lbl-to').innerText = t.to; 
    document.getElementById('lbl-cur').innerText = t.cur; 
    document.getElementById('lbl-pax').innerText = t.pax; 
    document.getElementById('txt-total-lbl').innerText = t.total; 
    document.getElementById('txt-budget-lbl').innerText = t.budget; 
    document.getElementById('btn-pdf').innerText = t.pdf; 
    document.querySelectorAll('.t-vol').forEach(el => el.innerText = t.vol); 
    document.querySelectorAll('.t-hotel').forEach(el => el.innerText = t.hotel); 
    document.querySelectorAll('.t-activ').forEach(el => el.innerText = t.activ); 
    document.querySelectorAll('.t-resto').forEach(el => el.innerText = t.resto);
    renderBlocks(); 
}

function toggleFocus() {
    const isHidden = document.body.classList.toggle('header-hidden');
    const icon = document.getElementById('focus-icon');
    const text = document.getElementById('focus-text'); // On récupère l'élément texte
    
    icon.innerText = isHidden ? "🔽" : "🔼";
    
    // On met à jour le texte selon la langue et l'état
    if (text) {
        if (currentLang === 'fr') {
            text.innerText = isHidden ? "Afficher l'en-tête" : "Masquer l'en-tête";
        } else {
            text.innerText = isHidden ? "Show Header" : "Hide Header";
        }
    }
    
    setTimeout(() => { map.invalidateSize(); }, 300);
}

function clearAll() { if(confirm("Tout effacer ?")) { localStorage.clear(); location.reload(); } }
function exportPDF() { html2pdf().from(document.body).save('Itineraire.pdf'); }

