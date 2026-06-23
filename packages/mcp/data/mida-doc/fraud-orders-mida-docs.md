---
title: "Fraud Orders | MIDA Docs"
url: ""
crawledAt: "2026-06-22T03:19:05.844Z"
---
[Skip to content](https://docs.mida-app.io/fraud-filter/analytics/fraud-orders/#_top)

# Fraud Orders

![](https://docs.mida-app.io/_astro/image%20(3).D3bBSoOW_Z1N9Kkc.webp)

### 1\. Orders Table

[Section titled “1. Orders Table”](https://docs.mida-app.io/fraud-filter/analytics/fraud-orders/#1-orders-table)

Columns include:

- **Last Access** → When the order was placed.
- **Order ID** → Unique order identifier.
- **Order Type** → Risk level: None, Low, Medium, High.
- **Visitor IP** → IP used to place the order.
- **Total Price** → Order value.
- **IP Score** → Reputation score for the IP.
- **Detection** → Traffic type (Proxy, VPN, etc.).
- **Order Score** → Fraud score calculated by system.
- **Action** → Apply enforcement to visitor IP.

* * *

### 2\. Order Risk Types

[Section titled “2. Order Risk Types”](https://docs.mida-app.io/fraud-filter/analytics/fraud-orders/#2-order-risk-types)

- **None** → No risk detected.
- **Low risk** → Likely safe.
- **Medium risk** → Some suspicious signals, review before fulfillment.
- **High risk** → Strong indicators of fraud, do not fulfill without verification.

* * *

### 3\. Detection Types

[Section titled “3. Detection Types”](https://docs.mida-app.io/fraud-filter/analytics/fraud-orders/#3-detection-types)

![](https://docs.mida-app.io/_astro/image%20(4).aFtfiwsq_ZCfFwe.webp)

Same as in Visitors:

- **Clean** → No suspicious signals.
- **Proxy** → Using anonymous proxy.
- **VPN** → Browsing through a VPN.
- **Compromised** → Known compromised IP.
- **Scraper** → Automated scraping detected.
- **Tor** → Connected via TOR anonymity network.
- **Hosting** → IP belongs to hosting/cloud provider.

* * *

### 4\. Filters & Search

[Section titled “4. Filters & Search”](https://docs.mida-app.io/fraud-filter/analytics/fraud-orders/#4-filters--search)

- Filter by Date Range, Total Price, Detection, IP Score.
- Search by IP or Order ID.

* * *

### 5\. Actions (IP Blocking)

[Section titled “5. Actions (IP Blocking)”](https://docs.mida-app.io/fraud-filter/analytics/fraud-orders/#5-actions-ip-blocking)

From the **Action** column, you can:

- **Block Visitor IP** → Adds the IP that placed the order to your **Blacklist** immediately. Future visits from this IP will be denied or redirected according to your rules.
- This prevents repeat fraud attempts from the same source.

Currently, **Actions are limited to blocking visitor IPs**. Planned features will include **auto-cancel high risk orders** and **conditional checkout blocking**.

* * *

### Best Practices

[Section titled “Best Practices”](https://docs.mida-app.io/fraud-filter/analytics/fraud-orders/#best-practices)

- Always review **High Risk** orders → block the visitor IP if fraudulent.
- Place **Medium Risk** orders on hold for manual verification.
- Keep exporting fraud order logs for compliance and deeper analysis.

If you have any questions, feel free to contact us via **Crisp Chat** or email us at [support@mida-app.io](mailto:support@mida-app.io?subject=%5BMIDA%20Support%5D%20Question%20about%20Fraud%20Filter&body=Hi%20MIDA%20Team%2C%0A%0AI%20have%20a%20question%20about%20the%20Fraud%20Filter%20app.%20Please%20assist%20me%20with%20the%20following%3A%0A%0A-%20Shop%20URL%3A%20%0A-%20Issue%20details%3A%20%0A%0AThank%20you!%0A%0A%2D%20Your%20Name).