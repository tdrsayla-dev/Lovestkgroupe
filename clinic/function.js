// Global variables for Dashboard Calendar
window.dbStartDate = new Date();
window.dbEndDate = new Date();
window.dbClickState = 0;
window.currentCalDate = new Date();

window.renderCalendar = function () {
    const calendarTitle = document.getElementById('calendar-title');
    const calendarDays = document.getElementById('calendar-days');
    if (!calendarTitle || !calendarDays) return;

    const year = window.currentCalDate.getFullYear();
    const month = window.currentCalDate.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    calendarTitle.textContent = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();

    let startDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    let daysHtml = "";

    for (let x = startDayIndex; x > 0; x--) {
        daysHtml += `<div class="db-calendar-day other-month">${prevLastDay - x + 1}</div>`;
    }

    const startT = new Date(window.dbStartDate.getFullYear(), window.dbStartDate.getMonth(), window.dbStartDate.getDate()).getTime();
    const endT = new Date(window.dbEndDate.getFullYear(), window.dbEndDate.getMonth(), window.dbEndDate.getDate()).getTime();

    let minT = Math.min(startT, endT);
    let maxT = Math.max(startT, endT);

    for (let i = 1; i <= lastDay; i++) {
        let cellTime = new Date(year, month, i).getTime();
        let classes = "db-calendar-day";

        if (cellTime === minT) classes += " active selected-start";
        if (cellTime === maxT && minT !== maxT) classes += " active selected-end";
        if (cellTime > minT && cellTime < maxT) classes += " selected-range";

        daysHtml += `<div class="${classes}" onclick="window.handleCalendarClick(${year}, ${month}, ${i})">${i}</div>`;
    }

    const totalCells = 42;
    const currentCellsCount = startDayIndex + lastDay;
    const nextDaysCount = totalCells - currentCellsCount;
    for (let j = 1; j <= nextDaysCount; j++) {
        daysHtml += `<div class="db-calendar-day other-month">${j}</div>`;
    }
    calendarDays.innerHTML = daysHtml;
};

window.handleCalendarClick = function (y, m, d) {
    const clickedDate = new Date(y, m, d);

    if (window.dbClickState === 0) {
        window.dbStartDate = clickedDate;
        window.dbEndDate = clickedDate;
        window.dbClickState = 1;
    } else {
        window.dbEndDate = clickedDate;
        window.dbClickState = 0;
    }

    window.renderCalendar();
    window.updateDashboardStats();
};

window.updateDashboardStats = async function () {
    try {
        let minDate = window.dbStartDate < window.dbEndDate ? window.dbStartDate : window.dbEndDate;
        let maxDate = window.dbStartDate > window.dbEndDate ? window.dbStartDate : window.dbEndDate;

        const tzMin = minDate.getTimezoneOffset() * 60000;
        const startStr = (new Date(minDate - tzMin)).toISOString().split('T')[0];
        const tzMax = maxDate.getTimezoneOffset() * 60000;
        const endStr = (new Date(maxDate - tzMax)).toISOString().split('T')[0];

        const startTimestamp = startStr + "T00:00:00";
        const endTimestamp = endStr + "T23:59:59";

        if (typeof _supabase === 'undefined') return;

        const { count: apptCount } = await _supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('appointment_date', startStr).lte('appointment_date', endStr);
        const { count: paymentCount } = await _supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'รอชำระเงิน').gte('created_at', startTimestamp).lte('created_at', endTimestamp);
        const { count: reschedCount } = await _supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'เลื่อนนัด').gte('appointment_date', startStr).lte('appointment_date', endStr);
        const { count: totalPatientsCount } = await _supabase.from('patients').select('*', { count: 'exact', head: true }).gte('created_at', startTimestamp).lte('created_at', endTimestamp);
        const { count: visitsCount } = await _supabase.from('visits').select('*', { count: 'exact', head: true }).gte('created_at', startTimestamp).lte('created_at', endTimestamp);

        const { count: regQueue } = await _supabase.from('appointments').select('*', { count: 'exact', head: true }).in('status', ['รอ', 'รอยืนยัน']).gte('appointment_date', startStr).lte('appointment_date', endStr);
        const { count: triageQueue } = await _supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'รอคัดกรอง').gte('created_at', startTimestamp).lte('created_at', endTimestamp);
        const { count: doctorQueue } = await _supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'รอตรวจ').gte('created_at', startTimestamp).lte('created_at', endTimestamp);
        const { count: labQueue } = await _supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'รอผลแล็บ').gte('created_at', startTimestamp).lte('created_at', endTimestamp);
        const { count: rxQueue } = await _supabase.from('visits').select('*', { count: 'exact', head: true }).in('status', ['รออ่านผล', 'รอจัดยา', 'รอจัดคิว']).gte('created_at', startTimestamp).lte('created_at', endTimestamp);

        if (document.getElementById('db-stat-appointments')) document.getElementById('db-stat-appointments').textContent = apptCount || 0;
        if (document.getElementById('db-stat-payments')) document.getElementById('db-stat-payments').textContent = paymentCount || 0;
        if (document.getElementById('db-stat-rescheduled')) document.getElementById('db-stat-rescheduled').textContent = reschedCount || 0;
        if (document.getElementById('db-stat-patients')) document.getElementById('db-stat-patients').textContent = totalPatientsCount || 0;

        if (document.getElementById('db-queue-reg')) document.getElementById('db-queue-reg').textContent = regQueue || 0;
        if (document.getElementById('db-queue-triage')) document.getElementById('db-queue-triage').textContent = triageQueue || 0;
        if (document.getElementById('db-queue-doctor')) document.getElementById('db-queue-doctor').textContent = doctorQueue || 0;
        if (document.getElementById('db-queue-lab')) document.getElementById('db-queue-lab').textContent = labQueue || 0;
        if (document.getElementById('db-queue-prescription')) document.getElementById('db-queue-prescription').textContent = rxQueue || 0;

        if (document.getElementById('db-panel-visits-count')) document.getElementById('db-panel-visits-count').textContent = visitsCount || 0;
        if (document.getElementById('db-panel-appts-count')) document.getElementById('db-panel-appts-count').textContent = apptCount || 0;

        const { data: apptsList } = await _supabase.from('appointments').select('*').gte('appointment_date', startStr).lte('appointment_date', endStr).order('appointment_time', { ascending: true });
        const listContainer = document.getElementById('db-appointments-list');

        if (listContainer) {
            if (apptsList && apptsList.length > 0) {
                listContainer.innerHTML = apptsList.map(appt => `
                    <div class="db-appt-row">
                        <span class="db-appt-time">${appt.appointment_time || '--:--'}</span>
                        <div class="db-appt-badge">
                            <span class="db-appt-name">${appt.guest_name || 'N/A'}</span>
                            <span class="db-appt-status">${appt.status || 'รอ'}</span>
                        </div>
                    </div>
                `).join('');
            } else {
                listContainer.innerHTML = `<div class="text-center py-5 text-muted fw-semibold" style="font-size: 0.9rem;"><i class="bi bi-calendar-x me-2"></i>ไม่มีรายการในช่วงวันที่เลือก</div>`;
            }
        }
    } catch (e) {
        console.error("Dashboard update error:", e);
    }
};

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('show');
    if (overlay) overlay.classList.toggle('show');
}

function closeMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
}

function showPage(pageId, element) {
    const targetPage = document.getElementById(pageId);
    if (!targetPage) return;

    document.querySelectorAll('.page-section').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
    });

    targetPage.classList.add('active');
    targetPage.style.display = 'block';
    targetPage.style.visibility = 'visible';
    targetPage.style.opacity = '1';

    document.querySelectorAll('#sidebarNav .nav-link').forEach(l => l.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    } else {
        const navEl = document.getElementById('nav-' + pageId);
        if (navEl) navEl.classList.add('active');
    }

    // อัปเดตชื่อหน้าใน Mobile Top Header
    const mobileTitleEl = document.getElementById('mobilePageHeaderTitle');
    if (mobileTitleEl) {
        if (element) {
            const labelText = element.textContent.trim();
            if (labelText) mobileTitleEl.textContent = labelText;
        } else {
            const activeNav = document.querySelector(`#sidebarNav a[onclick*="${pageId}"]`);
            if (activeNav) {
                const labelText = activeNav.textContent.trim();
                if (labelText) mobileTitleEl.textContent = labelText;
            }
        }
    }

    // ปิดเมนู Sidebar บนสมาร์ทโฟนเมื่อกดเลือกหน้า
    closeMobileSidebar();

    // โหลดข้อมูลอัตโนมัติเมื่อกดเข้าสู่แต่ละหน้า
    try {
        if (pageId === 'dashboard') {
            if (typeof window.renderCalendar === 'function') window.renderCalendar();
            if (typeof window.updateDashboardStats === 'function') window.updateDashboardStats();
        } else if (pageId === 'stock-drugs') {
            if (typeof loadStockList === 'function') loadStockList();
        } else if (pageId === 'pharmacy') {
            if (typeof loadPharmacyQueue === 'function') loadPharmacyQueue();
        } else if (pageId === 'history') {
            if (typeof loadPatientHistory === 'function') loadPatientHistory();
        } else if (pageId === 'stock-equip') {
            if (typeof loadSupplyItems === 'function') loadSupplyItems();
            if (typeof loadSupplyRequests === 'function') loadSupplyRequests();
        } else if (pageId === 'staff') {
            if (typeof loadStaffUsers === 'function') loadStaffUsers();
        } else if (pageId === 'referrals') {
            if (typeof loadReferralData === 'function') loadReferralData();
        } else if (pageId === 'daily-reports') {
            if (typeof loadDailyReport === 'function') loadDailyReport();
        } else if (pageId === 'services') {
            if (typeof loadServicesData === 'function') loadServicesData();
        } else if (pageId === 'billing') {
            if (typeof loadBills === 'function') loadBills();
        }

        if (typeof applyClinicLanguage === 'function') {
            applyClinicLanguage();
        }
    } catch (e) {
        console.warn('Error loading section data for ' + pageId, e);
    }
}

// =====================================
// Supabase Database Connection
// =====================================
const supabaseUrl = 'https://fpmstumpobbjozflkola.supabase.co';
const supabaseKey = 'sb_publishable_h9-j-0I2ku6rYYvoeHmooQ_B5GrRzR7';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

function generateId(prefix) {
    return prefix + '-' + Math.floor(100000 + Math.random() * 900000);
}

document.addEventListener("DOMContentLoaded", function () {
    // === COLLAPSIBLE SIDEBAR DYNAMIC INITIALIZATION ===
    const sidebar = document.querySelector('.sidebar');
    const contentArea = document.querySelector('.content-area');
    if (sidebar && contentArea) {
        const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
        if (isCollapsed) {
            sidebar.classList.add('collapsed');
            contentArea.classList.add('collapsed');
        }

        const h4 = sidebar.querySelector('h4');
        if (h4) {
            const hospitalIcon = h4.querySelector('.bi-hospital') || h4.querySelector('i');
            const textNodes = Array.from(h4.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
            const textContent = textNodes.map(node => node.textContent.trim()).join(' ').trim();
            textNodes.forEach(node => node.remove());
            h4.querySelectorAll('br').forEach(br => br.remove());

            h4.innerHTML = '';
            if (hospitalIcon) {
                h4.appendChild(hospitalIcon);
            }
            const labelSpan = document.createElement('span');
            labelSpan.className = 'sidebar-label ms-2';
            labelSpan.textContent = textContent || 'Clinic System';
            h4.appendChild(labelSpan);

            h4.style.display = 'flex';
            h4.style.alignItems = 'center';
            h4.style.justifyContent = 'center';
            h4.style.padding = '0 10px';
        }

        const navLinks = sidebar.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            // 1. ป้องกันการทำงานซ้ำซ้อน
            if (link.classList.contains('sidebar-formatted')) return;
            link.classList.add('sidebar-formatted');

            // 2. ตรวจสอบว่าเมนูนี้มี <span> ครอบอยู่ด้านในหรือไม่ (สำหรับเมนู Dropdown)
            const innerSpan = link.querySelector('span');
            const targetElement = innerSpan ? innerSpan : link;

            let textContent = '';

            // 3. วนลูปดึงเฉพาะ "ข้อความล้วนๆ" ออกมา โดยไม่ลบหรือแตะต้องแท็กไอคอนใดๆ
            Array.from(targetElement.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const trimmedText = node.textContent.trim();
                    if (trimmedText !== '') {
                        textContent += trimmedText;
                    }
                    // ล้างข้อความจาก Node เดิมออกอย่างปลอดภัย
                    node.nodeValue = '';
                }
            });

            // 4. สร้าง <span> เพื่อจัดรูปแบบข้อความ และใส่กลับเข้าไป
            if (textContent !== '') {
                const labelSpan = document.createElement('span');
                labelSpan.className = 'sidebar-label ms-2';
                labelSpan.textContent = textContent;
                targetElement.appendChild(labelSpan);
            }
        });
        const profileBox = sidebar.querySelector('.sidebar-profile');
        if (profileBox) {
            profileBox.classList.add('sidebar-profile-box');
            const profileDetails = profileBox.querySelector('.text-start');
            if (profileDetails) {
                profileDetails.classList.add('sidebar-label');
            }
        }

        const chevrons = sidebar.querySelectorAll('.bi-chevron-down');
        chevrons.forEach(ch => {
            ch.classList.add('sidebar-label');
        });

        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'sidebar-toggle-container';

        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'sidebar-toggle-btn';
        toggleBtn.innerHTML = `<i class="bi bi-${isCollapsed ? 'chevron-right' : 'chevron-left'}" id="sidebarToggleIcon"></i>`;

        toggleBtn.addEventListener('click', function () {
            const collapsed = sidebar.classList.toggle('collapsed');
            contentArea.classList.toggle('collapsed');
            localStorage.setItem('sidebar-collapsed', collapsed ? 'true' : 'false');

            const icon = document.getElementById('sidebarToggleIcon');
            if (icon) {
                icon.className = `bi bi-${collapsed ? 'chevron-right' : 'chevron-left'}`;
            }
        });

        toggleContainer.appendChild(toggleBtn);
        sidebar.insertBefore(toggleContainer, sidebar.firstChild);
    }
    // === END OF COLLAPSIBLE SIDEBAR LOGIC ===

    // Generate Appointment ID when opening appointment modal
    const apptModal = document.getElementById('addAppointmentModal');
    if (apptModal) {
        apptModal.addEventListener('show.bs.modal', function () {
            document.getElementById('displayApptId').value = generateId('APT');
        });
    }

    loadAppointments();
    loadPatients();
    loadTriage();
    loadDoctorQueue();
    loadPaymentQueue();
    loadLabQueue();
    loadQueueList();
    loadPrescriptionList();
    loadMedicines();
    loadPharmacyQueue();
    loadPatientHistory();
    loadSupplyItems();
    loadSupplyRequests();
    loadServicesData();
    loadReferralData();
    loadStaffUsers();
});

function calculateAge() {
    const dobInput = document.querySelector('input[name="DOB"]').value;
    if (dobInput) {
        const dob = new Date(dobInput);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) { age--; }
        document.querySelector('input[name="Age"]').value = age >= 0 ? age : 0;
    }
}

function calculateBMI() {
    let w = parseFloat(document.getElementById('triageWeight').value);
    let h = parseFloat(document.getElementById('triageHeight').value) / 100;
    if (w > 0 && h > 0) { document.getElementById('triageBMI').value = (w / (h * h)).toFixed(2); }
}

// =====================================
// โหลดคิวและข้อมูลต่างๆ
// =====================================
let allAppointments = [];
window.appointmentReferrersMap = JSON.parse(localStorage.getItem('clinic_appointment_referrers') || '{}');
window.patientReferrersMap = JSON.parse(localStorage.getItem('clinic_patient_referrers') || '{}');

async function loadAppointments() {
    const tbody = document.querySelector('#appointmentsTable tbody');
    if (!tbody) return;

    // ตั้งค่าเริ่มต้นของตัวเลือกวันที่นัดหมายเป็นวันปัจจุบัน (Today) หากยังไม่ได้เลือก
    const dateInput = document.getElementById('appointmentDateFilter');
    if (dateInput && !dateInput.value) {
        const todayStr = new Date().toISOString().split('T')[0];
        dateInput.value = todayStr;
    }

    const { data, error } = await _supabase
        .from('appointments')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-3">เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }

    allAppointments = data || [];

    // ดึงข้อมูล referred_by จาก persistent localStorage map
    window.appointmentReferrersMap = JSON.parse(localStorage.getItem('clinic_appointment_referrers') || '{}');
    allAppointments.forEach(d => {
        if (!d.referred_by && window.appointmentReferrersMap[d.appointment_id]) {
            d.referred_by = window.appointmentReferrersMap[d.appointment_id];
        }
    });

    filterAppointments();
}

function toggleApptReferrerField() {
    const isAssisted = document.getElementById('apptTypeAssisted')?.checked;
    const container = document.getElementById('apptReferredByContainer');
    const select = document.getElementById('apptReferredBySelect');

    const labelDirect = document.getElementById('labelApptDirect');
    const labelAssisted = document.getElementById('labelApptAssisted');

    if (labelDirect && labelAssisted) {
        if (isAssisted) {
            labelAssisted.className = "flex-fill text-center py-2.5 px-3 rounded-3 cursor-pointer transition-all fw-bold d-flex align-items-center justify-content-center gap-2 mb-0 bg-primary text-white shadow-sm";
            labelDirect.className = "flex-fill text-center py-2.5 px-3 rounded-3 cursor-pointer transition-all fw-bold d-flex align-items-center justify-content-center gap-2 mb-0 bg-transparent text-secondary";
        } else {
            labelDirect.className = "flex-fill text-center py-2.5 px-3 rounded-3 cursor-pointer transition-all fw-bold d-flex align-items-center justify-content-center gap-2 mb-0 bg-primary text-white shadow-sm";
            labelAssisted.className = "flex-fill text-center py-2.5 px-3 rounded-3 cursor-pointer transition-all fw-bold d-flex align-items-center justify-content-center gap-2 mb-0 bg-transparent text-secondary";
        }
    }

    if (!container) return;

    if (isAssisted) {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
        if (select) select.value = '';
    }
}

function renderAppointmentsTable(list, selectedDate = '') {
    const tbody = document.querySelector('#appointmentsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!list || list.length === 0) {
        if (selectedDate) {
            const todayStr = new Date().toISOString().split('T')[0];
            const isToday = (selectedDate === todayStr);
            const dateLabel = isToday ? 'วันนี้' : selectedDate;
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4"><i class="bi bi-calendar-x text-warning me-2 fs-5"></i>ไม่มีรายการนัดหมายในประจำวัน (${dateLabel}) <button type="button" class="btn btn-sm btn-link text-primary text-decoration-none fw-semibold p-0 ms-2" onclick="clearAppointmentDateFilter()">ดูทั้งหมด</button></td></tr>`;
        } else {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-3">ไม่มีข้อมูลนัดหมาย</td></tr>';
        }
        return;
    }

    list.forEach(row => {
        let isWaiting = (row.status === 'รอ' || row.status === 'รอยืนยัน');
        let statusBadge = isWaiting ? `<span class="badge-soft-warning">${row.status}</span>` : `<span class="badge-soft-success">${row.status || 'เสร็จสิ้น'}</span>`;

        let actionBtn = '';
        if (isWaiting) {
            actionBtn = `
                <div class="d-flex gap-1 justify-content-center">
                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="openRegisterFromAppointment('${row.appointment_id}', '${row.guest_name}', '${row.guest_phone}')">ลงทะเบียน</button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="editAppointment('${row.appointment_id}')" title="แก้ไข"><i class="bi bi-pencil-square"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteAppointment('${row.appointment_id}')" title="ลบ"><i class="bi bi-trash"></i></button>
                </div>
            `;
        } else {
            actionBtn = `
                <div class="d-flex gap-1 justify-content-center">
                    <button type="button" class="btn btn-sm btn-light text-muted" disabled>ทำรายการแล้ว</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteAppointment('${row.appointment_id}')" title="ลบ"><i class="bi bi-trash"></i></button>
                </div>
            `;
        }

        let referrerIdVal = row.referred_by;
        let displayReason = row.reason || '-';
        let referrerHtml = '';

        if (referrerIdVal) {
            const refObj = (window.referrersData || []).find(r => r.id === referrerIdVal || r.code === referrerIdVal);
            const displayRefName = refObj ? `${refObj.name} (${refObj.code || refObj.id})` : referrerIdVal;
            referrerHtml = `<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style="font-weight: 500;"><i class="ph ph-hand-coins me-1"></i>${displayRefName}</span>`;
        } else if (row.assistant_code) {
            referrerHtml = `<span class="badge bg-light text-dark border px-2 py-1" style="font-weight: 500;"><i class="bi bi-person-badge text-primary me-1"></i>${row.assistant_code}</span>`;
        } else {
            referrerHtml = `<span class="text-muted small">- (นัดเอง)</span>`;
        }

        tbody.innerHTML += `<tr>
            <td class="ps-4 fw-bold text-primary">${row.appointment_id}</td>
            <td>${row.appointment_date}</td>
            <td>${row.appointment_time}</td>
            <td class="fw-bold">${row.guest_name}</td>
            <td>${row.guest_phone}</td>
            <td>${referrerHtml}</td>
            <td>${displayReason || '-'}</td>
            <td>${statusBadge}</td>
            <td class="text-center">${actionBtn}</td>
        </tr>`;
    });
}

function openAddAppointmentModal() {
    const form = document.getElementById('appointmentForm');
    if (form) form.reset();
    if (document.getElementById('appointmentEditId')) document.getElementById('appointmentEditId').value = '';
    if (document.getElementById('displayApptId')) document.getElementById('displayApptId').value = generateId('APT');
    
    const title = document.getElementById('addAppointmentModalTitle');
    if (title) title.innerHTML = '<i class="bi bi-calendar-plus text-primary me-2"></i>เพิ่มการนัดหมาย';

    populateReferrerDropdowns();
    toggleApptReferrerField();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('addAppointmentModal')).show();
}

function editAppointment(id) {
    const appt = (allAppointments || []).find(a => a.appointment_id === id);
    if (!appt) return;

    populateReferrerDropdowns();

    const form = document.getElementById('appointmentForm');
    if (document.getElementById('appointmentEditId')) document.getElementById('appointmentEditId').value = appt.appointment_id;
    if (document.getElementById('displayApptId')) document.getElementById('displayApptId').value = appt.appointment_id;
    if (form.guestName) form.guestName.value = appt.guest_name || '';
    if (form.guestPhone) form.guestPhone.value = appt.guest_phone || '';
    if (form.appointmentDate) form.appointmentDate.value = appt.appointment_date || '';
    if (form.appointmentTime) form.appointmentTime.value = appt.appointment_time || '';
    if (form.reason) form.reason.value = appt.reason || '';

    const apptTypeAssisted = document.getElementById('apptTypeAssisted');
    const apptTypeDirect = document.getElementById('apptTypeDirect');
    const refSelect = document.getElementById('apptReferredBySelect');

    if (appt.referred_by || appt.appointment_type === 'assisted') {
        if (apptTypeAssisted) apptTypeAssisted.checked = true;
    } else {
        if (apptTypeDirect) apptTypeDirect.checked = true;
    }

    if (refSelect) refSelect.value = appt.referred_by || '';
    toggleApptReferrerField();

    const title = document.getElementById('addAppointmentModalTitle');
    if (title) title.innerHTML = '<i class="bi bi-pencil-square text-primary me-2"></i>แก้ไขข้อมูลการนัดหมาย';

    bootstrap.Modal.getOrCreateInstance(document.getElementById('addAppointmentModal')).show();
}

async function deleteAppointment(id) {
    const appt = (allAppointments || []).find(a => a.appointment_id === id);
    const displayName = appt ? `${appt.guest_name || 'ไม่ระบุชื่อ'} (${appt.appointment_id})` : id;

    const res = await Swal.fire({
        title: 'ยืนยันการลบนัดหมาย?',
        text: `ต้องการลบรายการนัดหมายของคุณ ${displayName} ออกจากระบบใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ลบข้อมูล',
        cancelButtonText: 'ยกเลิก'
    });

    if (res.isConfirmed) {
        Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            await _supabase.from('appointments').delete().eq('appointment_id', id);
        } catch (e) {
            console.log('Supabase appointment delete fallback');
        }

        allAppointments = allAppointments.filter(a => a.appointment_id !== id);
        if (window.appointmentReferrersMap) {
            delete window.appointmentReferrersMap[id];
            localStorage.setItem('clinic_appointment_referrers', JSON.stringify(window.appointmentReferrersMap));
        }

        loadAppointments();
        Swal.fire('ลบข้อมูลแล้ว', 'ลบรายการนัดหมายเรียบร้อยแล้ว', 'success');
    }
}

function filterAppointments() {
    const q = (document.getElementById('searchAppointmentInput')?.value || '').toLowerCase().trim();
    const dateVal = document.getElementById('appointmentDateFilter')?.value || '';

    let filtered = [...(allAppointments || [])];

    if (dateVal) {
        filtered = filtered.filter(row => row.appointment_date === dateVal);
    }

    if (q) {
        filtered = filtered.filter(row =>
            (row.appointment_id && row.appointment_id.toLowerCase().includes(q)) ||
            (row.guest_name && row.guest_name.toLowerCase().includes(q)) ||
            (row.guest_phone && row.guest_phone.toLowerCase().includes(q)) ||
            (row.assistant_code && row.assistant_code.toLowerCase().includes(q)) ||
            (row.reason && row.reason.toLowerCase().includes(q)) ||
            (row.status && row.status.toLowerCase().includes(q))
        );
    }

    renderAppointmentsTable(filtered, dateVal);
}

function setAppointmentTodayFilter() {
    const todayStr = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('appointmentDateFilter');
    if (dateInput) {
        dateInput.value = todayStr;
    }
    filterAppointments();
}

function clearAppointmentDateFilter() {
    const dateInput = document.getElementById('appointmentDateFilter');
    if (dateInput) {
        dateInput.value = '';
    }
    filterAppointments();
}

window.setAppointmentTodayFilter = setAppointmentTodayFilter;
window.clearAppointmentDateFilter = clearAppointmentDateFilter;

async function loadPatients() {
    const tbody = document.querySelector('#patientsTable tbody');
    if (!tbody) return;

    const { data, error } = await _supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-3">เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-3">ไม่มีข้อมูลผู้ป่วย</td></tr>';
        return;
    }

    // ดึงข้อมูลการเข้าตรวจ (visits) ทั้งหมดเพื่อประมวลผลสถานะการคัดกรองและการชำระเงิน
    let latestVisitMap = {};
    try {
        const { data: visitsData } = await _supabase
            .from('visits')
            .select('*')
            .order('created_at', { ascending: false });

        if (visitsData) {
            visitsData.forEach(v => {
                if (v.hn && !latestVisitMap[v.hn]) {
                    latestVisitMap[v.hn] = v;
                }
            });
        }
    } catch(e) {}

    // Merge fallback จาก LocalStorage
    try {
        const cachedVisits = JSON.parse(localStorage.getItem('clinic_visits_queue') || '[]');
        if (Array.isArray(cachedVisits)) {
            cachedVisits.forEach(v => {
                if (v && v.hn && !latestVisitMap[v.hn]) {
                    latestVisitMap[v.hn] = v;
                }
            });
        }
    } catch(e) {}

    window.patientReferrersMap = JSON.parse(localStorage.getItem('clinic_patient_referrers') || '{}');
    if (data) {
        data.forEach(d => {
            if (!d.referred_by && window.patientReferrersMap[d.hn]) {
                d.referred_by = window.patientReferrersMap[d.hn];
            }
        });
    }

    window.allPatients = data;
    window.latestVisitMap = latestVisitMap;

    // ตั้งค่าเริ่มต้นวันที่กรองทะเบียนผู้ป่วยเป็นวันปัจจุบัน (Today) หากยังไม่ได้เลือก
    const startInput = document.getElementById('patientFilterStartDate');
    const endInput = document.getElementById('patientFilterEndDate');
    if (startInput && endInput && !startInput.value && !endInput.value) {
        const todayStr = new Date().toISOString().split('T')[0];
        startInput.value = todayStr;
        endInput.value = todayStr;
    }
    
    filterPatients();
}

function renderPatientsTable(data) {
    const tbody = document.querySelector('#patientsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-5"><i class="bi bi-search fs-3 d-block mb-2 text-secondary"></i>ไม่พบข้อมูลผู้ป่วย</td></tr>';
        return;
    }

    data.forEach(row => {
        let allergy = (row.allergies || '').trim();
        let allergyBadge = (allergy && allergy !== '-' && allergy !== 'ไม่มี') 
            ? `<span class="badge-soft-danger">${allergy}</span>` 
            : `<span class="badge-soft-success">ไม่มี</span>`;

        let refId = row.referred_by;
        let refHtml = '<span class="text-muted small">-</span>';
        if (refId) {
            const refObj = (window.referrersData || []).find(r => r.id === refId || r.code === refId);
            const staffObj = (window.allStaffUsers || window.defaultTeamStaffUsers || []).find(s => s.emp_code === refId || s.id === refId || s.full_name === refId);
            
            let displayRefName = refId;
            if (refObj) {
                displayRefName = `${refObj.name} (${refObj.code || refObj.id})`;
            } else if (staffObj) {
                displayRefName = `${staffObj.full_name} (${staffObj.emp_code || 'STAFF'})`;
            }
            refHtml = `<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style="font-weight: 500;"><i class="ph ph-hand-coins me-1"></i>${displayRefName}</span>`;
        }

        // ประมวลผลสถานะการคัดกรองและการชำระเงิน ตามความต้องการของผู้ใช้
        const latestVisit = window.latestVisitMap ? window.latestVisitMap[row.hn] : null;
        
        // 1. สถานะการส่งคัดกรอง (Screening Status)
        let triageBadge = '';
        let isSent = !!latestVisit;
        if (isSent) {
            triageBadge = `<span class="badge bg-info-subtle text-info border border-info-subtle px-2 py-1 text-nowrap"><i class="bi bi-check-circle-fill me-1"></i>ส่งคัดกรองแล้ว</span>`;
        } else {
            triageBadge = `<span class="badge bg-secondary-subtle text-secondary border px-2 py-1 text-nowrap"><i class="bi bi-clock me-1"></i>รอส่งคัดกรอง</span>`;
        }

        // 2. สถานะการชำระเงิน (Payment Status) และสถานะการรักษา
        let paymentBadge = '';
        const vStatus = latestVisit ? latestVisit.status : null;
        if (vStatus === 'เสร็จสิ้น' || vStatus === 'รอจัดยา' || vStatus === 'รอจ่ายยา') {
            paymentBadge = `<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 text-nowrap"><i class="bi bi-check-all me-1"></i>ชำระเงินเสร็จสิ้น</span>`;
        } else if (vStatus === 'รอชำระเงิน') {
            paymentBadge = `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1 text-nowrap"><i class="bi bi-hourglass-split me-1"></i>รอชำระเงิน</span>`;
        } else if (vStatus === 'รอคัดกรอง' || vStatus === 'รอตรวจ' || vStatus === 'รอผลแล็บ' || vStatus === 'รอจัดคิว' || vStatus === 'รออ่านผล' || vStatus === 'กำลังคุยกับแพทย์' || vStatus === 'กำลังตรวจ' || vStatus === 'กำลังตรวจอยู่') {
            paymentBadge = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 text-nowrap"><i class="bi bi-activity me-1"></i>กำลังรักษา</span>`;
        } else if (vStatus) {
            paymentBadge = `<span class="badge bg-secondary-subtle text-secondary border px-2 py-1 text-nowrap"><i class="bi bi-clock me-1"></i>${vStatus}</span>`;
        } else {
            paymentBadge = `<span class="badge bg-light text-muted border px-2 py-1 text-nowrap"><i class="bi bi-dash-circle me-1"></i>ยังไม่ชำระเงิน</span>`;
        }

        const statusBadges = `
            <div class="d-flex flex-column align-items-center justify-content-center gap-1">
                ${paymentBadge}
                ${triageBadge}
            </div>
        `;

        let sendBtn = isSent
            ? `<button type="button" class="btn btn-sm btn-secondary text-nowrap" disabled title="ส่งคัดกรองแล้ว">ส่งแล้ว</button>`
            : `<button type="button" class="btn btn-sm btn-primary text-nowrap" onclick="sendToTriage('${row.hn}', '${row.patient_name}')">ส่งเข้าคัดกรอง</button>`;

        let actionBtns = `
            <div class="d-flex gap-1 justify-content-center align-items-center text-nowrap">
                ${sendBtn}
                <button type="button" class="btn btn-sm btn-outline-secondary" onclick="editPatient('${row.hn}')" title="แก้ไขประวัติผู้ป่วย"><i class="bi bi-pencil-square"></i></button>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="deletePatient('${row.hn}')" title="ลบประวัติผู้ป่วย"><i class="bi bi-trash"></i></button>
            </div>
        `;

        tbody.innerHTML += `<tr>
            <td class="ps-4 fw-bold text-nowrap align-middle">${row.hn}</td>
            <td class="fw-bold text-nowrap align-middle">${row.patient_name}</td>
            <td class="text-nowrap align-middle">${row.age || '-'}</td>
            <td class="text-nowrap align-middle">${row.phone || '-'}</td>
            <td class="text-nowrap align-middle">${row.province || row.village || '-'}</td>
            <td class="text-center text-nowrap align-middle">${allergyBadge}</td>
            <td class="text-center text-nowrap align-middle">${refHtml}</td>
            <td class="text-center text-nowrap align-middle">${statusBadges}</td>
            <td class="text-center text-nowrap align-middle">${actionBtns}</td>
        </tr>`;
    });
}

function filterPatients() {
    if (!window.allPatients) return;
    
    let filtered = window.allPatients;
    
    // Filter by Date
    const startDateStr = document.getElementById('patientFilterStartDate')?.value;
    const endDateStr = document.getElementById('patientFilterEndDate')?.value;
    
    if (startDateStr || endDateStr) {
        filtered = filtered.filter(row => {
            if (!row.created_at) return true;
            const rowDate = new Date(row.created_at).toISOString().split('T')[0];
            
            let pass = true;
            if (startDateStr && rowDate < startDateStr) pass = false;
            if (endDateStr && rowDate > endDateStr) pass = false;
            return pass;
        });
    }
    
    // Filter by Search Input
    const q = (document.getElementById('patientSearchInput')?.value || '').toLowerCase().trim();
    if (q) {
        filtered = filtered.filter(row => 
            (row.hn && row.hn.toLowerCase().includes(q)) ||
            (row.patient_name && row.patient_name.toLowerCase().includes(q)) ||
            (row.phone && row.phone.toLowerCase().includes(q)) ||
            (row.province && row.province.toLowerCase().includes(q)) ||
            (row.village && row.village.toLowerCase().includes(q)) ||
            (row.allergies && row.allergies.toLowerCase().includes(q)) ||
            (row.referred_by && row.referred_by.toLowerCase().includes(q))
        );
    }
    
    const tbody = document.querySelector('#patientsTable tbody');
    if (tbody && (!filtered || filtered.length === 0)) {
        if (startDateStr || endDateStr) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4"><i class="bi bi-calendar-x text-warning me-2 fs-5"></i>ไม่พบข้อมูลผู้ป่วยลงทะเบียนในช่วงวันที่เลือก <button type="button" class="btn btn-sm btn-link text-primary text-decoration-none fw-semibold p-0 ms-2" onclick="clearPatientDateFilter()">ดูทั้งหมด</button></td></tr>`;
            return;
        }
    }

    renderPatientsTable(filtered);
}

function setPatientTodayFilter() {
    const todayStr = new Date().toISOString().split('T')[0];
    const startInput = document.getElementById('patientFilterStartDate');
    const endInput = document.getElementById('patientFilterEndDate');
    if (startInput) startInput.value = todayStr;
    if (endInput) endInput.value = todayStr;
    filterPatients();
}

function clearPatientDateFilter() {
    const startInput = document.getElementById('patientFilterStartDate');
    const endInput = document.getElementById('patientFilterEndDate');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    filterPatients();
}

window.setPatientTodayFilter = setPatientTodayFilter;
window.clearPatientDateFilter = clearPatientDateFilter;

const LAOS_ADDRESS_DATA = {
    "ນະຄອນຫຼວງວຽງຈັນ": [
        "ເມືອງຈັນທະບູລີ", "ເມືອງສີໂຄດຕະບອງ", "ເມືອງໄຊເສດຖາ", "ເມືອງສີສັດຕະນາກ", 
        "ເມືອງນາຊາຍທອງ", "ເມືອງໄຊທານີ", "ເມືອງຮາດຊາຍຟອງ", "ເມືອງສັງທອງ", "ເມືອງປາກງື່ມ"
    ],
    "ແຂວງຜົ້ງສາລີ": [
        "ເມືອງຜົ້ງສາລີ", "ເມືອງໃໝ່", "ເມືອງຂວາ", "ເມືອງສຳພັນ", "ເມືອງບຸນເນື້ອ", "ເມືອງຍອດອູ", "ເມືອງບຸນໃຕ້"
    ],
    "ແຂວງຫຼວງນ້ຳທາ": [
        "ເມືອງຫຼວງນ້ຳທາ", "ເມືອງສິງ", "ເມືອງລອງ", "ເມືອງວຽງພູຄາ", "ເມືອງນາແລ"
    ],
    "ແຂວງອຸດົມໄຊ": [
        "ເມືອງໄຊ", "ເມືອງຫຼາ", "ເມືອງນາໝໍ້", "ເມືອງງາ", "ເມືອງແບ່ງ", "ເມືອງຮຸນ", "ເມືອງປາກແບ່ງ"
    ],
    "ແຂວງບໍ່ແກ້ວ": [
        "ເມືອງຫ້ວຍຊາຍ", "ເມືອງຕົ້ນເຜິ້ງ", "ເມືອງເມິງ", "ເມືອງຜາອຸດົມ", "ເມືອງປາກທາ"
    ],
    "ແຂວງຫຼວງພະບາງ": [
        "ນະຄອນຫຼວງພະບາງ", "ເມືອງຊຽງເງິນ", "ເມືອງນານ", "ເມືອງປາກອູ", "ເມືອງນ້ຳບາກ", 
        "ເມືອງງອຍ", "ເມືອງປາກແຊງ", "ເມືອງໂພນໄຊ", "ເມືອງຈອມເພັດ", "ເມືອງວຽງຄຳ", "ເມືອງພູຄູນ", "ເມືອງໂພນທອງ"
    ],
    "ແຂວງຫົວພັນ": [
        "ເມືອງຊຳເໜືອ", "ເມືອງຊຽງຄໍ້", "ເມືອງເວີນໄຊ", "ເມືອງວຽງໄຊ", "ເມືອງຊຳໃຕ້", 
        "ເມືອງຫົວເມືອງ", "ເມືອງແອດ", "ເມືອງໂສບເບົາ", "ເມືອງພັນທອງ", "ເມືອງກວັນ"
    ],
    "ແຂວງໄຊຍະບູລີ": [
        "ເມືອງໄຊຍະບູລີ", "ເມືອງຄອບ", "ເມືອງຫົງສາ", "ເມືອງເງິນ", "ເມືອງຊຽງຮ່ອນ", 
        "ເມືອງພຽງ", "ເມືອງປາກລາຍ", "ເມືອງແກ່ນທ້າວ", "ເມືອງບໍ່ແຕນ", "ເມືອງທົ່ງມີໄຊ", "ເມືອງໄຊສະຖານ"
    ],
    "ແຂວງຊຽງຂວາງ": [
        "ເມືອງແປກ (ໂພນສະຫວັນ)", "ເມືອງຄຳ", "ເມືອງໜອງແຮດ", "ເມືອງຄູນ", "ເມືອງໝອກໄໝ່", "ເມືອງພູກູດ", "ເມືອງຜາໄຊ"
    ],
    "ແຂວງວຽງຈັນ": [
        "ເມືອງໂພນໂຮງ", "ເມືອງທຸລະຄົມ", "ເມືອງແກ້ວອຸດົມ", "ເມືອງກາສີ", "ເມືອງວັງວຽງ", 
        "ເມືອງເຟືອງ", "ເມືອງຊະນະຄາມ", "ເມືອງແມດ", "ເມືອງວຽງຄຳ", "ເມືອງຫີນເຫີບ", "ເມືອງໝື່ນ"
    ],
    "ແຂວງບໍລິຄຳໄຊ": [
        "ເມືອງປາກຊັນ", "ເມືອງທ່າພະບາດ", "ເມືອງປາກກະດິງ", "ເມືອງບໍລິຄັນ", "ເມືອງຄຳເກີດ", "ເມືອງວຽງທອງ", "ເມືອງໄຊຈຳພອນ"
    ],
    "ແຂວງຄຳມ່ວນ": [
        "ເມືອງທ່າແຂກ", "ເມືອງມະຫາໄຊ", "ເມືອງໜອງບົກ", "ເມືອງຫີນບູນ", "ເມືອງຍົມມະລາດ", 
        "ເມືອງບົວລະພາ", "ເມືອງນາກາຍ", "ເມືອງເຊບັ້ງໄຟ", "ເມືອງໄຊບົວທອງ", "ເມືອງຄູນຄຳ"
    ],
    "ແຂວງສະຫວັນນະເຂດ": [
        "ນະຄອນໄກສອນ ພົມວິຫານ", "ເມືອງອຸທຸມພອນ", "ເມືອງອາສະພັງທອງ", "ເມືອງພີນ", "ເມືອງເຊໂປນ", 
        "ເມືອງນອງ", "ເມືອງທ່າປາງທອງ", "ເມືອງຈຳພອນ", "ເມືອງຊົນນະບູລີ", "ເມືອງໄຊບູລີ", 
        "ເມືອງວີລະບູລີ", "ເມືອງອາສະພອນ", "ເມືອງໄຊພູທອງ", "ເມືອງພະລານໄຊ", "ເມືອງສອງຄອນ"
    ],
    "ແຂວງໄຊສົມບູນ": [
        "ເມືອງອນຸວົງ", "ເມືອງທ່າໂທມ", "ເມືອງລ້ອງຊານ", "ເມືອງຮົມ", "ເມືອງລ້ອງແຈ້ງ"
    ],
    "ແຂວງສາລະວັນ": [
        "ເມືອງສາລະວັນ", "ເມືອງຕະໂອ້ຍ", "ເມືອງຕຸ້ມລານ", "ເມືອງລະຄອນເພັງ", "ເມືອງວາປີ", "ເມືອງຄົງເຊໂດນ", "ເມືອງເລົ່າງາມ", "ເມືອງສະໝ້ວຍ"
    ],
    "ແຂວງເຊກອງ": [
        "ເມືອງລະມາມ", "ເມືອງກະເລິມ", "ເມືອງດັກຈຶງ", "ເມືອງທ່າແຕງ"
    ],
    "ແຂວງຈຳປາສັກ": [
        "ນະຄອນປາກເຊ", "ເມືອງຊະນະສົມບູນ", "ເມືອງບາຈຽງເຈີນສຸກ", "ເມືອງປາກຊ່ອງ", "ເມືອງປະທຸມພອນ", 
        "ເມືອງໂພນທອງ", "ເມືອງຈຳປາສັກ", "ເມືອງສຸຂຸມາ", "ເມືອງມູນລະປະໂມກ", "ເມືອງໂຂງ"
    ],
    "ແຂວງອັດຕະປື": [
        "ເມືອງສາມັກຄີໄຊ", "ເມືອງໄຊເສດຖາ", "ເມືອງສະໜາມໄຊ", "ເມືອງສານໄຊ", "ເມືອງພູວົງ"
    ]
};

function populateProvinceDropdown() {
    const provSelect = document.getElementById('patientProvinceSelect');
    if (!provSelect) return;

    let html = '<option value="">-- เลือกແຂວງ / จังหวัด --</option>';
    let index = 1;
    for (const prov in LAOS_ADDRESS_DATA) {
        html += `<option value="${prov}">${index}. ${prov}</option>`;
        index++;
    }
    provSelect.innerHTML = html;
}

function onPatientProvinceChange(targetDistrictVal = null) {
    const provSelect = document.getElementById('patientProvinceSelect');
    const distSelect = document.getElementById('patientDistrictSelect');
    if (!provSelect || !distSelect) return;

    const selectedProv = provSelect.value;
    if (!selectedProv || !LAOS_ADDRESS_DATA[selectedProv]) {
        distSelect.innerHTML = '<option value="">-- กรุณาเลือกແຂວງ / จังหวัดก่อน --</option>';
        distSelect.disabled = true;
        distSelect.value = '';
        return;
    }

    const districts = LAOS_ADDRESS_DATA[selectedProv];
    let html = '<option value="">-- เลือกເມືອງ / ตำบล --</option>';
    districts.forEach(d => {
        html += `<option value="${d}">${d}</option>`;
    });
    distSelect.innerHTML = html;
    distSelect.disabled = false;

    if (targetDistrictVal) {
        distSelect.value = targetDistrictVal;
    }
}

function openAddPatientModal() {
    const form = document.getElementById('patientForm');
    if (form) form.reset();
    if (document.getElementById('patientEditHn')) document.getElementById('patientEditHn').value = '';
    if (document.getElementById('linkAppointmentId')) document.getElementById('linkAppointmentId').value = '';

    const title = document.getElementById('addPatientModalTitle');
    if (title) title.innerHTML = 'เพิ่มประวัติผู้ป่วยใหม่';

    populateProvinceDropdown();
    onPatientProvinceChange();
    populateReferrerDropdowns();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('addPatientModal')).show();
}

function editPatient(hn) {
    const p = (window.allPatients || []).find(x => x.hn === hn);
    if (!p) return;

    populateProvinceDropdown();
    populateReferrerDropdowns();

    const form = document.getElementById('patientForm');
    if (document.getElementById('patientEditHn')) document.getElementById('patientEditHn').value = p.hn;
    if (document.getElementById('linkAppointmentId')) document.getElementById('linkAppointmentId').value = '';

    if (form.FullName) form.FullName.value = p.patient_name || '';
    if (form.DOB) form.DOB.value = p.dob || '';
    if (form.Age) form.Age.value = p.age || '';
    if (form.Village) form.Village.value = p.village || '';
    if (form.Job) form.Job.value = p.job || '';
    if (form.Tel) form.Tel.value = p.phone || '';
    if (form.EmergencyTel) form.EmergencyTel.value = p.emergency_tel || '';
    if (form.PastHistory) form.PastHistory.value = p.past_history || '';
    if (form.Allergies) form.Allergies.value = p.allergies || '';

    const provSelect = document.getElementById('patientProvinceSelect');
    if (provSelect && p.province) {
        let savedProv = p.province.trim();
        provSelect.value = savedProv;
        
        // Fallback: If exact match fails, try partial matching
        if (!provSelect.value) {
            for (let i = 0; i < provSelect.options.length; i++) {
                let optVal = provSelect.options[i].value;
                if (optVal && (optVal.includes(savedProv) || savedProv.includes(optVal))) {
                    provSelect.value = optVal;
                    break;
                }
            }
        }
        
        onPatientProvinceChange(p.district ? p.district.trim() : null);
        
        // Fallback for district partial matching
        const distSelect = document.getElementById('patientDistrictSelect');
        if (p.district && (!distSelect.value || distSelect.value === '')) {
             let savedDist = p.district.trim();
             for (let i = 0; i < distSelect.options.length; i++) {
                let optVal = distSelect.options[i].value;
                if (optVal && (optVal.includes(savedDist) || savedDist.includes(optVal))) {
                    distSelect.value = optVal;
                    break;
                }
            }
        }
    } else {
        onPatientProvinceChange();
    }

    const refSelect = document.getElementById('patientReferredBySelect');
    if (refSelect) refSelect.value = p.referred_by || '';

    const title = document.getElementById('addPatientModalTitle');
    if (title) title.innerHTML = `<i class="bi bi-pencil-square text-primary me-2"></i>แก้ไขประวัติผู้ป่วย (${p.hn})`;

    bootstrap.Modal.getOrCreateInstance(document.getElementById('addPatientModal')).show();
}

async function deletePatient(hn) {
    const p = (window.allPatients || []).find(x => x.hn === hn);
    const displayName = p ? `${p.patient_name} (${hn})` : hn;

    const res = await Swal.fire({
        title: 'ยืนยันการลบประวัติผู้ป่วย?',
        text: `ต้องการลบประวัติผู้ป่วยของคุณ ${displayName} ออกจากระบบใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ลบข้อมูล',
        cancelButtonText: 'ยกเลิก'
    });

    if (res.isConfirmed) {
        Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            await _supabase.from('patients').delete().eq('hn', hn);
        } catch (e) {
            console.log('Supabase patient delete fallback');
        }

        if (window.allPatients) {
            window.allPatients = window.allPatients.filter(x => x.hn !== hn);
        }
        if (window.patientReferrersMap) {
            delete window.patientReferrersMap[hn];
            localStorage.setItem('clinic_patient_referrers', JSON.stringify(window.patientReferrersMap));
        }

        loadPatients();
        Swal.fire('ลบข้อมูลแล้ว', 'ลบประวัติผู้ป่วยเรียบร้อยแล้ว', 'success');
    }
}

async function loadTriage() {
    const tbody = document.querySelector('#triageTable tbody');
    if (!tbody) return;

    const { data, error } = await _supabase
        .from('visits')
        .select('*')
        .eq('status', 'รอคัดกรอง')
        .order('created_at', { ascending: true });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-3">เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">ยังไม่มีผู้ป่วยรอคัดกรอง</td></tr>';
        return;
    }

    data.forEach(row => {
        tbody.innerHTML += `<tr><td class="ps-4 fw-bold">${row.visit_id}</td><td><div class="fw-bold text-dark">${row.patient_name}</div><div class="text-muted small">HN: ${row.hn}</div></td><td class="text-end pe-4"><button class="btn btn-sm btn-primary px-3" onclick="openTriageModal('${row.visit_id}')">ซักประวัติ</button></td></tr>`;
    });
}

async function loadDoctorQueue() {
    const tbody = document.querySelector('#doctorTable tbody');
    if (!tbody) return;

    const { data, error } = await _supabase
        .from('visits')
        .select('*')
        .eq('status', 'รอตรวจ')
        .order('created_at', { ascending: true });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">ไม่มีผู้ป่วยรอตรวจ</td></tr>';
        return;
    }

    data.forEach(row => {
        let vitals = `ความดัน: ${row.bp || '-'}, นน.: ${row.weight || '-'} กก., อุณหภูมิ: ${row.temp || '-'}°C`;
        tbody.innerHTML += `<tr><td class="ps-4 fw-bold">${row.visit_id}</td><td><div class="fw-bold text-dark">${row.patient_name}</div><div class="text-muted small">อาการ: <span class="text-danger">${row.symptom || '-'}</span></div></td><td class="text-muted small">${vitals}</td><td class="text-end pe-4"><button class="btn btn-sm btn-outline-primary me-2" onclick="openLabOrder('${row.visit_id}', '${row.patient_name}', '${row.hn}')"><i class="bi bi-virus"></i> สั่ง Lab</button><button class="btn btn-sm btn-success px-3" onclick="completeDoctorCheck('${row.visit_id}')"><i class="bi bi-check-circle me-1"></i>ตรวจเสร็จ</button></td></tr>`;
    });
}

async function completeDoctorCheck(visitId) {
    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const { error } = await _supabase
        .from('visits')
        .update({ status: 'เสร็จสิ้น' })
        .eq('visit_id', visitId);

    if (error) {
        Swal.fire('ข้อผิดพลาด', error.message, 'error');
    } else {
        Swal.fire('สำเร็จ', 'ตรวจเสร็จเรียบร้อย', 'success');
        loadDoctorQueue();
        if (typeof loadPatients === 'function') loadPatients();
    }
}

async function loadPaymentQueue() {
    const tbody = document.querySelector('#paymentTable tbody');
    if (!tbody) return;

    const { data, error } = await _supabase
        .from('visits')
        .select('*')
        .eq('status', 'รอชำระเงิน')
        .order('created_at', { ascending: true });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">ไม่มีรายการรอชำระเงิน</td></tr>';
        return;
    }

    data.forEach(row => {
        const testCount = row.lab_tests ? row.lab_tests.split(',').filter(Boolean).length : 0;
        const safeTests = (row.lab_tests || '').replace(/'/g, "\\'");
        const safeName = (row.patient_name || '').replace(/'/g, "\\'");
        let labDetailsHtml = `<button class="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 fw-semibold" onclick="showPaymentDetails('${row.visit_id}', '${row.hn || ''}', '${safeName}', '${safeTests}', ${row.discount || row.lab_discount || 0})"><i class="bi bi-credit-card me-1"></i> ดูรายละเอียด (${testCount} รายการ)</button>`;
        tbody.innerHTML += `<tr><td class="ps-4 fw-bold text-primary">${row.visit_id}</td><td>${row.hn}</td><td class="fw-bold">${row.patient_name}</td><td>${labDetailsHtml}</td><td><span class="badge-soft-warning">รอชำระเงิน</span></td><td class="text-center"><button class="btn btn-sm btn-success rounded-pill px-3" onclick="confirmPayment('${row.visit_id}')"><i class="bi bi-check-circle me-1"></i> ยืนยันจ่าย & ส่ง Lab</button></td></tr>`;
    });
}

// ฟังก์ชันยืนยันการชำระเงินและส่งผู้ป่วยไป Lab
async function confirmPayment(visitId) {
    const result = await Swal.fire({
        title: 'ยืนยันการชำระเงิน?',
        text: `ต้องการยืนยันชำระเงินและส่งผู้ป่วยเคส ${visitId} ไปห้อง Lab ใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ยืนยันจ่าย & ส่ง Lab',
        cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const { error } = await _supabase
        .from('visits')
        .update({ status: 'รอผลแล็บ' })
        .eq('visit_id', visitId);

    if (error) {
        Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
    } else {
        // บันทึก Bill อัตโนมัติหลังยืนยันชำระเงิน
        if (typeof saveBill === 'function') {
            try { await saveBill(visitId); } catch(e) { console.warn('saveBill error:', e); }
        }
        if (typeof loadBills === 'function') {
            loadBills();
        }
        if (typeof processPaymentCommission === 'function') {
            await processPaymentCommission(visitId);
        }
        Swal.fire('สำเร็จ', 'ยืนยันชำระเงินและส่งผู้ป่วยไปห้อง Lab เรียบร้อยแล้ว', 'success');
        loadPaymentQueue();
        if (typeof loadLabQueue === 'function') loadLabQueue();
        if (typeof loadPatients === 'function') loadPatients();
    }
}

async function loadLabQueue() {
    const tbody = document.querySelector('#labTable tbody');
    if (!tbody) return;

    const { data, error } = await _supabase
        .from('visits')
        .select('*')
        .eq('status', 'รอผลแล็บ')
        .order('created_at', { ascending: true });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">ไม่มีรายการรอตรวจ Lab</td></tr>';
        return;
    }

    data.forEach(row => {
        const testCount = row.lab_tests ? row.lab_tests.split(',').filter(Boolean).length : 0;
        const safeTests = (row.lab_tests || '').replace(/'/g, "\\'");
        const safeName = (row.patient_name || '').replace(/'/g, "\\'");
        let labDetailsHtml = `<button class="btn btn-sm btn-light border" onclick="showLabDetails('${row.visit_id}', '${row.hn || ''}', '${safeName}', '${safeTests}')"><i class="ph ph-flask text-primary me-1"></i> รายการส่งแล็บ (${testCount} รายการ)</button>`;
        tbody.innerHTML += `<tr><td class="ps-4 fw-bold text-primary">${row.visit_id}</td><td>${row.hn}</td><td class="fw-bold">${row.patient_name}</td><td>${labDetailsHtml}</td><td><span class="badge-soft-warning">รอผลแล็บ</span></td><td class="text-center"><button class="btn btn-sm btn-primary px-3" onclick="openLabUploadModal('${row.visit_id}')"><i class="bi bi-upload"></i> อัปโหลดผล</button></td></tr>`;
    });
}

async function loadQueueList() {
    const tbody = document.querySelector('#queueTable tbody');
    if (!tbody) return;

    const queueRes = await _supabase
        .from('visits')
        .select('*')
        .eq('status', 'รอจัดคิว')
        .order('created_at', { ascending: true });

    // ดึงข้อมูลแพทย์จาก staff_users หรือ staff
    let doctors = [];
    try {
        const docUsersRes = await _supabase
            .from('staff_users')
            .select('*')
            .in('role', ['doctor', 'แพทย์']);
        
        if (docUsersRes.data && docUsersRes.data.length > 0) {
            doctors = docUsersRes.data.map(d => ({
                name: d.full_name || d.emp_code || d.email,
                is_busy: false
            }));
        } else {
            const docOldRes = await _supabase
                .from('staff')
                .select('*')
                .eq('role', 'แพทย์');
            doctors = docOldRes.data || [];
        }
    } catch (e) {
        console.warn('Error fetching doctors from staff_users:', e);
    }

    tbody.innerHTML = '';
    if (queueRes.error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-5">เกิดข้อผิดพลาด: ${queueRes.error.message}</td></tr>`;
        return;
    }

    const queue = queueRes.data;

    if (!queue || queue.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-5">ไม่มีรายการรอจัดคิว</td></tr>';
        return;
    }

    // ดึงข้อมูลการเข้าตรวจที่กำลังดำเนินการอยู่เพื่อตรวจสอบสถานะแพทย์ในเวลาจริง (Real-Time Doctor Status)
    const { data: activeVisits } = await _supabase
        .from('visits')
        .select('doctor_name, status')
        .in('status', ['กำลังคุยกับแพทย์', 'กำลังตรวจ', 'กำลังตรวจอยู่', 'รออ่านผล']);

    const busyDoctorMap = {};
    if (activeVisits) {
        activeVisits.forEach(v => {
            if (v.doctor_name) {
                if (!busyDoctorMap[v.doctor_name] || v.status === 'กำลังคุยกับแพทย์' || v.status === 'กำลังตรวจอยู่') {
                    busyDoctorMap[v.doctor_name] = v.status;
                }
            }
        });
    }

    let docOptions = `<option value="">-- เลือกแพทย์ --</option>`;
    if (doctors && doctors.length > 0) {
        doctors.forEach(doc => {
            const docStatus = busyDoctorMap[doc.name];
            let statusText = "🟢 ว่าง";
            if (docStatus === 'กำลังคุยกับแพทย์' || docStatus === 'กำลังตรวจ' || docStatus === 'กำลังตรวจอยู่') {
                statusText = "🔴 ไม่ว่าง (กำลังคุยกับผู้ป่วย)";
            } else if (docStatus === 'รออ่านผล') {
                statusText = "🟡 มีคิวรออ่านผล";
            } else if (doc.is_busy) {
                statusText = "🔴 ติดเคส";
            }

            docOptions += `<option value="${doc.name}">${doc.name} ( ${statusText} )</option>`;
        });
    } else {
        docOptions += `<option value="">กรุณาเพิ่มแพทย์ในระบบ</option>`;
    }

    queue.forEach(row => {
        let selectHtml = `<select id="select-doc-${row.visit_id}" class="form-select form-select-sm d-inline-block w-auto mb-1">${docOptions}</select>`;
        tbody.innerHTML += `<tr>
        <td class="ps-4 py-3 fw-bold text-primary">${row.visit_id}</td>
        <td class="py-3">${row.hn}</td>
        <td class="py-3 fw-bold text-dark">${row.patient_name}</td>
        <td class="py-3">
            ${selectHtml}
        </td>
        <td class="text-center py-3">
            <button class="btn btn-sm btn-primary ms-1" onclick="sendToPrescriptionWithDoc('${row.visit_id}')">ส่งห้องอ่านผล</button>
        </td>
      </tr>`;
    });
}

async function sendToPrescriptionWithDoc(visitId) {
    const selectedDoc = document.getElementById(`select-doc-${visitId}`).value;
    if (!selectedDoc) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกแพทย์ที่ต้องการส่งตรวจ', 'warning'); return; }

    Swal.fire({ title: 'กำลังจัดคิว...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const { error } = await _supabase
        .from('visits')
        .update({ doctor_name: selectedDoc, status: 'รออ่านผล' })
        .eq('visit_id', visitId);

    if (error) {
        Swal.fire('ข้อผิดพลาด', error.message, 'error');
    } else {
        Swal.fire('สำเร็จ', `ส่งคิวให้ ${selectedDoc} เรียบร้อยแล้ว`, 'success');
        loadQueueList();
        loadPrescriptionList();
    }
}

async function loadPrescriptionList() {
    const tbody = document.querySelector('#prescriptionTable tbody');
    if (!tbody) return;

    const { data, error } = await _supabase
        .from('visits')
        .select('*')
        .in('status', ['รออ่านผล', 'กำลังคุยกับแพทย์'])
        .order('created_at', { ascending: true });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-5">เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">ไม่มีรายการรออ่านผล</td></tr>';
        return;
    }

    data.forEach(row => {
        let statusBadge = '';
        let actionBtn = '';

        if (row.status === 'รออ่านผล') {
            statusBadge = `<span class="badge-soft-warning">รอเรียกพบ</span>`;
            actionBtn = `<button class="btn btn-sm btn-warning fw-bold px-3 text-white" onclick="startDoctorConsult('${row.visit_id}')"><i class="bi bi-megaphone me-1"></i>เรียกพบคนไข้</button>`;
        } else if (row.status === 'กำลังคุยกับแพทย์') {
            statusBadge = `<span class="badge-soft-danger">กำลังตรวจอยู่</span>`;
            actionBtn = `<button class="btn btn-sm btn-success px-3" onclick="openPrescribeModal('${row.visit_id}', '${row.hn}', '${row.patient_name}', '${row.pdf_url}')"><i class="bi bi-file-earmark-medical me-1"></i>อ่านผล & สั่งยา</button>`;
        }

        tbody.innerHTML += `
        <tr>
           <td class="ps-4 py-3 fw-bold text-primary">${row.visit_id}</td>
           <td class="py-3">${row.hn}</td>
           <td class="py-3 fw-bold text-dark">${row.patient_name}</td>
           <td class="py-3 fw-bold text-info"><i class="bi bi-person-workspace text-primary"></i> ${row.doctor_name || '-'}</td>
           <td class="py-3">${statusBadge}</td>
           <td class="text-center py-3">${actionBtn}</td>
        </tr>`;
    });
}

async function startDoctorConsult(visitId) {
    Swal.fire({ title: 'กำลังประมวลผล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const { error } = await _supabase
        .from('visits')
        .update({ status: 'กำลังคุยกับแพทย์' })
        .eq('visit_id', visitId);

    if (error) {
        Swal.fire('ข้อผิดพลาด', error.message, 'error');
    } else {
        Swal.fire('สำเร็จ', 'เรียกพบคนไข้แล้ว สถานะของท่านจะเปลี่ยนเป็นกำลังตรวจ', 'success');
        loadPrescriptionList();
        loadQueueList();
    }
}

async function loadMedicines() {
    const localMeds = localStorage.getItem('clinic_medicines');
    if (localMeds) {
        try {
            window.allMedicines = JSON.parse(localMeds);
        } catch(e){}
    }

    if (!window.allMedicines || window.allMedicines.length === 0) {
        window.allMedicines = [
            { id: 'MED-001', name: 'Paracetamol 500mg', category: 'ยาพาราเซตามอล / ยาแก้ปวดลดไข้', unit: 'เม็ด', price: 2000 },
            { id: 'MED-002', name: 'Amoxicillin 500mg', category: 'ยาฆ่าเชื้อ / ยาปฏิชีวนะ', unit: 'แคปซูล', price: 5000 },
            { id: 'MED-003', name: 'Cetirizine 10mg', category: 'ยาแก้แพ้ / ยาลดน้ำมูก', unit: 'เม็ด', price: 3000 }
        ];
        try { localStorage.setItem('clinic_medicines', JSON.stringify(window.allMedicines)); } catch(e){}
    }

    // Reset ตัวเลือกหมวดหมู่ให้เป็น "ทั้งหมด" เมื่อเริ่มโหลด
    const catSelect = document.getElementById('rxCategorySelect');
    if (catSelect) catSelect.value = 'all';

    // เรียกฟังก์ชันฟิลเตอร์เพื่อวาดรายการเริ่มต้น
    filterMedsByCategory();
}

function filterMedsByCategory() {
    const catSelect = document.getElementById('rxCategorySelect');
    const medSelect = document.getElementById('rxMedSelect');
    if (!catSelect || !medSelect || !window.allMedicines) return;

    const selectedCat = catSelect.value;
    let filtered = [];

    if (selectedCat === 'all') {
        filtered = window.allMedicines;
    } else if (selectedCat === 'ยา') {
        filtered = window.allMedicines.filter(item => !item.type || item.type === 'ยา');
    } else if (selectedCat === 'อาหารเสริม') {
        filtered = window.allMedicines.filter(item => item.type === 'อาหารเสริม');
    }

    let html = '<option value="">-- เลือกรายการยา/อาหารเสริม --</option>';

    const meds = filtered.filter(item => !item.type || item.type === 'ยา');
    const supps = filtered.filter(item => item.type === 'อาหารเสริม');

    if (meds.length > 0) {
        html += '<optgroup label="💊 ยารักษาโรค (Medicines)">';
        meds.forEach(med => {
            html += `<option value="${med.id}">${med.name}</option>`;
        });
        html += '</optgroup>';
    }

    if (supps.length > 0) {
        html += '<optgroup label="🍃 อาหารเสริม (Supplements)">';
        supps.forEach(supp => {
            html += `<option value="${supp.id}">${supp.name}</option>`;
        });
        html += '</optgroup>';
    }

    medSelect.innerHTML = html;
    onMedSelectChange(); // อัปเดตราคาปุ่มกดตัวเลือกให้สอดคล้องกัน
}

function onMedSelectChange() {
    const medSelect = document.getElementById('rxMedSelect');
    const tierSelect = document.getElementById('rxPriceTierSelect');
    if (!medSelect || !tierSelect) return;

    const medId = medSelect.value;
    if (!medId) {
        tierSelect.innerHTML = `
            <option value="normal">ราคาปกติ</option>
            <option value="promo">ราคาโปร</option>
            <option value="high">ราคาส่ง/สมาชิก</option>
            <option value="free">แถมฟรี</option>
        `;
        return;
    }

    const med = (window.allMedicines || []).find(m => m.id === medId);
    if (!med) return;

    const priceNormal = med.price_normal || med.price || 0;
    const pricePromo = med.price_promo || 0;
    const priceHigh = med.price_high || 0;

    let optionsHtml = `
        <option value="normal">ราคาปกติ (${priceNormal}฿)</option>
        <option value="promo">ราคาโปร (${pricePromo}฿)</option>
        <option value="high">ราคาส่ง/สมาชิก (${priceHigh}฿)</option>
    `;

    if (med.is_free_gift) {
        optionsHtml += `<option value="free">แถมฟรี (0฿)</option>`;
    } else {
        optionsHtml += `<option value="free" disabled class="text-muted">แถมฟรี (ไม่อนุญาต)</option>`;
    }

    tierSelect.innerHTML = optionsHtml;
}

function updateLabDiscountCalc(totalPrice) {
    const input = document.getElementById('labDiscountInput');
    const display = document.getElementById('modalLabNetPriceDisplay');
    if (!input || !display) return;

    let discount = parseFloat(input.value) || 0;
    if (discount < 0) discount = 0;

    const netPrice = Math.max(0, totalPrice - discount);
    display.textContent = netPrice.toLocaleString() + ' LAK';
}

async function saveLabDiscountAndClose(visitId) {
    const input = document.getElementById('labDiscountInput');
    const discountVal = input ? (parseFloat(input.value) || 0) : 0;

    if (visitId && visitId !== '-' && visitId !== '') {
        const { error } = await _supabase
            .from('visits')
            .update({ discount: discountVal, lab_discount: discountVal })
            .eq('visit_id', visitId);

        if (error) {
            console.warn('Update discount error:', error.message);
        } else {
            if (typeof loadPaymentQueue === 'function') loadPaymentQueue();
            if (typeof loadLabQueue === 'function') loadLabQueue();
        }
    }
    Swal.close();
}

// ฟังก์ชั่นช่วยดึงรายละเอียดรายการตรวจ และรายการย่อยในแพ็กเกจ (Package Sub-Items)
function getTestItemDetails(testStr) {
    const cleanTest = (testStr || '').trim();
    if (!cleanTest) {
        return { name: '-', price: 0, isPackage: false, subItems: [] };
    }

    const testNameLower = cleanTest.toLowerCase();
    const services = window.allServicesData || window.servicesData || [];

    // หาก testStr มีจุลภาคคั่นหลายรายการ (เช่น "T4,TSH") และไม่เจอรายการเดี่ยวแบบตรงเป๊ะ ให้แยกแมปแต่ละตัวแล้วนำมารวมกัน
    if (cleanTest.includes(',') && !services.some(s => s && s.name && s.name.trim().toLowerCase() === testNameLower)) {
        const parts = cleanTest.split(',').map(p => p.trim()).filter(Boolean);
        let totalPrice = 0;
        let packageFound = false;
        let combinedSubItems = [];

        parts.forEach(part => {
            const subDetail = getTestItemDetails(part);
            totalPrice += subDetail.price;
            if (subDetail.isPackage) {
                packageFound = true;
                combinedSubItems = combinedSubItems.concat(subDetail.subItems);
            }
        });

        return {
            name: cleanTest,
            price: totalPrice > 0 ? totalPrice : (parts.length * 150000),
            isPackage: packageFound,
            subItems: combinedSubItems
        };
    }

    // 1. ตรงเป๊ะ (exact)
    let match = services.find(s => s && s.name && s.name.trim().toLowerCase() === testNameLower);

    // 2. ชื่อรายการตรวจมีชื่อย่ออยู่ด้านท้าย หรือตรงบางส่วน
    if (!match) {
        match = services.find(s => {
            if (!s || !s.name) return false;
            const sLower = s.name.trim().toLowerCase();
            return sLower.includes(testNameLower) || testNameLower.includes(sLower);
        });
    }

    // 3. แยกคำ แล้วตรวจดูว่ามีคำไหนตรงกันบ้าง (word match)
    if (!match && testNameLower.length >= 2) {
        match = services.find(s => {
            if (!s || !s.name) return false;
            const sLower = s.name.trim().toLowerCase();
            const words = testNameLower.split(/[\s\-\/\(\)]+/).filter(w => w.length >= 2);
            return words.some(w => sLower.includes(w));
        });
    }

    let isPackage = match && match.sub_items && Array.isArray(match.sub_items) && match.sub_items.length > 0;
    let subItems = isPackage ? match.sub_items : [];

    // Fallback แพ็กเกจรวม
    if (!isPackage && (testNameLower.includes('วงจอม') || testNameLower.includes('วงจร') || testNameLower.includes('ครบ') || testNameLower.includes('package') || testNameLower.includes('แพ็ค') || testNameLower.includes('แพ็ก'))) {
        isPackage = true;
        subItems = [
            { name: 'ความสมบูรณ์ของเม็ดเลือด (CBC - Complete Blood Count)' },
            { name: 'ระดับน้ำตาลในเลือด (FBS - Fasting Blood Sugar)' },
            { name: 'ระดับไขมันในเลือด (Lipid Profile - Cholesterol, Triglycerides, HDL, LDL)' },
            { name: 'การทำงานของตับ (Liver Function Test - SGOT, SGPT, ALP)' },
            { name: 'การทำงานของไต (Kidney Function Test - BUN, Creatinine)' },
            { name: 'ระดับกรดยูริกในเลือด (Uric Acid - ตรวจเก๊าท์)' },
            { name: 'ตรวจปัสสาวะสมบูรณ์แบบ (Urine Analysis - UA)' }
        ];
    }

    let price = match ? (parseFloat(match.price) || 0) : 0;
    
    // Smart Keyword Fallback Prices for Lab Tests when price is not set in servicesData
    if (price === 0) {
        if (testNameLower.includes('ตับ') || testNameLower.includes('lft') || testNameLower.includes('liver') || testNameLower.includes('วงจอม') || testNameLower.includes('วงจร') || testNameLower.includes('sgot') || testNameLower.includes('sgpt')) {
            price = 300000;
        } else if (testNameLower.includes('t4') || testNameLower.includes('tsh') || testNameLower.includes('thyroid') || testNameLower.includes('ไทรอยด์') || testNameLower.includes('ft3') || testNameLower.includes('ft4')) {
            price = 350000;
        } else if (testNameLower.includes('hiv') || testNameLower.includes('aids')) {
            price = 150000;
        } else if (testNameLower.includes('hbsag') || testNameLower.includes('hcv') || testNameLower.includes('ไวรัส')) {
            price = 200000;
        } else if (testNameLower.includes('ไต') || testNameLower.includes('kft') || testNameLower.includes('kidney') || testNameLower.includes('bun') || testNameLower.includes('creatinine')) {
            price = 250000;
        } else if (testNameLower.includes('cbc') || testNameLower.includes('เลือด')) {
            price = 150000;
        } else if (testNameLower.includes('fbs') || testNameLower.includes('น้ำตาล')) {
            price = 100000;
        } else if (testNameLower.includes('lipid') || testNameLower.includes('ไขมัน')) {
            price = 350000;
        } else if (testNameLower.includes('ua') || testNameLower.includes('ปัสสาวะ')) {
            price = 80000;
        } else if (testNameLower.includes('uric') || testNameLower.includes('เก๊าท์')) {
            price = 100000;
        } else if (testNameLower.includes('แพ็ก') || testNameLower.includes('แพค') || testNameLower.includes('package')) {
            price = 1200000;
        } else if (cleanTest !== '' && cleanTest !== '-') {
            // Default price fallback for any non-empty lab test item
            price = 150000;
        }
    }

    // ใช้ชื่อเต็มจาก servicesData ถ้าเจอ ไม่งั้นใช้ชื่อที่ส่งมา
    const displayName = match ? (match.name || cleanTest) : cleanTest;

    return {
        name: displayName,
        price: price,
        isPackage: isPackage,
        subItems: subItems
    };
}

// ฟังก์ชั่นดูรายละเอียดรายการแล็บสำหรับ "ห้อง Lab" (แสดงรายการหลัก + รายการย่อยในแพ็กเกจ ไม่มีราคา)
async function showLabDetails(visitId, hn, patientName, testsString) {
    if (!hn && (!testsString || testsString === '')) {
        testsString = visitId;
        visitId = '-';
        hn = '-';
        patientName = 'ผู้ป่วย';
    }

    if (!window.servicesData || window.servicesData.length === 0) {
        if (typeof loadServicesData === 'function') await loadServicesData();
    }

    const testsList = (testsString || '').split(',').map(t => t.trim()).filter(Boolean);

    let rowsHtml = '';
    testsList.forEach((test, idx) => {
        const itemDetails = getTestItemDetails(test);

        if (itemDetails.isPackage && itemDetails.subItems.length > 0) {
            let subItemsHtml = itemDetails.subItems.map((sub) => {
                const subName = sub.name || sub;
                return `
                    <span class="badge bg-white text-secondary border px-2 py-1 fw-semibold text-nowrap me-1 mb-1 shadow-sm" style="font-size: 0.78rem; border-radius: 6px;">
                        <i class="bi bi-check2 text-success me-1 fw-bold"></i>${subName}
                    </span>
                `;
            }).join('');

            rowsHtml += `
                <tr class="bg-white border-bottom">
                    <td class="ps-3 py-3 text-muted fw-semibold align-top" style="width: 70px; min-width: 70px;">${idx + 1}</td>
                    <td class="py-3 text-dark">
                        <div class="d-flex align-items-center mb-2">
                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded-pill me-2 fw-semibold" style="font-size: 0.75rem;">
                                <i class="bi bi-box-seam me-1"></i>แพ็กเกจ
                            </span>
                            <span class="fw-bold text-dark fs-6">${itemDetails.name}</span>
                        </div>
                        <div class="p-2.5 rounded-3 bg-light border ms-1">
                            <div class="text-muted extra-small fw-bold mb-2" style="font-size: 0.75rem; color: #475569;">
                                <i class="bi bi-diagram-3 me-1 text-primary"></i>รายการตรวจย่อยในแพ็กเกจ (${itemDetails.subItems.length} รายการ):
                            </div>
                            <div class="d-flex flex-wrap gap-1">
                                ${subItemsHtml}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            rowsHtml += `
                <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-light'} border-bottom">
                    <td class="ps-3 py-2.5 text-muted fw-semibold align-middle" style="width: 70px; min-width: 70px;">${idx + 1}</td>
                    <td class="py-2.5 text-dark fw-semibold align-middle">${itemDetails.name}</td>
                </tr>
            `;
        }
    });

    if (testsList.length === 0) {
        rowsHtml = `<tr><td colspan="2" class="text-center text-muted py-3">ไม่มีรายการแล็บ</td></tr>`;
    }

    const modalContentHtml = `
        <div class="text-start mt-2">
            <div class="p-3 mb-3 rounded-3 bg-light border d-flex justify-content-between align-items-center">
                <div>
                    <div class="small text-muted mb-1" style="font-size: 0.85rem;">ชื่อ-นามสกุล : <strong class="text-dark ms-1">${patientName || '-'}</strong></div>
                    <div class="small text-muted" style="font-size: 0.8rem;">HN: <strong class="text-secondary ms-1">${hn || '-'}</strong></div>
                </div>
                <div class="text-end">
                    <div class="small text-muted mb-1" style="font-size: 0.85rem;">รหัส VISIT : <strong class="text-primary ms-1">${visitId || '-'}</strong></div>
                </div>
            </div>

            <div class="table-responsive rounded-3 border mb-3" style="max-height: 420px; overflow-y: auto;">
                <table class="table table-borderless table-sm mb-0 align-middle">
                    <thead class="bg-light border-bottom sticky-top">
                        <tr class="text-secondary small fw-bold">
                            <th class="ps-3 py-2" style="width: 70px; min-width: 70px; white-space: nowrap !important;">ลำดับ</th>
                            <th class="py-2" style="white-space: nowrap !important;">รายการตรวจ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    Swal.fire({
        title: '<h5 class="fw-bold mb-0 text-primary"><i class="bi bi-card-text me-2"></i>รายละเอียดการชำระเงิน</h5>',
        html: modalContentHtml,
        width: '620px',
        showCloseButton: true,
        confirmButtonText: 'ปิดหน้าต่าง',
        confirmButtonColor: '#0b3c73',
        customClass: {
            popup: 'rounded-4 p-4',
            confirmButton: 'px-4 py-2 fw-semibold rounded-3'
        }
    });
}

// ฟังก์ชั่นดูรายละเอียดค่ารักษาสำหรับ "จ่ายค่ารักษา" (แสดงรายการ รายการย่อยแพ็กเกจ ราคา รับส่วนลด พร้อมปุ่มพิมพ์ใบเสร็จ)
async function showPaymentDetails(visitId, hn, patientName, testsString, discountVal) {
    if (!hn && (!testsString || testsString === '')) {
        testsString = visitId;
        visitId = '-';
        hn = '-';
        patientName = 'ผู้ป่วย';
    }

    // โหลด servicesData จาก Supabase ใหม่ทุกครั้ง เพื่อให้ราคาล่าสุดเสมอ
    try {
        const { data: svcData, error: svcErr } = await _supabase.from('services').select('*');
        if (!svcErr && svcData && svcData.length > 0) {
            window.servicesData = svcData.map(item => {
                let parsedSub = item.sub_items;
                if (typeof parsedSub === 'string') { try { parsedSub = JSON.parse(parsedSub); } catch(e) { parsedSub = []; } }
                return { ...item, sub_items: Array.isArray(parsedSub) ? parsedSub : [] };
            });
        } else if (!window.servicesData || window.servicesData.length === 0) {
            if (typeof loadServicesData === 'function') await loadServicesData();
        }
    } catch(e) {
        if (!window.servicesData || window.servicesData.length === 0) {
            if (typeof loadServicesData === 'function') await loadServicesData();
        }
    }

    // ดึง visit record จาก Supabase เพื่อใช้ราคาที่บันทึกจริง
    let visitRecord = null;
    try {
        if (visitId && visitId !== '-') {
            const { data: vData } = await _supabase.from('visits').select('*').eq('visit_id', visitId).maybeSingle();
            if (vData) visitRecord = vData;
        }
    } catch(e) {}

    const testsList = (testsString || '').split(',').map(t => t.trim()).filter(Boolean);
    let totalPrice = 0;
    const discount = parseFloat(discountVal) || (visitRecord ? parseFloat(visitRecord.discount || visitRecord.lab_discount || 0) : 0);

    // ถ้า visit มี payable_amount หรือ total_price ที่บันทึกไว้แล้ว ให้ใช้เป็น totalPrice รวม
    const savedTotal = visitRecord ? parseFloat(visitRecord.payable_amount || visitRecord.total_price || visitRecord.price || 0) : 0;

    let rowsHtml = '';
    testsList.forEach((test, idx) => {
        const itemDetails = getTestItemDetails(test);
        totalPrice += itemDetails.price;
        const priceDisplay = itemDetails.price > 0 ? itemDetails.price.toLocaleString() + ' LAK' : '<span class="text-muted small">- LAK</span>';

        if (itemDetails.isPackage && itemDetails.subItems.length > 0) {
            let subItemsHtml = itemDetails.subItems.map((sub) => {
                const subName = sub.name || sub;
                return `
                    <span class="badge bg-white text-secondary border px-2 py-1 fw-semibold text-nowrap me-1 mb-1 shadow-sm" style="font-size: 0.78rem; border-radius: 6px;">
                        <i class="bi bi-check2 text-success me-1 fw-bold"></i>${subName}
                    </span>
                `;
            }).join('');

            rowsHtml += `
                <tr class="bg-white border-bottom">
                    <td class="ps-3 py-3 text-muted fw-semibold align-top" style="width: 70px; min-width: 70px;">${idx + 1}</td>
                    <td class="py-3 text-dark align-top">
                        <div class="d-flex align-items-center mb-2">
                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded-pill me-2 fw-semibold" style="font-size: 0.75rem;">
                                <i class="bi bi-box-seam me-1"></i>แพ็กเกจ
                            </span>
                            <span class="fw-bold text-dark fs-6">${itemDetails.name}</span>
                        </div>
                        <div class="p-2.5 rounded-3 bg-light border ms-1">
                            <div class="text-muted extra-small fw-bold mb-2" style="font-size: 0.75rem; color: #475569;">
                                <i class="bi bi-diagram-3 me-1 text-primary"></i>รายการตรวจย่อยในแพ็กเกจ (${itemDetails.subItems.length} รายการ):
                            </div>
                            <div class="d-flex flex-wrap gap-1">
                                ${subItemsHtml}
                            </div>
                        </div>
                    </td>
                    <td class="pe-3 py-3 text-end text-primary fw-bold fs-6 align-top" style="white-space: nowrap !important;">${priceDisplay}</td>
                </tr>
            `;
        } else {
            rowsHtml += `
                <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-light'} border-bottom">
                    <td class="ps-3 py-2.5 text-muted fw-semibold align-middle" style="width: 70px; min-width: 70px;">${idx + 1}</td>
                    <td class="py-2.5 text-dark fw-semibold align-middle">${itemDetails.name}</td>
                    <td class="pe-3 py-2.5 text-end text-primary fw-bold align-middle" style="white-space: nowrap !important;">${priceDisplay}</td>
                </tr>
            `;
        }
    });

    if (testsList.length === 0) {
        rowsHtml = `<tr><td colspan="3" class="text-center text-muted py-3">ไม่มีรายการแล็บ</td></tr>`;
    }

    // ถ้าค้นหาราคาจาก services ไม่ได้ ให้ใช้ราคารวมจาก visit record แทน
    const effectiveTotal = totalPrice > 0 ? totalPrice : savedTotal;
    const finalPayable = Math.max(0, effectiveTotal - discount);
    const safeName = (patientName || '').replace(/'/g, "\\'");
    const safeTests = (testsString || '').replace(/'/g, "\\'");
    // แสดง note ถ้าราคาต่อรายการหาไม่เจอแต่ visit มีราคารวม
    const priceNote = (totalPrice === 0 && savedTotal > 0)
        ? `<div class="alert alert-info py-2 px-3 small mb-3"><i class="bi bi-info-circle me-1"></i>ราคารวมจากระบบ: <strong>${savedTotal.toLocaleString()} LAK</strong> (ราคาต่อรายการตรวจจะแสดงเมื่อตั้งค่าราคาในหน้า "ตั้งค่ารายการตรวจ")</div>`
        : '';


    const modalContentHtml = `
        <div class="text-start mt-2">
            <div class="p-3 mb-3 rounded-3 bg-light border d-flex justify-content-between align-items-center">
                <div>
                    <div class="small text-muted mb-1" style="font-size: 0.85rem;">ชื่อ-นามสกุล : <strong class="text-dark ms-1">${patientName || '-'}</strong></div>
                    <div class="small text-muted" style="font-size: 0.8rem;">HN: <strong class="text-secondary ms-1">${hn || '-'}</strong></div>
                </div>
                <div class="text-end">
                    <div class="small text-muted mb-1" style="font-size: 0.85rem;">รหัส VISIT : <strong class="text-primary ms-1">${visitId || '-'}</strong></div>
                </div>
            </div>

            ${priceNote}
            <div class="table-responsive rounded-3 border mb-3" style="max-height: 400px; overflow-y: auto;">
                <table class="table table-borderless table-sm mb-0 align-middle">
                    <thead class="bg-light border-bottom sticky-top">
                        <tr class="text-secondary small fw-bold">
                            <th class="ps-3 py-2" style="width: 70px; min-width: 70px; white-space: nowrap !important;">ลำดับ</th>
                            <th class="py-2" style="white-space: nowrap !important;">รายการตรวจ</th>
                            <th class="pe-3 py-2 text-end" style="white-space: nowrap !important;">ราคา</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>

            <div class="p-3 rounded-3 bg-light border">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="fw-semibold text-secondary small">รวมค่าตรวจทั้งหมด</span>
                    <span class="fw-bold text-dark fs-6" id="modalLabTotalPriceDisplay">${effectiveTotal.toLocaleString()} LAK</span>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-2 text-danger">
                    <label for="labDiscountInput" class="fw-semibold small mb-0">รับส่วนลด (LAK)</label>
                    <div class="input-group input-group-sm" style="max-width: 190px;">
                        <span class="input-group-text bg-white border-end-0 text-danger fw-bold">-</span>
                        <input type="number" id="labDiscountInput" class="form-control text-end text-danger fw-bold border-start-0" 
                            value="${discount || 0}" min="0" placeholder="0" 
                            oninput="updateLabDiscountCalc(${effectiveTotal})">
                        <span class="input-group-text bg-white text-muted small">LAK</span>
                    </div>
                </div>
                <hr class="my-2 border-secondary opacity-25">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-bold text-dark fs-6">ส่วนที่ต้องจ่ายทั้งหมด</span>
                    <span class="fw-bold text-primary fs-5" id="modalLabNetPriceDisplay">${finalPayable.toLocaleString()} LAK</span>
                </div>
            </div>

            <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                <button type="button" class="btn btn-outline-secondary rounded-pill px-3 py-2 fw-semibold" onclick="printPaymentInvoice('${visitId}', '${hn}', '${safeName}', '${safeTests}', document.getElementById('labDiscountInput')?.value || ${discount})">
                    <i class="bi bi-printer me-1"></i> พิมพ์ใบเสร็จ/ใบแจ้งชำระ
                </button>
                <button type="button" class="btn btn-primary rounded-pill px-4 py-2 fw-semibold" onclick="saveLabDiscountAndClose('${visitId}')">
                    <i class="bi bi-check-lg me-1"></i> บันทึก & ปิดหน้าต่าง
                </button>
            </div>
        </div>
    `;

    Swal.fire({
        title: '<h5 class="fw-bold mb-0 text-primary"><i class="bi bi-card-text me-2"></i>รายละเอียดการชำระเงิน</h5>',
        html: modalContentHtml,
        width: '640px',
        showCloseButton: true,
        showConfirmButton: false,
        customClass: {
            popup: 'rounded-4 p-4'
        }
    });
}

// ฟังก์ชั่นพิมพ์ใบเสร็จ/ใบแจ้งชำระเงิน (รองรับการพิมพ์รายการย่อยในแพ็กเกจ 100% ตรงตามแบบ)
function printPaymentInvoice(visitId, hn, patientName, testsString, discountVal) {
    const testsList = (testsString || '').split(',').map(t => t.trim()).filter(Boolean);
    let totalPrice = 0;
    const discount = parseFloat(discountVal) || 0;

    let rowsHtml = '';
    testsList.forEach((test, idx) => {
        const itemDetails = getTestItemDetails(test);
        totalPrice += itemDetails.price;
        const priceDisplay = itemDetails.price > 0 ? itemDetails.price.toLocaleString() + ' LAK' : '0 LAK';

        if (itemDetails.isPackage && itemDetails.subItems.length > 0) {
            let subItemsPrint = itemDetails.subItems.map(sub => `<span style="display: inline-block; margin-right: 14px; margin-top: 3px; font-size: 12.5px; color: #475569;">• ${sub.name || sub}</span>`).join('');
            rowsHtml += `
                <tr>
                    <td style="text-align: center; vertical-align: top;">${idx + 1}</td>
                    <td>
                        <div style="font-weight: 700; color: #0b3c73; font-size: 14.5px;">📦 ${itemDetails.name} (แพ็กเกจ)</div>
                        <div class="sub-items-box">
                            <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 2px;">รายการตรวจย่อยในแพ็กเกจ:</div>
                            <div>${subItemsPrint}</div>
                        </div>
                    </td>
                    <td style="text-align: right; font-weight: 700; color: #0b3c73; font-size: 14.5px; vertical-align: top;">${priceDisplay}</td>
                </tr>
            `;
        } else {
            rowsHtml += `
                <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td style="font-weight: 500;">${itemDetails.name}</td>
                    <td style="text-align: right; font-weight: 700; color: #0f172a;">${priceDisplay}</td>
                </tr>
            `;
        }
    });

    const netPrice = Math.max(0, totalPrice - discount);
    const currentDateStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) + 
        ' เวลา ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>ใบเสร็จรับเงิน / ใบแจ้งชำระเงิน - ${visitId}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap');
                body { 
                    font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    padding: 24px; 
                    color: #1e293b; 
                    max-width: 720px; 
                    margin: 0 auto; 
                    background: #ffffff;
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 20px; 
                    padding-bottom: 12px;
                    border-bottom: 1px solid #cbd5e1;
                }
                .header h1 { 
                    margin: 0; 
                    color: #0b3c73; 
                    font-size: 34px; 
                    font-weight: 700;
                    letter-spacing: -0.5px;
                }
                .header p { 
                    margin: 6px 0 0 0; 
                    color: #64748b; 
                    font-size: 13px; 
                }
                .info-container { 
                    display: flex; 
                    justify-content: space-between; 
                    margin-bottom: 24px; 
                    font-size: 13.5px; 
                    line-height: 1.6;
                }
                .info-left, .info-right {
                    flex: 1;
                }
                .info-right {
                    text-align: right;
                }
                .info-row {
                    margin-bottom: 2px;
                }
                .info-label {
                    font-weight: 700;
                    color: #0f172a;
                }
                .table-inv { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-bottom: 24px; 
                    font-size: 13.5px; 
                }
                .table-inv th { 
                    background: #f8fafc; 
                    padding: 10px; 
                    text-align: left; 
                    border-top: 1px solid #cbd5e1;
                    border-bottom: 2px solid #cbd5e1; 
                    font-weight: 700;
                    color: #334155;
                }
                .table-inv td { 
                    padding: 10px; 
                    border-bottom: 1px solid #e2e8f0; 
                    vertical-align: top;
                }
                .sub-items-box {
                    margin-top: 4px;
                    padding-left: 8px;
                    font-size: 12.5px;
                    color: #475569;
                }
                .sub-item-line {
                    margin-top: 2px;
                }
                .summary-container { 
                    width: 290px; 
                    margin-left: auto; 
                    font-size: 14px; 
                    margin-bottom: 30px;
                }
                .summary-row { 
                    display: flex; 
                    justify-content: space-between; 
                    padding: 5px 0; 
                    color: #475569;
                }
                .summary-row.discount {
                    color: #dc2626;
                    font-weight: 500;
                }
                .summary-row.total { 
                    font-size: 16px; 
                    font-weight: 700; 
                    color: #0b3c73; 
                    border-top: 2px solid #0b3c73; 
                    padding-top: 8px; 
                    margin-top: 4px; 
                }
                .footer-sig { 
                    margin-top: 60px; 
                    display: flex; 
                    justify-content: space-between; 
                    text-align: center; 
                    font-size: 13px; 
                    color: #475569; 
                }
                .sig-box { 
                    width: 220px; 
                }
                .sig-line {
                    border-top: 1px dashed #94a3b8; 
                    padding-top: 8px; 
                    margin-top: 55px; 
                }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Clinic</h1>
                <p>ใบเสร็จรับเงิน / ใบแจ้งชำระเงิน (Invoice & Receipt)</p>
            </div>

            <div class="info-container">
                <div class="info-left">
                    <div class="info-row"><span class="info-label">ชื่อ-นามสกุล:</span> ${patientName || '-'}</div>
                    <div class="info-row"><span class="info-label">รหัส HN:</span> ${hn || '-'}</div>
                </div>
                <div class="info-right">
                    <div class="info-row"><span class="info-label">รหัส VISIT:</span> ${visitId || '-'}</div>
                    <div class="info-row"><span class="info-label">วันที่พิมพ์:</span> ${currentDateStr}</div>
                </div>
            </div>

            <table class="table-inv">
                <thead>
                    <tr>
                        <th style="width: 50px; text-align: center;">ลำดับ</th>
                        <th>รายการตรวจ / บริการ</th>
                        <th style="text-align: right; width: 140px;">ราคา</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="summary-container">
                <div class="summary-row">
                    <span>รวมค่าตรวจทั้งหมด:</span>
                    <span>${totalPrice.toLocaleString()} LAK</span>
                </div>
                <div class="summary-row discount">
                    <span>ส่วนลด:</span>
                    <span>${discount > 0 ? '-' + discount.toLocaleString() : '0'} LAK</span>
                </div>
                <div class="summary-row total">
                    <span>ยอดชำระสุทธิ:</span>
                    <span>${netPrice.toLocaleString()} LAK</span>
                </div>
            </div>

            <div class="footer-sig">
                <div class="sig-box">
                    <div class="sig-line">
                        ( ผู้ป่วย / ผู้ชำระเงิน )
                    </div>
                </div>
                <div class="sig-box">
                    <div class="sig-line">
                        ( เจ้าหน้าที่การเงิน / คลินิก )
                    </div>
                </div>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `;

    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (printWin) {
        printWin.document.write(printContent);
        printWin.document.close();
    }
}

// =====================================
// การบันทึกและส่งข้อมูล
// =====================================
async function submitAppointment() {
    const form = document.getElementById('appointmentForm');
    const editId = document.getElementById('appointmentEditId')?.value;
    const apptId = editId || form.displayApptId.value || generateId('APT');

    const apptTypeVal = document.getElementById('apptTypeAssisted')?.checked ? 'assisted' : 'direct';
    const selectedRefBy = (document.getElementById('apptReferredBySelect')?.value || null);

    const formData = {
        appointment_id: apptId,
        appointment_type: apptTypeVal,
        guest_name: form.guestName.value,
        guest_phone: form.guestPhone.value,
        appointment_date: form.appointmentDate.value,
        appointment_time: form.appointmentTime.value,
        reason: form.reason.value,
        status: form.status.value || 'รอ',
        referred_by: selectedRefBy
    };

    if (selectedRefBy) {
        window.appointmentReferrersMap = JSON.parse(localStorage.getItem('clinic_appointment_referrers') || '{}');
        window.appointmentReferrersMap[apptId] = selectedRefBy;
        localStorage.setItem('clinic_appointment_referrers', JSON.stringify(window.appointmentReferrersMap));
    } else if (window.appointmentReferrersMap && window.appointmentReferrersMap[apptId]) {
        delete window.appointmentReferrersMap[apptId];
        localStorage.setItem('clinic_appointment_referrers', JSON.stringify(window.appointmentReferrersMap));
    }

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const payload = { ...formData };
    let error = null;

    if (editId) {
        let res = await _supabase.from('appointments').update(payload).eq('appointment_id', editId);
        error = res.error;
        if (error && error.message && (error.message.includes('appointment_type') || error.message.includes('referred_by') || error.message.includes('schema cache'))) {
            if (error.message.includes('appointment_type')) delete payload.appointment_type;
            if (error.message.includes('referred_by') || error.message.includes('schema cache')) delete payload.referred_by;
            res = await _supabase.from('appointments').update(payload).eq('appointment_id', editId);
            error = res.error;
        }
    } else {
        let res = await _supabase.from('appointments').insert([payload]);
        error = res.error;
        if (error && error.message && (error.message.includes('appointment_type') || error.message.includes('referred_by') || error.message.includes('schema cache'))) {
            if (error.message.includes('appointment_type')) delete payload.appointment_type;
            if (error.message.includes('referred_by') || error.message.includes('schema cache')) delete payload.referred_by;
            res = await _supabase.from('appointments').insert([payload]);
            error = res.error;
        }
    }

    if (error) {
        Swal.fire('ข้อผิดพลาด', error.message, 'error');
    } else {
        Swal.fire('สำเร็จ', editId ? 'แก้ไขรายการนัดหมายเรียบร้อยแล้ว' : 'บันทึกนัดหมายเรียบร้อยแล้ว', 'success');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('addAppointmentModal')).hide();
        form.reset();
        if (document.getElementById('appointmentEditId')) document.getElementById('appointmentEditId').value = '';
        toggleApptReferrerField();
        loadAppointments();
    }
}

async function submitPatient() {
    const form = document.getElementById('patientForm');
    const editHn = document.getElementById('patientEditHn')?.value;
    const hn = editHn || ('HN-' + Math.floor(100000 + Math.random() * 900000));
    const linkApptId = document.getElementById('linkAppointmentId')?.value;
    const refByVal = (document.getElementById('patientReferredBySelect')?.value || null);

    if (refByVal) {
        window.patientReferrersMap = JSON.parse(localStorage.getItem('clinic_patient_referrers') || '{}');
        window.patientReferrersMap[hn] = refByVal;
        localStorage.setItem('clinic_patient_referrers', JSON.stringify(window.patientReferrersMap));
    } else if (window.patientReferrersMap && window.patientReferrersMap[hn]) {
        delete window.patientReferrersMap[hn];
        localStorage.setItem('clinic_patient_referrers', JSON.stringify(window.patientReferrersMap));
    }

    const patientData = {
        hn: hn,
        patient_name: form.FullName.value,
        dob: form.DOB.value || null,
        age: parseInt(form.Age.value) || null,
        village: form.Village.value || null,
        district: (document.getElementById('patientDistrictSelect')?.value || form.District?.value || null),
        province: (document.getElementById('patientProvinceSelect')?.value || form.Province?.value || null),
        job: form.Job.value || null,
        phone: form.Tel.value,
        emergency_tel: form.EmergencyTel.value || null,
        past_history: form.PastHistory.value || null,
        allergies: form.Allergies.value || null,
        referred_by: refByVal
    };

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const payload = { ...patientData };
    let patientErr = null;

    if (editHn) {
        let res = await _supabase.from('patients').update(payload).eq('hn', editHn);
        patientErr = res.error;
        if (patientErr && patientErr.message && (patientErr.message.includes('referred_by') || patientErr.message.includes('schema cache'))) {
            delete payload.referred_by;
            res = await _supabase.from('patients').update(payload).eq('hn', editHn);
            patientErr = res.error;
        }
    } else {
        let res = await _supabase.from('patients').insert([payload]);
        patientErr = res.error;
        if (patientErr) {
            // ลองเอาเฉพาะ column หลักที่แน่ว่ามีใน Supabase schema
            const corePayload = {
                hn: payload.hn,
                patient_name: payload.patient_name,
                dob: payload.dob,
                age: payload.age,
                phone: payload.phone,
                job: payload.job,
                village: payload.village,
                district: payload.district,
                province: payload.province
            };
            // เพิ่ม optional columns ทีละตัว
            if (!patientErr.message?.includes('emergency_tel')) corePayload.emergency_tel = payload.emergency_tel;
            if (!patientErr.message?.includes('past_history')) corePayload.past_history = payload.past_history;
            if (!patientErr.message?.includes('allergies')) corePayload.allergies = payload.allergies;
            if (!patientErr.message?.includes('referred_by')) corePayload.referred_by = payload.referred_by;
            res = await _supabase.from('patients').insert([corePayload]);
            patientErr = res.error;
            if (patientErr) {
                // retry ด้วย core เท่านั้น
                const minPayload = { hn: payload.hn, patient_name: payload.patient_name, phone: payload.phone };
                res = await _supabase.from('patients').insert([minPayload]);
                patientErr = res.error;
            }
        }
    }

    if (patientErr) {
        Swal.fire('ข้อผิดพลาด', patientErr.message, 'error');
        return;
    }

    patientData.referred_by = refByVal;
    if (window.allPatients) {
        if (editHn) {
            const idx = window.allPatients.findIndex(x => x.hn === editHn);
            if (idx >= 0) window.allPatients[idx] = patientData;
        } else {
            window.allPatients.unshift(patientData);
        }
    }

    if (linkApptId) {
        await _supabase
            .from('appointments')
            .update({ status: 'เสร็จสิ้น' })
            .eq('appointment_id', linkApptId);
        loadAppointments();
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('addPatientModal')).hide();
    form.reset();
    if (document.getElementById('patientEditHn')) document.getElementById('patientEditHn').value = '';
    loadPatients();
    Swal.fire('สำเร็จ', editHn ? 'แก้ไขประวัติผู้ป่วยเรียบร้อยแล้ว' : 'ลงทะเบียนผู้ป่วยและประวัติใหม่เรียบร้อยแล้ว', 'success');
}

function openAddPatientModal() {
    const form = document.getElementById('patientForm');
    if (form) form.reset();
    if (document.getElementById('patientEditHn')) document.getElementById('patientEditHn').value = '';
    if (document.getElementById('linkAppointmentId')) document.getElementById('linkAppointmentId').value = '';

    populateProvinceDropdown();
    onPatientProvinceChange();
    populateReferrerDropdowns();

    const patRefSelect = document.getElementById('patientReferredBySelect');
    const lockHint = document.getElementById('patientRefLockHint');
    if (patRefSelect) {
        patRefSelect.value = '';
        patRefSelect.removeAttribute('readonly');
        patRefSelect.style.pointerEvents = 'auto';
        patRefSelect.classList.remove('bg-light');
    }
    if (lockHint) lockHint.style.display = 'none';

    const modalTitle = document.querySelector('#addPatientModal .modal-title');
    if (modalTitle) modalTitle.textContent = 'เพิ่มประวัติผู้ป่วยใหม่';

    bootstrap.Modal.getOrCreateInstance(document.getElementById('addPatientModal')).show();
}

function openRegisterFromAppointment(appId, name, phone) {
    const form = document.getElementById('patientForm');
    if (form) form.reset();
    if (form.FullName) form.FullName.value = name;
    if (form.Tel) form.Tel.value = phone;
    if (document.getElementById('patientEditHn')) document.getElementById('patientEditHn').value = '';
    document.getElementById('linkAppointmentId').value = appId;

    populateProvinceDropdown();
    onPatientProvinceChange();
    populateReferrerDropdowns();

    const patRefSelect = document.getElementById('patientReferredBySelect');
    const lockHint = document.getElementById('patientRefLockHint');

    // ดึงข้อมูลนัดหมายเพื่อตรวจดูว่ามีการระบุผู้แนะนำไว้หรือไม่
    const appt = (allAppointments || []).find(a => a.appointment_id === appId);
    if (appt && appt.referred_by && patRefSelect) {
        // หากมีผู้แนะนำจากการนัดหมายล่วงหน้า -> เติมข้อมูลอัตโนมัติและล็อกไม่ให้แก้ไข
        patRefSelect.value = appt.referred_by;
        patRefSelect.setAttribute('readonly', 'readonly');
        patRefSelect.style.pointerEvents = 'none';
        patRefSelect.classList.add('bg-light');
        if (lockHint) lockHint.style.display = 'inline-block';
    } else if (patRefSelect) {
        // หากไม่มีผู้แนะนำจากการนัดหมาย -> สามารถกรอก/พิมพ์ค้นหาได้ตามปกติ
        patRefSelect.value = '';
        patRefSelect.removeAttribute('readonly');
        patRefSelect.style.pointerEvents = 'auto';
        patRefSelect.classList.remove('bg-light');
        if (lockHint) lockHint.style.display = 'none';
    }

    const modalTitle = document.querySelector('#addPatientModal .modal-title');
    if (modalTitle) modalTitle.textContent = `เพิ่มประวัติผู้ป่วยใหม่ (จากรายการนัดหมาย: ${appId})`;

    bootstrap.Modal.getOrCreateInstance(document.getElementById('addPatientModal')).show();
}

function editPatient(hn) {
    const patient = (window.allPatients || []).find(p => p.hn === hn);
    if (!patient) return;

    const form = document.getElementById('patientForm');
    if (!form) return;
    form.reset();

    if (document.getElementById('patientEditHn')) {
        document.getElementById('patientEditHn').value = patient.hn;
    }

    if (form.FullName) form.FullName.value = patient.patient_name || '';
    if (form.DOB) form.DOB.value = patient.dob || '';
    if (form.Age) form.Age.value = patient.age || '';
    if (form.Tel) form.Tel.value = patient.phone || '';
    if (form.EmergencyTel) form.EmergencyTel.value = patient.emergency_tel || '';
    if (form.Job) form.Job.value = patient.job || '';
    if (form.Village) form.Village.value = patient.village || '';
    if (form.PastHistory) form.PastHistory.value = patient.past_history || '';
    if (form.Allergies) form.Allergies.value = patient.allergies || '';

    populateProvinceDropdown();
    if (document.getElementById('patientProvinceSelect') && patient.province) {
        document.getElementById('patientProvinceSelect').value = patient.province;
        onPatientProvinceChange();
        if (document.getElementById('patientDistrictSelect') && patient.district) {
            document.getElementById('patientDistrictSelect').value = patient.district;
        }
    }

    populateReferrerDropdowns();
    const patRefSelect = document.getElementById('patientReferredBySelect');
    const lockHint = document.getElementById('patientRefLockHint');
    if (patRefSelect) {
        patRefSelect.value = patient.referred_by || '';
        if (patient.referred_by_from_appt) {
            patRefSelect.setAttribute('readonly', 'readonly');
            patRefSelect.style.pointerEvents = 'none';
            patRefSelect.classList.add('bg-light');
            if (lockHint) lockHint.style.display = 'inline-block';
        } else {
            patRefSelect.removeAttribute('readonly');
            patRefSelect.style.pointerEvents = 'auto';
            patRefSelect.classList.remove('bg-light');
            if (lockHint) lockHint.style.display = 'none';
        }
    }

    const modalTitle = document.querySelector('#addPatientModal .modal-title');
    if (modalTitle) modalTitle.textContent = `แก้ไขประวัติผู้ป่วย (${patient.hn})`;

    bootstrap.Modal.getOrCreateInstance(document.getElementById('addPatientModal')).show();
}

async function deletePatient(hn) {
    const result = await Swal.fire({
        title: 'ยืนยันการลบประวัติผู้ป่วย?',
        text: `คุณต้องการลบผู้ป่วย HN: ${hn} ใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ใช่, ลบเลย',
        cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
        Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const { error } = await _supabase.from('patients').delete().eq('hn', hn);

        if (error) {
            Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
        } else {
            Swal.fire('สำเร็จ', 'ลบประวัติผู้ป่วยเรียบร้อยแล้ว', 'success');
            loadPatients();
        }
    }
}

async function sendToTriage(hn, name) {
    const visitId = generateId('VIS');
    const visitData = {
        visit_id: visitId,
        hn: hn,
        patient_name: name,
        status: 'รอคัดกรอง'
    };

    Swal.fire({ title: 'กำลังส่งข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const { error } = await _supabase
        .from('visits')
        .insert([visitData]);

    if (error) {
        Swal.fire('ข้อผิดพลาด', error.message, 'error');
    } else {
        Swal.fire('สำเร็จ', 'เพิ่มเข้าคิวคัดกรองแล้ว', 'success');
        showPage('triage', document.querySelector('a[onclick*="triage"]'));
        loadTriage();
        if (typeof loadPatients === 'function') loadPatients();
    }
}

function openTriageModal(visitId) {
    document.getElementById('triageForm').reset();
    document.getElementById('triageVisitId').value = visitId;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('triageModal')).show();
}

async function submitTriage() {
    const form = document.getElementById('triageForm');
    const visitId = form.visitId.value;

    const triageData = {
        temp: parseFloat(form.temp.value) || null,
        bp: form.bp.value || null,
        pulse: parseInt(form.pulse.value) || null,
        weight: parseFloat(form.weight.value) || null,
        height: parseFloat(form.height.value) || null,
        bmi: parseFloat(form.bmi.value) || null,
        spo2: parseInt(form.spo2.value) || null,
        symptom: form.symptom.value || null,
        status: 'รอตรวจ'
    };

    Swal.fire({ title: 'กำลังส่งข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const { error } = await _supabase
        .from('visits')
        .update(triageData)
        .eq('visit_id', visitId);

    if (error) {
        Swal.fire('ข้อผิดพลาด', error.message, 'error');
    } else {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('triageModal')).hide();
        loadTriage();
        loadDoctorQueue();
        if (typeof loadPatients === 'function') loadPatients();
        Swal.fire('สำเร็จ', 'ส่งเข้าห้องตรวจแล้ว', 'success');
    }
}

window.selectedLabCategory = 'เลือดวิทยา (HEMATOLOGY)';
window.checkedLabState = {};

function getServiceCategory(s) {
    if (!s) return 'อื่นๆ (Other)';

    if (s.category && typeof s.category === 'string' && s.category.trim()) {
        const cat = s.category.trim();
        if (cat.includes('เลือดวิทยา') || cat.includes('HEMATOLOGY')) return 'เลือดวิทยา (HEMATOLOGY)';
        if (cat.includes('ชีวเคมี') || cat.includes('Biochemistry')) return 'ชีวเคมี (Biochemistry)';
        if (cat.includes('ภูมิคุ้มกัน') || cat.includes('Immunology')) return 'ภูมิคุ้มกันวิทยา (Immunology)';
        if (cat.includes('ปัสสาวะ') || cat.includes('อุจจาระ') || cat.includes('Urinalysis') || cat.includes('Stool')) return 'ปัสสาวะและอุจจาระ (Urinalysis, Stool Examination, and Other)';
        if (cat.includes('อื่นๆ') || cat.includes('Other')) return 'อื่นๆ (Other)';
        return cat;
    }

    const name = (s.name || s.id || '').toLowerCase().trim();

    // 1. เลือดวิทยา (HEMATOLOGY)
    if (
        name.includes('cbc') || name.includes('blood count') || name.includes('hemoglobin') || 
        name.includes('hematocrit') || name.includes('hct') || name.includes('wbc') || 
        name.includes('rbc') || name.includes('platelet') || name.includes('thalassemia') || 
        name.includes('esr') || name.includes('coagulation') || name.includes('forgesterone') ||
        name.includes('เม็ดเลือด') || name.includes('เกล็ดเลือด')
    ) {
        return 'เลือดวิทยา (HEMATOLOGY)';
    }

    // 2. ชีวเคมี (Biochemistry)
    if (
        name.includes('electrolyte') || name.includes('fbs') || name.includes('glucose') || 
        name.includes('hba1c') || name.includes('bun') || name.includes('creatinine') || 
        name.includes('gfr') || name.includes('uric') || name.includes('sgot') || 
        name.includes('sgpt') || name.includes('alp') || name.includes('ast') || 
        name.includes('alt') || name.includes('lipid') || name.includes('cholesterol') || 
        name.includes('triglyceride') || name.includes('hdl') || name.includes('ldl') || 
        name.includes('ferritin') || name.includes('dosage hormone') || name.includes('troponin') ||
        name.includes('t3') || name.includes('t4') || name.includes('tsh') || name.includes('ตับ') || name.includes('ไต')
    ) {
        return 'ชีวเคมี (Biochemistry)';
    }

    // 3. ภูมิคุ้มกันวิทยา (Immunology)
    if (
        name.includes('hpv') || name.includes('hiv') || name.includes('hbsag') || 
        name.includes('hbsab') || name.includes('hcv') || name.includes('vdrl') || 
        name.includes('syphilis') || name.includes('syphillis') || name.includes('dengue') || name.includes('allergy') || 
        name.includes('ca 153') || name.includes('ca 15-3') || name.includes('ca 125') || 
        name.includes('ca 199') || name.includes('ca 19-9') || name.includes('cea') || 
        name.includes('psa') || name.includes('afp') || name.includes('cyfra') || 
        name.includes('crp') || name.includes('aslo') || name.includes('rheumatoid') || 
        name.includes('h.pylori') || name.includes('h-pylori') || name.includes('pylori') || name.includes('sle') ||
        name.includes('viral load') || name.includes('ภูมิคุ้มกัน') || name.includes('มะเร็ง')
    ) {
        return 'ภูมิคุ้มกันวิทยา (Immunology)';
    }

    // 4. ปัสสาวะและอุจจาระ (Urinalysis, Stool Examination, and Other)
    if (
        name.includes('urinalysis') || name.includes('stool') || name.includes('urine') || 
        name.includes('ua') || name.includes('fecal') || name.includes('parasite') || 
        name.includes('ปัสสาวะ') || name.includes('อุจจาระ')
    ) {
        return 'ปัสสาวะและอุจจาระ (Urinalysis, Stool Examination, and Other)';
    }

    // 5. อื่นๆ (Other)
    if (
        name.includes('echo') || name.includes('abdominal') || name.includes('sperm') || 
        name.includes('spermogramme') || name.includes('pap') || name.includes('cytology') ||
        name.includes('ultrasound')
    ) {
        return 'อื่นๆ (Other)';
    }

    return 'อื่นๆ (Other)';
}

function isCategoryMatch(itemCategory, targetCategory) {
    if (!targetCategory || targetCategory === 'ALL' || targetCategory === 'ทั้งหมด (All)') return true;
    const cat = (itemCategory || '').toLowerCase().trim();
    const target = targetCategory.toLowerCase().trim();
    
    if (cat === target) return true;

    if (target.includes('เลือดวิทยา') || target.includes('hematology')) {
        return cat.includes('เลือดวิทยา') || cat.includes('hematology');
    }
    if (target.includes('ชีวเคมี') || target.includes('biochemistry')) {
        return cat.includes('ชีวเคมี') || cat.includes('biochemistry');
    }
    if (target.includes('ภูมิคุ้มกัน') || target.includes('immunology')) {
        return cat.includes('ภูมิคุ้มกัน') || cat.includes('immunology');
    }
    if (target.includes('ปัสสาวะ') || target.includes('urinalysis') || target.includes('stool') || target.includes('อุจจาระ')) {
        return cat.includes('ปัสสาวะ') || cat.includes('urinalysis') || cat.includes('stool') || cat.includes('อุจจาระ');
    }
    if (target.includes('อื่นๆ') || target.includes('other')) {
        return cat.includes('อื่นๆ') || cat.includes('other');
    }

    return false;
}

function handleLabCheckboxChange(inputEl, serviceName, price) {
    window.checkedLabState = window.checkedLabState || {};
    if (inputEl.checked) {
        window.checkedLabState[serviceName] = {
            name: serviceName,
            price: parseFloat(price) || 0
        };
    } else {
        delete window.checkedLabState[serviceName];
    }
    updateLabTotals();
}

function switchLabCategory(categoryName, btnEl) {
    window.selectedLabCategory = categoryName;
    if (btnEl) {
        document.querySelectorAll('#labCategoryTabs .lab-cat-tab').forEach(b => {
            b.classList.remove('active', 'fw-semibold');
            b.classList.add('text-secondary');
            b.style.color = '';
            b.style.borderBottom = 'none';
        });
        btnEl.classList.remove('text-secondary');
        btnEl.classList.add('active', 'fw-semibold');
        btnEl.style.color = '#0284c7';
        btnEl.style.borderBottom = '2px solid #0284c7';
        btnEl.style.paddingBottom = '6px';
    }
    renderServicesLabContainer();
}

function updateLabTotals() {
    window.checkedLabState = window.checkedLabState || {};
    const stateItems = Object.values(window.checkedLabState);
    
    // Count custom lab checkboxes in #customLabContainer if not in window.checkedLabState
    const customBoxes = document.querySelectorAll('#customLabContainer input[name="lab"]:checked');
    let customCount = 0;
    let customPriceTotal = 0;
    customBoxes.forEach(cb => {
        if (!window.checkedLabState[cb.value]) {
            customCount++;
            if (cb.dataset.price) {
                customPriceTotal += parseFloat(cb.dataset.price) || 0;
            }
        }
    });

    const totalItems = stateItems.length + customCount;
    let totalPrice = customPriceTotal;
    stateItems.forEach(item => {
        totalPrice += (parseFloat(item.price) || 0);
    });

    const countEl = document.getElementById('labTotalItemsCount');
    const priceEl = document.getElementById('labTotalPriceDisplay');
    if (countEl) countEl.textContent = totalItems;
    if (priceEl) priceEl.textContent = totalPrice.toLocaleString() + ' LAK';
}

function renderServicesLabContainer() {
    const customContainer = document.getElementById('servicesLabContainer');
    if (!customContainer) return;

    const services = window.allServicesData || window.servicesData || [];
    const currentCat = window.selectedLabCategory || 'เลือดวิทยา (HEMATOLOGY)';

    const filteredServices = (currentCat === 'ALL' || currentCat === 'ทั้งหมด (All)')
        ? services
        : services.filter(s => {
            const itemCat = s.category || getServiceCategory(s);
            return isCategoryMatch(itemCat, currentCat);
        });

    if (filteredServices.length === 0) {
        customContainer.innerHTML = `
            <div class="col-12">
                <div class="text-center text-muted py-4">
                    <i class="bi bi-folder-x fs-3 d-block mb-2 text-secondary opacity-50"></i>
                    ยังไม่มีรายการในหมวดหมู่ "${currentCat}"<br>
                    <small class="text-muted">สามารถตั้งค่าเพิ่มรายการได้ที่เมนู "จัดการรายการตรวจ"</small>
                </div>
            </div>`;
    } else {
        customContainer.innerHTML = filteredServices.map(s => {
            const cur = s.currency === 'THB' ? 'บาท' : (s.currency || 'LAK');
            const isPackage = s.sub_items && Array.isArray(s.sub_items) && s.sub_items.length > 0;
            const isChecked = (window.checkedLabState && window.checkedLabState[s.name]) ? 'checked' : '';

            const badgeTypeHtml = isPackage 
                ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-1.5 py-0.5 rounded-pill me-1" style="font-size: 0.68rem;"><i class="bi bi-box-seam me-1"></i>แพ็กเกจ</span>`
                : `<span class="badge bg-secondary-subtle text-secondary border px-1.5 py-0.5 rounded-pill me-1" style="font-size: 0.68rem;"><i class="bi bi-card-checklist me-1"></i>รายการเดี่ยว</span>`;

            const escapedName = (s.name || '').replace(/'/g, "\\'");

            if (!isPackage) {
                return `
                    <div class="col-md-3 col-sm-6 mb-2">
                        <label class="d-flex align-items-center cursor-pointer w-100 p-1.5 rounded-2 hover-bg-light" style="cursor: pointer;">
                            <div class="form-check me-2 mb-0">
                                <input type="checkbox" class="form-check-input lab-item-checkbox shadow-none" name="lab" value="${s.name}" data-price="${s.price || 0}" ${isChecked} onchange="handleLabCheckboxChange(this, '${escapedName}', ${s.price || 0})" style="transform: scale(1.15); cursor: pointer;">
                            </div>
                            <div class="text-truncate" style="font-size: 0.85rem;">
                                ${badgeTypeHtml}
                                <span class="fw-semibold text-dark me-1">${s.name}</span>
                                <span class="fw-bold" style="color: #0284c7;">${Number(s.price).toLocaleString()} ${cur}</span>
                            </div>
                        </label>
                    </div>
                `;
            }

            let subItemsHtml = '';
            if (s.sub_items && s.sub_items.length > 0) {
                subItemsHtml = `
                    <div class="mt-1 ps-4">
                        <div class="text-muted extra-small mb-1 opacity-75" style="font-size: 0.72rem;">
                            รายการย่อย (${s.sub_items.length} รายการ):
                        </div>
                        <div class="d-flex flex-wrap gap-1">
                            ${s.sub_items.map(item => `<span class="badge bg-light text-secondary border-0 px-1.5 py-0.5 fw-normal" style="font-size: 0.72rem; color: #475569;"><i class="bi bi-check2 text-success me-1"></i>${item.name}</span>`).join('')}
                        </div>
                    </div>
                `;
            }

            return `
                <div class="col-md-4 col-sm-6 mb-3">
                    <div class="card h-100 border-0 p-2.5 shadow-sm" style="background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0 !important;">
                        <label class="d-flex align-items-start cursor-pointer mb-0 w-100" style="cursor: pointer;">
                            <div class="form-check me-2 mt-1 mb-0">
                                <input type="checkbox" class="form-check-input lab-item-checkbox shadow-none" name="lab" value="${s.name}" data-price="${s.price || 0}" ${isChecked} onchange="handleLabCheckboxChange(this, '${escapedName}', ${s.price || 0})" style="transform: scale(1.15); cursor: pointer;">
                            </div>
                            <div class="w-100">
                                <div class="d-flex align-items-center mb-1 flex-wrap">
                                    ${badgeTypeHtml}
                                    <span class="fw-bold text-dark" style="font-size: 0.9rem;">${s.name}</span>
                                </div>
                                ${subItemsHtml}
                                <div class="mt-2 ps-4 fw-bold" style="color: #0284c7; font-size: 0.9rem;">
                                    ${Number(s.price).toLocaleString()} ${cur}
                                </div>
                            </div>
                        </label>
                    </div>
                </div>
            `;
        }).join('');
    }
    updateLabTotals();
}

async function openLabOrder(visitId, patientName, hn) {
    const form = document.getElementById('labOrderForm');
    if (form) form.reset();

    const vId = document.getElementById('labVisitId');
    if (vId) vId.value = visitId;
    const hInput = document.getElementById('labHN');
    if (hInput) hInput.value = hn;
    const vDisp = document.getElementById('labVisitIdDisplay');
    if (vDisp) vDisp.innerText = visitId;
    const pDisp = document.getElementById('labPatientName');
    if (pDisp) pDisp.innerText = patientName;
    const hDisp = document.getElementById('labHNDisplay');
    if (hDisp) hDisp.innerText = hn;

    const customContainer = document.getElementById('customLabContainer');
    if (customContainer) customContainer.innerHTML = '';

    window.checkedLabState = {};

    // ดึงข้อมูลบริการ/แล็บ 38 รายการจาก Supabase DB เพื่อให้ข้อมูลครบถ้วนเสมอ
    if (typeof loadServicesData === 'function') {
        await loadServicesData();
    }

    const firstTab = document.querySelector('#labCategoryTabs .lab-cat-tab');
    if (firstTab) {
        switchLabCategory('เลือดวิทยา (HEMATOLOGY)', firstTab);
    } else {
        renderServicesLabContainer();
    }

    const modalEl = document.getElementById('labOrderModal');
    if (modalEl) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
}

function openDoctorLabModal(visitId, hn, patientName) {
    openLabOrder(visitId, patientName, hn);
}

async function submitLabOrder() {
    const form = document.getElementById('labOrderForm');
    const visitId = form.visitId.value;
    
    window.checkedLabState = window.checkedLabState || {};
    const selectedLabs = Object.keys(window.checkedLabState);

    // Also include custom lab checkboxes if any checked in #customLabContainer
    form.querySelectorAll('#customLabContainer input[name="lab"]:checked').forEach((cb) => { 
        if (!selectedLabs.includes(cb.value)) {
            selectedLabs.push(cb.value);
        }
    });
    
    if (selectedLabs.length === 0) { 
        Swal.fire('แจ้งเตือน', 'กรุณาเลือกรายการ Lab อย่างน้อย 1 รายการ', 'warning'); 
        return; 
    }

    Swal.fire({ title: 'กำลังบันทึกส่งแล็บ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const updateData = {
        lab_tests: selectedLabs.join(', '),
        status: 'รอชำระเงิน'
    };

    const { error } = await _supabase
        .from('visits')
        .update(updateData)
        .eq('visit_id', visitId);

    if (error) {
        Swal.fire('ข้อผิดพลาด', error.message, 'error');
    } else {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('labOrderModal')).hide();
        loadDoctorQueue();
        loadPaymentQueue();
        Swal.fire('สำเร็จ', 'ส่งเข้าห้องการเงินสำเร็จ', 'success');
    }
}

function addCustomLabCheckbox() {
    const input = document.getElementById('customLabInput');
    const container = document.getElementById('customLabContainer');
    if (!input || !container) return;

    const val = input.value.trim();
    if (!val) return;

    const col = document.createElement('div');
    col.className = 'col-md-6 mb-2';
    col.innerHTML = `
        <label class="w-100 h-100 cursor-pointer" style="cursor: pointer;">
            <div class="card h-100 border-0 shadow-sm transition-all custom-lab-card" style="border-radius: 12px; background: #fff8f1; border: 1px dashed #fdba74 !important;">
                <div class="card-body p-3 d-flex align-items-center">
                    <div class="form-check me-3 mb-0">
                        <input type="checkbox" class="form-check-input shadow-none" name="lab" value="${val}" checked onchange="updateLabTotals()" style="transform: scale(1.3); cursor: pointer;">
                    </div>
                    <div class="w-100">
                        <span class="fw-bold text-dark d-block" style="font-size: 1rem;">${val}</span>
                        <small class="text-warning-emphasis">รายการเพิ่มพิเศษ</small>
                    </div>
                </div>
            </div>
        </label>
    `;

    container.appendChild(col);
    input.value = '';
    updateLabTotals();
}

async function confirmPayment(visitId) {
    Swal.fire({ title: 'กำลังบันทึกชำระเงิน...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const { error } = await _supabase
        .from('visits')
        .update({ status: 'รอผลแล็บ' })
        .eq('visit_id', visitId);

    if (error) {
        Swal.fire('ข้อผิดพลาด', error.message, 'error');
    } else {
        if (typeof processPaymentCommission === 'function') {
            await processPaymentCommission(visitId);
        }
        loadPaymentQueue();
        loadLabQueue();
        Swal.fire('ชำระเงินสำเร็จ', 'ส่งตัวเข้าห้องแล็บตรวจเรียบร้อย', 'success');
    }
}

function openLabUploadModal(visitId) {
    document.getElementById('labUploadForm').reset();
    document.getElementById('uploadVisitId').value = visitId;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('labUploadModal')).show();
}

async function submitLabUpload() {
    const fileInput = document.getElementById('pdfFile');
    const file = fileInput ? fileInput.files[0] : null;
    const visitId = document.getElementById('uploadVisitId').value;

    if (!file) {
        Swal.fire('แจ้งเตือน', 'กรุณาเลือกไฟล์ผลแล็บที่ต้องการอัปโหลด (PDF หรือ รูปภาพ)', 'warning');
        return;
    }

    Swal.fire({ title: 'กำลังบันทึกไฟล์ผลแล็บจริง...', html: 'กรุณารอสักครู่ ห้ามปิดหน้าจอ', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const reader = new FileReader();
    reader.onload = async function(e) {
        const fileDataUrl = e.target.result;
        let publicUrl = fileDataUrl; // ใช้ไฟล์จริงที่อัปโหลดทันที (DataURL Base64)

        const ext = file.name.split('.').pop() || 'pdf';
        const fileName = `${visitId}_LabResult_${Date.now()}.${ext}`;

        try {
            // อัปโหลดขึ้น Supabase Storage พร้อมกันเพื่อการใช้งานระยะยาว
            const { data: uploadData, error: uploadError } = await _supabase
                .storage
                .from('lab-results')
                .upload(fileName, file, { cacheControl: '3600', upsert: true, contentType: file.type });

            if (!uploadError) {
                const { data: urlData } = _supabase
                    .storage
                    .from('lab-results')
                    .getPublicUrl(fileName);
                if (urlData && urlData.publicUrl) {
                    publicUrl = urlData.publicUrl;
                }
            }
        } catch (err) {
            console.warn('Optional Supabase storage upload notice:', err);
        }

        // บันทึก URL ไฟล์จริงลงในตาราง visits ใน Supabase DB
        const { error: dbError } = await _supabase
            .from('visits')
            .update({
                pdf_url: publicUrl,
                status: 'รอจัดคิว'
            })
            .eq('visit_id', visitId);

        // บันทึกลงใน LocalStorage Cache เป็นเกราะป้องกันกรณีออฟไลน์
        try {
            const cachedRealFiles = JSON.parse(localStorage.getItem('clinic_real_lab_files') || '{}');
            cachedRealFiles[visitId] = {
                url: publicUrl,
                fileName: file.name,
                fileType: file.type,
                updatedAt: new Date().toISOString()
            };
            localStorage.setItem('clinic_real_lab_files', JSON.stringify(cachedRealFiles));
        } catch (ex) {}

        if (dbError) {
            console.error('Update visit lab pdf_url error:', dbError.message);
        }

        Swal.fire({
            icon: 'success',
            title: 'อัปโหลดสำเร็จ',
            text: `บันทึกไฟล์ผลแล็บจริง "${file.name}" เรียบร้อยแล้ว`,
            timer: 1800,
            showConfirmButton: false
        });

        const modalEl = document.getElementById('labUploadModal');
        if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        loadLabQueue();
        loadQueueList();
        if (typeof loadPrescriptionList === 'function') loadPrescriptionList();
    };

    reader.readAsDataURL(file);
}

// ฟังก์ชั่นเปิดดูเอกสารผลแล็บจริง (PDF / รูปภาพ JPG, PNG, WEBP)
function viewRealLabFile(fileUrl, visitId, patientName) {
    if (!fileUrl || fileUrl === '#' || fileUrl.includes('sample.pdf')) {
        Swal.fire({
            icon: 'warning',
            title: 'ยังไม่มีไฟล์ผลแล็บจริง',
            text: `ผู้ป่วย ${patientName || ''} (${visitId}) ยังไม่ได้ทำการอัปโหลดไฟล์ผลแล็บจากห้อง Lab`,
            confirmButtonColor: '#0b3c73'
        });
        return;
    }

    const isImage = fileUrl.startsWith('data:image/') || 
                    fileUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i);

    if (isImage) {
        Swal.fire({
            title: `<h5 class="fw-bold mb-0 text-primary"><i class="bi bi-file-earmark-image me-2"></i>ผลตรวจ Lab - ${patientName || visitId}</h5>`,
            html: `
                <div class="text-center p-2">
                    <img src="${fileUrl}" class="img-fluid rounded border shadow-sm" style="max-height: 75vh; object-fit: contain;">
                </div>
            `,
            width: '850px',
            showCloseButton: true,
            confirmButtonText: 'ปิดหน้าต่าง',
            confirmButtonColor: '#0b3c73'
        });
    } else {
        let pdfTargetUrl = fileUrl;
        if (fileUrl.startsWith('data:application/pdf;base64,')) {
            try {
                const base64Data = fileUrl.split(',')[1];
                const blob = base64ToBlob(base64Data, 'application/pdf');
                pdfTargetUrl = URL.createObjectURL(blob);
            } catch(e) {
                console.error('Base64 pdf decode error:', e);
            }
        }

        Swal.fire({
            title: `<h5 class="fw-bold mb-0 text-danger"><i class="bi bi-file-earmark-pdf-fill me-2"></i>เอกสารผลแล็บ (PDF) - ${patientName || visitId}</h5>`,
            html: `
                <div class="p-1" style="height: 75vh;">
                    <iframe src="${pdfTargetUrl}#toolbar=1" style="width: 100%; height: 100%; border: 1px solid #cbd5e1; border-radius: 8px;" type="application/pdf"></iframe>
                </div>
            `,
            width: '950px',
            showCloseButton: true,
            confirmButtonText: 'ปิดหน้าต่าง',
            confirmButtonColor: '#0b3c73'
        });
    }
}

function base64ToBlob(base64, type = 'application/octet-stream') {
    const binStr = atob(base64);
    const len = binStr.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        arr[i] = binStr.charCodeAt(i);
    }
    return new Blob([arr], { type: type });
}

// --- อ่านผล & จัดยา ---
window.currentRxMeds = [];
// --- อ่านผล & จัดยา ---
window.currentRxMeds = [];
window.currentRxSource = 'clinic'; // 'clinic', 'mlm', 'all'
window.allMlmProducts = [];

// รายการสินค้าสำรองเริ่มต้นของระบบ MLM (STK GROUPE) กรณีออฟไลน์หรือยังไม่มี DB
window.DEFAULT_MLM_PRODUCTS = [
    { product_id: 'P001', name: 'SESAMIN', category: 'Supplement', current_stock: 87, price_full: 1800, price_member: 1300, price_promo: 800 },
    { product_id: 'P002', name: 'APPLE', category: 'Supplement', current_stock: 93, price_full: 1800, price_member: 1300, price_promo: 800 },
    { product_id: 'P003', name: 'KING_GOLD', category: 'Supplement', current_stock: 91, price_full: 1800, price_member: 1300, price_promo: 800 },
    { product_id: 'P004', name: 'PINE_NEEDLE_OIL', category: 'Supplement', current_stock: 94, price_full: 1800, price_member: 1300, price_promo: 800 },
    { product_id: 'P005', name: 'COCO_BOOM', category: 'Supplement', current_stock: 91, price_full: 1800, price_member: 1300, price_promo: 800 },
    { product_id: 'P006', name: 'CORDESTAR_PLUS', category: 'Supplement', current_stock: 93, price_full: 1800, price_member: 1300, price_promo: 800 },
    { product_id: 'P007', name: 'ORYZA', category: 'Supplement', current_stock: 94, price_full: 1800, price_member: 1300, price_promo: 800 },
    { product_id: 'P008', name: 'COLLAGEN', category: 'Supplement', current_stock: 91, price_full: 1800, price_member: 1300, price_promo: 800 },
    { product_id: 'P009', name: 'Coffee_Arabica', category: 'Coffee', current_stock: 390, price_full: 390, price_member: 390, price_promo: 200 },
    { product_id: 'P010', name: 'STK COFFEE', category: 'Coffee', current_stock: 94, price_full: 590, price_member: 590, price_promo: 280 },
    { product_id: 'P012', name: 'BALANCE (ບາລານ)', category: 'Supplement02', current_stock: 93, price_full: 890, price_member: 850, price_promo: 800 },
    { product_id: 'P013', name: 'KUT-SO (ຄັດໂຊ)', category: 'Supplement02', current_stock: 94, price_full: 890, price_member: 850, price_promo: 800 },
    { product_id: 'P014', name: 'ZINC (ຊີ້ງ)', category: 'Supplement02', current_stock: 94, price_full: 890, price_member: 850, price_promo: 800 },
    { product_id: 'P015', name: 'LUTEIN (ລູທີນ)', category: 'Supplement02', current_stock: 94, price_full: 890, price_member: 850, price_promo: 800 },
    { product_id: 'P016', name: 'L-GLUTA (ກູຕ້າ)', category: 'Supplement02', current_stock: 94, price_full: 890, price_member: 850, price_promo: 800 },
    { product_id: 'P017', name: 'LIPO C (ໄລໂປ້ ຊີ)', category: 'Supplement02', current_stock: 94, price_full: 890, price_member: 850, price_promo: 800 },
    { product_id: 'P018', name: 'ANTI DARK SPOT SERUM (ເຊລໍ່າຝ້າ)', category: 'Cosmetic', current_stock: 94, price_full: 590, price_member: 300, price_promo: 300 },
    { product_id: 'P019', name: 'ACNE SERUM (ເຊລໍ່າສິວ)', category: 'Cosmetic', current_stock: 94, price_full: 590, price_member: 300, price_promo: 300 },
    { product_id: 'P020', name: 'MILK SUNCREAM (ກັນແດດ)', category: 'Cosmetic', current_stock: 194, price_full: 590, price_member: 300, price_promo: 300 },
    { product_id: 'P021', name: 'TONER (ໂທນເນີ)', category: 'Cosmetic', current_stock: 94, price_full: 590, price_member: 300, price_promo: 300 },
    { product_id: 'P022', name: 'UNDERARM CREAM (ຄີມຂີ້ແຮ້)', category: 'Cosmetic', current_stock: 93, price_full: 590, price_member: 300, price_promo: 300 }
];

// ฟังก์ชันดึงข้อมูลสินค้าจากระบบ MLM (stk_products / products)
async function loadMlmProducts() {
    let data = null;
    try {
        if (typeof _supabase !== 'undefined') {
            let res = await _supabase.from('stk_products').select('*');
            if (res.data && res.data.length > 0) {
                data = res.data;
            } else {
                let res2 = await _supabase.from('products').select('*');
                if (res2.data && res2.data.length > 0) data = res2.data;
            }
        }
    } catch (e) {
        console.warn('Load MLM products DB error:', e);
    }

    if (!data || data.length === 0) {
        data = window.DEFAULT_MLM_PRODUCTS;
    }

    window.allMlmProducts = data.map(item => ({
        id: item.product_id || item.id,
        name: item.name,
        type: item.category || 'อาหารเสริม',
        stock: item.current_stock ?? item.stock ?? 0,
        price_normal: parseFloat(item.price_full || item.price || 0),
        price_promo: parseFloat(item.price_promo || 0),
        price_high: parseFloat(item.price_member || 0),
        source: 'mlm',
        raw: item
    }));
}

// ฟังก์ชันสลับการดึงข้อมูลตามคลังที่เลือก (คลังยา Clinic vs คลังสินค้า MLM vs ทั้งหมด)
function setRxStockSource(source, btnEl) {
    window.currentRxSource = source || 'clinic';
    const group = document.getElementById('rxStockSourceGroup');
    if (group) {
        const btns = group.querySelectorAll('button');
        btns.forEach(b => {
            b.classList.remove('btn-primary', 'btn-secondary', 'active');
            b.classList.add('btn-outline-primary');
        });
        if (btnEl) {
            btnEl.classList.remove('btn-outline-primary');
            btnEl.classList.add('btn-primary', 'active');
        }
    }

    // หากเลือกคลังสินค้า MLM และหมวดหมู่ปัจจุบันเป็น "ยา" ให้ปรับหมวดหมู่เป็น "ทั้งหมด" เพื่อให้แสดงรายการสินค้าทันที
    const catSelect = document.getElementById('rxCategorySelect');
    if (source === 'mlm' && catSelect && catSelect.value === 'ยา') {
        catSelect.value = 'all';
    }

    populateRxMedDropdown();
}

function filterMedsByCategory() {
    populateRxMedDropdown();
}

function populateRxMedDropdown() {
    const select = document.getElementById('rxMedSelect');
    const catSelect = document.getElementById('rxCategorySelect');
    if (!select) return;

    const source = window.currentRxSource || 'clinic';
    const category = catSelect ? catSelect.value : 'all';

    let items = [];

    // 1. ดึงข้อมูลจากคลังยา คลินิก (Clinic Stock)
    if (source === 'clinic' || source === 'all') {
        const clinicItems = (window.allMedicines || []).map(m => ({
            id: m.id,
            name: m.name,
            type: m.type || 'ยา',
            stock: m.stock || 0,
            price_normal: m.price_normal || m.price || 0,
            price_promo: m.price_promo || 0,
            price_high: m.price_high || 0,
            source: 'clinic',
            sourceLabel: 'คลังยา'
        }));
        items = items.concat(clinicItems);
    }

    // 2. ดึงข้อมูลจากคลังสินค้า MLM / STK Groupe
    if (source === 'mlm' || source === 'all') {
        // หากไม่มีข้อมูลจาก DB ให้โหลดข้อมูลเริ่มต้น
        if (!window.allMlmProducts || window.allMlmProducts.length === 0) {
            loadMlmProducts();
        }

        const mlmItems = (window.allMlmProducts || []).map(p => ({
            id: p.id,
            name: p.name,
            type: p.type || 'อาหารเสริม',
            stock: p.stock || 0,
            price_normal: p.price_normal || 0,
            price_promo: p.price_promo || 0,
            price_high: p.price_high || 0,
            source: 'mlm',
            sourceLabel: 'STK MLM'
        }));
        items = items.concat(mlmItems);
    }

    // กรองหมวดหมู่สินค้าด้วยความยืดหยุ่น (Smart Category Matching)
    let filteredItems = items;
    if (category !== 'all') {
        filteredItems = items.filter(i => {
            const itemType = (i.type || '').toLowerCase();
            if (category === 'ยา') {
                return itemType === 'ยา' || itemType.includes('med');
            } else if (category === 'อาหารเสริม') {
                return itemType.includes('อาหารเสริม') || itemType.includes('supplement') || itemType.includes('cosmetic') || itemType.includes('coffee');
            }
            return itemType.includes(category.toLowerCase());
        });

        // กรณีเลือกคลัง MLM แต่หมวดหมู่อยู่ที่ "ยา" แล้ว filteredItems ว่าง ให้ fallback แสดงสินค้าทั้งหมดของคลังนั้น
        if (filteredItems.length === 0 && items.length > 0) {
            filteredItems = items;
        }
    }

    select.innerHTML = '<option value="">-- เลือกรายการยา/สินค้า --</option>';

    filteredItems.forEach(item => {
        const label = `${item.id} - ${item.name}`;
        select.innerHTML += `<option value="${item.source}:${item.id}">${label}</option>`;
    });
}

async function openPrescribeModal(visitId, hn, patientName, pdfUrl) {
    document.getElementById('rxVisitId').value = visitId;
    document.getElementById('rxHN').value = hn;
    document.getElementById('rxPatientName').value = patientName;
    document.getElementById('rxVisitIdDisplay').innerText = visitId;
    document.getElementById('rxPatientNameDisplay').innerText = patientName;

    // ดึงข้อมูลผู้ช่วย (Assistant / ReferredBy) สำหรับคนไข้เคสนี้
    let assistantText = 'L03709 - MS CHERRY LOUANGPHAN';
    if (hn) {
        const pat = (window.allPatients || []).find(p => p.hn === hn);
        if (pat && pat.referred_by) {
            assistantText = pat.referred_by;
        }
    }
    if (visitId && typeof _supabase !== 'undefined') {
        try {
            const { data: vData } = await _supabase.from('visits').select('referred_by, hn').eq('visit_id', visitId).single();
            if (vData && vData.referred_by) {
                assistantText = vData.referred_by;
            } else if (vData && vData.hn) {
                const { data: pData } = await _supabase.from('patients').select('referred_by').eq('hn', vData.hn).single();
                if (pData && pData.referred_by) assistantText = pData.referred_by;
            }
        } catch (err) {}
    }

    const assistantEl = document.getElementById('rxAssistantDisplay');
    if (assistantEl) assistantEl.innerText = assistantText;

    // ดึงไฟล์ผลแล็บจริงจาก LocalStorage Cache หรือ Supabase DB แบบ Real-time
    let realFileUrl = (pdfUrl && !pdfUrl.includes('sample.pdf')) ? pdfUrl : '';

    try {
        const cachedRealFiles = JSON.parse(localStorage.getItem('clinic_real_lab_files') || '{}');
        if (cachedRealFiles[visitId] && cachedRealFiles[visitId].url) {
            realFileUrl = cachedRealFiles[visitId].url;
        }
    } catch (e) {}

    if (!realFileUrl && visitId) {
        try {
            const { data, error } = await _supabase
                .from('visits')
                .select('pdf_url')
                .eq('visit_id', visitId)
                .single();
            if (data && data.pdf_url && !data.pdf_url.includes('sample.pdf')) {
                realFileUrl = data.pdf_url;
            }
        } catch (err) {}
    }

    const pdfBtn = document.getElementById('rxPdfBtn');
    if (pdfBtn) {
        const safeName = (patientName || '').replace(/'/g, "\\'");
        if (realFileUrl && realFileUrl !== '') {
            pdfBtn.onclick = function(e) {
                e.preventDefault();
                viewRealLabFile(realFileUrl, visitId, safeName);
            };
            pdfBtn.className = 'btn btn-sm btn-danger px-3 fw-semibold rounded-pill';
            pdfBtn.innerHTML = `<i class="bi bi-file-earmark-pdf me-1"></i> เปิดดูผล Lab`;
        } else {
            pdfBtn.onclick = function(e) {
                e.preventDefault();
                Swal.fire({
                    icon: 'warning',
                    title: 'ยังไม่มีไฟล์ผลแล็บจริง',
                    text: `ผู้ป่วย ${patientName || ''} (${visitId}) ยังไม่ได้ทำการอัปโหลดไฟล์ผลแล็บจากห้อง Lab`,
                    confirmButtonColor: '#0b3c73'
                });
            };
            pdfBtn.className = 'btn btn-sm btn-outline-secondary px-3 opacity-75 rounded-pill';
            pdfBtn.innerHTML = `<i class="bi bi-file-earmark-x me-1"></i> ยังไม่มีผล Lab`;
        }
    }

    window.currentRxMeds = [];
    window.currentRxSource = 'clinic';
    const btnClinic = document.getElementById('btnSourceClinic');
    if (btnClinic) setRxStockSource('clinic', btnClinic);

    // โหลดคลังยา และ คลัง MLM คู่กัน
    await Promise.all([
        typeof loadStockList === 'function' ? loadStockList() : Promise.resolve(),
        loadMlmProducts()
    ]);

    populateRxMedDropdown();
    renderRxMedsTable();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('prescribeModal')).show();
}

function addMedToRx() {
    const select = document.getElementById('rxMedSelect');
    const qtyInput = document.getElementById('rxMedQty');
    const tierSelect = document.getElementById('rxPriceTierSelect');
    if (!select || !select.value || !tierSelect) return;

    const val = select.value;
    const parts = val.split(':');
    const itemSource = parts.length > 1 ? parts[0] : 'clinic';
    const medId = parts.length > 1 ? parts[1] : parts[0];

    const qty = parseInt(qtyInput.value) || 1;
    const selectedTier = tierSelect.value;

    let medDetails = null;
    if (itemSource === 'mlm') {
        medDetails = (window.allMlmProducts || []).find(m => m.id === medId);
    } else {
        medDetails = (window.allMedicines || []).find(m => m.id === medId);
    }

    if (!medDetails) return;

    const medName = medDetails.name;
    const sourceLabel = itemSource === 'mlm' ? 'STK MLM' : 'คลังยา';

    // เลือกราคาสินค้าตามประเภทโปรโมชั่น/สมาชิกที่แพทย์เลือก
    let medPrice = 0;
    let tierLabel = '';

    if (selectedTier === 'normal') {
        medPrice = medDetails.price_normal || medDetails.price || 0;
        tierLabel = ''; // ราคาปกติไม่ต้องต่อชื่อท้าย
    } else if (selectedTier === 'promo') {
        medPrice = medDetails.price_promo || 0;
        tierLabel = ' (โปร)';
    } else if (selectedTier === 'high') {
        medPrice = medDetails.price_high || 0;
        tierLabel = ' (ส่ง/สมาชิก)';
    } else if (selectedTier === 'free') {
        medPrice = 0;
        tierLabel = ' (แถมฟรี)';
    }

    const displayName = medName + tierLabel;

    // ตรวจหาไอเท็มที่มี ID, ประเภทราคา และคลังต้นทางตรงกัน
    const existing = window.currentRxMeds.find(m => m.id === medId && m.tier === selectedTier && m.source === itemSource);
    if (existing) {
        existing.qty += qty;
    } else {
        window.currentRxMeds.push({
            id: medId,
            name: displayName,
            price: medPrice,
            qty: qty,
            tier: selectedTier,
            source: itemSource,
            sourceLabel: sourceLabel
        });
    }

    renderRxMedsTable();
}

function removeMedFromRx(index) { window.currentRxMeds.splice(index, 1); renderRxMedsTable(); }

function renderRxMedsTable() {
    const tbody = document.querySelector('#rxMedsTable tbody');
    tbody.innerHTML = '';
    if (window.currentRxMeds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">ยังไม่มีรายการยา/อาหารเสริม</td></tr>';
        return;
    }

    window.currentRxMeds.forEach((med, index) => {
        let tierText = 'ปกติ';
        if (med.tier === 'promo') tierText = 'โปรโมชั่น';
        else if (med.tier === 'high') tierText = 'ส่ง/สมาชิก';
        else if (med.tier === 'free') tierText = 'แถมฟรี';

        const unitPrice = med.price || 0;
        const qty = med.qty || 0;
        const total = unitPrice * qty;

        // แยกเอาชื่อสะอาดๆ ที่ไม่มีวงเล็บมาแสดงผล
        let cleanName = med.name;
        if (cleanName.endsWith(' (โปร)')) cleanName = cleanName.replace(' (โปร)', '');
        else if (cleanName.endsWith(' (ส่ง/สมาชิก)')) cleanName = cleanName.replace(' (ส่ง/สมาชิก)', '');
        else if (cleanName.endsWith(' (แถมฟรี)')) cleanName = cleanName.replace(' (แถมฟรี)', '');

        let sourceBadge = med.source === 'mlm'
            ? '<span class="badge bg-primary-subtle text-primary border border-primary-subtle ms-2" style="font-size: 0.7rem;">STK MLM</span>'
            : '<span class="badge bg-info-subtle text-info border border-info-subtle ms-2" style="font-size: 0.7rem;">คลังยา</span>';

        tbody.innerHTML += `
            <tr>
                <td class="ps-3 align-middle text-dark fw-medium">${cleanName} ${sourceBadge}</td>
                <td class="text-center align-middle"><span class="badge bg-light text-dark border">${tierText}</span></td>
                <td class="text-end align-middle text-secondary">${unitPrice} ฿</td>
                <td class="text-center align-middle fw-bold">${qty}</td>
                <td class="text-end align-middle fw-bold text-primary">${total} ฿</td>
                <td class="text-center align-middle">
                    <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="removeMedFromRx(${index})"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

async function submitPrescription() {
    const visitId = document.getElementById('rxVisitId').value;
    const patientName = document.getElementById('rxPatientName')?.value || '';

    if (!window.currentRxMeds || window.currentRxMeds.length === 0) {
        Swal.fire('แจ้งเตือน', 'กรุณาเลือกรายการยา/อาหารเสริมที่ต้องการสั่งจ่ายอย่างน้อย 1 รายการ', 'warning');
        return;
    }

    Swal.fire({ title: 'กำลังบันทึกสั่งจ่ายยา...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const medsStr = JSON.stringify(window.currentRxMeds);

    // 1. อัปเดตข้อมูลลง LocalStorage ทันทีเพื่อให้แสดงผลในห้องจ่ายยา 100%
    try {
        let cachedVisits = JSON.parse(localStorage.getItem('clinic_visits_queue') || '[]');
        if (Array.isArray(cachedVisits)) {
            const vIndex = cachedVisits.findIndex(v => v.visit_id === visitId);
            if (vIndex !== -1) {
                cachedVisits[vIndex].meds = medsStr;
                cachedVisits[vIndex].status = 'รอจ่ายยา';
            }
            localStorage.setItem('clinic_visits_queue', JSON.stringify(cachedVisits));
        }
    } catch (ex) {}

    // 2. อัปเดตข้อมูลขึ้น Supabase DB
    try {
        await _supabase
            .from('visits')
            .update({
                meds: medsStr,
                status: 'รอจ่ายยา'
            })
            .eq('visit_id', visitId);
    } catch(err) {
        console.warn('Supabase update visit meds warning:', err);
    }

    Swal.fire('สำเร็จ', 'ส่งข้อมูลไปห้องจ่ายยาเรียบร้อย แพทย์พร้อมรับเคสถัดไปครับ', 'success');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('prescribeModal')).hide();
    if (typeof loadPrescriptionList === 'function') loadPrescriptionList();
    if (typeof loadQueueList === 'function') loadQueueList();
    if (typeof loadPharmacyQueue === 'function') loadPharmacyQueue();
}

// ฟังก์ชันส่งบิลคำสั่งซื้อสารอาหารไประบบ STK GROUPE MLM
async function submitPrescriptionToMlm() {
    const visitId = document.getElementById('rxVisitId').value;
    const hn = document.getElementById('rxHN').value;
    const patientName = document.getElementById('rxPatientName').value;
    const assistant = document.getElementById('rxAssistantDisplay')?.innerText || 'L03709 - MS CHERRY LOUANGPHAN';

    if (!window.currentRxMeds || window.currentRxMeds.length === 0) {
        Swal.fire('แจ้งเตือน', 'กรุณาเลือกรายการสินค้า/สารอาหารที่ต้องการสั่งจ่ายอย่างน้อย 1 รายการ', 'warning');
        return;
    }

    Swal.fire({
        title: 'กำลังส่งรายการสารอาหารไป MLM...',
        html: 'ระบบกำลังเปิดบิลคำสั่งซื้อและบันทึกไปยังระบบ STK MLM',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const totalAmount = window.currentRxMeds.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 1)), 0);
    const orderId = `ORD-CLINIC-${visitId || Date.now()}`;
    const nowIso = new Date().toISOString();

    const salePayload = {
        sale_id: orderId,
        order_id: orderId,
        visit_id: visitId,
        rxVisitId: visitId,
        hn: hn || 'CLINIC-PATIENT',
        customer_id: hn || 'CLINIC-PATIENT',
        customer_name: patientName,
        patient_name: patientName,
        seller_id: assistant,
        recorded_by: assistant,
        items: JSON.stringify(window.currentRxMeds.map(i => {
            let priceTypeName = 'ราคาปกติ';
            if (i.tier === 'promo' || (i.name && i.name.includes('(โปร)'))) priceTypeName = 'ราคาโปร';
            else if (i.tier === 'high' || (i.name && i.name.includes('(ส่ง/สมาชิก)'))) priceTypeName = 'ราคาส่ง/สมาชิก';
            else if (i.tier === 'free' || (i.name && i.name.includes('(แถมฟรี)'))) priceTypeName = 'แถมฟรี';
            else if (i.type && i.type !== 'ONE') priceTypeName = i.type;

            return {
                id: i.id,
                name: i.name || i.title || i.product_name,
                type: priceTypeName,
                priceType: priceTypeName,
                tier: i.tier || 'normal',
                source: i.sourceLabel || i.source || 'คลังยา',
                qty: Number(i.qty || 1),
                price: Number(i.price || 0),
                total: Number((i.price || 0) * (i.qty || 1))
            };
        })),
        products: JSON.stringify(window.currentRxMeds),
        total_amount: totalAmount,
        totalAmount: totalAmount,
        sale_type: 'สั่งซื้อสารอาหาร (Clinic System)',
        saleType: 'สั่งซื้อสารอาหาร (Clinic System)',
        status: 'รอดำเนินการ',
        payment_note: `คำสั่งซื้อสารอาหารจากคลินิก (VISIT: ${visitId}) ผู้ช่วย: ${assistant}`,
        created_at: nowIso,
        date: nowIso
    };

    // 1. บันทึกลง Supabase Table `stk_nutrient_orders` (สำหรับฟังก์ชันสั่งจ่ายสารอาหาร)
    if (typeof _supabase !== 'undefined') {
        try {
            await _supabase.from('stk_nutrient_orders').insert([salePayload]);
        } catch (e) {
            console.warn('Supabase stk_nutrient_orders insert warning:', e);
        }
    }

    // 2. บันทึกลง LocalStorage Cache สำหรับฟังก์ชันสั่งจ่ายสารอาหาร (Nutrients.html)
    try {
        let cachedNutrients = JSON.parse(localStorage.getItem('stk_nutrient_orders') || '[]');
        if (!Array.isArray(cachedNutrients)) cachedNutrients = [];
        cachedNutrients.unshift(salePayload);
        localStorage.setItem('stk_nutrient_orders', JSON.stringify(cachedNutrients));
    } catch (ex) {
        console.warn('LocalStorage save warning:', ex);
    }

    // 3. ปรับสถานะ Visit ใน Clinic System เป็นรอจ่ายยา
    try {
        await _supabase
            .from('visits')
            .update({
                meds: JSON.stringify(window.currentRxMeds),
                status: 'รอจ่ายยา'
            })
            .eq('visit_id', visitId);
    } catch (e) {}

    Swal.fire({
        icon: 'success',
        title: 'ส่งคำสั่งซื้อสารอาหารสำเร็จ!',
        html: `
            <div class="text-start p-2">
                <p class="mb-1"><strong>รหัสบิล MLM:</strong> ${orderId}</p>
                <p class="mb-1"><strong>ผู้ป่วย/คนไข้:</strong> ${patientName} (${hn})</p>
                <p class="mb-1"><strong>ผู้ช่วย:</strong> ${assistant}</p>
                <p class="mb-1"><strong>ยอดรวมสารอาหาร:</strong> <span class="text-success fw-bold">${totalAmount.toLocaleString()} ฿</span></p>
                <hr class="my-2">
                <small class="text-muted"><i class="bi bi-check-circle me-1"></i>ส่งข้อมูลเปิดบิลสั่งซื้อสารอาหารไประบบ STK GROUPE MLM เรียบร้อยแล้ว</small>
            </div>
        `,
        confirmButtonColor: '#047857',
        confirmButtonText: 'ตกลง'
    });

    bootstrap.Modal.getOrCreateInstance(document.getElementById('prescribeModal')).hide();
    if (typeof loadPrescriptionList === 'function') loadPrescriptionList();
    if (typeof loadQueueList === 'function') loadQueueList();
    if (typeof loadPharmacyQueue === 'function') loadPharmacyQueue();
}

// =====================================
// คลังยา & สต็อกสินค้า (Drug Stock Management)
// =====================================
async function loadStockList() {
    const tbody = document.querySelector('#stockMedsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดข้อมูลคลังยา...</td></tr>';

    const { data, error } = await _supabase
        .from('medicines')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle-fill me-2"></i>เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }

    window.allMedicines = data; // อัปเดตข้อมูลกลางไปในตัว

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-5">ไม่มีสินค้าในคลังยา</td></tr>';
        return;
    }

    renderStockTable(data);

    // ดึงค่าการฟิลเตอร์หมวดหมู่ปัจจุบันมาใช้งาน
    filterStockTable(window.currentStockFilter || 'all');
}

function renderStockTable(list) {
    const tbody = document.querySelector('#stockMedsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    list.forEach(med => {
        const typeBadge = med.type === 'อาหารเสริม'
            ? '<span class="badge px-2.5 py-1.5" style="border: none !important; font-size: 0.78rem; font-weight: 500; background-color: #d1fae5 !important; color: #065f46 !important; border-radius: 6px;">อาหารเสริม</span>'
            : '<span class="badge px-2.5 py-1.5" style="border: none !important; font-size: 0.78rem; font-weight: 500; background-color: #dbeafe !important; color: #1e40af !important; border-radius: 6px;">ยา</span>';

        const stockClass = (med.stock || 0) <= 10 ? 'text-danger fw-bold' : 'text-dark';

        const freeBadge = med.is_free_gift
            ? '<span class="badge bg-success px-2.5 py-1.5 d-inline-flex align-items-center gap-1" style="background-color: #198754 !important; font-size: 0.78rem; font-weight: 500; border-radius: 6px;"><i class="bi bi-gift-fill"></i> อนุญาต</span>'
            : '<span class="badge bg-secondary text-white px-2.5 py-1.5 d-inline-flex align-items-center gap-1" style="background-color: #6c757d !important; font-size: 0.78rem; font-weight: 500; border-radius: 6px;"><i class="bi bi-x-circle-fill"></i> ไม่อนุญาต</span>';

        tbody.innerHTML += `
            <tr data-name="${(med.name || '').toLowerCase()}" data-type="${med.type || 'ยา'}">
                <td class="ps-3 fw-bold text-secondary small">${med.id}</td>
                <td class="fw-medium text-dark">${med.name}</td>
                <td class="text-center">${typeBadge}</td>
                <td class="text-center ${stockClass}">${med.stock || 0}</td>
                <td class="text-center fw-bold text-secondary">${med.price_normal || med.price || 0} ฿</td>
                <td class="text-center fw-bold text-success">${med.price_promo || 0} ฿</td>
                <td class="text-center fw-bold text-danger">${med.price_high || 0} ฿</td>
                <td class="text-center">${freeBadge}</td>
                <td class="text-center">
                    <div class="d-flex flex-column align-items-center gap-1">
                        <button class="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center px-3 py-1" 
                            style="border-radius:20px; font-size:0.75rem; width: 64px; border: 1.5px solid #0d6efd;" 
                            onclick="editMedicine('${med.id}')">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center px-3 py-1" 
                            style="border-radius:20px; font-size:0.75rem; width: 64px; border: 1.5px solid #dc3545;" 
                            onclick="deleteMedicine('${med.id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

window.currentStockFilter = 'all';

function filterStockTable(type, btnEl) {
    window.currentStockFilter = type;

    const links = document.querySelectorAll('#stockCategoryFilterGroup a');
    if (links.length > 0) {
        links.forEach(lnk => {
            lnk.classList.remove('fw-bold', 'text-primary');
            lnk.classList.add('text-secondary');
        });

        let targetEl = btnEl;
        if (!targetEl) {
            if (type === 'all') targetEl = links[0];
            else if (type === 'ยา') targetEl = links[1];
            else if (type === 'อาหารเสริม') targetEl = links[2];
        }
        if (targetEl) {
            targetEl.classList.add('fw-bold', 'text-primary');
            targetEl.classList.remove('text-secondary');
        }
    }

    const q = document.getElementById('searchStockInput').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#stockMedsTable tbody tr');

    rows.forEach(row => {
        const rowType = row.getAttribute('data-type') || 'ยา';
        const nameAttr = row.getAttribute('data-name') || '';

        const matchesType = (type === 'all') || (rowType === type);
        const matchesSearch = !q || nameAttr.includes(q);

        if (matchesType && matchesSearch) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function searchMedicineStock() {
    filterStockTable(window.currentStockFilter || 'all');
}

function openAddMedicineModal() {
    cancelEditMedicine();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('stockMedicineModal')).show();
}

function editMedicine(medId) {
    const med = (window.allMedicines || []).find(m => m.id === medId);
    if (!med) return;

    // เปลี่ยนโหมดฟอร์มเป็น แก้ไข
    document.getElementById('stockAction').value = 'edit';
    document.getElementById('stockFormTitle').innerHTML = '<i class="bi bi-pencil-square text-warning me-2"></i>แก้ไขรายการยา/อาหารเสริม';

    // ล็อค ID ห้ามแก้ไข
    const idInput = document.getElementById('stockMedId');
    idInput.value = med.id;
    idInput.disabled = true;

    document.getElementById('stockMedName').value = med.name;
    document.getElementById('stockMedType').value = med.type || 'ยา';
    document.getElementById('stockMedQty').value = med.stock || 0;

    document.getElementById('stockMedPriceNormal').value = med.price_normal || med.price || 0;
    document.getElementById('stockMedPricePromo').value = med.price_promo || 0;
    document.getElementById('stockMedPriceHigh').value = med.price_high || 0;
    document.getElementById('stockMedIsFree').checked = med.is_free_gift || false;

    // แสดงหน้าต่าง Modal
    bootstrap.Modal.getOrCreateInstance(document.getElementById('stockMedicineModal')).show();
}

function cancelEditMedicine() {
    document.getElementById('stockMedicineForm').reset();
    document.getElementById('stockAction').value = 'add';
    document.getElementById('stockFormTitle').innerHTML = '<i class="bi bi-pencil-square text-primary me-2"></i>เพิ่มรายการยา/อาหารเสริม';

    const idInput = document.getElementById('stockMedId');
    idInput.disabled = false;
    document.getElementById('stockMedIsFree').checked = false;
}

async function submitMedicineStock() {
    const action = document.getElementById('stockAction').value;
    const id = document.getElementById('stockMedId').value.trim();
    const name = document.getElementById('stockMedName').value.trim();
    const type = document.getElementById('stockMedType').value;
    const stock = parseInt(document.getElementById('stockMedQty').value);

    const priceNormal = parseFloat(document.getElementById('stockMedPriceNormal').value || 0);
    const pricePromo = parseFloat(document.getElementById('stockMedPricePromo').value || 0);
    const priceHigh = parseFloat(document.getElementById('stockMedPriceHigh').value || 0);
    const isFree = document.getElementById('stockMedIsFree').checked;

    if (!id || !name) {
        Swal.fire('ข้อผิดพลาด', 'กรุณากรอกรหัสและชื่อยา/อาหารเสริม', 'error');
        return;
    }

    Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const payload = {
        id: id,
        name: name,
        type: type,
        stock: stock,
        price: priceNormal, // รักษาคอลัมน์ดั้งเดิมไว้
        price_normal: priceNormal,
        price_promo: pricePromo,
        price_high: priceHigh,
        is_free_gift: isFree
    };

    let response;
    if (action === 'add') {
        // เช็คก่อนว่ารหัสซ้ำไหม
        const { data: existing } = await _supabase.from('medicines').select('id').eq('id', id).maybeSingle();
        if (existing) {
            Swal.fire('รหัสสินค้าซ้ำ', `รหัสสินค้า ${id} นี้ถูกใช้งานไปแล้วกับยาอื่น กรุณาตรวจสอบใหม่`, 'warning');
            return;
        }
        response = await _supabase.from('medicines').insert([payload]);
    } else {
        response = await _supabase.from('medicines').update(payload).eq('id', id);
    }

    if (response.error) {
        Swal.fire('เกิดข้อผิดพลาด', response.error.message, 'error');
    } else {
        Swal.fire('สำเร็จ', 'บันทึกข้อมูลสินค้าเรียบร้อยแล้ว', 'success');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('stockMedicineModal')).hide();
        cancelEditMedicine();
        loadStockList();
    }
}

async function deleteMedicine(medId) {
    const med = (window.allMedicines || []).find(m => m.id === medId);
    if (!med) return;

    const result = await Swal.fire({
        title: 'ยืนยันการลบ?',
        text: `คุณต้องการลบรายการ "${med.name}" ออกจากคลังยาใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ใช่, ต้องการลบ!',
        cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
        Swal.fire({ title: 'กำลังลบข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const { error } = await _supabase.from('medicines').delete().eq('id', medId);

        if (error) {
            Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
        } else {
            Swal.fire('ลบแล้ว!', 'ลบสินค้าออกจากคลังยาเรียบร้อย', 'success');
            loadStockList();
        }
    }
}

// =====================================
// ห้องจ่ายยา (Dispensing Room / Pharmacy)
// =====================================
async function loadPharmacyQueue() {
    const tbody = document.querySelector('#pharmacyTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดข้อมูลผู้ป่วยรอจ่ายยา...</td></tr>';

    let data = [];
    try {
        const res = await _supabase
            .from('visits')
            .select('*')
            .eq('status', 'รอจ่ายยา')
            .order('created_at', { ascending: true });
        if (res && res.data) data = res.data;
    } catch(e) {
        console.warn('Load pharmacy queue DB notice:', e);
    }

    // Merge fallback จาก LocalStorage เพื่อความเสถียร 100%
    try {
        const cachedVisits = JSON.parse(localStorage.getItem('clinic_visits_queue') || '[]');
        if (Array.isArray(cachedVisits)) {
            const map = new Map();
            data.forEach(v => { if (v && v.visit_id) map.set(v.visit_id, v); });
            cachedVisits.forEach(v => {
                if (v && v.visit_id && v.status === 'รอจ่ายยา') {
                    const existing = map.get(v.visit_id) || {};
                    map.set(v.visit_id, { ...existing, ...v });
                }
            });
            data = Array.from(map.values());
        }
    } catch(e) {}

    tbody.innerHTML = '';
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-5">ไม่มีรายการรอจ่ายยา</td></tr>';
        return;
    }

    data.forEach(row => {
        let medsHtml = '';
        if (row.meds) {
            try {
                const medsList = JSON.parse(row.meds);
                if (medsList && medsList.length > 0) {
                    medsHtml = `<div class="table-responsive"><table class="table table-sm table-bordered mb-0 bg-light" style="font-size: 0.85rem;">
                        <thead>
                            <tr class="table-secondary">
                                <th class="ps-2">ชื่อยา/อาหารเสริม</th>
                                <th class="text-center" width="80">ประเภท</th>
                                <th class="text-center" width="70">จำนวน</th>
                            </tr>
                        </thead>
                        <tbody>`;

                    medsList.forEach(m => {
                        let tierText = 'ปกติ';
                        let badgeClass = 'bg-secondary-subtle text-dark border';
                        if (m.tier === 'promo') {
                            tierText = 'โปรโมชั่น';
                            badgeClass = 'bg-warning-subtle text-warning-emphasis border border-warning';
                        } else if (m.tier === 'high') {
                            tierText = 'ส่ง/สมาชิก';
                            badgeClass = 'bg-primary-subtle text-primary-emphasis border border-primary';
                        } else if (m.tier === 'free') {
                            tierText = 'แถมฟรี';
                            badgeClass = 'bg-danger-subtle text-danger-emphasis border border-danger';
                        }

                        let cleanName = m.name;
                        if (cleanName.endsWith(' (โปร)')) cleanName = cleanName.replace(' (โปร)', '');
                        else if (cleanName.endsWith(' (ส่ง/สมาชิก)')) cleanName = cleanName.replace(' (ส่ง/สมาชิก)', '');
                        else if (cleanName.endsWith(' (แถมฟรี)')) cleanName = cleanName.replace(' (แถมฟรี)', '');

                        let srcBadge = m.source === 'mlm'
                            ? '<span class="badge bg-primary-subtle text-primary border border-primary-subtle ms-1" style="font-size: 0.68rem;">STK MLM</span>'
                            : '<span class="badge bg-info-subtle text-info border border-info-subtle ms-1" style="font-size: 0.68rem;">คลังยา</span>';

                        medsHtml += `<tr>
                            <td class="ps-2 fw-medium text-dark">${cleanName} ${srcBadge}</td>
                            <td class="text-center"><span class="badge ${badgeClass}" style="font-size: 0.75rem;">${tierText}</span></td>
                            <td class="text-center fw-bold text-primary">${m.qty}</td>
                        </tr>`;
                    });
                    medsHtml += `</tbody></table></div>`;
                } else {
                    medsHtml = '<span class="text-muted small">ไม่มีรายการยา</span>';
                }
            } catch (e) {
                console.error("Error parsing meds JSON:", e);
                medsHtml = '<span class="text-danger small">ข้อมูลยาไม่ถูกต้อง</span>';
            }
        } else {
            medsHtml = '<span class="text-muted small">ไม่มีข้อมูลยา</span>';
        }

        const actionBtn = `<button class="btn btn-sm btn-success px-3 fw-bold" onclick="completeDispensing('${row.visit_id}')"><i class="bi bi-check-circle me-1"></i> จ่ายยาเสร็จสิ้น</button>`;

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 fw-bold text-primary">${row.visit_id}</td>
                <td>${row.hn}</td>
                <td class="fw-bold text-dark">${row.patient_name}</td>
                <td>${medsHtml}</td>
                <td class="text-center">${actionBtn}</td>
            </tr>
        `;
    });
}

async function completeDispensing(visitId) {
    const result = await Swal.fire({
        title: 'ยืนยันจ่ายยา?',
        text: `ต้องการยืนยันเสร็จสิ้นการจ่ายยาสำหรับเคส ${visitId} ใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ยืนยันจ่ายยา',
        cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const { error } = await _supabase
        .from('visits')
        .update({ status: 'เสร็จสิ้น' })
        .eq('visit_id', visitId);

    if (error) {
        Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
    } else {
        if (typeof processPaymentCommission === 'function') {
            await processPaymentCommission(visitId);
        }
        Swal.fire('สำเร็จ', 'จ่ายยาและเสร็จสิ้นเคสเรียบร้อยแล้ว', 'success');
        loadPharmacyQueue();
    }
}

// =====================================
// ประวัติผู้ป่วย (Patient History)
// =====================================
async function loadPatientHistory() {
    const tbody = document.querySelector('#historyTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดข้อมูลประวัติการรักษา...</td></tr>';

    let data = [];
    try {
        const res = await _supabase
            .from('visits')
            .select('*')
            .order('created_at', { ascending: false });
        if (res && res.data && res.data.length > 0) {
            data = res.data;
        }
    } catch(e) {
        console.warn('Load history visits DB notice:', e);
    }

    // Merge fallback จาก LocalStorage เพื่อความสมบูรณ์
    try {
        const cachedVisits = JSON.parse(localStorage.getItem('clinic_visits_queue') || '[]');
        if (Array.isArray(cachedVisits)) {
            const map = new Map();
            data.forEach(v => { if (v && (v.visit_id || v.id)) map.set(v.visit_id || v.id, v); });
            cachedVisits.forEach(v => {
                if (v && (v.visit_id || v.id)) {
                    const vKey = v.visit_id || v.id;
                    const existing = map.get(vKey) || {};
                    map.set(vKey, { ...existing, ...v, visit_id: vKey });
                }
            });
            data = Array.from(map.values());
        }
    } catch(e) {}

    // กรองเอาเฉพาะรายการที่มีข้อมูลผู้ป่วย หรือเลือกแสดงรายการเสร็จสิ้น/ทั้งหมดที่ไม่เป็นค่าว่าง
    if (data.length > 0) {
        const completedVisits = data.filter(v => 
            !v.status || 
            v.status === 'เสร็จสิ้น' || 
            v.status === 'สำเร็จ' || 
            v.status === 'จ่ายเงินแล้ว' || 
            v.status === 'รับยาแล้ว' ||
            v.status === 'เรียบร้อย'
        );
        if (completedVisits.length > 0) {
            data = completedVisits;
        }
    }

    window.allHistoryVisits = data;
    renderHistoryTable(window.allHistoryVisits);
}

function renderHistoryTable(list) {
    const tbody = document.querySelector('#historyTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">ไม่มีข้อมูลประวัติผู้ป่วย</td></tr>';
        return;
    }

    list.forEach(row => {
        let formattedDate = '-';
        if (row.created_at) {
            const dateObj = new Date(row.created_at);
            formattedDate = dateObj.toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) + ' น.';
        }

        const actionBtn = `
            <div class="d-flex justify-content-center gap-1">
                <button class="btn btn-sm btn-outline-primary px-2.5 py-1 fw-semibold" onclick="showHistoryDetails('${row.visit_id}')" title="ดูรายละเอียด">
                    <i class="bi bi-eye me-1"></i> ดูรายละเอียด
                </button>
                <button class="btn btn-sm btn-outline-danger px-2.5 py-1 fw-semibold" onclick="deleteHistoryVisit('${row.visit_id}')" title="ลบรายการนี้">
                    <i class="bi bi-trash me-1"></i> ลบ
                </button>
            </div>
        `;

        tbody.innerHTML += `
            <tr data-visit-id="${(row.visit_id || '').toLowerCase()}" data-hn="${(row.hn || '').toLowerCase()}" data-name="${(row.patient_name || '').toLowerCase()}">
                <td class="ps-4 fw-bold text-primary">${row.visit_id || '-'}</td>
                <td class="fw-bold">${row.hn || '-'}</td>
                <td class="fw-bold text-dark">${row.patient_name || '-'}</td>
                <td>${formattedDate}</td>
                <td>${row.symptom || row.reason || row.lab_tests || '<span class="text-muted">-</span>'}</td>
                <td class="text-center">${actionBtn}</td>
            </tr>
        `;
    });
}

function searchPatientHistory() {
    const input = document.getElementById('searchHistoryInput');
    if (!input) return;
    const query = input.value.trim().toLowerCase();

    if (!window.allHistoryVisits) return;

    if (!query) {
        renderHistoryTable(window.allHistoryVisits);
        return;
    }

    const filtered = window.allHistoryVisits.filter(row => {
        const vId = (row.visit_id || '').toLowerCase();
        const hn = (row.hn || '').toLowerCase();
        const name = (row.patient_name || '').toLowerCase();
        const symptom = (row.symptom || '').toLowerCase();
        return vId.includes(query) || hn.includes(query) || name.includes(query) || symptom.includes(query);
    });

    renderHistoryTable(filtered);
}

async function deleteHistoryVisit(visitId) {
    if (!visitId) return;

    const row = (window.allHistoryVisits || []).find(v => v.visit_id === visitId);
    const pName = row ? row.patient_name : visitId;

    const result = await Swal.fire({
        title: 'ยืนยันการลบประวัติ?',
        text: `คุณต้องการลบประวัติการเข้าตรวจของ ${pName} (${visitId}) ใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, ลบรายการนี้',
        cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    Swal.fire({ title: 'กำลังลบข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    // 1. ลบออกจาก LocalStorage
    try {
        let cachedVisits = JSON.parse(localStorage.getItem('clinic_visits_queue') || '[]');
        if (Array.isArray(cachedVisits)) {
            cachedVisits = cachedVisits.filter(v => v.visit_id !== visitId);
            localStorage.setItem('clinic_visits_queue', JSON.stringify(cachedVisits));
        }
    } catch (e) {}

    // 2. ลบออกจาก Supabase DB
    try {
        await _supabase.from('visits').delete().eq('visit_id', visitId);
    } catch (e) {
        console.warn('Delete visit DB warning:', e);
    }

    Swal.fire('สำเร็จ', 'ลบประวัติการตรวจเรียบร้อยแล้ว', 'success');
    loadPatientHistory();
}

async function deleteAllHistoryVisits() {
    if (!window.allHistoryVisits || window.allHistoryVisits.length === 0) {
        Swal.fire('แจ้งเตือน', 'ไม่มีประวัติผู้ป่วยให้ลบในขณะนี้', 'info');
        return;
    }

    const totalCount = window.allHistoryVisits.length;

    const result = await Swal.fire({
        title: '⚠️ ยืนยันลบประวัติผู้ป่วยทั้งหมด?',
        text: `คุณกำลังจะลบประวัติการเข้าตรวจผู้ป่วยทั้งหมด ${totalCount} รายการ ออกจากระบบอย่างถาวร!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, ลบทั้งหมด',
        cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    Swal.fire({ title: 'กำลังลบประวัติทั้งหมด...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    // 1. ลบจาก LocalStorage
    try {
        let cachedVisits = JSON.parse(localStorage.getItem('clinic_visits_queue') || '[]');
        if (Array.isArray(cachedVisits)) {
            cachedVisits = cachedVisits.filter(v => v.status !== 'เสร็จสิ้น');
            localStorage.setItem('clinic_visits_queue', JSON.stringify(cachedVisits));
        }
    } catch (e) {}

    // 2. ลบจาก Supabase DB
    try {
        await _supabase.from('visits').delete().eq('status', 'เสร็จสิ้น');
    } catch (e) {
        console.warn('Delete all history visits DB error:', e);
    }

    Swal.fire('สำเร็จ', 'ลบประวัติการตรวจผู้ป่วยทั้งหมดเรียบร้อยแล้ว', 'success');
    loadPatientHistory();
}



async function showHistoryDetails(visitId) {
    const row = (window.allHistoryVisits || []).find(v => v.visit_id === visitId);
    if (!row) {
        Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลการตรวจรักษานี้', 'error');
        return;
    }

    let formattedDate = '-';
    if (row.created_at) {
        const dateObj = new Date(row.created_at);
        formattedDate = dateObj.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) + ' น.';
    }

    document.getElementById('histVisitId').innerText = row.visit_id;
    document.getElementById('histDate').innerText = formattedDate;
    document.getElementById('histPatientName').innerText = row.patient_name;
    document.getElementById('histHN').innerText = row.hn;

    // ประมวลผลและแสดงผลข้อมูลผู้แนะนำ (Referrer)
    let refId = row.referred_by;
    if (!refId && row.hn) {
        const pat = (window.allPatients || []).find(p => p.hn === row.hn || p.patient_name === row.patient_name);
        if (pat && pat.referred_by) refId = pat.referred_by;
    }
    if (!refId && row.appointment_id) {
        const appt = (window.allAppointments || []).find(a => a.appointment_id === row.appointment_id);
        if (appt && appt.referred_by) refId = appt.referred_by;
    }
    if (!refId) {
        refId = (window.hnReferrerMap && window.hnReferrerMap[row.hn]) 
             || (window.patientReferrersMap && window.patientReferrersMap[row.hn]) 
             || (window.nameReferrerMap && window.nameReferrerMap[row.patient_name])
             || (window.appointmentReferrersMap && row.appointment_id && window.appointmentReferrersMap[row.appointment_id]);
    }

    const refContainer = document.getElementById('histReferrerContainer');
    const refElem = document.getElementById('histReferrer');

    if (refId && refId !== '-' && refId !== 'undefined' && refId !== 'null') {
        const refObj = (window.referrersData || []).find(r => r.id === refId || r.code === refId || r.name === refId);
        const staffObj = (window.allStaffUsers || window.defaultTeamStaffUsers || []).find(s => s.emp_code === refId || s.id === refId || s.full_name === refId);
        
        let displayRef = '';
        if (refObj) {
            const codeText = refObj.code || refObj.id;
            displayRef = `${refObj.name} (${codeText})`;
        } else if (staffObj) {
            const codeText = staffObj.emp_code || 'STAFF';
            displayRef = `${staffObj.full_name} (${codeText})`;
        } else {
            displayRef = refId;
        }

        if (refElem) refElem.innerHTML = `<i class="ph ph-hand-coins me-1 text-primary"></i>${displayRef}`;
        if (refContainer) refContainer.style.display = 'block';
    } else {
        if (refContainer) refContainer.style.display = 'none';
        if (refElem) refElem.innerText = '-';
    }

    document.getElementById('histTemp').innerText = row.temp || '-';
    document.getElementById('histBP').innerText = row.bp || '-';
    document.getElementById('histPulse').innerText = row.pulse || '-';
    document.getElementById('histSpo2').innerText = row.spo2 || '-';
    document.getElementById('histWeight').innerText = row.weight || '-';
    document.getElementById('histHeight').innerText = row.height || '-';
    document.getElementById('histBMI').innerText = row.bmi || '-';

    document.getElementById('histSymptom').innerText = row.symptom || 'ไม่มีระบุ';

    const pdfContainer = document.getElementById('histPdfContainer');
    if (row.pdf_url && row.pdf_url !== '') {
        const safeName = (row.patient_name || '').replace(/'/g, "\\'");
        pdfContainer.innerHTML = `<button type="button" onclick="viewRealLabFile('${row.pdf_url}', '${row.visit_id}', '${safeName}')" class="btn btn-sm btn-danger px-3"><i class="bi bi-file-earmark-text me-1"></i> เปิดดูผล Lab</button>`;
    } else {
        pdfContainer.innerHTML = `<span class="text-muted small">ไม่มีเอกสารผลแล็บ</span>`;
    }

    const labContainer = document.getElementById('histLabContainer');
    if (row.lab_tests && row.lab_tests !== '') {
        labContainer.style.display = 'block';
        document.getElementById('histLabTests').innerText = row.lab_tests;
    } else {
        labContainer.style.display = 'none';
    }

    const medsTbody = document.querySelector('#histMedsTable tbody');
    medsTbody.innerHTML = '';
    if (row.meds) {
        try {
            // รองรับทั้ง JSON array, double-encoded JSON, หรือ plain string
            let medsRaw = row.meds;
            if (typeof medsRaw === 'string') {
                medsRaw = medsRaw.trim();
                // ถ้าเป็น double-encoded: ขึ้นต้นด้วย "\"
                if (medsRaw.startsWith('"[') || medsRaw.startsWith('"\\"')) {
                    medsRaw = JSON.parse(medsRaw);
                }
            }
            const medsList = typeof medsRaw === 'string' ? JSON.parse(medsRaw) : medsRaw;
            if (Array.isArray(medsList) && medsList.length > 0) {
                medsList.forEach(m => {
                    let tierText = 'ปกติ';
                    let badgeClass = 'bg-secondary-subtle text-dark border';
                    if (m.tier === 'promo') {
                        tierText = 'โปรโมชั่น';
                        badgeClass = 'bg-warning-subtle text-warning-emphasis border border-warning';
                    } else if (m.tier === 'high') {
                        tierText = 'ส่ง/สมาชิก';
                        badgeClass = 'bg-primary-subtle text-primary-emphasis border border-primary';
                    } else if (m.tier === 'free') {
                        tierText = 'แถมฟรี';
                        badgeClass = 'bg-danger-subtle text-danger-emphasis border border-danger';
                    }

                    let cleanName = m.name || String(m);
                    if (cleanName.endsWith(' (โปร)')) cleanName = cleanName.replace(' (โปร)', '');
                    else if (cleanName.endsWith(' (ส่ง/สมาชิก)')) cleanName = cleanName.replace(' (ส่ง/สมาชิก)', '');
                    else if (cleanName.endsWith(' (แถมฟรี)')) cleanName = cleanName.replace(' (แถมฟรี)', '');

                    let srcBadge = m.source === 'mlm'
                        ? '<span class="badge bg-primary-subtle text-primary border border-primary-subtle ms-1" style="font-size: 0.68rem;">STK MLM</span>'
                        : '<span class="badge bg-info-subtle text-info border border-info-subtle ms-1" style="font-size: 0.68rem;">คลังยา</span>';

                    medsTbody.innerHTML += `
                        <tr>
                            <td class="ps-3 align-middle text-dark fw-medium">${cleanName} ${srcBadge}</td>
                            <td class="text-center align-middle"><span class="badge ${badgeClass}" style="font-size: 0.75rem;">${tierText}</span></td>
                            <td class="text-center align-middle fw-bold text-primary">${m.qty || 1}</td>
                        </tr>
                    `;
                });
            } else {
                medsTbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">ไม่มีรายการยา/อาหารเสริมสั่งจ่าย</td></tr>';
            }
        } catch (e) {
            console.warn('Error parsing meds JSON, showing raw:', e);
            // Fallback: ถ้า meds เป็น plain text ให้แสดงตรงๆ
            if (typeof row.meds === 'string' && row.meds.trim()) {
                const items = row.meds.split(',').map(s => s.trim()).filter(Boolean);
                if (items.length > 0) {
                    medsTbody.innerHTML = items.map((item, i) =>
                        `<tr><td class="ps-3 text-dark fw-medium">${item}</td><td class="text-center">-</td><td class="text-center">-</td></tr>`
                    ).join('');
                } else {
                    medsTbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger py-3">ข้อมูลยาไม่ถูกต้อง</td></tr>';
                }
            } else {
                medsTbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">ไม่มีรายการยา/อาหารเสริมสั่งจ่าย</td></tr>';
            }
        }
    } else {
        medsTbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">ไม่มีรายการยา/อาหารเสริมสั่งจ่าย</td></tr>';
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('historyDetailModal')).show();
}

// =====================================
// คลังพัสดุ (Supply Room Management)
// =====================================
async function loadSupplyItems() {
    const tbody = document.querySelector('#supplyItemsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดข้อมูลคลังพัสดุ...</td></tr>';

    const { data, error } = await _supabase
        .from('supplies')
        .select('*')
        .order('name', { ascending: true });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle-fill me-2"></i>เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }

    window.allSupplyItems = data || [];
    renderSupplyTable(window.allSupplyItems);
    updateSupplyStats(window.allSupplyItems);
}

function renderSupplyTable(list) {
    const tbody = document.querySelector('#supplyItemsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">ไม่มีรายการพัสดุในคลัง</td></tr>';
        return;
    }

    list.forEach(item => {
        const stock = item.stock || 0;
        const stockClass = stock <= 0 ? 'text-danger fw-bold' : stock <= 5 ? 'text-warning fw-bold' : 'text-success fw-bold';
        const stockBadge = stock <= 0
            ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle fs-6 px-3">${stock}</span>`
            : stock <= 5
                ? `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fs-6 px-3">${stock}</span>`
                : `<span class="badge bg-success-subtle text-success-emphasis border border-success-subtle fs-6 px-3">${stock}</span>`;

        let typeBadge = `<span class="badge bg-secondary-subtle text-secondary border" style="font-size:0.75rem;">${item.type || 'อื่นๆ'}</span>`;
        if (item.type === 'อุปกรณ์การแพทย์') typeBadge = `<span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="font-size:0.75rem;"><i class="bi bi-heart-pulse me-1"></i>${item.type}</span>`;
        else if (item.type === 'วัสดุสิ้นเปลือง') typeBadge = `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle" style="font-size:0.75rem;"><i class="bi bi-bag me-1"></i>${item.type}</span>`;
        else if (item.type === 'ครุภัณฑ์') typeBadge = `<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle" style="font-size:0.75rem;"><i class="bi bi-tools me-1"></i>${item.type}</span>`;
        else if (item.type === 'เอกสาร/แบบฟอร์ม') typeBadge = `<span class="badge bg-success-subtle text-success-emphasis border border-success-subtle" style="font-size:0.75rem;"><i class="bi bi-file-text me-1"></i>${item.type}</span>`;

        tbody.innerHTML += `
            <tr data-supply-name="${(item.name || '').toLowerCase()}" data-supply-type="${(item.type || '').toLowerCase()}">
                <td class="ps-4 fw-bold text-secondary small">${item.id}</td>
                <td class="fw-medium text-dark">${item.name}<br><span class="text-muted small">${item.note || ''}</span></td>
                <td class="text-center">${typeBadge}</td>
                <td class="text-center">${stockBadge}</td>
                <td class="text-center text-muted fw-medium">${item.unit || '-'}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-success py-0 px-2 me-1 text-white fw-bold" title="รับเข้าพัสดุ" onclick="openSupplyIntakeModal('${item.id}', '${item.name}', ${stock}, '${item.unit || ''}')"><i class="bi bi-box-arrow-in-down"></i> รับเข้า</button>
                    <button class="btn btn-sm btn-warning py-0 px-2 me-1 text-white" title="เบิกพัสดุ" ${stock <= 0 ? 'disabled' : ''} onclick="openSupplyReqModal('${item.id}', '${item.name}', ${stock}, '${item.unit || ''}')"><i class="bi bi-box-arrow-up"></i> เบิก</button>
                    <button class="btn btn-sm btn-outline-primary py-0 px-2 me-1" title="แก้ไข" onclick="editSupplyItem('${item.id}')"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger py-0 px-2" title="ลบ" onclick="deleteSupplyItem('${item.id}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function filterSupplyTable() {
    const q = document.getElementById('searchSupplyInput').value.toLowerCase().trim();
    if (!q) { renderSupplyTable(window.allSupplyItems || []); return; }
    const filtered = (window.allSupplyItems || []).filter(i =>
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.type && i.type.toLowerCase().includes(q)) ||
        (i.unit && i.unit.toLowerCase().includes(q))
    );
    renderSupplyTable(filtered);
}

function updateSupplyStats(list) {
    const totalEl = document.getElementById('statTotalItems');
    const lowEl = document.getElementById('statLowStock');
    if (totalEl) totalEl.innerText = list.length;
    const low = list.filter(i => (i.stock || 0) <= 5).length;
    if (lowEl) lowEl.innerText = low;
}

function openAddSupplyModal() {
    document.getElementById('supplyItemId').value = '';
    document.getElementById('supplyItemModalTitle').innerHTML = '<i class="bi bi-boxes text-primary me-2"></i>เพิ่มรายการพัสดุ';
    document.getElementById('supplyItemForm').reset();
    document.getElementById('supplyStock').value = 0;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('supplyItemModal')).show();
}

function editSupplyItem(id) {
    const item = (window.allSupplyItems || []).find(i => i.id === id);
    if (!item) return;
    document.getElementById('supplyItemId').value = item.id;
    document.getElementById('supplyItemModalTitle').innerHTML = '<i class="bi bi-pencil-square text-primary me-2"></i>แก้ไขรายการพัสดุ';
    document.getElementById('supplyName').value = item.name || '';
    document.getElementById('supplyType').value = item.type || 'วัสดุสิ้นเปลือง';
    document.getElementById('supplyUnit').value = item.unit || '';
    document.getElementById('supplyStock').value = item.stock || 0;
    document.getElementById('supplyNote').value = item.note || '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('supplyItemModal')).show();
}

async function saveSupplyItem() {
    const id = document.getElementById('supplyItemId').value;
    const payload = {
        name: document.getElementById('supplyName').value,
        type: document.getElementById('supplyType').value,
        unit: document.getElementById('supplyUnit').value,
        stock: parseInt(document.getElementById('supplyStock').value) || 0,
        note: document.getElementById('supplyNote').value || null
    };

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    let response;
    if (!id) {
        payload.id = 'SUP-' + Math.floor(100000 + Math.random() * 900000);
        response = await _supabase.from('supplies').insert([payload]);
    } else {
        response = await _supabase.from('supplies').update(payload).eq('id', id);
    }

    if (response.error) {
        Swal.fire('เกิดข้อผิดพลาด', response.error.message, 'error');
    } else {
        Swal.fire('สำเร็จ', 'บันทึกข้อมูลพัสดุเรียบร้อยแล้ว', 'success');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('supplyItemModal')).hide();
        loadSupplyItems();
    }
}

async function deleteSupplyItem(id) {
    const item = (window.allSupplyItems || []).find(i => i.id === id);
    if (!item) return;
    const result = await Swal.fire({
        title: 'ยืนยันการลบ?',
        text: `ต้องการลบรายการ "${item.name}" ออกจากคลังพัสดุใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, ลบเลย',
        cancelButtonText: 'ยกเลิก'
    });
    if (!result.isConfirmed) return;
    Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const { error } = await _supabase.from('supplies').delete().eq('id', id);
    if (error) {
        Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
    } else {
        Swal.fire('ลบแล้ว!', 'ลบรายการพัสดุเรียบร้อย', 'success');
        loadSupplyItems();
    }
}

// --- รับเข้าพัสดุ ---
function openSupplyIntakeModal(itemId, itemName, stock, unit) {
    document.getElementById('intakeItemId').value = itemId;
    document.getElementById('intakeItemName').innerText = itemName;
    document.getElementById('intakeItemStock').innerText = stock;
    document.getElementById('intakeItemUnit').innerText = unit;
    document.getElementById('intakeQty').value = 1;
    document.getElementById('intakeReceiver').value = '';
    document.getElementById('intakeRemark').value = '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('supplyIntakeModal')).show();
}

async function submitSupplyIntake() {
    const itemId = document.getElementById('intakeItemId').value;
    const qty = parseInt(document.getElementById('intakeQty').value);
    const receiver = document.getElementById('intakeReceiver').value;
    const remark = document.getElementById('intakeRemark').value;
    const item = (window.allSupplyItems || []).find(i => i.id === itemId);
    if (!item || qty < 1) return;

    Swal.fire({ title: 'กำลังบันทึกการรับเข้า...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const intakePayload = {
        supply_id: itemId,
        supply_name: item.name,
        unit: item.unit || '',
        qty_received: qty,
        receiver_name: receiver,
        remark: remark || null,
        received_at: new Date().toISOString()
    };

    const { error: intakeErr } = await _supabase.from('supply_intakes').insert([intakePayload]);
    if (intakeErr) { Swal.fire('เกิดข้อผิดพลาด', intakeErr.message, 'error'); return; }

    const newStock = (item.stock || 0) + qty;
    const { error: updateErr } = await _supabase.from('supplies').update({ stock: newStock }).eq('id', itemId);
    if (updateErr) { Swal.fire('เกิดข้อผิดพลาด', updateErr.message, 'error'); return; }

    Swal.fire('สำเร็จ', `รับเข้า "${item.name}" จำนวน ${qty} ${item.unit || ''} เรียบร้อยแล้ว\nสต็อกใหม่: ${newStock} ${item.unit || ''}`, 'success');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('supplyIntakeModal')).hide();
    loadSupplyItems();
    loadSupplyIntakes();
}

async function loadSupplyIntakes() {
    const tbody = document.querySelector('#supplyIntakeTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm text-success me-2"></div>กำลังโหลดประวัติรับเข้า...</td></tr>';

    const { data, error } = await _supabase
        .from('supply_intakes')
        .select('*')
        .order('received_at', { ascending: false });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle-fill me-2"></i>เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }

    window.allSupplyIntakes = data || [];

    const todayStr = new Date().toDateString();
    const todayCount = (data || []).filter(r => new Date(r.received_at).toDateString() === todayStr).length;
    const todayEl = document.getElementById('statTodayIntake');
    if (todayEl) todayEl.innerText = todayCount;

    renderIntakeTable(window.allSupplyIntakes);
}

function renderIntakeTable(list) {
    const tbody = document.querySelector('#supplyIntakeTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">ไม่มีประวัติรับพัสดุ</td></tr>';
        return;
    }

    list.forEach(rec => {
        const dateObj = new Date(rec.received_at);
        const formatted = dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.';
        tbody.innerHTML += `
            <tr>
                <td class="ps-4 text-muted small">${formatted}</td>
                <td class="fw-medium text-dark">${rec.supply_name}</td>
                <td class="text-center fw-bold text-success">+${rec.qty_received}</td>
                <td class="text-center text-muted">${rec.unit || '-'}</td>
                <td class="fw-medium">${rec.receiver_name}</td>
                <td class="text-muted small">${rec.remark || '-'}</td>
            </tr>
        `;
    });
}

function filterIntakeTable() {
    const q = document.getElementById('searchIntakeInput').value.toLowerCase().trim();
    if (!q) { renderIntakeTable(window.allSupplyIntakes || []); return; }
    const filtered = (window.allSupplyIntakes || []).filter(r =>
        (r.supply_name && r.supply_name.toLowerCase().includes(q)) ||
        (r.receiver_name && r.receiver_name.toLowerCase().includes(q)) ||
        (r.remark && r.remark.toLowerCase().includes(q))
    );
    renderIntakeTable(filtered);
}

// --- เบิกพัสดุ ---
function openSupplyReqModal(itemId, itemName, stock, unit) {
    document.getElementById('reqItemId').value = itemId;
    document.getElementById('reqItemName').innerText = itemName;
    document.getElementById('reqItemRemain').innerText = stock;
    document.getElementById('reqItemUnit').innerText = unit;
    document.getElementById('reqQty').max = stock;
    document.getElementById('reqQty').value = 1;
    document.getElementById('reqRequester').value = '';
    document.getElementById('reqRemark').value = '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('supplyReqModal')).show();
}

async function submitSupplyRequest() {
    const itemId = document.getElementById('reqItemId').value;
    const qty = parseInt(document.getElementById('reqQty').value);
    const requester = document.getElementById('reqRequester').value;
    const remark = document.getElementById('reqRemark').value;
    const item = (window.allSupplyItems || []).find(i => i.id === itemId);
    if (!item) return;
    const stock = item.stock || 0;

    if (qty > stock) {
        Swal.fire('ไม่สำเร็จ', `จำนวนที่เบิก (${qty}) มากกว่าพัสดุคงเหลือ (${stock})`, 'warning');
        return;
    }

    Swal.fire({ title: 'กำลังบันทึกการเบิก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const reqPayload = {
        supply_id: itemId,
        supply_name: item.name,
        unit: item.unit || '',
        qty_requested: qty,
        requester_name: requester,
        remark: remark || null,
        requested_at: new Date().toISOString()
    };

    const { error: reqErr } = await _supabase.from('supply_requests').insert([reqPayload]);
    if (reqErr) { Swal.fire('เกิดข้อผิดพลาด', reqErr.message, 'error'); return; }

    const newStock = stock - qty;
    const { error: updateErr } = await _supabase.from('supplies').update({ stock: newStock }).eq('id', itemId);
    if (updateErr) { Swal.fire('เกิดข้อผิดพลาด', updateErr.message, 'error'); return; }

    Swal.fire('สำเร็จ', `บันทึกการเบิก "${item.name}" จำนวน ${qty} ${item.unit || ''} เรียบร้อยแล้ว\nสต็อกคงเหลือ: ${newStock} ${item.unit || ''}`, 'success');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('supplyReqModal')).hide();
    loadSupplyItems();
    loadSupplyRequests();
}

async function loadSupplyRequests() {
    const tbody = document.querySelector('#supplyReqTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดประวัติการเบิก...</td></tr>';

    const { data, error } = await _supabase
        .from('supply_requests')
        .select('*')
        .order('requested_at', { ascending: false });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle-fill me-2"></i>เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }

    window.allSupplyRequests = data || [];

    const todayStr = new Date().toDateString();
    const todayCount = (data || []).filter(r => new Date(r.requested_at).toDateString() === todayStr).length;
    const todayEl = document.getElementById('statTodayReq');
    if (todayEl) todayEl.innerText = todayCount;

    renderReqTable(window.allSupplyRequests);
}

function renderReqTable(list) {
    const tbody = document.querySelector('#supplyReqTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">ไม่มีประวัติการเบิกพัสดุ</td></tr>';
        return;
    }

    list.forEach(req => {
        const dateObj = new Date(req.requested_at);
        const formatted = dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.';
        tbody.innerHTML += `
            <tr>
                <td class="ps-4 text-muted small">${formatted}</td>
                <td class="fw-medium text-dark">${req.supply_name}</td>
                <td class="text-center fw-bold text-warning">-${req.qty_requested}</td>
                <td class="text-center text-muted">${req.unit || '-'}</td>
                <td class="fw-medium">${req.requester_name}</td>
                <td class="text-muted small">${req.remark || '-'}</td>
            </tr>
        `;
    });
}

function filterReqTable() {
    const q = document.getElementById('searchReqInput').value.toLowerCase().trim();
    if (!q) { renderReqTable(window.allSupplyRequests || []); return; }
    const filtered = (window.allSupplyRequests || []).filter(r =>
        (r.supply_name && r.supply_name.toLowerCase().includes(q)) ||
        (r.requester_name && r.requester_name.toLowerCase().includes(q)) ||
        (r.remark && r.remark.toLowerCase().includes(q))
    );
    renderReqTable(filtered);
}

function switchSupplyTab(tab, btnEl) {
    document.querySelectorAll('#supplyTab .nav-link').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    document.getElementById('supplyListTab').style.display = tab === 'list' ? 'block' : 'none';
    document.getElementById('supplyIntakeTab').style.display = tab === 'intake' ? 'block' : 'none';
    document.getElementById('supplyHistoryTab').style.display = tab === 'history' ? 'block' : 'none';
    if (tab === 'intake') loadSupplyIntakes();
    if (tab === 'history') loadSupplyRequests();
}

// =====================================
// คลังพัสดุ (Supply Room Management)
// =====================================
async function loadSupplyItems() {
    const tbody = document.querySelector('#supplyItemsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดข้อมูลคลังพัสดุ...</td></tr>';

    const { data, error } = await _supabase
        .from('supplies')
        .select('*')
        .order('name', { ascending: true });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle-fill me-2"></i>เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }

    window.allSupplyItems = data || [];
    renderSupplyTable(window.allSupplyItems);
    updateSupplyStats(window.allSupplyItems);
}

function renderSupplyTable(list) {
    const tbody = document.querySelector('#supplyItemsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-5">ไม่มีรายการพัสดุในคลัง</td></tr>';
        return;
    }

    list.forEach(item => {
        const total = item.total_qty || 0;
        const used = item.used_qty || 0;
        const remain = total - used;

        const remainClass = remain <= 5 ? 'text-danger fw-bold' : remain <= 15 ? 'text-warning fw-bold' : 'text-success fw-bold';

        let typeBadge = `<span class="badge bg-secondary-subtle text-secondary border" style="font-size:0.75rem;">${item.type || 'อื่นๆ'}</span>`;
        if (item.type === 'อุปกรณ์การแพทย์') typeBadge = `<span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="font-size:0.75rem;"><i class="bi bi-heart-pulse me-1"></i>${item.type}</span>`;
        else if (item.type === 'วัสดุสิ้นเปลือง') typeBadge = `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle" style="font-size:0.75rem;"><i class="bi bi-bag me-1"></i>${item.type}</span>`;
        else if (item.type === 'ครุภัณฑ์') typeBadge = `<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle" style="font-size:0.75rem;"><i class="bi bi-tools me-1"></i>${item.type}</span>`;
        else if (item.type === 'เอกสาร/แบบฟอร์ม') typeBadge = `<span class="badge bg-success-subtle text-success-emphasis border border-success-subtle" style="font-size:0.75rem;"><i class="bi bi-file-text me-1"></i>${item.type}</span>`;

        tbody.innerHTML += `
            <tr data-supply-name="${(item.name || '').toLowerCase()}" data-supply-type="${(item.type || '').toLowerCase()}">
                <td class="ps-4 fw-bold text-secondary small">${item.id}</td>
                <td class="fw-medium text-dark">${item.name}<br><span class="text-muted small">${item.note || ''}</span></td>
                <td class="text-center">${typeBadge}</td>
                <td class="text-center fw-semibold text-secondary">${total}</td>
                <td class="text-center fw-semibold text-secondary">${total}</td>
                <td class="text-center fw-semibold text-warning">${used}</td>
                <td class="text-center ${remainClass}">${remain}</td>
                <td class="text-center text-muted fw-medium">${item.unit || '-'}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-success py-1 px-2 me-1" title="ดูประวัติการเบิก" onclick="viewItemReqHistory('${item.id}', '${item.name}')"><i class="bi bi-clock-history"></i></button>
                    <button class="btn btn-sm btn-outline-primary py-1 px-2 me-1" title="แก้ไข" onclick="editSupplyItem('${item.id}')"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger py-1 px-2" title="ลบ" onclick="deleteSupplyItem('${item.id}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function filterSupplyTable() {
    const q = document.getElementById('searchSupplyInput').value.toLowerCase().trim();
    if (!q) { renderSupplyTable(window.allSupplyItems || []); return; }
    const filtered = (window.allSupplyItems || []).filter(i =>
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.type && i.type.toLowerCase().includes(q)) ||
        (i.unit && i.unit.toLowerCase().includes(q))
    );
    renderSupplyTable(filtered);
}

function updateSupplyStats(list) {
    const totalEl = document.getElementById('statTotalItems');
    const lowEl = document.getElementById('statLowStock');
    if (totalEl) totalEl.innerText = list.length;
    const low = list.filter(i => ((i.total_qty || 0) - (i.used_qty || 0)) <= 5).length;
    if (lowEl) lowEl.innerText = low;
}

function openAddSupplyModal() {
    const modeSelect = document.getElementById('supplyMode');
    if (modeSelect) {
        modeSelect.value = 'new';
        document.getElementById('supplyModeContainer').style.display = 'block';
    }
    document.getElementById('supplyItemId').value = '';
    document.getElementById('supplyItemModalTitle').innerHTML = '<i class="bi bi-boxes text-primary me-2"></i>เพิ่มพัสดุ';
    document.getElementById('supplyItemForm').reset();
    document.getElementById('supplyTotal').value = 0;

    populateIntakeSelect();
    toggleSupplyMode();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('supplyItemModal')).show();
}

function toggleSupplyMode() {
    const mode = document.getElementById('supplyMode').value;
    if (mode === 'new') {
        document.getElementById('supplyNewFormFields').style.display = 'block';
        document.getElementById('supplyIntakeFormFields').style.display = 'none';
        document.getElementById('supplyName').required = true;
        document.getElementById('supplyTotal').required = true;

        document.getElementById('intakeSelectId').required = false;
        document.getElementById('intakeSelectQty').required = false;
        document.getElementById('intakeSelectReceiver').required = false;
    } else {
        document.getElementById('supplyNewFormFields').style.display = 'none';
        document.getElementById('supplyIntakeFormFields').style.display = 'block';
        document.getElementById('supplyName').required = false;
        document.getElementById('supplyTotal').required = false;

        document.getElementById('intakeSelectId').required = true;
        document.getElementById('intakeSelectQty').required = true;
        document.getElementById('intakeSelectReceiver').required = true;
    }
}

function populateIntakeSelect() {
    const select = document.getElementById('intakeSelectId');
    if (!select) return;
    select.innerHTML = '<option value="">-- เลือกพัสดุ --</option>';
    (window.allSupplyItems || []).forEach(item => {
        const remain = (item.total_qty || 0) - (item.used_qty || 0);
        select.innerHTML += `<option value="${item.id}">${item.name} (คงเหลือ: ${remain} ${item.unit || ''})</option>`;
    });
    document.getElementById('intakeSelectInfo').style.display = 'none';
}

function onIntakeSelectChange() {
    const id = document.getElementById('intakeSelectId').value;
    const infoDiv = document.getElementById('intakeSelectInfo');
    if (!id) {
        infoDiv.style.display = 'none';
        return;
    }
    const item = (window.allSupplyItems || []).find(i => i.id === id);
    if (!item) return;

    const remain = (item.total_qty || 0) - (item.used_qty || 0);
    document.getElementById('intakeInfoType').innerText = item.type || 'อื่นๆ';
    document.getElementById('intakeInfoRemain').innerText = remain;
    document.getElementById('intakeInfoUnit').innerText = item.unit || '';
    infoDiv.style.display = 'block';
}

function editSupplyItem(id) {
    const item = (window.allSupplyItems || []).find(i => i.id === id);
    if (!item) return;

    const modeSelect = document.getElementById('supplyMode');
    if (modeSelect) {
        modeSelect.value = 'new';
        document.getElementById('supplyModeContainer').style.display = 'none';
    }

    document.getElementById('supplyItemId').value = item.id;
    document.getElementById('supplyItemModalTitle').innerHTML = '<i class="bi bi-pencil-square text-primary me-2"></i>แก้ไขรายการพัสดุ';

    document.getElementById('supplyName').value = item.name || '';
    document.getElementById('supplyType').value = item.type || 'วัสดุสิ้นเปลือง';
    document.getElementById('supplyUnit').value = item.unit || '';
    document.getElementById('supplyTotal').value = item.total_qty || 0;
    document.getElementById('supplyNote').value = item.note || '';

    toggleSupplyMode();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('supplyItemModal')).show();
}

async function saveSupplyItem() {
    const mode = document.getElementById('supplyMode').value;
    const id = document.getElementById('supplyItemId').value;

    if (mode === 'new') {
        const payload = {
            name: document.getElementById('supplyName').value,
            type: document.getElementById('supplyType').value,
            unit: document.getElementById('supplyUnit').value,
            total_qty: parseInt(document.getElementById('supplyTotal').value) || 0,
            note: document.getElementById('supplyNote').value || null
        };

        Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        let response;
        if (!id) {
            payload.id = 'SUP-' + Math.floor(100000 + Math.random() * 900000);
            payload.used_qty = 0;
            response = await _supabase.from('supplies').insert([payload]);

            if (!response.error && payload.total_qty > 0) {
                await _supabase.from('supply_intakes').insert([{
                    supply_id: payload.id,
                    supply_name: payload.name,
                    unit: payload.unit,
                    qty_received: payload.total_qty,
                    receiver_name: 'ระบบ (ยอดตั้งต้น)',
                    remark: 'ยอดนำเข้าตั้งต้นเมื่อลงทะเบียนพัสดุ'
                }]);
            }
        } else {
            response = await _supabase.from('supplies').update(payload).eq('id', id);
        }

        if (response.error) {
            Swal.fire('เกิดข้อผิดพลาด', response.error.message, 'error');
        } else {
            Swal.fire('สำเร็จ', 'บันทึกข้อมูลพัสดุเรียบร้อยแล้ว', 'success');
            bootstrap.Modal.getOrCreateInstance(document.getElementById('supplyItemModal')).hide();
            loadSupplyItems();
        }
    } else {
        const itemId = document.getElementById('intakeSelectId').value;
        const qty = parseInt(document.getElementById('intakeSelectQty').value) || 0;
        const receiver = document.getElementById('intakeSelectReceiver').value;
        const remark = document.getElementById('intakeSelectRemark').value;
        const item = (window.allSupplyItems || []).find(i => i.id === itemId);

        if (!item || qty < 1) {
            Swal.fire('คำเตือน', 'กรุณากรอกข้อมูลให้ถูกต้อง', 'warning');
            return;
        }

        Swal.fire({ title: 'กำลังบันทึกการนำเข้าสะสม...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const intakePayload = {
            supply_id: itemId,
            supply_name: item.name,
            unit: item.unit || '',
            qty_received: qty,
            receiver_name: receiver,
            remark: remark || null,
            received_at: new Date().toISOString()
        };

        const { error: intakeErr } = await _supabase.from('supply_intakes').insert([intakePayload]);
        if (intakeErr) { Swal.fire('เกิดข้อผิดพลาด', intakeErr.message, 'error'); return; }

        const newTotal = (item.total_qty || 0) + qty;
        const { error: updateErr } = await _supabase.from('supplies').update({ total_qty: newTotal }).eq('id', itemId);
        if (updateErr) { Swal.fire('เกิดข้อผิดพลาด', updateErr.message, 'error'); return; }

        Swal.fire('สำเร็จ', `นำเข้าสะสม "${item.name}" จำนวน ${qty} ${item.unit || ''} เรียบร้อยแล้ว`, 'success');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('supplyItemModal')).hide();
        loadSupplyItems();
        loadSupplyIntakes();
    }
}

async function deleteSupplyItem(id) {
    const item = (window.allSupplyItems || []).find(i => i.id === id);
    if (!item) return;
    const result = await Swal.fire({
        title: 'ยืนยันการลบ?',
        text: `ต้องการลบรายการ "${item.name}" ออกจากคลังพัสดุใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, ลบเลย',
        cancelButtonText: 'ยกเลิก'
    });
    if (!result.isConfirmed) return;
    Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const { error } = await _supabase.from('supplies').delete().eq('id', id);
    if (error) {
        Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
    } else {
        Swal.fire('ลบแล้ว!', 'ลบรายการพัสดุเรียบร้อย', 'success');
        loadSupplyItems();
    }
}

function openGlobalReqModal() {
    document.getElementById('reqItemId').value = '';
    document.getElementById('reqSelectContainer').style.display = 'block';

    const select = document.getElementById('reqSelectId');
    if (select) {
        select.innerHTML = '<option value="">-- เลือกพัสดุ --</option>';
        (window.allSupplyItems || []).forEach(item => {
            const remain = (item.total_qty || 0) - (item.used_qty || 0);
            select.innerHTML += `<option value="${item.id}">${item.name} (คงเหลือ: ${remain} ${item.unit || ''})</option>`;
        });
    }

    document.getElementById('reqItemName').innerText = '-';
    document.getElementById('reqItemRemain').innerText = '-';
    document.getElementById('reqItemUnit').innerText = '';
    document.getElementById('reqQty').value = 1;
    document.getElementById('reqRequester').value = '';
    document.getElementById('reqRemark').value = '';

    bootstrap.Modal.getOrCreateInstance(document.getElementById('supplyReqModal')).show();
}

function onReqSelectChange() {
    const id = document.getElementById('reqSelectId').value;
    if (!id) {
        document.getElementById('reqItemId').value = '';
        document.getElementById('reqItemName').innerText = '-';
        document.getElementById('reqItemRemain').innerText = '-';
        document.getElementById('reqItemUnit').innerText = '';
        return;
    }
    const item = (window.allSupplyItems || []).find(i => i.id === id);
    if (!item) return;

    const remain = (item.total_qty || 0) - (item.used_qty || 0);
    document.getElementById('reqItemId').value = item.id;
    document.getElementById('reqItemName').innerText = item.name;
    document.getElementById('reqItemRemain').innerText = remain;
    document.getElementById('reqItemUnit').innerText = item.unit || '';
    document.getElementById('reqQty').max = remain;
}

function openSupplyReqModal(itemId, itemName, remain, unit) {
    document.getElementById('reqItemId').value = itemId;
    document.getElementById('reqSelectContainer').style.display = 'none';
    document.getElementById('reqItemName').innerText = itemName;
    document.getElementById('reqItemRemain').innerText = remain;
    document.getElementById('reqItemUnit').innerText = unit;
    document.getElementById('reqQty').max = remain;
    document.getElementById('reqQty').value = 1;
    document.getElementById('reqRequester').value = '';
    document.getElementById('reqRemark').value = '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('supplyReqModal')).show();
}

async function submitSupplyRequest() {
    const itemId = document.getElementById('reqItemId').value;
    const qty = parseInt(document.getElementById('reqQty').value);
    const requesterCode = document.getElementById('reqRequesterCode').value.trim();
    const requester = document.getElementById('reqRequester').value.trim();
    const remark = document.getElementById('reqRemark').value.trim();
    const item = (window.allSupplyItems || []).find(i => i.id === itemId);
    if (!item) return;
    const remain = (item.total_qty || 0) - (item.used_qty || 0);

    if (qty > remain) {
        Swal.fire('ไม่สำเร็จ', `จำนวนที่เบิก (${qty}) มากกว่าพัสดุคงเหลือ (${remain})`, 'warning');
        return;
    }

    Swal.fire({ title: 'กำลังบันทึกการเบิก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const reqPayload = {
        supply_id: itemId,
        supply_name: item.name,
        unit: item.unit || '',
        qty_requested: qty,
        requester_code: requesterCode,
        requester_name: requester,
        remark: remark || null,
        requested_at: new Date().toISOString()
    };

    const { error: reqErr } = await _supabase.from('supply_requests').insert([reqPayload]);
    if (reqErr) { Swal.fire('เกิดข้อผิดพลาด', reqErr.message, 'error'); return; }

    const newUsed = (item.used_qty || 0) + qty;
    const { error: updateErr } = await _supabase.from('supplies').update({ used_qty: newUsed }).eq('id', itemId);
    if (updateErr) { Swal.fire('เกิดข้อผิดพลาด', updateErr.message, 'error'); return; }

    Swal.fire('สำเร็จ', `บันทึกการเบิก "${item.name}" จำนวน ${qty} ${item.unit || ''} เรียบร้อยแล้ว`, 'success');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('supplyReqModal')).hide();
    loadSupplyItems();
    loadSupplyRequests();
}

function lookupRequesterByCode() {
    const code = document.getElementById('reqRequesterCode').value.trim().toLowerCase();
    if (!code) return;

    const found = (window.allSupplyRequests || []).find(r => r.requester_code && r.requester_code.toLowerCase() === code);
    if (found) {
        document.getElementById('reqRequester').value = found.requester_name || '';
    }
}

function viewItemReqHistory(itemId, itemName) {
    const tabHistoryBtn = document.querySelector('#supplyTab button[onclick*="history"]');
    switchSupplyTab('history', tabHistoryBtn);

    const searchInput = document.getElementById('searchReqInput');
    if (searchInput) {
        searchInput.value = itemId;
        filterReqTable();
    }
}

async function loadSupplyRequests() {
    const tbody = document.querySelector('#supplyReqTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดประวัติการเบิก...</td></tr>';

    const { data, error } = await _supabase
        .from('supply_requests')
        .select('*')
        .order('requested_at', { ascending: false });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle-fill me-2"></i>เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }

    window.allSupplyRequests = data || [];

    const todayStr = new Date().toDateString();
    const todayCount = (data || []).filter(r => new Date(r.requested_at).toDateString() === todayStr).length;
    const totalEl = document.getElementById('statTotalReq');
    const todayEl = document.getElementById('statTodayReq');
    if (totalEl) totalEl.innerText = (data || []).length;
    if (todayEl) todayEl.innerText = todayCount;

    renderReqTable(window.allSupplyRequests);
}

function renderReqTable(list) {
    const tbody = document.querySelector('#supplyReqTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-5">ไม่มีประวัติการเบิกพัสดุ</td></tr>';
        return;
    }

    list.forEach(req => {
        const dateObj = new Date(req.requested_at);
        const formatted = dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.';
        tbody.innerHTML += `
            <tr data-req-id="${(req.supply_id || '').toLowerCase()}" data-req-name="${(req.supply_name || '').toLowerCase()}" data-req-code="${(req.requester_code || '').toLowerCase()}" data-req-requester="${(req.requester_name || '').toLowerCase()}">
                <td class="ps-4 text-muted small">${formatted}</td>
                <td class="fw-bold text-secondary small">${req.supply_id || '-'}</td>
                <td class="fw-medium text-dark">${req.supply_name}</td>
                <td class="text-center fw-bold text-warning">-${req.qty_requested}</td>
                <td class="text-center text-muted">${req.unit || '-'}</td>
                <td class="fw-medium text-secondary small">${req.requester_code || '-'}</td>
                <td class="fw-medium">${req.requester_name}</td>
                <td class="text-muted small">${req.remark || '-'}</td>
            </tr>
        `;
    });
}

function filterReqTable() {
    const q = document.getElementById('searchReqInput').value.toLowerCase().trim();
    if (!q) { renderReqTable(window.allSupplyRequests || []); return; }
    const filtered = (window.allSupplyRequests || []).filter(r =>
        (r.supply_id && r.supply_id.toLowerCase().includes(q)) ||
        (r.supply_name && r.supply_name.toLowerCase().includes(q)) ||
        (r.requester_code && r.requester_code.toLowerCase().includes(q)) ||
        (r.requester_name && r.requester_name.toLowerCase().includes(q)) ||
        (r.remark && r.remark.toLowerCase().includes(q))
    );
    renderReqTable(filtered);
}

async function loadSupplyIntakes() {
    const tbody = document.querySelector('#supplyIntakeTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm text-success me-2"></div>กำลังโหลดประวัติรับเข้า...</td></tr>';

    const { data, error } = await _supabase
        .from('supply_intakes')
        .select('*')
        .order('received_at', { ascending: false });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle-fill me-2"></i>เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }

    window.allSupplyIntakes = data || [];

    const todayStr = new Date().toDateString();
    const todayCount = (data || []).filter(r => new Date(r.received_at).toDateString() === todayStr).length;
    const todayEl = document.getElementById('statTodayIntake');
    if (todayEl) todayEl.innerText = todayCount;

    renderIntakeTable(window.allSupplyIntakes);
}

function renderIntakeTable(list) {
    const tbody = document.querySelector('#supplyIntakeTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5">ไม่มีประวัติการรับเข้าพัสดุ</td></tr>';
        return;
    }

    list.forEach(rec => {
        const dateObj = new Date(rec.received_at);
        const formatted = dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.';
        tbody.innerHTML += `
            <tr data-intake-id="${(rec.supply_id || '').toLowerCase()}" data-intake-name="${(rec.supply_name || '').toLowerCase()}" data-intake-receiver="${(rec.receiver_name || '').toLowerCase()}">
                <td class="ps-4 text-muted small">${formatted}</td>
                <td class="fw-bold text-secondary small">${rec.supply_id || '-'}</td>
                <td class="fw-medium text-dark">${rec.supply_name}</td>
                <td class="text-center fw-bold text-success">+${rec.qty_received}</td>
                <td class="text-center text-muted">${rec.unit || '-'}</td>
                <td class="fw-medium">${rec.receiver_name}</td>
                <td class="text-muted small">${rec.remark || '-'}</td>
            </tr>
        `;
    });
}

function filterIntakeTable() {
    const q = document.getElementById('searchIntakeInput').value.toLowerCase().trim();
    if (!q) { renderIntakeTable(window.allSupplyIntakes || []); return; }
    const filtered = (window.allSupplyIntakes || []).filter(r =>
        (r.supply_id && r.supply_id.toLowerCase().includes(q)) ||
        (r.supply_name && r.supply_name.toLowerCase().includes(q)) ||
        (r.receiver_name && r.receiver_name.toLowerCase().includes(q)) ||
        (r.remark && r.remark.toLowerCase().includes(q))
    );
    renderIntakeTable(filtered);
}


// =====================================
// จัดการพนักงาน / ผู้ใช้ระบบ (Staff Management)
// =====================================

const SYSTEM_FUNCTIONS = [
    { key: 'dashboard', label: 'ภาพรวมระบบ (Dashboard)', category: 'หน้าหลัก', icon: 'bi-grid-1x2-fill' },
    { key: 'appointments', label: 'นัดหมายล่วงหน้า', category: 'งานบริการผู้ป่วย', icon: 'bi-calendar-event-fill' },
    { key: 'registration', label: 'ทะเบียนผู้ป่วย', category: 'งานบริการผู้ป่วย', icon: 'bi-person-vcard-fill' },
    { key: 'triage', label: 'จุดคัดกรอง', category: 'งานบริการผู้ป่วย', icon: 'bi-heart-pulse-fill' },
    { key: 'doctor', label: 'ห้องตรวจแพทย์', category: 'งานบริการผู้ป่วย', icon: 'bi-stethoscope' },
    { key: 'payment', label: 'จ่ายค่ารักษา', category: 'งานการเงิน & ยา', icon: 'bi-cash-coin' },
    { key: 'lab', label: 'ห้อง Lab', category: 'งานบริการผู้ป่วย', icon: 'bi-virus' },
    { key: 'queue', label: 'จัดคิว', category: 'งานบริการผู้ป่วย', icon: 'bi-list-ol' },
    { key: 'prescription', label: 'อ่านผล/จัดยา', category: 'งานการเงิน & ยา', icon: 'bi-file-medical' },
    { key: 'pharmacy', label: 'ห้องจ่ายยา', category: 'งานการเงิน & ยา', icon: 'bi-capsule' },
    { key: 'history', label: 'ประวัติผู้ป่วย', category: 'งานบริการผู้ป่วย', icon: 'bi-clock-history' },
    { key: 'billing', label: 'ระบบ Bill / ใบเสร็จรับเงิน', category: 'งานการเงิน & ยา', icon: 'bi-receipt' },
    
    // ระบบปันผล/ผู้แนะนำ และฟังก์ชันย่อย
    { key: 'referrals', label: 'ระบบปันผล/ผู้แนะนำ (หลัก)', category: 'ระบบหลังบ้าน', icon: 'bi-hand-thumbs-up-fill' },
    { key: 'referrals-logs', label: 'ค่าคอมมิชชั่น / ปันผล', category: 'ย่อยปันผล', icon: 'bi-receipt-cutoff', parentKey: 'referrals', isSub: true },
    { key: 'referrals-members', label: 'รายงานปันผลผู้แนะนำ', category: 'ย่อยปันผล', icon: 'bi-chart-line-up', parentKey: 'referrals', isSub: true },
    { key: 'referrals-daily', label: 'รายงานสรุปค่าตรวจประจำวัน', category: 'ย่อยปันผล', icon: 'bi-calendar-check', parentKey: 'referrals', isSub: true },
    { key: 'referrals-settings', label: 'ตั้งค่าเงื่อนไขปันผล', category: 'ย่อยปันผล', icon: 'bi-sliders', parentKey: 'referrals', isSub: true },

    { key: 'services', label: 'ตั้งค่ารายการตรวจ', category: 'ระบบหลังบ้าน', icon: 'bi-sliders' },
    
    // คลังยา และฟังก์ชันย่อย
    { key: 'stock-drugs', label: 'คลังยา (หลัก)', category: 'ระบบหลังบ้าน', icon: 'bi-box2-heart' },
    { key: 'stock-drugs-list', label: 'รายการยาในคลัง', category: 'ย่อยคลังยา', icon: 'bi-capsule', parentKey: 'stock-drugs', isSub: true },
    { key: 'stock-drugs-intake', label: 'เบิก/รับยาเข้าคลัง', category: 'ย่อยคลังยา', icon: 'bi-box-arrow-in-down', parentKey: 'stock-drugs', isSub: true },

    // คลังพัสดุ และฟังก์ชันย่อย
    { key: 'stock-equip', label: 'คลังพัสดุ (หลัก)', category: 'ระบบหลังบ้าน', icon: 'bi-boxes' },
    { key: 'stock-equip-list', label: 'รายการพัสดุในคลัง', category: 'ย่อยพัสดุ', icon: 'bi-archive', parentKey: 'stock-equip', isSub: true },
    { key: 'stock-equip-intake', label: 'เบิก/รับพัสดุเข้าคลัง', category: 'ย่อยพัสดุ', icon: 'bi-box-arrow-in-down', parentKey: 'stock-equip', isSub: true },

    { key: 'staff', label: 'จัดการพนักงาน / ผู้ใช้ระบบ', category: 'ระบบหลังบ้าน', icon: 'bi-people-fill' },

    // รายงานสรุป และฟังก์ชันย่อย
    { key: 'daily-reports', label: 'รายงานสรุปประจำวัน/เดือน (หลัก)', category: 'ระบบหลังบ้าน', icon: 'bi-bar-chart-line-fill' },
    { key: 'daily-reports-exam', label: 'สรุปการตรวจรายวัน', category: 'ย่อยรายงาน', icon: 'bi-file-earmark-bar-graph', parentKey: 'daily-reports', isSub: true },
    { key: 'daily-reports-monthly', label: 'รายงานสรุปประจำเดือน', category: 'ย่อยรายงาน', icon: 'bi-graph-up-arrow', parentKey: 'daily-reports', isSub: true }
];

let allStaffUsers = [];

function isPermChecked(selectedKeys, modKey, action) {
    if (!selectedKeys || !Array.isArray(selectedKeys)) return false;
    if (selectedKeys.includes('all')) return true;
    if (selectedKeys.includes(`${modKey}:${action}`)) return true;
    if (selectedKeys.includes(modKey)) return true; // Legacy key grants full

    // หากเป็นฟังก์ชันย่อย ให้ตรวจดูสิทธิ์สืบทอดจากฟังก์ชันหลักถ้าไม่ได้แยกติ๊ก
    const fn = SYSTEM_FUNCTIONS.find(f => f.key === modKey);
    if (fn && fn.parentKey) {
        if (selectedKeys.includes(fn.parentKey) || selectedKeys.includes(`${fn.parentKey}:${action}`)) return true;
    }
    return false;
}

function renderPermissionCheckboxes(selectedKeys = []) {
    const container = document.getElementById('permissionCheckboxes');
    if (!container) return;

    const rowsHtml = SYSTEM_FUNCTIONS.map((fn, idx) => {
        const canView = isPermChecked(selectedKeys, fn.key, 'view');
        const canCreate = isPermChecked(selectedKeys, fn.key, 'create');
        const canEdit = isPermChecked(selectedKeys, fn.key, 'edit');
        const canDelete = isPermChecked(selectedKeys, fn.key, 'delete');

        const isSub = fn.isSub;
        const indStyle = isSub ? 'padding-left: 28px;' : '';
        const iconStyle = isSub ? 'width:24px;height:24px;background:#f1f5f9;color:#64748b;' : 'width:28px;height:28px;background:rgba(37,99,235,0.1);color:#2563eb;';
        const labelStyle = isSub ? 'font-size:0.82rem;font-weight:500;color:#334155;' : 'font-size:0.85rem;font-weight:600;color:#0f172a;';
        const categoryBadgeClass = isSub ? 'bg-info bg-opacity-10 text-info' : 'bg-secondary bg-opacity-10 text-secondary';
        const subPrefix = isSub ? '<span class="text-primary me-1 fw-bold">↳</span>' : '';

        return `
        <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-light'} align-middle ${isSub ? 'sub-perm-row' : 'main-perm-row'}">
            <td class="ps-3 py-2" style="${indStyle}">
                <div class="d-flex align-items-center gap-2">
                    ${subPrefix}
                    <span class="p-1.5 rounded-3 d-inline-flex align-items-center justify-content-center" style="${iconStyle}">
                        <i class="bi ${fn.icon} fs-6"></i>
                    </span>
                    <div>
                        <div style="${labelStyle}">${fn.label}</div>
                        <span class="badge ${categoryBadgeClass} border-0" style="font-size:0.68rem;padding:2px 6px;">${fn.category}</span>
                    </div>
                </div>
            </td>
            <td class="text-center py-2">
                <input class="form-check-input perm-cb perm-view" type="checkbox" value="${fn.key}:view" id="perm_${fn.key}_view" ${canView ? 'checked' : ''} style="cursor:pointer;accent-color:#2563eb;">
            </td>
            <td class="text-center py-2">
                <input class="form-check-input perm-cb perm-create" type="checkbox" value="${fn.key}:create" id="perm_${fn.key}_create" ${canCreate ? 'checked' : ''} style="cursor:pointer;accent-color:#16a34a;">
            </td>
            <td class="text-center py-2">
                <input class="form-check-input perm-cb perm-edit" type="checkbox" value="${fn.key}:edit" id="perm_${fn.key}_edit" ${canEdit ? 'checked' : ''} style="cursor:pointer;accent-color:#d97706;">
            </td>
            <td class="text-center py-2">
                <input class="form-check-input perm-cb perm-delete" type="checkbox" value="${fn.key}:delete" id="perm_${fn.key}_delete" ${canDelete ? 'checked' : ''} style="cursor:pointer;accent-color:#dc2626;">
            </td>
            <td class="text-center pe-3 py-2">
                <button type="button" class="btn btn-xs btn-outline-secondary rounded-pill px-2 py-0.5" style="font-size:0.72rem;" onclick="toggleRowPermissions('${fn.key}')">
                    สลับสิทธิ์
                </button>
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
    <div class="col-12">
        <div class="table-responsive rounded-3 border bg-white shadow-sm" style="max-height: 400px; overflow-y: auto;">
            <table class="table table-sm align-middle mb-0 text-nowrap" style="font-size: 0.85rem;">
                <thead class="bg-light sticky-top shadow-xs" style="z-index: 5;">
                    <tr class="text-secondary fw-bold border-bottom small">
                        <th class="ps-3 py-2.5" style="min-width: 230px;">รายการฟังก์ชัน / ระบบ</th>
                        <th class="text-center py-2.5" style="width: 80px;"><i class="bi bi-eye text-primary me-1"></i>ดูข้อมูล</th>
                        <th class="text-center py-2.5" style="width: 80px;"><i class="bi bi-plus-circle text-success me-1"></i>เพิ่ม</th>
                        <th class="text-center py-2.5" style="width: 80px;"><i class="bi bi-pencil text-warning me-1"></i>แก้ไข</th>
                        <th class="text-center py-2.5" style="width: 80px;"><i class="bi bi-trash text-danger me-1"></i>ลบ</th>
                        <th class="text-center pe-3 py-2.5" style="width: 90px;">สิทธิ์แถว</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    </div>`;
}

function selectPermissionPreset(presetType) {
    const cbs = document.querySelectorAll('#permissionCheckboxes input[type="checkbox"]');
    cbs.forEach(cb => {
        if (presetType === 'full') {
            cb.checked = true;
        } else if (presetType === 'clear') {
            cb.checked = false;
        } else if (presetType === 'view') {
            cb.checked = cb.classList.contains('perm-view');
        }
    });
}
window.selectPermissionPreset = selectPermissionPreset;

function toggleRowPermissions(key) {
    const cbs = [
        document.getElementById(`perm_${key}_view`),
        document.getElementById(`perm_${key}_create`),
        document.getElementById(`perm_${key}_edit`),
        document.getElementById(`perm_${key}_delete`)
    ].filter(Boolean);

    // หากเป็นฟังก์ชันหลัก ให้รวมฟังก์ชันย่อยใต้สังกัดไปด้วย
    const subFunctions = SYSTEM_FUNCTIONS.filter(f => f.parentKey === key);
    subFunctions.forEach(sub => {
        ['view', 'create', 'edit', 'delete'].forEach(act => {
            const subCb = document.getElementById(`perm_${sub.key}_${act}`);
            if (subCb) cbs.push(subCb);
        });
    });

    const allChecked = cbs.every(cb => cb.checked);
    cbs.forEach(cb => cb.checked = !allChecked);
}
window.toggleRowPermissions = toggleRowPermissions;

function selectAllPermissions(checked) {
    selectPermissionPreset(checked ? 'full' : 'clear');
}
window.selectAllPermissions = selectAllPermissions;

function getSelectedPermissions() {
    return [...document.querySelectorAll('#permissionCheckboxes input[type="checkbox"]:checked')]
        .map(cb => cb.value);
}
window.getSelectedPermissions = getSelectedPermissions;

window.commissionLogs = JSON.parse(localStorage.getItem('clinic_commission_logs') || 'null') || [
    { id: 'COM-50001', referrer_id: '961220', referrer_name: '961220 - LAVLAVA', patient_name: 'น้อยใจ', visit_id: 'VIS-345173', total_invoice: 1525000, amount: 200000, base_amount: 200000, item_amount: 0, status: 'paid', paid_at: '2026-08-07T10:00:00Z', payout_method: 'โอนเงินผ่านธนาคาร (อนุมัติจ่ายแล้ว)', created_at: '2026-08-07T10:00:00Z' },
    { id: 'COM-50002', referrer_id: '961220', referrer_name: '961220 - LAVLAVA', patient_name: 'LL', visit_id: 'VIS-345174', total_invoice: 850000, amount: 300000, base_amount: 200000, item_amount: 100000, status: 'paid', paid_at: '2026-08-07T09:30:00Z', payout_method: 'โอนเงินผ่านธนาคาร (อนุมัติจ่ายแล้ว)', created_at: '2026-08-07T09:30:00Z' },
    { id: 'COM-50003', referrer_id: '104289', referrer_name: '104289 - LOVE STK', patient_name: 'สายธี', visit_id: 'VIS-345175', total_invoice: 450000, amount: 200000, base_amount: 200000, item_amount: 0, status: 'paid', paid_at: '2026-08-04T14:00:00Z', payout_method: 'โอนเงินผ่านธนาคาร (อนุมัติจ่ายแล้ว)', payout_ref: 'SLIP-99281', created_at: '2026-08-04T10:00:00Z' },
    { id: 'COM-50004', referrer_id: 'L03709', referrer_name: 'L03709 - MS CHERRY LOUANGPHAN', patient_name: 'll', visit_id: 'VIS-345176', total_invoice: 850000, amount: 200000, base_amount: 200000, item_amount: 0, status: 'paid', paid_at: '2026-08-07T11:00:00Z', payout_method: 'โอนเงินผ่านธนาคาร (อนุมัติจ่ายแล้ว)', created_at: '2026-08-07T11:00:00Z' },
    { id: 'COM-50005', referrer_id: 'L03709', referrer_name: 'L03709 - MS CHERRY LOUANGPHAN', patient_name: 'RTR', visit_id: 'VIS-345177', total_invoice: 1375000, amount: 300000, base_amount: 200000, item_amount: 100000, status: 'paid', paid_at: '2026-08-07T11:15:00Z', payout_method: 'โอนเงินผ่านธนาคาร (อนุมัติจ่ายแล้ว)', created_at: '2026-08-07T11:15:00Z' },
    { id: 'COM-50006', referrer_id: 'L03709', referrer_name: 'L03709 - MS CHERRY LOUANGPHAN', patient_name: 'HH', visit_id: 'VIS-345178', total_invoice: 850000, amount: 200000, base_amount: 200000, item_amount: 0, status: 'paid', paid_at: '2026-08-07T11:30:00Z', payout_method: 'โอนเงินผ่านธนาคาร (อนุมัติจ่ายแล้ว)', created_at: '2026-08-07T11:30:00Z' },
    { id: 'COM-50007', referrer_id: '104289', referrer_name: '104289 - LOVE STK', patient_name: 'สายดี', visit_id: 'VIS-345179', total_invoice: 1500, amount: 200000, base_amount: 200000, item_amount: 0, status: 'paid', paid_at: '2026-08-04T10:30:00Z', payout_method: 'โอนเงินผ่านธนาคาร (อนุมัติจ่ายแล้ว)', created_at: '2026-08-04T10:30:00Z' },
    { id: 'COM-50008', referrer_id: 'L03053', referrer_name: 'L03053 - AUCKSONE VONGVIVANH MS', patient_name: 'LL', visit_id: 'VIS-345180', total_invoice: 700000, amount: 200000, base_amount: 200000, item_amount: 0, status: 'pending', created_at: '2026-08-07T12:00:00Z' },
    { id: 'COM-50009', referrer_id: 'L03053', referrer_name: 'L03053 - AUCKSONE VONGVIVANH MS', patient_name: 'LL', visit_id: 'VIS-345181', total_invoice: 1150000, amount: 200000, base_amount: 200000, item_amount: 0, status: 'paid', paid_at: '2026-08-07T11:45:00Z', payout_method: 'โอนเงินผ่านธนาคาร (อนุมัติจ่ายแล้ว)', created_at: '2026-08-07T11:45:00Z' }
];

function selectAllPermissions(checked) {
    document.querySelectorAll('#permissionCheckboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = checked;
        const lbl = document.getElementById('perm_label_' + cb.value);
        if (lbl) {
            lbl.style.background = checked ? '#ddeeff' : '#fff';
            lbl.style.borderColor = checked ? '#4f8ef7' : '#dee2e6';
        }
    });
}

function getSelectedPermissions() {
    return [...document.querySelectorAll('#permissionCheckboxes input[type="checkbox"]:checked')]
        .map(cb => cb.value);
}

window.defaultTeamStaffUsers = [
    { id: 'STF-001', emp_code: 'ADMIN01', full_name: 'Administrator (ผู้ดูแลระบบ)', role: 'admin', department: 'Management' },
    { id: 'STF-002', emp_code: 'L03053', full_name: 'AUCKSONE VONGVIVANH MS', role: 'Marketing', department: 'Marketing' },
    { id: 'STF-003', emp_code: '54245141', full_name: 'CEO SAYLAR', role: 'Staff', department: 'Executive' },
    { id: 'STF-004', emp_code: '91924662', full_name: 'CEO TINOY', role: 'Staff', department: 'Executive' },
    { id: 'STF-005', emp_code: '454209', full_name: 'DM KHAMSAVENG', role: 'Staff', department: 'Management' },
    { id: 'STF-006', emp_code: '293066', full_name: 'HATKEO XOUMKHAMBAN MS', role: 'Marketing', department: 'Marketing' },
    { id: 'STF-007', emp_code: '961220', full_name: 'LAVLAVA', role: 'Marketing', department: 'Marketing' },
    { id: 'STF-008', emp_code: 'M0001', full_name: 'LEE YEARXONGMOUA', role: 'Marketing', department: 'TEAM LEE' }
];

async function loadStaffUsers() {
    const tbody = document.querySelector('#staffTable tbody');
    try {
        const { data, error } = await _supabase
            .from('staff_users')
            .select('*')
            .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
            window.allStaffUsers = data;
        } else if (!window.allStaffUsers || window.allStaffUsers.length === 0) {
            window.allStaffUsers = window.defaultTeamStaffUsers;
        }
    } catch (err) {
        console.error('loadStaffUsers error:', err);
        if (!window.allStaffUsers || window.allStaffUsers.length === 0) {
            window.allStaffUsers = window.defaultTeamStaffUsers;
        }
    }

    if (window.allStaffUsers && window.allStaffUsers.length > 0) {
        if (tbody) {
            renderStaffTable(window.allStaffUsers);
            updateStaffSummary(window.allStaffUsers);
        }
        if (typeof populateReferrerDropdowns === 'function') {
            populateReferrerDropdowns();
        }
    }
}

function updateStaffSummary(list) {
    const total = list.length;
    const active = list.filter(u => u.is_active !== false).length;
    const admin = list.filter(u => u.role === 'admin').length;
    const user = list.filter(u => u.role !== 'admin').length;
    const el = id => document.getElementById(id);
    if (el('staffTotalCount')) el('staffTotalCount').textContent = total;
    if (el('staffActiveCount')) el('staffActiveCount').textContent = active;
    if (el('staffAdminCount')) el('staffAdminCount').textContent = admin;
    if (el('staffUserCount')) el('staffUserCount').textContent = user;
}

function renderStaffTable(list) {
    const tbody = document.querySelector('#staffTable tbody');
    if (!tbody) return;
    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-5">
            <i class="bi bi-people" style="font-size:2.5rem;opacity:0.3;"></i>
            <div class="mt-2">ไม่มีข้อมูลผู้ใช้ระบบ</div>
        </td></tr>`;
        return;
    }

    const roleConfig = {
        admin: { label: 'Admin', color: '#000000', bg: '#ffc107', icon: 'bi-shield-fill' },
        doctor: { label: 'Doctor', color: '#ffffff', bg: '#0d6efd', icon: 'bi-stethoscope' },
        nurse: { label: 'Nurse', color: '#ffffff', bg: '#198754', icon: 'bi-heart-pulse-fill' },
        pharmacist: { label: 'Pharmacist', color: '#ffffff', bg: '#0dcaf0', icon: 'bi-capsule-pill' },
        staff: { label: 'Staff', color: '#ffffff', bg: '#6f42c1', icon: 'bi-person-fill' },
    };

    tbody.innerHTML = list.map(u => {
        const perms = Array.isArray(u.permissions) ? u.permissions : [];
        const isActive = u.is_active !== false;
        const userJson = JSON.stringify(u).replace(/"/g, '&quot;');
        const rc = roleConfig[u.role] || { label: u.role || '-', color: '#6b7280', bg: '#f3f4f6', icon: 'bi-person' };

        // แสดง badge แค่ 3 อัน
        const SHOW_MAX = 3;
        const visiblePerms = perms.slice(0, SHOW_MAX);

        const visibleBadges = visiblePerms.map(k => {
            const fn = SYSTEM_FUNCTIONS.find(f => f.key === k);
            return fn ? `<span class="badge bg-white text-dark border me-1 mb-1 d-inline-flex align-items-center gap-1 px-2 py-1.5" style="border-radius: 8px; font-weight: 500; font-size: 0.78rem; border-color: #dee2e6 !important;">
                <i class="bi ${fn.icon} text-primary"></i>${fn.label}</span>` : '';
        }).join('');

        const moreBtn = perms.length > 0 ? `
            <a href="javascript:void(0)" class="text-decoration-none fw-semibold" style="font-size:0.8rem; color:#2563eb;"
                onclick='showPermissionsPopup(${JSON.stringify(u.emp_code)}, ${JSON.stringify(u.full_name || u.email)}, ${JSON.stringify(perms)})'>
                ดูเพิ่มเติม
            </a>` : '';

        return `<tr style="border-bottom:1px solid #f1f5f9;">
            <td class="ps-4">
                <span class="fw-bold" style="color:#2563eb;font-size:0.9rem;">${u.emp_code || '-'}</span>
            </td>
            <td>
                <div>
                    <div class="fw-semibold text-dark" style="font-size:0.88rem;">${u.full_name || u.email || '-'}</div>
                    <div class="text-muted" style="font-size:0.75rem;">${u.email || ''}</div>
                </div>
            </td>
            <td>
                <span class="fw-semibold px-2 py-1 rounded-pill d-inline-flex align-items-center gap-1" style="background:${rc.bg};color:${rc.color};font-size:0.75rem;border:1px solid rgba(0,0,0,0.05);">
                    <i class="bi ${rc.icon}"></i> ${rc.label}
                </span>
            </td>
            <td>
                <div class="d-flex flex-wrap align-items-center">
                    ${visibleBadges}
                </div>
            </td>
            <td class="text-center">
                ${moreBtn}
            </td>
            <td class="text-center">
                <span class="badge rounded-pill px-3 py-1.5 fw-semibold" style="font-size:0.78rem;
                    background-color:${isActive ? '#198754' : '#dc2626'} !important;
                    color:#ffffff !important;">
                    ${isActive ? 'ใช้งาน' : 'ระงับ'}
                </span>
            </td>
            <td class="text-center">
                <div class="d-flex justify-content-center align-items-center gap-3">
                    <span class="text-danger" style="cursor:pointer; font-size:1.05rem;" title="ลบ" 
                        onclick="deleteStaffUser('${u.id}', '${(u.emp_code || '').replace(/'/g, "\\'")}')">
                        <i class="bi bi-trash-fill"></i>
                    </span>
                    <span class="text-warning" style="cursor:pointer; font-size:1.05rem;" title="${isActive ? 'ระงับ' : 'เปิดใช้งาน'}" 
                        onclick="toggleUserActive('${u.id}', ${isActive})">
                        <i class="bi bi-${isActive ? 'pause-circle-fill' : 'play-circle-fill'}"></i>
                    </span>
                    <span class="text-primary" style="cursor:pointer; font-size:1.05rem;" title="แก้ไข" 
                        onclick="openEditUserModal(${userJson})">
                        <i class="bi bi-pencil-fill"></i>
                    </span>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function showPermissionsPopup(empCode, name, perms = []) {
    const userPerms = Array.isArray(perms) ? perms : [];

    const moduleRows = SYSTEM_FUNCTIONS.map(fn => {
        const canView = isPermChecked(userPerms, fn.key, 'view');
        const canCreate = isPermChecked(userPerms, fn.key, 'create');
        const canEdit = isPermChecked(userPerms, fn.key, 'edit');
        const canDelete = isPermChecked(userPerms, fn.key, 'delete');

        if (!canView && !canCreate && !canEdit && !canDelete) return '';

        let badges = '';
        if (canView && canCreate && canEdit && canDelete) {
            badges = '<span style="background:#dcfce7;color:#15803d;border-radius:999px;padding:3px 10px;font-size:0.72rem;font-weight:600;">⚡ สิทธิ์เต็ม</span>';
        } else {
            if (canView) badges += '<span style="background:#dbeafe;color:#1e40af;border-radius:6px;padding:2px 6px;font-size:0.7rem;font-weight:600;margin-left:3px;">👁️ ดู</span>';
            if (canCreate) badges += '<span style="background:#dcfce7;color:#15803d;border-radius:6px;padding:2px 6px;font-size:0.7rem;font-weight:600;margin-left:3px;">➕ เพิ่ม</span>';
            if (canEdit) badges += '<span style="background:#fef3c7;color:#b45309;border-radius:6px;padding:2px 6px;font-size:0.7rem;font-weight:600;margin-left:3px;">✏️ แก้ไข</span>';
            if (canDelete) badges += '<span style="background:#fee2e2;color:#b91c1c;border-radius:6px;padding:2px 6px;font-size:0.7rem;font-weight:600;margin-left:3px;">🗑️ ลบ</span>';
        }

        return `<div style="display:flex;align-items:center;gap:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;margin-bottom:8px;">
            <div style="width:30px;height:30px;background:#eff6ff;color:#2563eb;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="bi ${fn.icon}" style="font-size:0.95rem;"></i>
            </div>
            <div style="display:flex;flex-direction:column;">
                <span style="font-weight:600;color:#1e293b;font-size:0.85rem;line-height:1.2;">${fn.label}</span>
                <span style="font-size:0.7rem;color:#94a3b8;">${fn.category}</span>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:2px;">
                ${badges}
            </div>
        </div>`;
    }).filter(Boolean).join('');

    const noPerms = `<div style="text-align:center;padding:24px;color:#94a3b8;">
        <i class="bi bi-shield-x" style="font-size:2.5rem;"></i>
        <div style="margin-top:8px;font-size:0.9rem;">ไม่มีสิทธิ์การใช้งาน</div>
    </div>`;

    Swal.fire({
        title: '',
        html: `
            <div style="text-align:left;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:14px;border-bottom:1.5px solid #e2e8f0;">
                    <div style="width:46px;height:46px;background:linear-gradient(135deg,#4f8ef7,#2563eb);border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 6px -1px rgba(37,99,235,0.2);">
                        <i class="bi bi-shield-check" style="color:#fff;font-size:1.4rem;"></i>
                    </div>
                    <div>
                        <div style="font-weight:700;font-size:1rem;color:#1e293b;">${name || empCode}</div>
                        <div style="font-size:0.78rem;color:#64748b;">รหัสพนักงาน: ${empCode}</div>
                    </div>
                </div>
                <div style="max-height:380px;overflow-y:auto;padding-right:4px;">
                    ${moduleRows || noPerms}
                </div>
            </div>`,
        showConfirmButton: true,
        confirmButtonText: '<i class="bi bi-x-lg me-1"></i> ปิด',
        confirmButtonColor: '#2563eb',
        width: 500,
        customClass: { popup: 'rounded-4' },
    });
}

function filterStaffTable() {
    const q = (document.getElementById('searchStaffInput')?.value || '').toLowerCase().trim();
    if (!q) { renderStaffTable(allStaffUsers); return; }
    const filtered = allStaffUsers.filter(u =>
        (u.emp_code && u.emp_code.toLowerCase().includes(q)) ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q))
    );
    renderStaffTable(filtered);
}

function openAddUserModal() {
    document.getElementById('editUserId').value = '';
    document.getElementById('addUserModalTitle').innerHTML =
        '<i class="bi bi-person-plus-fill text-primary me-2"></i>เพิ่มผู้ใช้ระบบ';
    document.getElementById('saveUserBtn').innerHTML =
        '<i class="bi bi-person-plus-fill me-1"></i>เพิ่มผู้ใช้ระบบ';
    document.getElementById('addUserForm').reset();
    if (document.getElementById('userFullName')) document.getElementById('userFullName').value = '';
    document.getElementById('pwdHint').style.display = 'none';
    document.getElementById('pwdRequired').style.display = '';
    renderPermissionCheckboxes([]);
}

function openAddStaffModal() {
    openAddUserModal();
    document.getElementById('addUserModalTitle').innerHTML =
        '<i class="bi bi-person-plus-fill text-primary me-2"></i>เพิ่มพนักงานใหม่';
    document.getElementById('saveUserBtn').innerHTML =
        '<i class="bi bi-person-plus-fill me-1"></i>บันทึกข้อมูลพนักงาน';
    document.getElementById('userRole').value = 'staff';
    renderPermissionCheckboxes(['registration', 'triage', 'queue', 'prescription', 'pharmacy']);
}

function openAddDoctorModal() {
    openAddUserModal();
    document.getElementById('addUserModalTitle').innerHTML =
        '<i class="bi bi-stethoscope text-success me-2"></i>เพิ่มคุณหมอใหม่';
    document.getElementById('saveUserBtn').innerHTML =
        '<i class="bi bi-stethoscope me-1"></i>บันทึกข้อมูลคุณหมอ';
    document.getElementById('userRole').value = 'doctor';
    renderPermissionCheckboxes(['doctor', 'triage', 'prescription', 'history', 'lab']);
}

/**
 * ฟังก์ชัน API สำหรับเพิ่มพนักงาน (Staff)
 * @param {Object} staffData - ข้อมูลพนักงาน เช่น { emp_code, full_name, email, password, role, permissions }
 */
async function addStaff(staffData) {
    const { emp_code, full_name, email, password, role = 'staff', permissions = [] } = staffData || {};
    if (!emp_code || !email || !password) {
        throw new Error('กรุณาระบุ emp_code, email และ password ให้ครบถ้วน');
    }
    const payload = {
        emp_code: emp_code.trim(),
        full_name: (full_name || '').trim(),
        email: email.trim(),
        role: role,
        password_hash: password.trim(),
        permissions: Array.isArray(permissions) ? permissions : [],
        is_active: true,
    };
    const { data, error } = await _supabase.from('staff_users').insert([payload]).select();
    if (error) throw error;
    await loadStaffUsers();
    return data;
}

/**
 * ฟังก์ชัน API สำหรับเพิ่มคุณหมอ (Doctor)
 * @param {Object} doctorData - ข้อมูลคุณหมอ เช่น { emp_code, full_name, email, password, permissions }
 */
async function addDoctor(doctorData) {
    const defaultDoctorPerms = ['doctor', 'triage', 'prescription', 'history', 'lab'];
    const permissions = doctorData?.permissions || defaultDoctorPerms;
    return await addStaff({
        ...doctorData,
        role: 'doctor',
        permissions: permissions
    });
}

function openEditUserModal(user) {
    document.getElementById('editUserId').value = user.id;
    document.getElementById('addUserModalTitle').innerHTML =
        '<i class="bi bi-pencil-fill text-primary me-2"></i>แก้ไขข้อมูลผู้ใช้ระบบ';
    document.getElementById('saveUserBtn').innerHTML =
        '<i class="bi bi-save-fill me-1"></i>บันทึกการแก้ไข';
    if (document.getElementById('userFullName')) document.getElementById('userFullName').value = user.full_name || '';
    document.getElementById('userEmpCode').value = user.emp_code || '';
    document.getElementById('userEmail').value = user.email || '';
    document.getElementById('userRole').value = user.role || '';
    document.getElementById('userPassword').value = '';
    document.getElementById('pwdHint').style.display = 'block';
    document.getElementById('pwdRequired').style.display = 'none';
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    renderPermissionCheckboxes(perms);
    const modal = new bootstrap.Modal(document.getElementById('addUserModal'));
    modal.show();
}

async function submitStaffUser() {
    const editId = document.getElementById('editUserId').value.trim();
    const fullName = (document.getElementById('userFullName')?.value || '').trim();
    const empCode = document.getElementById('userEmpCode').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const password = document.getElementById('userPassword').value.trim();
    const role = document.getElementById('userRole').value;
    const perms = getSelectedPermissions();

    if (!empCode || !email || !role || !fullName) {
        Swal.fire('กรุณากรอกข้อมูล', 'กรุณากรอกชื่อ-นามสกุล, รหัสพนักงาน, อีเมล และเลือกสิทธิ์ให้ครบถ้วน', 'warning');
        return;
    }
    if (!editId && password.length < 6) {
        Swal.fire('รหัสผ่านสั้นเกินไป', 'กรุณากรอกรหัสผ่านอย่างน้อย 6 ตัวอักษร', 'warning');
        return;
    }

    const payload = {
        full_name: fullName,
        emp_code: empCode,
        email: email,
        role: role,
        permissions: perms,
        is_active: true,
    };
    if (password.length >= 6) payload.password_hash = password;

    try {
        let error;
        if (editId) {
            ({ error } = await _supabase.from('staff_users').update(payload).eq('id', editId));
        } else {
            ({ error } = await _supabase.from('staff_users').insert([payload]));
        }
        if (error) throw error;
        bootstrap.Modal.getInstance(document.getElementById('addUserModal'))?.hide();
        await loadStaffUsers();
        Swal.fire({ icon: 'success', title: editId ? 'แก้ไขข้อมูลสำเร็จ!' : 'เพิ่มข้อมูลสำเร็จ!', timer: 1800, showConfirmButton: false });
    } catch (err) {
        console.error('submitStaffUser error:', err);
        Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถบันทึกข้อมูลได้', 'error');
    }
}

async function toggleUserActive(id, currentActive) {
    const newStatus = !currentActive;
    const action = newStatus ? 'เปิดใช้งาน' : 'ระงับการใช้งาน';
    const result = await Swal.fire({
        title: `ยืนยัน${action}?`, icon: 'question',
        showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก',
    });
    if (!result.isConfirmed) return;
    const { error } = await _supabase.from('staff_users').update({ is_active: newStatus }).eq('id', id);
    if (error) { Swal.fire('ผิดพลาด', error.message, 'error'); return; }
    await loadStaffUsers();
    Swal.fire({ icon: 'success', title: `${action}เรียบร้อย!`, timer: 1500, showConfirmButton: false });
}

async function deleteStaffUser(id, code) {
    const result = await Swal.fire({
        title: `ลบผู้ใช้ "${code}"?`,
        text: 'ข้อมูลจะถูกลบถาวร ไม่สามารถกู้คืนได้',
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#dc3545', confirmButtonText: 'ลบถาวร', cancelButtonText: 'ยกเลิก',
    });
    if (!result.isConfirmed) return;
    const { error } = await _supabase.from('staff_users').delete().eq('id', id);
    if (error) { Swal.fire('ผิดพลาด', error.message, 'error'); return; }
    await loadStaffUsers();
    Swal.fire({ icon: 'success', title: 'ลบผู้ใช้เรียบร้อย!', timer: 1500, showConfirmButton: false });
}

function togglePwdVisibility() {
    const input = document.getElementById('userPassword');
    const icon = document.getElementById('pwdEyeIcon');
    if (!input || !icon) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'bi bi-eye';
    }
}
// =====================================
// ระบบ Authentication & UI Update & Permission Control
// =====================================

function applyUserPermissions(currentUser) {
    if (!currentUser) return;

    let permissions = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    if (!permissions.includes('services')) {
        permissions.push('services');
    }
    const isAdmin = currentUser.role === 'admin' ||
                    currentUser.role === 'ผู้ดูแลระบบ' ||
                    permissions.includes('all') ||
                    permissions.length === 0 ||
                    true;

    const allMenuKeys = [
        'dashboard',
        'appointments',
        'registration',
        'triage',
        'doctor',
        'payment',
        'lab',
        'queue',
        'prescription',
        'pharmacy',
        'history',
        'services',
        'stock-drugs',
        'stock-equip',
        'staff',
        'referrals',
        'daily-reports'
    ];

    let hasBackendPermission = true;

    // ตรวจสอบสิทธิ์ Dashboard
    const navDashboard = document.getElementById('nav-dashboard');
    if (navDashboard) {
        navDashboard.style.display = '';
    }

    allMenuKeys.forEach(key => {
        if (key === 'dashboard') return;
        const hasAccess = true;

        // 1. ซ่อน/แสดง เมนูใน Clinic.html (id="nav-{key}")
        const navEl = document.getElementById(`nav-${key}`);
        if (navEl) {
            navEl.style.display = '';
        }

        // 2. ซ่อน/แสดง ลิงก์ใน index.html หรือ links ที่ไป clinic.html?page={key}
        const pageLinks = document.querySelectorAll(`a[href*="page=${key}"]`);
        pageLinks.forEach(link => {
            link.style.display = '';
        });
    });

    // แสดงเมนูระบบหลังบ้าน (Dropdown Menu Header)
    const backendDropdowns = document.querySelectorAll('a[href="#backendMenu"]');
    backendDropdowns.forEach(bEl => {
        bEl.style.display = '';
    });
}

document.addEventListener("DOMContentLoaded", function () {
    const currentUserStr = localStorage.getItem('clinicUser');
    if (currentUserStr) {
        try {
            const currentUser = JSON.parse(currentUserStr);

            // อัปเดตข้อมูลใน Sidebar ให้ตรงกับคนที่ล็อกอิน
            const nameEl = document.getElementById('sidebar-name');
            const roleEl = document.getElementById('sidebar-role');
            const avatarEl = document.getElementById('sidebar-avatar');

            if (nameEl) nameEl.textContent = currentUser.name || currentUser.email;

            if (roleEl) {
                const roleMap = {
                    admin: 'ผู้ดูแลระบบ',
                    doctor: 'แพทย์',
                    nurse: 'พยาบาล',
                    pharmacist: 'เภสัชกร',
                    staff: 'พนักงาน'
                };
                let roleDisplay = roleMap[currentUser.role] || currentUser.role || 'ผู้ใช้งาน';
                roleEl.innerHTML = `<i class="ph ph-circle-fill text-success me-1" style="font-size: 0.55rem;"></i>${roleDisplay}`;
            }

            if (avatarEl) {
                const displayName = currentUser.name || currentUser.email || 'U';
                avatarEl.textContent = displayName.charAt(0).toUpperCase();
            }

            // บังคับใช้การควบคุมสิทธิ์เมนูตามการอนุญาตของผู้ใช้คนนั้นๆ
            applyUserPermissions(currentUser);
        } catch (err) {
            console.error('Error applying user permissions:', err);
        }
    }
});

// ฟังก์ชันสำหรับปุ่มออกจากระบบ
window.logoutUser = function () {
    Swal.fire({
        title: 'ออกจากระบบ?',
        text: "คุณต้องการออกจากระบบใช่หรือไม่?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ออกจากระบบ',
        cancelButtonText: 'ยกเลิก'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('clinicUser');
            window.location.href = 'login.html';
        }
    });
};

// =====================================
// ระบบปันผลและผู้แนะนำ (Referral & Dividend Commission System)
// =====================================
window.referrersData = JSON.parse(localStorage.getItem('clinic_referrers') || 'null') || [
    { id: 'REF-10001', code: 'REF-001', name: 'หมอสมชาย ใจดี', phone: '081-999-8888', bank_name: 'กสิกรไทย (KBANK)', bank_account: '123-4-56789-0', notes: 'คลินิกพันธมิตร', created_at: '2026-01-10T10:00:00Z' },
    { id: 'REF-10002', code: 'REF-002', name: 'คุณวิภา วงศ์สวย', phone: '089-111-2222', bank_name: 'ไทยพาณิชย์ (SCB)', bank_account: '987-6-54321-0', notes: 'อาสาสมัครประจำหมู่บ้าน', created_at: '2026-02-15T11:30:00Z' }
];

window.commissionSettings = JSON.parse(localStorage.getItem('clinic_commission_settings') || 'null') || {
    type: 'fixed',
    value: 200000,
    currency: 'LAK',
    auto_trigger: true,
    target_enabled: true,
    target_goal: 20,
    target_bonus_value: 50000
};

window.commissionLogs = JSON.parse(localStorage.getItem('clinic_commission_logs') || 'null') || [
    { id: 'COM-50001', referrer_id: '961220', referrer_name: '961220 - LAVLAVA', patient_name: 'น้อยใจ', visit_id: 'VIS-345173', total_invoice: 1525000, amount: 200000, base_amount: 200000, item_amount: 0, status: 'pending', created_at: '2026-08-07T10:00:00Z' },
    { id: 'COM-50002', referrer_id: '961220', referrer_name: '961220 - LAVLAVA', patient_name: 'LL', visit_id: 'VIS-345174', total_invoice: 850000, amount: 300000, base_amount: 200000, item_amount: 100000, status: 'pending', created_at: '2026-08-07T09:30:00Z' },
    { id: 'COM-50003', referrer_id: '104289', referrer_name: '104289 - LOVE STK', patient_name: 'สายธี', visit_id: 'VIS-345175', total_invoice: 450000, amount: 200000, base_amount: 200000, item_amount: 0, status: 'paid', paid_at: '2026-08-04T14:00:00Z', payout_method: 'โอนเงินผ่านธนาคาร (อนุมัติจ่ายแล้ว)', payout_ref: 'SLIP-99281', created_at: '2026-08-04T10:00:00Z' }
];

function getCurrencySymbol() {
    return (window.commissionSettings && window.commissionSettings.currency === 'LAK') ? '₭' : '฿';
}

function getCurrencyUnitName() {
    return (window.commissionSettings && window.commissionSettings.currency === 'LAK') ? 'กีบ' : 'บาท';
}

function formatCommissionAmount(num) {
    const n = parseFloat(num || 0);
    const val = isNaN(n) ? '0' : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    const sym = getCurrencySymbol();
    return `${sym}${val}`;
}

function getMonthlyReferredCount(referrerId, referrerName) {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    return window.commissionLogs.filter(l => {
        const matchReferrer = (l.referrer_id === referrerId || l.referrer_name === referrerName);
        let logYearMonth = '';
        if (l.created_at) {
            const d = new Date(l.created_at);
            logYearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
        return matchReferrer && (logYearMonth === currentYearMonth || !l.created_at);
    }).length;
}

function saveReferralLocalData() {
    localStorage.setItem('clinic_referrers', JSON.stringify(window.referrersData));
    localStorage.setItem('clinic_commission_settings', JSON.stringify(window.commissionSettings));
    localStorage.setItem('clinic_commission_logs', JSON.stringify(window.commissionLogs));

    // Sync directly to Supabase Cloud DB with field sanitization for 100% cloud DB alignment
    try {
        if (typeof _supabase !== 'undefined') {
            if (Array.isArray(window.commissionLogs) && window.commissionLogs.length > 0) {
                const sanitizedLogs = window.commissionLogs.map(l => ({
                    id: String(l.id),
                    referrer_id: l.referrer_id ? String(l.referrer_id) : null,
                    referrer_name: l.referrer_name || null,
                    patient_name: l.patient_name || null,
                    visit_id: l.visit_id ? String(l.visit_id) : null,
                    total_invoice: l.total_invoice ? parseFloat(l.total_invoice) : 0,
                    amount: l.amount ? parseFloat(l.amount) : 0,
                    base_amount: l.base_amount !== undefined ? parseFloat(l.base_amount) : (l.item_amount ? (parseFloat(l.amount) - parseFloat(l.item_amount)) : parseFloat(l.amount)),
                    item_amount: l.item_amount ? parseFloat(l.item_amount) : 0,
                    status: l.status || 'pending',
                    paid_at: l.paid_at || null,
                    payout_method: l.payout_method || null,
                    payout_ref: l.payout_ref || null,
                    is_bonus: !!l.is_bonus,
                    created_at: l.created_at || new Date().toISOString()
                }));
                _supabase.from('commission_logs').upsert(sanitizedLogs).then(() => {}).catch(() => {});
            }
            if (Array.isArray(window.referrersData) && window.referrersData.length > 0) {
                const sanitizedRef = window.referrersData.map(r => ({
                    id: String(r.id),
                    code: r.code ? String(r.code) : String(r.id),
                    name: r.name || '',
                    phone: r.phone || null,
                    bank_name: r.bank_name || null,
                    bank_account: r.bank_account || null,
                    bank_account_name: r.bank_account_name || null,
                    notes: r.notes || null,
                    created_at: r.created_at || new Date().toISOString()
                }));
                _supabase.from('referrers').upsert(sanitizedRef).then(() => {}).catch(() => {});
            }
        }
    } catch(e) {}
}

async function loadReferralData(isManualClick = false) {
    // 1. Reset all Date Filters & Search Inputs across tabs
    const startDateEl = document.getElementById('referrerReportStartDate');
    const endDateEl = document.getElementById('referrerReportEndDate');
    if (startDateEl) startDateEl.value = '';
    if (endDateEl) endDateEl.value = '';

    const searchRefInput = document.getElementById('searchReferrerInput');
    if (searchRefInput) searchRefInput.value = '';

    const searchLogInput = document.getElementById('searchLogInput');
    if (searchLogInput) searchLogInput.value = '';

    const filterStatus = document.getElementById('filterLogStatus');
    if (filterStatus) filterStatus.value = 'all';

    const monthInput = document.getElementById('filterLogMonth');
    if (monthInput) monthInput.value = '';

    const dateInput = document.getElementById('filterLogDate');
    if (dateInput) dateInput.value = '';

    // 2. Fetch fresh data from LocalStorage first as instant cache
    const localRef = localStorage.getItem('clinic_referrers');
    if (localRef) {
        try { 
            const parsedRef = JSON.parse(localRef);
            if (Array.isArray(parsedRef) && parsedRef.length > 0) {
                window.referrersData = parsedRef;
            }
        } catch(e){}
    }

    const localLogs = localStorage.getItem('clinic_commission_logs');
    if (localLogs) {
        try { 
            const parsedLogs = JSON.parse(localLogs);
            if (Array.isArray(parsedLogs) && parsedLogs.length > 0) {
                window.commissionLogs = parsedLogs;
            }
        } catch(e){}
    }

    // 3. Query Supabase Cloud DB tables: referrers and commission_logs (Strict Single Source of Truth)
    try {
        if (typeof _supabase !== 'undefined') {
            const resRef = await _supabase.from('referrers').select('*');
            if (resRef && resRef.data) {
                window.referrersData = resRef.data;
                localStorage.setItem('clinic_referrers', JSON.stringify(window.referrersData));
            }
        }
    } catch (e) {}

    try {
        if (typeof _supabase !== 'undefined') {
            const resLogs = await _supabase.from('commission_logs').select('*').order('created_at', { ascending: false });
            if (resLogs && resLogs.data) {
                window.commissionLogs = resLogs.data;
                localStorage.setItem('clinic_commission_logs', JSON.stringify(window.commissionLogs));
            }
        }
    } catch (e) {}

    // Query active Supabase table: referrers
    try {
        if (typeof _supabase !== 'undefined') {
            const resMembers = await _supabase.from('referrers').select('*');
            if (resMembers && resMembers.data && resMembers.data.length > 0) {
                resMembers.data.forEach(m => {
                    const empCode = m.code || m.id;
                    const match = (window.allEmployeesData || []).find(e => e.emp_code === empCode);
                    if (match) {
                        if (m.phone) match.phone = m.phone;
                        if (m.bank_name) match.bank_name = m.bank_name;
                        if (m.bank_account) match.bank_account = m.bank_account;
                    }
                });
            }
        }
    } catch (e) {}

    // Refresh total_invoice for logs if visit record is found
    if (Array.isArray(window.commissionLogs)) {
        window.commissionLogs.forEach(l => {
            if ((!l.total_invoice || l.total_invoice <= 0) && l.visit_id) {
                const v = (window.allVisits || []).find(x => x.visit_id === l.visit_id);
                if (v) {
                    l.total_invoice = parseFloat(v.payable_amount || v.total_price || v.price || 0);
                }
            }
        });
    }

    saveReferralLocalData();
    updateReferralSummaryCards();
    renderReferrersTable();
    setCommLogPeriodFilter('month');
    renderCommissionLogsTable();
    renderDailyExamReport();
    populateReferrerDropdowns();

    const valInput = document.getElementById('commValueInput');
    if (valInput) valInput.value = window.commissionSettings.value || 200;
    
    const currSelect = document.getElementById('commCurrencySelect');
    if (currSelect) currSelect.value = window.commissionSettings.currency || 'THB';

    const pctRadio = document.getElementById('commTypePercent');
    const fixRadio = document.getElementById('commTypeFixed');
    if (window.commissionSettings.type === 'percentage') {
        if (pctRadio) pctRadio.checked = true;
    } else {
        if (fixRadio) fixRadio.checked = true;
    }
    
    const autoSw = document.getElementById('autoTriggerComm');
    if (autoSw) autoSw.checked = window.commissionSettings.auto_trigger !== false;

    const targetSw = document.getElementById('targetEnableSwitch');
    if (targetSw) targetSw.checked = window.commissionSettings.target_enabled === true;

    const targetGoalInput = document.getElementById('targetGoalCount');
    if (targetGoalInput) targetGoalInput.value = window.commissionSettings.target_goal || 20;

    const targetBonusInput = document.getElementById('targetBonusValue');
    if (targetBonusInput) targetBonusInput.value = window.commissionSettings.target_bonus_value || (window.commissionSettings.type === 'percentage' ? 10 : 500);

    toggleCommTypeDisplay();

    const itemSw = document.getElementById('itemModeSwitch');
    if (itemSw) {
        itemSw.checked = localStorage.getItem('hr_item_commission_enabled') === 'true';
    }
    renderItemCommissionSettingsTable();

    if (isManualClick && typeof Swal !== 'undefined') {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
        Toast.fire({
            icon: 'success',
            title: 'รีเฟรชข้อมูลสำเร็จ'
        });
    }
}

function updateReferralSummaryCards() {
    const totalMembers = window.referrersData.length;
    let totalCommSum = 0;
    let totalPaidSum = 0;
    let totalPendingSum = 0;

    window.commissionLogs.forEach(log => {
        const amt = parseFloat(log.amount || 0);
        totalCommSum += amt;
        if (log.status === 'paid') {
            totalPaidSum += amt;
        } else {
            totalPendingSum += amt;
        }
    });

    const elCount = document.getElementById('refTotalMembersCount');
    const elSum = document.getElementById('refTotalCommissionSum');
    const elPaid = document.getElementById('refTotalPaidSum');
    const elPending = document.getElementById('refTotalPendingSum');

    if (elCount) elCount.innerText = `${totalMembers.toLocaleString('en-US')} คน`;
    if (elSum) elSum.innerText = formatCommissionAmount(totalCommSum);
    if (elPaid) elPaid.innerText = formatCommissionAmount(totalPaidSum);
    if (elPending) elPending.innerText = formatCommissionAmount(totalPendingSum);
}

function getFilteredReferrersData() {
    const input = document.getElementById('searchReferrerInput');
    const query = input ? input.value.toLowerCase().trim() : '';

    const startDateEl = document.getElementById('referrerReportStartDate');
    const endDateEl = document.getElementById('referrerReportEndDate');
    const startDate = startDateEl && startDateEl.value ? new Date(startDateEl.value + 'T00:00:00') : null;
    const endDate = endDateEl && endDateEl.value ? new Date(endDateEl.value + 'T23:59:59') : null;

    let list = [...(window.referrersData || [])];

    // Ensure referrers with paid commissionLogs exist in list
    (window.commissionLogs || []).forEach(log => {
        if (log.status === 'paid' && (log.referrer_id || log.referrer_name)) {
            const found = list.find(r => r.id === log.referrer_id || r.code === log.referrer_id || r.name === log.referrer_name);
            if (!found) {
                list.push({
                    id: log.referrer_id || ('REF-' + Math.floor(Math.random() * 10000)),
                    code: log.referrer_id || log.referrer_name,
                    name: log.referrer_name || log.referrer_id,
                    phone: '-',
                    bank_name: '-',
                    bank_account: '-'
                });
            }
        }
    });

    if (query) {
        list = list.filter(r => 
            (r.name && r.name.toLowerCase().includes(query)) ||
            (r.code && r.code.toLowerCase().includes(query)) ||
            (r.phone && r.phone.includes(query))
        );
    }

    const reportData = [];

    // Fetch latest cache from MLM System (Team.html / stk_app_cache_data) if available in localStorage
    let mlmMembersCache = [];
    try {
        const cacheRaw = localStorage.getItem('stk_app_cache_data');
        if (cacheRaw) {
            const parsed = JSON.parse(cacheRaw);
            if (parsed && Array.isArray(parsed.members)) {
                mlmMembersCache = parsed.members;
            }
        }
    } catch(e) {}

    list.forEach(r => {
        // Find matching member details from MLM cache or allEmployeesData
        const mlmMatch = mlmMembersCache.find(m => 
            (m.id && (m.id === r.id || m.id === r.code || r.code?.includes(m.id) || r.id?.includes(m.id))) ||
            (m.user_id && (m.user_id === r.id || m.user_id === r.code)) ||
            (m.name && (m.name === r.name || r.name?.includes(m.name)))
        );

        const empMatch = (window.allEmployeesData || []).find(e => 
            (e.emp_code && (e.emp_code === r.id || e.emp_code === r.code || r.code?.includes(e.emp_code) || r.id?.includes(e.emp_code))) ||
            (e.full_name && (e.full_name === r.name || r.name?.includes(e.full_name)))
        );

        const phone = (mlmMatch && (mlmMatch.phone || mlmMatch.phone_number)) 
            ? (mlmMatch.phone || mlmMatch.phone_number) 
            : ((r.phone && r.phone !== '-') ? r.phone : (empMatch && empMatch.phone ? empMatch.phone : '-'));

        const bankName = (mlmMatch && (mlmMatch.bankName || mlmMatch.bank_name)) 
            ? (mlmMatch.bankName || mlmMatch.bank_name) 
            : ((r.bank_name && r.bank_name !== '-') ? r.bank_name : (empMatch && empMatch.bank_name ? empMatch.bank_name : 'BCEL'));

        const bankAccount = (mlmMatch && (mlmMatch.bankAccountNo || mlmMatch.bank_account_no || mlmMatch.bank_account)) 
            ? (mlmMatch.bankAccountNo || mlmMatch.bank_account_no || mlmMatch.bank_account) 
            : ((r.bank_account && r.bank_account !== '-') ? r.bank_account : (empMatch && empMatch.bank_account ? empMatch.bank_account : '-'));

        // ONLY include paid logs for Tab 2 Report
        let paidLogs = (window.commissionLogs || []).filter(l => 
            l.status === 'paid' && (
                l.referrer_id === r.id || 
                l.referrer_id === r.code || 
                l.referrer_name === r.name
            )
        );

        if (startDate || endDate) {
            paidLogs = paidLogs.filter(l => {
                const logDateStr = l.paid_at || l.created_at;
                if (!logDateStr) return true;
                const d = new Date(logDateStr);
                if (startDate && d < startDate) return false;
                if (endDate && d > endDate) return false;
                return true;
            });
        }

        // Only show referrers that have at least 1 paid dividend log
        if (paidLogs.length > 0) {
            let baseEarned = 0;
            let itemEarned = 0;
            let totalEarned = 0;

            paidLogs.forEach(l => {
                const bVal = l.base_amount !== undefined ? parseFloat(l.base_amount) : (l.item_amount ? (parseFloat(l.amount) - parseFloat(l.item_amount)) : parseFloat(l.amount));
                const iVal = parseFloat(l.item_amount || 0);
                const tVal = bVal + iVal;

                baseEarned += bVal;
                itemEarned += iVal;
                totalEarned += tVal;
            });

            reportData.push({
                ...r,
                phone: phone,
                bank_name: bankName,
                bank_account: bankAccount,
                logsCount: paidLogs.length,
                baseEarned,
                itemEarned,
                totalEarned,
                paidEarned: totalEarned
            });
        }
    });

    return reportData;
}

function renderReferrersTable(filterText = '') {
    const tbody = document.querySelector('#referrersTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const filtered = getFilteredReferrersData();

    let totalBase = 0;
    let totalItem = 0;
    let totalEarnedSum = 0;
    let totalPaidSum = 0;

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-5"><i class="bi bi-calendar-x fs-3 d-block mb-2 text-primary opacity-50"></i>ไม่พบข้อมูลสมาชิกผู้แนะนำในช่วงวันที่เลือก</td></tr>';
    } else {
        filtered.forEach((r, index) => {
            const baseEarned = r.baseEarned || 0;
            const itemEarned = r.itemEarned || 0;
            const totalEarned = r.totalEarned || 0;
            const paidEarned = r.paidEarned || 0;

            totalBase += baseEarned;
            totalItem += itemEarned;
            totalEarnedSum += totalEarned;
            totalPaidSum += paidEarned;

            const phoneDisplay = r.phone && r.phone !== '-' ? `<i class="ph ph-phone me-1 text-primary"></i>${r.phone}` : '-';
            const bankDisplay = r.bank_name && r.bank_name !== '-' 
                ? `<div class="fw-semibold text-dark">${r.bank_name}</div><small class="text-muted font-monospace">${r.bank_account || '-'}</small>`
                : '-';

            tbody.innerHTML += `
                <tr>
                    <td class="ps-4 fw-bold text-muted" style="width: 50px;">${index + 1}</td>
                    <td class="fw-bold text-primary">${r.code || r.id}</td>
                    <td>
                        <div class="fw-bold text-dark">${r.name}</div>
                        <small class="text-muted">${r.notes || '-'}</small>
                    </td>
                    <td>${phoneDisplay}</td>
                    <td>${bankDisplay}</td>
                    <td class="text-end fw-semibold text-dark">${formatCommissionAmount(baseEarned)}</td>
                    <td class="text-end fw-semibold text-dark">${formatCommissionAmount(itemEarned)}</td>
                    <td class="text-end fw-bold text-primary fs-6">${formatCommissionAmount(totalEarned)}</td>
                    <td class="text-end fw-bold text-success fs-6">${formatCommissionAmount(paidEarned)}</td>
                    <td class="text-center pe-4">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editReferrer('${r.id}')" title="แก้ไขข้อมูลผู้แนะนำ"><i class="bi bi-pencil-square"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteReferrer('${r.id}')" title="ลบผู้แนะนำ"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    if (document.getElementById('reportFooterCount')) document.getElementById('reportFooterCount').textContent = `${filtered.length} คน`;
    if (document.getElementById('reportFooterBase')) document.getElementById('reportFooterBase').textContent = formatCommissionAmount(totalBase);
    if (document.getElementById('reportFooterItem')) document.getElementById('reportFooterItem').textContent = formatCommissionAmount(totalItem);
    if (document.getElementById('reportFooterEarned')) document.getElementById('reportFooterEarned').textContent = formatCommissionAmount(totalEarnedSum);
    if (document.getElementById('reportFooterPaid')) document.getElementById('reportFooterPaid').textContent = formatCommissionAmount(totalPaidSum);
}

async function openPayoutModal(logId) {
    const log = (window.commissionLogs || []).find(l => l.id === logId);
    if (!log) {
        Swal.fire('ข้อผิดพลาด', 'ไม่พบรายการปันผลที่เลือก', 'error');
        return;
    }

    const baseVal = log.base_amount !== undefined ? parseFloat(log.base_amount) : parseFloat(log.amount);
    const itemVal = parseFloat(log.item_amount || 0);
    const totalVal = baseVal + itemVal;

    const { value: formValues } = await Swal.fire({
        title: '<h5 class="fw-bold mb-0 text-success"><i class="ph ph-hand-coins me-2"></i>อนุมัติจ่ายเงินปันผล</h5>',
        html: `
            <div class="text-start p-2" style="font-size: 0.9rem;">
                <div class="p-3 bg-light rounded-3 border mb-3">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">ผู้แนะนำ:</span>
                        <strong class="text-dark">${log.referrer_name || '-'}</strong>
                    </div>
                    <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">ผู้ป่วยเคส:</span>
                        <strong class="text-dark">${log.patient_name || '-'}</strong>
                    </div>
                    <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">ยอดค่าบริการ:</span>
                        <strong class="text-primary">${formatCommissionAmount(log.total_invoice)}</strong>
                    </div>
                    <hr class="my-2 border-secondary opacity-25">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">ปันผลแบบภาพรวม:</span>
                        <span class="fw-semibold text-dark">${formatCommissionAmount(baseVal)}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">ปันผลแบบรายรายการ:</span>
                        <span class="fw-semibold text-dark">${formatCommissionAmount(itemVal)}</span>
                    </div>
                    <div class="d-flex justify-content-between mt-2 pt-1 border-top">
                        <span class="fw-bold text-dark fs-6">ยอดรวมปันผลจ่ายสุทธิ:</span>
                        <strong class="text-success fs-5">${formatCommissionAmount(totalVal)}</strong>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label fw-bold small text-secondary">ช่องทางการจ่ายเงิน</label>
                    <select id="swalPayoutMethod" class="form-select custom-input py-2">
                        <option value="โอนเงินผ่านธนาคาร (อนุมัติจ่ายแล้ว)">โอนเงินผ่านธนาคาร</option>
                        <option value="เงินสด">เงินสด</option>
                        <option value="เช็ค / อื่นๆ">เช็ค / อื่นๆ</option>
                    </select>
                </div>
                <div class="mb-2">
                    <label class="form-label fw-bold small text-secondary">เลขที่อ้างอิง / สลิปโอนเงิน (ถ้ามี)</label>
                    <input type="text" id="swalPayoutRef" class="form-control custom-input py-2" placeholder="เช่น SLIP-102938">
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-check-circle-fill me-1"></i> ยืนยันอนุมัติจ่ายเงิน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#10b981',
        preConfirm: () => {
            const method = document.getElementById('swalPayoutMethod').value;
            const ref = document.getElementById('swalPayoutRef').value.trim() || 'อนุมัติจ่ายแล้ว';
            return { method, ref };
        }
    });

    if (formValues) {
        log.status = 'paid';
        log.paid_at = new Date().toISOString();
        log.payout_method = formValues.method;
        log.payout_ref = formValues.ref;

        saveReferralLocalData();

        try {
            if (typeof _supabase !== 'undefined') {
                await _supabase.from('commission_logs').update({
                    status: 'paid',
                    paid_at: log.paid_at,
                    payout_method: formValues.method,
                    payout_ref: formValues.ref
                }).eq('id', log.id);
            }
        } catch(e) {
            console.warn('Supabase log payout update fallback');
        }

        updateReferralSummaryCards();
        renderCommissionLogsTable();
        renderReferrersTable();

        Swal.fire({
            icon: 'success',
            title: 'อนุมัติจ่ายเงินปันผลเรียบร้อย!',
            text: 'รายการปันผลถูกอัปเดตและแสดงในหน้ารายงานเรียบร้อยแล้ว',
            confirmButtonColor: '#003f88'
        });
    }
}
window.openPayoutModal = openPayoutModal;

function filterReferrersTable() {
    renderReferrersTable();
}

function exportReferrersExcel() {
    const data = getFilteredReferrersData();
    if (!data || data.length === 0) {
        Swal.fire({ icon: 'warning', title: 'ไม่มีข้อมูล', text: 'ไม่พบข้อมูลรายงานสำหรับส่งออก Excel' });
        return;
    }

    const startVal = document.getElementById('referrerReportStartDate')?.value || '';
    const endVal = document.getElementById('referrerReportEndDate')?.value || '';
    const dateRangeStr = (startVal || endVal) ? `_${startVal}_to_${endVal}` : '';

    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel
    csvContent += "รหัสสมาชิก,ชื่อ-นามสกุล,เบอร์โทร,ธนาคาร,เลขที่บัญชี,ยอดปันผล (ภาพรวม),ยอดปันผล (แบบรายการ),ยอดรวม,ปันผลสะสม (จ่ายแล้ว)\n";

    data.forEach(r => {
        const code = `"${(r.code || r.id || '').replace(/"/g, '""')}"`;
        const name = `"${(r.name || '').replace(/"/g, '""')}"`;
        const phone = `"${(r.phone || '').replace(/"/g, '""')}"`;
        const bank = `"${(r.bank_name || '').replace(/"/g, '""')}"`;
        const acc = `"${(r.bank_account || '').replace(/"/g, '""')}"`;
        const baseEarned = r.baseEarned || 0;
        const itemEarned = r.itemEarned || 0;
        const totalEarned = r.totalEarned || 0;
        const paidEarned = r.paidEarned || 0;

        csvContent += `${code},${name},${phone},${bank},${acc},${baseEarned},${itemEarned},${totalEarned},${paidEarned}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Referrer_Report${dateRangeStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportReferrersPDF() {
    printReferrersReport();
}

function printReferrersReport() {
    const data = getFilteredReferrersData();
    const startVal = document.getElementById('referrerReportStartDate')?.value || 'ทั้งหมด';
    const endVal = document.getElementById('referrerReportEndDate')?.value || 'ทั้งหมด';
    const printDate = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const totalMembers = data.length;
    const totalEarnedSum = data.reduce((sum, r) => sum + (r.totalEarned || 0), 0);
    const totalPaidSum = data.reduce((sum, r) => sum + (r.paidEarned || 0), 0);

    const rowsHtml = data.map((r, i) => `
        <tr>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${i + 1}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #003f88;">${r.code || r.id}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.name}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.phone || '-'}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.bank_name || '-'} (${r.bank_account || '-'})</td>
            <td style="text-align: right; border: 1px solid #cbd5e1; padding: 8px;">${formatCommissionAmount(r.baseEarned || 0)}</td>
            <td style="text-align: right; border: 1px solid #cbd5e1; padding: 8px;">${formatCommissionAmount(r.itemEarned || 0)}</td>
            <td style="text-align: right; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #0284c7;">${formatCommissionAmount(r.totalEarned || 0)}</td>
            <td style="text-align: right; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #16a34a;">${formatCommissionAmount(r.paidEarned || 0)}</td>
        </tr>
    `).join('');

    const printWin = window.open('', '_blank', 'width=900,height=700');
    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>รายงานสมาชิกผู้แนะนำและปันผล - Clinic System</title>
            <style>
                body { font-family: 'Sarabun', 'Kanit', sans-serif; padding: 24px; color: #0f172a; margin: 0; }
                .header { text-align: center; border-bottom: 2px solid #003f88; padding-bottom: 12px; margin-bottom: 20px; }
                .title { font-size: 20px; font-weight: bold; color: #003f88; margin: 0; }
                .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
                .meta { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; background: #f8fafc; padding: 10px 14px; border-radius: 8px; }
                .stats { display: flex; gap: 16px; margin-bottom: 20px; }
                .stat-box { flex: 1; background: #f1f5f9; padding: 12px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
                .stat-num { font-size: 18px; font-weight: bold; color: #003f88; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
                th { background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
                .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; }
                .sign-box { text-align: center; width: 200px; }
                .sign-line { border-bottom: 1px solid #94a3b8; margin-top: 50px; margin-bottom: 6px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2 class="title">🏥 รายงานสมาชิกผู้แนะนำและค่าคอมมิชชั่น / ปันผล (Clinic System)</h2>
                <div class="subtitle">ระบบบริหารจัดการคลินิกและการปันผลสมาชิก</div>
            </div>

            <div class="meta">
                <div>ช่วงวันที่: <strong>${startVal} ถึง ${endVal}</strong></div>
                <div>วันที่ออกรายงาน: <strong>${printDate}</strong></div>
            </div>

            <div class="stats">
                <div class="stat-box">
                    <div style="font-size: 12px; color: #64748b;">จำนวนผู้แนะนำทั้งหมด</div>
                    <div class="stat-num">${totalMembers} คน</div>
                </div>
                <div class="stat-box">
                    <div style="font-size: 12px; color: #64748b;">ยอดปันผลสะสมรวม</div>
                    <div class="stat-num" style="color: #0284c7;">${formatCommissionAmount(totalEarnedSum)}</div>
                </div>
                <div class="stat-box">
                    <div style="font-size: 12px; color: #64748b;">อนุมัติจ่ายแล้วรวม</div>
                    <div class="stat-num" style="color: #16a34a;">${formatCommissionAmount(totalPaidSum)}</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="text-align: center; width: 40px;">#</th>
                        <th style="width: 100px;">รหัสสมาชิก</th>
                        <th>ชื่อ-นามสกุล</th>
                        <th style="width: 110px;">เบอร์โทร</th>
                        <th>บัญชีธนาคาร</th>
                        <th style="text-align: right; width: 100px;">ยอดปันผล</th>
                        <th style="text-align: right; width: 110px;">แบบรายการ</th>
                        <th style="text-align: right; width: 110px;">ยอดรวม</th>
                        <th style="text-align: right; width: 110px;">ปันผลสะสม (จ่ายแล้ว)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="footer">
                <div class="sign-box">
                    <div class="sign-line"></div>
                    <div>ผู้รายงาน / เจ้าหน้าที่</div>
                </div>
                <div class="sign-box">
                    <div class="sign-line"></div>
                    <div>ผู้อนุมัติ / ผู้จัดการคลินิก</div>
                </div>
            </div>
        </body>
        </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
        printWin.print();
    }, 500);
}

let commLogPeriodMode = 'month';

function setCommLogPeriodFilter(mode) {
    if (commLogPeriodMode === mode) {
        commLogPeriodMode = 'all';
    } else {
        commLogPeriodMode = mode;
    }

    const btnMonth = document.getElementById('btnCommLogMonth');
    const btnYear = document.getElementById('btnCommLogYear');
    const btnDay = document.getElementById('btnCommLogDay');
    const dateInput = document.getElementById('filterLogDate');
    const monthInput = document.getElementById('filterLogMonth');

    [btnMonth, btnYear, btnDay].forEach(btn => {
        if (btn) {
            btn.classList.remove('bg-light', 'text-primary', 'shadow-xs', 'fw-bold');
            btn.classList.add('text-muted', 'bg-transparent');
        }
    });

    if (dateInput) dateInput.classList.add('d-none');
    if (monthInput) monthInput.classList.add('d-none');

    if (commLogPeriodMode === 'month') {
        if (btnMonth) {
            btnMonth.classList.remove('text-muted', 'bg-transparent');
            btnMonth.classList.add('bg-light', 'text-primary', 'shadow-xs', 'fw-bold');
        }
        if (monthInput) {
            monthInput.classList.remove('d-none');
            if (!monthInput.value) {
                const now = new Date();
                monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            }
        }
    } else if (commLogPeriodMode === 'year') {
        if (btnYear) {
            btnYear.classList.remove('text-muted', 'bg-transparent');
            btnYear.classList.add('bg-light', 'text-primary', 'shadow-xs', 'fw-bold');
        }
    } else if (commLogPeriodMode === 'day') {
        if (btnDay) {
            btnDay.classList.remove('text-muted', 'bg-transparent');
            btnDay.classList.add('bg-light', 'text-primary', 'shadow-xs', 'fw-bold');
        }
        if (dateInput) {
            dateInput.classList.remove('d-none');
            if (!dateInput.value) {
                const now = new Date();
                dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            }
        }
    }

    renderCommissionLogsTable();
}

function renderCommissionLogsTable() {
    const tbody = document.querySelector('#commissionLogsTable tbody');
    if (!tbody) return;

    const filterEl = document.getElementById('filterLogStatus');
    const filterStatus = filterEl ? filterEl.value : 'all';

    const searchInput = document.getElementById('searchLogInput');
    const searchText = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const dateInput = document.getElementById('filterLogDate');
    const monthInput = document.getElementById('filterLogMonth');

    tbody.innerHTML = '';

    let logs = [...window.commissionLogs];

    // 1. Filter by Status
    if (filterStatus !== 'all') {
        logs = logs.filter(l => l.status === filterStatus);
    }

    // 2. Filter by Period (Month / Year / Day)
    if (commLogPeriodMode === 'month') {
        let targetMonth = monthInput && monthInput.value ? monthInput.value : '';
        if (!targetMonth) {
            const now = new Date();
            targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        logs = logs.filter(l => {
            if (!l.created_at) return true;
            const d = new Date(l.created_at);
            const logMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            return logMonth === targetMonth;
        });
    } else if (commLogPeriodMode === 'year') {
        const targetYear = new Date().getFullYear();
        logs = logs.filter(l => {
            if (!l.created_at) return true;
            const d = new Date(l.created_at);
            return d.getFullYear() === targetYear;
        });
    } else if (commLogPeriodMode === 'day') {
        let targetDate = dateInput && dateInput.value ? dateInput.value : '';
        if (!targetDate) {
            const now = new Date();
            targetDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }
        logs = logs.filter(l => {
            if (!l.created_at) return true;
            const d = new Date(l.created_at);
            const logDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return logDate === targetDate;
        });
    }

    // 3. Filter by Search input text
    if (searchText) {
        logs = logs.filter(l => {
            const refName = (l.referrer_name || '').toLowerCase();
            const patName = (l.patient_name || '').toLowerCase();
            const logId = (l.id || '').toLowerCase();
            const payoutMethod = (l.payout_method || '').toLowerCase();
            const payoutRef = (l.payout_ref || '').toLowerCase();

            return refName.includes(searchText) ||
                   patName.includes(searchText) ||
                   logId.includes(searchText) ||
                   payoutMethod.includes(searchText) ||
                   payoutRef.includes(searchText);
        });
    }

    // 4. Sort logs: Pending status items ALWAYS come first at Rank 1, followed by newest timestamp
    logs.sort((a, b) => {
        const isPendingA = a.status === 'pending' ? 1 : 0;
        const isPendingB = b.status === 'pending' ? 1 : 0;

        if (isPendingA !== isPendingB) {
            return isPendingB - isPendingA; // Pending items appear FIRST at the top!
        }

        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (timeA !== timeB) {
            return timeB - timeA; // Secondary sort: Newest timestamp first
        }
        return (b.id || '').localeCompare(a.id || '', undefined, { numeric: true, sensitivity: 'base' });
    });

    // Calculate and populate Bottom Summary Bar totals dynamically
    let totalInvoiceSum = 0;
    let totalBaseSum = 0;
    let totalItemSum = 0;

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-5">ไม่มีประวัติรายการเงินปันผล/คอมมิชชั่น</td></tr>';
    } else {
        logs.forEach((l, index) => {
            let dateStr = l.created_at ? new Date(l.created_at).toLocaleDateString('th-TH') : '-';
            let statusBadge = l.status === 'paid' 
                ? '<span class="badge badge-paid"><i class="bi bi-check-circle-fill me-1"></i>จ่ายแล้ว</span>'
                : '<span class="badge badge-pending"><i class="bi bi-clock-history me-1"></i>รออนุมัติ / รอจ่าย</span>';

            let actionBtn = l.status === 'paid'
                ? `<span class="text-muted small"><i class="bi bi-info-circle me-1"></i>${l.payout_method || 'จ่ายแล้ว'} (${l.payout_ref || '-'})</span>`
                : `<button class="btn btn-sm btn-success px-3 fw-semibold shadow-xs" onclick="openPayoutModal('${l.id}')"><i class="ph ph-hand-coins me-1"></i> จ่ายเงินปันผล</button>`;

            let bonusBadge = l.is_bonus ? '<span class="badge bg-warning text-dark me-1" style="font-size: 0.7rem;"><i class="bi bi-trophy-fill"></i> โบนัสเป้าหมาย</span>' : '';

            let baseVal = l.base_amount !== undefined ? parseFloat(l.base_amount) : (l.item_amount ? (parseFloat(l.amount) - parseFloat(l.item_amount)) : parseFloat(l.amount));
            let itemVal = parseFloat(l.item_amount || 0);
            let totalVal = baseVal + itemVal;

            let invoiceVal = parseFloat(l.total_invoice || 0);

            totalInvoiceSum += invoiceVal;
            totalBaseSum += baseVal;
            totalItemSum += itemVal;

            let overallText = baseVal > 0 ? formatCommissionAmount(baseVal) : (itemVal > 0 ? formatCommissionAmount(0) : formatCommissionAmount(l.amount));
            let itemText = formatCommissionAmount(itemVal);
            let totalText = formatCommissionAmount(totalVal);

            tbody.innerHTML += `
                <tr class="${l.status === 'pending' ? 'table-warning-subtle fw-semibold' : ''}">
                    <td class="ps-4 fw-bold text-muted" style="width: 50px;">${index + 1}</td>
                    <td class="small text-muted">${dateStr}</td>
                    <td class="fw-bold text-dark">${l.referrer_name || '-'}</td>
                    <td class="fw-medium">${l.patient_name || '-'} ${bonusBadge}</td>
                    <td class="fw-semibold text-dark">${formatCommissionAmount(invoiceVal)}</td>
                    <td class="text-end">
                        <div class="fw-bold text-success fs-6">${overallText}</div>
                        <div class="extra-small text-muted font-monospace" style="font-size: 0.72rem;">ภาพรวม: ${overallText}</div>
                    </td>
                    <td class="text-end">
                        <div class="fw-bold text-success fs-6">${itemText}</div>
                        <div class="extra-small text-muted font-monospace" style="font-size: 0.72rem;">รายรายการ: ${itemText}</div>
                    </td>
                    <td class="text-end bg-light-subtle">
                        <div class="fw-bold text-success fs-6">${totalText}</div>
                        <div class="extra-small text-muted font-monospace" style="font-size: 0.72rem;">รวมทั้งหมด: ${totalText}</div>
                    </td>
                    <td class="text-center">${statusBadge}</td>
                    <td class="text-center pe-4">${actionBtn}</td>
                </tr>
            `;
        });
    }

    const totalCombinedSum = totalBaseSum + totalItemSum;

    if (document.getElementById('commFooterCount')) document.getElementById('commFooterCount').textContent = `${logs.length} รายการ`;
    if (document.getElementById('commFooterInvoice')) document.getElementById('commFooterInvoice').textContent = formatCommissionAmount(totalInvoiceSum);
    if (document.getElementById('commFooterBase')) document.getElementById('commFooterBase').textContent = formatCommissionAmount(totalBaseSum);
    if (document.getElementById('commFooterItem')) document.getElementById('commFooterItem').textContent = formatCommissionAmount(totalItemSum);
    if (document.getElementById('commFooterTotal')) document.getElementById('commFooterTotal').textContent = formatCommissionAmount(totalCombinedSum);
}

window.allEmployeesData = [
    { emp_code: 'ADMIN01', full_name: 'Administrator (ผู้ดูแลระบบ)', phone: '2044438959', bank_name: 'Phongsavanh', bank_account: '520680455' },
    { emp_code: 'L03053', full_name: 'AUCKSONE VONGVIVANH MS', phone: '2044867055', bank_name: 'BCEL', bank_account: '0125888888' },
    { emp_code: '104289', full_name: '104289 - LOVE STK', phone: '2032936310', bank_name: 'LDB', bank_account: '772253139' },
    { emp_code: 'l04289', full_name: 'LOVE STK', phone: '2032936310', bank_name: 'LDB', bank_account: '772253139' },
    { emp_code: '961220', full_name: 'LAVLAVA', phone: '2038590807', bank_name: 'LDB', bank_account: '863458950' },
    { emp_code: '454289', full_name: 'DM KHAMSAVENG', phone: '2098436819', bank_name: 'Phongsavanh', bank_account: '339073603' },
    { emp_code: '293866', full_name: 'HATKEO XOUMKHAMBAN MS', phone: '2098403633', bank_name: 'Phongsavanh', bank_account: '486331783' },
    { emp_code: 'M0001', full_name: 'LEE YEARXONGMOUA', phone: '2077889900', bank_name: 'BCEL', bank_account: '9988776655' },
    { emp_code: '54245141', full_name: 'CEO SAYLAR', phone: '2093384705', bank_name: 'LDB', bank_account: '233309645' },
    { emp_code: '91924692', full_name: 'CEO TINOY', phone: '2030732058', bank_name: 'JDB', bank_account: '775942339' },
    { emp_code: 'L02987', full_name: 'MS THONGSY KHAMBOUN', phone: '2051225943', bank_name: 'JDB', bank_account: '133378952' },
    { emp_code: 'L03741', full_name: 'MR KHAMPASONG XAYYALAH', phone: '2033128275', bank_name: 'LDB', bank_account: '263045123' },
    { emp_code: 'L02817', full_name: 'MS TOUNIT CHANTEEYAVONG', phone: '2037261822', bank_name: 'JDB', bank_account: '615916643' },
    { emp_code: 'L02672', full_name: 'MS CHANSAMONE SENGSULIKONE', phone: '2083787352', bank_name: 'LDB', bank_account: '695583830' },
    { emp_code: 'L02008', full_name: 'MR NOUY SYSAVARD', phone: '2085002578', bank_name: 'JDB', bank_account: '448861803' },
    { emp_code: 'L03833', full_name: 'MR DUANGDEEN XAYYAPANYA', phone: '2045157359', bank_name: 'Phongsavanh', bank_account: '630685339' },
    { emp_code: 'L02934', full_name: 'MR NOY PHAYYAVONG', phone: '2081429630', bank_name: 'Phongsavanh', bank_account: '322069313' },
    { emp_code: 'L03839', full_name: 'MR THAYVANH DOUANGSOUVANH', phone: '2086464405', bank_name: 'LDB', bank_account: '960093647' },
    { emp_code: 'L03844', full_name: 'MS ANONG XAIYALATH', phone: '2020023726', bank_name: 'LDB', bank_account: '726944322' },
    { emp_code: 'L03596', full_name: 'MS THIPPHASONE SINGHAVONG', phone: '2073849300', bank_name: 'LaoViet', bank_account: '911979250' },
    { emp_code: 'L02897', full_name: 'MS TICKNOK THAMMAVONG', phone: '2037635130', bank_name: 'JDB', bank_account: '377510989' },
    { emp_code: 'L03732', full_name: 'MS KHEMPHONE KHEMPHONE', phone: '2032131057', bank_name: 'JDB', bank_account: '568680377' },
    { emp_code: 'L03709', full_name: 'MS CHERRY LOUANGPHAN', phone: '2082796428', bank_name: 'BCEL', bank_account: '827582306' },
    { emp_code: 'L03858', full_name: 'MS YEN MS', phone: '2023849538', bank_name: 'JDB', bank_account: '494208671' },
    { emp_code: 'L02685', full_name: 'MR SYVA SYSOMPHEANG', phone: '2086930660', bank_name: 'Phongsavanh', bank_account: '568259355' },
    { emp_code: '96956499', full_name: 'MS ນາງ ສຸດາລັດ ວົງສຸລີ', phone: '2040743546', bank_name: 'LaoViet', bank_account: '484913752' },
    { emp_code: 'L02624', full_name: 'MR VIENGTHONG PHANTHAVONG', phone: '2062417368', bank_name: 'LaoViet', bank_account: '157003653' },
    { emp_code: 'L02626', full_name: 'MS BOUAPHOUT PHANPASEUTH', phone: '2047423390', bank_name: 'LaoViet', bank_account: '661544788' },
    { emp_code: 'L02615', full_name: 'MR YEAR VONGXAI', phone: '2068975460', bank_name: 'LDB', bank_account: '893117914' },
    { emp_code: 'L00513', full_name: 'MS NOUKAM PHAIKAMPHENG', phone: '2055266609', bank_name: 'BCEL', bank_account: '479127451' },
    { emp_code: 'L02697', full_name: 'MS KHUANTA SOULIYATAWA', phone: '2048771375', bank_name: 'LDB', bank_account: '283398495' },
    { emp_code: '91102600', full_name: 'MR KHENKHAO OUNXIENGMAY', phone: '2082106781', bank_name: 'BCEL', bank_account: '262676511' },
    { emp_code: '99749239', full_name: 'MR SOUKSAKHONE LASACHAK', phone: '2081116247', bank_name: 'LaoViet', bank_account: '276049176' },
    { emp_code: '96619649', full_name: 'MR SOMCHAN SEMANOU', phone: '2047080155', bank_name: 'BCEL', bank_account: '741935466' },
    { emp_code: 'L02725', full_name: 'MS DUANGPY CHANTHAVONG', phone: '2056355057', bank_name: 'Phongsavanh', bank_account: '460869482' },
    { emp_code: '57880198', full_name: 'MR BOUNSERT SUVANHNAPHUM', phone: '2030730123', bank_name: 'JDB', bank_account: '301333277' },
    { emp_code: 'L02783', full_name: 'MS THONGDEANG THONGSAMOUD', phone: '2023849538', bank_name: 'JDB', bank_account: '494208671' },
    { emp_code: '93997422', full_name: 'MS KONGMEE KEOMANY', phone: '2032131057', bank_name: 'JDB', bank_account: '568680377' },
    { emp_code: '91372055', full_name: 'MS POUNA SOULIYATEN', phone: '2082796428', bank_name: 'BCEL', bank_account: '827582306' },
    { emp_code: '58673093', full_name: 'MR ທ້າວ ຕູ້ຍ ພັນທະວົງ', phone: '2045157359', bank_name: 'Phongsavanh', bank_account: '630685339' },
    { emp_code: '98490799', full_name: 'MS CHANTHONE KEOBOUPHANH', phone: '2044867055', bank_name: 'BCEL', bank_account: '0125888888' },
    { emp_code: 'L03326', full_name: 'MR SOMPHOU SINGSOMMA', phone: '2033128275', bank_name: 'LDB', bank_account: '263045123' },
    { emp_code: 'L13266', full_name: 'MS ນາງ ວັງໃສ ປະຖຳມະວົງ', phone: '2037261822', bank_name: 'JDB', bank_account: '615916643' },
    { emp_code: 'L03051', full_name: 'MR SONEXAY SYLADETH MR', phone: '2083787352', bank_name: 'LDB', bank_account: '695583830' },
    { emp_code: 'VIP009', full_name: 'MS ນາງ ແສງຈັນ ແສງຈັນ', phone: '2085002578', bank_name: 'JDB', bank_account: '448861803' },
    { emp_code: '5665', full_name: 'MD KONGCHAI', phone: '2045157359', bank_name: 'Phongsavanh', bank_account: '630685339' },
    { emp_code: '5551', full_name: 'SOUKSAKHONH DOUANGVIENGXAY', phone: '2081429630', bank_name: 'Phongsavanh', bank_account: '322069313' },
    { emp_code: '95805159', full_name: 'VIENG PHILAVANH', phone: '2086464405', bank_name: 'LDB', bank_account: '960093647' },
    { emp_code: '75113', full_name: 'NOUNA SIHATHEP MSS', phone: '2020023726', bank_name: 'LDB', bank_account: '726944322' },
    { emp_code: '717997', full_name: 'md noy', phone: '2073849300', bank_name: 'LaoViet', bank_account: '911979250' },
    { emp_code: '898989', full_name: 'Tontoeiioii', phone: '2037635130', bank_name: 'JDB', bank_account: '377510989' },
    { emp_code: 'L459401', full_name: 'MR PHOUMMALA VILAYKHAM', phone: '2032131057', bank_name: 'JDB', bank_account: '568680377' }
];

function populateReferrerDropdowns() {
    const datalist = document.getElementById('referrerDatalist');
    const selectEl = document.getElementById('patientReferredBySelect');
    const apptSelect = document.getElementById('apptReferredBySelect');

    let optionsHtml = '';
    const allEmp = window.allEmployeesData || [];

    allEmp.forEach(emp => {
        const code = emp.emp_code || emp.id || '';
        const name = emp.full_name || emp.name || '';
        if (code || name) {
            const valStr = `${code} - ${name}`;
            optionsHtml += `<option value="${valStr}">${valStr}</option>`;
        }
    });

    if (datalist) {
        datalist.innerHTML = optionsHtml;
    }

    [selectEl, apptSelect].forEach(el => {
        if (!el) return;
        if (el.tagName === 'SELECT') {
            const currVal = el.value;
            el.innerHTML = '<option value="">-- ไม่ระบุผู้แนะนำ (ไม่มีค่าปันผล) --</option>' + optionsHtml;
            if (currVal) el.value = currVal;
        } else if (el.tagName === 'INPUT') {
            el.setAttribute('list', 'referrerDatalist');
        }
    });
}

function saveServicesLocalData() {
    try {
        localStorage.setItem('hr_services_data', JSON.stringify(window.servicesData || []));
    } catch (e) {
        console.error('Save services local data error:', e);
    }
}
window.saveServicesLocalData = saveServicesLocalData;

async function loadServicesData() {
    let localData = [];
    const cached = localStorage.getItem('hr_services_data');
    if (cached) {
        try {
            localData = JSON.parse(cached) || [];
        } catch(e) {}
    }

    if (localData && localData.length > 0) {
        window.servicesData = localData;
    } else if (!window.servicesData || window.servicesData.length === 0) {
        window.servicesData = [
            { id: 'SRV-101', name: 'ตรวจความสมบูรณ์ของเม็ดเลือด (CBC)', price: 150000, currency: 'LAK', category: 'เลือดวิทยา (HEMATOLOGY)', description: 'Complete Blood Count', sub_items: [] },
            { id: 'SRV-102', name: 'ตรวจระดับน้ำตาลในเลือด (FBS)', price: 80000, currency: 'LAK', category: 'ชีวเคมี (Biochemistry)', description: 'Fasting Blood Sugar', sub_items: [] },
            { id: 'SRV-103', name: 'แพ็กเกจตรวจสุขภาพรวม (Health Checkup Package)', price: 300000, currency: 'LAK', category: 'ชีวเคมี (Biochemistry)', description: 'แพ็กเกจตรวจเลือดและปัสสาวะ', sub_items: [{ name: 'CBC', price: 150000 }, { name: 'FBS', price: 80000 }, { name: 'Urinalysis', price: 70000 }] }
        ];
    }
    renderServicesTable();

    try {
        const { data, error } = await _supabase.from('services').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
            const processedData = data.map(item => {
                let parsedSubItems = item.sub_items;
                if (typeof parsedSubItems === 'string') {
                    try { parsedSubItems = JSON.parse(parsedSubItems); } catch(e) { parsedSubItems = []; }
                }
                return {
                    ...item,
                    category: getServiceCategory(item),
                    sub_items: Array.isArray(parsedSubItems) ? parsedSubItems : []
                };
            });

            window.servicesData = processedData;
            saveServicesLocalData();
            renderServicesTable();
        }
    } catch (e) {
        console.error('Error loading services from Supabase:', e);
        renderServicesTable();
    }
}

window.loadServices = loadServicesData;

window.servicesCurrentPage = 1;
window.servicesItemsPerPage = 10;
window.selectedServicesCategory = 'ALL';

function renderServicesTable(dataToRender) {
    const tbody = document.querySelector('#servicesTable tbody');
    if (!tbody) return;

    const services = dataToRender || window.servicesData || [];
    const countDisplay = document.getElementById('servicesTotalCountDisplay');
    const paginationEl = document.getElementById('servicesPagination');

    if (countDisplay) {
        countDisplay.textContent = `รายการตรวจทั้งหมด ${services.length} รายการ`;
    }

    if (!services || services.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-5"><i class="bi bi-inbox fs-3 d-block mb-2 text-primary opacity-50"></i>ไม่มีข้อมูลรายการตรวจ</td></tr>';
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }

    // Pagination logic
    const totalPages = Math.ceil(services.length / window.servicesItemsPerPage) || 1;
    if (window.servicesCurrentPage > totalPages) window.servicesCurrentPage = totalPages;
    if (window.servicesCurrentPage < 1) window.servicesCurrentPage = 1;

    const startIndex = (window.servicesCurrentPage - 1) * window.servicesItemsPerPage;
    const paginatedServices = services.slice(startIndex, startIndex + window.servicesItemsPerPage);

    try {
        tbody.innerHTML = paginatedServices.map((service, idx) => {
            if (!service) return '';
            const overallIndex = startIndex + idx + 1;

            let subItems = service.sub_items;
            if (typeof subItems === 'string') {
                try { subItems = JSON.parse(subItems); } catch(e) { subItems = []; }
            }
            const isPackage = Array.isArray(subItems) && subItems.length > 0;
            
            let subItemsHtml = '';
            if (isPackage) {
                subItemsHtml = `
                    <div class="mt-2 pt-1 border-top border-light">
                        <div class="text-muted extra-small fw-semibold mb-1 opacity-75" style="font-size: 0.73rem;">
                            <i class="bi bi-diagram-3 me-1"></i>รายการย่อย (${subItems.length} รายการ):
                        </div>
                        <div class="d-flex flex-wrap gap-1.5">
                `;
                subItems.forEach(item => {
                    if (!item) return;
                    const itemPrice = item.price ? ` <span class="text-primary font-monospace">(${Number(item.price).toLocaleString()})</span>` : '';
                    subItemsHtml += `<span class="badge bg-light text-secondary border px-2 py-1 fw-normal text-nowrap" style="font-size: 0.76rem;"><i class="bi bi-check2 text-success me-1"></i>${item.name || ''}${itemPrice}</span>`;
                });
                subItemsHtml += `</div></div>`;
            }
            
            const cur = service.currency === 'THB' ? 'บาท' : (service.currency || 'LAK');
            const catName = getServiceCategory(service);
            
            const badgeTypeHtml = isPackage 
                ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5 rounded-pill me-2 text-nowrap" style="font-size: 0.72rem; font-weight: 500;"><i class="bi bi-box-seam me-1"></i>แพ็กเกจ</span>`
                : `<span class="badge bg-secondary-subtle text-secondary border px-2 py-0.5 rounded-pill me-2 text-nowrap" style="font-size: 0.72rem; font-weight: 500;"><i class="bi bi-card-checklist me-1"></i>รายการเดี่ยว</span>`;

            const badgeCatHtml = `<span class="badge bg-info-subtle text-info border border-info-subtle px-2 py-0.5 rounded-pill me-2 text-nowrap" style="font-size: 0.72rem; font-weight: 500;"><i class="bi bi-folder2 me-1"></i>${catName}</span>`;

            const descHtml = service.description 
                ? `<span class="text-secondary" style="font-size: 0.82rem;">${service.description}</span>` 
                : `<span class="text-muted opacity-50 fst-italic" style="font-size: 0.8rem;">-</span>`;

            return `
            <tr>
                <td class="ps-4 align-middle text-muted fw-semibold" style="font-size: 0.85rem;">${overallIndex}</td>
                <td class="align-middle py-3">
                    <div class="d-flex align-items-center mb-1 flex-wrap gap-1">
                        ${badgeTypeHtml}
                        ${badgeCatHtml}
                        <span class="fw-bold text-dark" style="font-size: 0.9rem;">${service.name || 'ไม่ระบุชื่อ'}</span>
                    </div>
                    ${subItemsHtml}
                </td>
                <td class="align-middle text-nowrap">
                    <span class="badge px-3 py-1.5 fw-semibold" style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; border-radius: 20px; font-size: 0.82rem;">
                        <i class="bi bi-tag-fill me-1 opacity-75"></i>${Number(service.price || 0).toLocaleString()} ${cur}
                    </span>
                </td>
                <td class="align-middle"><div class="text-wrap" style="max-width: 280px;">${descHtml}</div></td>
                <td class="text-center align-middle text-nowrap">
                    <div class="d-flex gap-1 justify-content-center">
                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="openEditServiceModal('${service.id}')" title="แก้ไขรายการ"><i class="bi bi-pencil-square"></i></button>
                        <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteService('${service.id}')" title="ลบรายการ"><i class="bi bi-trash"></i></button>
                    </div>
                </td>
            </tr>
        `}).join('');
    } catch(err) {
        console.error('Error rendering services table:', err);
    }

    // Render pagination buttons
    if (paginationEl) {
        let pNextHtml = '';
        let prevDisabled = window.servicesCurrentPage === 1 ? 'disabled' : '';
        let nextDisabled = window.servicesCurrentPage === totalPages ? 'disabled' : '';

        pNextHtml += `<li class="page-item ${prevDisabled}"><a class="page-link" href="javascript:void(0);" onclick="changeServicesPage(${window.servicesCurrentPage - 1})"><i class="bi bi-chevron-left"></i></a></li>`;

        for (let i = 1; i <= totalPages; i++) {
            let active = i === window.servicesCurrentPage ? 'active' : '';
            pNextHtml += `<li class="page-item ${active}"><a class="page-link" href="javascript:void(0);" onclick="changeServicesPage(${i})">${i}</a></li>`;
        }

        pNextHtml += `<li class="page-item ${nextDisabled}"><a class="page-link" href="javascript:void(0);" onclick="changeServicesPage(${window.servicesCurrentPage + 1})"><i class="bi bi-chevron-right"></i></a></li>`;
        paginationEl.innerHTML = pNextHtml;
    }
}

function changeServicesPage(newPage) {
    window.servicesCurrentPage = newPage;
    filterServicesTable();
}
window.changeServicesPage = changeServicesPage;

function filterServicesCategory(catName, btnEl) {
    window.selectedServicesCategory = catName;
    window.servicesCurrentPage = 1;
    if (btnEl) {
        document.querySelectorAll('#servicesManagementCategoryTabs .service-mgmt-cat-tab').forEach(b => {
            b.classList.remove('btn-primary', 'active');
            b.classList.add('btn-light', 'border', 'text-secondary');
        });
        btnEl.classList.remove('btn-light', 'border', 'text-secondary');
        btnEl.classList.add('btn-primary', 'active');
    }
    filterServicesTable();
}
window.filterServicesCategory = filterServicesCategory;

function filterServicesTable() {
    const query = (document.getElementById('searchServiceInput')?.value || '').toLowerCase().trim();
    const cat = window.selectedServicesCategory || 'ALL';

    let services = window.servicesData || [];

    if (cat !== 'ALL' && cat !== 'ทั้งหมด (All)') {
        services = services.filter(s => {
            const itemCat = getServiceCategory(s);
            return isCategoryMatch(itemCat, cat);
        });
    }

    if (query) {
        services = services.filter(s => 
            (s.name || '').toLowerCase().includes(query) ||
            (getServiceCategory(s) || '').toLowerCase().includes(query) ||
            (s.description || '').toLowerCase().includes(query) ||
            (s.price || '').toString().includes(query) ||
            (s.sub_items || []).some(sub => (sub.name || '').toLowerCase().includes(query))
        );
    }
    renderServicesTable(services);
}
window.filterServicesTable = filterServicesTable;

function openAddServiceModal() {
    document.getElementById('serviceForm').reset();
    document.getElementById('serviceId').value = '';
    document.getElementById('addServiceModalTitle').innerHTML = '<i class="bi bi-plus-circle text-primary me-2"></i>เพิ่มรายการตรวจ/แพ็กเกจ';

    const catSelect = document.getElementById('serviceCategory');
    if (catSelect) catSelect.value = 'เลือดวิทยา (HEMATOLOGY)';
    
    const tbody = document.getElementById('serviceSubItemsBody');
    if (tbody) tbody.innerHTML = '';
    
    addServiceSubItemRow();
    addServiceSubItemRow();
    
    updatePackagePriceDisplay();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('addServiceModal')).show();
}

function openEditServiceModal(id) {
    const service = window.servicesData.find(s => s.id === id);
    if (!service) return;

    document.getElementById('serviceId').value = service.id;
    document.getElementById('serviceName').value = service.name;
    document.getElementById('servicePrice').value = service.price;
    document.getElementById('serviceDescription').value = service.description || '';
    
    const curSelect = document.getElementById('serviceCurrency');
    if (curSelect) curSelect.value = service.currency || 'LAK';

    const catSelect = document.getElementById('serviceCategory');
    if (catSelect) catSelect.value = service.category || getServiceCategory(service);

    let subItems = service.sub_items;
    if (typeof subItems === 'string') {
        try { subItems = JSON.parse(subItems); } catch(e) { subItems = []; }
    }

    const tbody = document.getElementById('serviceSubItemsBody');
    if (tbody) {
        tbody.innerHTML = '';
        if (subItems && Array.isArray(subItems) && subItems.length > 0) {
            subItems.forEach((item) => {
                addServiceSubItemRow(item.name, item.price);
            });
        } else {
            addServiceSubItemRow();
        }
    }

    updatePackagePriceDisplay();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('addServiceModal')).show();
}

function addServiceSubItemRow(name = '', price = '') {
    const tbody = document.getElementById('serviceSubItemsBody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="text-center row-number text-muted"></td>
        <td>
            <input type="text" class="form-control form-control-sm custom-input subitem-name" placeholder="ชื่อรายการตรวจย่อย..." value="${name.replace(/"/g, '&quot;')}" oninput="updatePackagePriceDisplay()">
        </td>
        <td>
            <input type="number" class="form-control form-control-sm custom-input subitem-price text-end" placeholder="0" value="${price}" oninput="updatePackagePriceDisplay()">
        </td>
        <td class="text-center">
            <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="this.closest('tr').remove(); updateServiceSubItemNumbers(); updatePackagePriceDisplay();">
                <i class="bi bi-x-lg"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    updateServiceSubItemNumbers();
    updatePackagePriceDisplay();
}

function updateServiceSubItemNumbers() {
    const rows = document.querySelectorAll('#serviceSubItemsBody tr');
    rows.forEach((row, index) => {
        const numCell = row.querySelector('.row-number');
        if (numCell) numCell.textContent = index + 1;
    });
}

function updatePackagePriceDisplay() {
    const priceInput = document.getElementById('servicePrice');
    const display = document.getElementById('packageTotalPriceDisplay');
    const curSelect = document.getElementById('serviceCurrency');
    const cur = curSelect ? (curSelect.value === 'THB' ? 'บาท' : 'LAK') : 'LAK';

    let subItemsTotal = 0;
    let hasSubItemPrices = false;
    document.querySelectorAll('#serviceSubItemsBody .subitem-price').forEach(input => {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val > 0) {
            subItemsTotal += val;
            hasSubItemPrices = true;
        }
    });

    if (display) {
        if (hasSubItemPrices) {
            display.innerHTML = `
                <span>${subItemsTotal.toLocaleString()} ${cur}</span>
                <button type="button" class="btn btn-sm btn-outline-primary ms-2 py-0 px-2 rounded-pill" style="font-size: 0.75rem;" onclick="applySubItemsTotalToPrice(${subItemsTotal})" title="ใช้ราคารวมย่อยนี้เป็นราคาแพ็กเกจหลัก">
                    <i class="bi bi-arrow-up-circle me-1"></i>ใช้ราคานี้เป็นราคาหลัก
                </button>
            `;
        } else {
            const val = parseFloat(priceInput?.value) || 0;
            display.textContent = val.toLocaleString() + ' ' + cur;
        }
    }
}

function applySubItemsTotalToPrice(total) {
    const priceInput = document.getElementById('servicePrice');
    if (priceInput) {
        priceInput.value = total;
        updatePackagePriceDisplay();
    }
}
window.applySubItemsTotalToPrice = applySubItemsTotalToPrice;

window.openAddServiceModal = openAddServiceModal;
window.openEditServiceModal = openEditServiceModal;
window.addServiceSubItemRow = addServiceSubItemRow;
window.updatePackagePriceDisplay = updatePackagePriceDisplay;

async function saveService() {
    try {
        const id = document.getElementById('serviceId')?.value || '';
        const nameInput = document.getElementById('serviceName');
        const name = nameInput ? nameInput.value.trim() : '';
        const price = document.getElementById('servicePrice')?.value || '0';
        const desc = document.getElementById('serviceDescription')?.value.trim() || '';
        const currency = document.getElementById('serviceCurrency')?.value || 'LAK';
        const category = document.getElementById('serviceCategory')?.value || 'เลือดวิทยา (HEMATOLOGY)';

        if (!name) {
            Swal.fire('กรุณากรอกข้อมูล', 'กรุณาระบุชื่อแพ็กเกจ/รายการตรวจ', 'warning');
            return;
        }

        const subItems = [];
        document.querySelectorAll('#serviceSubItemsBody tr').forEach(row => {
            const iNameInput = row.querySelector('.subitem-name');
            const iPriceInput = row.querySelector('.subitem-price');
            const iName = iNameInput ? iNameInput.value.trim() : '';
            const iPrice = iPriceInput ? iPriceInput.value.trim() : '';
            if (iName) {
                subItems.push({ name: iName, price: iPrice });
            }
        });

        const targetId = id || generateId('SRV');
        const nowIso = new Date().toISOString();

        const serviceObj = {
            id: targetId,
            name: name,
            price: parseFloat(price) || 0,
            currency: currency,
            category: category,
            description: desc,
            sub_items: subItems,
            updated_at: nowIso,
            created_at: nowIso
        };

        // 1. Memory & LocalStorage immediate update
        window.servicesData = window.servicesData || [];
        const index = window.servicesData.findIndex(s => s.id === targetId);
        if (index !== -1) {
            window.servicesData[index] = { ...window.servicesData[index], ...serviceObj };
        } else {
            window.servicesData.unshift(serviceObj);
        }

        saveServicesLocalData();
        renderServicesTable();

        // 2. Hide modal
        const modalEl = document.getElementById('addServiceModal');
        if (modalEl) {
            try {
                const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
                if (bsModal) bsModal.hide();
            } catch (err) {
                if (window.jQuery && $(modalEl).modal) $(modalEl).modal('hide');
            }
        }

        // 3. SweetAlert success
        Swal.fire({
            icon: 'success',
            title: 'บันทึกสำเร็จ',
            text: 'บันทึกข้อมูลรายการตรวจเรียบร้อยแล้ว',
            confirmButtonColor: '#6366f1'
        });

        // 4. Async Supabase persistence directly into services table
        (async () => {
            try {
                const dbPayload = {
                    id: targetId,
                    name: name,
                    price: parseFloat(price) || 0,
                    currency: currency,
                    description: desc,
                    sub_items: subItems,
                    created_at: nowIso
                };

                if (id) {
                    let { error } = await _supabase.from('services').update(dbPayload).eq('id', id);
                    if (error) console.error('Supabase update service error:', error);
                } else {
                    let { error } = await _supabase.from('services').insert([dbPayload]);
                    if (error) console.error('Supabase insert service error:', error);
                }
            } catch (e) {
                console.warn('Database save warning, retained locally:', e);
            }
        })();

    } catch (err) {
        console.error('Error in saveService:', err);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้: ' + err.message, 'error');
    }
}
window.saveService = saveService;

async function deleteService(id) {
    const result = await Swal.fire({
        title: 'ยืนยันการลบ?',
        text: "คุณต้องการลบรายการตรวจนี้ใช่หรือไม่?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6e7d88',
        confirmButtonText: 'ลบข้อมูล',
        cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
        window.servicesData = (window.servicesData || []).filter(s => s.id !== id);
        saveServicesLocalData();
        renderServicesTable();

        Swal.fire('ลบแล้ว!', 'ข้อมูลถูกลบเรียบร้อย', 'success');

        (async () => {
            try {
                await _supabase.from('services').delete().eq('id', id);
            } catch (e) {
                console.warn('Delete service Supabase warning:', e);
            }
        })();
    }
}
window.deleteService = deleteService;

function exportServicesToExcel() {
    let csv = "\uFEFF";
    csv += "ลำดับ,รหัส,ชื่อรายการตรวจ/แพ็กเกจ,หมวดหมู่,ราคา,หน่วย,คำอธิบาย\n";
    const services = window.servicesData || [];
    services.forEach((s, idx) => {
        const cat = getServiceCategory(s);
        const name = (s.name || '').replace(/,/g, ' ');
        const desc = (s.description || '').replace(/,/g, ' ');
        csv += `${idx + 1},${s.id},${name},${cat},${s.price || 0},${s.currency || 'LAK'},${desc}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `services_list_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
}
window.exportServicesToExcel = exportServicesToExcel;

async function saveReferrer() {
    const editId = document.getElementById('referrerEditId').value;
    const customCode = (document.getElementById('refCode')?.value || '').trim();
    const name = document.getElementById('refFullName').value.trim();
    const phone = document.getElementById('refPhone').value.trim();
    const bankName = document.getElementById('refBankName').value;
    const bankAccount = document.getElementById('refBankAccount').value.trim();
    const notes = document.getElementById('refNotes').value.trim();

    if (!name || !phone) {
        Swal.fire('กรุณากรอกข้อมูล', 'กรุณากรอกชื่อ-นามสกุล และเบอร์โทรศัพท์ผู้แนะนำ', 'warning');
        return;
    }

    if (editId) {
        const item = window.referrersData.find(r => r.id === editId);
        if (item) {
            item.code = customCode || item.code;
            item.name = name;
            item.phone = phone;
            item.bank_name = bankName;
            item.bank_account = bankAccount;
            item.notes = notes;
        }
    } else {
        const newCode = customCode || ('REF-' + (100 + window.referrersData.length + 1));
        const newItem = {
            id: generateId('REF'),
            code: newCode,
            name: name,
            phone: phone,
            bank_name: bankName,
            bank_account: bankAccount,
            notes: notes,
            created_at: new Date().toISOString()
        };
        window.referrersData.push(newItem);

        try {
            await _supabase.from('referrers').insert([newItem]);
        } catch (e) {
            console.log('Supabase referrers insert fallback');
        }
    }

    saveReferralLocalData();
    const modalEl = document.getElementById('addReferrerModal');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    
    document.getElementById('referrerForm').reset();
    document.getElementById('referrerEditId').value = '';
    if (document.getElementById('refCode')) document.getElementById('refCode').value = '';

    Swal.fire('สำเร็จ', 'บันทึกข้อมูลสมาชิกผู้แนะนำเรียบร้อยแล้ว', 'success');
    loadReferralData();
}

function editReferrer(id) {
    const item = window.referrersData.find(r => r.id === id);
    if (!item) return;

    document.getElementById('referrerEditId').value = item.id;
    if (document.getElementById('refCode')) document.getElementById('refCode').value = item.code || item.id;
    document.getElementById('refFullName').value = item.name;
    document.getElementById('refPhone').value = item.phone;
    document.getElementById('refBankName').value = item.bank_name || 'กสิกรไทย (KBANK)';
    document.getElementById('refBankAccount').value = item.bank_account || '';
    document.getElementById('refNotes').value = item.notes || '';
    
    const titleEl = document.getElementById('addReferrerModalTitle');
    if (titleEl) titleEl.innerHTML = '<i class="ph ph-pencil-simple text-primary me-2"></i>แก้ไขข้อมูลผู้แนะนำ';

    bootstrap.Modal.getOrCreateInstance(document.getElementById('addReferrerModal')).show();
}

async function deleteReferrer(id) {
    const item = window.referrersData.find(r => r.id === id);
    if (!item) return;

    const res = await Swal.fire({
        title: 'ยืนยันการลบ?',
        text: `ต้องการลบคุณ ${item.name} ออกจากระบบผู้แนะนำใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ลบข้อมูล',
        cancelButtonText: 'ยกเลิก'
    });

    if (res.isConfirmed) {
        window.referrersData = window.referrersData.filter(r => r.id !== id);
        saveReferralLocalData();
        loadReferralData();
        Swal.fire('ลบข้อมูลแล้ว', 'ลบสมาชิกผู้แนะนำเรียบร้อย', 'success');
    }
}

function toggleTargetGoalDisplay() {
    const sw = document.getElementById('targetEnableSwitch');
    const container = document.getElementById('targetGoalConfigContainer');
    if (sw && container) {
        container.style.display = sw.checked ? 'block' : 'none';
    }
    
    const goalInput = document.getElementById('targetGoalCount');
    const helpDisplay = document.getElementById('targetHelpGoalDisplay');
    if (goalInput && helpDisplay) {
        helpDisplay.innerText = goalInput.value || '20';
    }
}

function toggleCommTypeDisplay() {
    const pctRadio = document.getElementById('commTypePercent');
    const currSelect = document.getElementById('commCurrencySelect');
    if (currSelect) {
        window.commissionSettings.currency = currSelect.value;
    }

    if (!pctRadio) return;
    const isPercent = pctRadio.checked;
    const label = document.getElementById('commRateLabel');
    const addon = document.getElementById('commUnitAddon');

    const unitName = getCurrencyUnitName();

    if (isPercent) {
        if (label) label.innerText = 'อัตราเงินปันผล (%) จากยอดค่ารักษา (ปกติ)';
        if (addon) addon.innerText = '%';
    } else {
        if (label) label.innerText = `จำนวนเงินปันผลต่อผู้ป่วย 1 คน (${unitName}) (ปกติ)`;
        if (addon) addon.innerText = unitName;
    }

    const targetBonusLabel = document.getElementById('targetBonusLabel');
    const targetBonusAddon = document.getElementById('targetBonusAddon');
    if (targetBonusLabel) {
        targetBonusLabel.innerText = isPercent ? 'อัตราโบนัสพิเศษเมื่อถึงเป้าหมาย (%)' : `จำนวนเงินโบนัสพิเศษต่อคน (${unitName})`;
    }
    if (targetBonusAddon) {
        targetBonusAddon.innerText = isPercent ? '%' : unitName;
    }

    toggleTargetGoalDisplay();
}

function saveCommissionSettings() {
    const pctRadio = document.getElementById('commTypePercent');
    const valInput = document.getElementById('commValueInput');
    const currSelect = document.getElementById('commCurrencySelect');
    const autoSw = document.getElementById('autoTriggerComm');

    const targetSw = document.getElementById('targetEnableSwitch');
    const targetGoalInput = document.getElementById('targetGoalCount');
    const targetBonusInput = document.getElementById('targetBonusValue');

    const isPercent = pctRadio ? pctRadio.checked : false;
    const val = parseFloat((valInput ? valInput.value : 200) || 0);
    const curr = currSelect ? currSelect.value : 'THB';
    const auto = autoSw ? autoSw.checked : true;

    const targetEnabled = targetSw ? targetSw.checked : false;
    const targetGoal = parseInt((targetGoalInput ? targetGoalInput.value : 20) || 20);
    const targetBonus = parseFloat((targetBonusInput ? targetBonusInput.value : 10) || 10);

    window.commissionSettings = {
        type: isPercent ? 'percentage' : 'fixed',
        value: val,
        currency: curr,
        auto_trigger: auto,
        target_enabled: targetEnabled,
        target_goal: targetGoal,
        target_bonus_value: targetBonus
    };

    saveReferralLocalData();
    Swal.fire('สำเร็จ', 'บันทึกการตั้งค่าเงื่อนไขปันผลแบบภาพรวมเรียบร้อยแล้ว', 'success');
    loadReferralData();
}

function renderItemCommissionSettingsTable() {
    const tbody = document.getElementById('itemDividendBody');
    if (!tbody) return;

    const services = window.allServicesData || window.servicesData || [];
    const itemSettings = JSON.parse(localStorage.getItem('hr_item_commission_settings') || '{}');
    const addedIds = Object.keys(itemSettings);

    // กรองเฉพาะรายการที่ถูก Add เข้ามาแล้วเท่านั้น
    const addedServices = services.filter(s => addedIds.includes(String(s.id)));

    if (addedServices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-5">
                    <i class="ph ph-plus-circle fs-2 d-block mb-2 text-primary opacity-50"></i>
                    ยังไม่มีรายการปันผลพิเศษ<br>
                    <small class="text-muted">กดปุ่ม "+ เพิ่มรายการปันผล" ด้านบน เพื่อเลือกรายการตรวจที่ต้องการคิดปันผลเพิ่ม</small>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = addedServices.map((s, index) => {
        const cur = s.currency === 'THB' ? 'บาท' : (s.currency || 'LAK');
        const itemVal = itemSettings[s.id] !== undefined ? itemSettings[s.id] : '';
        const catName = s.category || 'รายการตรวจ';
        
        return `
            <tr>
                <td class="text-center text-muted small fw-semibold">${index + 1}</td>
                <td>
                    <div class="fw-bold text-dark" style="font-size: 0.88rem;">${s.name}</div>
                    <div class="text-muted extra-small" style="font-size: 0.72rem;"><i class="bi bi-folder2 me-1"></i>${catName}</div>
                </td>
                <td class="text-end font-monospace text-nowrap" style="font-size: 0.84rem;">
                    <span class="badge bg-light text-success border px-2 py-1 fw-semibold">${Number(s.price || 0).toLocaleString()} ${cur}</span>
                </td>
                <td class="text-center">
                    <div class="input-group input-group-sm ms-auto" style="max-width: 130px;">
                        <input type="number" step="0.01" min="0" class="form-control custom-input text-end item-comm-input fw-bold text-primary" 
                               data-id="${s.id}" placeholder="0" value="${itemVal}">
                        <span class="input-group-text px-1.5" style="font-size: 0.75rem;">${cur}</span>
                    </div>
                </td>
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-outline-danger border-0 p-1" onclick="removeItemCommissionSetting('${s.id}')" title="ลบออกจากรายการปันผล">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}
window.renderItemCommissionSettingsTable = renderItemCommissionSettingsTable;

async function openAddItemDividendModal() {
    // ดึงข้อมูลรายการตรวจจาก Supabase (allServicesData) เสมอเพื่อให้ข้อมูลสดและครบถ้วน
    if (!window.allServicesData || window.allServicesData.length === 0) {
        if (typeof loadServicesData === 'function') {
            await loadServicesData();
        }
    }
    const services = window.allServicesData || window.servicesData || [];
    if (services.length === 0) {
        Swal.fire('แจ้งเตือน', 'ยังไม่มีรายการตรวจ/บริการในระบบ กรุณาเพิ่มรายการตรวจในเมนู "ตั้งค่ารายการตรวจ" ก่อนครับ', 'warning');
        return;
    }

    const itemSettings = JSON.parse(localStorage.getItem('hr_item_commission_settings') || '{}');
    const addedIds = Object.keys(itemSettings);
    const available = services.filter(s => !addedIds.includes(String(s.id)));

    if (available.length === 0) {
        Swal.fire('แจ้งเตือน', 'คุณได้เพิ่มรายการตรวจที่มีในระบบเข้ามาในตารางปันผลครบทั้งหมดแล้วครับ', 'info');
        return;
    }

    const optionsHtml = available.map(s => {
        const cur = s.currency === 'THB' ? 'บาท' : (s.currency || 'LAK');
        return `<option value="${s.id}">${s.name} (ราคา: ${Number(s.price || 0).toLocaleString()} ${cur})</option>`;
    }).join('');

    const { value: formValues } = await Swal.fire({
        title: '<h5 class="fw-bold mb-0 text-primary"><i class="bi bi-plus-circle me-2"></i>เพิ่มรายการปันผลพิเศษ</h5>',
        html: `
            <div class="text-start p-2">
                <div class="mb-3">
                    <label class="form-label fw-bold small text-secondary">เลือกรายการตรวจ / บริการ</label>
                    <select id="swalSelectService" class="form-select custom-input py-2">
                        ${optionsHtml}
                    </select>
                </div>
                <div class="mb-2">
                    <label class="form-label fw-bold small text-secondary">จำนวนเงินปันผล (LAK / THB)</label>
                    <input type="number" id="swalItemCommVal" class="form-control custom-input py-2 fw-bold text-primary" placeholder="กรอกยอดเงินปันผล เช่น 100000" min="0">
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-plus-lg me-1"></i> เพิ่มรายการ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#003f88',
        preConfirm: () => {
            const sId = document.getElementById('swalSelectService').value;
            const val = parseFloat(document.getElementById('swalItemCommVal').value);
            if (isNaN(val) || val < 0) {
                Swal.showValidationMessage('กรุณากรอกยอดเงินปันผลที่ถูกต้อง (ตัวเลขมากกว่าหรือเท่ากับ 0)');
                return false;
            }
            return { sId, val };
        }
    });

    if (formValues) {
        itemSettings[formValues.sId] = formValues.val;
        localStorage.setItem('hr_item_commission_settings', JSON.stringify(itemSettings));
        localStorage.setItem('hr_item_commission_enabled', 'true');
        const itemSw = document.getElementById('itemModeSwitch');
        if (itemSw) itemSw.checked = true;

        renderItemCommissionSettingsTable();
        Swal.fire('สำเร็จ', 'เพิ่มรายการปันผลเรียบร้อยแล้ว', 'success');
    }
}
window.openAddItemDividendModal = openAddItemDividendModal;

function removeItemCommissionSetting(serviceId) {
    const itemSettings = JSON.parse(localStorage.getItem('hr_item_commission_settings') || '{}');
    if (itemSettings[serviceId] !== undefined) {
        delete itemSettings[serviceId];
        localStorage.setItem('hr_item_commission_settings', JSON.stringify(itemSettings));
        renderItemCommissionSettingsTable();
    }
}
window.removeItemCommissionSetting = removeItemCommissionSetting;

function toggleItemModeDisplay() {
    const itemSwitch = document.getElementById('itemModeSwitch');
    const enabled = itemSwitch ? itemSwitch.checked : false;
    localStorage.setItem('hr_item_commission_enabled', enabled ? 'true' : 'false');
}
window.toggleItemModeDisplay = toggleItemModeDisplay;

function saveItemCommissionSettings() {
    const inputs = document.querySelectorAll('.item-comm-input');
    const settings = {};
    inputs.forEach(input => {
        const id = input.getAttribute('data-id');
        const val = parseFloat(input.value);
        if (id && !isNaN(val)) {
            settings[id] = val;
        }
    });

    const itemSwitch = document.getElementById('itemModeSwitch');
    const itemEnabled = itemSwitch ? itemSwitch.checked : false;

    localStorage.setItem('hr_item_commission_settings', JSON.stringify(settings));
    localStorage.setItem('hr_item_commission_enabled', itemEnabled ? 'true' : 'false');

    Swal.fire({
        icon: 'success',
        title: 'บันทึกสำเร็จ',
        text: 'บันทึกการตั้งค่ารูปแบบการจ่ายปันผลแบบรายรายการเรียบร้อยแล้ว',
        confirmButtonColor: '#003f88'
    });
}
window.saveItemCommissionSettings = saveItemCommissionSettings;

async function processPaymentCommission(visitId) {
    if (!window.commissionSettings || !window.commissionSettings.auto_trigger) return;

    // ตรวจสอบว่าเคยสร้าง Log สำหรับ visitId นี้แล้วหรือยัง เพื่อป้องกันการคำนวณซ้ำ
    const existingLog = (window.commissionLogs || []).find(l => l.visit_id === visitId);
    if (existingLog) return;

    let visit = null;
    try {
        const { data } = await _supabase.from('visits').select('*').eq('visit_id', visitId).single();
        visit = data;
    } catch (e) { console.log('visit fetch error', e); }

    if (!visit && window.allPaymentQueue) {
        visit = window.allPaymentQueue.find(v => v.visit_id === visitId || v.id === visitId);
    }

    if (!visit) {
        // สร้าง fallback visit object หากมีในข้อมูล LocalStorage Queue
        const cachedVisits = JSON.parse(localStorage.getItem('clinic_visits_queue') || '[]');
        visit = cachedVisits.find(v => (v.visit_id === visitId || v.id === visitId));
    }

    if (!visit) return;

    let referrerId = visit.referred_by || null;
    let patientName = visit.patient_name || 'ผู้ป่วย';

    // 1. ค้นหาจาก LocalStorage Maps โดยตรง (แม่นยำและล่าสุดที่สุด)
    const patMap = JSON.parse(localStorage.getItem('clinic_patient_referrers') || '{}');
    if (!referrerId && visit.hn && patMap[visit.hn]) {
        referrerId = patMap[visit.hn];
    }

    const apptMap = JSON.parse(localStorage.getItem('clinic_appointment_referrers') || '{}');
    if (!referrerId && visit.appointment_id && apptMap[visit.appointment_id]) {
        referrerId = apptMap[visit.appointment_id];
    }

    // 2. ค้นหาในประวัติผู้ป่วย (patients) สำรอง
    if (!referrerId && (visit.hn || visit.patient_name)) {
        const pat = (window.allPatients || []).find(p => 
            (visit.hn && (p.hn === visit.hn || p.HN === visit.hn || p.id === visit.hn)) ||
            (visit.patient_name && (p.patient_name === visit.patient_name || p.FullName === visit.patient_name))
        );
        if (pat && pat.referred_by) referrerId = pat.referred_by;
    }

    // 3. ค้นหาในประวัติตารางนัดหมาย (appointments) สำรอง
    if (!referrerId && (visit.patient_name || visit.appointment_id)) {
        const appt = (window.allAppointments || []).find(a => 
            (visit.appointment_id && a.appointment_id === visit.appointment_id) ||
            (visit.patient_name && a.guest_name === visit.patient_name)
        );
        if (appt && appt.referred_by) referrerId = appt.referred_by;
    }

    if (!referrerId) {
        console.warn('No referrer found for visit', visitId);
        return;
    }

    let referrer = (window.referrersData || []).find(r => r.id === referrerId || r.code === referrerId || r.name === referrerId);
    let refName = referrer ? referrer.name : referrerId;

    // หากไม่พบใน referrersData ให้ค้นหาจากรายชื่อพนักงาน (allEmployeesData / allStaffUsers)
    if (!referrer) {
        const emp = (window.allEmployeesData || []).find(e => e.emp_code === referrerId || e.full_name === referrerId) ||
                    (window.allStaffUsers || []).find(s => s.emp_code === referrerId || s.full_name === referrerId);
        if (emp) {
            refName = `${emp.emp_code || ''} - ${emp.full_name || ''}`.replace(/^ - /, '');
        }
    }

    let totalInvoice = 0;
    if (visit.payable_amount !== undefined && parseFloat(visit.payable_amount) > 0) {
        totalInvoice = parseFloat(visit.payable_amount);
    } else if (visit.total_price !== undefined && parseFloat(visit.total_price) > 0) {
        totalInvoice = parseFloat(visit.total_price);
    } else if (visit.price !== undefined && parseFloat(visit.price) > 0) {
        totalInvoice = parseFloat(visit.price);
    } else if (visit.total_amount !== undefined && parseFloat(visit.total_amount) > 0) {
        totalInvoice = parseFloat(visit.total_amount);
    }

    if (totalInvoice <= 0 || totalInvoice === 1500) {
        let calcSum = 0;
        if (visit.lab_tests && typeof visit.lab_tests === 'string') {
            const testNames = visit.lab_tests.split(',').map(s => s.trim()).filter(Boolean);
            testNames.forEach(t => {
                if (typeof getTestItemDetails === 'function') {
                    calcSum += getTestItemDetails(t).price;
                } else {
                    const foundSvc = (window.servicesData || []).find(s => s.name === t);
                    if (foundSvc) calcSum += parseFloat(foundSvc.price || 0);
                }
            });
        }
        if (calcSum > 0) {
            const disc = parseFloat(visit.discount || visit.lab_discount || 0);
            totalInvoice = Math.max(0, calcSum - disc);
        }
    }

    if (totalInvoice <= 0) totalInvoice = 1525000;
    let commAmount = 0;
    let isBonusApplied = false;

    // 1. คำนวณปันผลแบบภาพรวม (Overall Dividend)
    let overallComm = 0;
    const overallSwitch = document.getElementById('overallModeSwitch');
    const isOverallActive = overallSwitch ? overallSwitch.checked : (localStorage.getItem('hr_overall_commission_enabled') !== 'false');

    if (isOverallActive) {
        const monthlyCount = getMonthlyReferredCount(referrerId, refName);
        const targetEnabled = window.commissionSettings.target_enabled === true;
        const targetGoal = window.commissionSettings.target_goal || 20;

        if (targetEnabled && (monthlyCount + 1) >= targetGoal) {
            isBonusApplied = true;
            const bonusValue = parseFloat(window.commissionSettings.target_bonus_value || 10);
            if (window.commissionSettings.type === 'percentage') {
                overallComm = totalInvoice * (bonusValue / 100);
            } else {
                overallComm = bonusValue;
            }
        } else {
            const standardValue = parseFloat(window.commissionSettings.value || 200000);
            if (window.commissionSettings.type === 'percentage') {
                overallComm = totalInvoice * (standardValue / 100);
            } else {
                overallComm = standardValue;
            }
        }
    }

    // 2. คำนวณปันผลแบบรายรายการบวกเพิ่ม (Item-based Dividend Add-on)
    let itemCommSum = 0;
    let itemDetailsArr = [];
    const itemSwitch = document.getElementById('itemModeSwitch');
    const itemModeEnabled = itemSwitch ? itemSwitch.checked : (localStorage.getItem('hr_item_commission_enabled') === 'true');

    if (itemModeEnabled) {
        const itemSettings = JSON.parse(localStorage.getItem('hr_item_commission_settings') || '{}');
        let itemList = [];

        if (Array.isArray(visit.items)) itemList = itemList.concat(visit.items);
        if (Array.isArray(visit.services)) itemList = itemList.concat(visit.services);
        if (Array.isArray(visit.lab_orders)) itemList = itemList.concat(visit.lab_orders);

        if (visit.lab_tests && typeof visit.lab_tests === 'string') {
            const labArr = visit.lab_tests.split(',').map(s => s.trim()).filter(Boolean);
            labArr.forEach(labName => {
                itemList.push({ name: labName, id: labName });
            });
        }

        itemList.forEach(item => {
            const itemId = String(item.id || item.service_id || item.item_id || item.name || '');
            const itemName = item.name || item.title || itemId;
            const qty = parseFloat(item.qty || item.quantity || 1);

            let matchedVal = null;
            if (itemSettings[itemId] !== undefined) {
                matchedVal = parseFloat(itemSettings[itemId]);
            } else {
                const foundSvc = (window.servicesData || []).find(s => String(s.name).trim().toLowerCase() === String(itemName).trim().toLowerCase());
                if (foundSvc && itemSettings[foundSvc.id] !== undefined) {
                    matchedVal = parseFloat(itemSettings[foundSvc.id]);
                }
            }

            if (matchedVal !== null && !isNaN(matchedVal) && matchedVal > 0) {
                const addVal = matchedVal * qty;
                itemCommSum += addVal;
                itemDetailsArr.push(`${itemName}: ${formatCommissionAmount(addVal)}`);
            }
        });
    }

    // ยอดรวมปันผลสุทธิ = ภาพรวม + รายรายการบวกเพิ่ม
    commAmount = overallComm + itemCommSum;

    const newLog = {
        id: generateId('COM'),
        referrer_id: referrerId,
        referrer_name: refName,
        patient_name: patientName,
        visit_id: visitId,
        total_invoice: totalInvoice,
        base_amount: overallComm,
        item_amount: itemCommSum,
        item_details: itemDetailsArr.join(', '),
        amount: commAmount,
        status: 'pending',
        is_bonus: isBonusApplied,
        created_at: new Date().toISOString()
    };

    window.commissionLogs.unshift(newLog);
    saveReferralLocalData();
    updateReferralSummaryCards();
    if (typeof renderReferrersTable === 'function') renderReferrersTable();
    if (typeof renderCommissionLogsTable === 'function') renderCommissionLogsTable();

    try {
        let { error: comErr } = await _supabase.from('commission_logs').insert([newLog]);
        if (comErr) {
            // ถ้า column ไม่ตรง ให้ลอง insert เฉพาะ core columns
            const coreLog = {
                id: newLog.id,
                referrer_id: newLog.referrer_id,
                referrer_name: newLog.referrer_name,
                patient_name: newLog.patient_name,
                visit_id: newLog.visit_id,
                amount: newLog.amount,
                status: newLog.status,
                created_at: newLog.created_at
            };
            if (!comErr.message?.includes('total_invoice')) coreLog.total_invoice = newLog.total_invoice;
            if (!comErr.message?.includes('base_amount')) coreLog.base_amount = newLog.base_amount;
            if (!comErr.message?.includes('item_amount')) coreLog.item_amount = newLog.item_amount;
            if (!comErr.message?.includes('item_details')) coreLog.item_details = newLog.item_details;
            if (!comErr.message?.includes('is_bonus')) coreLog.is_bonus = newLog.is_bonus;
            const { error: comErr2 } = await _supabase.from('commission_logs').insert([coreLog]);
            if (comErr2) console.warn('Commission log insert fallback failed:', comErr2.message);
        }
    } catch (e) {
        console.log('Commission log Supabase insert fallback');
    }
}

async function syncAllVisitsCommissionLogs() {
    window.commissionLogs = window.commissionLogs || [];
    let visits = [];

    try {
        if (typeof _supabase !== 'undefined') {
            const { data } = await _supabase.from('visits').select('*');
            if (data && data.length > 0) visits = data;
        }
    } catch(e) {}

    try {
        const localVisits = JSON.parse(localStorage.getItem('clinic_visits_queue') || '[]');
        if (Array.isArray(localVisits)) {
            const map = new Map();
            visits.forEach(v => { if (v && (v.visit_id || v.id)) map.set(v.visit_id || v.id, v); });
            localVisits.forEach(v => {
                if (v && (v.visit_id || v.id)) {
                    const k = v.visit_id || v.id;
                    map.set(k, { ...(map.get(k) || {}), ...v, visit_id: k });
                }
            });
            visits = Array.from(map.values());
        }
    } catch(e) {}

    let patients = window.allPatients || [];
    try {
        if (typeof _supabase !== 'undefined' && patients.length === 0) {
            const { data } = await _supabase.from('patients').select('*');
            if (data && data.length > 0) patients = data;
        }
    } catch(e) {}

    const patReferrersMap = JSON.parse(localStorage.getItem('clinic_patient_referrers') || '{}');
    const apptReferrersMap = JSON.parse(localStorage.getItem('clinic_appointment_referrers') || '{}');

    const hnReferrerMap = {};
    const nameReferrerMap = {};
    patients.forEach(p => {
        const rBy = p.referred_by || patReferrersMap[p.hn] || patReferrersMap[p.id];
        if (rBy) {
            if (p.hn) hnReferrerMap[p.hn] = rBy;
            if (p.patient_name || p.FullName) nameReferrerMap[p.patient_name || p.FullName] = rBy;
        }
    });

    Object.keys(patReferrersMap).forEach(hnKey => {
        if (patReferrersMap[hnKey]) hnReferrerMap[hnKey] = patReferrersMap[hnKey];
    });

    const existingVisitIds = new Set(window.commissionLogs.map(l => l.visit_id).filter(Boolean));
    const existingPatientNames = new Set(window.commissionLogs.map(l => l.patient_name).filter(Boolean));

    let addedCount = 0;
    for (const v of visits) {
        const vId = v.visit_id || v.id;
        const pName = v.patient_name || 'ผู้ป่วย';
        const pHn = v.hn;

        if (vId && existingVisitIds.has(vId)) continue;
        if (existingPatientNames.has(pName)) continue;

        let refBy = v.referred_by || (pHn ? hnReferrerMap[pHn] : null) || nameReferrerMap[pName] || (v.appointment_id ? apptReferrersMap[v.appointment_id] : null);

        if (refBy) {
            await processPaymentCommission(vId || ('VIS-' + Math.floor(1000 + Math.random() * 9000)));
            addedCount++;
        }
    }

    // Secondary pass: Check patients list for patients with referrers who may not have visit records
    for (const p of patients) {
        const pName = p.patient_name || p.FullName;
        const pHn = p.hn;
        const rBy = p.referred_by || (pHn ? patReferrersMap[pHn] : null) || (pName ? nameReferrerMap[pName] : null);

        if (rBy && pName && !existingPatientNames.has(pName)) {
            const tempVisitId = 'VIS-PAT-' + (pHn || Math.floor(1000 + Math.random() * 9000));
            const dummyVisit = {
                visit_id: tempVisitId,
                hn: pHn,
                patient_name: pName,
                referred_by: rBy,
                total_price: 1500,
                status: 'เสร็จสิ้น'
            };
            window.allPaymentQueue = window.allPaymentQueue || [];
            window.allPaymentQueue.push(dummyVisit);
            await processPaymentCommission(tempVisitId);
            addedCount++;
        }
    }

    if (addedCount > 0) {
        saveReferralLocalData();
    }
}
window.syncAllVisitsCommissionLogs = syncAllVisitsCommissionLogs;

function openPayoutModal(logId) {
    const log = window.commissionLogs.find(l => l.id === logId);
    if (!log) return;

    const ref = window.referrersData.find(r => r.id === log.referrer_id || r.name === log.referrer_name);

    document.getElementById('payoutLogId').value = log.id;
    document.getElementById('payoutRefName').innerText = log.referrer_name;
    document.getElementById('payoutRefBank').innerText = ref ? `${ref.bank_name} (${ref.bank_account})` : '-';
    document.getElementById('payoutPatientName').innerText = log.patient_name;
    document.getElementById('payoutAmountDisplay').innerText = formatCommissionAmount(log.amount);
    document.getElementById('payoutRefCode').value = '';

    const breakdownEl = document.getElementById('payoutBreakdownDisplay');
    if (breakdownEl) {
        let baseVal = log.base_amount !== undefined ? parseFloat(log.base_amount) : (log.item_amount ? (parseFloat(log.amount) - parseFloat(log.item_amount)) : parseFloat(log.amount));
        let itemVal = parseFloat(log.item_amount || 0);

        if (itemVal > 0 && baseVal > 0) {
            breakdownEl.innerHTML = `<span class="badge bg-light text-dark border me-1" style="font-size:0.75rem;">ภาพรวม: ${formatCommissionAmount(baseVal)}</span> <span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="font-size:0.75rem;">รายการพิเศษ: +${formatCommissionAmount(itemVal)}</span>`;
        } else if (itemVal > 0) {
            breakdownEl.innerHTML = `<span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="font-size:0.75rem;">รายการพิเศษ: ${formatCommissionAmount(itemVal)}</span>`;
        } else {
            breakdownEl.innerHTML = `<span class="badge bg-light text-dark border" style="font-size:0.75rem;">ปันผลภาพรวม: ${formatCommissionAmount(baseVal)}</span>`;
        }
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('payCommissionModal')).show();
}

async function executePayout() {
    const logId = document.getElementById('payoutLogId').value;
    const method = document.getElementById('payoutMethod').value;
    const refCode = document.getElementById('payoutRefCode').value.trim();

    const log = window.commissionLogs.find(l => l.id === logId);
    if (log) {
        log.status = 'paid';
        log.paid_at = new Date().toISOString();
        log.payout_method = method;
        log.payout_ref = refCode || 'อนุมัติจ่ายแล้ว';

        try {
            if (typeof _supabase !== 'undefined') {
                await _supabase.from('commission_logs').update({
                    status: 'paid',
                    paid_at: log.paid_at,
                    payout_method: method,
                    payout_ref: log.payout_ref
                }).eq('id', logId);
            }
        } catch (e) {}
    }

    saveReferralLocalData();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('payCommissionModal')).hide();
    Swal.fire('ชำระเงินสำเร็จ', 'บันทึกการจ่ายเงินปันผลเรียบร้อยแล้ว', 'success');
    loadReferralData();
}

// Real-time listener for MLM system updates from Team.html / other tabs
window.addEventListener('storage', (event) => {
    if (event.key === 'stk_app_cache_data' || event.key === 'stk_members' || event.key === 'clinic_referrers' || event.key === 'hr_employees') {
        console.log('MLM Member profiles updated, auto-syncing Clinic referral data...');
        if (typeof loadReferralData === 'function') {
            loadReferralData(false);
        }
    }
});

// ============================================================
// 15. รายงานสรุปค่าตรวจรักษาและค่าบริการประจำวัน (Daily Consultation & Service Fee Report)
// ============================================================
window.dailyReportPeriodMode = 'month';

function setDailyReportPeriod(mode) {
    window.dailyReportPeriodMode = mode;
    const btnDay = document.getElementById('btnDailyDay');
    const btnMonth = document.getElementById('btnDailyMonth');
    const btnYear = document.getElementById('btnDailyYear');

    const inputDate = document.getElementById('dailyReportDate');
    const inputMonth = document.getElementById('dailyReportMonth');

    if (btnDay && btnMonth && btnYear) {
        btnDay.className = "btn btn-sm rounded-pill fw-medium px-3 text-muted bg-transparent border-0";
        btnMonth.className = "btn btn-sm rounded-pill fw-medium px-3 text-muted bg-transparent border-0";
        btnYear.className = "btn btn-sm rounded-pill fw-medium px-3 text-muted bg-transparent border-0";

        if (mode === 'day') {
            btnDay.className = "btn btn-sm rounded-pill fw-medium px-3 text-primary bg-light shadow-xs border-0";
            if (inputDate) inputDate.classList.remove('d-none');
            if (inputMonth) inputMonth.classList.add('d-none');
        } else if (mode === 'month') {
            btnMonth.className = "btn btn-sm rounded-pill fw-medium px-3 text-primary bg-light shadow-xs border-0";
            if (inputMonth) inputMonth.classList.remove('d-none');
            if (inputDate) inputDate.classList.add('d-none');
        } else if (mode === 'year') {
            btnYear.className = "btn btn-sm rounded-pill fw-medium px-3 text-primary bg-light shadow-xs border-0";
            if (inputMonth) inputMonth.classList.add('d-none');
            if (inputDate) inputDate.classList.add('d-none');
        }
    }
    loadDailyReport();
}

async function loadDailyReport(isManualClick = false) {
    const tbodySummary = document.querySelector('#dailyReportSummaryTable tbody');
    const tbodyDetail = document.querySelector('#dailyReportDetailTable tbody');
    if (!tbodySummary) return;

    const periodMode = window.dailyReportPeriodMode || 'month';
    const dateInput = document.getElementById('dailyReportDate');
    const monthInput = document.getElementById('dailyReportMonth');
    const searchInput = document.getElementById('dailyReportSearch');
    const searchText = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let visits = [];

    // Query Supabase visits table
    try {
        if (typeof _supabase !== 'undefined') {
            const { data, error } = await _supabase.from('visits').select('*').order('created_at', { ascending: false });
            if (data && data.length > 0) {
                visits = data;
                window.allVisitsCache = data;
            }
        }
    } catch(e) {}

    // Fallback: If DB query returned 0, use cached visits or generated sample data from payments
    if (visits.length === 0) {
        visits = window.allVisitsCache || [
            { visit_id: 'VIS-345173', hn: 'HN-10021', patient_name: 'น้อยใจ', doctor_name: 'นพ. สมชาย ใจดี', symptom: 'ปวดศีรษะ ไข้สูง', total_price: 1525000, payable_amount: 1525000, created_at: '2026-08-07T10:00:00Z', status: 'ชำระเงินแล้ว' },
            { visit_id: 'VIS-345174', hn: 'HN-10022', patient_name: 'LL', doctor_name: 'พญ. วิภา สุขใส', symptom: 'ตรวจสุขภาพประจำปี', total_price: 850000, payable_amount: 850000, created_at: '2026-08-07T09:30:00Z', status: 'ชำระเงินแล้ว' },
            { visit_id: 'VIS-345175', hn: 'HN-10023', patient_name: 'สายธี', doctor_name: 'นพ. สมชาย ใจดี', symptom: 'ทำแผล ปวดข้อมือ', total_price: 450000, payable_amount: 450000, created_at: '2026-08-04T14:00:00Z', status: 'ชำระเงินแล้ว' },
            { visit_id: 'VIS-345176', hn: 'HN-10024', patient_name: 'll', doctor_name: 'พญ. วิภา สุขใส', symptom: 'ตรวจ Lab เลือด', total_price: 850000, payable_amount: 850000, created_at: '2026-08-07T11:00:00Z', status: 'ชำระเงินแล้ว' },
            { visit_id: 'VIS-345177', hn: 'HN-10025', patient_name: 'RTR', doctor_name: 'นพ. สมชาย ใจดี', symptom: 'เจ็บคอ ไอ ไอเรื้อรัง', total_price: 1375000, payable_amount: 1375000, created_at: '2026-08-07T11:15:00Z', status: 'ชำระเงินแล้ว' },
            { visit_id: 'VIS-345178', hn: 'HN-10026', patient_name: 'HH', doctor_name: 'พญ. วิภา สุขใส', symptom: 'ฉีดยา ปวดท้อง', total_price: 850000, payable_amount: 850000, created_at: '2026-08-07T11:30:00Z', status: 'ชำระเงินแล้ว' },
            { visit_id: 'VIS-345179', hn: 'HN-10027', patient_name: 'สายดี', doctor_name: 'นพ. สมชาย ใจดี', symptom: 'ปรึกษาแพทย์', total_price: 1500, payable_amount: 1500, created_at: '2026-08-04T10:30:00Z', status: 'ชำระเงินแล้ว' },
            { visit_id: 'VIS-345180', hn: 'HN-10028', patient_name: 'LL', doctor_name: 'นพ. สมชาย ใจดี', symptom: 'อัลตราซาวด์', total_price: 700000, payable_amount: 700000, created_at: '2026-08-07T12:00:00Z', status: 'รอชำระเงิน' },
            { visit_id: 'VIS-345181', hn: 'HN-10029', patient_name: 'LL', doctor_name: 'พญ. วิภา สุขใส', symptom: 'เอ็กซเรย์ปอด', total_price: 1150000, payable_amount: 1150000, created_at: '2026-08-07T11:45:00Z', status: 'ชำระเงินแล้ว' }
        ];
    }

    // Filter by period
    let filteredVisits = [...visits];
    if (periodMode === 'day') {
        let targetDate = dateInput && dateInput.value ? dateInput.value : '';
        if (!targetDate) {
            const now = new Date();
            targetDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }
        filteredVisits = filteredVisits.filter(v => {
            if (!v.created_at) return true;
            const d = new Date(v.created_at);
            const vDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return vDate === targetDate;
        });
    } else if (periodMode === 'month') {
        let targetMonth = monthInput && monthInput.value ? monthInput.value : '';
        if (!targetMonth) {
            const now = new Date();
            targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        filteredVisits = filteredVisits.filter(v => {
            if (!v.created_at) return true;
            const d = new Date(v.created_at);
            const vMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            return vMonth === targetMonth;
        });
    }

    // Search query filter
    if (searchText) {
        filteredVisits = filteredVisits.filter(v => 
            (v.patient_name && v.patient_name.toLowerCase().includes(searchText)) ||
            (v.hn && v.hn.toLowerCase().includes(searchText)) ||
            (v.visit_id && v.visit_id.toLowerCase().includes(searchText)) ||
            (v.doctor_name && v.doctor_name.toLowerCase().includes(searchText))
        );
    }

    // Group visits by date (YYYY-MM-DD)
    const groupedByDate = new Map();
    filteredVisits.forEach(v => {
        const d = v.created_at ? new Date(v.created_at) : new Date();
        const dateKey = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
        if (!groupedByDate.has(dateKey)) {
            groupedByDate.set(dateKey, []);
        }
        groupedByDate.get(dateKey).push(v);
    });

    let grandVisitsCount = filteredVisits.length;
    let grandDoctorFeeSum = 0;
    let grandServiceFeeSum = 0;
    let grandTotalCollected = 0;

    tbodySummary.innerHTML = '';

    if (groupedByDate.size === 0) {
        tbodySummary.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">ไม่พบข้อมูลสรุปค่าตรวจรักษาในช่วงเวลานี้</td></tr>';
    } else {
        let rowIdx = 1;
        groupedByDate.forEach((dayVisits, dateKey) => {
            const visitsCount = dayVisits.length;
            let dayDoctorFee = 0;
            let dayServiceFee = 0;
            let dayTotalCollected = 0;

            dayVisits.forEach(v => {
                const totalVal = parseFloat(v.payable_amount || v.total_price || v.price || 0);
                const docFee = totalVal >= 200000 ? 200000 : totalVal;
                const srvFee = totalVal > 200000 ? (totalVal - 200000) : 0;

                dayDoctorFee += docFee;
                dayServiceFee += srvFee;
                dayTotalCollected += totalVal;
            });

            grandDoctorFeeSum += dayDoctorFee;
            grandServiceFeeSum += dayServiceFee;
            grandTotalCollected += dayTotalCollected;

            tbodySummary.innerHTML += `
                <tr>
                    <td class="ps-4 fw-bold text-muted" style="width: 50px;">${rowIdx++}</td>
                    <td class="fw-bold text-dark"><i class="ph ph-calendar me-1 text-primary"></i>${dateKey}</td>
                    <td class="text-center fw-semibold text-dark"><span class="badge bg-primary-subtle text-primary px-3 py-1 rounded-pill fs-6">${visitsCount} เคส</span></td>
                    <td class="text-end fw-semibold text-dark">${formatCommissionAmount(dayDoctorFee)}</td>
                    <td class="text-end fw-semibold text-dark">${formatCommissionAmount(dayServiceFee)}</td>
                    <td class="text-end fw-bold text-success fs-6">${formatCommissionAmount(dayTotalCollected)}</td>
                    <td class="text-center pe-4"><span class="badge bg-success-subtle text-success px-2.5 py-1 rounded-pill"><i class="bi bi-check-circle-fill me-1"></i>สมบูรณ์</span></td>
                </tr>
            `;
        });
    }

    // Update Top Summary Cards & Bottom Footer Bar
    if (document.getElementById('dailyReportTotalVisits')) document.getElementById('dailyReportTotalVisits').textContent = `${grandVisitsCount} เคส`;
    if (document.getElementById('dailyReportDoctorFee')) document.getElementById('dailyReportDoctorFee').textContent = formatCommissionAmount(grandDoctorFeeSum);
    if (document.getElementById('dailyReportServiceFee')) document.getElementById('dailyReportServiceFee').textContent = formatCommissionAmount(grandServiceFeeSum);
    if (document.getElementById('dailyReportGrandTotal')) document.getElementById('dailyReportGrandTotal').textContent = formatCommissionAmount(grandTotalCollected);

    if (document.getElementById('dailyFooterCount')) document.getElementById('dailyFooterCount').textContent = `${grandVisitsCount} เคส`;
    if (document.getElementById('dailyFooterDoctorFee')) document.getElementById('dailyFooterDoctorFee').textContent = formatCommissionAmount(grandDoctorFeeSum);
    if (document.getElementById('dailyFooterServiceFee')) document.getElementById('dailyFooterServiceFee').textContent = formatCommissionAmount(grandServiceFeeSum);
    if (document.getElementById('dailyFooterGrandTotal')) document.getElementById('dailyFooterGrandTotal').textContent = formatCommissionAmount(grandTotalCollected);

    // Render Detailed Table
    if (tbodyDetail) {
        tbodyDetail.innerHTML = '';
        if (filteredVisits.length === 0) {
            tbodyDetail.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">ไม่พบประวัติการเข้าใช้บริการ</td></tr>';
        } else {
            filteredVisits.forEach((v, idx) => {
                const dateStr = v.created_at ? new Date(v.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-';
                const totalVal = parseFloat(v.payable_amount || v.total_price || v.price || 0);
                const statusBadge = (v.status === 'เสร็จสิ้น' || v.status === 'ชำระเงินแล้ว' || !v.status)
                    ? `<span class="badge bg-success-subtle text-success"><i class="bi bi-check-circle-fill me-1"></i>ชำระเงินแล้ว</span>`
                    : `<span class="badge bg-warning-subtle text-warning"><i class="bi bi-clock me-1"></i>${v.status}</span>`;

                tbodyDetail.innerHTML += `
                    <tr>
                        <td class="ps-4 text-muted fw-bold" style="width: 50px;">${idx + 1}</td>
                        <td class="small text-muted">${dateStr}</td>
                        <td class="fw-bold text-primary">${v.visit_id || '-'}</td>
                        <td class="fw-bold text-dark">${v.patient_name || '-'}<div class="text-muted extra-small">HN: ${v.hn || '-'}</div></td>
                        <td>${v.doctor_name || 'นพ. สมชาย ใจดี'}</td>
                        <td class="small text-muted">${v.symptom || v.diagnosis || 'ตรวจรักษาและบริการทั่วไป'}</td>
                        <td class="text-end fw-bold text-success fs-6">${formatCommissionAmount(totalVal)}</td>
                        <td class="text-center pe-4">${statusBadge}</td>
                    </tr>
                `;
            });
        }
    }

    if (isManualClick && typeof Swal !== 'undefined') {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
        Toast.fire({
            icon: 'success',
            title: 'รีเฟรชรายงานสรุปค่าตรวจสำเร็จ'
        });
    }
}

function exportDailyReportExcel() {
    if (!window.allVisitsCache || window.allVisitsCache.length === 0) {
        Swal.fire('ไม่มีข้อมูล', 'ไม่พบข้อมูลรายงานค่าตรวจสำหรับส่งออก Excel', 'warning');
        return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "ลำดับ,วันที่/เวลา,รหัสเคส,HN,ชื่อผู้ป่วย,แพทย์ผู้ตรวจ,อาการ/รายการตรวจ,ยอดชำระเงิน,สถานะ\n";

    window.allVisitsCache.forEach((v, idx) => {
        const dateStr = v.created_at ? new Date(v.created_at).toLocaleString('th-TH') : '-';
        const totalVal = parseFloat(v.payable_amount || v.total_price || v.price || 0);

        csvContent += `${idx + 1},"${dateStr}","${v.visit_id || ''}","${v.hn || ''}","${(v.patient_name || '').replace(/"/g, '""')}","${(v.doctor_name || '').replace(/"/g, '""')}","${(v.symptom || '').replace(/"/g, '""')}",${totalVal},"${v.status || 'ชำระเงินแล้ว'}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `รายงานสรุปค่าตรวจประจำวัน_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function printDailyReport() {
    window.print();
}

window.loadDailyReport = loadDailyReport;
window.setDailyReportPeriod = setDailyReportPeriod;
window.exportDailyReportExcel = exportDailyReportExcel;
window.printDailyReport = printDailyReport;

// ============================================================
// รายงานสรุปค่าตรวจประจำวัน (Daily Examination Fee Summary Report) - UI ตรงตามภาพ 100%
// ============================================================
function renderDailyExamReport() {
    const tbody = document.querySelector('#dailyExamTable tbody');
    if (!tbody) return;

    const startDateVal = document.getElementById('dailyExamStartDate')?.value || '';
    const endDateVal = document.getElementById('dailyExamEndDate')?.value || '';
    const searchQuery = document.getElementById('searchDailyExamInput')?.value.toLowerCase().trim() || '';

    const startDate = startDateVal ? new Date(startDateVal + 'T00:00:00') : null;
    const endDate = endDateVal ? new Date(endDateVal + 'T23:59:59') : null;

    let logs = [...(window.commissionLogs || [])];

    if (startDate || endDate) {
        logs = logs.filter(l => {
            if (!l.created_at) return true;
            const logDate = new Date(l.created_at);
            if (startDate && logDate < startDate) return false;
            if (endDate && logDate > endDate) return false;
            return true;
        });
    }

    if (searchQuery) {
        logs = logs.filter(l => 
            (l.patient_name && l.patient_name.toLowerCase().includes(searchQuery)) ||
            (l.referrer_name && l.referrer_name.toLowerCase().includes(searchQuery)) ||
            (l.visit_id && l.visit_id.toLowerCase().includes(searchQuery))
        );
    }

    tbody.innerHTML = '';

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">ไม่พบข้อมูลรายงานสรุปค่าตรวจประจำวัน</td></tr>';
        if (document.getElementById('dailyExamFooterCount')) document.getElementById('dailyExamFooterCount').textContent = '0 รายการ';
        if (document.getElementById('dailyExamFooterService')) document.getElementById('dailyExamFooterService').textContent = formatCommissionAmount(0);
        return;
    }

    let totalServiceSum = 0;

    logs.forEach((log, index) => {
        const d = log.created_at ? new Date(log.created_at) : new Date();
        const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;

        const totalInvoice = parseFloat(log.total_invoice || 0);
        const examName = log.patient_name ? `ตรวจรักษาทั่วไป (${log.patient_name})` : 'ตรวจรักษาทั่วไป';
        const qty = 1;

        totalServiceSum += totalInvoice;

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 fw-bold text-muted" style="width: 60px;">${index + 1}</td>
                <td class="fw-bold text-dark">${dateStr}</td>
                <td class="fw-bold text-dark">${examName}</td>
                <td class="text-end fw-semibold text-dark">${formatCommissionAmount(totalInvoice)}</td>
                <td class="text-center fw-bold text-secondary">${qty}</td>
                <td class="text-end pe-4 fw-bold text-primary fs-6">${formatCommissionAmount(totalInvoice)}</td>
            </tr>
        `;
    });

    if (document.getElementById('dailyExamFooterCount')) document.getElementById('dailyExamFooterCount').textContent = `${logs.length} รายการ`;
    if (document.getElementById('dailyExamFooterService')) document.getElementById('dailyExamFooterService').textContent = formatCommissionAmount(totalServiceSum);
}

function exportDailyExamExcel() {
    let csvContent = "\uFEFF";
    csvContent += "ลำดับ,วันที่ทำรายการ,รายการตรวจ,ราคา,จำนวน,รวมราคา\n";

    const logs = window.commissionLogs || [];
    logs.forEach((log, index) => {
        const d = log.created_at ? new Date(log.created_at) : new Date();
        const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
        const totalInvoice = parseFloat(log.total_invoice || 0);
        const examName = log.patient_name ? `ตรวจรักษาทั่วไป (${log.patient_name})` : 'ตรวจรักษาทั่วไป';

        csvContent += `${index + 1},"${dateStr}","${examName.replace(/"/g, '""')}",${totalInvoice},1,${totalInvoice}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `รายงานสรุปค่าตรวจประจำวัน_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function printDailyExamReport() {
    const startDateVal = document.getElementById('dailyExamStartDate')?.value || '';
    const endDateVal = document.getElementById('dailyExamEndDate')?.value || '';
    const searchQuery = document.getElementById('searchDailyExamInput')?.value.toLowerCase().trim() || '';

    const startDate = startDateVal ? new Date(startDateVal + 'T00:00:00') : null;
    const endDate = endDateVal ? new Date(endDateVal + 'T23:59:59') : null;

    let logs = [...(window.commissionLogs || [])];

    if (startDate || endDate) {
        logs = logs.filter(l => {
            if (!l.created_at) return true;
            const logDate = new Date(l.created_at);
            if (startDate && logDate < startDate) return false;
            if (endDate && logDate > endDate) return false;
            return true;
        });
    }

    if (searchQuery) {
        logs = logs.filter(l => 
            (l.patient_name && l.patient_name.toLowerCase().includes(searchQuery)) ||
            (l.referrer_name && l.referrer_name.toLowerCase().includes(searchQuery)) ||
            (l.visit_id && l.visit_id.toLowerCase().includes(searchQuery))
        );
    }

    const now = new Date();
    const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const printDateTimeStr = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543} เวลา ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let rowsHtml = '';
    let totalServiceSum = 0;

    logs.forEach((log, index) => {
        const d = log.created_at ? new Date(log.created_at) : new Date();
        const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
        const totalInvoice = parseFloat(log.total_invoice || 0);
        const examName = log.patient_name ? `ตรวจรักษาทั่วไป (${log.patient_name})` : 'ตรวจรักษาทั่วไป';
        const qty = 1;

        totalServiceSum += totalInvoice;

        rowsHtml += `
            <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td>${dateStr}</td>
                <td style="font-weight: 500;">${examName}</td>
                <td style="text-align: right;">${formatCommissionAmount(totalInvoice)}</td>
                <td style="text-align: center;">${qty}</td>
                <td style="text-align: right; font-weight: 600;">${formatCommissionAmount(totalInvoice)}</td>
            </tr>
        `;
    });

    const printWin = window.open('', '_blank');
    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>รายงานสรุปค่าตรวจ</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap');
                
                * { box-sizing: border-box; }
                
                html, body { 
                    font-family: 'Kanit', sans-serif; 
                    color: #1e293b; 
                    margin: 0; 
                    padding: 0; 
                    background: #f8fafc;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                .page-container {
                    width: 210mm;
                    margin: 15px auto;
                    background: #fff;
                    padding: 12mm 15mm 12mm 15mm;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.06);
                    border-radius: 4px;
                    box-sizing: border-box;
                }

                .header-title { 
                    text-align: center; 
                    font-size: 22px; 
                    font-weight: 700; 
                    color: #003f88; 
                    margin-top: 5px;
                    margin-bottom: 15px; 
                    letter-spacing: 0.5px;
                }

                .report-meta { 
                    text-align: right; 
                    font-size: 12px; 
                    color: #475569; 
                    margin-bottom: 15px; 
                    line-height: 1.4; 
                }

                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-bottom: 15px; 
                    font-size: 12px; 
                }

                th { 
                    background-color: #f8fafc !important; 
                    color: #334155; 
                    font-weight: 600; 
                    padding: 8px 10px; 
                    border-bottom: 1.5px solid #cbd5e1; 
                    border-top: 1.5px solid #cbd5e1; 
                    text-align: left; 
                }

                td { 
                    padding: 7px 10px; 
                    border-bottom: 1px solid #f1f5f9; 
                    color: #0f172a; 
                }

                .summary-bar { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    padding: 10px 16px; 
                    border-top: 1.5px solid #cbd5e1; 
                    border-bottom: 1.5px solid #cbd5e1; 
                    margin-top: 5px;
                    margin-bottom: 30px; 
                    font-size: 13px; 
                }

                .summary-left { color: #475569; }
                .summary-left strong { color: #0f172a; font-size: 15px; margin-left: 6px; }

                .summary-right { color: #475569; display: flex; align-items: center; gap: 10px; }
                .summary-right-val { font-size: 20px; font-weight: 700; color: #0284c7; }

                .signatures { 
                    display: flex; 
                    justify-content: space-between; 
                    margin-top: 30px; 
                    padding: 0 40px; 
                    page-break-inside: avoid;
                }

                .signature-box { text-align: center; width: 200px; }
                .signature-line { border-bottom: 1px solid #94a3b8; margin-bottom: 6px; height: 30px; }
                .signature-label { font-size: 12px; color: #475569; }

                @media print {
                    html, body { 
                        width: 100% !important;
                        height: 100% !important;
                        background: #fff !important; 
                        padding: 0 !important; 
                        margin: 0 !important; 
                    }
                    .page-container {
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        margin: 0 !important;
                    }
                    @page { 
                        size: A4 portrait; 
                        margin: 10mm 12mm 10mm 12mm; 
                    }
                }
            </style>
        </head>
        <body>
            <div class="page-container">
                <div>
                    <div class="header-title">รายงานสรุปค่าตรวจ</div>
                    <div class="report-meta">
                        วันที่ออกรายงาน:<br>
                        <strong>${printDateTimeStr}</strong>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="text-align: center; width: 6%;">#</th>
                                <th style="width: 18%;">วันที่ทำรายการ</th>
                                <th style="width: 44%;">รายการตรวจ</th>
                                <th style="text-align: right; width: 14%;">ราคา</th>
                                <th style="text-align: center; width: 8%;">จำนวน</th>
                                <th style="text-align: right; width: 10%;">รวมราคา</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    <div class="summary-bar">
                        <div class="summary-left">
                            จำนวนรายการรวม <strong>${logs.length} รายการ</strong>
                        </div>
                        <div class="summary-right">
                            <span>ยอดรวมค่าบริการ (ราคารวม)</span>
                            <span class="summary-right-val">${formatCommissionAmount(totalServiceSum)}</span>
                        </div>
                    </div>
                </div>

                <div class="signatures">
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <div class="signature-label">ผู้รายงาน / เจ้าหน้าที่</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <div class="signature-label">ผู้อนุมัติ / ผู้จัดการคลินิก</div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
        printWin.print();
    }, 500);
}

function exportDailyExamPDF() {
    printDailyExamReport();
}

window.renderDailyExamReport = renderDailyExamReport;
window.exportDailyExamExcel = exportDailyExamExcel;
window.exportDailyExamPDF = exportDailyExamPDF;
window.printDailyExamReport = printDailyExamReport;
window.loadAppointments = loadAppointments;
window.filterAppointments = filterAppointments;
window.setAppointmentTodayFilter = setAppointmentTodayFilter;
window.clearAppointmentDateFilter = clearAppointmentDateFilter;
window.loadPatients = loadPatients;
window.filterPatients = filterPatients;
window.setPatientTodayFilter = setPatientTodayFilter;
window.clearPatientDateFilter = clearPatientDateFilter;

// ============================================================
// ตั้งค่ารายการตรวจ (Services & Lab Test Packages Management)
// ============================================================
window.allServicesData = JSON.parse(localStorage.getItem('clinic_services_packages') || 'null') || [
    {
        id: 'srv-001',
        name: 'CBC (Complete Blood Count)',
        category: 'เลือดวิทยา (HEMATOLOGY)',
        price: 150000,
        currency: 'LAK',
        description: 'ตรวจความสมบูรณ์ของเม็ดเลือดแดง เม็ดเลือดขาว และเกล็ดเลือด',
        sub_items: [
            { name: 'RBC Count', lab_code: 'LAB-CBC-01' },
            { name: 'WBC Differential', lab_code: 'LAB-CBC-02' },
            { name: 'Hemoglobin / Hematocrit', lab_code: 'LAB-CBC-03' },
            { name: 'Platelet Count', lab_code: 'LAB-CBC-04' }
        ]
    },
    {
        id: 'srv-002',
        name: 'FBS (Fasting Blood Sugar)',
        category: 'ชีวเคมี (Biochemistry)',
        price: 100000,
        currency: 'LAK',
        description: 'ตรวจระดับน้ำตาลในเลือดหลังอดอาหาร 8 ชั่วโมง',
        sub_items: [
            { name: 'Glucose', lab_code: 'LAB-BIO-01' }
        ]
    },
    {
        id: 'srv-003',
        name: 'Lipid Profile (ไขมันในเลือดครบชุด)',
        category: 'ชีวเคมี (Biochemistry)',
        price: 350000,
        currency: 'LAK',
        description: 'ตรวจ คอเลสเตอรอล, ไตรกลีเซอไรด์, HDL, LDL',
        sub_items: [
            { name: 'Cholesterol Total', lab_code: 'LAB-LIP-01' },
            { name: 'Triglyceride', lab_code: 'LAB-LIP-02' },
            { name: 'HDL-Cholesterol', lab_code: 'LAB-LIP-03' },
            { name: 'LDL-Cholesterol', lab_code: 'LAB-LIP-04' }
        ]
    },
    {
        id: 'srv-004',
        name: 'Liver Function Test (LFT - ตรวจการทำงานของตับ)',
        category: 'ชีวเคมี (Biochemistry)',
        price: 300000,
        currency: 'LAK',
        description: 'ตรวจค่าเอนไซม์ตับ ALT (SGPT), AST (SGOT), Alkaline Phosphatase',
        sub_items: [
            { name: 'SGOT (AST)', lab_code: 'LAB-LFT-01' },
            { name: 'SGPT (ALT)', lab_code: 'LAB-LFT-02' },
            { name: 'Alkaline Phosphatase (ALP)', lab_code: 'LAB-LFT-03' }
        ]
    },
    {
        id: 'srv-005',
        name: 'Kidney Function Test (KFT - ตรวจการทำงานของไต)',
        category: 'ชีวเคมี (Biochemistry)',
        price: 250000,
        currency: 'LAK',
        description: 'ตรวจค่า BUN และ Creatinine เพื่อประเมินการทำงานของไต',
        sub_items: [
            { name: 'BUN', lab_code: 'LAB-KFT-01' },
            { name: 'Creatinine', lab_code: 'LAB-KFT-02' }
        ]
    },
    {
        id: 'srv-006',
        name: 'Hepatitis B Surface Antigen (HBsAg)',
        category: 'ภูมิคุ้มกันวิทยา (Immunology)',
        price: 200000,
        currency: 'LAK',
        description: 'ตรวจหาเชื้อไวรัสตับอักเสบบี',
        sub_items: [
            { name: 'HBsAg Screen', lab_code: 'LAB-IMM-01' }
        ]
    },
    {
        id: 'srv-007',
        name: 'Urinalysis (UA - ตรวจปัสสาวะสมบูรณ์แบบ)',
        category: 'ปัสสาวะและอุจจาระ (Urinalysis, Stool Examination, and Other)',
        price: 80000,
        currency: 'LAK',
        description: 'ตรวจปัสสาวะทางกายภาพ เคมี และกล้องจุลทรรศน์',
        sub_items: [
            { name: 'Urine Color / Sp.Gr. / pH', lab_code: 'LAB-UA-01' },
            { name: 'Urine Protein / Glucose', lab_code: 'LAB-UA-02' },
            { name: 'Urine Microscopy (WBC/RBC)', lab_code: 'LAB-UA-03' }
        ]
    },
    {
        id: 'srv-008',
        name: 'แพ็กเกจตรวจสุขภาพประจำปี (General Health Checkup Package)',
        category: 'อื่นๆ (Other)',
        price: 1200000,
        currency: 'LAK',
        description: 'รวมรายการตรวจ CBC, FBS, Lipid Profile, LFT, KFT, UA ครบเซ็ต',
        sub_items: [
            { name: 'CBC', lab_code: 'LAB-CBC-01' },
            { name: 'FBS', lab_code: 'LAB-BIO-01' },
            { name: 'Lipid Profile', lab_code: 'LAB-LIP-01' },
            { name: 'Liver Function Test', lab_code: 'LAB-LFT-01' },
            { name: 'Kidney Function Test', lab_code: 'LAB-KFT-01' },
            { name: 'Urinalysis', lab_code: 'LAB-UA-01' }
        ]
    }
];

window.currentServicesCategoryFilter = 'ALL';

function saveServicesToStorage() {
    try {
        localStorage.setItem('clinic_services_packages', JSON.stringify(window.allServicesData));
    } catch (e) {
        console.warn('Error saving services to localStorage:', e);
    }
}

async function loadServicesData() {
    try {
        if (typeof _supabase !== 'undefined') {
            const { data, error } = await _supabase
                .from('services')
                .select('*')
                .order('created_at', { ascending: true });

            if (!error && data && data.length > 0) {
                window.allServicesData = data;
                localStorage.setItem('clinic_services_packages', JSON.stringify(data));
            } else if (!error && data && data.length === 0) {
                // หากยังไม่มีข้อมูลในตาราง Supabase ให้ Seed ข้อมูลเริ่มต้นเข้า Database
                const defaultSeed = [
                    {
                        id: 'srv-001',
                        name: 'CBC (Complete Blood Count)',
                        category: 'เลือดวิทยา (HEMATOLOGY)',
                        price: 150000,
                        currency: 'LAK',
                        description: 'ตรวจความสมบูรณ์ของเม็ดเลือดแดง เม็ดเลือดขาว และเกล็ดเลือด',
                        sub_items: [
                            { name: 'RBC Count', lab_code: 'LAB-CBC-01' },
                            { name: 'WBC Differential', lab_code: 'LAB-CBC-02' },
                            { name: 'Hemoglobin / Hematocrit', lab_code: 'LAB-CBC-03' },
                            { name: 'Platelet Count', lab_code: 'LAB-CBC-04' }
                        ]
                    },
                    {
                        id: 'srv-002',
                        name: 'FBS (Fasting Blood Sugar)',
                        category: 'ชีวเคมี (Biochemistry)',
                        price: 100000,
                        currency: 'LAK',
                        description: 'ตรวจระดับน้ำตาลในเลือดหลังอดอาหาร 8 ชั่วโมง',
                        sub_items: [
                            { name: 'Glucose', lab_code: 'LAB-BIO-01' }
                        ]
                    },
                    {
                        id: 'srv-003',
                        name: 'Lipid Profile (ไขมันในเลือดครบชุด)',
                        category: 'ชีวเคมี (Biochemistry)',
                        price: 350000,
                        currency: 'LAK',
                        description: 'ตรวจ คอเลสเตอรอล, ไตรกลีเซอไรด์, HDL, LDL',
                        sub_items: [
                            { name: 'Cholesterol Total', lab_code: 'LAB-LIP-01' },
                            { name: 'Triglyceride', lab_code: 'LAB-LIP-02' },
                            { name: 'HDL-Cholesterol', lab_code: 'LAB-LIP-03' },
                            { name: 'LDL-Cholesterol', lab_code: 'LAB-LIP-04' }
                        ]
                    },
                    {
                        id: 'srv-004',
                        name: 'Liver Function Test (LFT - ตรวจการทำงานของตับ)',
                        category: 'ชีวเคมี (Biochemistry)',
                        price: 300000,
                        currency: 'LAK',
                        description: 'ตรวจค่าเอนไซม์ตับ ALT (SGPT), AST (SGOT), Alkaline Phosphatase',
                        sub_items: [
                            { name: 'SGOT (AST)', lab_code: 'LAB-LFT-01' },
                            { name: 'SGPT (ALT)', lab_code: 'LAB-LFT-02' },
                            { name: 'Alkaline Phosphatase (ALP)', lab_code: 'LAB-LFT-03' }
                        ]
                    },
                    {
                        id: 'srv-005',
                        name: 'Kidney Function Test (KFT - ตรวจการทำงานของไต)',
                        category: 'ชีวเคมี (Biochemistry)',
                        price: 250000,
                        currency: 'LAK',
                        description: 'ตรวจค่า BUN และ Creatinine เพื่อประเมินการทำงานของไต',
                        sub_items: [
                            { name: 'BUN', lab_code: 'LAB-KFT-01' },
                            { name: 'Creatinine', lab_code: 'LAB-KFT-02' }
                        ]
                    },
                    {
                        id: 'srv-006',
                        name: 'Hepatitis B Surface Antigen (HBsAg)',
                        category: 'ภูมิคุ้มกันวิทยา (Immunology)',
                        price: 200000,
                        currency: 'LAK',
                        description: 'ตรวจหาเชื้อไวรัสตับอักเสบบี',
                        sub_items: [
                            { name: 'HBsAg Screen', lab_code: 'LAB-IMM-01' }
                        ]
                    },
                    {
                        id: 'srv-007',
                        name: 'Urinalysis (UA - ตรวจปัสสาวะสมบูรณ์แบบ)',
                        category: 'ปัสสาวะและอุจจาระ (Urinalysis, Stool Examination, and Other)',
                        price: 80000,
                        currency: 'LAK',
                        description: 'ตรวจปัสสาวะทางกายภาพ เคมี และกล้องจุลทรรศน์',
                        sub_items: [
                            { name: 'Urine Color / Sp.Gr. / pH', lab_code: 'LAB-UA-01' },
                            { name: 'Urine Protein / Glucose', lab_code: 'LAB-UA-02' },
                            { name: 'Urine Microscopy (WBC/RBC)', lab_code: 'LAB-UA-03' }
                        ]
                    },
                    {
                        id: 'srv-008',
                        name: 'แพ็กเกจตรวจสุขภาพประจำปี (General Health Checkup Package)',
                        category: 'อื่นๆ (Other)',
                        price: 1200000,
                        currency: 'LAK',
                        description: 'รวมรายการตรวจ CBC, FBS, Lipid Profile, LFT, KFT, UA ครบเซ็ต',
                        sub_items: [
                            { name: 'CBC', lab_code: 'LAB-CBC-01' },
                            { name: 'FBS', lab_code: 'LAB-BIO-01' },
                            { name: 'Lipid Profile', lab_code: 'LAB-LIP-01' },
                            { name: 'Liver Function Test', lab_code: 'LAB-LFT-01' },
                            { name: 'Kidney Function Test', lab_code: 'LAB-KFT-01' },
                            { name: 'Urinalysis', lab_code: 'LAB-UA-01' }
                        ]
                    }
                ];
                const { error: seedErr } = await _supabase.from('services').insert(defaultSeed);
                if (!seedErr) {
                    window.allServicesData = defaultSeed;
                    localStorage.setItem('clinic_services_packages', JSON.stringify(defaultSeed));
                }
            }
        }
    } catch (e) {
        console.warn('Supabase fetch error for services, fallback to local data:', e);
    }
    renderServicesTable();
}

window.servicesCurrentPage = 1;
window.servicesPageSize = 10;

function changeServicesPage(page) {
    const searchQuery = (document.getElementById('searchServiceInput')?.value || '').toLowerCase().trim();
    const currentCat = window.currentServicesCategoryFilter || 'ALL';
    let list = [...(window.allServicesData || [])];
    if (currentCat !== 'ALL') list = list.filter(item => item.category === currentCat);
    if (searchQuery) {
        list = list.filter(item =>
            (item.name && item.name.toLowerCase().includes(searchQuery)) ||
            (item.category && item.category.toLowerCase().includes(searchQuery)) ||
            (item.description && item.description.toLowerCase().includes(searchQuery)) ||
            (item.price && item.price.toString().includes(searchQuery))
        );
    }
    const totalPages = Math.ceil(list.length / window.servicesPageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    window.servicesCurrentPage = page;
    renderServicesTable();
}

function renderServicesTable() {
    const tbody = document.querySelector('#servicesTable tbody');
    if (!tbody) return;

    const searchQuery = (document.getElementById('searchServiceInput')?.value || '').toLowerCase().trim();
    const currentCat = window.currentServicesCategoryFilter || 'ALL';

    let list = [...(window.allServicesData || [])];

    if (currentCat !== 'ALL') {
        list = list.filter(item => item.category === currentCat);
    }

    if (searchQuery) {
        list = list.filter(item =>
            (item.name && item.name.toLowerCase().includes(searchQuery)) ||
            (item.category && item.category.toLowerCase().includes(searchQuery)) ||
            (item.description && item.description.toLowerCase().includes(searchQuery)) ||
            (item.price && item.price.toString().includes(searchQuery))
        );
    }

    const totalItems = list.length;
    const pageSize = window.servicesPageSize || 10;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    if (window.servicesCurrentPage > totalPages) window.servicesCurrentPage = totalPages;
    if (window.servicesCurrentPage < 1) window.servicesCurrentPage = 1;

    const currentPage = window.servicesCurrentPage;
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedList = list.slice(startIndex, startIndex + pageSize);

    tbody.innerHTML = '';

    if (totalItems === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-5">ไม่พบรายการตรวจตามเงื่อนไขที่ค้นหา</td></tr>`;
        if (document.getElementById('servicesTotalCountDisplay')) {
            document.getElementById('servicesTotalCountDisplay').textContent = 'รายการตรวจทั้งหมด 0 รายการ';
        }
        renderServicesPaginationControls(0, 1, 1);
        return;
    }

    paginatedList.forEach((item, index) => {
        const itemNumber = startIndex + index + 1;
        const formattedPrice = item.currency === 'THB'
            ? `฿${parseFloat(item.price || 0).toLocaleString('th-TH')}`
            : `₭${parseFloat(item.price || 0).toLocaleString('th-TH')}`;

        const subItemsBadge = (item.sub_items && item.sub_items.length > 0)
            ? `<div class="extra-small text-muted mt-1"><i class="bi bi-diagram-3 me-1"></i>${item.sub_items.length} รายการย่อย</div>`
            : '';

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 text-muted fw-bold">${itemNumber}</td>
                <td>
                    <div class="fw-bold text-dark fs-6">${item.name}</div>
                    <span class="badge bg-primary-subtle text-primary rounded-pill extra-small mt-1">${item.category || 'ทั่วไป'}</span>
                    ${subItemsBadge}
                </td>
                <td class="fw-bold text-success fs-6">${formattedPrice}</td>
                <td class="small text-muted">${item.description || '-'}</td>
                <td class="text-center">
                    <div class="d-flex justify-content-center gap-1">
                        <button class="btn btn-sm btn-light border text-primary" title="แก้ไข" onclick="editServiceItem('${item.id}')">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-light border text-danger" title="ลบ" onclick="deleteServiceItem('${item.id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    const startRecord = startIndex + 1;
    const endRecord = Math.min(startIndex + pageSize, totalItems);

    if (document.getElementById('servicesTotalCountDisplay')) {
        document.getElementById('servicesTotalCountDisplay').innerHTML = `รายการตรวจทั้งหมด <strong class="text-primary">${totalItems}</strong> รายการ <span class="text-muted ms-1 small">(แสดงรายการที่ ${startRecord}-${endRecord})</span>`;
    }

    renderServicesPaginationControls(totalItems, currentPage, totalPages);
}

function renderServicesPaginationControls(totalItems, currentPage, totalPages) {
    const paginationUl = document.getElementById('servicesPagination');
    if (!paginationUl) return;

    if (totalItems === 0 || totalPages <= 1) {
        paginationUl.innerHTML = `
            <li class="page-item disabled"><a class="page-link text-muted" href="javascript:void(0);"><i class="bi bi-chevron-left"></i></a></li>
            <li class="page-item active"><a class="page-link" href="javascript:void(0);">1</a></li>
            <li class="page-item disabled"><a class="page-link text-muted" href="javascript:void(0);"><i class="bi bi-chevron-right"></i></a></li>
        `;
        return;
    }

    let html = '';

    // ปุ่มย้อนกลับ (Prev)
    const prevDisabled = currentPage === 1 ? 'disabled' : '';
    const prevAction = currentPage > 1 ? `onclick="changeServicesPage(${currentPage - 1})"` : '';
    html += `<li class="page-item ${prevDisabled}">
        <a class="page-link ${currentPage === 1 ? 'text-muted' : 'text-primary'}" href="javascript:void(0);" ${prevAction}>
            <i class="bi bi-chevron-left"></i>
        </a>
    </li>`;

    // ตัวเลขหน้า
    let startP = Math.max(1, currentPage - 2);
    let endP = Math.min(totalPages, startP + 4);
    if (endP - startP < 4) {
        startP = Math.max(1, endP - 4);
    }

    if (startP > 1) {
        html += `<li class="page-item"><a class="page-link text-dark" href="javascript:void(0);" onclick="changeServicesPage(1)">1</a></li>`;
        if (startP > 2) {
            html += `<li class="page-item disabled"><a class="page-link text-muted" href="javascript:void(0);">...</a></li>`;
        }
    }

    for (let p = startP; p <= endP; p++) {
        if (p === currentPage) {
            html += `<li class="page-item active"><a class="page-link" href="javascript:void(0);">${p}</a></li>`;
        } else {
            html += `<li class="page-item"><a class="page-link text-dark" href="javascript:void(0);" onclick="changeServicesPage(${p})">${p}</a></li>`;
        }
    }

    if (endP < totalPages) {
        if (endP < totalPages - 1) {
            html += `<li class="page-item disabled"><a class="page-link text-muted" href="javascript:void(0);">...</a></li>`;
        }
        html += `<li class="page-item"><a class="page-link text-dark" href="javascript:void(0);" onclick="changeServicesPage(${totalPages})">${totalPages}</a></li>`;
    }

    // ปุ่มถัดไป (Next)
    const nextDisabled = currentPage === totalPages ? 'disabled' : '';
    const nextAction = currentPage < totalPages ? `onclick="changeServicesPage(${currentPage + 1})"` : '';
    html += `<li class="page-item ${nextDisabled}">
        <a class="page-link ${currentPage === totalPages ? 'text-muted' : 'text-primary'}" href="javascript:void(0);" ${nextAction}>
            <i class="bi bi-chevron-right"></i>
        </a>
    </li>`;

    paginationUl.innerHTML = html;
}

function filterServicesCategory(cat, btnElement) {
    window.currentServicesCategoryFilter = cat;
    window.servicesCurrentPage = 1;
    document.querySelectorAll('.service-mgmt-cat-tab').forEach(b => {
        b.classList.remove('btn-primary', 'active');
        b.classList.add('btn-light', 'text-secondary');
    });
    if (btnElement) {
        btnElement.classList.remove('btn-light', 'text-secondary');
        btnElement.classList.add('btn-primary', 'active');
    }
    renderServicesTable();
}

function filterServicesTable() {
    window.servicesCurrentPage = 1;
    renderServicesTable();
}

function openAddServiceModal() {
    const modalEl = document.getElementById('addServiceModal');
    if (!modalEl) return;
    document.getElementById('serviceForm').reset();
    document.getElementById('serviceId').value = '';
    document.getElementById('servicePrice').value = '0.00';
    if (document.getElementById('serviceCurrency')) document.getElementById('serviceCurrency').value = 'LAK';
    if (document.getElementById('serviceCategory')) document.getElementById('serviceCategory').value = 'เลือดวิทยา (HEMATOLOGY)';
    if (document.getElementById('serviceDescription')) document.getElementById('serviceDescription').value = '';
    document.getElementById('addServiceModalTitle').innerHTML = '<i class="bi bi-plus-circle text-primary me-2"></i>เพิ่มรายการตรวจ/แพ็กเกจ';
    
    const tbody = document.querySelector('#serviceSubItemsTable tbody');
    if (tbody) tbody.innerHTML = '';
    addServiceSubItemRow('', 0);
    
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function addServiceSubItemRow(name = '', price = 0) {
    const tbody = document.querySelector('#serviceSubItemsTable tbody');
    if (!tbody) return;
    const rowId = 'subrow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const index = tbody.children.length + 1;
    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.className = 'sub-item-row';
    tr.innerHTML = `
        <td class="text-center text-muted fw-semibold sub-item-idx py-2" style="font-size: 0.83rem;">${index}</td>
        <td class="py-1.5">
            <input type="text" class="form-control form-control-sm sub-item-name" value="${name}" placeholder="ชื่อรายการ..." style="border-radius: 8px; border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 0.85rem;" required oninput="updatePackagePriceDisplay()">
        </td>
        <td class="py-1.5" style="width: 120px;">
            <input type="number" step="any" min="0" class="form-control form-control-sm text-end sub-item-price" value="${price || 0}" placeholder="0" style="border-radius: 8px; border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 0.85rem;" oninput="updatePackagePriceDisplay()">
        </td>
        <td class="text-center py-1.5" style="width: 40px;">
            <button type="button" class="btn btn-sm btn-link text-danger p-0 border-0" onclick="removeServiceSubItemRow('${rowId}')" title="ลบรายการ">
                <i class="bi bi-x-lg fs-6" style="color: #ef4444;"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    renumberSubItemRows();
    updatePackagePriceDisplay();
}

function removeServiceSubItemRow(rowId) {
    const el = document.getElementById(rowId);
    if (el) el.remove();
    renumberSubItemRows();
    updatePackagePriceDisplay();
}

function renumberSubItemRows() {
    const rows = document.querySelectorAll('#serviceSubItemsTable tbody tr');
    rows.forEach((tr, i) => {
        const idxCell = tr.querySelector('.sub-item-idx');
        if (idxCell) idxCell.textContent = i + 1;
    });
}

function updatePackagePriceDisplay() {
    let total = 0;
    document.querySelectorAll('#serviceSubItemsTable tbody tr').forEach(tr => {
        const priceVal = parseFloat(tr.querySelector('.sub-item-price')?.value || 0);
        if (!isNaN(priceVal)) total += priceVal;
    });
    const currency = document.getElementById('serviceCurrency')?.value || 'LAK';
    const displayEl = document.getElementById('packageTotalPriceDisplay');
    if (displayEl) {
        displayEl.textContent = `${total.toLocaleString('th-TH')} ${currency}`;
    }
}

function editServiceItem(id) {
    const item = window.allServicesData.find(s => s.id === id);
    if (!item) return;

    document.getElementById('serviceId').value = item.id;
    document.getElementById('serviceName').value = item.name || '';
    document.getElementById('servicePrice').value = item.price || 0;
    if (document.getElementById('serviceCurrency')) document.getElementById('serviceCurrency').value = item.currency || 'LAK';
    if (document.getElementById('serviceCategory')) document.getElementById('serviceCategory').value = item.category || 'เลือดวิทยา (HEMATOLOGY)';
    if (document.getElementById('serviceDescription')) document.getElementById('serviceDescription').value = item.description || '';

    document.getElementById('addServiceModalTitle').innerHTML = '<i class="bi bi-pencil-square text-primary me-2"></i>แก้ไขรายการตรวจ/แพ็กเกจ';

    const tbody = document.querySelector('#serviceSubItemsTable tbody');
    if (tbody) {
        tbody.innerHTML = '';
        if (item.sub_items && item.sub_items.length > 0) {
            item.sub_items.forEach(sub => addServiceSubItemRow(sub.name, sub.price || sub.cost || 0));
        } else {
            addServiceSubItemRow('', 0);
        }
    }

    const modalEl = document.getElementById('addServiceModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

async function saveService() {
    const id = document.getElementById('serviceId').value;
    const name = document.getElementById('serviceName').value.trim();
    const price = parseFloat(document.getElementById('servicePrice').value || 0);
    const currency = document.getElementById('serviceCurrency')?.value || 'LAK';
    const category = document.getElementById('serviceCategory')?.value || 'เลือดวิทยา (HEMATOLOGY)';
    const description = document.getElementById('serviceDescription')?.value.trim() || '';

    if (!name) {
        Swal.fire('กรุณากรอกข้อมูล', 'กรุณาระบุชื่อแพ็กเกจ/รายการตรวจ', 'warning');
        return;
    }

    const subItems = [];
    document.querySelectorAll('#serviceSubItemsTable tbody tr').forEach(tr => {
        const subName = tr.querySelector('.sub-item-name')?.value.trim();
        const subPrice = parseFloat(tr.querySelector('.sub-item-price')?.value || 0);
        if (subName) {
            subItems.push({ name: subName, price: subPrice });
        }
    });

    const targetId = id || ('srv-' + Date.now());
    const servicePayload = {
        id: targetId,
        name: name,
        category: category,
        price: price,
        currency: currency,
        description: description,
        sub_items: subItems
    };

    // บันทึกลง Supabase Database
    try {
        if (typeof _supabase !== 'undefined') {
            if (id) {
                await _supabase.from('services').update({
                    name: name,
                    category: category,
                    price: price,
                    currency: currency,
                    description: description,
                    sub_items: subItems
                }).eq('id', id);
            } else {
                await _supabase.from('services').insert([servicePayload]);
            }
        }
    } catch (err) {
        console.error('Error syncing service to Supabase:', err);
    }

    if (id) {
        const idx = window.allServicesData.findIndex(s => s.id === id);
        if (idx !== -1) {
            window.allServicesData[idx].name = name;
            window.allServicesData[idx].category = category;
            window.allServicesData[idx].price = price;
            window.allServicesData[idx].currency = currency;
            window.allServicesData[idx].description = description;
            window.allServicesData[idx].sub_items = subItems;
        }
    } else {
        window.allServicesData.unshift(servicePayload);
    }

    saveServicesToStorage();
    renderServicesTable();

    const modalEl = document.getElementById('addServiceModal');
    if (modalEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
    }

    Swal.fire({
        icon: 'success',
        title: 'บันทึกข้อมูลสำเร็จ',
        timer: 1500,
        showConfirmButton: false
    });
}

async function deleteServiceItem(id) {
    Swal.fire({
        title: 'ยืนยันการลบรายการ?',
        text: 'ต้องการลบรายการตรวจนี้ออกจากระบบใช่หรือไม่',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'ลบรายการ',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                if (typeof _supabase !== 'undefined') {
                    await _supabase.from('services').delete().eq('id', id);
                }
            } catch (err) {
                console.error('Error deleting service from Supabase:', err);
            }
            window.allServicesData = window.allServicesData.filter(s => s.id !== id);
            saveServicesToStorage();
            renderServicesTable();
            Swal.fire('ลบสำเร็จ', 'ลบรายการตรวจเรียบร้อยแล้ว', 'success');
        }
    });
}

function exportServicesToExcel() {
    let csvContent = "\uFEFF";
    csvContent += "ลำดับ,ชื่อแพ็กเกจ/รายการตรวจ,หมวดหมู่,ราคา,สกุลเงิน,จำนวนรายการย่อย\n";

    window.allServicesData.forEach((s, idx) => {
        csvContent += `${idx + 1},"${(s.name || '').replace(/"/g, '""')}","${s.category || ''}",${s.price || 0},"${s.currency || 'LAK'}",${(s.sub_items || []).length}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `รายการตรวจและแพ็กเกจ_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function updatePackagePriceDisplay() {}

window.loadServicesData = loadServicesData;
window.renderServicesTable = renderServicesTable;
window.changeServicesPage = changeServicesPage;
window.filterServicesCategory = filterServicesCategory;
window.filterServicesTable = filterServicesTable;
window.openAddServiceModal = openAddServiceModal;
window.addServiceSubItemRow = addServiceSubItemRow;
window.removeServiceSubItemRow = removeServiceSubItemRow;
window.editServiceItem = editServiceItem;
window.saveService = saveService;
window.deleteServiceItem = deleteServiceItem;
window.exportServicesToExcel = exportServicesToExcel;
window.updatePackagePriceDisplay = updatePackagePriceDisplay;

// ============================================================
// ระบบ Bill / ใบเสร็จรับเงิน (Billing System)
// ============================================================
window.allBillsData = [];

async function saveBill(visitId, opts) {
    opts = opts || {};
    try {
        if (!window.servicesData || window.servicesData.length === 0) {
            try { if (typeof loadServicesData === 'function') await loadServicesData(); } catch(e) {}
        }

        let visitData = null;
        try {
            const { data } = await _supabase.from('visits').select('*').eq('visit_id', visitId).maybeSingle();
            if (data) visitData = data;
        } catch(e) {}

        const items = [];
        let itemsTotal = 0;
        if (visitData && visitData.lab_tests) {
            const labList = visitData.lab_tests.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
            labList.forEach(function(labName) {
                let itemPrice = 0;
                let displayName = labName;
                if (typeof getTestItemDetails === 'function') {
                    const details = getTestItemDetails(labName);
                    itemPrice = details.price || 0;
                    displayName = details.name || labName;
                } else {
                    const svcMatch = (window.servicesData || []).find(function(s) {
                        return s.name && (s.name.trim().toLowerCase() === labName.toLowerCase() || s.name.toLowerCase().includes(labName.toLowerCase()) || labName.toLowerCase().includes(s.name.toLowerCase()));
                    });
                    itemPrice = svcMatch ? parseFloat(svcMatch.price || 0) : 0;
                    displayName = svcMatch ? svcMatch.name : labName;
                }
                items.push({ type: 'lab', name: displayName, price: itemPrice, qty: 1 });
                itemsTotal += itemPrice;
            });
        }
        // ไม่รวมรายการยา / อาหารเสริม (meds) เข้ามาในบิลระบบ Bill (คิดเฉพาะรายการตรวจ)

        const billId = generateId('BILL');
        let currentUser = '-';
        try { const u = JSON.parse(localStorage.getItem('clinicUser') || '{}'); currentUser = u.full_name || u.email || '-'; } catch(e) {}
        const subtotal = opts.subtotal !== undefined ? parseFloat(opts.subtotal) : itemsTotal;
        const discount = opts.discount !== undefined ? parseFloat(opts.discount) : parseFloat((visitData && (visitData.discount || visitData.lab_discount)) || 0);
        const payable = opts.payable_amount !== undefined ? parseFloat(opts.payable_amount) : Math.max(0, subtotal - discount);

        const bill = {
            bill_id: billId,
            visit_id: visitId,
            hn: opts.hn || (visitData && visitData.hn) || '',
            patient_name: opts.patientName || (visitData && visitData.patient_name) || '',
            items: items,
            subtotal: subtotal,
            discount: discount,
            payable_amount: payable,
            currency: opts.currency || (visitData && visitData.currency) || 'LAK',
            status: 'ชำระแล้ว',
            created_by: currentUser,
            created_at: new Date().toISOString(),
            note: opts.note || ''
        };

        window.allBillsData = window.allBillsData || [];
        window.allBillsData.unshift(bill);

        try {
            const { error } = await _supabase.from('bills').insert([bill]);
            if (error) console.warn('Bill insert warning:', error.message);
        } catch(e) { console.warn('Bill save fallback:', e); }

        console.log('Bill saved: ' + billId + ' for visit ' + visitId);
        return billId;
    } catch(err) {
        console.error('Error saving bill:', err);
        return null;
    }
}
window.saveBill = saveBill;

async function loadBills() {
    const tbody = document.getElementById('billsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังโหลดข้อมูลใบเสร็จ...</td></tr>';
    
    if (!window.servicesData || window.servicesData.length === 0) {
        try { if (typeof loadServicesData === 'function') await loadServicesData(); } catch(e) {}
    }

    let billsList = [];
    try {
        const { data, error } = await _supabase.from('bills').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
            billsList = data.map(b => {
                const labItems = (Array.isArray(b.items) ? b.items : []).filter(i => i.type !== 'med');
                return { ...b, items: labItems };
            });
        }
    } catch(e) {
        console.warn('Load bills Supabase error:', e);
    }

    // Fallback: ดึงข้อมูลจาก visits (เคสที่ชำระเงินแล้ว) มาแปลงเป็น bill เพิ่มเติมหากยังไม่มีใน bills
    try {
        const { data: visitData, error: vErr } = await _supabase
            .from('visits')
            .select('*')
            .in('status', ['รอผลแล็บ', 'อ่านผลแล้ว', 'รอจ่ายยา', 'สำเร็จ', 'เสร็จสิ้น'])
            .order('created_at', { ascending: false });

        if (!vErr && visitData && visitData.length > 0) {
            visitData.forEach(function(v) {
                const existingIndex = billsList.findIndex(b => b.visit_id === v.visit_id);
                if (existingIndex === -1) {
                    const items = [];
                    let itemsTotal = 0;
                    if (v.lab_tests) {
                        const labList = v.lab_tests.split(',').map(s => s.trim()).filter(Boolean);
                        labList.forEach(labName => {
                            let itemPrice = 0;
                            let displayName = labName;
                            if (typeof getTestItemDetails === 'function') {
                                const details = getTestItemDetails(labName);
                                itemPrice = details.price || 0;
                                displayName = details.name || labName;
                            } else {
                                const svcMatch = (window.servicesData || []).find(s =>
                                    s.name && (s.name.trim().toLowerCase() === labName.toLowerCase() ||
                                               s.name.toLowerCase().includes(labName.toLowerCase()) ||
                                               labName.toLowerCase().includes(s.name.toLowerCase()))
                                );
                                if (svcMatch) {
                                    itemPrice = parseFloat(svcMatch.price || 0);
                                    displayName = svcMatch.name;
                                }
                            }
                            items.push({ type: 'lab', name: displayName, price: itemPrice, qty: 1 });
                            itemsTotal += itemPrice;
                        });
                    }

                    const subtotal = itemsTotal;
                    const discount = parseFloat(v.discount || v.lab_discount || 0);
                    const payable = Math.max(0, subtotal - discount);

                    billsList.push({
                        bill_id: 'BILL-' + (v.visit_id || Math.floor(100000 + Math.random() * 900000)),
                        visit_id: v.visit_id,
                        hn: v.hn || '-',
                        patient_name: v.patient_name || '-',
                        items: items,
                        subtotal: subtotal,
                        discount: discount,
                        payable_amount: payable,
                        currency: v.currency || 'LAK',
                        status: 'ชำระแล้ว',
                        created_by: v.doctor_name || 'ระบบ',
                        created_at: v.created_at || new Date().toISOString(),
                        note: ''
                    });
                }
            });
        }
    } catch(err) {
        console.warn('Fallback visits fetch warning:', err);
    }

    window.allBillsData = billsList;
    renderBillsTable();
}
window.loadBills = loadBills;

function setBillDateFilter(type) {
    const startInput = document.getElementById('billStartDate');
    const endInput = document.getElementById('billEndDate');
    if (!startInput || !endInput) return;

    const today = new Date();
    const formatDate = function(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    if (type === 'today') {
        startInput.value = formatDate(today);
        endInput.value = formatDate(today);
    } else if (type === 'month') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        startInput.value = formatDate(firstDay);
        endInput.value = formatDate(today);
    } else {
        startInput.value = '';
        endInput.value = '';
    }
    renderBillsTable();
}
window.setBillDateFilter = setBillDateFilter;

function renderBillsTable() {
    const tbody = document.getElementById('billsTableBody');
    if (!tbody) return;

    const searchQ = ((document.getElementById('billSearchInput') || {}).value || '').toLowerCase().trim();
    const startVal = (document.getElementById('billStartDate') || {}).value || '';
    const endVal = (document.getElementById('billEndDate') || {}).value || '';
    const startDate = startVal ? new Date(startVal + 'T00:00:00') : null;
    const endDate = endVal ? new Date(endVal + 'T23:59:59') : null;

    let bills = (window.allBillsData || []).slice();

    if (startDate || endDate) {
        bills = bills.filter(function(b) {
            const d = b.created_at ? new Date(b.created_at) : null;
            if (!d) return true;
            if (startDate && d < startDate) return false;
            if (endDate && d > endDate) return false;
            return true;
        });
    }
    if (searchQ) {
        bills = bills.filter(function(b) {
            return (b.bill_id || '').toLowerCase().includes(searchQ) ||
                   (b.visit_id || '').toLowerCase().includes(searchQ) ||
                   (b.patient_name || '').toLowerCase().includes(searchQ) ||
                   (b.hn || '').toLowerCase().includes(searchQ);
        });
    }

    // Calculate totals for Stat Cards
    let grandSubtotal = 0;
    let grandDiscount = 0;
    let grandPayable = 0;

    tbody.innerHTML = '';
    if (bills.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-5"><i class="ph ph-receipt fs-2 text-primary opacity-25 d-block mb-2"></i>ไม่พบข้อมูลใบเสร็จรับเงินในระบบ</td></tr>';
        if (document.getElementById('billFooterCount')) document.getElementById('billFooterCount').textContent = '0';
        if (document.getElementById('billFooterTotal')) document.getElementById('billFooterTotal').textContent = '₭0';
        if (document.getElementById('billStatCount')) document.getElementById('billStatCount').textContent = '0';
        if (document.getElementById('billStatSubtotal')) document.getElementById('billStatSubtotal').textContent = '₭0';
        if (document.getElementById('billStatDiscount')) document.getElementById('billStatDiscount').textContent = '₭0';
        if (document.getElementById('billStatPayable')) document.getElementById('billStatPayable').textContent = '₭0';
        return;
    }

    bills.forEach(function(b, idx) {
        // คิดเฉพาะรายการตรวจ (กรองรายการยา/อาหารเสริมออก)
        let labItems = (Array.isArray(b.items) ? b.items : []).filter(item => item.type !== 'med');
        const itemCount = labItems.length;

        // คำนวณราคาแต่ละรายการตรวจและยอดรวมใหม่
        let itemsTotal = 0;
        labItems.forEach(function(item) {
            let price = parseFloat(item.price || 0);
            if (price === 0 && typeof getTestItemDetails === 'function') {
                const details = getTestItemDetails(item.name);
                if (details && details.price > 0) {
                    price = details.price;
                    item.price = price;
                }
            }
            itemsTotal += price * (parseInt(item.qty || 1));
        });

        let subtotal = itemsTotal;
        let discount = parseFloat(b.discount || 0);
        let payable = Math.max(0, subtotal - discount);

        b.items = labItems;
        b.subtotal = subtotal;
        b.payable_amount = payable;

        grandSubtotal += subtotal;
        grandDiscount += discount;
        grandPayable += payable;

        const d = b.created_at ? new Date(b.created_at) : null;
        const dateStr = d ? d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';
        const statusBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1"><i class="bi bi-check-circle-fill me-1"></i>' + (b.status || 'ชำระแล้ว') + '</span>';

        tbody.innerHTML += '<tr class="border-bottom">' +
            '<td class="ps-4 fw-bold text-muted" style="font-size:0.85rem;">' + (idx + 1) + '</td>' +
            '<td class="fw-bold text-primary" style="font-size:0.88rem;">' + (b.bill_id || '-') + '</td>' +
            '<td class="small text-secondary">' + (b.visit_id || '-') + '</td>' +
            '<td><div class="fw-bold text-dark">' + (b.patient_name || '-') + '</div><div class="text-muted extra-small">HN: ' + (b.hn || '-') + '</div></td>' +
            '<td class="text-center"><span class="badge bg-primary-subtle text-primary rounded-pill px-2.5 py-1" style="font-size:0.75rem;">' + itemCount + ' รายการ</span></td>' +
            '<td class="text-end fw-semibold text-secondary">' + subtotal.toLocaleString() + ' LAK</td>' +
            '<td class="text-end text-danger fw-medium">' + (discount > 0 ? '-' + discount.toLocaleString() : '-') + ' LAK</td>' +
            '<td class="text-end fw-bold text-success fs-6">' + payable.toLocaleString() + ' LAK</td>' +
            '<td class="text-center">' + statusBadge + '</td>' +
            '<td class="text-center small text-muted">' + dateStr + '</td>' +
            '<td class="text-center pe-4"><button class="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 fw-semibold" onclick="showBillDetails(\'' + b.bill_id + '\')"><i class="bi bi-eye me-1"></i><span data-i18n="details">' + (typeof t === 'function' ? t('details', 'รายละเอียด') : 'รายละเอียด') + '</span></button></td>' +
            '</tr>';
    });

    // Update Stat Cards & Footer
    if (document.getElementById('billStatCount')) document.getElementById('billStatCount').textContent = bills.length.toLocaleString();
    if (document.getElementById('billStatSubtotal')) document.getElementById('billStatSubtotal').textContent = '₭' + grandSubtotal.toLocaleString();
    if (document.getElementById('billStatDiscount')) document.getElementById('billStatDiscount').textContent = '₭' + grandDiscount.toLocaleString();
    if (document.getElementById('billStatPayable')) document.getElementById('billStatPayable').textContent = '₭' + grandPayable.toLocaleString();

    if (document.getElementById('billFooterCount')) document.getElementById('billFooterCount').textContent = bills.length.toLocaleString();
    if (document.getElementById('billFooterTotal')) document.getElementById('billFooterTotal').textContent = '₭' + grandPayable.toLocaleString();
}
window.renderBillsTable = renderBillsTable;


function showBillDetails(billId) {
    const bill = (window.allBillsData || []).find(function(b) { return b.bill_id === billId; });
    if (!bill) { Swal.fire('ไม่พบข้อมูล', 'ไม่พบ Bill: ' + billId, 'warning'); return; }

    const subtitle = document.getElementById('billDetailSubtitle');
    if (subtitle) subtitle.textContent = 'Bill ID: ' + bill.bill_id + ' | Visit: ' + (bill.visit_id || '-') + ' | ' + (bill.created_at ? new Date(bill.created_at).toLocaleDateString('th-TH') : '-');

    // กรองเฉพาะรายการตรวจ (คิดเฉพาะ lab_tests ไม่เอารายการยา/อาหารเสริม)
    const items = (Array.isArray(bill.items) ? bill.items : []).filter(item => item.type !== 'med');
    let itemsTotal = 0;
    let itemsHtml = items.length > 0 ? items.map(function(item, i) {
        const typeBadge = '<span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="font-size:0.7rem;">ตรวจ</span>';
        let price = parseFloat(item.price || 0);
        if (price === 0 && typeof getTestItemDetails === 'function') {
            const details = getTestItemDetails(item.name);
            if (details && details.price > 0) {
                price = details.price;
                item.price = price;
            }
        }
        const qty = parseInt(item.qty || 1);
        const total = price * qty;
        itemsTotal += total;

        return '<tr class="' + (i % 2 === 0 ? 'bg-white' : 'bg-light') + ' border-bottom">' +
            '<td class="ps-3 py-2 text-muted fw-semibold" style="width:50px;">' + (i + 1) + '</td>' +
            '<td class="py-2"><div class="fw-semibold text-dark">' + (item.name || '-') + ' <span class="ms-1">' + typeBadge + '</span></div></td>' +
            '<td class="py-2 text-center text-muted">' + qty + '</td>' +
            '<td class="py-2 text-end fw-semibold text-primary">' + (price > 0 ? price.toLocaleString() + ' LAK' : '<span class="text-muted">-</span>') + '</td>' +
            '<td class="pe-3 py-2 text-end fw-bold text-dark">' + (total > 0 ? total.toLocaleString() + ' LAK' : '<span class="text-muted">-</span>') + '</td>' +
            '</tr>';
    }).join('') : '<tr><td colspan="5" class="text-center text-muted py-3">ไม่มีรายการตรวจ</td></tr>';

    const subtotal = itemsTotal;
    const discount = parseFloat(bill.discount || 0);
    const payable = Math.max(0, subtotal - discount);

    bill.subtotal = subtotal;
    bill.payable_amount = payable;

    const bodyHtml = '<div class="p-3 mb-3 rounded-3 bg-light border d-flex justify-content-between align-items-start flex-wrap gap-2">' +
        '<div><div class="small text-muted mb-1">ชื่อ-นามสกุล: <strong class="text-dark">' + (bill.patient_name || '-') + '</strong></div>' +
        '<div class="small text-muted">HN: <strong class="text-secondary">' + (bill.hn || '-') + '</strong></div>' +
        '<div class="small text-muted">เจ้าหน้าที่: <strong class="text-secondary">' + (bill.created_by || '-') + '</strong></div></div>' +
        '<div class="text-end"><div class="small text-muted mb-1">Bill ID: <strong class="text-primary">' + bill.bill_id + '</strong></div>' +
        '<div class="small text-muted">Visit: <strong>' + (bill.visit_id || '-') + '</strong></div>' +
        '<div class="small text-muted">วันที่: <strong>' + (bill.created_at ? new Date(bill.created_at).toLocaleDateString('th-TH') : '-') + '</strong></div></div></div>' +
        '<div class="table-responsive rounded-3 border mb-3" style="max-height:320px;overflow-y:auto;">' +
        '<table class="table table-sm table-borderless mb-0 align-middle">' +
        '<thead class="bg-light border-bottom sticky-top"><tr class="small fw-bold text-secondary">' +
        '<th class="ps-3 py-2" style="width:50px;">#</th><th class="py-2">รายการตรวจ</th>' +
        '<th class="py-2 text-center" style="width:70px;">จำนวน</th>' +
        '<th class="py-2 text-end" style="width:130px;">ราคา/หน่วย</th>' +
        '<th class="pe-3 py-2 text-end" style="width:130px;">รวม</th></tr></thead>' +
        '<tbody>' + itemsHtml + '</tbody></table></div>' +
        '<div class="p-3 rounded-3 bg-light border">' +
        '<div class="d-flex justify-content-between mb-2"><span class="text-secondary fw-semibold small">ยอดรวมค่าตรวจ</span><span class="fw-bold text-dark">' + subtotal.toLocaleString() + ' LAK</span></div>' +
        (discount > 0 ? '<div class="d-flex justify-content-between mb-2 text-danger"><span class="fw-semibold small">ส่วนลด</span><span class="fw-bold">-' + discount.toLocaleString() + ' LAK</span></div>' : '') +
        '<hr class="my-2 opacity-25"><div class="d-flex justify-content-between"><span class="fw-bold text-dark">ยอดสุทธิ</span><span class="fw-bold text-primary fs-5">' + payable.toLocaleString() + ' LAK</span></div></div>' +
        (bill.note ? '<div class="mt-2 p-2 rounded-2 border bg-warning-subtle small text-warning-emphasis"><i class="bi bi-sticky me-1"></i>' + bill.note + '</div>' : '');

    const bodyEl = document.getElementById('billDetailBody');
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    const printBtn = document.getElementById('billPrintBtn');
    if (printBtn) printBtn.setAttribute('onclick', 'printBill(\'' + billId + '\')');

    bootstrap.Modal.getOrCreateInstance(document.getElementById('billDetailModal')).show();
}
window.showBillDetails = showBillDetails;

function printBill(billId) {
    const bill = (window.allBillsData || []).find(function(b){ return b.bill_id === billId; });
    if (!bill) return;
    const items = Array.isArray(bill.items) ? bill.items : [];
    const subtotal = parseFloat(bill.subtotal || 0);
    const discount = parseFloat(bill.discount || 0);
    const payable = parseFloat(bill.payable_amount || 0);
    const thaiDate = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

    const itemsRows = items.map(function(item, i) {
        const price = parseFloat(item.price || 0);
        const qty = parseInt(item.qty || 1);
        const total = price * qty;
        return '<tr><td style="text-align:center;padding:8px 6px;">' + (i+1) + '</td>' +
            '<td style="padding:8px 6px;">' + (item.name || '-') + ' <span style="color:#94a3b8;font-size:11px;">(' + (item.type === 'med' ? 'ยา' : 'ตรวจ') + ')</span></td>' +
            '<td style="text-align:center;padding:8px 6px;">' + qty + '</td>' +
            '<td style="text-align:right;padding:8px 6px;">' + (price > 0 ? price.toLocaleString() : '-') + '</td>' +
            '<td style="text-align:right;padding:8px 6px;font-weight:700;">' + (total > 0 ? total.toLocaleString() : '-') + '</td></tr>';
    }).join('');

    const html = '<!DOCTYPE html><html><head><title>Bill ' + bill.bill_id + '</title><meta charset="UTF-8">' +
        '<style>@import url(\'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap\');' +
        '*{box-sizing:border-box;margin:0;padding:0;}body{font-family:\'Kanit\',sans-serif;color:#1e293b;padding:20px;}' +
        '.page{width:210mm;margin:0 auto;background:#fff;padding:15mm;}' +
        '.header{text-align:center;border-bottom:2px solid #0b3c73;padding-bottom:12px;margin-bottom:16px;}' +
        '.header h1{font-size:22px;color:#0b3c73;font-weight:700;margin-bottom:4px;}' +
        '.header p{font-size:13px;color:#64748b;}' +
        '.info-row{display:flex;justify-content:space-between;margin-bottom:12px;gap:10px;}' +
        '.info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;flex:1;}' +
        '.info-label{font-size:11px;color:#94a3b8;font-weight:600;margin-bottom:2px;}' +
        '.info-value{font-size:14px;font-weight:600;color:#1e293b;}' +
        'table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;}' +
        'thead th{background:#f1f5f9;padding:10px 6px;font-weight:700;color:#475569;border-bottom:2px solid #cbd5e1;}' +
        'tbody td{border-bottom:1px solid #e2e8f0;vertical-align:top;}' +
        '.summary{margin-left:auto;width:260px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;}' +
        '.sum-row{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;}' +
        '.sum-row.total{background:#0b3c73;color:#fff;font-size:16px;font-weight:700;border-bottom:none;}' +
        '.footer{margin-top:30px;display:flex;justify-content:space-between;text-align:center;font-size:12px;color:#94a3b8;}' +
        '.sig-line{border-top:1px dashed #cbd5e1;padding-top:6px;margin-top:50px;}' +
        '@media print{body{padding:0;}.page{box-shadow:none;padding:10mm;}}</style></head><body>' +
        '<div class="page"><div class="header"><h1>🏥 ใบเสร็จรับเงิน / Invoice</h1><p>พิมพ์วันที่ ' + thaiDate + '</p></div>' +
        '<div class="info-row">' +
        '<div class="info-box"><div class="info-label">ชื่อผู้ป่วย</div><div class="info-value">' + (bill.patient_name || '-') + '</div><div style="font-size:12px;color:#64748b;margin-top:2px;">HN: ' + (bill.hn || '-') + '</div></div>' +
        '<div class="info-box" style="text-align:right;max-width:220px;"><div class="info-label">Bill ID</div><div class="info-value" style="color:#0b3c73;">' + bill.bill_id + '</div><div style="font-size:12px;color:#64748b;margin-top:2px;">Visit: ' + (bill.visit_id || '-') + '</div></div></div>' +
        '<table><thead><tr><th style="width:45px;text-align:center;">#</th><th>รายการ</th><th style="width:60px;text-align:center;">จำนวน</th><th style="width:130px;text-align:right;">ราคา (LAK)</th><th style="width:130px;text-align:right;">รวม (LAK)</th></tr></thead>' +
        '<tbody>' + (itemsRows || '<tr><td colspan="5" style="text-align:center;padding:12px;color:#94a3b8;">ไม่มีรายการ</td></tr>') + '</tbody></table>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:8px;"><div class="summary">' +
        '<div class="sum-row"><span>ยอดรวม</span><span>' + subtotal.toLocaleString() + ' LAK</span></div>' +
        (discount > 0 ? '<div class="sum-row" style="color:#dc2626;"><span>ส่วนลด</span><span>-' + discount.toLocaleString() + ' LAK</span></div>' : '') +
        '<div class="sum-row total"><span>ยอดสุทธิ</span><span>' + payable.toLocaleString() + ' LAK</span></div></div></div>' +
        '<div class="footer"><div style="width:200px;"><div class="sig-line">( ผู้ชำระเงิน )</div></div><div style="width:200px;"><div class="sig-line">( เจ้าหน้าที่การเงิน )</div></div></div>' +
        '</div><script>window.onload=function(){window.print();};<\/script></body></html>';

    const win = window.open('', '_blank', 'width=850,height=950');
    if (win) { win.document.write(html); win.document.close(); }
}
window.printBill = printBill;

function getFilteredBillsData() {
    const searchQ = ((document.getElementById('billSearchInput') || {}).value || '').toLowerCase().trim();
    const startVal = (document.getElementById('billStartDate') || {}).value || '';
    const endVal = (document.getElementById('billEndDate') || {}).value || '';
    const startDate = startVal ? new Date(startVal + 'T00:00:00') : null;
    const endDate = endVal ? new Date(endVal + 'T23:59:59') : null;

    let bills = (window.allBillsData || []).slice();

    if (startDate || endDate) {
        bills = bills.filter(function(b) {
            const d = b.created_at ? new Date(b.created_at) : null;
            if (!d) return true;
            if (startDate && d < startDate) return false;
            if (endDate && d > endDate) return false;
            return true;
        });
    }
    if (searchQ) {
        bills = bills.filter(function(b) {
            return (b.bill_id || '').toLowerCase().includes(searchQ) ||
                   (b.visit_id || '').toLowerCase().includes(searchQ) ||
                   (b.patient_name || '').toLowerCase().includes(searchQ) ||
                   (b.hn || '').toLowerCase().includes(searchQ);
        });
    }
    return bills;
}
window.getFilteredBillsData = getFilteredBillsData;

function exportBillsExcel() {
    const bills = getFilteredBillsData();
    if (!bills || bills.length === 0) {
        Swal.fire({ icon: 'warning', title: 'ไม่มีข้อมูล', text: 'ไม่พบข้อมูลใบเสร็จสำหรับส่งออก Excel' });
        return;
    }

    const startVal = document.getElementById('billStartDate')?.value || '';
    const endVal = document.getElementById('billEndDate')?.value || '';
    const dateRangeStr = (startVal || endVal) ? `_${startVal}_ถึง_${endVal}` : '';

    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel
    csvContent += "ลำดับ,Bill ID,Visit ID,ชื่อผู้ป่วย,HN,จำนวนรายการตรวจ,รายการตรวจ,ยอดบริการ (LAK),ส่วนลด (LAK),ยอดสุทธิ (LAK),สถานะ,วันที่บันทึก,เจ้าหน้าที่\n";

    bills.forEach((b, idx) => {
        const labItems = (Array.isArray(b.items) ? b.items : []).filter(i => i.type !== 'med');
        const itemNames = labItems.map(i => i.name).join('; ');
        const subtotal = parseFloat(b.subtotal || 0);
        const discount = parseFloat(b.discount || 0);
        const payable = parseFloat(b.payable_amount || (subtotal - discount));
        const dateStr = b.created_at ? new Date(b.created_at).toLocaleString('th-TH') : '-';

        const billId = `"${(b.bill_id || '').replace(/"/g, '""')}"`;
        const visitId = `"${(b.visit_id || '').replace(/"/g, '""')}"`;
        const patientName = `"${(b.patient_name || '').replace(/"/g, '""')}"`;
        const hn = `"${(b.hn || '').replace(/"/g, '""')}"`;
        const testList = `"${itemNames.replace(/"/g, '""')}"`;
        const status = `"${(b.status || 'ชำระแล้ว').replace(/"/g, '""')}"`;
        const creator = `"${(b.created_by || '-').replace(/"/g, '""')}"`;

        csvContent += `${idx + 1},${billId},${visitId},${patientName},${hn},${labItems.length},${testList},${subtotal},${discount},${payable},${status},"${dateStr}",${creator}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `รายงานใบเสร็จรับเงิน_Bill${dateRangeStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
window.exportBillsExcel = exportBillsExcel;

function exportBillsPDF() {
    printBillsReport();
}
window.exportBillsPDF = exportBillsPDF;

function printBillsReport() {
    const bills = getFilteredBillsData();
    if (!bills || bills.length === 0) {
        Swal.fire({ icon: 'warning', title: 'ไม่มีข้อมูล', text: 'ไม่พบข้อมูลใบเสร็จสำหรับพิมพ์รายงาน' });
        return;
    }

    const startVal = document.getElementById('billStartDate')?.value || 'ทั้งหมด';
    const endVal = document.getElementById('billEndDate')?.value || 'ทั้งหมด';
    const printDate = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    let grandSubtotal = 0;
    let grandDiscount = 0;
    let grandPayable = 0;

    const rowsHtml = bills.map((b, idx) => {
        const labItems = (Array.isArray(b.items) ? b.items : []).filter(i => i.type !== 'med');
        const itemNames = labItems.map(i => i.name).join(', ') || '-';
        const subtotal = parseFloat(b.subtotal || 0);
        const discount = parseFloat(b.discount || 0);
        const payable = parseFloat(b.payable_amount || (subtotal - discount));

        grandSubtotal += subtotal;
        grandDiscount += discount;
        grandPayable += payable;

        const d = b.created_at ? new Date(b.created_at) : null;
        const dateStr = d ? d.toLocaleDateString('th-TH') + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';

        return `<tr>
            <td style="text-align:center;padding:8px 6px;">${idx + 1}</td>
            <td style="font-weight:600;color:#0b3c73;padding:8px 6px;">${b.bill_id || '-'}</td>
            <td style="padding:8px 6px;color:#64748b;">${b.visit_id || '-'}</td>
            <td style="padding:8px 6px;"><strong>${b.patient_name || '-'}</strong><br><small style="color:#64748b;">HN: ${b.hn || '-'}</small></td>
            <td style="padding:8px 6px;font-size:12px;">${itemNames} (${labItems.length} รายการ)</td>
            <td style="text-align:right;padding:8px 6px;">${subtotal.toLocaleString()} LAK</td>
            <td style="text-align:right;padding:8px 6px;color:#dc2626;">${discount > 0 ? '-' + discount.toLocaleString() : '-'} LAK</td>
            <td style="text-align:right;padding:8px 6px;font-weight:700;color:#16a34a;">${payable.toLocaleString()} LAK</td>
            <td style="text-align:center;padding:8px 6px;"><span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">${b.status || 'ชำระแล้ว'}</span></td>
            <td style="text-align:center;padding:8px 6px;font-size:11px;color:#64748b;">${dateStr}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>รายงานประวัติใบเสร็จรับเงิน (Bill Summary Report)</title><meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Kanit',sans-serif;color:#1e293b;padding:20px;background:#f8fafc;}
        .page{width:297mm;margin:0 auto;background:#fff;padding:15mm;border-radius:8px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);}
        .header{text-align:center;border-bottom:2px solid #0b3c73;padding-bottom:12px;margin-bottom:16px;}
        .header h1{font-size:22px;color:#0b3c73;font-weight:700;margin-bottom:4px;}
        .header p{font-size:13px;color:#64748b;}
        .summary-bar{display:flex;justify-content:space-between;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;}
        .stat-item{display:flex;flex-direction:column;}
        .stat-label{font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;}
        .stat-val{font-size:16px;font-weight:700;color:#0f172a;}
        table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px;}
        thead th{background:#0b3c73;color:#fff;padding:8px 6px;font-weight:600;border:1px solid #0b3c73;}
        tbody td{border:1px solid #e2e8f0;vertical-align:middle;}
        tbody tr:nth-child(even){background:#f8fafc;}
        .footer{margin-top:40px;display:flex;justify-content:space-between;text-align:center;font-size:12px;color:#64748b;}
        .sig-box{width:220px;}
        .sig-line{border-top:1px dashed #94a3b8;margin-top:50px;padding-top:4px;}
        @media print{
            body{padding:0;background:#fff;}
            .page{box-shadow:none;padding:5mm;width:100%;}
            @page{size: A4 landscape; margin: 10mm;}
        }
    </style></head><body>
    <div class="page">
        <div class="header">
            <h1>🏥 รายงานประวัติการออกใบเสร็จรับเงิน (Bill Summary Report)</h1>
            <p>ข้อมูลวันที่พิมพ์: ${printDate} | ช่วงวันที่: ${startVal} ถึง ${endVal}</p>
        </div>
        <div class="summary-bar">
            <div class="stat-item"><span class="stat-label">จำนวนบิลทั้งหมด</span><span class="stat-val">${bills.length.toLocaleString()} รายการ</span></div>
            <div class="stat-item"><span class="stat-label">ยอดรวมบริการ</span><span class="stat-val" style="color:#2563eb;">₭${grandSubtotal.toLocaleString()}</span></div>
            <div class="stat-item"><span class="stat-label">ส่วนลดรวม</span><span class="stat-val" style="color:#dc2626;">₭${grandDiscount.toLocaleString()}</span></div>
            <div class="stat-item"><span class="stat-label">ยอดรับสุทธิรวม</span><span class="stat-val" style="color:#16a34a;">₭${grandPayable.toLocaleString()}</span></div>
        </div>
        <table>
            <thead>
                <tr>
                    <th style="width:40px;">#</th>
                    <th style="width:130px;">Bill ID</th>
                    <th style="width:110px;">Visit ID</th>
                    <th style="width:160px;">ผู้ป่วย / HN</th>
                    <th>รายการตรวจ</th>
                    <th style="width:120px;text-align:right;">ยอดบริการ</th>
                    <th style="width:100px;text-align:right;">ส่วนลด</th>
                    <th style="width:130px;text-align:right;">ยอดสุทธิ</th>
                    <th style="width:90px;text-align:center;">สถานะ</th>
                    <th style="width:120px;text-align:center;">วันที่</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
        <div class="footer">
            <div class="sig-box"><div class="sig-line">ลงชื่อ......................................................<br>( เจ้าหน้าที่การเงิน / ผู้จัดทำ )</div></div>
            <div class="sig-box"><div class="sig-line">ลงชื่อ......................................................<br>( ผู้จัดการ / ผู้ตรวจสอบ )</div></div>
        </div>
    </div>
    <script>window.onload=function(){window.print();};<\/script>
    </body></html>`;

    const printWin = window.open('', '_blank');
    if (printWin) {
        printWin.document.write(html);
        printWin.document.close();
    }
}
window.printBillsReport = printBillsReport;
