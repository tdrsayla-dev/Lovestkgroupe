// ─────────────────────────────────────────────────────────────────────────────
// js/organization.js - Organization Structure Chart Rendering
// ─────────────────────────────────────────────────────────────────────────────

function createOrgCard(person) {
    let picUrl = getFuzzyValue(person, ['photos', 'photo', 'profile', 'รูป', 'pic', 'image']);
    let name = getFuzzyValue(person, ['first_name', 'name', 'ชื่อ', 'full_name', 'employee']);
    let lastName = getFuzzyValue(person, ['last_name', 'นามสกุล']);
    let fullName = name !== '-' ? (lastName !== '-' ? name + ' ' + lastName : name) : 'Unknown';

    let empId = getFuzzyValue(person, ['employee_id', 'emp_id', 'id']) || '';

    let cleanFullName = fullName;
    if (empId && cleanFullName.toUpperCase().includes(empId.toUpperCase())) {
        cleanFullName = cleanFullName.replace(new RegExp(empId, 'ig'), '').trim();
        if (cleanFullName.startsWith('-')) cleanFullName = cleanFullName.substring(1).trim();
    }

    let displayName = empId && cleanFullName === 'Unknown' ? empId : (empId ? empId + '<br>' + cleanFullName : cleanFullName);

    const colors = ['#0ea5e9', '#0d9488', '#16a34a', '#ea580c', '#c026d3', '#7c3aed', '#2563eb'];
    let hash = 0;
    for (let i = 0; i < cleanFullName.length; i++) {
        hash = cleanFullName.charCodeAt(i) + ((hash << 5) - hash);
    }
    let themeColor = colors[Math.abs(hash) % colors.length];

    const encodedName = encodeURIComponent(cleanFullName);
    const fallbackAvatar = `https://ui-avatars.com/api/?background=${themeColor.replace('#', '')}&color=ffffff&name=${encodedName}&size=100&bold=true`;

    if (picUrl && picUrl.includes('drive.google.com')) {
        let fileId = picUrl.includes('id=') ? picUrl.split('id=')[1].split('&')[0] : (picUrl.includes('/d/') ? picUrl.split('/d/')[1].split('/')[0] : '');
        if (fileId) picUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w200';
    }

    if (!picUrl || picUrl === '-' || picUrl.trim() === '') {
        picUrl = fallbackAvatar;
    }

    let position = getFuzzyValue(person, ['position', 'ตำแหน่ง', 'position_id']) || '-';
    let dept = getFuzzyValue(person, ['department_name', 'department', 'แผนก', 'department_id']) || '';
    let displayPos = position;
    if (dept && dept !== '-' && !position.toLowerCase().includes(dept.toLowerCase())) {
        displayPos = `${position} - ${dept}`;
    }

    const rowId = getRecordId(person);
    const encodedPerson = encodeURIComponent(JSON.stringify(person)).replace(/'/g, "%27");

    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let role = 'Staff';
    if (sessionStr) { try { let s = JSON.parse(sessionStr); role = s.role || 'Staff'; } catch (e) { } }

    return `
            <div class="inline-flex flex-col items-center group relative cursor-pointer mx-4 mt-2" onclick="showEmployeeProfile('${encodedPerson}')">
                
                ${role !== 'Staff' ? `
                <div class="absolute -top-4 -right-4 bg-white rounded-lg shadow-md border border-gray-100 p-1 flex space-x-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()">
                    <button onclick="openFormModal('${encodedPerson}')" class="text-blue-600 hover:bg-blue-50 w-6 h-6 rounded-md flex items-center justify-center transition-colors"><i class="fa-solid fa-pen-to-square text-[10px]"></i></button>
                    <button onclick="deleteRecord('${rowId}')" class="text-red-500 hover:bg-red-50 w-6 h-6 rounded-md flex items-center justify-center transition-colors"><i class="fa-solid fa-trash text-[10px]"></i></button>
                </div>` : ''}

                <div class="absolute -top-2 left-1/2 transform -translate-x-1/2 w-2.5 h-2.5 rounded-full z-30" style="background-color: ${themeColor};"></div>

                <div class="w-36 h-36 rounded-full p-[6px] z-20 relative shadow-[0_10px_20px_-5px_rgba(0,0,0,0.15)] group-hover:shadow-[0_15px_25px_-5px_rgba(0,0,0,0.25)] transition-all duration-300 group-hover:-translate-y-1" style="background: ${themeColor};">
                    
                    <div class="w-full h-full bg-white rounded-full flex flex-col items-center justify-center shadow-inner p-3 relative overflow-hidden">
                        
                        <div class="w-10 h-10 rounded-full border border-gray-100 mb-1.5 overflow-hidden shrink-0 bg-gray-50">
                            <img src="${picUrl}" alt="${cleanFullName}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='${fallbackAvatar}'">
                        </div>
                        
                        <h3 class="font-bold text-[10px] text-gray-800 leading-tight w-full text-center line-clamp-2" title="${displayName}">${displayName}</h3>
                        
                        <div class="w-4 h-[1px] my-1 opacity-60" style="background-color: ${themeColor};"></div>
                        
                        <p class="text-[8px] font-bold text-gray-500 uppercase tracking-widest truncate w-full text-center" title="${displayPos}">${displayPos}</p>
                    </div>
                </div>
            </div>`;
}

/* =====================================================================
 * 📌 ส่วนที่ 16: ORGANIZATION CHART (ฟังก์ชันแผนผังองค์กร)
 * ===================================================================== */
function renderOrgChart(data) {
    const orgWrapper = document.getElementById('org-chart-wrapper');

    ['table-controls-wrapper', 'table-wrapper', 'card-wrapper', 'table-summary', 'calendar-section'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    orgWrapper.classList.remove('hidden');

    if (!data || data.length === 0) {
        orgWrapper.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-gray-500 mt-10"><i class="fa-solid fa-sitemap text-5xl mb-4 text-gray-300"></i><p class="font-medium">No organizational data available.</p></div>';
        return;
    }

    let ceos = [], clevels = [];
    let depts = {};

    data.forEach(emp => {
        let status = String(getFuzzyValue(emp, ['status', 'สถานะ'])).toLowerCase();
        if (status.includes('inactive') || status.includes('ลาออก') || status.includes('พ้นสภาพ')) return;

        let pos = String(getFuzzyValue(emp, ['position', 'ตำแหน่ง', 'position_id'])).toLowerCase();
        let dept = String(getFuzzyValue(emp, ['department_name', 'department', 'แผนก', 'department_id']) || 'General').toUpperCase().trim();

        if (pos.includes('ceo') || pos.includes('ประธาน') || pos.includes('md') || pos.includes('managing')) {
            ceos.push(emp);
        } else if (pos.includes('cfo') || pos.includes('coo') || pos.includes('cto') || pos.includes('cmo') || pos.includes('director') || pos.includes('ผู้อำนวยการ') || pos.includes('ผู้บริหาร') || pos.includes('c-level')) {
            clevels.push(emp);
        } else {
            if (!depts[dept]) depts[dept] = { managers: [], heads: [], staffs: [] };
            if (pos.includes('manager') || pos.includes('ผู้จัดการ') || pos.includes('mgr')) {
                depts[dept].managers.push(emp);
            } else if (pos.includes('head') || pos.includes('หัวหน้า') || pos.includes('lead') || pos.includes('supervisor')) {
                depts[dept].heads.push(emp);
            } else {
                depts[dept].staffs.push(emp);
            }
        }
    });

    let deptBranchesHtml = '';

    Object.keys(depts).sort().forEach(deptName => {
        let d = depts[deptName];
        let staffHtml = d.staffs.length > 0 ? `<ul><li><div class="flex justify-center gap-4">${d.staffs.map(e => createOrgCard(e)).join('')}</div></li></ul>` : '';
        let headHtml = d.heads.length > 0 ? `<ul><li><div class="flex justify-center gap-4">${d.heads.map(e => createOrgCard(e)).join('')}</div>${staffHtml}</li></ul>` : staffHtml;

        let branchLi = '';
        if (d.managers.length > 0) {
            branchLi = `<li><div class="flex justify-center gap-4">${d.managers.map(e => createOrgCard(e)).join('')}</div>${headHtml}</li>`;
        } else if (d.heads.length > 0) {
            branchLi = `<li><div class="flex justify-center gap-4">${d.heads.map(e => createOrgCard(e)).join('')}</div>${staffHtml}</li>`;
        } else if (d.staffs.length > 0) {
            branchLi = `<li><div class="flex justify-center gap-4">${d.staffs.map(e => createOrgCard(e)).join('')}</div></li>`;
        }
        deptBranchesHtml += branchLi;
    });

    let deptsUl = deptBranchesHtml ? `<ul>${deptBranchesHtml}</ul>` : '';

    let clevelHtml = '';
    if (clevels.length > 0) {
        clevelHtml = `<ul><li><div class="flex justify-center gap-6 relative z-10">${clevels.map(e => createOrgCard(e)).join('')}</div>${deptsUl}</li></ul>`;
    } else {
        clevelHtml = deptsUl;
    }

    let finalHtml = '';
    if (ceos.length > 0) {
        finalHtml = `<ul><li><div class="flex justify-center gap-6 relative z-10">${ceos.map(e => createOrgCard(e)).join('')}</div>${clevelHtml}</li></ul>`;
    } else {
        finalHtml = clevelHtml;
    }

    let styles = `<style>
                .org-tree * { margin: 0; padding: 0; box-sizing: border-box; }
                .org-tree { display: flex; justify-content: center; width: 100%; overflow-x: auto; padding-bottom: 50px; }
                .org-tree ul { padding-top: 25px; position: relative; transition: all 0.5s; display: flex; justify-content: center; white-space: nowrap; }
                .org-tree li { float: left; text-align: center; list-style-type: none; position: relative; padding: 25px 5px 0 5px; transition: all 0.5s; }
                
                .org-tree li::before, .org-tree li::after { content: ''; position: absolute; top: 0; right: 50%; border-top: 1.5px solid #0284c7; width: 50%; height: 25px; }
                .org-tree li::after { right: auto; left: 50%; border-left: 1.5px solid #0284c7; }
                
                .org-tree li:only-child::after, .org-tree li:only-child::before { display: none; }
                .org-tree li:only-child { padding-top: 0; }
                
                .org-tree li:first-child::before, .org-tree li:last-child::after { border: 0 none; }
                
                .org-tree li:last-child::before { border-right: 1.5px solid #0284c7; border-radius: 0 8px 0 0; }
                .org-tree li:first-child::after { border-radius: 8px 0 0 0; }
                
                .org-tree ul ul::before { content: ''; position: absolute; top: 0; left: 50%; border-left: 1.5px solid #0284c7; width: 0; height: 25px; transform: translateX(-50%); }
            </style>`;

    orgWrapper.innerHTML = styles + '<div class="org-tree inline-block min-w-max pt-10">' + finalHtml + '</div>';
}
