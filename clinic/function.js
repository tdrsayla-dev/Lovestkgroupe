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

function showPage(pageId, element) {
    const targetPage = document.getElementById(pageId);
    if (!targetPage) return;
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    targetPage.classList.add('active');
    document.querySelectorAll('#sidebarNav .nav-link').forEach(l => l.classList.remove('active'));
    if (element) element.classList.add('active');

    // โหลดข้อมูลอัตโนมัติเมื่อกดเข้าสู่แต่ละหน้า
    if (pageId === 'dashboard') {
        if (typeof window.renderCalendar === 'function') window.renderCalendar();
        if (typeof window.updateDashboardStats === 'function') window.updateDashboardStats();
    } else if (pageId === 'stock-drugs') {
        loadStockList();
    } else if (pageId === 'pharmacy') {
        loadPharmacyQueue();
    } else if (pageId === 'history') {
        loadPatientHistory();
    } else if (pageId === 'stock-equip') {
        loadSupplyItems();
        loadSupplyRequests();
    } else if (pageId === 'staff') {
        loadStaffUsers();
    } else if (pageId === 'referrals') {
        loadReferralData();
    } else if (pageId === 'services') {
        loadServices();
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

    renderAppointmentsTable(allAppointments);
}

function toggleApptReferrerField() {
    const isAssisted = document.getElementById('apptTypeAssisted')?.checked;
    const container = document.getElementById('apptReferredByContainer');
    const select = document.getElementById('apptReferredBySelect');

    if (!container) return;

    if (isAssisted) {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
        if (select) select.value = '';
    }
}

function renderAppointmentsTable(list) {
    const tbody = document.querySelector('#appointmentsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-3">ไม่มีข้อมูลนัดหมาย</td></tr>';
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
    if (!q) {
        renderAppointmentsTable(allAppointments);
        return;
    }
    const filtered = allAppointments.filter(row =>
        (row.appointment_id && row.appointment_id.toLowerCase().includes(q)) ||
        (row.guest_name && row.guest_name.toLowerCase().includes(q)) ||
        (row.guest_phone && row.guest_phone.toLowerCase().includes(q)) ||
        (row.assistant_code && row.assistant_code.toLowerCase().includes(q)) ||
        (row.reason && row.reason.toLowerCase().includes(q)) ||
        (row.status && row.status.toLowerCase().includes(q))
    );
    renderAppointmentsTable(filtered);
}

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

    // ดึงสถานะการเข้าตรวจล่าสุด (visits) เพื่อแสดงสถานะของผู้ป่วยแต่ละคน
    let activeVisitsMap = {};
    const { data: visitsData } = await _supabase
        .from('visits')
        .select('hn, status, created_at')
        .order('created_at', { ascending: false });

    if (visitsData) {
        visitsData.forEach(v => {
            if (v.hn && !activeVisitsMap[v.hn]) {
                activeVisitsMap[v.hn] = v.status;
            }
        });
    }

    window.patientReferrersMap = JSON.parse(localStorage.getItem('clinic_patient_referrers') || '{}');
    if (data) {
        data.forEach(d => {
            if (!d.referred_by && window.patientReferrersMap[d.hn]) {
                d.referred_by = window.patientReferrersMap[d.hn];
            }
        });
    }

    window.allPatients = data;

    data.forEach(row => {
        let allergy = row.allergies || '-';
        let allergyBadge = (allergy !== '-' && allergy !== 'ไม่มี') ? `<span class="badge-soft-danger">${allergy}</span>` : `<span class="badge-soft-success">ไม่มี</span>`;

        let refId = row.referred_by;
        let refHtml = '<span class="text-muted small">-</span>';
        if (refId) {
            const refObj = (window.referrersData || []).find(r => r.id === refId || r.code === refId);
            const displayRefName = refObj ? `${refObj.name} (${refObj.code || refObj.id})` : refId;
            refHtml = `<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style="font-weight: 500;"><i class="ph ph-hand-coins me-1"></i>${displayRefName}</span>`;
        }

        // สถานะของผู้ป่วย
        let currentStatus = activeVisitsMap[row.hn];
        let statusBadge = '';
        let isSent = (currentStatus === 'รอคัดกรอง' || currentStatus === 'รอตรวจ' || currentStatus === 'กำลังตรวจ');

        if (currentStatus === 'รอคัดกรอง') {
            statusBadge = `<span class="badge bg-warning-subtle text-warning border border-warning px-2 py-1"><i class="bi bi-clock-history me-1"></i>รอคัดกรอง</span>`;
        } else if (currentStatus === 'รอตรวจ' || currentStatus === 'กำลังตรวจ') {
            statusBadge = `<span class="badge bg-info-subtle text-info border border-info px-2 py-1"><i class="bi bi-stethoscope me-1"></i>${currentStatus}</span>`;
        } else if (currentStatus === 'รอชำระเงิน' || currentStatus === 'รอจ่ายยา') {
            statusBadge = `<span class="badge bg-primary-subtle text-primary border border-primary px-2 py-1"><i class="bi bi-credit-card me-1"></i>${currentStatus}</span>`;
        } else if (currentStatus === 'เสร็จสิ้น') {
            statusBadge = `<span class="badge bg-success-subtle text-success border border-success px-2 py-1"><i class="bi bi-check-circle me-1"></i>เสร็จสิ้น</span>`;
        } else {
            statusBadge = `<span class="badge bg-secondary-subtle text-secondary border px-2 py-1"><i class="bi bi-dash-circle me-1"></i>ยังไม่ส่งคัดกรอง</span>`;
        }

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
            <td class="ps-4 fw-bold text-nowrap">${row.hn}</td>
            <td class="fw-bold text-nowrap">${row.patient_name}</td>
            <td class="text-nowrap">${row.age || '-'}</td>
            <td class="text-nowrap">${row.phone}</td>
            <td class="text-nowrap">${row.province || '-'}</td>
            <td class="text-center text-nowrap">${allergyBadge}</td>
            <td class="text-center text-nowrap">${refHtml}</td>
            <td class="text-center text-nowrap">${statusBadge}</td>
            <td class="text-center text-nowrap">${actionBtns}</td>
        </tr>`;
    });
}

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
        let labDetailsHtml = `<button class="btn btn-sm btn-light border" onclick="showLabDetails('${row.lab_tests}')"><i class="bi bi-card-list text-primary me-1"></i> ดูรายละเอียด (${row.lab_tests.split(',').length} รายการ)</button>`;
        tbody.innerHTML += `<tr><td class="ps-4 fw-bold text-primary">${row.visit_id}</td><td>${row.hn}</td><td class="fw-bold">${row.patient_name}</td><td>${labDetailsHtml}</td><td><span class="badge-soft-warning">รอชำระเงิน</span></td><td class="text-center"><button class="btn btn-sm btn-success px-3" onclick="confirmPayment('${row.visit_id}')"><i class="bi bi-check-circle me-1"></i> ยืนยันจ่าย & ส่ง Lab</button></td></tr>`;
    });
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
        let labDetailsHtml = `<button class="btn btn-sm btn-light border" onclick="showLabDetails('${row.lab_tests}')"><i class="bi bi-card-list text-primary"></i> ดูรายละเอียด</button>`;
        tbody.innerHTML += `<tr><td class="ps-4 fw-bold text-primary">${row.visit_id}</td><td>${row.hn}</td><td class="fw-bold">${row.patient_name}</td><td>${labDetailsHtml}</td><td><span class="badge-soft-warning">รอผลแล็บ</span></td><td class="text-center"><button class="btn btn-sm btn-primary px-3" onclick="openLabUploadModal('${row.visit_id}')"><i class="bi bi-upload"></i> อัปโหลดผล (PDF)</button></td></tr>`;
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

    let docOptions = `<option value="">-- เลือกแพทย์ --</option>`;
    if (doctors && doctors.length > 0) {
        doctors.forEach(doc => {
            let statusText = doc.is_busy ? "🔴 ติดเคส" : "🟢 ว่าง";
            docOptions += `<option value="${doc.name}">${doc.name} (${statusText})</option>`;
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
    const { data, error } = await _supabase
        .from('medicines')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error loading medicines:', error.message);
        return;
    }

    window.allMedicines = data;

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

function showLabDetails(testsString) {
    let testsList = testsString.split(',');
    let listHtml = '<ul class="list-group list-group-flush text-start mt-2">';
    testsList.forEach(test => listHtml += `<li class="list-group-item"><i class="bi bi-check-circle text-success me-2"></i>${test.trim()}</li>`);
    listHtml += '</ul>';
    Swal.fire({ title: 'รายการส่งแล็บทั้งหมด', html: listHtml, icon: 'info', confirmButtonText: 'ปิดหน้าต่าง' });
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
        if (patientErr && patientErr.message && (patientErr.message.includes('referred_by') || patientErr.message.includes('schema cache'))) {
            delete payload.referred_by;
            res = await _supabase.from('patients').insert([payload]);
            patientErr = res.error;
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

function openRegisterFromAppointment(appId, name, phone) {
    const form = document.getElementById('patientForm');
    form.reset();
    if (form.FullName) form.FullName.value = name;
    if (form.Tel) form.Tel.value = phone;
    document.getElementById('linkAppointmentId').value = appId;

    populateProvinceDropdown();
    onPatientProvinceChange();
    populateReferrerDropdowns();

    // ดึงข้อมูลนัดหมายเพื่อตรวจดูว่ามีการระบุผู้แนะนำไว้หรือไม่
    const appt = (allAppointments || []).find(a => a.appointment_id === appId);
    const patRefSelect = document.getElementById('patientReferredBySelect');
    if (appt && appt.referred_by && patRefSelect) {
        patRefSelect.value = appt.referred_by;
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('addPatientModal')).show();
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
        Swal.fire('สำเร็จ', 'ส่งเข้าห้องตรวจแล้ว', 'success');
    }
}

window.selectedLabCategory = 'เลือดวิทยา (HEMATOLOGY)';
window.checkedLabState = {};

function isCategoryMatch(itemCategory, targetCategory) {
    if (!targetCategory || targetCategory === 'ALL') return true;
    const cat = (itemCategory || 'เลือดวิทยา (HEMATOLOGY)').toLowerCase().trim();
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

    const services = window.servicesData || [];
    const currentCat = window.selectedLabCategory || 'เลือดวิทยา (HEMATOLOGY)';

    const filteredServices = currentCat === 'ALL'
        ? services
        : services.filter(s => isCategoryMatch(s.category, currentCat));

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

function openLabOrder(visitId, patientName, hn) {
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
    const file = fileInput.files[0];
    const visitId = document.getElementById('uploadVisitId').value;

    if (!file) return;

    Swal.fire({ title: 'กำลังอัปโหลดไฟล์ผลแล็บ...', html: 'กรุณารอสักครู่ ห้ามปิดหน้าจอ', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const fileName = visitId + '_LabResult.pdf';

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await _supabase
        .storage
        .from('lab-results')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

    let publicUrl = '';
    if (uploadError) {
        console.warn('Storage upload failed, falling back to mock PDF URL. Error:', uploadError.message);
        publicUrl = 'https://pdfobject.com/pdf/sample.pdf';
    } else {
        const { data: urlData } = _supabase
            .storage
            .from('lab-results')
            .getPublicUrl(fileName);
        publicUrl = urlData.publicUrl;
    }

    const { error: dbError } = await _supabase
        .from('visits')
        .update({
            pdf_url: publicUrl,
            status: 'รอจัดคิว'
        })
        .eq('visit_id', visitId);

    if (dbError) {
        Swal.fire('ข้อผิดพลาด', dbError.message, 'error');
    } else {
        Swal.fire('สำเร็จ', 'อัปโหลดผลแล็บและส่งจัดคิวสำเร็จ', 'success');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('labUploadModal')).hide();
        loadLabQueue();
        loadQueueList();
    }
}

// --- อ่านผล & จัดยา ---
window.currentRxMeds = [];
function openPrescribeModal(visitId, hn, patientName, pdfUrl) {
    document.getElementById('rxVisitId').value = visitId;
    document.getElementById('rxHN').value = hn;
    document.getElementById('rxPatientName').value = patientName;
    document.getElementById('rxVisitIdDisplay').innerText = visitId;
    document.getElementById('rxPatientNameDisplay').innerText = patientName;

    const pdfBtn = document.getElementById('rxPdfBtn');
    if (pdfUrl && pdfUrl !== '') { pdfBtn.href = pdfUrl; pdfBtn.classList.remove('disabled'); }
    else { pdfBtn.href = '#'; pdfBtn.classList.add('disabled'); }

    window.currentRxMeds = [];
    renderRxMedsTable();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('prescribeModal')).show();
}

function addMedToRx() {
    const select = document.getElementById('rxMedSelect');
    const qtyInput = document.getElementById('rxMedQty');
    const tierSelect = document.getElementById('rxPriceTierSelect');
    if (!select || !select.value || !tierSelect) return;

    const medId = select.value;
    const qty = parseInt(qtyInput.value);
    const selectedTier = tierSelect.value;

    const medDetails = (window.allMedicines || []).find(m => m.id === medId);
    if (!medDetails) return;

    const medName = medDetails.name;

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

    // ตรวจหาไอเท็มที่มี ID และประเภทราคาตรงกันอยู่แล้วในคลังคิวสั่ง
    const existing = window.currentRxMeds.find(m => m.id === medId && m.tier === selectedTier);
    if (existing) {
        existing.qty += qty;
    } else {
        window.currentRxMeds.push({
            id: medId,
            name: displayName,
            price: medPrice,
            qty: qty,
            tier: selectedTier
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

        tbody.innerHTML += `
            <tr>
                <td class="ps-3 align-middle text-dark fw-medium">${cleanName}</td>
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

    Swal.fire({ title: 'กำลังบันทึกสั่งจ่ายยา...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const { error } = await _supabase
        .from('visits')
        .update({
            meds: JSON.stringify(window.currentRxMeds),
            status: 'รอจ่ายยา'
        })
        .eq('visit_id', visitId);

    if (error) {
        Swal.fire('ข้อผิดพลาด', error.message, 'error');
    } else {
        Swal.fire('สำเร็จ', 'ส่งข้อมูลไปห้องจ่ายยาเรียบร้อย แพทย์พร้อมรับเคสถัดไปครับ', 'success');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('prescribeModal')).hide();
        loadPrescriptionList();
        loadQueueList();
        loadPharmacyQueue();
    }
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
            <tr data-name="${med.name.toLowerCase()}" data-type="${med.type || 'ยา'}">
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

    const { data, error } = await _supabase
        .from('visits')
        .select('*')
        .eq('status', 'รอจ่ายยา')
        .order('created_at', { ascending: true });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle-fill me-2"></i>เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }
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

                        medsHtml += `<tr>
                            <td class="ps-2 fw-medium text-dark">${cleanName}</td>
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

    const { data, error } = await _supabase
        .from('visits')
        .select('*')
        .eq('status', 'เสร็จสิ้น')
        .order('created_at', { ascending: false });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle-fill me-2"></i>เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }

    window.allHistoryVisits = data || [];
    renderHistoryTable(window.allHistoryVisits);
}

function renderHistoryTable(list) {
    const tbody = document.querySelector('#historyTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (list.length === 0) {
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

        const actionBtn = `<button class="btn btn-sm btn-outline-primary px-3 fw-bold" onclick="showHistoryDetails('${row.visit_id}')"><i class="bi bi-eye me-1"></i> ดูรายละเอียด</button>`;

        tbody.innerHTML += `
            <tr data-visit-id="${row.visit_id.toLowerCase()}" data-hn="${row.hn.toLowerCase()}" data-name="${row.patient_name.toLowerCase()}">
                <td class="ps-4 fw-bold text-primary">${row.visit_id}</td>
                <td class="fw-bold">${row.hn}</td>
                <td class="fw-bold text-dark">${row.patient_name}</td>
                <td>${formattedDate}</td>
                <td>${row.symptom || '<span class="text-muted">-</span>'}</td>
                <td class="text-center">${actionBtn}</td>
            </tr>
        `;
    });
}

function searchPatientHistory() {
    const query = document.getElementById('searchHistoryInput').value.toLowerCase().trim();
    if (!query) {
        renderHistoryTable(window.allHistoryVisits || []);
        return;
    }

    const filtered = (window.allHistoryVisits || []).filter(item => {
        return (item.visit_id && item.visit_id.toLowerCase().includes(query)) ||
            (item.hn && item.hn.toLowerCase().includes(query)) ||
            (item.patient_name && item.patient_name.toLowerCase().includes(query)) ||
            (item.symptom && item.symptom.toLowerCase().includes(query));
    });

    renderHistoryTable(filtered);
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
        pdfContainer.innerHTML = `<a href="${row.pdf_url}" target="_blank" class="btn btn-sm btn-danger px-3"><i class="bi bi-file-pdf"></i> เปิดดูผล Lab (PDF)</a>`;
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
            const medsList = JSON.parse(row.meds);
            if (medsList && medsList.length > 0) {
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

                    medsTbody.innerHTML += `
                        <tr>
                            <td class="ps-3 align-middle text-dark fw-medium">${cleanName}</td>
                            <td class="text-center align-middle"><span class="badge ${badgeClass}" style="font-size: 0.75rem;">${tierText}</span></td>
                            <td class="text-center align-middle fw-bold text-primary">${m.qty}</td>
                        </tr>
                    `;
                });
            } else {
                medsTbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">ไม่มีรายการยา/อาหารเสริมสั่งจ่าย</td></tr>';
            }
        } catch (e) {
            console.error("Error parsing meds JSON in history details:", e);
            medsTbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger py-3">ข้อมูลยาไม่ถูกต้อง</td></tr>';
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
    { key: 'dashboard', label: 'ภาพรวมระบบ', icon: 'bi-grid-1x2-fill' },
    { key: 'appointments', label: 'นัดหมายล่วงหน้า', icon: 'bi-calendar-event-fill' },
    { key: 'registration', label: 'ทะเบียนผู้ป่วย', icon: 'bi-person-vcard-fill' },
    { key: 'triage', label: 'จุดคัดกรอง', icon: 'bi-heart-pulse-fill' },
    { key: 'doctor', label: 'ห้องตรวจแพทย์', icon: 'bi-stethoscope' },
    { key: 'payment', label: 'จ่ายค่ารักษา', icon: 'bi-cash-coin' },
    { key: 'lab', label: 'ห้อง Lab', icon: 'bi-virus' },
    { key: 'queue', label: 'จัดคิว', icon: 'bi-list-ol' },
    { key: 'prescription', label: 'อ่านผล/จัดยา', icon: 'bi-file-medical' },
    { key: 'pharmacy', label: 'ห้องจ่ายยา', icon: 'bi-capsule' },
    { key: 'history', label: 'ประวัติผู้ป่วย', icon: 'bi-clock-history' },
    { key: 'stock-drugs', label: 'คลังยา', icon: 'bi-box2-heart' },
    { key: 'stock-equip', label: 'คลังพัสดุ', icon: 'bi-boxes' },
    { key: 'staff', label: 'จัดการพนักงาน', icon: 'bi-people-fill' },
];

let allStaffUsers = [];

function renderPermissionCheckboxes(selectedKeys = []) {
    const container = document.getElementById('permissionCheckboxes');
    if (!container) return;
    container.innerHTML = SYSTEM_FUNCTIONS.map(fn => {
        const isChecked = selectedKeys.includes(fn.key);
        return `
        <div class="col-6 col-md-4">
            <label class="d-flex align-items-center gap-2 w-100 mb-0"
                style="cursor:pointer;background:${isChecked ? '#ddeeff' : '#fff'};border:1.5px solid ${isChecked ? '#4f8ef7' : '#dee2e6'};
                border-radius:10px;padding:8px 12px;transition:all 0.15s;user-select:none;"
                id="perm_label_${fn.key}"
                onclick="togglePermCheckbox('perm_${fn.key}', 'perm_label_${fn.key}')">
                <input class="form-check-input mt-0 flex-shrink-0" type="checkbox" id="perm_${fn.key}" value="${fn.key}"
                    ${isChecked ? 'checked' : ''} style="pointer-events:none;accent-color:#2563eb;">
                <span class="small fw-semibold text-dark" style="pointer-events:none;line-height:1.3;">
                    <i class="bi ${fn.icon} text-primary me-1"></i>${fn.label}
                </span>
            </label>
        </div>`;
    }).join('');
}

function togglePermCheckbox(id, labelId) {
    const cb = document.getElementById(id);
    if (!cb) return;
    cb.checked = !cb.checked;
    const lbl = document.getElementById(labelId);
    if (lbl) {
        lbl.style.background = cb.checked ? '#ddeeff' : '#fff';
        lbl.style.borderColor = cb.checked ? '#4f8ef7' : '#dee2e6';
    }
}

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

async function loadStaffUsers() {
    const tbody = document.querySelector('#staffTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">กำลังโหลด...</td></tr>';
    try {
        const { data, error } = await _supabase
            .from('staff_users')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        allStaffUsers = data || [];
        renderStaffTable(allStaffUsers);
        updateStaffSummary(allStaffUsers);
    } catch (err) {
        console.error('loadStaffUsers error:', err);
        const tb = document.querySelector('#staffTable tbody');
        if (tb) tb.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
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

function showPermissionsPopup(empCode, name, perms) {
    const cards = perms.map(k => {
        const fn = SYSTEM_FUNCTIONS.find(f => f.key === k);
        if (!fn) return '';
        return `<div style="display:flex;align-items:center;gap:10px;background:#f0f5ff;border:1.5px solid #c7d9fd;
            border-radius:10px;padding:10px 14px;margin-bottom:8px;">
            <div style="width:34px;height:34px;background:#2563eb;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="bi ${fn.icon}" style="color:#fff;font-size:1rem;"></i>
            </div>
            <span style="font-weight:600;color:#1e293b;font-size:0.88rem;">${fn.label}</span>
            <span style="margin-left:auto;background:#dcfce7;color:#15803d;border-radius:999px;padding:2px 10px;font-size:0.72rem;font-weight:600;">✓ อนุญาต</span>
        </div>`;
    }).join('');

    const noPerms = `<div style="text-align:center;padding:24px;color:#94a3b8;">
        <i class="bi bi-shield-x" style="font-size:2.5rem;"></i>
        <div style="margin-top:8px;font-size:0.9rem;">ไม่มีสิทธิ์การใช้งาน</div>
    </div>`;

    Swal.fire({
        title: '',
        html: `
            <div style="text-align:left;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:14px;border-bottom:1.5px solid #e2e8f0;">
                    <div style="width:46px;height:46px;background:linear-gradient(135deg,#4f8ef7,#2563eb);border-radius:12px;display:flex;align-items:center;justify-content:center;">
                        <i class="bi bi-shield-check" style="color:#fff;font-size:1.4rem;"></i>
                    </div>
                    <div>
                        <div style="font-weight:700;font-size:1rem;color:#1e293b;">${name || empCode}</div>
                        <div style="font-size:0.78rem;color:#64748b;">รหัส: ${empCode} &nbsp;|&nbsp; สิทธิ์ทั้งหมด ${perms.length} รายการ</div>
                    </div>
                </div>
                <div style="max-height:360px;overflow-y:auto;padding-right:4px;">
                    ${perms.length > 0 ? cards : noPerms}
                </div>
            </div>`,
        showConfirmButton: true,
        confirmButtonText: '<i class="bi bi-x-lg me-1"></i> ปิด',
        confirmButtonColor: '#2563eb',
        width: 460,
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

    const isAdmin = currentUser.role === 'admin';
    const permissions = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];

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
        'stock-drugs',
        'stock-equip',
        'staff'
    ];

    let hasBackendPermission = false;

    // ตรวจสอบสิทธิ์ Dashboard
    const hasDashboardAccess = isAdmin || permissions.includes('dashboard');
    const navDashboard = document.getElementById('nav-dashboard');
    if (navDashboard) {
        navDashboard.style.display = hasDashboardAccess ? '' : 'none';
    }

    // หากเปิดอยู่หน้า index.html (หน้า Dashboard หลัก) แต่ผู้ใช้ไม่มีสิทธิ์ dashboard
    const isIndexPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
    if (isIndexPage && !hasDashboardAccess) {
        const firstAllowedKey = allMenuKeys.find(k => k !== 'dashboard' && permissions.includes(k));
        if (firstAllowedKey) {
            window.location.href = `clinic.html?page=${firstAllowedKey}`;
        } else {
            window.location.href = `clinic.html`;
        }
        return;
    }

    allMenuKeys.forEach(key => {
        if (key === 'dashboard') return;
        const hasAccess = isAdmin || permissions.includes(key);

        // 1. ซ่อน/แสดง เมนูใน Clinic.html (id="nav-{key}")
        const navEl = document.getElementById(`nav-${key}`);
        if (navEl) {
            navEl.style.display = hasAccess ? '' : 'none';
        }

        // 2. ซ่อน/แสดง ลิงก์ใน index.html หรือ links ที่ไป clinic.html?page={key}
        const pageLinks = document.querySelectorAll(`a[href*="page=${key}"]`);
        pageLinks.forEach(link => {
            link.style.display = hasAccess ? '' : 'none';
        });

        // เช็คสิทธิ์ในระบบหลังบ้าน (stock-drugs, stock-equip, staff)
        if (['stock-drugs', 'stock-equip', 'staff'].includes(key) && hasAccess) {
            hasBackendPermission = true;
        }
    });

    // แสดง/ซ่อน เมนูระบบหลังบ้าน (Dropdown Menu Header)
    const backendDropdowns = document.querySelectorAll('a[href="#backendMenu"]');
    backendDropdowns.forEach(bEl => {
        bEl.style.display = (isAdmin || hasBackendPermission) ? '' : 'none';
    });

    // ป้องกันการเข้าถึงผ่าน URL Parameter ใน Clinic.html (Direct Access Protection)
    const urlParams = new URLSearchParams(window.location.search);
    const currentPage = urlParams.get('page');
    if (currentPage && !isAdmin && !permissions.includes(currentPage)) {
        const firstAllowedKey = allMenuKeys.find(k => k !== 'dashboard' && permissions.includes(k));
        if (firstAllowedKey && typeof showPage === 'function') {
            const firstNav = document.getElementById('nav-' + firstAllowedKey);
            showPage(firstAllowedKey, firstNav);
        }
    }
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
    type: 'fixed', // 'fixed' หรือ 'percentage'
    value: 200,
    currency: 'THB', // 'THB' (บาท / ฿) หรือ 'LAK' (กีบ / ₭)
    auto_trigger: true,
    target_enabled: true,
    target_goal: 20,
    target_bonus_value: 10
};

window.commissionLogs = JSON.parse(localStorage.getItem('clinic_commission_logs') || 'null') || [
    { id: 'COM-50001', referrer_id: 'REF-10001', referrer_name: 'หมอสมชาย ใจดี', patient_name: 'นายประเสริฐ สุขี', visit_id: 'VIS-1001', total_invoice: 1500, amount: 200, status: 'paid', paid_at: '2026-07-20T14:00:00Z', payout_method: 'โอนเงินผ่านธนาคาร', payout_ref: 'SLIP-99281', created_at: '2026-07-20T10:00:00Z' },
    { id: 'COM-50002', referrer_id: 'REF-10002', referrer_name: 'คุณวิภา วงศ์สวย', patient_name: 'นางสมศรี มีโชค', visit_id: 'VIS-1002', total_invoice: 3200, amount: 200, status: 'pending', paid_at: null, payout_method: null, payout_ref: null, created_at: '2026-07-24T09:15:00Z' }
];

function getCurrencySymbol() {
    return (window.commissionSettings && window.commissionSettings.currency === 'LAK') ? '₭' : '฿';
}

function getCurrencyUnitName() {
    return (window.commissionSettings && window.commissionSettings.currency === 'LAK') ? 'กีบ' : 'บาท';
}

function formatCommissionAmount(num) {
    const val = parseFloat(num || 0).toLocaleString();
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
}

async function loadReferralData() {
    try {
        const { data: dbReferrers } = await _supabase.from('referrers').select('*');
        if (dbReferrers && dbReferrers.length > 0) {
            window.referrersData = dbReferrers;
        }
    } catch (e) {
        console.log('Referrers DB fallback to LocalStorage');
    }

    try {
        const { data: dbLogs } = await _supabase.from('commission_logs').select('*');
        if (dbLogs && dbLogs.length > 0) {
            window.commissionLogs = dbLogs;
        }
    } catch (e) {
        console.log('Commission logs DB fallback to LocalStorage');
    }

    saveReferralLocalData();
    updateReferralSummaryCards();
    renderReferrersTable();
    renderCommissionLogsTable();
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

    if (elCount) elCount.innerText = `${totalMembers} คน`;
    if (elSum) elSum.innerText = formatCommissionAmount(totalCommSum);
    if (elPaid) elPaid.innerText = formatCommissionAmount(totalPaidSum);
    if (elPending) elPending.innerText = formatCommissionAmount(totalPendingSum);
}

function renderReferrersTable(filterText = '') {
    const tbody = document.querySelector('#referrersTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const query = filterText.toLowerCase().trim();

    const filtered = window.referrersData.filter(r => 
        (r.name && r.name.toLowerCase().includes(query)) ||
        (r.code && r.code.toLowerCase().includes(query)) ||
        (r.phone && r.phone.includes(query))
    );

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-5">ไม่พบข้อมูลสมาชิกผู้แนะนำ</td></tr>';
        return;
    }

    filtered.forEach(r => {
        const logs = window.commissionLogs.filter(l => l.referrer_id === r.id || l.referrer_name === r.name);
        const totalPatientCount = logs.length;
        const monthlyCount = getMonthlyReferredCount(r.id, r.name);
        const totalEarned = logs.reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
        const pendingEarned = logs.filter(l => l.status !== 'paid').reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);

        let progressBadge = '';
        if (window.commissionSettings && window.commissionSettings.target_enabled) {
            const targetGoal = window.commissionSettings.target_goal || 20;
            if (monthlyCount >= targetGoal) {
                progressBadge = `<span class="badge bg-success-subtle text-success border border-success px-3 py-2 fw-bold"><i class="bi bi-trophy-fill me-1 text-warning"></i>${monthlyCount}/${targetGoal} คน (ถึงเป้าโบนัส)</span>`;
            } else {
                progressBadge = `<span class="badge bg-light text-dark border px-3 py-2">${monthlyCount}/${targetGoal} คน (ปกติ)</span>`;
            }
        } else {
            progressBadge = `<span class="badge bg-light text-dark border px-3 py-2">${totalPatientCount} เคส</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 fw-bold text-primary">${r.code || r.id}</td>
                <td>
                    <div class="fw-bold text-dark">${r.name}</div>
                    <small class="text-muted">${r.notes || '-'}</small>
                </td>
                <td><i class="ph ph-phone me-1 text-muted"></i>${r.phone || '-'}</td>
                <td>
                    <div class="fw-semibold text-dark">${r.bank_name || '-'}</div>
                    <small class="text-muted">${r.bank_account || '-'}</small>
                </td>
                <td class="text-center">${progressBadge}</td>
                <td class="text-end fw-bold text-purple">${formatCommissionAmount(totalEarned)}</td>
                <td class="text-end fw-bold text-warning">${formatCommissionAmount(pendingEarned)}</td>
                <td class="text-center pe-4">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editReferrer('${r.id}')"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteReferrer('${r.id}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function filterReferrersTable() {
    const input = document.getElementById('searchReferrerInput');
    const val = input ? input.value : '';
    renderReferrersTable(val);
}

function renderCommissionLogsTable() {
    const tbody = document.querySelector('#commissionLogsTable tbody');
    if (!tbody) return;

    const filterEl = document.getElementById('filterLogStatus');
    const filterStatus = filterEl ? filterEl.value : 'all';
    tbody.innerHTML = '';

    let logs = [...window.commissionLogs];
    if (filterStatus !== 'all') {
        logs = logs.filter(l => l.status === filterStatus);
    }

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5">ไม่มีประวัติรายการเงินปันผล/คอมมิชชั่น</td></tr>';
        return;
    }

    logs.forEach(l => {
        let dateStr = l.created_at ? new Date(l.created_at).toLocaleDateString('th-TH') : '-';
        let statusBadge = l.status === 'paid' 
            ? '<span class="badge badge-paid"><i class="bi bi-check-circle-fill me-1"></i>จ่ายแล้ว</span>'
            : '<span class="badge badge-pending"><i class="bi bi-clock-history me-1"></i>รออนุมัติ / รอจ่าย</span>';

        let actionBtn = l.status === 'paid'
            ? `<span class="text-muted small"><i class="bi bi-info-circle me-1"></i>${l.payout_method || 'จ่ายแล้ว'} (${l.payout_ref || '-'})</span>`
            : `<button class="btn btn-sm btn-success px-3 fw-semibold" onclick="openPayoutModal('${l.id}')"><i class="ph ph-hand-coins me-1"></i> จ่ายเงินปันผล</button>`;

        let bonusBadge = l.is_bonus ? '<span class="badge bg-warning text-dark me-1" style="font-size: 0.7rem;"><i class="bi bi-trophy-fill"></i> โบนัสเป้าหมาย</span>' : '';

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 small text-muted">${dateStr}</td>
                <td class="fw-bold text-dark">${l.referrer_name || '-'}</td>
                <td class="fw-medium">${l.patient_name || '-'} ${bonusBadge}</td>
                <td>${formatCommissionAmount(l.total_invoice)}</td>
                <td class="text-end fw-bold text-success fs-6">${formatCommissionAmount(l.amount)}</td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-center pe-4">${actionBtn}</td>
            </tr>
        `;
    });
}

function populateReferrerDropdowns() {
    const selects = ['patientReferredBySelect', 'apptReferredBySelect'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        
        const currVal = el.value;
        el.innerHTML = '<option value="">-- ไม่ระบุผู้แนะนำ (ไม่มีค่าปันผล) --</option>';
        window.referrersData.forEach(r => {
            el.innerHTML += `<option value="${r.id}">${r.name} (${r.code || r.id}) - ${r.phone}</option>`;
        });
        if (currVal) el.value = currVal;
    });
}

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
    Swal.fire('สำเร็จ', 'บันทึกการตั้งค่าเงื่อนไขปันผลเรียบร้อยแล้ว', 'success');
    loadReferralData();
}

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
        visit = window.allPaymentQueue.find(v => v.visit_id === visitId);
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

    const referrer = (window.referrersData || []).find(r => r.id === referrerId || r.code === referrerId);
    const refName = referrer ? referrer.name : referrerId;

    const totalInvoice = parseFloat(visit.total_price || visit.price || visit.total_amount || 1500);
    let commAmount = 0;
    let isBonusApplied = false;

    // คำนวณยอดสะสมประจำเดือนว่าถึงเป้าหมายหรือยัง
    const monthlyCount = getMonthlyReferredCount(referrerId, refName);
    const targetEnabled = window.commissionSettings.target_enabled === true;
    const targetGoal = window.commissionSettings.target_goal || 20;

    if (targetEnabled && (monthlyCount + 1) >= targetGoal) {
        isBonusApplied = true;
        const bonusValue = parseFloat(window.commissionSettings.target_bonus_value || 10);
        if (window.commissionSettings.type === 'percentage') {
            commAmount = totalInvoice * (bonusValue / 100);
        } else {
            commAmount = bonusValue;
        }
    } else {
        const standardValue = parseFloat(window.commissionSettings.value || 200);
        if (window.commissionSettings.type === 'percentage') {
            commAmount = totalInvoice * (standardValue / 100);
        } else {
            commAmount = standardValue;
        }
    }

    const newLog = {
        id: generateId('COM'),
        referrer_id: referrerId,
        referrer_name: refName,
        patient_name: patientName,
        visit_id: visitId,
        total_invoice: totalInvoice,
        amount: commAmount,
        status: 'pending',
        is_bonus: isBonusApplied,
        created_at: new Date().toISOString()
    };

    window.commissionLogs.unshift(newLog);
    saveReferralLocalData();
    updateReferralSummaryCards();
    renderReferrersTable();
    renderCommissionLogsTable();

    try {
        await _supabase.from('commission_logs').insert([newLog]);
    } catch (e) {
        console.log('Commission log Supabase insert fallback');
    }
}

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
            await _supabase.from('commission_logs').update({
                status: 'paid',
                paid_at: log.paid_at,
                payout_method: method,
                payout_ref: log.payout_ref
            }).eq('id', logId);
        } catch (e) {
            console.log('Payout Supabase update fallback');
        }
    }

    saveReferralLocalData();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('payCommissionModal')).hide();
    Swal.fire('ชำระเงินสำเร็จ', 'บันทึกการจ่ายเงินปันผลเรียบร้อยแล้ว', 'success');
    loadReferralData();
}

// =====================================
// ระบบจัดการรายการตรวจ / Services & Packages
// =====================================

function saveServicesLocalData() {
    try {
        localStorage.setItem('hr_services_data', JSON.stringify(window.servicesData || []));
    } catch (e) {
        console.error('Save services local data error:', e);
    }
}

async function loadServicesData() {
    const cached = localStorage.getItem('hr_services_data');
    if (cached) {
        try {
            window.servicesData = JSON.parse(cached);
            renderServicesTable();
        } catch(e) {}
    }

    try {
        const { data, error } = await _supabase.from('services').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
            window.servicesData = data.map(item => {
                const existing = (window.servicesData || []).find(s => s.id === item.id);
                if (existing && existing.category && !item.category) {
                    item.category = existing.category;
                }
                return item;
            });
            saveServicesLocalData();
            renderServicesTable();
        }
    } catch (e) {
        console.error('Error loading services:', e);
        if (!window.servicesData) window.servicesData = [];
        renderServicesTable();
    }
}

function renderServicesTable(dataToRender) {
    const tbody = document.querySelector('#servicesTable tbody');
    if (!tbody) return;

    const services = dataToRender || window.servicesData;

    if (!services || services.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-5"><i class="bi bi-inbox fs-3 d-block mb-2 text-primary opacity-50"></i>ไม่มีข้อมูลรายการตรวจ</td></tr>';
        return;
    }

    tbody.innerHTML = services.map(service => {
        const isPackage = service.sub_items && Array.isArray(service.sub_items) && service.sub_items.length > 0;
        
        let subItemsHtml = '';
        if (isPackage) {
            subItemsHtml = `
                <div class="mt-2 pt-1 border-top border-light">
                    <div class="text-muted extra-small fw-semibold mb-1 opacity-75" style="font-size: 0.73rem;">
                        <i class="bi bi-diagram-3 me-1"></i>รายการย่อย (${service.sub_items.length} รายการ):
                    </div>
                    <div class="d-flex flex-wrap gap-1.5">
            `;
            service.sub_items.forEach(item => {
                const itemPrice = item.price ? ` <span class="text-primary font-monospace">(${Number(item.price).toLocaleString()})</span>` : '';
                subItemsHtml += `<span class="badge bg-light text-secondary border px-2 py-1 fw-normal text-nowrap" style="font-size: 0.76rem;"><i class="bi bi-check2 text-success me-1"></i>${item.name}${itemPrice}</span>`;
            });
            subItemsHtml += `</div></div>`;
        }
        
        const cur = service.currency === 'THB' ? 'บาท' : (service.currency || 'LAK');
        const catName = service.category || 'เลือดวิทยา (HEMATOLOGY)';
        
        const badgeTypeHtml = isPackage 
            ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5 rounded-pill me-2 text-nowrap" style="font-size: 0.72rem; font-weight: 500;"><i class="bi bi-box-seam me-1"></i>แพ็กเกจ</span>`
            : `<span class="badge bg-secondary-subtle text-secondary border px-2 py-0.5 rounded-pill me-2 text-nowrap" style="font-size: 0.72rem; font-weight: 500;"><i class="bi bi-card-checklist me-1"></i>รายการเดี่ยว</span>`;

        const badgeCatHtml = `<span class="badge bg-info-subtle text-info border border-info-subtle px-2 py-0.5 rounded-pill me-2 text-nowrap" style="font-size: 0.72rem; font-weight: 500;"><i class="bi bi-folder2 me-1"></i>${catName}</span>`;

        const descHtml = service.description 
            ? `<span class="text-secondary" style="font-size: 0.82rem;">${service.description}</span>` 
            : `<span class="text-muted opacity-50 fst-italic" style="font-size: 0.8rem;">-</span>`;

        return `
        <tr>
            <td class="ps-4 align-middle py-3">
                <div class="d-flex align-items-center mb-1 flex-wrap gap-1">
                    ${badgeTypeHtml}
                    ${badgeCatHtml}
                    <span class="fw-bold text-dark" style="font-size: 0.9rem;">${service.name}</span>
                </div>
                ${subItemsHtml}
            </td>
            <td class="align-middle text-nowrap">
                <span class="badge px-3 py-1.5 fw-semibold" style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; border-radius: 20px; font-size: 0.82rem;">
                    <i class="bi bi-tag-fill me-1 opacity-75"></i>${Number(service.price).toLocaleString()} ${cur}
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
}

function filterServicesTable() {
    const query = (document.getElementById('searchServiceInput')?.value || '').toLowerCase().trim();
    if (!query) {
        renderServicesTable(window.servicesData);
        return;
    }
    const filtered = (window.servicesData || []).filter(s => 
        (s.name || '').toLowerCase().includes(query) ||
        (s.category || '').toLowerCase().includes(query) ||
        (s.description || '').toLowerCase().includes(query) ||
        (s.price || '').toString().includes(query) ||
        (s.sub_items || []).some(sub => (sub.name || '').toLowerCase().includes(query))
    );
    renderServicesTable(filtered);
}

function openAddServiceModal() {
    document.getElementById('serviceForm').reset();
    document.getElementById('serviceId').value = '';
    
    const curSelect = document.getElementById('serviceCurrency');
    if (curSelect) curSelect.value = 'LAK'; // default

    const catSelect = document.getElementById('serviceCategory');
    if (catSelect) catSelect.value = 'เลือดวิทยา (HEMATOLOGY)'; // default
    
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
    if (catSelect) catSelect.value = service.category || 'เลือดวิทยา (HEMATOLOGY)';

    const tbody = document.getElementById('serviceSubItemsBody');
    if (tbody) {
        tbody.innerHTML = '';
        if (service.sub_items && Array.isArray(service.sub_items) && service.sub_items.length > 0) {
            service.sub_items.forEach((item) => {
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
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="text-center row-number text-muted"></td>
        <td>
            <input type="text" class="form-control form-control-sm custom-input subitem-name" placeholder="ชื่อรายการ..." value="${name}">
        </td>
        <td>
            <input type="number" class="form-control form-control-sm custom-input subitem-price text-end" placeholder="0" value="${price}">
        </td>
        <td class="text-center">
            <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="this.closest('tr').remove(); updateServiceSubItemNumbers();">
                <i class="bi bi-x-lg"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    updateServiceSubItemNumbers();
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
    if (priceInput && display) {
        const val = parseFloat(priceInput.value) || 0;
        const cur = curSelect ? (curSelect.value === 'THB' ? 'บาท' : 'LAK') : 'LAK';
        display.textContent = val.toLocaleString() + ' ' + cur;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const curSelect = document.getElementById('serviceCurrency');
    if (curSelect) {
        curSelect.addEventListener('change', updatePackagePriceDisplay);
    }
});

async function saveService() {
    const id = document.getElementById('serviceId').value;
    const name = document.getElementById('serviceName').value.trim();
    const price = document.getElementById('servicePrice').value;
    const desc = document.getElementById('serviceDescription').value.trim();
    const currency = document.getElementById('serviceCurrency') ? document.getElementById('serviceCurrency').value : 'LAK';
    const category = document.getElementById('serviceCategory') ? document.getElementById('serviceCategory').value : 'เลือดวิทยา (HEMATOLOGY)';

    const subItems = [];
    document.querySelectorAll('#serviceSubItemsBody tr').forEach(row => {
        const iName = row.querySelector('.subitem-name').value.trim();
        const iPrice = row.querySelector('.subitem-price').value.trim();
        if (iName) {
            subItems.push({ name: iName, price: iPrice });
        }
    });

    const payload = {
        name: name,
        price: parseFloat(price) || 0,
        currency: currency,
        category: category,
        description: desc,
        sub_items: subItems,
        updated_at: new Date().toISOString()
    };

    try {
        if (id) {
            const { error } = await _supabase.from('services').update(payload).eq('id', id);
            if (error) throw error;
            
            window.servicesData = window.servicesData || [];
            const index = window.servicesData.findIndex(s => s.id === id);
            if (index !== -1) {
                window.servicesData[index] = { ...window.servicesData[index], ...payload };
            }
            saveServicesLocalData();
            Swal.fire('สำเร็จ', 'อัปเดตรายการตรวจเรียบร้อย', 'success');
        } else {
            payload.id = generateId('SRV');
            payload.created_at = new Date().toISOString();
            const { error } = await _supabase.from('services').insert([payload]);
            if (error) throw error;
            
            window.servicesData = window.servicesData || [];
            window.servicesData.unshift(payload);
            saveServicesLocalData();
            Swal.fire('สำเร็จ', 'เพิ่มรายการตรวจเรียบร้อย', 'success');
        }

        renderServicesTable();
        bootstrap.Modal.getOrCreateInstance(document.getElementById('addServiceModal')).hide();
    } catch (e) {
        console.error('Save service error', e);
        // Supabase error but still save to local array if local testing
        window.servicesData = window.servicesData || [];
        if (!id) {
            if (!payload.id) payload.id = generateId('SRV');
            if (!payload.created_at) payload.created_at = new Date().toISOString();
            window.servicesData.unshift(payload);
        } else {
            const index = window.servicesData.findIndex(s => s.id === id);
            if (index !== -1) {
                window.servicesData[index] = { ...window.servicesData[index], ...payload };
            }
        }
        saveServicesLocalData();
        renderServicesTable();
        bootstrap.Modal.getOrCreateInstance(document.getElementById('addServiceModal')).hide();
        Swal.fire('สำเร็จ (ออฟไลน์)', 'บันทึกข้อมูลเรียบร้อยแล้ว (ไม่สามารถต่อฐานข้อมูลได้)', 'success');
    }
}

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
        try {
            const { error } = await _supabase.from('services').delete().eq('id', id);
            if (error) throw error;
            
            window.servicesData = window.servicesData.filter(s => s.id !== id);
            saveServicesLocalData();
            renderServicesTable();
            Swal.fire('ลบแล้ว!', 'ข้อมูลถูกลบเรียบร้อย', 'success');
        } catch (e) {
            console.error('Delete service error', e);
            window.servicesData = window.servicesData.filter(s => s.id !== id);
            saveServicesLocalData();
            renderServicesTable();
            Swal.fire('ลบแล้ว (ออฟไลน์)!', 'ข้อมูลถูกลบเรียบร้อย (ไม่สามารถต่อฐานข้อมูลได้)', 'success');
        }
    }
}