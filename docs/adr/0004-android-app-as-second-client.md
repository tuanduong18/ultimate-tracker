# 4. An Android app as a second client of the same backend

- Status: Accepted
- Date: 2026-11-03

## Context

Ultimate Tracker was scoped as web-only, with manual logging by design. The Developer Guide
listed an Android companion as explicitly out of scope, and three specs carried the same line:
Health Connect step sync, automatic screen time, and any notification that reaches a closed app
were all "Future, not while web-only".

That position held while Finance was the only domain. It does not hold for what comes next:

- **Steps** are measured by the phone in the user's pocket. Typing a number the phone already
  knows into a web form every day is the kind of chore that ends a tracking habit within a week.
- **Screen time** cannot be entered honestly by hand at all. Nobody knows how long they spent in
  an app; that is the whole reason to track it. Only Android's usage statistics know.
- **Notifications** stop at the bell in the web header. A subscription reminder or a budget
  alert is worth most when it reaches someone who is not looking at the app, and a web page has
  no reliable way to do that on a phone.

The users are the author and a few friends, all on Android. None of them need a store listing.

Three ways to get onto the phone were weighed:

**A PWA**, the old §15 suggestion. An installable icon and offline pages, but no access to
Health Connect or usage statistics. It solves the least important of the three problems.

**Wrap the Next.js app in a native shell** (Capacitor). Reuses every screen, but the hardware
features still need native plugins, the app would need a static export it does not have today,
and the result feels like a web page on a phone, because it is one.

**A native client written for the phone.** More code, since the screens are written twice. In
exchange the hardware is first-class, and the UI follows Android's own conventions instead of
imitating them.

## Decision

Build an **Android app as a second client** of the same FastAPI backend and Supabase project. It
lives in its own top-level folder, `mobile/`, beside `frontend/` — not `android/`, which Expo
generates inside the app.

**Full parity, not a companion.** Every user-facing feature exists on both clients. The Android
app reaches parity with what the web has shipped before it takes on hardware features, and from
then on a feature is not done until both clients have it. The phone adds what only a phone can
do; it never lacks what the web has.

**Stack:**

- **Expo (React Native) in strict TypeScript**, with Expo Router. Same language and React model
  as `frontend/`, so the API client, error shape and Supabase auth port across almost unchanged,
  and the route layout mirrors the App Router's.
- **Development builds, not Expo Go**, because the hardware features need native code.
- **Small Expo Modules in Kotlin** wherever no maintained library exists — first, usage
  statistics for screen time.
- **The phone's own sensors first**: steps from its step-counter chip, sleep and screen time
  from usage statistics. **Health Connect is opt-in**, per data type, for a watch that sees more;
  nothing depends on it.
- **Notifications without server push.** The phone fetches new notifications in the background
  and shows them locally, and raises its own — allowance warnings, the focus timer, reminders the
  user set. No Firebase, no push service, no device registry. Every server notification is either
  days early or fine within an hour or two, so instant delivery buys nothing yet.
- **Theme tokens generated from the same palette script** that writes the web's `globals.css`,
  so the eight colour schemes and dark mode are one design across both clients.

**Distribution is a sideloaded APK**, not a store listing and not an AAB. EAS Build produces the
signed APK, GitHub Releases hosts it, and EAS Update ships JavaScript-only changes over the air so
most releases need no reinstall. The app is not registered with Google's developer
verification, which has applied in Singapore since 30 September 2026: each user allows apps from
unverified developers once per phone. A free limited distribution account would remove that step
if it ever matters (see [platform.md](../features/platform.md#android-app)).

## Consequences

- Steps and screen time arrive without typing, and reminders and alerts reach a phone in a
  pocket. The domains that were going to depend on daily discipline get a measured signal
  instead.
- **Cost: every screen is written twice.** This is the price of parity with native UI, and the
  reason the parity rule is written down. A feature landing on one client only is a gap that
  must be recorded in [`docs/features/README.md`](../features/README.md), not an option.
- **Cost: a third CI workflow and a release process.** `mobile-ci` follows the same `changes` →
  job → `*-ci-ok` gate pattern as the other two. Releasing means building an APK or publishing an
  over-the-air update, neither of which Vercel or Render does for us.
- **Cost: notifications from the server can lag.** One reaches the tray at the phone's next
  background run — up to about two hours after the job writes it, longer on a phone whose battery
  saver stops the app. Server push can be added later without changing anything else: it would
  read the same table.
- **Cost: the signing key matters.** Losing it forces every user to uninstall and reinstall. Their
  data lives on the server and survives that, but the key is backed up with EAS.
- **Cost: background work on Android is best-effort.** WorkManager runs about hourly at best, and
  phone makers' battery savers delay it further. Every sync endpoint is an idempotent batch
  upsert, so a late or repeated run catches up rather than double-counting.
- Two clients make API drift more likely. The Android app generates its types from the
  backend's OpenAPI schema rather than hand-copying them; the web can adopt the same later.
- The README's "manual logging by design" stance is retired for what a phone measures. Manual
  entry stays everywhere. When it disagrees with the phone, the phone's measurement wins and the
  user is told, never silently overwritten (see [fitness.md](../features/fitness.md#phone-sync)).
- iOS is not planned. Expo keeps the door open, but nothing here commits to it.

The plan, in order: skeleton and sign-in, parity with Finance and the platform screens (with
every write going through an offline outbox from the start), phone notifications, then Fitness
v0.2 with steps from the phone and Time v0.2 with screen time, both built on backend, web and
Android together. See
[`DeveloperGuide.md` § 14](../../DeveloperGuide.md#14-release-plan).
