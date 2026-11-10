export type Stop = {
  id: string;
  name: string;
  address: string;
  phone: string;
  packagesMax: number | null;
};
export type DeliveryPhoto = { id: string; url: string; tag: string };
export type RouteItem = { stop_id: string; packages: number; instructions: string };
export type CreatedRoute = { id: string; status: 'draft'; stops: RouteItem[] };
export interface RouteApi {
  listStops(q: string, signal?: AbortSignal): Promise<Stop[]>;
  getPhotos(id: string, signal?: AbortSignal): Promise<DeliveryPhoto[]>;
  createRoute(items: RouteItem[]): Promise<CreatedRoute>;
}
export type ApiErrorKind =
  | 'validation'
  | 'rate-limit'
  | 'transport'
  | 'invalid-response'
  | 'http'
  | 'cancelled'
  | 'pagination';
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly kind: ApiErrorKind;
  readonly outcome: 'definitive' | 'uncertain';
  readonly status: number | undefined;
  readonly retryAt: number | undefined;
  readonly reason: 'network' | 'timeout' | undefined;
  constructor(
    kind: ApiErrorKind,
    message: string,
    details: {
      outcome: 'definitive' | 'uncertain';
      status?: number;
      retryAt?: number;
      reason?: 'network' | 'timeout';
    }
  ) {
    super(message);
    this.kind = kind;
    this.outcome = details.outcome;
    this.status = details.status;
    this.retryAt = details.retryAt;
    this.reason = details.reason;
  }
}
