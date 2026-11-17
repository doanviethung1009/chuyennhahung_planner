import { notFound } from 'next/navigation';

/**
 * Any unknown URL under `/admin` ends in the admin 404 (ADR 0023 §5), the same
 * page a forbidden role gets, so the 404 reveals nothing about which admin
 * routes exist. It checks no session and reads no data.
 */
export default function AdminUnknownRoute() {
  notFound();
}
