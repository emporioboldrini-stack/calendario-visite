// --- STATO DELL'APPLICAZIONE ---
let state = {
  clients: [], // { id: string, name: string }
  events: [],  // { id: string, clientId: string, startDate: string, endDate: string, startTime: string, endTime: string, recurrence: number }
  overrides: {} // chiave: "eventId_YYYY-MM-DD" -> { status: 'pianificata'|'effettuata'|'mancata', notes: string }
};

// UI State
let currentDate = new Date(); // Mese o settimana correntemente visualizzata
let selectedDate = new Date(); // Giorno selezionato per i dettagli
let currentView = 'month'; // 'month' o 'week'

// Costanti
const DAYS_OF_WEEK_IT = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const DAYS_SHORT_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

// --- CONFIGURAZIONE FIREBASE ---
const firebaseConfig = {
  projectId: "deconto-vending-app",
  appId: "1:959340769418:web:8b6f05f5430d1a1d1f3d73",
  storageBucket: "deconto-vending-app.firebasestorage.app",
  apiKey: "AIzaSyCrhuHoKmfvuHxr9ZE46fI1oTL44OcYVkM",
  authDomain: "deconto-vending-app.firebaseapp.com",
  messagingSenderId: "959340769418"
};

let db = null;
let useFirestore = false;

// --- INIZIALIZZAZIONE ---
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  initUI();
  if (!useFirestore) {
    loadFromLocalStorage();
    render();
  }
});

function initFirebase() {
  try {
    if (typeof firebase !== 'undefined') {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      useFirestore = true;
      initFirestoreSync();
    } else {
      console.warn("Librerie Firebase non caricate. Fallback locale.");
      useFirestore = false;
    }
  } catch (e) {
    console.warn("Errore durante l'inizializzazione di Firebase. Fallback locale.", e);
    useFirestore = false;
  }
}

function initFirestoreSync() {
  if (!useFirestore || !db) return;
  
  // Abilita persistenza offline nativa di Firestore
  db.enablePersistence().catch((err) => {
    console.warn("Firestore offline persistence disabilitata:", err.code);
  });
  
  let clientsSynced = false;
  let eventsSynced = false;
  let overridesSynced = false;

  const handleSyncError = (err) => {
    console.warn("Firestore non attivo o regole mancanti. Fallback automatico su localStorage.", err);
    if (!clientsSynced || !eventsSynced || !overridesSynced) {
      useFirestore = false; // Disabilita per evitare tentativi di scrittura falliti
      loadFromLocalStorage();
      render();
    }
  };

  db.collection('calendario_clients').onSnapshot(snapshot => {
    state.clients = [];
    snapshot.forEach(doc => {
      state.clients.push({ id: doc.id, ...doc.data() });
    });
    clientsSynced = true;
    saveToLocalStorage();
    render();
  }, handleSyncError);

  db.collection('calendario_events').onSnapshot(snapshot => {
    state.events = [];
    snapshot.forEach(doc => {
      state.events.push({ id: doc.id, ...doc.data() });
    });
    eventsSynced = true;
    saveToLocalStorage();
    render();
  }, handleSyncError);

  db.collection('calendario_overrides').onSnapshot(snapshot => {
    state.overrides = {};
    snapshot.forEach(doc => {
      state.overrides[doc.id] = doc.data();
    });
    overridesSynced = true;
    saveToLocalStorage();
    render();
  }, handleSyncError);
}

// Caricamento dati
function loadFromLocalStorage() {
  const savedState = localStorage.getItem('visitplanner_state');
  if (savedState) {
    try {
      state = JSON.parse(savedState);
      // Assicurati che le strutture di base esistano
      if (!state.clients) state.clients = [];
      if (!state.events) state.events = [];
      if (!state.overrides) state.overrides = {};
    } catch (e) {
      console.error("Errore nel caricamento dei dati da localStorage, inizializzo stato vuoto.", e);
    }
  } else {
    // Dati dimostrativi iniziali (opzionali, ma utili per guidare l'utente al primo avvio)
    state.clients = [
      { id: 'cli_1', name: 'Gherardini S.r.l.' },
      { id: 'cli_2', name: 'Bini Costruzioni' },
      { id: 'cli_3', name: 'Rossi Alimentari' }
    ];
    
    // Programmazione di esempio per Gherardini (Lunedì 10 Agosto 2026, 9:00-9:30, ogni settimana fino a fine anno)
    state.events = [
      {
        id: 'evt_1',
        clientId: 'cli_1',
        startDate: '2026-08-10',
        endDate: '2026-12-31',
        startTime: '09:00',
        endTime: '09:30',
        recurrence: 1 // Ogni settimana
      }
    ];
    
    state.overrides = {
      'evt_1_2026-08-10': {
        status: 'pianificata',
        notes: 'Primo incontro per definizione accordo quadro.'
      }
    };
    saveToLocalStorage();
  }
}

function saveToLocalStorage() {
  localStorage.setItem('visitplanner_state', JSON.stringify(state));
}

// Inizializzazione Elementi Grafici e Event Listeners
function initUI() {
  // Popola i menu a tendina dell'orario
  populateTimeDropdowns();
  
  // Sidebar Navigation
  document.getElementById('nav-calendar-btn').addEventListener('click', (e) => {
    switchSection('calendar');
    setActiveNav(e.currentTarget);
  });
  document.getElementById('nav-clients-btn').addEventListener('click', (e) => {
    switchSection('clients');
    setActiveNav(e.currentTarget);
  });
  
  // Navigation del Calendario
  document.getElementById('cal-prev-btn').addEventListener('click', () => navigateCalendar(-1));
  document.getElementById('cal-next-btn').addEventListener('click', () => navigateCalendar(1));
  document.getElementById('cal-today-btn').addEventListener('click', () => {
    currentDate = new Date();
    selectedDate = new Date();
    render();
  });
  
  // View Switch (Mese / Settimana)
  document.getElementById('view-month-btn').addEventListener('click', (e) => {
    currentView = 'month';
    setActiveTab(e.currentTarget);
    render();
  });
  document.getElementById('view-week-btn').addEventListener('click', (e) => {
    currentView = 'week';
    setActiveTab(e.currentTarget);
    render();
  });

  // Aggiungi Visita (bottone nel pannello dettagli)
  document.getElementById('add-visit-btn').addEventListener('click', () => {
    openProgramModalForDate(formatDateISO(selectedDate));
  });

  // Form Programmazione Visite
  document.getElementById('program-visit-form').addEventListener('submit', handleProgramSubmit);
  document.getElementById('event-recurrence').addEventListener('change', toggleRecurrenceEndDateField);
  document.getElementById('event-start-date').addEventListener('change', (e) => {
    updateDayOfWeekDisplay(e.target.value);
  });
  document.getElementById('delete-event-btn').addEventListener('click', handleDeleteEvent);
  
  // Form Esito Visita (Log Outcome)
  document.getElementById('log-outcome-form').addEventListener('submit', handleLogOutcomeSubmit);

  // Form Gestione Clienti
  document.getElementById('client-crud-form').addEventListener('submit', handleClientSubmit);
  document.getElementById('cancel-client-edit-btn').addEventListener('click', resetClientForm);
  document.getElementById('client-search').addEventListener('input', renderClients);

  // Backup Dati
  document.getElementById('export-backup-btn').addEventListener('click', exportBackup);
  document.getElementById('import-backup-trigger-btn').addEventListener('click', () => {
    document.getElementById('import-backup-file').click();
  });
  document.getElementById('import-backup-file').addEventListener('change', importBackup);

  // Gestione Stampa
  const printBtn = document.getElementById('print-btn');
  const printDropdown = document.getElementById('print-dropdown');
  printBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    printDropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', () => {
    printDropdown.classList.add('hidden');
  });
  document.getElementById('print-day-btn').addEventListener('click', handlePrintDay);
  document.getElementById('print-week-btn').addEventListener('click', handlePrintWeek);
  document.getElementById('print-month-btn').addEventListener('click', handlePrintMonth);

  // Chiusura Modali generica
  document.querySelectorAll('.close-modal-btn, .cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      closeAllModals();
    });
  });

  // Validazione orari su cambiamento select
  document.getElementById('event-start-time').addEventListener('change', () => {
    autoSetEndTime();
    validateTimes();
  });
  document.getElementById('event-end-time').addEventListener('change', validateTimes);
}

// --- LOGICA DI NAVIGAZIONE E VIEW-SWITCHING ---

function switchSection(sectionName) {
  document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));
  document.getElementById(`section-${sectionName}`).classList.remove('hidden');
}

function setActiveNav(activeBtn) {
  document.querySelectorAll('.sidebar-nav .nav-btn').forEach(btn => btn.classList.remove('active'));
  activeBtn.classList.add('active');
}

function setActiveTab(activeBtn) {
  document.querySelectorAll('.view-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
  activeBtn.classList.add('active');
}

function navigateCalendar(direction) {
  if (currentView === 'month') {
    // Sposta di 1 mese
    currentDate.setMonth(currentDate.getMonth() + direction);
  } else {
    // Sposta di 1 settimana (7 giorni)
    currentDate.setDate(currentDate.getDate() + (direction * 7));
  }
  render();
}

// --- POPOLAMENTO TENDINE ORARIO ---
function populateTimeDropdowns() {
  const startTimeSelect = document.getElementById('event-start-time');
  const endTimeSelect = document.getElementById('event-end-time');
  
  startTimeSelect.innerHTML = '';
  endTimeSelect.innerHTML = '';
  
  for (let h = 7; h <= 21; h++) {
    for (let m of ['00', '30']) {
      const timeStr = `${h.toString().padStart(2, '0')}:${m}`;
      
      const optStart = document.createElement('option');
      optStart.value = timeStr;
      optStart.textContent = timeStr;
      startTimeSelect.appendChild(optStart);

      const optEnd = document.createElement('option');
      optEnd.value = timeStr;
      optEnd.textContent = timeStr;
      endTimeSelect.appendChild(optEnd);
    }
  }
}

function autoSetEndTime() {
  const startSelect = document.getElementById('event-start-time');
  const endSelect = document.getElementById('event-end-time');
  
  const startIndex = startSelect.selectedIndex;
  // Imposta automaticamente l'orario di fine a +1 slot (+30 min) se possibile
  if (startIndex < startSelect.options.length - 1) {
    endSelect.selectedIndex = startIndex + 1;
  } else {
    endSelect.selectedIndex = startIndex;
  }
}

function validateTimes() {
  const startTime = document.getElementById('event-start-time').value;
  const endTime = document.getElementById('event-end-time').value;
  const endSelect = document.getElementById('event-end-time');
  
  if (startTime && endTime) {
    if (endTime <= startTime) {
      endSelect.setCustomValidity("L'orario di fine deve essere successivo all'orario di inizio.");
    } else {
      endSelect.setCustomValidity("");
    }
  }
}

// --- CALCOLO DATE E MOTORE RICORRENZE ---

// Ritorna la differenza in giorni (robusta contro il cambio dell'ora legale)
function getDaysDiff(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1 + 'T12:00:00');
  const d2 = new Date(dateStr2 + 'T12:00:00');
  const diffMs = d2.getTime() - d1.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// Ritorna la lista di tutte le visite (istanze calcolate + override) per un intervallo di date
function getVisitsForPeriod(startDateStr, endDateStr) {
  const visits = [];
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T23:59:59');
  
  let current = new Date(start);
  while (current <= end) {
    const currentDateStr = formatDateISO(current);
    const dayOfWeek = current.getDay(); // 0 = Dom, 1 = Lun, ecc.
    
    for (const event of state.events) {
      // Risolvi il giorno della settimana originario dall'evento
      const eventStartDay = new Date(event.startDate + 'T12:00:00').getDay();
      
      if (event.recurrence === 0) {
        // Appuntamento singolo
        if (event.startDate === currentDateStr) {
          visits.push(createVisitInstance(event, currentDateStr));
        }
      } else {
        // Appuntamento ricorrente
        // 1. Deve rientrare nell'intervallo temporale dell'evento
        if (currentDateStr >= event.startDate && currentDateStr <= event.endDate) {
          // 2. Deve essere lo stesso giorno della settimana
          if (dayOfWeek === eventStartDay) {
            // 3. Deve rispettare la frequenza settimanale
            const daysDiff = getDaysDiff(event.startDate, currentDateStr);
            const weeksDiff = daysDiff / 7;
            if (weeksDiff >= 0 && weeksDiff % event.recurrence === 0) {
              visits.push(createVisitInstance(event, currentDateStr));
            }
          }
        }
      }
    }
    current.setDate(current.getDate() + 1);
  }
  
  return visits;
}

// Unisce le proprietà dell'evento base e gli override specifici del giorno
function createVisitInstance(event, dateStr) {
  const overrideKey = `${event.id}_${dateStr}`;
  const override = state.overrides[overrideKey] || {};
  
  const client = state.clients.find(c => c.id === event.clientId);
  const clientName = client ? client.name : 'Cliente Sconosciuto';
  
  return {
    eventId: event.id,
    clientId: event.clientId,
    clientName: clientName,
    date: dateStr,
    startTime: event.startTime,
    endTime: event.endTime,
    recurrence: event.recurrence,
    status: override.status || 'pianificata',
    notes: override.notes || '',
    hasOverride: !!state.overrides[overrideKey]
  };
}

// --- LOGICA DI RENDERING ---

function render() {
  // Popola la select clienti nel form
  populateClientSelect();
  
  // Rende la vista del calendario attiva
  if (currentView === 'month') {
    renderMonthView();
  } else {
    renderWeekView();
  }
  
  // Aggiorna il pannello laterale del dettaglio del giorno
  renderDayDetails();
  
  // Rende anche la lista dei clienti nel tab gestione clienti
  renderClients();
}

// Popola la tendina dei clienti nel modale di programmazione
function populateClientSelect() {
  const select = document.getElementById('event-client-select');
  const currentValue = select.value;
  
  // Mantieni solo l'opzione vuota disabilitata
  select.innerHTML = '<option value="" disabled selected>Seleziona un cliente...</option>';
  
  // Ordina i clienti alfabeticamente
  const sortedClients = [...state.clients].sort((a, b) => a.name.localeCompare(b.name));
  
  sortedClients.forEach(client => {
    const opt = document.createElement('option');
    opt.value = client.id;
    opt.textContent = client.name;
    select.appendChild(opt);
  });
  
  if (currentValue && state.clients.some(c => c.id === currentValue)) {
    select.value = currentValue;
  }
}

// RENDER: VISTA MENSILE
function renderMonthView() {
  const container = document.getElementById('calendar-grid-container');
  container.innerHTML = '';
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Imposta il titolo (es: "Agosto 2026")
  document.getElementById('calendar-title').textContent = `${MONTHS_IT[month]} ${year}`;
  
  // Primo giorno del mese
  const firstDayOfMonth = new Date(year, month, 1);
  // Trova l'indice del giorno di partenza della griglia.
  // In JS getDay() è: 0 = Dom, 1 = Lun, 2 = Mar...
  // Vogliamo Lunedì come prima colonna (indice 0), quindi rimappiamo:
  let startDayIndex = firstDayOfMonth.getDay() - 1;
  if (startDayIndex === -1) startDayIndex = 6; // Se è Domenica (0), diventa 6
  
  // Determina la data di inizio da visualizzare (andando indietro per riempire la prima settimana)
  const gridStartDate = new Date(firstDayOfMonth);
  gridStartDate.setDate(gridStartDate.getDate() - startDayIndex);
  
  // Determina la data di fine da visualizzare (6 settimane = 42 giorni in totale per consistenza visiva)
  const gridEndDate = new Date(gridStartDate);
  gridEndDate.setDate(gridEndDate.getDate() + 41);
  
  // Recupera tutte le visite del periodo
  const visits = getVisitsForPeriod(formatDateISO(gridStartDate), formatDateISO(gridEndDate));
  
  // Genera Struttura HTML Grid
  const gridElement = document.createElement('div');
  gridElement.className = 'calendar-grid';
  
  // Header dei giorni della settimana (Lun -> Dom)
  const headerRow = document.createElement('div');
  headerRow.className = 'calendar-header-row';
  for (let i = 1; i <= 7; i++) {
    const dayIndex = i % 7; // 1,2,3,4,5,6,0
    const dayLabel = document.createElement('div');
    dayLabel.textContent = DAYS_SHORT_IT[dayIndex];
    headerRow.appendChild(dayLabel);
  }
  container.appendChild(headerRow);
  
  // Genera le singole celle
  let tempDate = new Date(gridStartDate);
  for (let i = 0; i < 42; i++) {
    const dateStr = formatDateISO(tempDate);
    const isOtherMonth = tempDate.getMonth() !== month;
    const isToday = isSameDay(tempDate, new Date());
    const isSelected = isSameDay(tempDate, selectedDate);
    
    const cell = document.createElement('div');
    cell.className = `calendar-day-cell`;
    if (isOtherMonth) cell.classList.add('other-month');
    if (isToday) cell.classList.add('today');
    if (isSelected) cell.classList.add('selected-day');
    cell.dataset.date = dateStr;
    
    // Numero del giorno
    const dayHeader = document.createElement('div');
    dayHeader.className = 'day-header';
    const dayNum = document.createElement('span');
    dayNum.className = 'day-number';
    dayNum.textContent = tempDate.getDate();
    dayHeader.appendChild(dayNum);
    cell.appendChild(dayHeader);
    
    // Contenitore eventi per la cella
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'calendar-events-container';
    
    // Filtra visite per questo giorno
    const dayVisits = visits.filter(v => v.date === dateStr);
    // Ordina per orario d'inizio
    dayVisits.sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    // Mostra al massimo 3 eventi, poi "+ X altri"
    const maxBadges = 2;
    dayVisits.slice(0, maxBadges).forEach(v => {
      const badge = document.createElement('div');
      badge.className = `event-badge status-${v.status}`;
      badge.textContent = `${v.startTime} ${v.clientName}`;
      badge.title = `${v.clientName} (${v.startTime}-${v.endTime}) - Stato: ${v.status}`;
      eventsContainer.appendChild(badge);
    });
    
    if (dayVisits.length > maxBadges) {
      const moreLabel = document.createElement('div');
      moreLabel.style.fontSize = '9px';
      moreLabel.style.color = 'var(--text-muted)';
      moreLabel.style.textAlign = 'right';
      moreLabel.style.fontWeight = '600';
      moreLabel.textContent = `+${dayVisits.length - maxBadges} altri`;
      eventsContainer.appendChild(moreLabel);
    }
    
    cell.appendChild(eventsContainer);
    
    // Eventi Click sulla cella
    cell.addEventListener('click', (e) => {
      selectedDate = new Date(dateStr + 'T12:00:00');
      document.querySelectorAll('.calendar-day-cell').forEach(c => c.classList.remove('selected-day'));
      cell.classList.add('selected-day');
      renderDayDetails();
    });

    // Double click per creare velocemente un evento
    cell.addEventListener('dblclick', () => {
      selectedDate = new Date(dateStr + 'T12:00:00');
      openProgramModalForDate(dateStr);
    });
    
    gridElement.appendChild(cell);
    tempDate.setDate(tempDate.getDate() + 1);
  }
  
  container.appendChild(gridElement);
}

// RENDER: VISTA SETTIMANALE
function renderWeekView() {
  const container = document.getElementById('calendar-grid-container');
  container.innerHTML = '';
  
  // Trova il Lunedì della settimana correntemente visualizzata
  const monday = getMonday(currentDate);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  // Imposta il titolo (es: "Agosto 2026" o intervallo "10 - 16 Agosto 2026")
  const mondayMonth = MONTHS_IT[monday.getMonth()];
  const sundayMonth = MONTHS_IT[sunday.getMonth()];
  if (monday.getMonth() === sunday.getMonth()) {
    document.getElementById('calendar-title').textContent = `${monday.getDate()} - ${sunday.getDate()} ${mondayMonth} ${monday.getFullYear()}`;
  } else {
    document.getElementById('calendar-title').textContent = `${monday.getDate()} ${mondayMonth.slice(0,3)} - ${sunday.getDate()} ${sundayMonth.slice(0,3)} ${monday.getFullYear()}`;
  }
  
  // Struttura Grid Settimanale
  const weeklyWrapper = document.createElement('div');
  weeklyWrapper.style.display = 'flex';
  weeklyWrapper.style.flexDirection = 'column';
  weeklyWrapper.style.height = '100%';
  weeklyWrapper.style.overflow = 'hidden';
  
  // Header row della settimana (colonna vuota per le ore + 7 colonne giorni)
  const headerRow = document.createElement('div');
  headerRow.className = 'weekly-grid-header';
  const emptyCorner = document.createElement('div');
  headerRow.appendChild(emptyCorner);
  
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    weekDays.push(day);
    
    const dayHeader = document.createElement('div');
    const isToday = isSameDay(day, new Date());
    dayHeader.innerHTML = `
      <div style="font-weight: 500;">${DAYS_SHORT_IT[day.getDay()]}</div>
      <div style="font-size: 15px; font-weight: 700; color: ${isToday ? 'var(--primary)' : 'inherit'};">${day.getDate()}</div>
    `;
    headerRow.appendChild(dayHeader);
  }
  weeklyWrapper.appendChild(headerRow);
  
  // Body della griglia settimanale
  const gridBody = document.createElement('div');
  gridBody.className = 'weekly-grid-body';
  
  // Colonna delle ore (da 07:00 a 21:00)
  const hoursCol = document.createElement('div');
  hoursCol.className = 'weekly-hour-col';
  for (let h = 7; h <= 21; h++) {
    const label = document.createElement('div');
    label.className = 'weekly-hour-label';
    label.textContent = `${h.toString().padStart(2, '0')}:00`;
    hoursCol.appendChild(label);
  }
  gridBody.appendChild(hoursCol);
  
  // Calcola visite del periodo
  const visits = getVisitsForPeriod(formatDateISO(monday), formatDateISO(sunday));
  
  // Genera le colonne dei giorni
  weekDays.forEach((day, index) => {
    const dateStr = formatDateISO(day);
    const isToday = isSameDay(day, new Date());
    const isSelected = isSameDay(day, selectedDate);
    
    const dayCol = document.createElement('div');
    dayCol.className = `weekly-day-col ${isToday ? 'today' : ''}`;
    dayCol.dataset.date = dateStr;
    
    // Disegna righe di sfondo orizzontali per ogni ora
    for (let h = 7; h <= 21; h++) {
      const line = document.createElement('div');
      line.className = 'weekly-grid-line hour-line';
      line.style.top = `${(h - 7) * 50}px`;
      dayCol.appendChild(line);
      
      const halfLine = document.createElement('div');
      halfLine.className = 'weekly-grid-line';
      halfLine.style.top = `${(h - 7) * 50 + 25}px`;
      dayCol.appendChild(halfLine);
    }
    
    // Inserisci le visite programmate per questo giorno
    const dayVisits = visits.filter(v => v.date === dateStr);
    dayVisits.forEach(visit => {
      const startMin = timeToMinutes(visit.startTime);
      const endMin = timeToMinutes(visit.endTime);
      
      // Calcola posizionamento (ogni ora è 50px di altezza, inizio a 07:00 = 420 minuti)
      const topOffset = (startMin - 420) * (50 / 60);
      const height = (endMin - startMin) * (50 / 60);
      
      const card = document.createElement('div');
      card.className = `weekly-event-card status-${visit.status}`;
      card.style.top = `${topOffset + 2}px`;
      card.style.height = `${height - 4}px`;
      card.title = `${visit.clientName} (${visit.startTime}-${visit.endTime}) - Esito: ${visit.status}`;
      
      card.innerHTML = `
        <div style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${visit.clientName}</div>
        <div style="font-size: 9px; opacity: 0.9;">${visit.startTime}-${visit.endTime}</div>
      `;
      
      // Click sull'evento
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedDate = new Date(dateStr + 'T12:00:00');
        renderDayDetails();
        openChoiceModal(visit);
      });
      
      dayCol.appendChild(card);
    });
    
    // Click sulla colonna del giorno per selezionarlo o inserire evento
    dayCol.addEventListener('click', (e) => {
      selectedDate = new Date(dateStr + 'T12:00:00');
      document.querySelectorAll('.weekly-day-col').forEach(c => c.style.backgroundColor = '');
      dayCol.style.backgroundColor = 'rgba(99, 102, 241, 0.05)';
      renderDayDetails();
    });
    
    dayCol.addEventListener('dblclick', (e) => {
      // Calcola l'ora approssimativa del click per precompilarla
      const rect = dayCol.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const totalMinutes = Math.floor(clickY / (50 / 60)) + 420;
      
      // Arrotonda ai 30 min più vicini
      const roundedMinutes = Math.round(totalMinutes / 30) * 30;
      const h = Math.floor(roundedMinutes / 60);
      const m = roundedMinutes % 60;
      
      const clickTimeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      
      selectedDate = new Date(dateStr + 'T12:00:00');
      openProgramModalForDate(dateStr, clickTimeStr);
    });
    
    gridBody.appendChild(dayCol);
  });
  
  weeklyWrapper.appendChild(gridBody);
  container.appendChild(weeklyWrapper);
}

// RENDER: PANNELLO DETTAGLIO GIORNO (LATERALE)
function renderDayDetails() {
  const label = document.getElementById('selected-day-label');
  const listContainer = document.getElementById('day-visits-list');
  
  const dateStr = formatDateISO(selectedDate);
  
  // Format giorno in italiano: es "Lunedì, 10 Agosto 2026"
  const formattedDayText = `${DAYS_OF_WEEK_IT[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS_IT[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  label.textContent = formattedDayText;
  
  listContainer.innerHTML = '';
  
  // Trova le visite per questo giorno
  const visits = getVisitsForPeriod(dateStr, dateStr);
  
  if (visits.length === 0) {
    listContainer.innerHTML = '<div class="empty-state">Nessuna visita programmata per oggi.</div>';
    return;
  }
  
  // Ordina per orario d'inizio
  visits.sort((a, b) => a.startTime.localeCompare(b.startTime));
  
  visits.forEach(visit => {
    const card = document.createElement('div');
    card.className = 'visit-card';
    
    const recurrenceLabels = [
      '', // Singola
      'Ogni settimana',
      'Ogni 2 settimane',
      'Ogni 3 settimane',
      'Ogni 4 settimane'
    ];
    
    const recText = visit.recurrence > 0 ? recurrenceLabels[visit.recurrence] : '';
    
    card.innerHTML = `
      <div class="visit-card-header">
        <span class="visit-client-name">${escapeHTML(visit.clientName)}</span>
        <span class="visit-badge-status status-${visit.status}">${visit.status}</span>
      </div>
      <div style="display: flex; gap: 10px; align-items: center; margin-top: 2px;">
        <span class="visit-time">🕒 ${visit.startTime} - ${visit.endTime}</span>
        ${visit.recurrence > 0 ? `<span class="visit-recurrence-badge">🔄 ${recText}</span>` : ''}
      </div>
      ${visit.notes ? `<div class="visit-card-notes">${escapeHTML(visit.notes)}</div>` : ''}
    `;
    
    card.addEventListener('click', () => {
      openChoiceModal(visit);
    });
    
    listContainer.appendChild(card);
  });
}

// RENDER: ANAGRAFICA CLIENTI
function renderClients() {
  const grid = document.getElementById('clients-grid');
  const searchVal = document.getElementById('client-search').value.toLowerCase();
  
  grid.innerHTML = '';
  
  const filteredClients = state.clients.filter(c => c.name.toLowerCase().includes(searchVal));
  
  if (filteredClients.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1;" class="empty-state">Nessun cliente registrato corrispondente alla ricerca.</div>';
    return;
  }
  
  // Ordina alfabeticamente
  filteredClients.sort((a, b) => a.name.localeCompare(b.name));
  
  filteredClients.forEach(client => {
    const card = document.createElement('div');
    card.className = 'client-card';
    
    card.innerHTML = `
      <div class="client-card-name">${escapeHTML(client.name)}</div>
      <div class="client-card-actions">
        <button class="btn btn-secondary btn-sm edit-client-btn">✏️ Rinomina</button>
        <button class="btn btn-secondary btn-sm history-client-btn">📊 Storico Visite</button>
        <button class="btn btn-danger btn-sm delete-client-btn" style="margin-left: auto;">🗑️ Rimuovi</button>
      </div>
    `;
    
    // Event Listeners sui bottoni della card cliente
    card.querySelector('.edit-client-btn').addEventListener('click', () => editClient(client));
    card.querySelector('.history-client-btn').addEventListener('click', () => showClientHistory(client.id));
    card.querySelector('.delete-client-btn').addEventListener('click', () => deleteClient(client.id));
    
    grid.appendChild(card);
  });
}

// --- LOGICA MODALI ---

function openModal(modalId) {
  document.getElementById(modalId).classList.add('show');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('show'));
}

// MODALE SCELTA (OUTCOME VS SERIE COMPLETA)
function openChoiceModal(visit) {
  document.getElementById('choice-client-name').textContent = visit.clientName;
  
  const formattedDate = formatDateItalian(visit.date);
  document.getElementById('choice-visit-datetime').textContent = `${formattedDate} | ore ${visit.startTime} - ${visit.endTime}`;
  
  const badge = document.getElementById('choice-visit-status-badge');
  badge.className = `badge status-${visit.status}`;
  badge.textContent = visit.status.toUpperCase();
  
  // Assegna i click ai due pulsanti d'azione del modale scelta
  document.getElementById('choice-log-btn').onclick = () => {
    closeAllModals();
    openLogModal(visit);
  };
  
  document.getElementById('choice-edit-series-btn').onclick = () => {
    closeAllModals();
    openProgramModalForEdit(visit.eventId);
  };
  
  openModal('choice-modal');
}

// MODALE REGISTRAZIONE ESITO (OVERRIDE DI ISTANZA)
function openLogModal(visit) {
  document.getElementById('log-event-id').value = visit.eventId;
  document.getElementById('log-date').value = visit.date;
  document.getElementById('log-client-name-label').textContent = visit.clientName;
  
  const formattedDate = formatDateItalian(visit.date);
  document.getElementById('log-datetime-label').textContent = `${formattedDate} alle ore ${visit.startTime} - ${visit.endTime}`;
  
  // Ripristina o imposta lo stato dei radio button
  const radios = document.getElementsByName('visit-status');
  radios.forEach(radio => {
    if (radio.value === visit.status) {
      radio.checked = true;
    }
  });
  
  // Imposta le note esistenti
  document.getElementById('log-notes').value = visit.notes || '';
  
  openModal('log-modal');
}

function handleLogOutcomeSubmit(e) {
  e.preventDefault();
  
  const eventId = document.getElementById('log-event-id').value;
  const dateStr = document.getElementById('log-date').value;
  
  const status = document.querySelector('input[name="visit-status"]:checked').value;
  const notes = document.getElementById('log-notes').value.trim();
  
  const overrideKey = `${eventId}_${dateStr}`;
  
  if (useFirestore && db) {
    if (status === 'pianificata' && !notes) {
      db.collection('calendario_overrides').doc(overrideKey).delete()
        .then(() => closeAllModals())
        .catch(err => console.error("Errore salvataggio esito su Firestore:", err));
    } else {
      db.collection('calendario_overrides').doc(overrideKey).set({ eventId, date: dateStr, status, notes })
        .then(() => closeAllModals())
        .catch(err => console.error("Errore salvataggio esito su Firestore:", err));
    }
  } else {
    // Se è "pianificata" e non ci sono note, rimuoviamo l'override per pulire la memoria locale
    if (status === 'pianificata' && !notes) {
      delete state.overrides[overrideKey];
    } else {
      state.overrides[overrideKey] = { status, notes };
    }
    saveToLocalStorage();
    closeAllModals();
    render();
  }
}

// MODALE CREAZIONE / MODIFICA PROGRAMMAZIONE REALE (SERIE BASE)

function openProgramModalForDate(dateStr, timeStr = '09:00') {
  // Configura modale in modalità CREAZIONE
  document.getElementById('program-modal-title').textContent = 'Programma Visita Commerciale';
  document.getElementById('edit-event-id').value = '';
  document.getElementById('delete-event-btn').classList.add('hidden');
  
  // Popola data iniziale
  document.getElementById('event-start-date').value = dateStr;
  updateDayOfWeekDisplay(dateStr);
  
  // Popola orario consigliato
  document.getElementById('event-start-time').value = timeStr;
  autoSetEndTime();
  validateTimes();
  
  // Ripristina ricorrenza a "Singola"
  document.getElementById('event-recurrence').value = '0';
  document.getElementById('recurrence-end-container').classList.add('hidden');
  document.getElementById('event-end-date').value = '';
  document.getElementById('event-end-date').required = false;
  
  openModal('program-modal');
}

function openProgramModalForEdit(eventId) {
  const event = state.events.find(e => e.id === eventId);
  if (!event) return;
  
  // Configura modale in modalità MODIFICA
  document.getElementById('program-modal-title').textContent = 'Modifica Programmazione Completa';
  document.getElementById('edit-event-id').value = event.id;
  document.getElementById('delete-event-btn').classList.remove('hidden');
  
  // Carica i dati
  document.getElementById('event-client-select').value = event.clientId;
  document.getElementById('event-start-date').value = event.startDate;
  updateDayOfWeekDisplay(event.startDate);
  
  document.getElementById('event-start-time').value = event.startTime;
  document.getElementById('event-end-time').value = event.endTime;
  validateTimes();
  
  document.getElementById('event-recurrence').value = event.recurrence.toString();
  
  if (event.recurrence > 0) {
    document.getElementById('recurrence-end-container').classList.remove('hidden');
    document.getElementById('event-end-date').value = event.endDate;
    document.getElementById('event-end-date').required = true;
  } else {
    document.getElementById('recurrence-end-container').classList.add('hidden');
    document.getElementById('event-end-date').value = '';
    document.getElementById('event-end-date').required = false;
  }
  
  openModal('program-modal');
}

function toggleRecurrenceEndDateField(e) {
  const recurrenceVal = parseInt(e.target.value);
  const container = document.getElementById('recurrence-end-container');
  const endDateInput = document.getElementById('event-end-date');
  
  if (recurrenceVal > 0) {
    container.classList.remove('hidden');
    endDateInput.required = true;
    
    // Se vuoto, suggerisci automaticamente fine anno 2026 o fine dell'anno corrente
    if (!endDateInput.value) {
      const startVal = document.getElementById('event-start-date').value;
      if (startVal) {
        const startYear = new Date(startVal + 'T12:00:00').getFullYear();
        endDateInput.value = `${startYear}-12-31`;
      } else {
        endDateInput.value = '2026-12-31';
      }
    }
  } else {
    container.classList.add('hidden');
    endDateInput.required = false;
    endDateInput.value = '';
  }
}

function updateDayOfWeekDisplay(dateStr) {
  const display = document.getElementById('event-day-display');
  if (dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    display.value = DAYS_OF_WEEK_IT[d.getDay()];
  } else {
    display.value = '';
  }
}

function handleProgramSubmit(e) {
  e.preventDefault();
  
  const editId = document.getElementById('edit-event-id').value;
  const clientId = document.getElementById('event-client-select').value;
  const startDate = document.getElementById('event-start-date').value;
  const startTime = document.getElementById('event-start-time').value;
  const endTime = document.getElementById('event-end-time').value;
  const recurrence = parseInt(document.getElementById('event-recurrence').value);
  let endDate = document.getElementById('event-end-date').value;
  
  if (recurrence === 0) {
    endDate = startDate; // Per gli eventi singoli, fine coincide con l'inizio
  } else {
    if (endDate < startDate) {
      alert("La data di fine ricorrenza non può essere antecedente alla data del primo passaggio.");
      return;
    }
  }
  
  const eventId = editId || `evt_${Date.now()}`;
  const eventData = {
    clientId,
    startDate,
    endDate,
    startTime,
    endTime,
    recurrence
  };

  if (useFirestore && db) {
    db.collection('calendario_events').doc(eventId).set(eventData)
      .then(() => closeAllModals())
      .catch(err => console.error("Errore salvataggio programmazione su Firestore:", err));
  } else {
    if (editId) {
      // MODIFICA SERIE ESISTENTE
      const idx = state.events.findIndex(evt => evt.id === editId);
      if (idx !== -1) {
        state.events[idx] = { id: editId, ...eventData };
      }
    } else {
      // CREA NUOVA SERIE
      state.events.push({ id: eventId, ...eventData });
    }
    saveToLocalStorage();
    closeAllModals();
    render();
  }
}

async function handleDeleteEvent() {
  const editId = document.getElementById('edit-event-id').value;
  if (!editId) return;
  
  if (confirm("Sei sicuro di voler eliminare questa programmazione? Verranno rimossi tutti i passaggi futuri. Gli storici passati potrebbero essere orfani.")) {
    if (useFirestore && db) {
      try {
        const batch = db.batch();
        batch.delete(db.collection('calendario_events').doc(editId));
        
        // Rimuovi gli override correlati
        for (const key of Object.keys(state.overrides)) {
          if (key.startsWith(editId + '_')) {
            batch.delete(db.collection('calendario_overrides').doc(key));
          }
        }
        await batch.commit();
        closeAllModals();
      } catch (err) {
        console.error("Errore durante l'eliminazione da Firestore:", err);
      }
    } else {
      state.events = state.events.filter(evt => evt.id !== editId);
      
      // Facciamo pulizia degli override relativi a questo evento
      for (const key of Object.keys(state.overrides)) {
        if (key.startsWith(editId + '_')) {
          delete state.overrides[key];
        }
      }
      saveToLocalStorage();
      closeAllModals();
      render();
    }
  }
}

// MODALE ANAGRAFICA DETTAGLI E STORICO CLIENTE
function showClientHistory(clientId) {
  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;
  
  document.getElementById('history-modal-title').textContent = `Storico Visite: ${client.name}`;
  
  // Raccogliamo tutti gli override passati di visite con questo clientId
  const clientLoggedVisits = [];
  
  for (const [key, override] of Object.entries(state.overrides)) {
    const [eventId, dateStr] = key.split('_');
    
    // Verifichiamo se l'evento base appartiene a questo cliente
    const event = state.events.find(e => e.id === eventId);
    if (event && event.clientId === clientId) {
      clientLoggedVisits.push({
        date: dateStr,
        startTime: event.startTime,
        endTime: event.endTime,
        status: override.status,
        notes: override.notes
      });
    }
  }
  
  // Ordina per data decrescente (le più recenti in alto), poi orario d'inizio
  clientLoggedVisits.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.startTime.localeCompare(a.startTime);
  });
  
  const total = clientLoggedVisits.length;
  const completed = clientLoggedVisits.filter(v => v.status === 'effettuata').length;
  const missed = clientLoggedVisits.filter(v => v.status === 'mancata').length;
  
  // Aggiorna contatori statistiche
  document.getElementById('stat-total-visits').textContent = total;
  document.getElementById('stat-completed-visits').textContent = completed;
  document.getElementById('stat-missed-visits').textContent = missed;
  
  const timeline = document.getElementById('history-timeline');
  timeline.innerHTML = '';
  
  if (total === 0) {
    timeline.innerHTML = '<div class="timeline-empty">Nessuna visita registrata in passato per questo cliente.</div>';
  } else {
    clientLoggedVisits.forEach(visit => {
      const item = document.createElement('div');
      item.className = 'timeline-item';
      
      const formattedDate = formatDateItalian(visit.date);
      const statusIcon = visit.status === 'effettuata' ? '✅' : (visit.status === 'mancata' ? '❌' : '⏳');
      const statusLabel = visit.status.toUpperCase();
      
      item.innerHTML = `
        <div class="timeline-dot status-${visit.status}"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-date">${formattedDate}</span>
            <span class="timeline-time">${visit.startTime} - ${visit.endTime}</span>
          </div>
          <div style="font-size: 12px; margin-top: 4px;">Esito: <strong>${statusIcon} ${statusLabel}</strong></div>
          ${visit.notes ? `<div class="timeline-notes">${escapeHTML(visit.notes)}</div>` : ''}
        </div>
      `;
      timeline.appendChild(item);
    });
  }
  
  openModal('history-modal');
}

// --- CRUD CLIENTI ---

function handleClientSubmit(e) {
  e.preventDefault();
  
  const input = document.getElementById('client-name-input');
  const editId = document.getElementById('edit-client-id').value;
  const clientName = input.value.trim();
  
  if (!clientName) return;
  
  const clientId = editId || `cli_${Date.now()}`;
  
  if (useFirestore && db) {
    db.collection('calendario_clients').doc(clientId).set({ name: clientName })
      .then(() => resetClientForm())
      .catch(err => console.error("Errore salvataggio cliente su Firestore:", err));
  } else {
    if (editId) {
      // AGGIORNA NOME CLIENTE
      const idx = state.clients.findIndex(c => c.id === editId);
      if (idx !== -1) {
        state.clients[idx].name = clientName;
      }
    } else {
      // CREA NUOVO CLIENTE
      state.clients.push({ id: clientId, name: clientName });
    }
    saveToLocalStorage();
    resetClientForm();
    render();
  }
}

function editClient(client) {
  document.getElementById('client-form-title').textContent = 'Modifica Cliente';
  document.getElementById('edit-client-id').value = client.id;
  document.getElementById('client-name-input').value = client.name;
  
  document.getElementById('save-client-btn').textContent = 'Salva';
  document.getElementById('cancel-client-edit-btn').classList.remove('hidden');
}

function resetClientForm() {
  document.getElementById('client-form-title').textContent = 'Aggiungi Nuovo Cliente';
  document.getElementById('edit-client-id').value = '';
  document.getElementById('client-name-input').value = '';
  
  document.getElementById('save-client-btn').textContent = 'Aggiungi';
  document.getElementById('cancel-client-edit-btn').classList.add('hidden');
}

async function deleteClient(clientId) {
  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;
  
  if (confirm(`Sei sicuro di voler eliminare il cliente "${client.name}"? Verranno rimosse TUTTE le sue visite programmate sia future che lo storico degli eventi.`)) {
    if (useFirestore && db) {
      try {
        const batch = db.batch();
        batch.delete(db.collection('calendario_clients').doc(clientId));
        
        const eventsToDelete = state.events.filter(e => e.clientId === clientId);
        eventsToDelete.forEach(evt => {
          batch.delete(db.collection('calendario_events').doc(evt.id));
          for (const key of Object.keys(state.overrides)) {
            if (key.startsWith(evt.id + '_')) {
              batch.delete(db.collection('calendario_overrides').doc(key));
            }
          }
        });
        await batch.commit();
      } catch (err) {
        console.error("Errore durante l'eliminazione del cliente su Firestore:", err);
      }
    } else {
      // Filtra clienti
      state.clients = state.clients.filter(c => c.id !== clientId);
      
      // Trova eventi da rimuovere
      const eventsToDelete = state.events.filter(e => e.clientId === clientId).map(e => e.id);
      state.events = state.events.filter(e => e.clientId !== clientId);
      
      // Rimuovi gli override correlati
      for (const key of Object.keys(state.overrides)) {
        const [eventId] = key.split('_');
        if (eventsToDelete.includes(eventId)) {
          delete state.overrides[key];
        }
      }
      saveToLocalStorage();
      render();
    }
  }
}

// --- UTILITY E AIUTI FORMATTAZIONE ---

// Ritorna la data ISO YYYY-MM-DD localizzata a mezzogiorno
function formatDateISO(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Ritorna data in formato italiano: 10/08/2026
function formatDateItalian(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  // Calcolo per allineamento a Lunedì
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// --- EXPORT / IMPORT BACKUP ---

function exportBackup() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const dlAnchorElem = document.createElement('a');
  
  const todayStr = formatDateISO(new Date()).replace(/-/g, '');
  
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `visitplanner_backup_${todayStr}.json`);
  dlAnchorElem.click();
}

function importBackup(e) {
  const fileReader = new FileReader();
  const file = e.target.files[0];
  
  if (!file) return;
  
  fileReader.onload = function(event) {
    try {
      const importedData = JSON.parse(event.target.result);
      
      // Validazione basica
      if (importedData.clients && Array.isArray(importedData.clients) &&
          importedData.events && Array.isArray(importedData.events) &&
          importedData.overrides) {
          
        state = importedData;
        saveToLocalStorage();
        alert("Dati importati con successo!");
        render();
      } else {
        alert("Formato file non valido. Assicurati che sia un backup creato da questa applicazione.");
      }
    } catch (err) {
      alert("Errore nella lettura del file JSON.");
      console.error(err);
    }
  };
  
  fileReader.readAsText(file);
  // Reset input file
  e.target.value = '';
}

// --- FUNZIONALITÀ DI STAMPA ---

function printReport(title, htmlContent) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Impossibile aprire la finestra di stampa. Verifica che il blocco pop-up sia disattivato.");
    return;
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          color: #1e293b;
          background-color: #ffffff;
          padding: 40px;
          line-height: 1.5;
        }
        .header-container {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .subtitle {
          font-size: 12px;
          color: #64748b;
          text-align: right;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 10px 12px;
          text-align: left;
          font-size: 13px;
        }
        th {
          background-color: #f1f5f9;
          font-weight: 600;
          color: #334155;
        }
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .status-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          text-align: center;
        }
        .status-pianificata { background-color: #fef3c7; color: #b45309; border: 1px solid #f59e0b; }
        .status-effettuata { background-color: #d1fae5; color: #047857; border: 1px solid #10b981; }
        .status-mancata { background-color: #fee2e2; color: #b91c1c; border: 1px solid #ef4444; }
        
        .notes-box {
          color: #475569;
          font-size: 12.5px;
          white-space: pre-wrap;
        }
        
        .day-section {
          margin-bottom: 40px;
          page-break-inside: avoid;
        }
        .day-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          background-color: #f1f5f9;
          padding: 8px 12px;
          margin-bottom: 12px;
          border-left: 4px solid #6366f1;
        }
        .no-visits {
          color: #94a3b8;
          font-size: 13px;
          font-style: italic;
          padding-left: 12px;
          margin-bottom: 20px;
        }
        
        /* Controlli di stampa */
        .print-btn-header {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 20px;
        }
        .btn-print {
          background-color: #6366f1;
          color: #ffffff;
          border: none;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .btn-print:hover {
          background-color: #4f46e5;
        }
        
        @media print {
          .print-btn-header {
            display: none !important;
          }
          body {
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-header">
        <button class="btn-print" onclick="window.print()">🖨️ Stampa o Salva PDF</button>
      </div>
      <div class="header-container">
        <h1>${title}</h1>
        <div class="subtitle">
          <div>Report VisitPlanner</div>
          <div>Stampato il ${new Date().toLocaleDateString('it-IT')} ore ${new Date().toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}</div>
        </div>
      </div>
      ${htmlContent}
    </body>
    </html>
  `);
  printWindow.document.close();
}

function handlePrintDay() {
  const dateStr = formatDateISO(selectedDate);
  const formattedDayText = `${DAYS_OF_WEEK_IT[selectedDate.getDay()]} ${formatDateItalian(dateStr)}`;
  const visits = getVisitsForPeriod(dateStr, dateStr);
  visits.sort((a, b) => a.startTime.localeCompare(b.startTime));
  
  let html = '';
  if (visits.length === 0) {
    html = '<p class="no-visits">Nessuna visita programmata per questo giorno.</p>';
  } else {
    html += `
      <table>
        <thead>
          <tr>
            <th style="width: 15%;">Orario</th>
            <th style="width: 30%;">Cliente</th>
            <th style="width: 15%;">Stato</th>
            <th>Note / Report Commerciale</th>
          </tr>
        </thead>
        <tbody>
    `;
    visits.forEach(v => {
      const statusLabel = v.status.toUpperCase();
      html += `
        <tr>
          <td><strong>${v.startTime} - ${v.endTime}</strong></td>
          <td><strong>${escapeHTML(v.clientName)}</strong></td>
          <td><span class="status-badge status-${v.status}">${statusLabel}</span></td>
          <td><div class="notes-box">${v.notes ? escapeHTML(v.notes) : '<i>- Nessuna nota inserita -</i>'}</div></td>
        </tr>
      `;
    });
    html += `
        </tbody>
      </table>
    `;
  }
  
  printReport(`Report Visite del Giorno: ${formattedDayText}`, html);
}

function handlePrintWeek() {
  const monday = getMonday(currentDate);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const mondayStr = formatDateISO(monday);
  const sundayStr = formatDateISO(sunday);
  
  const rangeText = `dopo il ${formatDateItalian(mondayStr)} al ${formatDateItalian(sundayStr)}`;
  const visits = getVisitsForPeriod(mondayStr, sundayStr);
  
  let html = '';
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayStr = formatDateISO(day);
    const dayLabel = `${DAYS_OF_WEEK_IT[day.getDay()]} ${day.getDate()} ${MONTHS_IT[day.getMonth()]} ${day.getFullYear()}`;
    
    const dayVisits = visits.filter(v => v.date === dayStr);
    dayVisits.sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    html += `<div class="day-section">`;
    html += `<div class="day-title">${dayLabel}</div>`;
    
    if (dayVisits.length === 0) {
      html += '<p class="no-visits">Nessuna visita in programma per questo giorno.</p>';
    } else {
      html += `
        <table>
          <thead>
            <tr>
              <th style="width: 15%;">Orario</th>
              <th style="width: 30%;">Cliente</th>
              <th style="width: 15%;">Stato</th>
              <th>Note / Report Commerciale</th>
            </tr>
          </thead>
          <tbody>
      `;
      dayVisits.forEach(v => {
        const statusLabel = v.status.toUpperCase();
        html += `
          <tr>
            <td><strong>${v.startTime} - ${v.endTime}</strong></td>
            <td><strong>${escapeHTML(v.clientName)}</strong></td>
            <td><span class="status-badge status-${v.status}">${statusLabel}</span></td>
            <td><div class="notes-box">${v.notes ? escapeHTML(v.notes) : '<i>-</i>'}</div></td>
          </tr>
        `;
      });
      html += `
          </tbody>
        </table>
      `;
    }
    html += `</div>`;
  }
  
  printReport(`Visite della Settimana: ${rangeText}`, html);
}

function handlePrintMonth() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthLabel = `${MONTHS_IT[month]} ${year}`;
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const startStr = formatDateISO(firstDay);
  const endStr = formatDateISO(lastDay);
  
  const visits = getVisitsForPeriod(startStr, endStr);
  
  // Ordina per data crescente, poi orario
  visits.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(a.date);
    return a.startTime.localeCompare(a.startTime);
  });
  
  let html = '';
  if (visits.length === 0) {
    html = '<p class="no-visits">Nessuna visita programmata per questo mese.</p>';
  } else {
    let currentGroupDate = '';
    
    visits.forEach(v => {
      if (v.date !== currentGroupDate) {
        if (currentGroupDate !== '') {
          html += `</tbody></table></div>`;
        }
        currentGroupDate = v.date;
        const formattedD = formatDateItalian(v.date);
        const d = new Date(v.date + 'T12:00:00');
        const dLabel = `${DAYS_OF_WEEK_IT[d.getDay()]} ${formattedD}`;
        
        html += `<div class="day-section">`;
        html += `<div class="day-title">${dLabel}</div>`;
        html += `
          <table>
            <thead>
              <tr>
                <th style="width: 15%;">Orario</th>
                <th style="width: 30%;">Cliente</th>
                <th style="width: 15%;">Stato</th>
                <th>Note / Report Commerciale</th>
              </tr>
            </thead>
            <tbody>
        `;
      }
      
      const statusLabel = v.status.toUpperCase();
      html += `
        <tr>
          <td><strong>${v.startTime} - ${v.endTime}</strong></td>
          <td><strong>${escapeHTML(v.clientName)}</strong></td>
          <td><span class="status-badge status-${v.status}">${statusLabel}</span></td>
          <td><div class="notes-box">${v.notes ? escapeHTML(v.notes) : '<i>-</i>'}</div></td>
        </tr>
      `;
    });
    
    if (currentGroupDate !== '') {
      html += `</tbody></table></div>`;
    }
  }
  
  printReport(`Visite Mensili: ${monthLabel}`, html);
}
