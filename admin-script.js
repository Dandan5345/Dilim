// admin-script.js
import { auth, db } from './firebase-init.js';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    orderBy,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

// --- הגדרות קבועות (כמו קודם, לשימוש ב-checkboxes) ---
const ALL_TRIP_TYPES = [
    "בטן גב", "נופים וטבע", "עיר אירופאית", "ארצות הברית", "מזרח רחוק", 
    "שווקי קריסמס", "סקי", "טרקים", "קרוז", "ספארי", "ירח דבש", "משפחות"
];
function getNextMonthsAvailability(numberOfMonths = 12) {
    const months = [];
    const currentDate = new Date();
    for (let i = 0; i < numberOfMonths; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const monthName = date.toLocaleString('he-IL', { month: 'long', year: 'numeric' });
        months.push({ value: `${year}-${month}`, label: `${monthName}` });
    }
    return months;
}
const AVAILABLE_MONTHS_OPTIONS = getNextMonthsAvailability(24);


document.addEventListener('DOMContentLoaded', function () {
    // --- איתחול אלמנטים כלליים ---
    const loginSection = document.getElementById('admin-login');
    const dashboardSection = document.getElementById('admin-dashboard');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const loginError = document.getElementById('login-error');
    const adminUserEmailEl = document.getElementById('admin-user-email');
    const adminDealsOutput = document.getElementById('admin-deals-output');
    const dealsCollectionRef = collection(db, 'deals'); // זה ישמש לכל סוגי ה"דילים"

    // --- איתחול אלמנטים של מודאלים וכפתורי פתיחה ---
    const packageModal = document.getElementById('package-deal-modal');
    const flightModal = document.getElementById('flight-deal-modal');
    const hotelModal = document.getElementById('hotel-deal-modal');

    const openPackageModalBtn = document.getElementById('open-package-deal-modal-btn');
    const openFlightModalBtn = document.getElementById('open-flight-deal-modal-btn');
    const openHotelModalBtn = document.getElementById('open-hotel-deal-modal-btn');
    
    const closeButtons = document.querySelectorAll('.close-modal-btn');

    // --- איתחול טפסים ו-ID inputs (לעריכה עתידית) ---
    const packageDealForm = document.getElementById('package-deal-form');
    const packageDealIdInput = document.getElementById('package-deal-id');
    const flightDealForm = document.getElementById('flight-deal-form');
    const flightDealIdInput = document.getElementById('flight-deal-id');
    const hotelDealForm = document.getElementById('hotel-deal-form');
    const hotelDealIdInput = document.getElementById('hotel-deal-id');

    // איתחול Checkboxes למודאל חבילה
    const packageTripTypesContainer = document.getElementById('package-trip-types-checkboxes');
    const packageAvailabilityMonthsContainer = document.getElementById('package-availability-months-checkboxes');
    if(packageTripTypesContainer) populateCheckboxes(packageTripTypesContainer, ALL_TRIP_TYPES, 'packageTripType');
    if(packageAvailabilityMonthsContainer) populateCheckboxes(packageAvailabilityMonthsContainer, AVAILABLE_MONTHS_OPTIONS, 'packageAvailabilityMonth');
    
    // איתחול Checkboxes למודאל מלון
    const hotelTripTypesContainer = document.getElementById('hotel-trip-types-checkboxes');
    if(hotelTripTypesContainer) populateCheckboxes(hotelTripTypesContainer, ALL_TRIP_TYPES, 'hotelTripType');

    // --- לוגיקת פתיחה/סגירה של מודאלים ---
    function openModal(modalElement) {
        if (modalElement) modalElement.style.display = 'block';
    }
    function closeModal(modalElement) {
        if (modalElement) modalElement.style.display = 'none';
    }

    if(openPackageModalBtn) openPackageModalBtn.addEventListener('click', () => { resetPackageForm(); openModal(packageModal); });
    if(openFlightModalBtn) openFlightModalBtn.addEventListener('click', () => { resetFlightForm(); openModal(flightModal); });
    if(openHotelModalBtn) openHotelModalBtn.addEventListener('click', () => { resetHotelForm(); openModal(hotelModal); });

    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const modalId = this.dataset.modalId;
            const modalToClose = document.getElementById(modalId);
            closeModal(modalToClose);
        });
    });

    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target);
        }
    });
    
    // פונקציה לאתחול Checkboxes (כמו קודם)
    function populateCheckboxes(container, options, groupName) {
        if(!container) return;
        container.innerHTML = '';
        options.forEach(option => {
            const item = typeof option === 'string' ? { value: option, label: option } : option;
            const checkboxId = `${groupName}-${item.value.replace(/\s+/g, '-')}`;
            const div = document.createElement('div');
            // div.className = 'checkbox-item'; // הוסף class אם יש צורך בעיצוב נוסף
            div.innerHTML = `
                <input type="checkbox" id="${checkboxId}" name="${groupName}" value="${item.value}">
                <label for="${checkboxId}">${item.label}</label>
            `;
            container.appendChild(div);
        });
    }

    // --- ניהול מלונות מרובים במודאל חבילה ---
    const packageHotelsContainer = document.getElementById('package-hotels-container');
    const addPackageHotelBtn = document.getElementById('add-package-hotel-btn');
    let packageHotelFieldCount = 0;

    if (addPackageHotelBtn) {
        addPackageHotelBtn.addEventListener('click', () => addHotelFieldToPackage());
    }

    function addHotelFieldToPackage(hotelData = null) {
        if (!packageHotelsContainer) return;
        packageHotelFieldCount++;
        const hotelEntryDiv = document.createElement('div');
        hotelEntryDiv.className = 'hotel-entry';
        hotelEntryDiv.dataset.hotelIndex = packageHotelFieldCount;

        hotelEntryDiv.innerHTML = `
            <h5>מלון ${packageHotelFieldCount}</h5>
            <div class="form-group">
                <label for="p-hotel-name-${packageHotelFieldCount}">שם המלון:</label>
                <input type="text" id="p-hotel-name-${packageHotelFieldCount}" value="${hotelData?.name || ''}" required>
            </div>
            <div class="form-group">
                <label for="p-hotel-stars-${packageHotelFieldCount}">כוכבים (1-5):</label>
                <select id="p-hotel-stars-${packageHotelFieldCount}">
                    <option value="">לא צוין</option>
                    <option value="1" ${hotelData?.stars == 1 ? 'selected' : ''}>⭐</option>
                    <option value="2" ${hotelData?.stars == 2 ? 'selected' : ''}>⭐⭐</option>
                    <option value="3" ${hotelData?.stars == 3 ? 'selected' : ''}>⭐⭐⭐</option>
                    <option value="4" ${hotelData?.stars == 4 ? 'selected' : ''}>⭐⭐⭐⭐</option>
                    <option value="5" ${hotelData?.stars == 5 ? 'selected' : ''}>⭐⭐⭐⭐⭐</option>
                </select>
            </div>
            <div class="form-group">
                <label for="p-hotel-booking-${packageHotelFieldCount}">קישור Booking.com:</label>
                <input type="text" id="p-hotel-booking-${packageHotelFieldCount}" value="${hotelData?.affiliateLinks?.booking || ''}">
            </div>
            <div class="form-group">
                <label for="p-hotel-agoda-${packageHotelFieldCount}">קישור Agoda:</label>
                <input type="text" id="p-hotel-agoda-${packageHotelFieldCount}" value="${hotelData?.affiliateLinks?.agoda || ''}">
            </div>
            <div class="form-group">
                <label for="p-hotel-expedia-${packageHotelFieldCount}">קישור Expedia:</label>
                <input type="text" id="p-hotel-expedia-${packageHotelFieldCount}" value="${hotelData?.affiliateLinks?.expedia || ''}">
            </div>
            <button type="button" class="remove-hotel-btn">הסר מלון זה</button>
        `;
        packageHotelsContainer.appendChild(hotelEntryDiv);

        hotelEntryDiv.querySelector('.remove-hotel-btn').addEventListener('click', function() {
            hotelEntryDiv.remove();
        });
    }
    
    // --- אימות והתחברות (כמו קודם) ---
    onAuthStateChanged(auth, user => {
        if (user) {
            loginSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            if (adminUserEmailEl) adminUserEmailEl.textContent = user.email;
            loadAdminDeals();
        } else {
            loginSection.style.display = 'block';
            dashboardSection.style.display = 'none';
            if (adminUserEmailEl) adminUserEmailEl.textContent = '';
        }
    });
    if (loginButton) { /*...*/ } // קוד התחברות קיים
    if (logoutButton) { /*...*/ } // קוד התנתקות קיים

    // --- שמירת נתונים מהמודאלים ---
    // 1. שמירת דיל חבילה
    if (packageDealForm) {
        packageDealForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dealId = packageDealIdInput.value;

            const selectedTripTypes = Array.from(packageTripTypesContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            const selectedAvailabilityMonths = Array.from(packageAvailabilityMonthsContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            
            const hotelsData = [];
            packageHotelsContainer.querySelectorAll('.hotel-entry').forEach(entry => {
                const index = entry.dataset.hotelIndex;
                hotelsData.push({
                    name: entry.querySelector(`#p-hotel-name-${index}`).value,
                    stars: entry.querySelector(`#p-hotel-stars-${index}`).value,
                    affiliateLinks: {
                        booking: entry.querySelector(`#p-hotel-booking-${index}`).value || null,
                        agoda: entry.querySelector(`#p-hotel-agoda-${index}`).value || null,
                        expedia: entry.querySelector(`#p-hotel-expedia-${index}`).value || null,
                    }
                });
            });
            
            const extraAddonsText = document.getElementById('package-extra-addons').value;

            const dealData = {
                dealType: "package", // סוג הדיל
                name: document.getElementById('package-deal-name').value,
                description: document.getElementById('package-deal-description').value,
                price_text: document.getElementById('package-price-text').value,
                exactDatesRange: {
                    start: document.getElementById('package-start-date').value,
                    end: document.getElementById('package-end-date').value,
                },
                destinationCountry: document.getElementById('package-country').value,
                destinationCity: document.getElementById('package-city').value,
                flightDetails: {
                    departureAirline: document.getElementById('package-flight-departure-airline').value,
                    departureTime: document.getElementById('package-flight-departure-time').value,
                    returnAirline: document.getElementById('package-flight-return-airline').value,
                    returnTime: document.getElementById('package-flight-return-time').value,
                    notes: document.getElementById('package-flight-notes').value,
                },
                hotels: hotelsData,
                extraAddons: extraAddonsText ? extraAddonsText.split(',').map(s => s.trim()).filter(s => s) : [],
                imageUrl: document.getElementById('package-image-url').value,
                tripTypes: selectedTripTypes,
                availabilityMonths: selectedAvailabilityMonths, // עדיין נשמור לסינון כללי
                updatedAt: serverTimestamp()
            };
            if (!dealId) dealData.createdAt = serverTimestamp();

            await saveData(dealId, dealData, packageModal, packageDealForm);
        });
    }

    // 2. שמירת טיסה שווה
    if (flightDealForm) {
        flightDealForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dealId = flightDealIdInput.value;
            const startDate = document.getElementById('flight-start-date').value;
            const endDate = document.getElementById('flight-end-date').value;
            
            // חישוב חודשי זמינות מהתאריכים המדויקים
            const availabilityMonthsFromDates = [];
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                let current = new Date(start.getFullYear(), start.getMonth(), 1);
                const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);

                while(current <= lastMonth) {
                    const year = current.getFullYear();
                    const month = (current.getMonth() + 1).toString().padStart(2, '0');
                    availabilityMonthsFromDates.push(`${year}-${month}`);
                    current.setMonth(current.getMonth() + 1);
                }
            }


            const dealData = {
                dealType: "flight",
                name: document.getElementById('flight-title').value, // הכותרת שהמשתמש מזין
                flightOrigin: document.getElementById('flight-origin').value,
                flightDestination: document.getElementById('flight-destination').value,
                exactDatesRange: { start: startDate, end: endDate },
                airline: document.getElementById('flight-airline').value,
                price_text: document.getElementById('flight-price-text').value,
                imageUrl: document.getElementById('flight-image-url').value || null,
                flightDetails: { notes: document.getElementById('flight-notes-standalone').value || null },
                availabilityMonths: availabilityMonthsFromDates, // חודשי זמינות מחושבים
                // tripTypes לא חובה לטיסה
                updatedAt: serverTimestamp()
            };
            if (!dealId) dealData.createdAt = serverTimestamp();
            
            await saveData(dealId, dealData, flightModal, flightDealForm);
        });
    }
    
    // 3. שמירת מלון שווה
    if (hotelDealForm) {
        hotelDealForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dealId = hotelDealIdInput.value;
            const startDate = document.getElementById('hotel-start-date').value;
            const endDate = document.getElementById('hotel-end-date').value;
            
            const availabilityMonthsFromDates = []; // חישוב דומה לטיסה
            if (startDate && endDate) {
                // ... (לוגיקת חישוב חודשים כמו בטיסה)
                const start = new Date(startDate);
                const end = new Date(endDate);
                let current = new Date(start.getFullYear(), start.getMonth(), 1);
                const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);
                 while(current <= lastMonth) {
                    const year = current.getFullYear();
                    const month = (current.getMonth() + 1).toString().padStart(2, '0');
                    availabilityMonthsFromDates.push(`${year}-${month}`);
                    current.setMonth(current.getMonth() + 1);
                }
            }
            
            const selectedTripTypes = Array.from(hotelTripTypesContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

            const dealData = {
                dealType: "hotel",
                name: document.getElementById('hotel-name').value,
                description: document.getElementById('hotel-description').value,
                stars: document.getElementById('hotel-stars').value,
                destinationCountry: document.getElementById('hotel-country').value,
                destinationCity: document.getElementById('hotel-city').value,
                exactDatesRange: { start: startDate, end: endDate },
                price_text: document.getElementById('hotel-price-text').value,
                singleHotelAffiliateLinks: {
                    booking: document.getElementById('hotel-affiliate-booking').value || null,
                    agoda: document.getElementById('hotel-affiliate-agoda').value || null,
                    expedia: document.getElementById('hotel-affiliate-expedia').value || null,
                },
                imageUrl: document.getElementById('hotel-image-url').value,
                tripTypes: selectedTripTypes,
                availabilityMonths: availabilityMonthsFromDates,
                updatedAt: serverTimestamp()
            };
            if (!dealId) dealData.createdAt = serverTimestamp();

            await saveData(dealId, dealData, hotelModal, hotelDealForm);
        });
    }

    // פונקציה גנרית לשמירת/עדכון נתונים
    async function saveData(dealId, data, modalToClose, formToReset) {
        const saveButton = formToReset.querySelector('button[type="submit"]');
        const originalButtonText = saveButton.textContent;
        try {
            saveButton.disabled = true;
            saveButton.textContent = 'שומר...';
            if (dealId) {
                const dealDocRef = doc(db, 'deals', dealId);
                await updateDoc(dealDocRef, data);
                alert('הפריט עודכן בהצלחה!');
            } else {
                await addDoc(dealsCollectionRef, data);
                alert('הפריט נוסף בהצלחה!');
            }
            if(formToReset.id === 'package-deal-form') resetPackageForm();
            else if(formToReset.id === 'flight-deal-form') resetFlightForm();
            else if(formToReset.id === 'hotel-deal-form') resetHotelForm();
            
            closeModal(modalToClose);
            loadAdminDeals();
        } catch (error) {
            console.error('Error saving item:', error);
            alert('שגיאה בשמירת הפריט: ' + error.message);
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = originalButtonText;
        }
    }

    // פונקציות איפוס לכל טופס
    function resetPackageForm() {
        if(packageDealForm) packageDealForm.reset();
        if(packageDealIdInput) packageDealIdInput.value = '';
        if(packageHotelsContainer) packageHotelsContainer.innerHTML = '';
        packageHotelFieldCount = 0;
        if(packageTripTypesContainer) packageTripTypesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        if(packageAvailabilityMonthsContainer) packageAvailabilityMonthsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        // אם יש כותרת למודאל שמשתנה בין הוספה לעריכה, לאפס גם אותה
        const titleEl = packageModal?.querySelector('h3');
        if(titleEl) titleEl.textContent = 'יצירת דיל חדש (חבילה)';
    }
    function resetFlightForm() {
        if(flightDealForm) flightDealForm.reset();
        if(flightDealIdInput) flightDealIdInput.value = '';
        const titleEl = flightModal?.querySelector('h3');
        if(titleEl) titleEl.textContent = 'הוספת טיסה שווה';
    }
    function resetHotelForm() {
        if(hotelDealForm) hotelDealForm.reset();
        if(hotelDealIdInput) hotelDealIdInput.value = '';
        if(hotelTripTypesContainer) hotelTripTypesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        const titleEl = hotelModal?.querySelector('h3');
        if(titleEl) titleEl.textContent = 'הוספת מלון שווה';
    }


    // --- טעינת דילים קיימים להצגה בניהול (כמו קודם, עם התאמות קלות לתצוגה) ---
    async function loadAdminDeals() {
        if (!adminDealsOutput) return;
        adminDealsOutput.innerHTML = '<p>טוען פריטים...</p>';
        try {
            const q = query(dealsCollectionRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                adminDealsOutput.innerHTML = '<p>אין פריטים להצגה. הוסף פריט חדש!</p>';
                return;
            }
            let html = '<ul>';
            querySnapshot.forEach((docSnapshot) => {
                const item = docSnapshot.data();
                const id = docSnapshot.id;
                let itemTypeDisplay = getItemTypeDisplay(item.dealType);
                let datesDisplay = '';
                if (item.exactDatesRange?.start && item.exactDatesRange?.end) {
                    datesDisplay = ` | ${new Date(item.exactDatesRange.start).toLocaleDateString('he-IL')} - ${new Date(item.exactDatesRange.end).toLocaleDateString('he-IL')}`;
                }

                html += `
                    <li>
                        <div>
                            <strong>${item.name}</strong> <br>
                            <small>סוג: ${itemTypeDisplay} ${datesDisplay} | מחיר: ${item.price_text || 'לא צוין'}</small><br>
                            ${item.dealType === 'package' ? `<small>יעד: ${item.destinationCity || ''}, ${item.destinationCountry || ''}</small><br>` : ''}
                            ${item.dealType === 'flight' ? `<small>קו: ${item.flightOrigin || ''} ←→ ${item.flightDestination || ''}</small><br>` : ''}
                            ${item.dealType === 'hotel' ? `<small>מיקום: ${item.destinationCity || ''}, ${item.destinationCountry || ''}</small><br>` : ''}
                            <small>נוצר: ${item.createdAt?.toDate().toLocaleString('he-IL') || 'לא זמין'}</small>
                        </div>
                        <div>
                            <button data-id="${id}" data-type="${item.dealType}" class="edit-item button-secondary" style="padding:5px 10px; font-size:0.8em;">ערוך</button>
                            <button data-id="${id}" class="delete-item" style="background-color:#dc3545; padding:5px 10px; font-size:0.8em;">מחק</button>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            adminDealsOutput.innerHTML = html;

            document.querySelectorAll('.edit-item').forEach(button => {
                button.addEventListener('click', handleEditItem);
            });
            document.querySelectorAll('.delete-item').forEach(button => {
                button.addEventListener('click', handleDeleteItem);
            });

        } catch (error) {
            console.error('Error loading admin items:', error);
            adminDealsOutput.innerHTML = '<p>שגיאה בטעינת הפריטים.</p>';
        }
    }
    
    function getItemTypeDisplay(dealTypeKey) {
        if (dealTypeKey === 'flight') return 'טיסה';
        if (dealTypeKey === 'hotel') return 'מלון';
        if (dealTypeKey === 'package') return 'חבילה';
        return dealTypeKey || 'לא צוין';
    }

    // --- פונקציית עריכה (מורכבת יותר עכשיו) ---
    async function handleEditItem(e) {
        const id = e.target.dataset.id;
        const type = e.target.dataset.type; // סוג הפריט שרוצים לערוך

        try {
            const itemDocRef = doc(db, 'deals', id); // כל הפריטים נשמרים באותה קולקציה
            const docSnap = await getDoc(itemDocRef);

            if (docSnap.exists()) {
                const itemData = docSnap.data();
                let targetModal, formIdPrefix, idInput, titleEl;

                if (type === 'package') {
                    targetModal = packageModal;
                    formIdPrefix = 'package-';
                    idInput = packageDealIdInput;
                    titleEl = packageModal.querySelector('h3');
                    if(titleEl) titleEl.textContent = 'עריכת דיל חבילה';
                    
                    resetPackageForm(); // איפוס לפני מילוי
                    document.getElementById(`${formIdPrefix}deal-name`).value = itemData.name || '';
                    document.getElementById(`${formIdPrefix}deal-description`).value = itemData.description || '';
                    document.getElementById(`${formIdPrefix}price-text`).value = itemData.price_text || '';
                    document.getElementById(`${formIdPrefix}start-date`).value = itemData.exactDatesRange?.start || '';
                    document.getElementById(`${formIdPrefix}end-date`).value = itemData.exactDatesRange?.end || '';
                    document.getElementById(`${formIdPrefix}country`).value = itemData.destinationCountry || '';
                    document.getElementById(`${formIdPrefix}city`).value = itemData.destinationCity || '';
                    
                    document.getElementById(`${formIdPrefix}flight-departure-airline`).value = itemData.flightDetails?.departureAirline || '';
                    document.getElementById(`${formIdPrefix}flight-departure-time`).value = itemData.flightDetails?.departureTime || '';
                    document.getElementById(`${formIdPrefix}flight-return-airline`).value = itemData.flightDetails?.returnAirline || '';
                    document.getElementById(`${formIdPrefix}flight-return-time`).value = itemData.flightDetails?.returnTime || '';
                    document.getElementById(`${formIdPrefix}flight-notes`).value = itemData.flightDetails?.notes || '';

                    if(packageHotelsContainer) packageHotelsContainer.innerHTML = ''; // נקה מלונות קיימים
                    packageHotelFieldCount = 0;
                    if (itemData.hotels && Array.isArray(itemData.hotels)) {
                        itemData.hotels.forEach(hotel => addHotelFieldToPackage(hotel));
                    }

                    document.getElementById(`${formIdPrefix}extra-addons`).value = (itemData.extraAddons || []).join(', ');
                    document.getElementById(`${formIdPrefix}image-url`).value = itemData.imageUrl || '';

                    if(packageTripTypesContainer && itemData.tripTypes) itemData.tripTypes.forEach(val => { const cb = packageTripTypesContainer.querySelector(`input[value="${val}"]`); if(cb) cb.checked = true; });
                    if(packageAvailabilityMonthsContainer && itemData.availabilityMonths) itemData.availabilityMonths.forEach(val => { const cb = packageAvailabilityMonthsContainer.querySelector(`input[value="${val}"]`); if(cb) cb.checked = true; });


                } else if (type === 'flight') {
                    targetModal = flightModal;
                    formIdPrefix = 'flight-';
                    idInput = flightDealIdInput;
                    titleEl = flightModal.querySelector('h3');
                    if(titleEl) titleEl.textContent = 'עריכת טיסה';

                    resetFlightForm();
                    document.getElementById(`${formIdPrefix}title`).value = itemData.name || ''; // 'name' הוא הכותרת של הטיסה
                    document.getElementById(`${formIdPrefix}origin`).value = itemData.flightOrigin || '';
                    document.getElementById(`${formIdPrefix}destination`).value = itemData.flightDestination || '';
                    document.getElementById(`${formIdPrefix}start-date`).value = itemData.exactDatesRange?.start || '';
                    document.getElementById(`${formIdPrefix}end-date`).value = itemData.exactDatesRange?.end || '';
                    document.getElementById(`${formIdPrefix}airline`).value = itemData.airline || '';
                    document.getElementById(`${formIdPrefix}price-text`).value = itemData.price_text || '';
                    document.getElementById(`${formIdPrefix}image-url`).value = itemData.imageUrl || '';
                    document.getElementById(`${formIdPrefix}notes-standalone`).value = itemData.flightDetails?.notes || '';


                } else if (type === 'hotel') {
                    targetModal = hotelModal;
                    formIdPrefix = 'hotel-';
                    idInput = hotelDealIdInput;
                    titleEl = hotelModal.querySelector('h3');
                    if(titleEl) titleEl.textContent = 'עריכת מלון';

                    resetHotelForm();
                    document.getElementById(`${formIdPrefix}name`).value = itemData.name || '';
                    document.getElementById(`${formIdPrefix}description`).value = itemData.description || '';
                    document.getElementById(`${formIdPrefix}stars`).value = itemData.stars || '';
                    document.getElementById(`${formIdPrefix}country`).value = itemData.destinationCountry || '';
                    document.getElementById(`${formIdPrefix}city`).value = itemData.destinationCity || '';
                    document.getElementById(`${formIdPrefix}start-date`).value = itemData.exactDatesRange?.start || '';
                    document.getElementById(`${formIdPrefix}end-date`).value = itemData.exactDatesRange?.end || '';
                    document.getElementById(`${formIdPrefix}price-text`).value = itemData.price_text || '';
                    document.getElementById(`${formIdPrefix}affiliate-booking`).value = itemData.singleHotelAffiliateLinks?.booking || '';
                    document.getElementById(`${formIdPrefix}affiliate-agoda`).value = itemData.singleHotelAffiliateLinks?.agoda || '';
                    document.getElementById(`${formIdPrefix}affiliate-expedia`).value = itemData.singleHotelAffiliateLinks?.expedia || '';
                    document.getElementById(`${formIdPrefix}image-url`).value = itemData.imageUrl || '';

                    if(hotelTripTypesContainer && itemData.tripTypes) itemData.tripTypes.forEach(val => { const cb = hotelTripTypesContainer.querySelector(`input[value="${val}"]`); if(cb) cb.checked = true; });
                }

                if (idInput) idInput.value = id; // שמור את ה-ID ב-input הנסתר
                if (targetModal) openModal(targetModal);

            } else {
                alert("לא נמצא פריט לעריכה.");
            }
        } catch (error) {
            console.error("Error fetching item for edit:", error);
            alert("שגיאה בטעינת הפריט לעריכה.");
        }
    }

    // --- פונקציית מחיקה (כמו קודם, רק השם השתנה ל-handleDeleteItem) ---
    async function handleDeleteItem(e) {
        const id = e.target.dataset.id;
        if (confirm('האם אתה בטוח שברצונך למחוק פריט זה? הפעולה אינה הפיכה.')) {
            try {
                const itemDocRef = doc(db, 'deals', id); // כל הפריטים באותה קולקציה
                await deleteDoc(itemDocRef);
                alert('הפריט נמחק בהצלחה!');
                loadAdminDeals();
            } catch (error) {
                console.error('Error deleting item:', error);
                alert('שגיאה במחיקת הפריט.');
            }
        }
    }
    
    // טעינת דילים ראשונית אם המשתמש כבר מחובר
    if (auth.currentUser) {
        loadAdminDeals();
    }
}); // סוף DOMContentLoaded

