---
title: "API Data Export | MIDA Docs"
url: ""
crawledAt: "2026-06-22T03:19:05.844Z"
---
[Skip to content](https://docs.mida-app.io/recordings/settings/api-data-export/#_top)

# API Data Export

### Overview

[Section titled “Overview”](https://docs.mida-app.io/recordings/settings/api-data-export/#overview)

This guide provides instructions for synchronizing analytics data using the MIDA Sessions Replay & Heatmap API, including in-app configuration for sync frequency and API key management, as well as the cURL request format.

### Prerequisites

[Section titled “Prerequisites”](https://docs.mida-app.io/recordings/settings/api-data-export/#prerequisites)

- **API Endpoint**: `https://mida-session-recording-replay.bsscommerce.com/apiv1/analytics/sync`
  - **API Key**: Generated and named via the in-app API Configuration Screen.
- **Tool**: cURL or any HTTP client for making POST requests.
- **Access**: Admin access to the MIDA application for configuration.

![API Data export settings](https://docs.mida-app.io/_astro/API-setting.BELXSrRF_2tXrpq.webp)

### In-App Configuration

[Section titled “In-App Configuration”](https://docs.mida-app.io/recordings/settings/api-data-export/#in-app-configuration)

#### API Configuration Screen

[Section titled “API Configuration Screen”](https://docs.mida-app.io/recordings/settings/api-data-export/#api-configuration-screen)

1. **Navigate to Settings**:

   - Go to the “Analytics API Data Export” section in the MIDA application.
2. **Enable API**:

   - Toggle **API Status** to \[Activated\].
3. **Generate API Key**:

   - Click \[Generate API Key\].
   - Copy the generated key using the \[Copy Button\] for use in API requests.
4. **Set Sync Frequency**:

   - Select from the **Data Sync Frequency** dropdown:

     - **Daily**: Syncs data from the previous day.
     - **Weekly**: Syncs data from the previous week.
5. **(Optional) Configure Email Notifications**:

   - Choose “Notify me when data sync is successful” in **Receive email Notifications.**
   - Enter **Recipient** (default as store email).
6. **Save Settings**:

   - Click \[Save\] on the top barto apply changes.

![Save Settings](https://docs.mida-app.io/_astro/Save.Lq4NVGmq_ZpqkIX.webp)

### API Request

[Section titled “API Request”](https://docs.mida-app.io/recordings/settings/api-data-export/#api-request)

To synchronize analytics data, use the following cURL command, ensuring the frequency matches the in-app setting:

```
curl -X POST \\

  <https://mida-session-recording-replay.bsscommerce.com/apiv1/analytics/sync> \\

  -H 'Content-Type: application/json' \\

  -H 'x-mida-secret-key: {your_api_key}' \\
```

#### Parameters

[Section titled “Parameters”](https://docs.mida-app.io/recordings/settings/api-data-export/#parameters)

- **Method**: POST
- **Headers**:

  - `Content-Type: application/json`
  - `Mida-api-key: {your_api_key}` (Replace `{your_api_key}` with your generated API key in **API secret key**)

#### Example

[Section titled “Example”](https://docs.mida-app.io/recordings/settings/api-data-export/#example)

```
curl -X POST \\

  <https://mida-session-recording-replay.bsscommerce.com/apiv1/analytics/sync> \\

  -H 'Content-Type: application/json' \\

  -H 'x-mida-secret-key: abc123xyz789' \\
```

### Response

[Section titled “Response”](https://docs.mida-app.io/recordings/settings/api-data-export/#response)

- **Success**: Returns synced data (e.g., Total Visitors, Total Sessions, Successful Orders, etc.).
- **Failure**: Returns error message (e.g., “Invalid API key” or “Sync failed”).

### Monitoring

[Section titled “Monitoring”](https://docs.mida-app.io/recordings/settings/api-data-export/#monitoring)

- **Email Notifications**:

  - **Success**:

    - Subject: “\[Analytics Sync\] Success - \[YYYY-MM-DD HH:mm\]”
    - Content: Timestamp, Status.
  - **Failure**:

    - Subject: “\[Analytics Sync\] Failed - \[YYYY-MM-DD HH:mm\]”
    - Content: Timestamp, Status.

### Re-generate API secret key

[Section titled “Re-generate API secret key”](https://docs.mida-app.io/recordings/settings/api-data-export/#re-generate-api-secret-key)

To remove an old API key, click “Regenerate secret key” and regenerate a new one when needed:

![](https://docs.mida-app.io/_astro/image%20(341).B3HOMfu__Z1dgga8.webp)

_Regenerate secret key_

### Notes

[Section titled “Notes”](https://docs.mida-app.io/recordings/settings/api-data-export/#notes)

- Keep the API key secure and regenerate if compromised.
- For support, contact the MIDA team via the provided support channel.

If you have any questions, feel free to contact us via **Crisp Chat** or email us at [support@mida-app.io](mailto:support@mida-app.io?subject=%5BMIDA%20Support%5D%20Question%20about%20Fraud%20Score&body=Hi%20MIDA%20Team%2C%0A%0AI%20have%20a%20question%20about%20the%20Fraud%20Score%20feature.%20Please%20assist%20me%20with%20the%20following%3A%0A%0A-%20Shop%20URL%3A%20%0A-%20Issue%20details%3A%20%0A%0AThank%20you!%0A%0A%2D%20Your%20Name).