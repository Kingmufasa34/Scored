/** A normalised inbound email, provider-agnostic. */
export interface EmailMessage {
  id: string;
  from: string;
  to?: string;
  subject: string;
  /** RFC date header / internal date as ISO string. */
  date: string;
  /** Plain-text body (decoded, HTML stripped if only HTML was present). */
  text: string;
  /** Raw HTML body if present. */
  html?: string;
}

/** Abstraction over a mailbox so parsers/pipeline don't depend on Gmail. */
export interface EmailProvider {
  readonly name: string;
  /**
   * Fetch messages matching the provider's configured query/filter.
   * `max` caps how many are returned (newest first).
   */
  fetchMessages(max: number): Promise<EmailMessage[]>;
}
