import type { WorkCalendarBridge } from './shared/contracts';

declare global {
  interface Window {
    workCalendar?: WorkCalendarBridge;
  }
}

export {};
