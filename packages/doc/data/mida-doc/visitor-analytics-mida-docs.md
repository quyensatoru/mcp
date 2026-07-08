---
title: "Visitor Analytics | MIDA Docs"
url: ""
crawledAt: "2026-06-22T03:19:05.845Z"
---
[Skip to content](https://docs.mida-app.io/fraud-filter/analytics/visitor-analytics/#_top)

# Visitor Analytics

This helps you understand traffic patterns, detect suspicious activity, and take action.

### 1\. Visitor Table

[Section titled “1. Visitor Table”](https://docs.mida-app.io/fraud-filter/analytics/visitor-analytics/#1-visitor-table)

![](https://docs.mida-app.io/_astro/image%20(5).CHx7UjJm_Zr9r2L.webp)

Each row contains:

- **Last Access** → Timestamp of the visit.
- **Visitor IP** → IP address of the visitor.
- **Visit Frequency** → Number of visits from that IP.
- **Internet Provider** → ISP of the visitor.
- **IP Risk Score** → Risk score (0 = safe, higher = more suspicious).
- **Detection** → Classified detection type (see section 2).
- **Visitor Country** → Country of origin.
- **Action** → Actions you can apply to this visitor (block/allow)

* * *

### 2\. Detection Types

[Section titled “2. Detection Types”](https://docs.mida-app.io/fraud-filter/analytics/visitor-analytics/#2-detection-types)

Visitors are classified into 7 categories:

![](https://docs.mida-app.io/_astro/image%20(1)%20(1).BUwy3Lik_Z75SoI.webp)

1. **Clean** → No suspicious signals.
2. **Proxy** → Using anonymous proxy.
3. **VPN** → Browsing through a VPN.
4. **Compromised** → Known compromised IP.
5. **Scraper** → Automated scraping detected.
6. **Tor** → Connected via TOR anonymity network.
7. **Hosting** → IP belongs to hosting/cloud provider.

* * *

### 3\. Filters & Search

[Section titled “3. Filters & Search”](https://docs.mida-app.io/fraud-filter/analytics/visitor-analytics/#3-filters--search)

- **Date range** (e.g., Today, Last 7 days).
- **Country** filter.
- **Visit Frequency** filter.
- **IP Score** filter.
- **Detection type** filter.
- **Search** → by IP, ISP, or keyword.

* * *

### 4\. Actions

[Section titled “4. Actions”](https://docs.mida-app.io/fraud-filter/analytics/visitor-analytics/#4-actions)

You can apply actions directly from the visitor table:

- **Allow (Whitelist)** → Always allow this visitor, bypassing other rules.
- **Block (Blacklist)** → Immediately block this visitor, showing the block page or overlay.
- **Redirect** → Send the visitor to a custom URL (e.g., “Not available in your region” or a landing page).

These actions can be applied per visitor or in bulk using checkboxes.

* * *

### Best Practices

[Section titled “Best Practices”](https://docs.mida-app.io/fraud-filter/analytics/visitor-analytics/#best-practices)

- **Whitelist** known partners, staff, or VIP customers.
- **Block** suspicious IPs with high risk scores or flagged as Proxy/VPN/TOR.
- **Redirect** when you want to guide traffic away (e.g., region not served → redirect to an informational page instead of a hard block).
- Always review **Visit Frequency** \+ **Detection type** before deciding.

If you have any questions, feel free to contact us via **Crisp Chat** or email us at [support@mida-app.io](mailto:support@mida-app.io?subject=%5BMIDA%20Support%5D%20Question%20about%20Fraud%20Filter&body=Hi%20MIDA%20Team%2C%0A%0AI%20have%20a%20question%20about%20the%20Fraud%20Filter%20app.%20Please%20assist%20me%20with%20the%20following%3A%0A%0A-%20Shop%20URL%3A%20%0A-%20Issue%20details%3A%20%0A%0AThank%20you!%0A%0A%2D%20Your%20Name).