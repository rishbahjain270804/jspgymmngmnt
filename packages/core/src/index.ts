/**
 * @oan/core — the business rules, shared by api, web, desktop and mobile.
 *
 * Nothing in this package may import a framework, touch the network, or read
 * the clock without being handed it. Everything here is a pure function, so
 * the same rule produces the same answer on a counter PC, a phone, and the
 * server — and can be tested without any of them.
 */

export * from './id.js';
export * from './money.js';
export * from './date.js';
export * from './gst.js';
export * from './membership.js';
export * from './rbac.js';
export * from './ledger.js';
