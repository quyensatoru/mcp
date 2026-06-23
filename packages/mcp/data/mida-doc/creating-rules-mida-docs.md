---
title: "Creating Rules | MIDA Docs"
url: ""
crawledAt: "2026-06-22T03:19:05.844Z"
---
[Skip to content](https://docs.mida-app.io/fraud-filter/rules-management/creating-rules/#_top)

# Creating Rules

### 1\. Rule Type

[Section titled “1. Rule Type”](https://docs.mida-app.io/fraud-filter/rules-management/creating-rules/#1-rule-type)

At the top of the rule creation page, you choose the **rule type**:

- **Blacklist** → Block access if the visitor matches conditions.
- **Redirect** → Redirect the visitor to another URL if conditions match.
- **Whitelist** → Always allow access if conditions match.

![](https://docs.mida-app.io/_astro/Screenshot%202025-09-23%20at%2014.39.40.DYA0jsLY_Z24t8Aj.webp)

Only one type can be selected per rule.

* * *

### 2\. Basic Information

[Section titled “2. Basic Information”](https://docs.mida-app.io/fraud-filter/rules-management/creating-rules/#2-basic-information)

- **Rule name** _(required)_ → Enter a clear, descriptive name (e.g., _Block US VPN traffic_).
- **Description** _(optional)_ → Add a note to explain what this rule is for, useful for teams.

![](https://docs.mida-app.io/_astro/Screenshot%202025-09-23%20at%2014.40.12.3Dg7JBhi_Z2pNfpT.webp)

* * *

### 3\. Conditions

[Section titled “3. Conditions”](https://docs.mida-app.io/fraud-filter/rules-management/creating-rules/#3-conditions)

Conditions define **who the rule applies to**. You can add one or more.

- **Logic**: Choose between **AND** or **OR**:

  - **AND** → all conditions must match.
  - **OR** → only one condition needs to match.

#### Available Conditions

[Section titled “Available Conditions”](https://docs.mida-app.io/fraud-filter/rules-management/creating-rules/#available-conditions)

- **IP/CIDR** → Block or allow a single IP or an IP range (CIDR).
- **Country** → Apply rule by country.
- **Region** → Apply rule by state/province/region.
- **ISP (Internet Provider)** → Target visitors based on their ISP.
- **User Agent** → Match specific browser/device user agents.
- **Referral URL** → Block or allow traffic coming from a specific referral site.

![](https://docs.mida-app.io/_astro/Screenshot%202025-09-23%20at%2014.40.54.DV-2Xehd_2jY8Jd.webp)

You can add multiple conditions by clicking **“Add Another Condition”**.

* * *

### 4\. Scope

[Section titled “4. Scope”](https://docs.mida-app.io/fraud-filter/rules-management/creating-rules/#4-scope)

Define **where** the rule applies:

- **Global** → Applies to all pages across the entire website.
- **URL-specific** → Applies only to the specified page(s). Example: `/collections/automated-collection`.

![](https://docs.mida-app.io/_astro/Screenshot%202025-09-23%20at%2014.43.15.DoefoXbI_ZksEcv.webp)

If you have any questions, feel free to contact us via **Crisp Chat** or email us at [support@mida-app.io](mailto:support@mida-app.io?subject=%5BMIDA%20Support%5D%20Question%20about%20Fraud%20Filter&body=Hi%20MIDA%20Team%2C%0A%0AI%20have%20a%20question%20about%20the%20Fraud%20Filter%20app.%20Please%20assist%20me%20with%20the%20following%3A%0A%0A-%20Shop%20URL%3A%20%0A-%20Issue%20details%3A%20%0A%0AThank%20you!%0A%0A%2D%20Your%20Name).