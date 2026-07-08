---
title: "Advanced Rule Configuration | MIDA Docs"
url: ""
crawledAt: "2026-06-22T03:19:05.844Z"
---
[Skip to content](https://docs.mida-app.io/fraud-filter/rules-management/advanced-rule-configuration/#_top)

# Advanced Rule Configuration

![](https://docs.mida-app.io/_astro/Screenshot%202025-09-23%20at%2015.36.21.1wIjPT12_Z124u1d.webp)

### 1\. Block VPN

[Section titled “1. Block VPN”](https://docs.mida-app.io/fraud-filter/rules-management/advanced-rule-configuration/#1-block-vpn)

- **What it does**: Blocks visitors using known VPN IP addresses.
- **How**: Uses a 3rd-party service (e.g., Proxycheck) to identify VPN traffic.
- **When to use**: Recommended if you want to stop fraudsters hiding behind VPNs.
- ⚠️ Note: Some legitimate customers also use VPNs, so review analytics before enabling.

* * *

### 2\. Block Proxy

[Section titled “2. Block Proxy”](https://docs.mida-app.io/fraud-filter/rules-management/advanced-rule-configuration/#2-block-proxy)

- **What it does**: Blocks visitors using anonymous proxy servers to hide their identity.
- **When to use**: Useful to prevent bot farms or attackers masking their origin.

* * *

### 3\. Block TOR

[Section titled “3. Block TOR”](https://docs.mida-app.io/fraud-filter/rules-management/advanced-rule-configuration/#3-block-tor)

- **What it does**: Blocks all connections from the **TOR network** (The Onion Router).
- **When to use**: TOR is often used for anonymity in fraud attempts, but may block some privacy-conscious users too.

* * *

### 4\. Smart Device Blocking

[Section titled “4. Smart Device Blocking”](https://docs.mida-app.io/fraud-filter/rules-management/advanced-rule-configuration/#4-smart-device-blocking)

- **What it does**: Detects and blocks previously blocked users even if their IP changes.
- **How**: Uses **device fingerprinting** (browser/device identifiers) to recognize returning devices.
- **Benefit**: Stronger than static IP blocking.

* * *

### 5\. Smart Lower Risk Blocking

[Section titled “5. Smart Lower Risk Blocking”](https://docs.mida-app.io/fraud-filter/rules-management/advanced-rule-configuration/#5-smart-lower-risk-blocking)

- **What it does**: Detects risky traffic or orders (based on fraud scoring) and blocks them automatically.
- **How**: Feature combining Shopify’s Fraud Analysis + device/IP information.
- **Use Case**: Automate blocking of repeat high-risk orders.

* * *

### 6\. Allow Apple iCloud Private Relay

[Section titled “6. Allow Apple iCloud Private Relay”](https://docs.mida-app.io/fraud-filter/rules-management/advanced-rule-configuration/#6-allow-apple-icloud-private-relay)

- **What it does**: Allows visitors browsing via Apple’s **iCloud Private Relay** service.
- **Why**: Many Safari/iOS users enable this privacy feature, which can appear as masked IPs.
- **Tip**: Keep enabled if you serve many Apple users, to avoid blocking legitimate customers.

* * *

### 7\. Admin Access URL

[Section titled “7. Admin Access URL”](https://docs.mida-app.io/fraud-filter/rules-management/advanced-rule-configuration/#7-admin-access-url)

- **What it does**: Provides a secret URL (e.g., `/admin-access`) that lets store admins bypass all block rules.
- **Why**: Ensures you never accidentally block yourself or your team.
- **How**:

1. Copy the URL provided in this section.
2. Store it securely.
3. Always use it if you get locked out.

* * *

### Best Practices

[Section titled “Best Practices”](https://docs.mida-app.io/fraud-filter/rules-management/advanced-rule-configuration/#best-practices)

- Enable **Block VPN/Proxy/TOR** if you face repeated attacks from anonymous sources.
- Always configure an **Admin Access URL** first to avoid accidental lockouts.
- Use **Smart Device Blocking** for better long-term protection against repeat offenders.
- Keep **iCloud Private Relay** allowed if you have many Apple users.

If you have any questions, feel free to contact us via **Crisp Chat** or email us at [support@mida-app.io](mailto:support@mida-app.io?subject=%5BMIDA%20Support%5D%20Question%20about%20Fraud%20Filter&body=Hi%20MIDA%20Team%2C%0A%0AI%20have%20a%20question%20about%20the%20Fraud%20Filter%20app.%20Please%20assist%20me%20with%20the%20following%3A%0A%0A-%20Shop%20URL%3A%20%0A-%20Issue%20details%3A%20%0A%0AThank%20you!%0A%0A%2D%20Your%20Name).