// js/calendar.js

let db, appState, openModal, selectedDateKey;
let eventToDelete = null; // Variable to store which event to delete before confirmation

// Helper function to parse UK-style dates that might be entered in the AI plan
export function parseUkDate(str) {
    if (!str || str.trim() === '') return null;
    const dateRegex = /^\s*(\d{1,2})[\s\/-](\d{1,2}|[a-zA-Z]{3})[\s\/-](\d{2}|\d{4})\s*$/;
    const match = str.trim().match(dateRegex);
    if (!match) return null;
    let [, day, month, year] = match;
    day = parseInt(day, 10);
    year = parseInt(year, 10);
    if (year < 100) { year += 2000; }
    if (isNaN(month)) {
        const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        month = monthMap[month.toLowerCase()];
        if (month === undefined) return null;
    } else {
        month = parseInt(month, 10) - 1;
    }
    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
        return date;
    }
    return null;
}

function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
        if (!calendarGrid) return;
        calendarGrid.innerHTML = '';
        const date = appState.calendar.currentDate;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const month = date.getMonth();
        const year = date.getFullYear();

        document.getElementById('calendar-month-year').textContent = date.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

        const firstDayOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // 0 = Monday

        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.classList.add('calendar-day-header');
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });

        for (let i = 0; i < startDayOfWeek; i++) {
            calendarGrid.appendChild(document.createElement('div'));
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dayCell = document.createElement('div');
            dayCell.classList.add('calendar-day');
            dayCell.style.position = 'relative'; 
            
            const currentDayDate = new Date(year, month, i);
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            dayCell.dataset.dateKey = dateKey;

            if (currentDayDate.getTime() === today.getTime()) {
                dayCell.classList.add('current-day');
            }
            if (dateKey === selectedDateKey) {
                dayCell.classList.add('selected');
            }

            const dayNumber = document.createElement('div');
            dayNumber.classList.add('calendar-day-number');
            dayNumber.textContent = i;
            dayCell.appendChild(dayNumber);
            
            const allDayEvents = appState.calendar.data[dateKey] || [];
            
            if (Array.isArray(allDayEvents) && allDayEvents.length > 0) {
                // Set Day Density for Heat Map
                if (allDayEvents.length >= 8) dayCell.classList.add('day-density-4');
                else if (allDayEvents.length >= 6) dayCell.classList.add('day-density-3');
                else if (allDayEvents.length >= 4) dayCell.classList.add('day-density-2');
                else if (allDayEvents.length >= 1) dayCell.classList.add('day-density-1');

                // --- NEW UNLIMITED DOT RENDERING LOGIC ---

                // 1. Render birthday indicator separately
                const hasBirthday = allDayEvents.some(e => e.type === 'birthday');
                if (hasBirthday) {
                    const indicator = document.createElement('div');
                    indicator.className = 'birthday-indicator';
                    indicator.innerHTML = '<i class="bi bi-cake2"></i>';
                    dayCell.appendChild(indicator);
                }

                // 2. Render dots for ALL other events
                const otherEvents = allDayEvents.filter(e => e.type !== 'birthday');
                if (otherEvents.length > 0) {
                    const eventsContainer = document.createElement('div');
                    eventsContainer.classList.add('event-dots-container');
                    
                    otherEvents.forEach(event => {
                        const dot = document.createElement('div');
                        dot.className = `event-dot ${event.type}`;
                        eventsContainer.appendChild(dot);
                    });
                    dayCell.appendChild(eventsContainer);
                }
                // --- END of New Logic ---
            }
            calendarGrid.appendChild(dayCell);
        }
    }


async function loadCalendarData() {
    if (!appState.currentUser || !appState.currentPlanId) return;
        const calendarRef = db.collection('users').doc(appState.currentUser.uid).collection('calendar').doc(appState.currentPlanId);
        try {
            const doc = await calendarRef.get();
            appState.calendar.data = doc.exists ? doc.data() : {};
        } catch (error) {
            console.error("Error loading calendar data:", error);
            appState.calendar.data = {};
        }
    }


function renderDayDetails(dateKey) {
    document.getElementById('add-event-btn').classList.remove('hidden');
        document.getElementById('day-detail-title').classList.remove('hidden');
        selectedDateKey = dateKey;

        document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
        const selectedDayCell = document.querySelector(`.calendar-day[data-date-key="${dateKey}"]`);
        if (selectedDayCell) selectedDayCell.classList.add('selected');

        const [year, month, day] = dateKey.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const formattedDate = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        
        document.getElementById('day-detail-title').textContent = formattedDate;
        document.getElementById('add-event-form').classList.add('hidden');

        const eventList = document.getElementById('day-event-list');
        eventList.classList.remove('hidden');
        eventList.innerHTML = '';
        const dayEvents = appState.calendar.data[dateKey] || [];

        if (dayEvents.length > 0) {
            dayEvents.sort((a,b) => {
                if (a.allDay && !b.allDay) return -1;
                if (!a.allDay && b.allDay) return 1;
                return (a.timeFrom || '').localeCompare(b.timeFrom || '');
            });
            dayEvents.forEach((event, index) => {
                const eventItem = document.createElement('div');
                eventItem.classList.add('event-item');
                eventItem.dataset.index = index;
                
                let timeHTML = '';
                if (event.allDay) {
                    timeHTML = `<p class="event-item-time font-semibold">All Day</p>`;
                } else if (event.timeFrom) {
                    let timeString = event.timeFrom;
                    if (event.timeTo) {
                        timeString += ` - ${event.timeTo}`;
                    }
                    timeHTML = `<p class="event-item-time">${timeString}</p>`;
                }
                
                const descriptionHTML = event.description ? `<p class="event-item-description">${event.description.replace(/\n/g, '<br>')}</p>` : '';

                eventItem.innerHTML = `
                    <div class="event-item-header">
                        <div>
                            <h5 class="event-item-title">${event.title}</h5>
                            ${timeHTML}
                        </div>
                        <div class="flex items-center gap-2">
                             <span class="event-type-badge ${event.type}">${event.type}</span>
                             <button class="btn-remove-row btn-remove-event" data-index="${index}" title="Delete event"><i class="bi bi-x-lg"></i></button>
                        </div>
                    </div>
                    ${descriptionHTML}
                `;
                eventList.appendChild(eventItem);
            });
        } else {
            eventList.innerHTML = '<p class="text-gray-500 text-center py-4">No events scheduled for this day.</p>';
        }
        
        
        document.getElementById('add-event-form').classList.add('hidden');
    }

function showEditEventForm(index) {
    appState.calendar.editingEventIndex = index;
    const event = appState.calendar.data[selectedDateKey][index];

    // Hide the event list and "Add Event" button, then show the form
    document.getElementById('day-event-list').classList.add('hidden');
    document.getElementById('add-event-form').classList.remove('hidden');
    document.getElementById('add-event-btn').classList.add('hidden');
    
    // Update form titles and buttons for editing mode
    document.getElementById('add-event-form-title').textContent = 'Edit Event';
    document.getElementById('save-event-btn').textContent = 'Update Event';

    // Populate the form fields with the event data
    document.getElementById('event-title-input').value = event.title;
    const allDayCheckbox = document.getElementById('event-all-day-toggle');
    allDayCheckbox.checked = event.allDay || false;
    document.getElementById('event-time-inputs-container').classList.toggle('hidden', allDayCheckbox.checked);
    document.getElementById('event-time-from-input').value = event.timeFrom || '';
    document.getElementById('event-time-to-input').value = event.timeTo || '';
    document.getElementById('event-description-input').value = event.description || '';

    // --- Logic to correctly set the category dropdown ---
    const searchInput = document.getElementById('category-search-input');
    const hiddenInput = document.getElementById('event-type-input');
    const iconContainer = document.getElementById('category-selected-icon-container');
    const optionsContainer = document.querySelector('#category-dropdown .dropdown-options');

    // Clear previous state
    iconContainer.innerHTML = '<span id="category-selected-dot" class="selected-dot"></span>';
    iconContainer.className = 'selected-icon-container';

    if (event.type) {
        const optionToSelect = optionsContainer.querySelector(`.dropdown-option[data-type="${event.type}"]`);
        if (optionToSelect) {
            const iconElement = optionToSelect.querySelector('.option-icon, .option-dot');
            iconContainer.innerHTML = iconElement.outerHTML;
            iconContainer.classList.add(event.type);
            iconContainer.classList.toggle('has-icon', iconElement.classList.contains('option-icon'));
            searchInput.value = optionToSelect.textContent.trim();
            hiddenInput.value = event.type;
        } else {
            searchInput.value = '';
            hiddenInput.value = '';
        }
    } else {
        searchInput.value = '';
        hiddenInput.value = '';
    }
}

async function confirmEventDeletion() {
    if (!eventToDelete) return;

    const { dateKey, index } = eventToDelete;
    const dayEvents = appState.calendar.data[dateKey] || [];
    
    dayEvents.splice(index, 1);

    const calendarRef = db.collection('users').doc(appState.currentUser.uid).collection('calendar').doc(appState.currentPlanId);
    const dataToUpdate = {};
    dataToUpdate[dateKey] = dayEvents.length > 0 ? dayEvents : firebase.firestore.FieldValue.delete();

    try {
        await calendarRef.set(dataToUpdate, { merge: true });
        // Manually update local state to ensure UI refreshes correctly
        if (dayEvents.length > 0) {
            appState.calendar.data[dateKey] = dayEvents;
        } else {
            delete appState.calendar.data[dateKey];
        }
        renderCalendar();
        renderDayDetails(dateKey);
    } catch (error) {
        console.error("Error removing event:", error);
        alert("Could not remove the event. Please try again.");
    } finally {
        eventToDelete = null; // Reset after the operation
    }
}

function setupCalendarEventListeners() {
    const calendarModal = document.getElementById('calendar-modal');
    const calendarCloseBtn = document.getElementById('calendar-close-btn');
    const calendarPrevMonthBtn = document.getElementById('calendar-prev-month-btn');
    const calendarNextMonthBtn = document.getElementById('calendar-next-month-btn');
    const calendarTodayBtn = document.getElementById('calendar-today-btn');
    const calendarGrid = document.getElementById('calendar-grid');
    const addEventBtn = document.getElementById('add-event-btn');
    const cancelEventBtn = document.getElementById('cancel-event-btn');
    const saveEventBtn = document.getElementById('save-event-btn');
    const allDayCheckbox = document.getElementById('event-all-day-toggle');
    const timeInputsContainer = document.getElementById('event-time-inputs-container');
    const dayEventList = document.getElementById('day-event-list');

    const categoryDropdown = document.getElementById('category-dropdown');
    const searchInput = document.getElementById('category-search-input');

    if (!calendarModal || !allDayCheckbox || !categoryDropdown) {
        console.warn("Calendar UI elements not found. Skipping event listener setup.");
        return;
    }

    allDayCheckbox.addEventListener('change', () => {
        if (timeInputsContainer) {
            timeInputsContainer.classList.toggle('hidden', allDayCheckbox.checked);
        }
    });

    if (categoryDropdown && searchInput) {
        const selectedDisplay = categoryDropdown.querySelector('.dropdown-selected');
        const optionsContainer = categoryDropdown.querySelector('.dropdown-options');
        const hiddenInput = document.getElementById('event-type-input');

        const filterOptions = () => {
            const highlighted = optionsContainer.querySelector('.is-highlighted');
            if (highlighted) {
                highlighted.classList.remove('is-highlighted');
            }
            const searchTerm = searchInput.value.toLowerCase();
            const options = optionsContainer.querySelectorAll('.dropdown-option:not(.no-results)');
            let visibleCount = 0;

            options.forEach(option => {
                const text = option.textContent.trim().toLowerCase();
                if (text.includes(searchTerm)) {
                    option.style.display = 'flex';
                    visibleCount++;
                } else {
                    option.style.display = 'none';
                }
            });

            let noResultsMsg = optionsContainer.querySelector('.no-results');
            if (visibleCount === 0) {
                if (!noResultsMsg) {
                    noResultsMsg = document.createElement('div');
                    noResultsMsg.className = 'dropdown-option no-results';
                    noResultsMsg.textContent = 'No results found';
                    optionsContainer.appendChild(noResultsMsg);
                }
                noResultsMsg.style.display = 'flex';
            } else if (noResultsMsg) {
                noResultsMsg.style.display = 'none';
            }
        };

        const selectOption = (option) => {
            const type = option.dataset.type;
            const iconContainer = document.getElementById('category-selected-icon-container');
            const iconElement = option.querySelector('.option-icon, .option-dot');

            iconContainer.innerHTML = iconElement.outerHTML;
            iconContainer.className = `selected-icon-container ${type}`;
            iconContainer.classList.toggle('has-icon', iconElement.classList.contains('option-icon'));

            searchInput.value = option.textContent.trim();
            hiddenInput.value = type;
            categoryDropdown.classList.remove('open');
        };

        searchInput.addEventListener('focus', () => {
            categoryDropdown.classList.add('open');
            searchInput.select();
            filterOptions();
        });

        searchInput.addEventListener('input', filterOptions);

        searchInput.addEventListener('keydown', (e) => {
            if (!categoryDropdown.classList.contains('open')) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    categoryDropdown.classList.add('open');
                }
                return;
            }

            const options = Array.from(optionsContainer.querySelectorAll('.dropdown-option:not(.no-results)'))
                                 .filter(opt => opt.style.display !== 'none');
            if (options.length === 0) return;

            let currentIndex = options.findIndex(opt => opt.classList.contains('is-highlighted'));

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (currentIndex >= 0) {
                        options[currentIndex].classList.remove('is-highlighted');
                    }
                    const nextIndex = (currentIndex + 1) % options.length;
                    options[nextIndex].classList.add('is-highlighted');
                    options[nextIndex].scrollIntoView({ block: 'nearest' });
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    if (currentIndex >= 0) {
                        options[currentIndex].classList.remove('is-highlighted');
                    }
                    const prevIndex = (currentIndex - 1 + options.length) % options.length;
                    options[prevIndex].classList.add('is-highlighted');
                    options[prevIndex].scrollIntoView({ block: 'nearest' });
                    break;

                case 'Enter':
                    e.preventDefault();
                    if (currentIndex >= 0) {
                        selectOption(options[currentIndex]);
                    }
                    break;

                case 'Escape':
                    categoryDropdown.classList.remove('open');
                    break;
            }
        });

        selectedDisplay.addEventListener('click', (e) => {
            if (e.target !== searchInput) {
                searchInput.focus();
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!categoryDropdown.contains(e.target)) {
                categoryDropdown.classList.remove('open');
                const currentVal = searchInput.value;
                const hiddenVal = hiddenInput.value;
                if(hiddenVal && currentVal.toLowerCase() !== hiddenVal.toLowerCase()) {
                    const validOption = optionsContainer.querySelector(`.dropdown-option[data-type="${hiddenVal}"]`);
                    if(validOption) searchInput.value = validOption.textContent.trim();
                } else if (!hiddenVal) {
                    searchInput.value = '';
                }
            }
        });

        optionsContainer.addEventListener('click', (e) => {
            const option = e.target.closest('.dropdown-option:not(.no-results)');
            if (option) {
                selectOption(option);
            }
        });
    }

    if (calendarCloseBtn) calendarCloseBtn.addEventListener('click', () => calendarModal.classList.add('hidden'));
    
    if (calendarPrevMonthBtn) calendarPrevMonthBtn.addEventListener('click', () => {
        appState.calendar.currentDate.setDate(1);
        appState.calendar.currentDate.setMonth(appState.calendar.currentDate.getMonth() - 1);
        renderCalendar();
    });

    if (calendarNextMonthBtn) calendarNextMonthBtn.addEventListener('click', () => {
        appState.calendar.currentDate.setDate(1);
        appState.calendar.currentDate.setMonth(appState.calendar.currentDate.getMonth() + 1);
        renderCalendar();
    });

    if (calendarTodayBtn) calendarTodayBtn.addEventListener('click', () => {
        const today = new Date();
        appState.calendar.currentDate = today;
        const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        renderCalendar();
        renderDayDetails(dateKey);
    });

    if (calendarGrid) calendarGrid.addEventListener('click', (e) => {
        const dayCell = e.target.closest('.calendar-day');
        if (dayCell && dayCell.dataset.dateKey) {
            renderDayDetails(dayCell.dataset.dateKey);
        }
    });
    
    if (dayEventList) dayEventList.addEventListener('click', async (e) => {
        const removeBtn = e.target.closest('.btn-remove-event');
        const eventItem = e.target.closest('.event-item');

        if (removeBtn) {
            e.stopPropagation();
            const indexToRemove = parseInt(removeBtn.dataset.index, 10);
            const eventTitle = eventItem.querySelector('.event-item-title').textContent;
            
            // Store the event info and open the custom modal
            eventToDelete = { dateKey: selectedDateKey, index: indexToRemove };
            openModal('confirmDeleteEvent', { eventTitle });
            
        } else if (eventItem) {
            const index = parseInt(eventItem.dataset.index, 10);
            showEditEventForm(index);
        }
    });

    if (addEventBtn) addEventBtn.addEventListener('click', () => {
        appState.calendar.editingEventIndex = null;
        if (dayEventList) dayEventList.classList.add('hidden');
        const form = document.getElementById('add-event-form');
        if (form) form.classList.remove('hidden');
        addEventBtn.classList.add('hidden');
        document.getElementById('event-title-input').value = '';
        document.getElementById('event-all-day-toggle').checked = false;
        document.getElementById('event-time-inputs-container').classList.remove('hidden');
        document.getElementById('event-time-from-input').value = '';
        document.getElementById('event-time-to-input').value = '';
        document.getElementById('event-description-input').value = '';

        if (categoryDropdown) {
            const iconContainer = document.getElementById('category-selected-icon-container');
            iconContainer.innerHTML = '<span id="category-selected-dot" class="selected-dot"></span>';
            iconContainer.className = 'selected-icon-container';
            document.getElementById('category-search-input').value = '';
            document.getElementById('event-type-input').value = '';
        }

        document.getElementById('add-event-form-title').textContent = 'Add New Event';
        document.getElementById('save-event-btn').textContent = 'Save Event';
    });

    if (cancelEventBtn) cancelEventBtn.addEventListener('click', () => {
        appState.calendar.editingEventIndex = null;
        const form = document.getElementById('add-event-form');
        if (form) form.classList.add('hidden');

        if (dayEventList) dayEventList.classList.remove('hidden');
        document.getElementById('add-event-btn').classList.remove('hidden');
        document.getElementById('day-detail-title').classList.remove('hidden');
    });

    if (saveEventBtn) saveEventBtn.addEventListener('click', async () => {
        const title = document.getElementById('event-title-input').value.trim();
        const eventType = document.getElementById('event-type-input').value;
        if (!title || !eventType) {
            alert('Please provide a title and select an event type.');
            return;
        }

        const isAllDay = allDayCheckbox.checked;
        const eventData = {
            title: title,
            allDay: isAllDay,
            timeFrom: isAllDay ? '' : document.getElementById('event-time-from-input').value,
            timeTo: isAllDay ? '' : document.getElementById('event-time-to-input').value,
            type: eventType,
            description: document.getElementById('event-description-input').value.trim(),
        };

        const dayEvents = appState.calendar.data[selectedDateKey] || [];
        
        if (appState.calendar.editingEventIndex !== null) {
            dayEvents[appState.calendar.editingEventIndex] = eventData;
        } else {
            dayEvents.push(eventData);
        }

        const calendarRef = db.collection('users').doc(appState.currentUser.uid).collection('calendar').doc(appState.currentPlanId);
        const dataToUpdate = {};
        dataToUpdate[selectedDateKey] = dayEvents;

        try {
            await calendarRef.set(dataToUpdate, { merge: true });
            
            // FIX: Manually update the local state to ensure the UI refreshes correctly.
            appState.calendar.data[selectedDateKey] = dayEvents;

            appState.calendar.editingEventIndex = null;
            renderCalendar();
            renderDayDetails(selectedDateKey);
            document.getElementById('add-event-btn').classList.remove('hidden');
            document.getElementById('day-detail-title').classList.remove('hidden');
        } catch (error) {
            console.error("Error saving event:", error);
            alert("Could not save the event. Please try again.");
        }
    });
}


// This is the main function we'll export. It kicks everything off.
export function initializeCalendar(database, state, modalOpener) {
    db = database;
    appState = state; // We get the app's state from main.js
    openModal = modalOpener;

    // Set up the radial menu button to open the calendar
    const calendarButton = document.getElementById('radial-action-calendar');
    if (calendarButton) {
        calendarButton.addEventListener('click', () => {
            appState.calendar.currentDate = new Date();
            const today = new Date();
            selectedDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            
            // We need to load the latest data before rendering
            loadCalendarData().then(() => {
                renderCalendar();
                renderDayDetails(selectedDateKey);
                document.getElementById('calendar-modal').classList.remove('hidden');
                document.getElementById('radial-menu-container').classList.remove('open');
            });
        });
    }

    // Listen for the confirmation event from the modal
    document.addEventListener('event-deletion-confirmed', confirmEventDeletion);

    // This sets up all the other buttons (next month, save event, etc.)
    setupCalendarEventListeners();
}
