import { type APIRequestContext, type APIResponse } from '@playwright/test';

export interface Booking {
  firstname: string;
  lastname: string;
  totalprice: number;
  depositpaid: boolean;
  bookingdates: { checkin: string; checkout: string };
  additionalneeds?: string;
}

/**
 * Thin, typed wrapper over the restful-booker endpoints. Centralises paths and
 * the token-cookie auth header so tests read as intent, not plumbing.
 */
export class BookingApi {
  constructor(private readonly request: APIRequestContext) {}

  auth(username = 'admin', password = 'password123'): Promise<APIResponse> {
    return this.request.post('/auth', { data: { username, password } });
  }

  /** Convenience: authenticate and return the token (throws if none). */
  async token(): Promise<string> {
    const res = await this.auth();
    const { token } = await res.json();
    if (!token) throw new Error('auth did not return a token');
    return token;
  }

  ping(): Promise<APIResponse> {
    return this.request.get('/ping');
  }

  list(): Promise<APIResponse> {
    return this.request.get('/booking');
  }

  filterByName(firstname: string, lastname: string): Promise<APIResponse> {
    return this.request.get(
      `/booking?firstname=${encodeURIComponent(firstname)}&lastname=${encodeURIComponent(lastname)}`,
    );
  }

  create(data: Booking): Promise<APIResponse> {
    return this.request.post('/booking', { data });
  }

  get(id: number): Promise<APIResponse> {
    return this.request.get(`/booking/${id}`);
  }

  update(id: number, token: string, data: Booking): Promise<APIResponse> {
    return this.request.put(`/booking/${id}`, { headers: this.authHeaders(token), data });
  }

  patch(id: number, token: string, data: Partial<Booking>): Promise<APIResponse> {
    return this.request.patch(`/booking/${id}`, { headers: this.authHeaders(token), data });
  }

  /** Update attempt with NO auth — used to assert the 403 path. */
  updateUnauthed(id: number, data: Booking): Promise<APIResponse> {
    return this.request.put(`/booking/${id}`, {
      headers: { 'Content-Type': 'application/json' },
      data,
    });
  }

  remove(id: number, token: string): Promise<APIResponse> {
    return this.request.delete(`/booking/${id}`, { headers: { Cookie: `token=${token}` } });
  }

  private authHeaders(token: string): Record<string, string> {
    return { Cookie: `token=${token}`, 'Content-Type': 'application/json' };
  }
}
