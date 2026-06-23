# Google Maps setup (location autocomplete)

ReliefTrack uses Google Places Autocomplete on the **New Request** location field, limited to places in the Philippines.

## 1. Enable APIs

In [Google Cloud Console](https://console.cloud.google.com/):

1. Select the same project as Firebase (or create a project).
2. Go to **APIs & Services** → **Library**.
3. Enable **Maps JavaScript API**.
4. Enable **Places API**.

## 2. Create an API key

1. Go to **APIs & Services** → **Credentials** → **Create credentials** → **API key**.
2. **Application restrictions** → HTTP referrers:
   - `http://localhost:5173/*`
   - Add your production URL when you deploy (e.g. `https://yourdomain.com/*`)
3. **API restrictions** → Restrict key → select:
   - Maps JavaScript API
   - Places API
4. Save.

## 3. Add key to the app

1. Copy [`.env.example`](.env.example) to `.env` in the `ReliefTrack` folder.
2. Set:

```
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
```

3. Restart the dev server (`npm run dev`).

## Verify

1. Open `/requests` → **+ New Request**.
2. Click **Location** and type a place name (e.g. `Naga`, `Manila`, `Barangay Mabolo`).
3. Select a suggestion from the dropdown.

If the key is missing, the app uses OpenStreetMap (Philippines) suggestions instead.

## Troubleshooting: "This page can't load Google Maps correctly"

If you see Google's white error dialog, the API key loaded but was **rejected**. The app automatically switches to OpenStreetMap place search so you can still pick locations. To fix Google Places:

### 1. Enable billing

Google Maps requires a billing account on the project (there is a free monthly credit):

1. Open [Google Cloud Billing](https://console.cloud.google.com/billing)
2. Link a billing account to the same project as your API key

### 2. Enable both APIs

In [APIs & Services → Library](https://console.cloud.google.com/apis/library):

- **Maps JavaScript API** — must be enabled
- **Places API** (legacy Places API) — required for the Autocomplete widget

### 3. Fix API key restrictions

In [Credentials](https://console.cloud.google.com/apis/credentials) → your API key:

**Application restrictions** → HTTP referrers — add:

- `http://localhost:5173/*`
- Your production domain when deployed

**API restrictions** → restrict to:

- Maps JavaScript API
- Places API

### 4. Apply changes

1. Wait a few minutes after saving Console changes
2. Hard-refresh the browser (`Ctrl+Shift+R`)
3. Restart `npm run dev` if you changed `.env`

### 5. Check the browser console

Open DevTools (F12) → Console. Common errors:

| Error | Meaning |
|-------|---------|
| `RefererNotAllowedMapError` | Add `http://localhost:5173/*` to key referrers |
| `ApiNotActivatedMapError` | Enable Maps JavaScript API or Places API |
| `BillingNotEnabledMapError` | Attach billing to the project |

When Google is configured correctly, suggestions use Google Places. Until then, OpenStreetMap suggestions (Philippines only) still work.
