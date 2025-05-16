// admin-script.js
import { auth, db } from './firebase-init.js'; // ייבוא משירותי Firebase שהוגדרו
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

document.addEventListener('DOMContentLoaded', function () {
    const loginSection = document.getElementById('admin-login');
    const dashboardSection = document.getElementById('admin-dashboard');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const loginError = document.getElementById('login-error');
    const adminUserEmailEl = document.getElementById('admin-user-email');


    const dealForm = document.getElementById('deal-form');
    const formTitle = document.getElementById('form-title');
    const dealIdInput = document.getElementById('deal-id'); // input hidden
    const dealNameInput = document.getElementById('deal-name');
    const dealDescriptionInput = document.getElementById('deal-description');
    const dealPriceTextInput = document.getElementById('deal-price-text');
    const dealTypeSelect = document.getElementById('deal-type-select');
    const dealImageUrlInput = document.getElementById('deal-image-url');
    const affiliateBookingInput = document.getElementById('affiliate-booking');
    const affiliateAgodaInput = document.getElementById('affiliate-agoda');
    const affiliateExpediaInput = document.getElementById('affiliate-expedia');
    const saveDealButton = document.getElementById('save-deal-button'); // שונה ל-type=submit ב-HTML
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const adminDealsOutput = document.getElementById('admin-deals-output');

    const dealsCollectionRef = collection(db, 'deals');

    // בדוק אם המשתמש כבר מחובר
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

    // התחברות
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            loginError.textContent = '';

            signInWithEmailAndPassword(auth, email, password)
                .then(userCredential => {
                    console.log('User logged in:', userCredential.user);
                    // onAuthStateChanged יטפל בהצגת/הסתרת החלקים
                })
                .catch(error => {
                    loginError.textContent = "שגיאת התחברות: " + error.message;
                    console.error('Login error:', error);
                });
        });
    }

    // התנתקות
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).then(() => {
                console.log('User logged out');
            }).catch(error => {
                console.error('Logout error:', error);
            });
        });
    }

    // שמירת דיל (הוספה או עדכון)
    if (dealForm) {
        dealForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dealId = dealIdInput.value; // ערך מ-input hidden
            const dealData = {
                name: dealNameInput.value,
                description: dealDescriptionInput.value,
                price_text: dealPriceTextInput.value,
                type: dealTypeSelect.value,
                imageUrl: dealImageUrlInput.value,
                affiliateLinks: {
                    booking: affiliateBookingInput.value || null,
                    agoda: affiliateAgodaInput.value || null,
                    expedia: affiliateExpediaInput.value || null,
                },
                // הוספת חותמת זמן רק אם זה דיל חדש, או עדכון חותמת זמן של עדכון
                updatedAt: serverTimestamp()
            };

            if (!dealId) { // אם אין ID, זה דיל חדש, הוסף createdAt
                dealData.createdAt = serverTimestamp();
            }


            try {
                saveDealButton.disabled = true;
                saveDealButton.textContent = 'שומר...';

                if (dealId) { // עדכון דיל קיים
                    const dealDocRef = doc(db, 'deals', dealId);
                    await updateDoc(dealDocRef, dealData);
                    alert('הדיל עודכן בהצלחה!');
                } else { // הוספת דיל חדש
                    await addDoc(dealsCollectionRef, dealData);
                    alert('הדיל נוסף בהצלחה!');
                }
                dealForm.reset();
                dealIdInput.value = ''; // נקה את ה-ID הנסתר
                formTitle.textContent = 'הוסף דיל חדש';
                saveDealButton.textContent = 'שמור דיל';
                cancelEditButton.style.display = 'none';
                loadAdminDeals(); // טען מחדש את רשימת הדילים
            } catch (error) {
                console.error('Error saving deal:', error);
                alert('שגיאה בשמירת הדיל: ' + error.message);
            } finally {
                saveDealButton.disabled = false;
                saveDealButton.textContent = dealId ? 'עדכן דיל' : 'שמור דיל';
            }
        });
    }

    // טעינת דילים להצגה בניהול
    async function loadAdminDeals() {
        if (!adminDealsOutput) return;
        adminDealsOutput.innerHTML = '<p>טוען דילים...</p>';
        try {
            const q = query(dealsCollectionRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                adminDealsOutput.innerHTML = '<p>אין דילים להצגה. הוסף דיל חדש!</p>';
                return;
            }
            let html = '<ul>';
            querySnapshot.forEach((docSnapshot) => { // שיניתי את שם המשתנה כדי למנוע בלבול עם doc()
                const deal = docSnapshot.data();
                const id = docSnapshot.id;
                html += `
                    <li>
                        <div>
                            <strong>${deal.name}</strong> <br>
                            <small>סוג: ${getDealTypeDisplay(deal.type)} | מחיר: ${deal.price_text}</small><br>
                            <small>נוצר: ${deal.createdAt?.toDate().toLocaleString('he-IL') || 'לא זמין'}</small>
                        </div>
                        <div>
                            <button data-id="${id}" class="edit-deal button-secondary" style="padding:5px 10px; font-size:0.8em;">ערוך</button>
                            <button data-id="${id}" class="delete-deal" style="background-color:#dc3545; padding:5px 10px; font-size:0.8em;">מחק</button>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            adminDealsOutput.innerHTML = html;

            // הוספת Event Listeners לכפתורי עריכה ומחיקה
            document.querySelectorAll('.edit-deal').forEach(button => {
                button.addEventListener('click', handleEditDeal);
            });
            document.querySelectorAll('.delete-deal').forEach(button => {
                button.addEventListener('click', handleDeleteDeal);
            });

        } catch (error) {
            console.error('Error loading admin deals:', error);
            adminDealsOutput.innerHTML = '<p>שגיאה בטעינת הדילים.</p>';
        }
    }

    // טיפול בעריכת דיל
    async function handleEditDeal(e) {
        const id = e.target.dataset.id;
        try {
            const dealDocRef = doc(db, 'deals', id);
            const docSnap = await getDoc(dealDocRef);

            if (docSnap.exists()) {
                const deal = docSnap.data();
                formTitle.textContent = 'ערוך דיל קיים';
                dealIdInput.value = id; // שמור את ה-ID ב-input הנסתר
                dealNameInput.value = deal.name;
                dealDescriptionInput.value = deal.description;
                dealPriceTextInput.value = deal.price_text;
                dealTypeSelect.value = deal.type;
                dealImageUrlInput.value = deal.imageUrl;
                affiliateBookingInput.value = deal.affiliateLinks?.booking || '';
                affiliateAgodaInput.value = deal.affiliateLinks?.agoda || '';
                affiliateExpediaInput.value = deal.affiliateLinks?.expedia || '';

                saveDealButton.textContent = 'עדכן דיל';
                cancelEditButton.style.display = 'inline-block';
                dealForm.scrollIntoView({ behavior: 'smooth' }); // גלול לטופס
            }
        } catch (error) {
            console.error("Error fetching deal for edit:", error);
            alert("שגיאה בטעינת הדיל לעריכה.");
        }
    }

    // ביטול עריכה
    if(cancelEditButton) {
        cancelEditButton.addEventListener('click', () => {
            dealForm.reset();
            dealIdInput.value = '';
            formTitle.textContent = 'הוסף דיל חדש';
            saveDealButton.textContent = 'שמור דיל';
            cancelEditButton.style.display = 'none';
        });
    }

    // טיפול במחיקת דיל
    async function handleDeleteDeal(e) {
        const id = e.target.dataset.id;
        if (confirm('האם אתה בטוח שברצונך למחוק דיל זה? הפעולה אינה הפיכה.')) {
            try {
                const dealDocRef = doc(db, 'deals', id);
                await deleteDoc(dealDocRef);
                alert('הדיל נמחק בהצלחה!');
                loadAdminDeals(); // טען מחדש את רשימת הדילים
            } catch (error) {
                console.error('Error deleting deal:', error);
                alert('שגיאה במחיקת הדיל.');
            }
        }
    }

    function getDealTypeDisplay(typeKey) {
        if (typeKey === 'flight') return 'טיסה';
        if (typeKey === 'hotel') return 'מלון';
        if (typeKey === 'package') return 'חבילה';
        return typeKey;
    }

}); // סוף DOMContentLoaded
