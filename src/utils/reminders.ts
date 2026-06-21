/**
 * Best-effort daily reminder. Without a push backend a PWA can only reliably
 * fire a notification while a tab/service-worker is alive, so this schedules an
 * in-page timer to the next occurrence of `hour:00` and re-arms after firing.
 * Good enough as a nudge when the app is left open; true scheduled push is a
 * later (backend) addition. iOS additionally only allows notifications for an
 * installed PWA on 16.4+.
 */
let timer: ReturnType<typeof setTimeout> | null = null;

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  return Notification.requestPermission();
}

function msUntil(hour: number): number {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function clearReminder(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

export function scheduleReminder(hour: number): void {
  clearReminder();
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const arm = () => {
    timer = setTimeout(() => {
      try {
        new Notification("Habitdashery", {
          body: "Don't forget to check off today's habits and keep your streak alive. 🔥",
          icon: "/icon.svg"
        });
      } catch {
        /* notification may be blocked; ignore */
      }
      arm(); // re-arm for the next day
    }, msUntil(hour));
  };
  arm();
}

export function testNotification(): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  new Notification("Habitdashery", { body: "Reminders are on. 🎉", icon: "/icon.svg" });
}
