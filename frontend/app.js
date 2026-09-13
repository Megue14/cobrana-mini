'use strict';

/**
 * Merchant panel.
 *
 * Hash-routed, no build step. Every request goes to the business backend on
 * the same origin - the panel has no other API to talk to. See README.md.
 */

const API = '/api';

const view = document.getElementById('view');
const tenantSelect = document.getElementById('tenant');

function tenantId() {
  return tenantSelect.value;
}

async function api(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'Request failed');
  return payload;
}

async function post(path, body) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'Request failed');
  return payload;
}

function money(amount) {
  return `S/ ${Number(amount).toLocaleString('en-US')}`;
}

function percent(rate) {
  return `${(rate * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

function customerIndex(customers) {
  return Object.fromEntries(customers.map((customer) => [customer.id, customer.name]));
}

function chargeReference(charge) {
  if (charge.paymentCode) return `<code>${esc(charge.paymentCode)}</code>`;
  if (charge.paymentLink) return `<a class="link" href="${esc(charge.paymentLink)}" target="_blank" rel="noreferrer">Payment link</a>`;
  return '<span class="hint">&mdash;</span>';
}

function chargeRows(charges, names) {
  return charges.map((charge) => `
    <tr>
      <td><code>${esc(charge.id)}</code></td>
      <td>${esc(names[charge.customerId] || charge.customerId)}</td>
      <td>${esc(charge.concept)}</td>
      <td>${esc(charge.paymentMethod)}</td>
      <td>${chargeReference(charge)}</td>
      <td class="right">${money(charge.amount)}</td>
      <td><span class="tag ${esc(charge.status)}">${esc(charge.status)}</span></td>
      <td class="right">${charge.status === 'PENDING'
        ? `<button class="linkbtn" data-cancel="${esc(charge.id)}">Cancel</button>`
        : ''}</td>
    </tr>
  `).join('');
}

/* ---------------------------------------------------------------- pages */

async function dashboardPage() {
  const [{ charges }, { customers }, report] = await Promise.all([
    api(`/charges?tenantId=${tenantId()}`),
    api(`/customers?tenantId=${tenantId()}`),
    api(`/reports/monthly?tenantId=${tenantId()}`),
  ]);

  const names = customerIndex(customers);
  const pending = charges.filter((charge) => charge.status === 'PENDING');
  const pendingTotal = pending.reduce((total, charge) => total + charge.amount, 0);
  const recent = [...charges].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  view.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Dashboard</h1>
        <p>Everything this merchant has collected so far.</p>
      </div>
      <a href="#/charges/new"><button class="primary">New charge</button></a>
    </div>

    <div class="tiles">
      <div class="tile">
        <div class="label">Collected</div>
        <div class="value">${money(report.collected)}</div>
        <div class="sub">${report.paidCharges} paid charges</div>
      </div>
      <div class="tile">
        <div class="label">Pending</div>
        <div class="value">${money(pendingTotal)}</div>
        <div class="sub">${pending.length} open charges</div>
      </div>
      <div class="tile">
        <div class="label">Cobrana fee</div>
        <div class="value">${money(report.commission)}</div>
        <div class="sub">on collected charges</div>
      </div>
      <div class="tile">
        <div class="label">Customers</div>
        <div class="value">${customers.length}</div>
        <div class="sub">registered</div>
      </div>
    </div>

    <div class="card">
      <h2>Recent charges</h2>
      ${recent.length === 0 ? '<p class="empty">Nothing here yet.</p>' : `
      <table>
        <thead>
          <tr>
            <th>Charge</th><th>Customer</th><th>Concept</th><th>Method</th>
            <th>Reference</th><th class="right">Amount</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>${chargeRows(recent, names)}</tbody>
      </table>`}
    </div>
  `;

  bindCancelButtons(dashboardPage);
}

function bindCancelButtons(reload) {
  view.querySelectorAll('[data-cancel]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await post(`/charges/${button.dataset.cancel}/cancel`, { tenantId: tenantId() });
        await reload();
      } catch (err) {
        button.disabled = false;
        window.alert(err.message);
      }
    });
  });
}

let chargeFilter = 'ALL';

async function chargesPage() {
  const [{ charges }, { customers }] = await Promise.all([
    api(`/charges?tenantId=${tenantId()}`),
    api(`/customers?tenantId=${tenantId()}`),
  ]);

  const names = customerIndex(customers);
  const visible = chargeFilter === 'ALL'
    ? charges
    : charges.filter((charge) => charge.status === chargeFilter);

  view.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Charges</h1>
        <p>Every amount this merchant has asked a customer to pay.</p>
      </div>
      <a href="#/charges/new"><button class="primary">New charge</button></a>
    </div>

    <div class="filters">
      ${['ALL', 'PENDING', 'PAID'].map((status) => `
        <button class="chip ${chargeFilter === status ? 'active' : ''}" data-filter="${status}">
          ${status === 'ALL' ? 'All' : status[0] + status.slice(1).toLowerCase()}
        </button>
      `).join('')}
    </div>

    <div class="card">
      ${visible.length === 0 ? '<p class="empty">No charges match this filter.</p>' : `
      <table>
        <thead>
          <tr>
            <th>Charge</th><th>Customer</th><th>Concept</th><th>Method</th>
            <th>Reference</th><th class="right">Amount</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>${chargeRows(visible, names)}</tbody>
      </table>`}
    </div>
  `;

  bindCancelButtons(chargesPage);

  view.querySelectorAll('[data-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      chargeFilter = chip.dataset.filter;
      chargesPage();
    });
  });
}

async function newChargePage() {
  const [{ customers }, { rails }] = await Promise.all([
    api(`/customers?tenantId=${tenantId()}`),
    api(`/payment-methods?tenantId=${tenantId()}`),
  ]);

  view.innerHTML = `
    <a class="back" href="#/charges">&larr; Back to charges</a>
    <div class="page-head">
      <div>
        <h1>New charge</h1>
        <p>Generate a charge for one of your customers.</p>
      </div>
    </div>

    <div class="card">
      <form id="charge-form">
        <div class="field">
          <label for="customerId">Customer</label>
          <select id="customerId" name="customerId">
            ${customers.map((customer) => `<option value="${esc(customer.id)}">${esc(customer.name)}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label for="concept">Concept</label>
          <input id="concept" name="concept" type="text" placeholder="Tuition - April" required />
        </div>

        <div class="field">
          <label for="amount">Amount</label>
          <input id="amount" name="amount" type="number" min="1" step="1" value="1500" required />
          <span class="hint">Whole soles. No cents.</span>
        </div>

        <div class="field">
          <label for="dueDate">Due date</label>
          <input id="dueDate" name="dueDate" type="date" />
        </div>

        <fieldset>
          <legend>Payment method</legend>
          ${rails.map((rail) => `
            <div class="rail-group">
              <h3>${esc(rail.name)}</h3>
              <p>${esc(rail.description)}</p>
              <div class="method-options">
                ${rail.methods.map((method) => `
                  <label class="method" data-method="${esc(method.code)}">
                    <input type="radio" name="paymentMethod" value="${esc(method.code)}" />
                    <span>
                      <span class="name">${esc(method.label)}</span>
                      <span class="note">${method.chargesCommission ? 'Cobrana fee applies' : 'Settles to the merchant, no Cobrana fee'}</span>
                    </span>
                  </label>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </fieldset>

        <div class="field toggle-field">
          <label class="toggle">
            <input type="checkbox" id="notifyByWhatsapp" checked />
            <span>Notify the customer on WhatsApp</span>
          </label>
          <span class="hint">We send them the concept, the amount and the payment code.</span>
        </div>

        <div class="actions">
          <button type="submit" class="primary">Create charge</button>
          <a href="#/charges"><button type="button" class="ghost">Cancel</button></a>
        </div>
        <p id="form-error" class="error" hidden></p>
      </form>
    </div>
  `;

  const form = view.querySelector('#charge-form');
  const formError = view.querySelector('#form-error');
  const first = view.querySelector('input[name="paymentMethod"]');
  if (first) {
    first.checked = true;
    first.closest('.method').classList.add('selected');
  }

  view.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      view.querySelectorAll('.method').forEach((el) => el.classList.remove('selected'));
      radio.closest('.method').classList.add('selected');
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.hidden = true;
    const selected = view.querySelector('input[name="paymentMethod"]:checked');
    try {
      await post('/charges', {
        tenantId: tenantId(),
        customerId: view.querySelector('#customerId').value,
        concept: view.querySelector('#concept').value,
        amount: Number(view.querySelector('#amount').value),
        dueDate: view.querySelector('#dueDate').value || null,
        paymentMethod: selected ? selected.value : null,
        notifyByWhatsapp: view.querySelector('#notifyByWhatsapp').checked,
      });
      window.location.hash = '#/charges';
    } catch (err) {
      formError.textContent = err.message;
      formError.hidden = false;
    }
  });
}

async function myCommercePage() {
  const [commerce, { rails }] = await Promise.all([
    api(`/my-commerce?tenantId=${tenantId()}`),
    api(`/payment-methods?tenantId=${tenantId()}`),
  ]);

  view.innerHTML = `
    <div class="page-head">
      <div>
        <h1>My commerce</h1>
        <p>Your plan and the limits that apply to your account.</p>
      </div>
    </div>

    <div class="card detail">
      <h2>Account</h2>
      <div class="detail-grid">
        <div><dt>Business name</dt><dd>${esc(commerce.name)}</dd></div>
        <div><dt>Panel address</dt><dd><code>${esc(commerce.panelUrl)}</code></dd></div>
        <div><dt>Plan</dt><dd>${esc(commerce.commercialPlan)}</dd></div>
        <div><dt>Cobrana fee</dt><dd>${percent(commerce.commissionRate)} + IGV</dd></div>
      </div>
    </div>

    <div class="card detail">
      <h2>Limits</h2>
      <div class="detail-grid">
        <div><dt>Max amount per charge</dt><dd>${money(commerce.limits.maxChargeAmount)}</dd></div>
        <div><dt>Open charges per customer</dt><dd>${commerce.limits.maxOpenChargesPerCustomer}</dd></div>
      </div>
    </div>

    <div class="card">
      <h2>Payment methods</h2>
      <table>
        <thead><tr><th>Method</th><th>Rail</th><th>How the customer pays</th><th class="right">Cobrana fee</th></tr></thead>
        <tbody>
          ${rails.flatMap((rail) => rail.methods.map((method) => `
            <tr>
              <td>${esc(method.label)}</td>
              <td><span class="rail-pill">${esc(rail.name)}</span></td>
              <td>${esc(rail.description)}</td>
              <td class="right">${method.chargesCommission ? percent(commerce.commissionRate) : 'None'}</td>
            </tr>
          `)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ---------------------------------------------------------------- router */

const routes = {
  '/': dashboardPage,
  '/charges': chargesPage,
  '/charges/new': newChargePage,
  '/my-commerce': myCommercePage,
};

function currentRoute() {
  const hash = window.location.hash.replace(/^#/, '');
  return routes[hash] ? hash : '/';
}

function highlightNav(route) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    const owns = route === item.dataset.route
      || (route === '/charges/new' && item.dataset.route === '/charges');
    item.classList.toggle('active', owns);
  });
}

async function render() {
  const route = currentRoute();
  highlightNav(route);
  try {
    await routes[route]();
  } catch (err) {
    view.innerHTML = `<div class="card"><p class="error">${esc(err.message)}</p></div>`;
  }
}

window.addEventListener('hashchange', render);
tenantSelect.addEventListener('change', () => {
  chargeFilter = 'ALL';
  render();
});

render();
