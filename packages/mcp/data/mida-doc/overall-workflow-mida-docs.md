---
title: "Overall Workflow | MIDA Docs"
url: ""
crawledAt: "2026-06-22T03:19:05.844Z"
---
[Skip to content](https://docs.mida-app.io/fraud-filter/overview/overall-workflow/#_top)

# Overall Workflow

### 1\. Incoming Request

[Section titled “1. Incoming Request”](https://docs.mida-app.io/fraud-filter/overview/overall-workflow/#1-incoming-request)

- A visitor enters your Shopify storefront (page view, product, collection).
- Their request carries information such as:
  - IP address (IPv4/IPv6)
  - Geo-location (country, region, city)
  - ISP (Internet Service Provider)
  - Device/browser fingerprints
  - VPN/Proxy/TOR signals (if detected)

* * *

### 2\. Rule Engine Evaluation

[Section titled “2. Rule Engine Evaluation”](https://docs.mida-app.io/fraud-filter/overview/overall-workflow/#2-rule-engine-evaluation)

- The visitor’s request is checked against your **active rules**.
- Rule evaluation includes:
  - **Scope**: Global (entire site), URL-specific (products, collections).
  - **Match Logic**: ANY or ALL conditions must be satisfied.
  - **Priority Handling**: Whitelist rules override blacklist unless configured otherwise.
- The engine determines the **first matching action**.

* * *

### 3\. Actions

[Section titled “3. Actions”](https://docs.mida-app.io/fraud-filter/overview/overall-workflow/#3-actions)

Depending on your rules and settings, MIDA executes one of the following actions:

- **ALLOW** → Normal access to the store.
- **BLOCK** → Display a block page or overlay, preventing access.
- **REDIRECT** → Send visitor to a custom URL (e.g., regional storefront).
- **TAG** → Mark visitor or order for later review.

* * *

### 4\. Logging & Analytics

[Section titled “4. Logging & Analytics”](https://docs.mida-app.io/fraud-filter/overview/overall-workflow/#4-logging--analytics)

- Each decision is logged with details:
  - Visitor IP, location, ISP, device.
  - Rule(s) matched.
  - Action applied.
- Data appears in **Visitor Analytics** and **Fraud Orders Analytics** dashboards.
- You can export logs for compliance or reporting.

* * *

### 5\. Admin Safety & Recovery

[Section titled “5. Admin Safety & Recovery”](https://docs.mida-app.io/fraud-filter/overview/overall-workflow/#5-admin-safety--recovery)

- To prevent accidental lockouts:
  - Admin IPs are **auto-whitelisted**.
  - An **Admin Access URL** is always available to bypass blocks.
  - **Gradual Rollout** allows enabling rules for a small % of visitors first.

MIDA Fraud IP Blocker acts as a **filter between visitors and your storefront**, ensuring only trusted users can browse and buy, while risky traffic is blocked, redirected, or flagged. This keeps your store secure, reduces fraud losses, and gives you fine-grained control over access.

If you have any questions, feel free to contact us via **Crisp Chat** or email us at [support@mida-app.io](mailto:support@mida-app.io?subject=%5BMIDA%20Support%5D%20Question%20about%20Fraud%20Filter&body=Hi%20MIDA%20Team%2C%0A%0AI%20have%20a%20question%20about%20the%20Fraud%20Filter%20app.%20Please%20assist%20me%20with%20the%20following%3A%0A%0A-%20Shop%20URL%3A%20%0A-%20Issue%20details%3A%20%0A%0AThank%20you!%0A%0A%2D%20Your%20Name).