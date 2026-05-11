import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyASHshwFhuA_TOaSJv34B21JbhlBoimecg",
    authDomain: "todo-3d76e.firebaseapp.com",
    projectId: "todo-3d76e",
    storageBucket: "todo-3d76e.firebasestorage.app",
    messagingSenderId: "679016347673",
    appId: "1:679016347673:web:b2e2cee2cade51e8fa9288",
    measurementId: "G-F1HBKELYLE"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const statusEl = document.getElementById('status');

function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.className = 'status-bar' + (isError ? ' error' : '');
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(text));
    return d.innerHTML;
}

function normalizeUrl(val) {
    if (!val) return null;
    if (/^https?:\/\//i.test(val)) return val;
    return 'https://' + val;
}

function safeUrl(url) {
    if (!url) return null;
    try {
        const u = new URL(url);
        return (u.protocol === 'http:' || u.protocol === 'https:') ? url : null;
    } catch { return null; }
}

// ── Grocery List ─────────────────────────────────────────────────────

const GROCERY_CATEGORIES = [
    { value: 'fruit & veg',    label: 'Fruit & Veg'    },
    { value: 'meat & fish',    label: 'Meat & Fish'    },
    { value: 'dairy & eggs',   label: 'Dairy & Eggs'   },
    { value: 'bread & bakery', label: 'Bread & Bakery' },
    { value: 'frozen',         label: 'Frozen'         },
    { value: 'drinks',         label: 'Drinks'         },
    { value: 'snacks',         label: 'Snacks'         },
    { value: 'pantry',         label: 'Pantry'         },
    { value: 'cleaning',       label: 'Cleaning'       },
    { value: 'personal care',  label: 'Personal Care'  },
    { value: 'other',          label: 'Other'          },
];

function groceryCategoryOptions(selected = '') {
    return '<option value="">Category</option>' +
        GROCERY_CATEGORIES.map(c =>
            `<option value="${c.value}"${selected === c.value ? ' selected' : ''}>${c.label}</option>`
        ).join('');
}

let currentGroceries = [];
let editingGroceryId = null;

function renderGroceries(items) {
    const listEl  = document.getElementById('grocery-list');
    const countEl = document.getElementById('grocery-count');

    if (items.length === 0) {
        listEl.innerHTML = '<li class="empty-state">No items yet — add one below!</li>';
        countEl.textContent = '—';
        return;
    }

    const remaining = items.filter(i => !i.completed).length;
    countEl.textContent = remaining === 0 ? 'all done!' : `${remaining} left`;

    const groupMap = new Map();
    items.forEach(item => {
        const key = item.category?.trim().toLowerCase() || '';
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key).push(item);
    });

    const catOrder = GROCERY_CATEGORIES.map(c => c.value);
    const sortedKeys = [...groupMap.keys()]
        .filter(k => k !== '')
        .sort((a, b) => {
            const ia = catOrder.indexOf(a), ib = catOrder.indexOf(b);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return a.localeCompare(b);
        });
    if (groupMap.has('')) sortedKeys.push('');

    listEl.innerHTML = '';
    sortedKeys.forEach(key => {
        if (key !== '') {
            const header = document.createElement('li');
            header.className = 'category-header';
            header.textContent = GROCERY_CATEGORIES.find(c => c.value === key)?.label
                || key.replace(/\b\w/g, c => c.toUpperCase());
            listEl.appendChild(header);
        }

        groupMap.get(key).forEach(item => {
            const li = document.createElement('li');

            if (item.id === editingGroceryId) {
                li.className = 'item item-editing';
                li.innerHTML = `
                    <div class="edit-form">
                        <input type="text" class="add-input" id="edit-grocery-text" value="${escapeHtml(item.text)}" maxlength="200">
                        <select class="add-input" id="edit-grocery-category">${groceryCategoryOptions(item.category || '')}</select>
                        <div class="edit-actions">
                            <button class="edit-save-btn" data-id="${item.id}">Save</button>
                            <button class="edit-cancel-btn">Cancel</button>
                        </div>
                    </div>
                `;
            } else {
                li.className = 'item';
                li.innerHTML = `
                    <div class="item-checkbox ${item.completed ? 'checked' : ''}" data-id="${item.id}"></div>
                    <span class="item-text ${item.completed ? 'completed' : ''}">${escapeHtml(item.text)}</span>
                    <button class="item-edit" data-id="${item.id}" title="Edit">✎</button>
                    <button class="item-delete" data-id="${item.id}" title="Delete">×</button>
                `;
            }
            listEl.appendChild(li);
        });
    });
}

function setupGroceries() {
    const listEl = document.getElementById('grocery-list');
    const col    = collection(db, 'groceries');
    const q      = query(col, orderBy('createdAt', 'asc'));

    document.getElementById('grocery-category').innerHTML = groceryCategoryOptions();

    onSnapshot(q, snapshot => {
        currentGroceries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!editingGroceryId) renderGroceries(currentGroceries);
        setStatus('Synced ✓');
    }, err => {
        setStatus('Could not connect — check your Firebase config', true);
        console.error(err);
    });

    async function addItem() {
        const text     = document.getElementById('grocery-input').value.trim();
        const category = document.getElementById('grocery-category').value;
        if (!text) return;
        document.getElementById('grocery-input').value    = '';
        document.getElementById('grocery-category').value = '';
        try {
            await addDoc(col, { text, category, completed: false, createdAt: serverTimestamp() });
        } catch (e) {
            setStatus('Failed to save item', true);
            console.error(e);
        }
    }

    document.getElementById('grocery-add').addEventListener('click', addItem);
    document.getElementById('grocery-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') addItem();
    });

    listEl.addEventListener('keydown', e => {
        if (!editingGroceryId) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            listEl.querySelector('.edit-save-btn')?.click();
        }
        if (e.key === 'Escape') {
            editingGroceryId = null;
            renderGroceries(currentGroceries);
        }
    });

    listEl.addEventListener('click', async e => {
        const editBtn   = e.target.closest('.item-edit');
        const saveBtn   = e.target.closest('.edit-save-btn');
        const cancelBtn = e.target.closest('.edit-cancel-btn');
        const checkbox  = e.target.closest('.item-checkbox');
        const deleteBtn = e.target.closest('.item-delete');

        if (editBtn) {
            editingGroceryId = editBtn.dataset.id;
            renderGroceries(currentGroceries);
            setTimeout(() => document.getElementById('edit-grocery-text')?.focus(), 50);
            return;
        }

        if (saveBtn) {
            const text     = document.getElementById('edit-grocery-text').value.trim();
            const category = document.getElementById('edit-grocery-category').value;
            if (!text) return;
            try {
                await updateDoc(doc(db, 'groceries', saveBtn.dataset.id), { text, category });
                editingGroceryId = null;
                renderGroceries(currentGroceries);
            } catch (err) {
                setStatus('Failed to update item', true);
            }
            return;
        }

        if (cancelBtn) {
            editingGroceryId = null;
            renderGroceries(currentGroceries);
            return;
        }

        if (checkbox) {
            const isChecked = checkbox.classList.contains('checked');
            try {
                await updateDoc(doc(db, 'groceries', checkbox.dataset.id), { completed: !isChecked });
            } catch (err) {
                setStatus('Failed to update item', true);
            }
        }

        if (deleteBtn) {
            try {
                await deleteDoc(doc(db, 'groceries', deleteBtn.dataset.id));
            } catch (err) {
                setStatus('Failed to delete item', true);
            }
        }
    });
}

setupGroceries();

// ── To Do ────────────────────────────────────────────────────────────

const PRIORITY = {
    high: { cls: 'priority-high', label: 'High' },
    mid:  { cls: 'priority-mid',  label: 'Mid'  },
    low:  { cls: 'priority-low',  label: 'Low'  },
};

let editingTodoId = null;
let currentTodos  = [];

function renderTodos(items) {
    const listEl  = document.getElementById('todo-list');
    const countEl = document.getElementById('todo-count');

    if (items.length === 0) {
        listEl.innerHTML = '<li class="empty-state">No tasks yet — add one below!</li>';
        countEl.textContent = '—';
        return;
    }

    const remaining = items.filter(i => !i.completed).length;
    countEl.textContent = remaining === 0 ? 'all done!' : `${remaining} left`;

    listEl.innerHTML = '';
    items.forEach(item => {
        const li = document.createElement('li');

        if (item.id === editingTodoId) {
            li.className = 'item item-editing';
            li.innerHTML = `
                <div class="edit-form">
                    <input type="text" class="add-input" id="edit-todo-text" value="${escapeHtml(item.text)}" maxlength="200">
                    <div class="todo-edit-secondary">
                        <select class="add-input" id="edit-todo-priority">
                            <option value="">Priority</option>
                            <option value="high" ${item.priority === 'high' ? 'selected' : ''}>High</option>
                            <option value="mid" ${item.priority === 'mid' ? 'selected' : ''}>Mid</option>
                            <option value="low" ${item.priority === 'low' ? 'selected' : ''}>Low</option>
                        </select>
                        <label class="todo-needs-help-label">
                            <input type="checkbox" id="edit-todo-needs-help" ${item.needsHelp ? 'checked' : ''}>
                            <span>Needs help</span>
                        </label>
                    </div>
                    <div class="edit-actions">
                        <button class="edit-save-btn" data-id="${item.id}">Save</button>
                        <button class="edit-cancel-btn">Cancel</button>
                    </div>
                </div>
            `;
        } else {
            li.className = 'item';

            const pri = PRIORITY[item.priority];
            const priorityBadge = pri
                ? `<span class="todo-priority ${pri.cls}">${pri.label}</span>`
                : '';

            const metaParts = [];
            if (item.needsHelp) {
                metaParts.push(`<span class="todo-needs-help-meta">👥 Needs help</span>`);
            }
            const metaHtml = metaParts.length
                ? `<div class="todo-meta">${metaParts.join('')}</div>`
                : '';

            li.innerHTML = `
                <div class="item-checkbox ${item.completed ? 'checked' : ''}" data-id="${item.id}"></div>
                <div class="todo-content">
                    <span class="item-text ${item.completed ? 'completed' : ''}">${escapeHtml(item.text)}</span>
                    ${metaHtml}
                </div>
                ${priorityBadge}
                <button class="item-edit" data-id="${item.id}" title="Edit">✎</button>
                <button class="item-delete" data-id="${item.id}" title="Delete">×</button>
            `;
        }
        listEl.appendChild(li);
    });
}

function setupTodos() {
    const listEl = document.getElementById('todo-list');
    const col    = collection(db, 'todos');
    const q      = query(col, orderBy('createdAt', 'asc'));

    onSnapshot(q, snapshot => {
        currentTodos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!editingTodoId) renderTodos(currentTodos);
        setStatus('Synced ✓');
    }, err => {
        setStatus('Could not connect — check your Firebase config', true);
        console.error(err);
    });

    async function addItem() {
        const text      = document.getElementById('todo-input').value.trim();
        const priority  = document.getElementById('todo-priority').value;
        const needsHelp = document.getElementById('todo-needs-help').checked;
        if (!text) return;

        document.getElementById('todo-input').value        = '';
        document.getElementById('todo-priority').value     = '';
        document.getElementById('todo-needs-help').checked = false;

        try {
            await addDoc(col, {
                text,
                priority:  priority  || null,
                needsHelp: needsHelp,
                completed: false,
                createdAt: serverTimestamp()
            });
        } catch (e) {
            setStatus('Failed to save item', true);
            console.error(e);
        }
    }

    document.getElementById('todo-add').addEventListener('click', addItem);
    document.getElementById('todo-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') addItem();
    });

    listEl.addEventListener('keydown', e => {
        if (!editingTodoId) return;
        if (e.key === 'Enter' && e.target.tagName !== 'SELECT') {
            e.preventDefault();
            listEl.querySelector('.edit-save-btn')?.click();
        }
        if (e.key === 'Escape') {
            editingTodoId = null;
            renderTodos(currentTodos);
        }
    });

    listEl.addEventListener('click', async e => {
        const editBtn   = e.target.closest('.item-edit');
        const saveBtn   = e.target.closest('.edit-save-btn');
        const cancelBtn = e.target.closest('.edit-cancel-btn');
        const checkbox  = e.target.closest('.item-checkbox');
        const deleteBtn = e.target.closest('.item-delete');

        if (editBtn) {
            editingTodoId = editBtn.dataset.id;
            renderTodos(currentTodos);
            setTimeout(() => document.getElementById('edit-todo-text')?.focus(), 50);
            return;
        }

        if (saveBtn) {
            const text      = document.getElementById('edit-todo-text').value.trim();
            const priority  = document.getElementById('edit-todo-priority').value;
            const needsHelp = document.getElementById('edit-todo-needs-help').checked;
            if (!text) return;
            try {
                await updateDoc(doc(db, 'todos', saveBtn.dataset.id), {
                    text,
                    priority:  priority  || null,
                    needsHelp: needsHelp,
                });
                editingTodoId = null;
                renderTodos(currentTodos);
            } catch (err) {
                setStatus('Failed to update item', true);
            }
            return;
        }

        if (cancelBtn) {
            editingTodoId = null;
            renderTodos(currentTodos);
            return;
        }

        if (checkbox) {
            const isChecked = checkbox.classList.contains('checked');
            try {
                await updateDoc(doc(db, 'todos', checkbox.dataset.id), { completed: !isChecked });
            } catch (err) {
                setStatus('Failed to update item', true);
            }
        }

        if (deleteBtn) {
            try {
                await deleteDoc(doc(db, 'todos', deleteBtn.dataset.id));
            } catch (err) {
                setStatus('Failed to delete item', true);
            }
        }
    });
}

setupTodos();

// ── Someday List ─────────────────────────────────────────────────────

let currentProjects = [];
let editingProjectId = null;

function googleCalUrl(item) {
    const start = item.deadline.replace(/-/g, '');
    const [y, m, d] = item.deadline.split('-').map(Number);
    const nextDay = new Date(y, m - 1, d + 1);
    const end = `${nextDay.getFullYear()}${String(nextDay.getMonth() + 1).padStart(2, '0')}${String(nextDay.getDate()).padStart(2, '0')}`;
    const details = item.needsHelp ? 'Needs help' : '';
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(item.text)}&dates=${start}/${end}${details ? '&details=' + encodeURIComponent(details) : ''}`;
}

async function downloadICS(item) {
    const escICS = s => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

    const start = item.deadline.replace(/-/g, '');
    const [y, m, d] = item.deadline.split('-').map(Number);
    const nextDay = new Date(y, m - 1, d + 1);
    const end = `${nextDay.getFullYear()}${String(nextDay.getMonth() + 1).padStart(2, '0')}${String(nextDay.getDate()).padStart(2, '0')}`;
    const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'PRODID:-//MyList//Someday List//EN',
        'BEGIN:VEVENT',
        `UID:${item.id}@mylist`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${start}`,
        `DTEND;VALUE=DATE:${end}`,
        `SUMMARY:${escICS(item.text)}`,
        item.needsHelp ? 'DESCRIPTION:Needs help' : '',
        'END:VEVENT',
        'END:VCALENDAR',
    ].filter(Boolean).join('\r\n') + '\r\n';

    const filename = item.text.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '_') + '.ics';
    const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });

    // Chrome on iOS (CriOS): use its own download manager — gives a direct
    // "Open" button that hands the file to Calendar, unlike the Web Share API
    // which routes through Files with no obvious next step.
    const isChromeIOS = /CriOS/i.test(navigator.userAgent);

    if (!isChromeIOS && navigator.canShare) {
        const file = new File([blob], filename, { type: 'text/calendar' });
        if (navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: item.text });
            } catch (e) {
                if (e.name !== 'AbortError') console.error(e);
            }
            return;
        }
    }

    // Chrome iOS + desktop: standard download
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatDeadline(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderProjects(items) {
    const listEl  = document.getElementById('projects-list');
    const countEl = document.getElementById('projects-count');

    if (items.length === 0) {
        listEl.innerHTML = '<li class="empty-state">No projects yet — add one below!</li>';
        countEl.textContent = '—';
        return;
    }

    const remaining = items.filter(i => !i.completed).length;
    countEl.textContent = remaining === 0 ? 'all done!' : `${remaining} left`;

    const today = new Date().toISOString().slice(0, 10);

    listEl.innerHTML = '';
    items.forEach(item => {
        const li = document.createElement('li');

        if (item.id === editingProjectId) {
            li.className = 'item item-editing';
            li.innerHTML = `
                <div class="edit-form">
                    <input type="text" class="add-input" id="edit-project-text" value="${escapeHtml(item.text)}" maxlength="200">
                    <div class="project-edit-secondary">
                        <input type="date" class="add-input" id="edit-project-deadline" value="${item.deadline || ''}">
                        <label class="todo-needs-help-label">
                            <input type="checkbox" id="edit-project-needs-help" ${item.needsHelp ? 'checked' : ''}>
                            <span>Needs help</span>
                        </label>
                    </div>
                    <div class="edit-actions">
                        <button class="edit-save-btn" data-id="${item.id}">Save</button>
                        <button class="edit-cancel-btn">Cancel</button>
                    </div>
                </div>
            `;
        } else {
            li.className = 'item';

            const metaParts = [];
            if (item.deadline) {
                const overdue = item.deadline < today && !item.completed;
                metaParts.push(`<span class="project-deadline${overdue ? ' overdue' : ''}">📅 ${formatDeadline(item.deadline)}${overdue ? ' · overdue' : ''}</span>`);
            }
            if (item.needsHelp) {
                metaParts.push(`<span class="todo-needs-help-meta">👥 Needs help</span>`);
            }
            const metaHtml = metaParts.length
                ? `<div class="todo-meta">${metaParts.join('')}</div>`
                : '';

            const calBtns = item.deadline ? `
                <button class="item-cal" data-id="${item.id}" title="Add to Apple Calendar (.ics)">🗓</button>
                <button class="item-gcal" data-id="${item.id}" title="Add to Google Calendar">G</button>
            ` : '';

            li.innerHTML = `
                <div class="item-checkbox ${item.completed ? 'checked' : ''}" data-id="${item.id}"></div>
                <div class="todo-content">
                    <span class="item-text ${item.completed ? 'completed' : ''}">${escapeHtml(item.text)}</span>
                    ${metaHtml}
                </div>
                ${calBtns}
                <button class="item-edit" data-id="${item.id}" title="Edit">✎</button>
                <button class="item-delete" data-id="${item.id}" title="Delete">×</button>
            `;
        }
        listEl.appendChild(li);
    });
}

function setupProjects() {
    const listEl = document.getElementById('projects-list');
    const col    = collection(db, 'projects');
    const q      = query(col, orderBy('createdAt', 'asc'));

    onSnapshot(q, snapshot => {
        currentProjects = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!editingProjectId) renderProjects(currentProjects);
        setStatus('Synced ✓');
    }, err => {
        setStatus('Could not connect — check your Firebase config', true);
        console.error(err);
    });

    async function addItem() {
        const text      = document.getElementById('projects-input').value.trim();
        const deadline  = document.getElementById('projects-deadline').value;
        const needsHelp = document.getElementById('projects-needs-help').checked;
        if (!text) return;

        document.getElementById('projects-input').value        = '';
        document.getElementById('projects-deadline').value     = '';
        document.getElementById('projects-needs-help').checked = false;

        try {
            await addDoc(col, {
                text,
                deadline:  deadline  || null,
                needsHelp: needsHelp,
                completed: false,
                createdAt: serverTimestamp()
            });
        } catch (e) {
            setStatus('Failed to save project', true);
            console.error(e);
        }
    }

    document.getElementById('projects-add').addEventListener('click', addItem);
    document.getElementById('projects-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') addItem();
    });

    listEl.addEventListener('keydown', e => {
        if (!editingProjectId) return;
        if (e.key === 'Enter' && e.target.type !== 'date') {
            e.preventDefault();
            listEl.querySelector('.edit-save-btn')?.click();
        }
        if (e.key === 'Escape') {
            editingProjectId = null;
            renderProjects(currentProjects);
        }
    });

    listEl.addEventListener('click', async e => {
        const editBtn   = e.target.closest('.item-edit');
        const saveBtn   = e.target.closest('.edit-save-btn');
        const cancelBtn = e.target.closest('.edit-cancel-btn');
        const checkbox  = e.target.closest('.item-checkbox');
        const deleteBtn = e.target.closest('.item-delete');
        const calBtn    = e.target.closest('.item-cal');
        const gcalBtn   = e.target.closest('.item-gcal');

        if (calBtn) {
            const item = currentProjects.find(i => i.id === calBtn.dataset.id);
            if (item) downloadICS(item);
            return;
        }

        if (gcalBtn) {
            const item = currentProjects.find(i => i.id === gcalBtn.dataset.id);
            if (item) window.open(googleCalUrl(item), '_blank');
            return;
        }

        if (editBtn) {
            editingProjectId = editBtn.dataset.id;
            renderProjects(currentProjects);
            setTimeout(() => document.getElementById('edit-project-text')?.focus(), 50);
            return;
        }

        if (saveBtn) {
            const text      = document.getElementById('edit-project-text').value.trim();
            const deadline  = document.getElementById('edit-project-deadline').value;
            const needsHelp = document.getElementById('edit-project-needs-help').checked;
            if (!text) return;
            try {
                await updateDoc(doc(db, 'projects', saveBtn.dataset.id), {
                    text,
                    deadline:  deadline  || null,
                    needsHelp: needsHelp,
                });
                editingProjectId = null;
                renderProjects(currentProjects);
            } catch (err) {
                setStatus('Failed to update project', true);
            }
            return;
        }

        if (cancelBtn) {
            editingProjectId = null;
            renderProjects(currentProjects);
            return;
        }

        if (checkbox) {
            const isChecked = checkbox.classList.contains('checked');
            try {
                await updateDoc(doc(db, 'projects', checkbox.dataset.id), { completed: !isChecked });
            } catch (err) {
                setStatus('Failed to update project', true);
            }
        }

        if (deleteBtn) {
            try {
                await deleteDoc(doc(db, 'projects', deleteBtn.dataset.id));
            } catch (err) {
                setStatus('Failed to delete project', true);
            }
        }
    });
}

setupProjects();

// ── Shopping Overview ────────────────────────────────────────────────

let editingShoppingId = null;
let currentShopping   = [];

function formatPrice(price) {
    if (price == null || price === '') return '—';
    return Number(price).toLocaleString('da-DK', { style: 'currency', currency: 'DKK', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function renderShopping(items) {
    const wrap    = document.getElementById('shopping-table-wrap');
    const countEl = document.getElementById('shopping-count');

    if (items.length === 0) {
        wrap.innerHTML = '<p class="empty-state">No items yet — add one below!</p>';
        countEl.textContent = '—';
        return;
    }

    const remaining = items.filter(i => !i.completed).length;
    countEl.textContent = remaining === 0 ? 'all done!' : `${remaining} left`;

    const toTitleCase = s => s.replace(/\b\w/g, c => c.toUpperCase());
    const groupMap = new Map();
    items.forEach(item => {
        const key = item.store?.trim().toLowerCase() || '';
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key).push(item);
    });

    const sortedKeys = [...groupMap.keys()]
        .filter(k => k !== '')
        .sort((a, b) => a.localeCompare(b));
    if (groupMap.has('')) sortedKeys.push('');

    const groups = new Map(sortedKeys.map(k => [k, groupMap.get(k)]));

    let grandTotal = 0;
    let bodyRows   = '';

    groups.forEach((groupItems, storeName) => {
        const storeLabel = storeName ? toTitleCase(storeName) : 'No store';
        bodyRows += `
            <tr class="store-header">
                <td colspan="5">${escapeHtml(storeLabel)}</td>
            </tr>`;

        let storeTotal = 0;
        groupItems.forEach(item => {
            const price     = parseFloat(item.price);
            const qty       = parseInt(item.qty) || 1;
            const lineTotal = !isNaN(price) ? price * qty : null;
            if (lineTotal != null && !item.completed) {
                storeTotal += lineTotal;
                grandTotal += lineTotal;
            }

            if (item.id === editingShoppingId) {
                bodyRows += `
                    <tr class="row-editing">
                        <td colspan="5">
                            <div class="shopping-edit-form">
                                <input type="text"   class="add-input" id="edit-shop-item"  value="${escapeHtml(item.text  || '')}" maxlength="100" placeholder="Item">
                                <input type="text"   class="add-input" id="edit-shop-store" value="${escapeHtml(item.store || '')}" maxlength="100" placeholder="Store">
                                <input type="number" class="add-input" id="edit-shop-price" value="${item.price ?? ''}" min="0" step="1" placeholder="Price">
                                <input type="number" class="add-input" id="edit-shop-qty"   value="${item.qty || 1}"   min="1" step="1" placeholder="Qty">
                                <label class="link-toggle-label">
                                    <input type="checkbox" id="edit-shop-link-toggle" ${item.link ? 'checked' : ''}>
                                    <span>Add link</span>
                                </label>
                                <input type="url" class="add-input edit-link-input" id="edit-shop-link" value="${escapeHtml(item.link || '')}" placeholder="Paste link..." style="${item.link ? '' : 'display:none'}">
                                <div class="shopping-edit-actions">
                                    <button class="edit-save-btn" data-id="${item.id}">Save</button>
                                    <button class="edit-cancel-btn">Cancel</button>
                                </div>
                            </div>
                        </td>
                    </tr>`;
            } else {
                const done = item.completed ? 'row-completed' : '';
                const href = safeUrl(item.link);
                const itemLabel = href
                    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.text || '')}</a>`
                    : escapeHtml(item.text || '');
                bodyRows += `
                    <tr class="${done}">
                        <td><div class="item-checkbox ${item.completed ? 'checked' : ''}" data-id="${item.id}"></div></td>
                        <td class="col-item">${itemLabel}</td>
                        <td class="col-price">${lineTotal != null ? formatPrice(lineTotal) : '—'}</td>
                        <td class="col-qty">× ${qty}</td>
                        <td class="col-actions">
                            <button class="item-edit"   data-id="${item.id}" title="Edit">✎</button>
                            <button class="item-delete" data-id="${item.id}" title="Delete">×</button>
                        </td>
                    </tr>`;
            }
        });

        bodyRows += `
            <tr class="store-subtotal">
                <td colspan="2">Subtotal</td>
                <td colspan="3">${formatPrice(storeTotal)}</td>
            </tr>`;
    });

    wrap.innerHTML = `
        <table class="shopping-table">
            <thead>
                <tr>
                    <th style="width:32px"></th>
                    <th>Item</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th style="width:68px"></th>
                </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
        </table>
        <div class="shopping-total">
            <span>Grand total</span>
            <span>${formatPrice(grandTotal)}</span>
        </div>`;
}

function setupShopping() {
    const col = collection(db, 'shopping');
    const q   = query(col, orderBy('createdAt', 'asc'));

    onSnapshot(q, snapshot => {
        currentShopping = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!editingShoppingId) renderShopping(currentShopping);
        setStatus('Synced ✓');
    }, err => {
        setStatus('Could not connect — check your Firebase config', true);
        console.error(err);
    });

    async function addItem() {
        const text  = document.getElementById('shop-item').value.trim();
        const store = document.getElementById('shop-store').value.trim();
        const price = document.getElementById('shop-price').value;
        const qty   = document.getElementById('shop-qty').value || '1';
        const link  = document.getElementById('shop-link').value.trim();
        if (!text) return;

        document.getElementById('shop-item').value          = '';
        document.getElementById('shop-store').value         = '';
        document.getElementById('shop-price').value         = '';
        document.getElementById('shop-qty').value           = '1';
        document.getElementById('shop-link').value          = '';
        document.getElementById('shop-link-toggle').checked = false;
        document.getElementById('shop-link').style.display = 'none';

        try {
            await addDoc(col, {
                text,
                store: store || '',
                price: price !== '' ? Math.round(parseFloat(price)) : null,
                qty:   parseInt(qty) || 1,
                link:  normalizeUrl(link),
                completed: false,
                createdAt: serverTimestamp()
            });
        } catch (e) {
            setStatus('Failed to save item', true);
            console.error(e);
        }
    }

    document.getElementById('shopping-add').addEventListener('click', addItem);
    ['shop-item', 'shop-store', 'shop-price', 'shop-qty', 'shop-link'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', e => {
            if (e.key === 'Enter') addItem();
        });
    });

    document.getElementById('shop-link-toggle').addEventListener('change', e => {
        const input = document.getElementById('shop-link');
        input.style.display = e.target.checked ? 'block' : 'none';
        if (!e.target.checked) input.value = '';
        else input.focus();
    });

    const wrap = document.getElementById('shopping-table-wrap');

    wrap.addEventListener('change', e => {
        const toggle = e.target.closest('#edit-shop-link-toggle');
        if (!toggle) return;
        const input = document.getElementById('edit-shop-link');
        input.style.display = toggle.checked ? 'block' : 'none';
        if (!toggle.checked) input.value = '';
        else input.focus();
    });

    wrap.addEventListener('keydown', e => {
        if (!editingShoppingId) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            wrap.querySelector('.edit-save-btn')?.click();
        }
        if (e.key === 'Escape') {
            editingShoppingId = null;
            renderShopping(currentShopping);
        }
    });

    wrap.addEventListener('click', async e => {
        const editBtn   = e.target.closest('.item-edit');
        const saveBtn   = e.target.closest('.edit-save-btn');
        const cancelBtn = e.target.closest('.edit-cancel-btn');
        const checkbox  = e.target.closest('.item-checkbox');
        const deleteBtn = e.target.closest('.item-delete');

        if (editBtn) {
            editingShoppingId = editBtn.dataset.id;
            renderShopping(currentShopping);
            setTimeout(() => document.getElementById('edit-shop-item')?.focus(), 50);
            return;
        }

        if (saveBtn) {
            const text  = document.getElementById('edit-shop-item').value.trim();
            const store = document.getElementById('edit-shop-store').value.trim();
            const price = document.getElementById('edit-shop-price').value;
            const qty   = document.getElementById('edit-shop-qty').value || '1';
            const link  = document.getElementById('edit-shop-link').value.trim();
            if (!text) return;
            try {
                await updateDoc(doc(db, 'shopping', saveBtn.dataset.id), {
                    text,
                    store: store || '',
                    price: price !== '' ? Math.round(parseFloat(price)) : null,
                    qty:   parseInt(qty) || 1,
                    link:  normalizeUrl(link),
                });
                editingShoppingId = null;
                renderShopping(currentShopping);
            } catch (err) {
                setStatus('Failed to update item', true);
            }
            return;
        }

        if (cancelBtn) {
            editingShoppingId = null;
            renderShopping(currentShopping);
            return;
        }

        if (checkbox) {
            const isChecked = checkbox.classList.contains('checked');
            try {
                await updateDoc(doc(db, 'shopping', checkbox.dataset.id), { completed: !isChecked });
            } catch (err) {
                setStatus('Failed to update item', true);
            }
        }

        if (deleteBtn) {
            try {
                await deleteDoc(doc(db, 'shopping', deleteBtn.dataset.id));
            } catch (err) {
                setStatus('Failed to delete item', true);
            }
        }
    });
}

setupShopping();
