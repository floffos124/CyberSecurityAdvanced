// De schermen van Unbreakable. Navigeren gebeurt met het deel na # in de URL.

import { api, currentUser, setUser } from './api.js';
import { encrypt, decrypt, prepareText, computeHmac, verifyHmac } from './crypto.js';

const app = document.getElementById('app');

function escapeHtml(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatDate(value) {
    return new Date(value).toLocaleString('nl-BE', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function showWho() {
    const user = currentUser();
    document.getElementById('who').innerHTML = user
        ? `Je bent <strong>${escapeHtml(user)}</strong> (<a href="#/">wisselen</a>)`
        : '';
}

// ------------------------------------------------------------------ naam kiezen

function renderLogin() {
    const user = currentUser();
    app.innerHTML = `
        <div class="text-center mb-5">
            <h1 class="display-4">Unbreakable</h1>
            <p class="lead">Berichten die niemand anders kan lezen. Dat is toch de bedoeling.</p>
        </div>
        <div class="row justify-content-center">
            <div class="col-md-5">
                ${user ? `<p>Je gebruikt Unbreakable als <strong>${escapeHtml(user)}</strong>.
                          <a href="#/inbox">Naar je inbox</a></p>
                          <p>Iemand anders? Vul hieronder een andere naam in.</p>` : ''}
                <form id="login">
                    <div class="form-group">
                        <label for="name">Wie ben je?</label>
                        <input id="name" class="form-control" placeholder="bijvoorbeeld Anna"
                               required minlength="2" maxlength="40" />
                    </div>
                    <button type="submit" class="btn btn-primary">Verder</button>
                </form>
            </div>
        </div>`;

    document.getElementById('login').addEventListener('submit', (event) => {
        event.preventDefault();
        setUser(document.getElementById('name').value.trim());
        location.hash = '#/inbox';
    });
}

// ------------------------------------------------------------------ inbox

async function renderInbox(params) {
    const user = currentUser();
    const q = params.get('q') || '';
    const from = params.get('from') || '';

    const all = await api.inbox();
    const senders = [...new Set(all.map(m => m.sender))].sort();
    const found = q ? await api.search(q) : all;
    const messages = found.filter(m => !from || m.sender === from);

    app.innerHTML = `
        <h1>Inbox van ${escapeHtml(user)}</h1>
        <p>
            <a href="#/nieuw" class="btn btn-primary">Nieuw bericht</a>
            <button id="export" class="btn btn-outline-secondary">Exporteer als JSON</button>
        </p>
        <form id="filter" class="mb-3">
            <div class="form-row align-items-end">
                <div class="col-auto">
                    <label for="from">Van</label>
                    <select id="from" class="form-control">
                        <option value="">Iedereen</option>
                        ${senders.map(s => `<option value="${escapeHtml(s)}" ${s === from ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                    </select>
                </div>
                <div class="col-auto">
                    <label for="q">Zoeken</label>
                    <input id="q" class="form-control" value="${escapeHtml(q)}" />
                </div>
                <div class="col-auto">
                    <button type="submit" class="btn btn-secondary">Filter</button>
                </div>
            </div>
        </form>
        <p id="searched"></p>
        <div id="list"></div>`;

    if (q) {
        window.jQuery('#searched').html('Je zocht naar: ' + q);
    }

    const rows = messages.map(m => `
        <tr>
            <td>${escapeHtml(m.sender)}</td>
            <td><a href="#/bericht/${m.id}">${m.subject}</a></td>
            <td>${formatDate(m.sentAt)}</td>
        </tr>`).join('');

    document.getElementById('list').innerHTML = messages.length
        ? `<table class="table">
               <thead><tr><th>Van</th><th>Onderwerp</th><th>Verzonden</th></tr></thead>
               <tbody>${rows}</tbody>
           </table>`
        : '<p class="text-muted">Geen berichten.</p>';

    document.getElementById('filter').addEventListener('submit', (event) => {
        event.preventDefault();
        const next = new URLSearchParams();
        const newQ = document.getElementById('q').value;
        const newFrom = document.getElementById('from').value;
        if (newQ) next.set('q', newQ);
        if (newFrom) next.set('from', newFrom);
        location.hash = '#/inbox' + (next.toString() ? '?' + next.toString() : '');
    });

    document.getElementById('export').addEventListener('click', async () => {
        const data = await api.exportJson();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'inbox.json';
        link.click();
        URL.revokeObjectURL(link.href);
    });
}

// ------------------------------------------------------------------ bericht lezen

async function renderMessage(id) {
    const m = await api.message(id);

    app.innerHTML = `
        <h1>${m.subject}</h1>
        <dl class="row">
            <dt class="col-sm-2">Van</dt><dd class="col-sm-10">${escapeHtml(m.sender)}</dd>
            <dt class="col-sm-2">Aan</dt><dd class="col-sm-10">${escapeHtml(m.recipient)}</dd>
            <dt class="col-sm-2">Verzonden</dt><dd class="col-sm-10">${formatDate(m.sentAt)}</dd>
            ${m.keyLine ? `<dt class="col-sm-2">Codeboek lijn</dt><dd class="col-sm-10">${escapeHtml(String(m.keyLine))}</dd>` : ''}
        </dl>
        <div class="card mb-3"><div class="card-body message-body" id="body"></div></div>
        <div class="form-inline mb-3">
            <label for="decryptkey" class="mr-2">Sleutel om te ontcijferen:</label>
            <input id="decryptkey" class="form-control mr-2" maxlength="40"
                   pattern="[A-Za-z0-9_]+" title="Enkel A-Z, 0-9 en _" />
            <label for="hmackey" class="mr-2 ml-3">HMAC sleutel:</label>
            <input id="hmackey" class="form-control mr-2" />
            <button id="decryptbtn" class="btn btn-success">Ontcijferen</button>
        </div>
        <div id="hmac-status" class="mb-3"></div>
        <p>
            <button id="delete" class="btn btn-outline-danger">Verwijderen</button>
            <a href="#/inbox" class="btn btn-link">Terug naar je inbox</a>
        </p>`;

    document.getElementById('body').textContent = m.body;

    document.getElementById('decryptbtn').addEventListener('click', async () => {
        const key = document.getElementById('decryptkey').value.toUpperCase();
        const hmacKey = document.getElementById('hmackey').value;
        if (!key) return;

        // Verifieer HMAC als er een HMAC sleutel en opgeslagen HMAC zijn
        const statusEl = document.getElementById('hmac-status');
        if (hmacKey && m.hmac) {
            const valid = await verifyHmac(m.body, hmacKey, m.hmac);
            if (valid) {
                statusEl.innerHTML = '<span class="text-success">HMAC geldig: het bericht is niet gewijzigd.</span>';
            } else {
                statusEl.innerHTML = '<span class="text-danger">HMAC ongeldig: het bericht is mogelijk gewijzigd!</span>';
                return;
            }
        } else if (m.hmac && !hmacKey) {
            statusEl.innerHTML = '<span class="text-warning">Dit bericht heeft een HMAC, maar je hebt geen HMAC sleutel ingegeven.</span>';
        } else {
            statusEl.innerHTML = '';
        }

        try {
            const plaintext = decrypt(m.body, key);
            document.getElementById('body').textContent = plaintext;
        } catch (err) {
            document.getElementById('body').textContent = 'Fout bij ontcijferen: ' + err.message;
        }
    });

    document.getElementById('delete').addEventListener('click', async () => {
        if (confirm('Ben je zeker dat je dit bericht wil verwijderen?')) {
            await api.remove(id);
            location.hash = '#/inbox';
        }
    });
}

// ------------------------------------------------------------------ bericht versturen

async function renderNew() {
    const users = await api.users();

    app.innerHTML = `
        <h1>Nieuw bericht</h1>
        <p class="text-muted">Van: ${escapeHtml(currentUser())}</p>
        <div class="row">
            <div class="col-md-8">
                <form id="compose">
                    <div class="form-group">
                        <label for="recipient">Aan</label>
                        <input id="recipient" class="form-control" list="known-users" autocomplete="off"
                               required minlength="2" maxlength="40" />
                        <datalist id="known-users">
                            ${users.map(u => `<option value="${escapeHtml(u)}"></option>`).join('')}
                        </datalist>
                    </div>
                    <div class="form-group">
                        <label for="subject">Onderwerp</label>
                        <input id="subject" class="form-control" required maxlength="100" />
                    </div>
                    <div class="form-group">
                        <label for="text">Bericht</label>
                        <textarea id="text" class="form-control" rows="6" required maxlength="2000"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="keyline">Lijnnummer codeboek</label>
                        <input id="keyline" class="form-control" type="number" min="1" max="50" required />
                    </div>
                    <div class="form-group">
                        <label for="otpkey">Sleutel (uit codeboek)</label>
                        <input id="otpkey" class="form-control" required minlength="1" maxlength="40"
                               pattern="[A-Za-z0-9_]+" title="Enkel A-Z, 0-9 en _" />
                    </div>
                    <div class="form-group">
                        <label for="hmackey">HMAC sleutel (afgesproken met ontvanger)</label>
                        <input id="hmackey" class="form-control" required minlength="1" />
                    </div>
                    <button type="submit" class="btn btn-primary">Versturen</button>
                    <a href="#/inbox" class="btn btn-link">Annuleren</a>
                </form>
            </div>
        </div>`;

    document.getElementById('compose').addEventListener('submit', async (event) => {
        event.preventDefault();
        const plaintext = document.getElementById('text').value;
        const key = document.getElementById('otpkey').value.toUpperCase();
        const keyLine = document.getElementById('keyline').value;
        const hmacKey = document.getElementById('hmackey').value;

        const ciphertext = encrypt(plaintext, key);
        const hmac = await computeHmac(ciphertext, hmacKey);

        await api.send({
            recipient: document.getElementById('recipient').value.trim(),
            subject: document.getElementById('subject').value,
            body: ciphertext,
            keyLine: parseInt(keyLine, 10),
            hmac: hmac,
        });
        location.hash = '#/inbox';
    });
}

// ------------------------------------------------------------------ over

function renderAbout() {
    app.innerHTML = `
        <h1>Over Unbreakable</h1>
        <p>Unbreakable is een berichtenapp. Je stuurt een bericht naar iemand, en enkel die persoon kan het lezen.
           Dat is tenminste het doel.</p>
        <p>Deze versie is de starter app van het vak Cyber Security Advanced aan AP Hogeschool.
           Ze werkt, maar is nog helemaal niet veilig. Doorheen het semester maken jullie ze beter.</p>
        <p>De app bestaat uit twee delen: deze single page app in je browser, en een API op de server.
           Bekijk de developer tools van je browser om te zien wat er over en weer gaat.</p>
        <p class="text-danger">Gebruik deze app enkel in je eigen labomgeving en nooit met echte gegevens.</p>`;
}

// ------------------------------------------------------------------ navigatie

async function route() {
    showWho();

    const [path, query] = (location.hash || '#/').slice(1).split('?');
    const params = new URLSearchParams(query || '');

    try {
        if (path === '/' || path === '') {
            return renderLogin();
        }
        if (path === '/over') {
            return renderAbout();
        }
        if (!currentUser()) {
            location.hash = '#/';
            return;
        }
        if (path === '/inbox') {
            return await renderInbox(params);
        }
        if (path === '/nieuw') {
            return await renderNew();
        }
        const match = path.match(/^\/bericht\/(\d+)$/);
        if (match) {
            return await renderMessage(match[1]);
        }
        app.innerHTML = '<p>Deze pagina bestaat niet.</p>';
    } catch (error) {
        app.innerHTML = `<div class="alert alert-danger">Er liep iets mis: ${escapeHtml(error.message)}</div>`;
    }
}

window.addEventListener('hashchange', route);
route();

