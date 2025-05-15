// admin-script.js
document.addEventListener('DOMContentLoaded', function () {
    const loginSection = document.getElementById('admin-login');
    const dashboardSection = document.getElementById('admin-dashboard');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const loginError = document.getElementById('login-error');

    const dealForm = document.getElementById('deal-form');
    const formTitle = document.getElementById('form-title');
    const dealIdInput = document.getElementById('deal-id');
    const dealNameInput = document.getElementById('deal-name');
    const dealDescriptionInput = document.getElementById('deal-description');
    const dealPriceTextInput = document.getElementById('deal-price-text');
    const dealTypeSelect = document.getElementById('deal-type-select');
    const dealImageUrlInput = document.getElementById('deal-image-url');
    const affiliateBookingInput = document.getElementById('affiliate-booking');
    const affiliateAgodaInput = document.getElementById('affiliate-agoda');
    const affiliateExpediaInput = document.getElementById('affiliate-expedia');
    const saveDealButton = document.getElementById('save-deal-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const adminDealsOutput = document.getElementById('admin-deals-output');

    // בדוק אם המשתמש כבר מחובר
    auth.onAuthStateChanged(user => {
        if (user) {
            loginSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            loadDeals();
        } else {
            loginSection.style.display = 'block';
            dashboardSection.style.display = 'none';
        }
    });

    // התחברות
    loginButton.addEventListener('click', () => {
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        loginError.textContent = '';

        auth.signInWithEmailAndPassword(email, password)
            .then(userCredential => {
                console.log('User logged in:', userCredential.user);
            })
            .catch(error => {
                loginError.textContent = error.message;
                console.error('Login error:', error);
            });
    });

    // התנתקות
    logoutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            console.log('User logged out');
        }).catch(error => {
            console.error('Logout error:', error);
        });
    });

    // שמירת דיל (הוספה או עדכון)
    dealForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dealId = dealIdInput.value;
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
            createdAt: firebase.firestore.FieldValue.serverTimestamp() // הוספת חותמת זמן
        };

        try {
            if (dealId) { // עדכון דיל קיים
                await db.collection('deals').doc(dealId).update(dealData);
                alert('הדיל עודכן בהצלחה!');
            } else { // הוספת דיל חדש
                await db.collection('deals').add(dealData);
                alert('הדיל נוסף בהצלחה!');
            }
            dealForm.reset();
            dealIdInput.value = '';
            formTitle.textContent = 'הוסף דיל חדש';
            saveDealButton.textContent = 'שמור דיל';
            cancelEditButton.style.display = 'none';
            loadDeals(); // טען מחדש את רשימת הדילים
        } catch (error) {
            console.error('Error saving deal:', error);
            alert('שגיאה בשמירת הדיל: ' + error.message);
        }
    });

    // טעינת דילים להצגה בניהול
    async function loadDeals() {
        adminDealsOutput.innerHTML = 'טוען דילים...';
        try {
            const snapshot = await db.collection('deals').orderBy('createdAt', 'desc').get();
            if (snapshot.empty) {
                adminDealsOutput.innerHTML = '<p>אין דילים להצגה.</p>';
                return;
            }
            let html = '<ul>';
            snapshot.forEach(doc => {
                const deal = doc.data();
                html += `
                    <li>
                        <strong>${deal.name}</strong> (${deal.type}) - ${deal.price_text}
                        <button data-id="${doc.id}" class="edit-deal">ערוך</button>
                        <button data-id="${doc.id}" class="delete-deal">מחק</button>
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
            console.error('Error loading deals:', error);
            adminDealsOutput.innerHTML = '<p>שגיאה בטעינת הדילים.</p>';
        }
    }

    // טיפול בעריכת דיל
    async function handleEditDeal(e) {
        const id = e.target.dataset.id;
        try {
            const doc = await db.collection('deals').doc(id).get();
            if (doc.exists) {
                const deal = doc.data();
                formTitle.textContent = 'ערוך דיל קיים';
                dealIdInput.value = id;
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
                window.scrollTo(0, dealFormContainer.offsetTop); // גלול לטופס
            }
        } catch (error) {
            console.error("Error fetching deal for edit:", error);
        }
    }

    // ביטול עריכה
    cancelEditButton.addEventListener('click', () => {
        dealForm.reset();
        dealIdInput.value = '';
        formTitle.textContent = 'הוסף דיל חדש';
        saveDealButton.textContent = 'שמור דיל';
        cancelEditButton.style.display = 'none';
    });


    // טיפול במחיקת דיל
    async function handleDeleteDeal(e) {
        const id = e.target.dataset.id;
        if (confirm('האם אתה בטוח שברצונך למחוק דיל זה?')) {
            try {
                await db.collection('deals').doc(id).delete();
                alert('הדיל נמחק בהצלחה!');
                loadDeals(); // טען מחדש את רשימת הדילים
            } catch (error) {
                console.error('Error deleting deal:', error);
                alert('שגיאה במחיקת הדיל.');
            }
        }
    }

}); // סוף DOMContentLoaded
