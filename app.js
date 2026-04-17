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

// ── Link import ─────────────────────────────────────────────────────

function parseDanishPrice(str) {
    if (!str) return null;
    // Strip currency words/symbols and whitespace
    let s = str.replace(/[a-zA-Z\s]/g, '').trim();
    // Danish thousands separator: 1.299,00 → strip dots before comma
    if (/^\d{1,3}(\.\d{3})+(,\d*)?$/.test(s)) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else {
        s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? null : Math.round(n);
}

async function fetchWithProxy(url) {
    const enc = encodeURIComponent(url);
    const attempts = [
        () => fetch(`https://corsproxy.io/?${enc}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
        () => fetch(`https://api.allorigins.win/raw?url=${enc}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
        () => fetch(`https://api.allorigins.win/get?url=${enc}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => d.contents),
    ];
    for (const attempt of attempts) {
        try {
            const html = await attempt();
            if (html && html.length > 500) return html;
        } catch {}
    }
    throw new Error('All proxies failed');
}

function searchForPrice(obj, depth = 0) {
    if (depth > 10 || !obj || typeof obj !== 'object') return null;
    const keys = ['price', 'salesPrice', 'currentPrice', 'salePrice', 'sellingPrice', 'discountedPrice', 'amount'];
    for (const key of keys) {
        if (obj[key] != null) {
            const p = typeof obj[key] === 'number'
                ? Math.round(obj[key])
                : parseDanishPrice(String(obj[key]));
            if (p && p > 0 && p < 1_000_000) return p;
        }
    }
    for (const val of Object.values(obj)) {
        if (val && typeof val === 'object') {
            const found = searchForPrice(val, depth + 1);
            if (found) return found;
        }
    }
    return null;
}

async function fetchProduct(url) {
    const contents = await fetchWithProxy(url);
    const doc      = new DOMParser().parseFromString(contents, 'text/html');

    // Title: og:title → twitter:title → <title>
    const title =
        doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
        doc.title || '';

    let price = null;

    // 1. og/meta price tags
    const priceMeta =
        doc.querySelector('meta[property="og:price:amount"]')?.getAttribute('content') ||
        doc.querySelector('meta[property="product:price:amount"]')?.getAttribute('content') ||
        doc.querySelector('meta[name="price"]')?.getAttribute('content');
    if (priceMeta) price = parseDanishPrice(priceMeta);

    // 2. JSON-LD schema.org
    if (!price) {
        for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
            try {
                let json = JSON.parse(script.textContent);
                if (Array.isArray(json)) json = json.find(j => j['@type'] === 'Product');
                if (json?.['@type'] === 'Product' && json.offers) {
                    const offer = Array.isArray(json.offers) ? json.offers[0] : json.offers;
                    if (offer?.price != null) { price = Math.round(parseFloat(offer.price)); break; }
                }
            } catch {}
        }
    }

    // 3. Next.js __NEXT_DATA__ (used by ilva.dk and many other shops)
    if (!price) {
        const nextEl = doc.getElementById('__NEXT_DATA__');
        if (nextEl) {
            try { price = searchForPrice(JSON.parse(nextEl.textContent)); } catch {}
        }
    }

    // 4. Scan inline scripts for price patterns
    if (!price) {
        const pricePattern = /"(?:price|salesPrice|currentPrice|salePrice|sellingPrice|discountedPrice)"\s*:\s*([\d.,]+)/i;
        for (const script of doc.querySelectorAll('script:not([src]):not([type="application/ld+json"])')) {
            const m = script.textContent.match(pricePattern);
            if (m) {
                const p = parseDanishPrice(m[1]);
                if (p && p > 0 && p < 1_000_000) { price = p; break; }
            }
        }
    }

    const hostname  = new URL(url).hostname.replace(/^www\./, '');
    const storePart = hostname.split('.')[0];
    const store     = storePart.charAt(0).toUpperCase() + storePart.slice(1);

    console.log('[fetchProduct]', { title, price, store, htmlLength: contents.length });
    return { title: title.trim(), price, store };
}

function setupLinkImport() {
    const toggleBtn  = document.getElementById('link-toggle');
    const form       = document.getElementById('link-form');
    const urlInput   = document.getElementById('link-url');
    const fetchBtn   = document.getElementById('link-fetch');
    const statusEl   = document.getElementById('link-status');

    toggleBtn.addEventListener('click', () => {
        const hidden = form.hidden;
        form.hidden  = !hidden;
        toggleBtn.classList.toggle('active', hidden);
        if (hidden) urlInput.focus();
    });

    async function doFetch() {
        const url = urlInput.value.trim();
        if (!url) return;
        statusEl.textContent = 'Fetching…';
        statusEl.className   = 'link-status';
        fetchBtn.disabled    = true;

        try {
            const { title, price, store } = await fetchProduct(url);

            document.getElementById('shop-item').value  = title  || '';
            document.getElementById('shop-store').value = store  || '';
            document.getElementById('shop-price').value = price != null ? price : '';

            urlInput.value       = '';
            form.hidden          = true;
            toggleBtn.classList.remove('active');
            statusEl.textContent = price != null
                ? `Fetched: ${title || 'unknown'} — ${price} kr`
                : `Fetched: ${title || 'unknown'} — price not found, enter manually`;
            document.getElementById('shop-item').focus();
        } catch (e) {
            statusEl.textContent = 'Could not fetch — check the URL or try another site';
            statusEl.className   = 'link-status error';
            console.error(e);
        } finally {
            fetchBtn.disabled = false;
        }
    }

    fetchBtn.addEventListener('click', doFetch);
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') doFetch(); });
    urlInput.addEventListener('paste', () => setTimeout(doFetch, 50));
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
setupLinkImport();
