# Max Shipping - Shipping & Receiving Portal

A lightweight browser app for tracking incoming shipments, managing purchase orders, uploading packing slips/POD files, and sending receiving email notifications.

The app now stores shipment data in Supabase and uploads documents/photos to Supabase Storage.

## Key Features

* Order logging for PO numbers, suppliers, items, ordered dates, carriers, and tracking codes.
* Optional ETA dates for incoming orders and daily counters for all three workflows.
* ETA notifications for overdue, due-today, and upcoming incoming shipments.
* Operations Dashboard with today, last-7-days, and current-month metrics, OSD by carrier, and average order-to-receive time.
* Built-in searchable Help & Instructions manual covering every workflow, files, reports, mobile use, and admin controls.
* Trailer tracking with Expected, Arrived, and Dispatched statuses, elapsed arrival-to-dispatch time, searchable PDF/Excel attachments, arrival email templates, and issue photos.
* Warranty claims with status-specific fields, claim/order types, photos, shared editing, and admin-only deletion.
* Panel inspection requests with employee assignment, inspection outcomes, and mandatory completion photos.
* Downloadable PDF reports for Receiving, Shipped Out, Customer Pick Up, Trailer, Warranty, and Panel Inspection records.
* Packing slip, POD, and OSD photo uploads through Supabase Storage.
* Customer Pick Up records with mandatory handoff photos.
* Automatic browser-side optimization for photos larger than 1 MB before Supabase upload (maximum 1920 px dimension).
* Outlook email notifications from the Receive dialog.
* Live courier tracking links for common carriers.
* Multi-user shipment data synchronized through Supabase.
* Shared receiving and Customer Pick Up employee lists, admin passcode hash, email templates, and OSD instructions synchronized through `shipping_settings`.
* Static frontend only: `index.html`, `style.css`, and `app.js`.

## Supabase Setup

Create these tables in the Supabase SQL editor:

```sql
create table if not exists public.shipping_orders (
  id bigint primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipping_settings (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_shipping_orders_updated_at on public.shipping_orders;
create trigger set_shipping_orders_updated_at
before update on public.shipping_orders
for each row execute function public.set_updated_at();

drop trigger if exists set_shipping_settings_updated_at on public.shipping_settings;
create trigger set_shipping_settings_updated_at
before update on public.shipping_settings
for each row execute function public.set_updated_at();
```

Create a Supabase Storage bucket named:

```text
shipping-files
```

The app stores files under:

```text
shipping-files/scans/
shipping-files/osd/
shipping-files/shipped_out/
shipping-files/customer_pickup/
shipping-files/clopay_trailers/
shipping-files/clopay_issues/
shipping-files/warranty/
shipping-files/panel_inspections/
```

## App Configuration

In `app.js`, replace these values with your Supabase project values:

```js
const SUPABASE_URL = 'https://jiwmcrkhpadkzozcdigk.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-SUPABASE-PUBLISHABLE-KEY';
const SUPABASE_STORAGE_BUCKET = 'shipping-files';
```

For a quick internal setup, enable Row Level Security policies that allow your app users to read/write the two tables and upload/read files in the bucket. For production, use Supabase Auth and restrict policies to signed-in company users.

Admin changes are stored in the single `shipping_settings` row with key `default`. Every open browser refreshes these shared settings during the regular 10-second synchronization cycle. The admin passcode is stored as a SHA-256 hash rather than plain text.

## Hosting

Host the static files on a secure HTTPS host such as Vercel, Netlify, GitHub Pages, or an internal HTTPS server. Open the hosted URL on each workstation.
