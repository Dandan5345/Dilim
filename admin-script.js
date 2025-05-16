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

// --- הגדרות קבועות ---
const ALL_TRIP_TYPES = [
    "בטן גב", "נופים וטבע", "עיר אירופאית", "ארצות הברית", "מזרח רחוק", 
    "שווקי קריסמס", "סקי", "טרקים", "קרוז", "ספארי", "ירח דבש", "משפחות"
];
// פונקציית getNextMonthsAvailability ו- AVAILABLE_MONTHS_OPTIONS הוסרו מכאן כי לא משתמשים בהן יותר בטפסים.

document.addEventListener('DOMContentLoaded', function () {
    // --- איתחול אלמנטים כלליים ---
    const loginSection = document.getElementById('admin-login');
    const dashboardSection = document.getElementById('admin-dashboard');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const loginError = document.getElementById('login-error');
    const adminUserEmailEl = document.getElementById('admin-user-email');
    const adminDealsOutput = document.getElementById('admin-deals-output');
    const dealsCollectionRef = collection(db, 'deals');

    // --- איתחול אלמנטים של מודאלים וכפתורי פתיחה ---
    const packageModal = document.getElementById('package-deal-modal');
    const flightModal = document.getElementById('flight-deal-modal');
    const hotelModal = document.getElementById('hotel-deal-modal');

    const openPackageModalBtn = document.getElementById('open-package-deal-modal-btn');
    const openFlightModalBtn = document.getElementById('open-flight-deal-modal-btn');
    const openHotelModalBtn = document.getElementById('open-hotel-deal-modal-btn');
    
    const closeButtons = document.querySelectorAll('.close-modal-btn');

    // --- איתחול טפסים ו-ID inputs ---
    const packageDealForm = document.getElementById('package-deal-form');
    const packageDealIdInput = document.getElementById('package-deal-id');
    const flightDealForm = document.getElementById('flight-deal-form');
    const flightDealIdInput = document.getElementById('flight-deal-id');
    const hotelDealForm = document.getElementById('hotel-deal-form');
    const hotelDealIdInput = document.getElementById('hotel-deal-id');

    // איתחול Checkboxes לסוגי טיול במודאלים הרלוונטיים
    const packageTripTypesContainer = document.getElementById('package-trip-types-checkboxes');
    const hotelTripTypesContainer = document.getElementById('hotel-trip-types-checkboxes');
    
    if(packageTripTypesContainer) populateCheckboxes(packageTripTypesContainer, ALL_TRIP_TYPES, 'packageTripType');
    if(hotelTripTypesContainer) populateCheckboxes(hotelTripTypesContainer, ALL_TRIP_TYPES, 'hotelTripType');
    
    // --- לוגיקת פתיחה/סגירה של מודאלים עם אנימציה ---
    function openModal(modalElement) {
        if (modalElement) {
            document.body.style.overflow = 'hidden';
            modalElement.style.display = 'flex'; 
            setTimeout(() => { 
                modalElement.classList.add('active');
            }, 10);
        }
    }
    function closeModal(modalElement) {
        if (modalElement) {
            modalElement.classList.remove('active');
            document.body.style.overflow = ''; 
            setTimeout(() => {
                 if (!modalElement.classList.contains('active')) {
                    modalElement.style.display = 'none';
                }
            }, 350); // זמן אנימציית ה-transition ב-CSS
        }
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
        if (event.target.classList.contains('modal') && event.target.classList.contains('active')) { // סגור רק אם המודאל פעיל
            closeModal(event.target);
        }
    });
    
    function populateCheckboxes(container, options, groupName) {
        if(!container) return;
        container.innerHTML = '';
        options.forEach(option => {
            const item = typeof option === 'string' ? { value: option, label: option } : option;
            const checkboxId = `${groupName}-${item.value.replace(/\s+/g, '-')}`;
            const div = document.createElement('div');
            div.innerHTML = `
                <input type="checkbox" id="${checkboxId}" name="${groupName}" value="${item.value}">
                <label for="${checkboxId}">${item.label}</label>
            `;
            container.appendChild(div);
        });
    }

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
                    <option value="1" ${hotelData?.stars == '1' ? 'selected' : ''}>⭐</option>
                    <option value="2" ${hotelData?.stars == '2' ? 'selected' : ''}>⭐⭐</option>
                    <option value="3" ${hotelData?.stars == '3' ? 'selected' : ''}>⭐⭐⭐</option>
                    <option value="4" ${hotelData?.stars == '4' ? 'selected' : ''}>⭐⭐⭐⭐</option>
                    <option value="5" ${hotelData?.stars == '5' ? 'selected' : ''}>⭐⭐⭐⭐⭐</option>
                </select>
            </div>
            <div class="form-group">
                <label for="p-hotel-booking-${packageHotelFieldCount}">קישור Booking.com:</label>
                <input type="url" id="p-hotel-booking-${packageHotelFieldCount}" value="${hotelData?.affiliateLinks?.booking || ''}" placeholder="https://...">
            </div>
            <div class="form-group">
                <label for="p-hotel-agoda-${packageHotelFieldCount}">קישור Agoda:</label>
                <input type="url" id="p-hotel-agoda-${packageHotelFieldCount}" value="${hotelData?.affiliateLinks?.agoda || ''}" placeholder="https://...">
            </div>
            <div class="form-group">
                <label for="p-hotel-expedia-${packageHotelFieldCount}">קישור Expedia:</label>
                <input type="url" id="p-hotel-expedia-${packageHotelFieldCount}" value="${hotelData?.affiliateLinks?.expedia || ''}" placeholder="https://...">
            </div>
            <button type="button" class="remove-hotel-btn">הסר מלון זה</button>
        `;
        packageHotelsContainer.appendChild(hotelEntryDiv);

        hotelEntryDiv.querySelector('.remove-hotel-btn').addEventListener('click', function() {
            hotelEntryDiv.remove();
            // אין צורך לעדכן packageHotelFieldCount כאן כי אנו לא מסתמכים על מספר מדויק ורציף
        });
    }
    
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

    if (loginButton) {
        loginButton.addEventListener('click', () => {
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            loginError.textContent = '';
            signInWithEmailAndPassword(auth, email, password)
                .catch(error => {
                    loginError.textContent = "שגיאת התחברות: " + error.message;
                    console.error('Login error:', error);
                });
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).catch(error => console.error('Logout error:', error));
        });
    }

    // פונקציית עזר לחישוב חודשי זמינות
    function calculateAvailabilityMonths(startDateStr, endDateStr) {
        const months = [];
        if (startDateStr && endDateStr) {
            try {
                const start = new Date(startDateStr);
                const end = new Date(endDateStr);
                if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];

                let current = new Date(start.getFullYear(), start.getMonth(), 1);
                const lastMonthDate = new Date(end.getFullYear(), end.getMonth(), 1);

                while(current <= lastMonthDate) {
                    const year = current.getFullYear();
                    const monthNum = current.getMonth() + 1; // חודש 1-12
                    const month = monthNum.toString().padStart(2, '0');
                    months.push(`${year}-${month}`);
                    
                    // קדם את החודש בצורה בטוחה
                    if (monthNum === 12) {
                        current = new Date(year + 1, 0, 1); // עבור לינואר של השנה הבאה
                    } else {
                        current = new Date(year, monthNum, 1); // עבור לחודש הבא באותה שנה
                    }
                }
            } catch (e) {
                console.error("Error calculating availability months:", e);
                return [];
            }
        }
        return months;
    }

    if (packageDealForm) {
        packageDealForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dealId = packageDealIdInput.value;
            const startDate = document.getElementById('package-start-date').value;
            const endDate = document.getElementById('package-end-date').value;
            const selectedTripTypes = Array.from(packageTripTypesContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            const hotelsData = [];
            packageHotelsContainer.querySelectorAll('.hotel-entry').forEach(entry => {
                const index = entry.dataset.hotelIndex; // אם עדיין משתמשים באינדקס (לא חובה)
                hotelsData.push({
                    name: entry.querySelector(`input[id^="p-hotel-name-"]`).value, // שימוש ב-selector גמיש יותר
                    stars: entry.querySelector(`select[id^="p-hotel-stars-"]`).value,
                    affiliateLinks: {
                        booking: entry.querySelector(`input[id^="p-hotel-booking-"]`).value || null,
                        agoda: entry.querySelector(`input[id^="p-hotel-agoda-"]`).value || null,
                        expedia: entry.querySelector(`input[id^="p-hotel-expedia-"]`).value || null,
                    }
                });
            });
            const extraAddonsText = document.getElementById('package-extra-addons').value;
            const availabilityMonthsFromDates = calculateAvailabilityMonths(startDate, endDate);

            const dealData = {
                dealType: "package",
                name: document.getElementById('package-deal-name').value,
                description: document.getElementById('package-deal-description').value,
                price_text: document.getElementById('package-price-text').value,
                exactDatesRange: { start: startDate, end: endDate },
                destinationCountry: document.getElementById('package-country').value,
                destinationCity: document.getElementById('package-city').value,
                flightDetails: {
                    departureAirline: document.getElementById('package-flight-departure-airline').value || null,
                    departureTime: document.getElementById('package-flight-departure-time').value || null,
                    returnAirline: document.getElementById('package-flight-return-airline').value || null,
                    returnTime: document.getElementById('package-flight-return-time').value || null,
                    notes: document.getElementById('package-flight-notes').value || null,
                },
                hotels: hotelsData,
                extraAddons: extraAddonsText ? extraAddonsText.split(',').map(s => s.trim()).filter(s => s) : [],
                imageUrl: document.getElementById('package-image-url').value,
                tripTypes: selectedTripTypes,
                availabilityMonths: availabilityMonthsFromDates,
                updatedAt: serverTimestamp()
            };
            if (!dealId) dealData.createdAt = serverTimestamp();
            await saveData(dealId, dealData, packageModal, packageDealForm, "דיל חבילה");
        });
    }

    if (flightDealForm) {
        flightDealForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dealId = flightDealIdInput.value;
            const startDate = document.getElementById('flight-start-date').value;
            const endDate = document.getElementById('flight-end-date').value;
            const availabilityMonthsFromDates = calculateAvailabilityMonths(startDate, endDate);
            const dealData = {
                dealType: "flight",
                name: document.getElementById('flight-title').value,
                flightOrigin: document.getElementById('flight-origin').value,
                flightDestination: document.getElementById('flight-destination').value,
                exactDatesRange: { start: startDate, end: endDate },
                airline: document.getElementById('flight-airline').value,
                price_text: document.getElementById('flight-price-text').value,
                imageUrl: document.getElementById('flight-image-url').value || null,
                flightDetails: { notes: document.getElementById('flight-notes-standalone').value || null },
                availabilityMonths: availabilityMonthsFromDates,
                updatedAt: serverTimestamp()
            };
            if (!dealId) dealData.createdAt = serverTimestamp();
            await saveData(dealId, dealData, flightModal, flightDealForm, "טיסה");
        });
    }
    
    if (hotelDealForm) {
        hotelDealForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dealId = hotelDealIdInput.value;
            const startDate = document.getElementById('hotel-start-date').value;
            const endDate = document.getElementById('hotel-end-date').value;
            const availabilityMonthsFromDates = calculateAvailabilityMonths(startDate, endDate);
            const selectedTripTypes = Array.from(hotelTripTypesContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            const dealData = {
                dealType: "hotel",
                name: document.getElementById('hotel-name').value,
                description: document.getElementById('hotel-description').value,
                stars: document.getElementById('hotel-stars').value || null,
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
            await saveData(dealId, dealData, hotelModal, hotelDealForm, "מלון");
        });
    }

    async function saveData(dealId, data, modalToClose, formToReset, itemTypeName) {
        const saveButton = formToReset.querySelector('button[type="submit"]');
        const originalButtonText = saveButton.textContent;
        try {
            saveButton.disabled = true;
            saveButton.textContent = 'שומר...';
            if (dealId) {
                const dealDocRef = doc(db, 'deals', dealId);
                await updateDoc(dealDocRef, data);
                alert(`${itemTypeName} עודכן בהצלחה!`);
            } else {
                await addDoc(dealsCollectionRef, data);
                alert(`${itemTypeName} נוסף בהצלחה!`);
            }
            
            if(formToReset.id === 'package-deal-form') resetPackageForm();
            else if(formToReset.id === 'flight-deal-form') resetFlightForm();
            else if(formToReset.id === 'hotel-deal-form') resetHotelForm();
            
            closeModal(modalToClose);
            loadAdminDeals();
        } catch (error) {
            console.error(`Error saving ${itemTypeName}:`, error);
            alert(`שגיאה בשמירת ה${itemTypeName.toLowerCase()}: ` + error.message);
        } finally {
            if(saveButton){ // ודא שהכפתור קיים לפני שמנסים לגשת למאפיינים שלו
                 saveButton.disabled = false;
                 saveButton.textContent = originalButtonText;
            }
        }
    }

    function resetPackageForm() {
        if(packageDealForm) packageDealForm.reset();
        if(packageDealIdInput) packageDealIdInput.value = '';
        if(packageHotelsContainer) packageHotelsContainer.innerHTML = '';
        packageHotelFieldCount = 0; // איפוס המונה הגלובלי
        if(packageTripTypesContainer) packageTripTypesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        const titleEl = packageModal?.querySelector('h3');
        if(titleEl) titleEl.textContent = 'יצירת דיל חדש (חבילה)';
        const saveBtn = packageDealForm?.querySelector('button[type="submit"]');
        if(saveBtn) saveBtn.textContent = "שמור דיל חבילה";
    }
    function resetFlightForm() {
        if(flightDealForm) flightDealForm.reset();
        if(flightDealIdInput) flightDealIdInput.value = '';
        const titleEl = flightModal?.querySelector('h3');
        if(titleEl) titleEl.textContent = 'הוספת טיסה שווה';
        const saveBtn = flightDealForm?.querySelector('button[type="submit"]');
        if(saveBtn) saveBtn.textContent = "שמור טיסה";
    }
    function resetHotelForm() {
        if(hotelDealForm) hotelDealForm.reset();
        if(hotelDealIdInput) hotelDealIdInput.value = '';
        if(hotelTripTypesContainer) hotelTripTypesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        const titleEl = hotelModal?.querySelector('h3');
        if(titleEl) titleEl.textContent = 'הוספת מלון שווה';
        const saveBtn = hotelDealForm?.querySelector('button[type="submit"]');
        if(saveBtn) saveBtn.textContent = "שמור מלון";
    }

    async function loadAdminDeals() {
        if (!adminDealsOutput) return;
        adminDealsOutput.innerHTML = '<p style="text-align:center;">טוען פריטים...</p>';
        try {
            const q = query(dealsCollectionRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                adminDealsOutput.innerHTML = '<p style="text-align:center;">אין פריטים להצגה. הוסף פריט חדש!</p>';
                return;
            }
            let html = '<ul>';
            querySnapshot.forEach((docSnapshot) => {
                const item = docSnapshot.data();
                const id = docSnapshot.id;
                let itemTypeDisplay = getItemTypeDisplay(item.dealType);
                let datesDisplay = '';
                if (item.exactDatesRange?.start && item.exactDatesRange?.end) {
                    try { // עטיפה ב-try-catch למקרה שתאריך לא תקין
                        datesDisplay = ` | ${new Date(item.exactDatesRange.start).toLocaleDateString('he-IL', {day:'2-digit', month:'2-digit', year:'numeric'})} - ${new Date(item.exactDatesRange.end).toLocaleDateString('he-IL', {day:'2-digit', month:'2-digit', year:'numeric'})}`;
                    } catch (e) {
                        datesDisplay = " | תאריכים לא תקינים";
                    }
                }

                html += `
                    <li>
                        <div>
                            <strong>${item.name || 'פריט ללא שם'}</strong> <br>
                            <small>סוג: ${itemTypeDisplay}${datesDisplay} | מחיר: ${item.price_text || 'לא צוין'}</small>
                            ${item.dealType === 'package' ? `<small>יעד: ${item.destinationCity || ''}, ${item.destinationCountry || ''}</small>` : ''}
                            ${item.dealType === 'flight' ? `<small>קו: ${item.flightOrigin || ''} ←→ ${item.flightDestination || ''} (${item.airline || 'לא צוינה חברה'})</small>` : ''}
                            ${item.dealType === 'hotel' ? `<small>מיקום: ${item.destinationCity || ''}, ${item.destinationCountry || ''} (${item.stars || '?'} כוכבים)</small>` : ''}
                            <small>נוצר: ${item.createdAt?.toDate().toLocaleString('he-IL', {dateStyle: 'short', timeStyle: 'short'}) || 'לא זמין'}</small>
                        </div>
                        <div>
                            <button data-id="${id}" data-type="${item.dealType}" class="edit-item button button-secondary" style="padding:6px 12px; font-size:0.85em; margin-bottom: 5px;">ערוך</button>
                            <button data-id="${id}" class="delete-item" style="background-color:#dc3545; color:white; border:none; border-radius:4px; padding:6px 12px; font-size:0.85em; cursor:pointer;">מחק</button>
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
            adminDealsOutput.innerHTML = '<p style="text-align:center; color:red;">שגיאה בטעינת הפריטים.</p>';
        }
    }
    
    function getItemTypeDisplay(dealTypeKey) {
        const types = { flight: 'טיסה', hotel: 'מלון', package: 'חבילה' };
        return types[dealTypeKey] || dealTypeKey || 'לא צוין';
    }

    async function handleEditItem(e) {
        const id = e.target.dataset.id;
        const type = e.target.dataset.type; 

        try {
            const itemDocRef = doc(db, 'deals', id);
            const docSnap = await getDoc(itemDocRef);

            if (docSnap.exists()) {
                const itemData = docSnap.data();
                let targetModal, idInput, form, titleText, saveBtnText;

                if (type === 'package') {
                    targetModal = packageModal;
                    idInput = packageDealIdInput;
                    form = packageDealForm;
                    titleText = 'עריכת דיל חבילה';
                    saveBtnText = 'עדכן דיל חבילה';
                    resetPackageForm(); 
                    
                    document.getElementById('package-deal-name').value = itemData.name || '';
                    document.getElementById('package-deal-description').value = itemData.description || '';
                    document.getElementById('package-price-text').value = itemData.price_text || '';
                    document.getElementById('package-start-date').value = itemData.exactDatesRange?.start || '';
                    document.getElementById('package-end-date').value = itemData.exactDatesRange?.end || '';
                    document.getElementById('package-country').value = itemData.destinationCountry || '';
                    document.getElementById('package-city').value = itemData.destinationCity || '';
                    
                    document.getElementById('package-flight-departure-airline').value = itemData.flightDetails?.departureAirline || '';
                    document.getElementById('package-flight-departure-time').value = itemData.flightDetails?.departureTime || '';
                    document.getElementById('package-flight-return-airline').value = itemData.flightDetails?.returnAirline || '';
                    document.getElementById('package-flight-return-time').value = itemData.flightDetails?.returnTime || '';
                    document.getElementById('package-flight-notes').value = itemData.flightDetails?.notes || '';

                    if(packageHotelsContainer) packageHotelsContainer.innerHTML = ''; 
                    packageHotelFieldCount = 0;
                    if (itemData.hotels && Array.isArray(itemData.hotels)) {
                        itemData.hotels.forEach(hotel => addHotelFieldToPackage(hotel));
                    }

                    document.getElementById('package-extra-addons').value = (itemData.extraAddons || []).join(', ');
                    document.getElementById('package-image-url').value = itemData.imageUrl || '';

                    if(packageTripTypesContainer && itemData.tripTypes) itemData.tripTypes.forEach(val => { const cb = packageTripTypesContainer.querySelector(`input[value="${val}"]`); if(cb) cb.checked = true; });
                
                } else if (type === 'flight') {
                    targetModal = flightModal;
                    idInput = flightDealIdInput;
                    form = flightDealForm;
                    titleText = 'עריכת טיסה';
                    saveBtnText = 'עדכן טיסה';
                    resetFlightForm();

                    document.getElementById('flight-title').value = itemData.name || '';
                    document.getElementById('flight-origin').value = itemData.flightOrigin || '';
                    document.getElementById('flight-destination').value = itemData.flightDestination || '';
                    document.getElementById('flight-start-date').value = itemData.exactDatesRange?.start || '';
                    document.getElementById('flight-end-date').value = itemData.exactDatesRange?.end || '';
                    document.getElementById('flight-airline').value = itemData.airline || '';
                    document.getElementById('flight-price-text').value = itemData.price_text || '';
                    document.getElementById('flight-image-url').value = itemData.imageUrl || '';
                    document.getElementById('flight-notes-standalone').value = itemData.flightDetails?.notes || '';

                } else if (type === 'hotel') {
                    targetModal = hotelModal;
                    idInput = hotelDealIdInput;
                    form = hotelDealForm;
                    titleText = 'עריכת מלון';
                    saveBtnText = 'עדכן מלון';
                    resetHotelForm();

                    document.getElementById('hotel-name').value = itemData.name || '';
                    document.getElementById('hotel-description').value = itemData.description || '';
                    document.getElementById('hotel-stars').value = itemData.stars || '';
                    document.getElementById('hotel-country').value = itemData.destinationCountry || '';
                    document.getElementById('hotel-city').value = itemData.destinationCity || '';
                    document.getElementById('hotel-start-date').value = itemData.exactDatesRange?.start || '';
                    document.getElementById('hotel-end-date').value = itemData.exactDatesRange?.end || '';
                    document.getElementById('hotel-price-text').value = itemData.price_text || '';
                    document.getElementById('hotel-affiliate-booking').value = itemData.singleHotelAffiliateLinks?.booking || '';
                    document.getElementById('hotel-affiliate-agoda').value = itemData.singleHotelAffiliateLinks?.agoda || '';
                    document.getElementById('hotel-affiliate-expedia').value = itemData.singleHotelAffiliateLinks?.expedia || '';
                    document.getElementById('hotel-image-url').value = itemData.imageUrl || '';

                    if(hotelTripTypesContainer && itemData.tripTypes) itemData.tripTypes.forEach(val => { const cb = hotelTripTypesContainer.querySelector(`input[value="${val}"]`); if(cb) cb.checked = true; });
                } else {
                    alert("סוג פריט לא ידוע לעריכה.");
                    return;
                }

                if (idInput) idInput.value = id;
                const titleEl = targetModal?.querySelector('h3');
                if (titleEl) titleEl.textContent = titleText;
                const saveBtn = form?.querySelector('button[type="submit"]');
                if (saveBtn) saveBtn.textContent = saveBtnText;

                if (targetModal) openModal(targetModal);

            } else {
                alert("לא נמצא פריט לעריכה.");
            }
        } catch (error) {
            console.error("Error fetching item for edit:", error);
            alert("שגיאה בטעינת הפריט לעריכה: " + error.message);
        }
    }

    async function handleDeleteItem(e) {
        const id = e.target.dataset.id;
        if (confirm('האם אתה בטוח שברצונך למחוק פריט זה? הפעולה אינה הפיכה.')) {
            try {
                const itemDocRef = doc(db, 'deals', id);
                await deleteDoc(itemDocRef);
                alert('הפריט נמחק בהצלחה!');
                loadAdminDeals();
            } catch (error) {
                console.error('Error deleting item:', error);
                alert('שגיאה במחיקת הפריט: ' + error.message);
            }
        }
    }
    
    if (auth.currentUser) {
        loadAdminDeals();
    }
});
