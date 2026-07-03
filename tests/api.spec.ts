import { test, expect } from './fixtures';
import type { Booking } from '../src/api/BookingApi';

// Module: REST API — restful-booker, driven through the typed BookingApi client.
// Heroku cold starts can be slow; give this project room and let CI retry.
test.describe('REST API', () => {
  test.slow();

  const unique = Date.now();
  const booking: Booking = {
    firstname: 'Kunal',
    lastname: `Singh${unique}`, // unique so the query-filter test is deterministic
    totalprice: 250,
    depositpaid: true,
    bookingdates: { checkin: '2026-01-10', checkout: '2026-01-14' },
    additionalneeds: 'Late checkout',
  };

  test('API-001 auth returns a token', async ({ bookingApi }) => {
    const res = await bookingApi.auth();
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).token).toBeTruthy();
  });

  test('API-002 bad credentials return no token', async ({ bookingApi }) => {
    const res = await bookingApi.auth('admin', 'nope');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeFalsy();
    expect(body.reason).toMatch(/bad credentials/i);
  });

  test('API-003 health check ping returns 201', async ({ bookingApi }) => {
    expect((await bookingApi.ping()).status()).toBe(201);
  });

  test('API-004 booking list returns an array of ids', async ({ bookingApi }) => {
    const res = await bookingApi.list();
    expect(res.status()).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBeTruthy();
    if (list.length) expect(list[0]).toHaveProperty('bookingid');
  });

  test('API-005 create -> read -> update -> delete round-trip', async ({ bookingApi }) => {
    const token = await bookingApi.token();

    const created = await bookingApi.create(booking);
    expect(created.status()).toBe(200);
    const { bookingid, booking: saved } = await created.json();
    expect(saved.firstname).toBe(booking.firstname);

    const fetched = await bookingApi.get(bookingid);
    expect(fetched.status()).toBe(200);
    expect((await fetched.json()).totalprice).toBe(booking.totalprice);

    const updated = await bookingApi.update(bookingid, token, { ...booking, totalprice: 300 });
    expect(updated.status()).toBe(200);
    expect((await updated.json()).totalprice).toBe(300);

    const removed = await bookingApi.remove(bookingid, token);
    expect([200, 201]).toContain(removed.status());
  });

  test('API-006 partial update (PATCH) changes only the sent field', async ({ bookingApi }) => {
    const token = await bookingApi.token();
    const { bookingid } = await (await bookingApi.create(booking)).json();

    const patched = await bookingApi.patch(bookingid, token, { totalprice: 400 });
    expect(patched.status()).toBe(200);
    const body = await patched.json();
    expect(body.totalprice).toBe(400);
    expect(body.firstname).toBe(booking.firstname); // untouched
  });

  test('API-007 filter by name returns the created booking', async ({ bookingApi }) => {
    const { bookingid } = await (await bookingApi.create(booking)).json();

    const res = await bookingApi.filterByName(booking.firstname, booking.lastname);
    expect(res.status()).toBe(200);
    const ids = (await res.json()).map((b: { bookingid: number }) => b.bookingid);
    expect(ids).toContain(bookingid);
  });

  test('API-008 update without a token is rejected', async ({ bookingApi }) => {
    const { bookingid } = await (await bookingApi.create(booking)).json();
    const res = await bookingApi.updateUnauthed(bookingid, { ...booking, totalprice: 999 });
    expect(res.status()).toBe(403);
  });
});
