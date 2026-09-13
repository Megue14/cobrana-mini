'use strict';

/**
 * In-memory stand-in for the tenant database.
 *
 * What lives here:
 *   - customers:    the people a merchant collects from
 *   - charges:      every amount a merchant has asked a customer to pay
 *   - transactions: individual payment attempts against a gateway charge
 *
 * The real platform runs one Postgres database per tenant with the same
 * shape. See CONVENTIONS.md.
 */

function seed() {
  return {
    customers: [
      { id: 'cus_001', tenantId: 'tnt_sanmartin', name: 'Rosa Quispe Ayala', email: 'rosa.quispe@example.pe', phone: '+51987654321', documentNumber: '45871236' },
      { id: 'cus_002', tenantId: 'tnt_sanmartin', name: 'Javier Ramos Ponte', email: 'javier.ramos@example.pe', phone: '+51912345678', documentNumber: '10254789' },
      { id: 'cus_003', tenantId: 'tnt_sanmartin', name: 'Lucia Bernal Ortiz', email: 'lucia.bernal@example.pe', phone: '+51998877665', documentNumber: '72580014' },
      { id: 'cus_101', tenantId: 'tnt_clinicavida', name: 'Marco Aliaga Tello', email: 'marco.aliaga@example.pe', phone: '+51955443322', documentNumber: '08123456' },
    ],
    charges: [
      { id: 'chg_1001', tenantId: 'tnt_sanmartin', customerId: 'cus_001', amount: 1500, concept: 'Pension enero', paymentMethod: 'CASHPOINT', providerOrderId: 'ord_4001', paymentCode: '418320', paymentLink: null, status: 'PAID',    createdAt: '2026-01-05T09:00:00.000Z', dueDate: '2026-01-10', expiresAt: '2026-01-10T23:59:59.000Z', paidAt: '2026-01-08T14:22:00.000Z' },
      { id: 'chg_1002', tenantId: 'tnt_sanmartin', customerId: 'cus_001', amount: 1500, concept: 'Pension febrero', paymentMethod: 'CASHPOINT', providerOrderId: 'ord_4012', paymentCode: '552104', paymentLink: null, status: 'PAID',    createdAt: '2026-02-04T09:00:00.000Z', dueDate: '2026-02-10', expiresAt: '2026-02-10T23:59:59.000Z', paidAt: '2026-02-09T11:05:00.000Z' },
      { id: 'chg_1003', tenantId: 'tnt_sanmartin', customerId: 'cus_001', amount: 1500, concept: 'Pension marzo', paymentMethod: 'CASHPOINT', providerOrderId: 'ord_4023', paymentCode: '730915', paymentLink: null, status: 'PENDING', createdAt: '2026-03-03T09:00:00.000Z', dueDate: '2026-03-10', expiresAt: '2026-03-10T23:59:59.000Z', paidAt: null },
      { id: 'chg_1004', tenantId: 'tnt_sanmartin', customerId: 'cus_002', amount: 1500, concept: 'Pension marzo', paymentMethod: 'PAGOYA',   providerOrderId: 'ord_4024', paymentCode: '118447', paymentLink: null, status: 'PENDING', createdAt: '2026-03-03T09:02:00.000Z', dueDate: '2026-03-10', expiresAt: '2026-03-10T23:59:59.000Z', paidAt: null },
      { id: 'chg_1005', tenantId: 'tnt_sanmartin', customerId: 'cus_003', amount: 2800, concept: 'Matricula 2026', paymentMethod: 'MONARCA', providerOrderId: 'ord_4018', paymentCode: null, paymentLink: 'https://checkout.monarca.pe/f2c8a1d9e0', status: 'PAID',    createdAt: '2026-02-20T16:40:00.000Z', dueDate: '2026-02-28', expiresAt: '2026-02-28T23:59:59.000Z', paidAt: '2026-02-21T19:10:00.000Z' },
      { id: 'chg_2001', tenantId: 'tnt_clinicavida', customerId: 'cus_101', amount: 4200, concept: 'Procedimiento ambulatorio', paymentMethod: 'EXTERNAL', providerOrderId: 'ord_4030', paymentCode: null, paymentLink: 'https://checkout.external.pe/7b1e44c02a', status: 'PAID', createdAt: '2026-03-01T12:00:00.000Z', dueDate: '2026-03-05', expiresAt: '2026-03-05T23:59:59.000Z', paidAt: '2026-03-01T12:14:00.000Z' },
    ],
    // Gateway charges only. One charge can collect several attempts before one
    // of them goes through; the service rail has no equivalent.
    transactions: [
      { id: 'trx_mon_7742', tenantId: 'tnt_sanmartin', chargeId: 'chg_1005', provider: 'MONARCA', status: 'DECLINED', declineReason: 'insufficient_funds', amount: 2800, processedAt: '2026-02-21T19:04:00.000Z' },
      { id: 'trx_mon_7756', tenantId: 'tnt_sanmartin', chargeId: 'chg_1005', provider: 'MONARCA', status: 'APPROVED', declineReason: null, amount: 2800, processedAt: '2026-02-21T19:10:00.000Z' },
      { id: 'trx_ext_3310', tenantId: 'tnt_clinicavida', chargeId: 'chg_2001', provider: 'EXTERNAL', status: 'APPROVED', declineReason: null, amount: 4200, processedAt: '2026-03-01T12:14:00.000Z' },
    ],
  };
}

const state = seed();

const store = {
  listCharges({ tenantId, customerId, status } = {}) {
    return state.charges.filter((charge) => {
      if (tenantId && charge.tenantId !== tenantId) return false;
      if (customerId && charge.customerId !== customerId) return false;
      if (status && charge.status !== status) return false;
      return true;
    });
  },

  findCharge(id) {
    return state.charges.find((charge) => charge.id === id) || null;
  },

  insertCharge(charge) {
    state.charges.push(charge);
    return charge;
  },

  updateCharge(id, patch) {
    const charge = store.findCharge(id);
    if (!charge) return null;
    Object.assign(charge, patch);
    return charge;
  },

  listTransactions({ tenantId, chargeId } = {}) {
    return state.transactions.filter((transaction) => {
      if (tenantId && transaction.tenantId !== tenantId) return false;
      if (chargeId && transaction.chargeId !== chargeId) return false;
      return true;
    });
  },

  findTransaction(id) {
    return state.transactions.find((transaction) => transaction.id === id) || null;
  },

  insertTransaction(transaction) {
    state.transactions.push(transaction);
    return transaction;
  },

  listCustomers({ tenantId } = {}) {
    return state.customers.filter((customer) => !tenantId || customer.tenantId === tenantId);
  },

  findCustomer(id) {
    return state.customers.find((customer) => customer.id === id) || null;
  },

  reset() {
    const fresh = seed();
    state.customers = fresh.customers;
    state.charges = fresh.charges;
    state.transactions = fresh.transactions;
  },
};

module.exports = store;
