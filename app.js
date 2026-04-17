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

// ── To Do ────────────────────────────────────────────────────────────

const PRIORITY = {
    high: { cls: 'priority-high', label: 'High' },
    mid:  { cls: 'priority-mid',  label: 'Mid'  },
    low:  { cls: 'priority-low',  label: 'Low'  },
};

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
        li.className = 'item';

        const pri = PRIORITY[item.priority];
        const priorityBadge = pri
            ? `<span class="todo-priority ${pri.cls}">${pri.label}</span>`
            : '';

        const metaParts = [];
        if (item.deadline) {
            const d    = new Date(item.deadline + 'T00:00:00');
            const opts = d.getFullYear() === new Date().getFullYear()
                ? { month: 'short', day: 'numeric' }
                : { month: 'short', day: 'numeric', year: 'numeric' };
            metaParts.push(`<span>📅 ${d.toLocaleDateString('en-GB', opts)}</span>`);
        }
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
            <button class="item-delete" data-id="${item.id}" title="Delete">×</button>
        `;
        listEl.appendChild(li);
    });
}

function setupTodos() {
    const listEl = document.getElementById('todo-list');
    const col    = collection(db, 'todos');
    const q      = query(col, orderBy('createdAt', 'asc'));

    onSnapshot(q, snapshot => {
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderTodos(items);
        setStatus('Synced ✓');
    }, err => {
        setStatus('Could not connect — check your Firebase config', true);
        console.error(err);
    });

    async function addItem() {
        const text      = document.getElementById('todo-input').value.trim();
        const priority  = document.getElementById('todo-priority').value;
        const deadline  = document.getElementById('todo-deadline').value;
        const needsHelp = document.getElementById('todo-needs-help').checked;
        if (!text) return;

        document.getElementById('todo-input').value        = '';
        document.getElementById('todo-priority').value     = '';
        document.getElementById('todo-deadline').value     = '';
        document.getElementById('todo-needs-help').checked = false;

        try {
            await addDoc(col, {
                text,
                priority:  priority  || null,
                deadline:  deadline  || null,
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

    listEl.addEventListener('click', async e => {
        const checkbox  = e.target.closest('.item-checkbox');
        const deleteBtn = e.target.closest('.item-delete');

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

// ── Shopping Overview ────────────────────────────────────────────────

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
            const done = item.completed ? 'row-completed' : '';
            bodyRows += `
                <tr class="${done}">
                    <td><div class="item-checkbox ${item.completed ? 'checked' : ''}" data-id="${item.id}"></div></td>
                    <td class="col-item">${escapeHtml(item.text || '')}</td>
                    <td class="col-price">${lineTotal != null ? formatPrice(lineTotal) : '—'}</td>
                    <td class="col-qty">× ${qty}</td>
                    <td><button class="item-delete" data-id="${item.id}" title="Delete">×</button></td>
                </tr>`;
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
                    <th style="width:36px"></th>
                </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
        </table>
        <div class="shopping-total">
            <span>Grand total</span>
            <span>${formatPrice(grandTotal)}</span>
        </div>`;
}

// ── Bookmarklet import ───────────────────────────────────────────────

function setupBookmarklet() {
    const appUrl = window.location.origin + window.location.pathname;

    // Bookmarklet runs on the product page (no CORS issues) and opens MyList with params
    const code = `(function(){var t=(document.querySelector('meta[property="og:title"]')||{}).getAttribute('content')||(document.querySelector('h1')||{}).textContent||document.title||'';t=t.trim();var p=null;var pm=document.querySelector('meta[property="og:price:amount"]')||document.querySelector('meta[property="product:price:amount"]');if(pm)p=pm.getAttribute('content');if(!p){[].forEach.call(document.querySelectorAll('script[type="application/ld+json"]'),function(s){if(p)return;try{var j=JSON.parse(s.textContent);if(Array.isArray(j))j=j.find(function(x){return x['@type']==='Product';});if(j&&j.offers){var o=Array.isArray(j.offers)?j.offers[0]:j.offers;if(o&&o.price!=null)p=o.price;}}catch(e){}});}if(!p){var nd=document.getElementById('__NEXT_DATA__');if(nd){try{var sr=function(o,d){if(!o||typeof o!=='object'||d>8)return null;var ks=['price','salesPrice','currentPrice','salePrice','sellingPrice'];for(var i=0;i<ks.length;i++){var v=o[ks[i]];if(v>0&&v<1000000)return v;}var vs=Object.values(o);for(var i=0;i<vs.length;i++){var f=sr(vs[i],d+1);if(f)return f;}return null;};p=sr(JSON.parse(nd.textContent),0);}catch(e){}}}if(p!=null){var s=String(p).replace(/[^0-9.,]/g,'');if(/^\\d{1,3}(\\.\\d{3})+(,\\d*)?$/.test(s))s=s.replace(/\\./g,'').replace(',','.');else s=s.replace(',','.');p=Math.round(parseFloat(s))||null;}var h=location.hostname.replace(/^www\\./,'').split('.')[0];var st=h.charAt(0).toUpperCase()+h.slice(1);var u=new URLSearchParams();if(t)u.set('item',t);if(st)u.set('store',st);if(p)u.set('price',p);window.open('${appUrl}?'+u.toString(),'_blank');})();`;

    document.getElementById('bookmarklet-link').href = 'javascript:' + code;
}

function readImportParams() {
    const params = new URLSearchParams(window.location.search);
    const item  = params.get('item');
    const store = params.get('store');
    const price = params.get('price');
    if (!item && !store && !price) return;

    document.getElementById('shop-item').value  = item  || '';
    document.getElementById('shop-store').value = store || '';
    document.getElementById('shop-price').value = price || '';

    const notice  = document.getElementById('import-notice');
    notice.hidden = false;
    document.getElementById('import-store').textContent = store || 'web';

    history.replaceState({}, '', window.location.pathname);
    notice.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => document.getElementById('shop-item').focus(), 300);
}

function setupShopping() {
    const col = collection(db, 'shopping');
    const q   = query(col, orderBy('createdAt', 'asc'));

    onSnapshot(q, snapshot => {
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderShopping(items);
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
        if (!text) return;

        document.getElementById('shop-item').value  = '';
        document.getElementById('shop-store').value = '';
        document.getElementById('shop-price').value = '';
        document.getElementById('shop-qty').value   = '1';

        try {
            await addDoc(col, {
                text,
                store: store || '',
                price: price !== '' ? Math.round(parseFloat(price)) : null,
                qty:   parseInt(qty) || 1,
                completed: false,
                createdAt: serverTimestamp()
            });
        } catch (e) {
            setStatus('Failed to save item', true);
            console.error(e);
        }
    }

    document.getElementById('shopping-add').addEventListener('click', addItem);
    ['shop-item', 'shop-store', 'shop-price', 'shop-qty'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', e => {
            if (e.key === 'Enter') addItem();
        });
    });

    document.getElementById('shopping-table-wrap').addEventListener('click', async e => {
        const checkbox  = e.target.closest('.item-checkbox');
        const deleteBtn = e.target.closest('.item-delete');

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
setupBookmarklet();
readImportParams();
