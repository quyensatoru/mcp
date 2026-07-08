---
title: "Understanding Risk Scores | MIDA Docs"
url: ""
crawledAt: "2026-06-22T03:19:05.844Z"
---
[Skip to content](https://docs.mida-app.io/fraud-filter/analytics/understanding-risk-scores/#_top)

# Understanding Risk Scores

#### **IP risk score:**

[Section titled “IP risk score:”](https://docs.mida-app.io/fraud-filter/analytics/understanding-risk-scores/#ip-risk-score)

IP Risk Score is a numeric value that indicates how risky an IP address is — based on data from sources like proxycheck.io.

It helps identify potential fraud or abuse by analyzing:

- Use of VPN, Proxy, or TOR
- Presence on global blacklists
- Suspicious browsing behavior
- Known malicious ISPs
- Type of IP (public, private, datacenter, etc.)

🟢 0–30: Low Risk

🟡 31–70: Medium Risk

🔴 71–100: High Risk

In MIDA Fraud Filter, IP Blocker, the score is used to:

- Flag or block high-risk visitors automatically
- Show insights in Visitor Analytics
- Support smarter fraud prevention decisions

#### **Order risk score:**

[Section titled “Order risk score:”](https://docs.mida-app.io/fraud-filter/analytics/understanding-risk-scores/#order-risk-score)

This is a score that evaluates the risk level of a specific order or transaction based on Shopify.

**(Coming soon)** We’re building a smarter, fully configurable fraud score that analyzes more than just IP and address.

If you have any questions, feel free to contact us via **Crisp Chat** or email us at [support@mida-app.io](mailto:support@mida-app.io?subject=%5BMIDA%20Support%5D%20Question%20about%20Fraud%20Filter&body=Hi%20MIDA%20Team%2C%0A%0AI%20have%20a%20question%20about%20the%20Fraud%20Filter%20app.%20Please%20assist%20me%20with%20the%20following%3A%0A%0A-%20Shop%20URL%3A%20%0A-%20Issue%20details%3A%20%0A%0AThank%20you!%0A%0A%2D%20Your%20Name).