---
title: "Whitelist & Blacklist Rules | MIDA Docs"
url: ""
crawledAt: "2026-06-22T03:19:05.842Z"
---
[Skip to content](https://docs.mida-app.io/fraud-filter/key-concepts/whitelist-blacklist-rules/#_top)

# Whitelist & Blacklist Rules

### 1\. What is a Rule?

[Section titled “1. What is a Rule?”](https://docs.mida-app.io/fraud-filter/key-concepts/whitelist-blacklist-rules/#1-what-is-a-rule)

A **rule** is made up of three parts:

1. **Conditions** – What to check (IP, country, region, ISP, user agent, referral URL).
2. **Scope** – Where to apply (Global, URL-specific).
3. **Action** – What happens if the conditions match (Allow, Block, Redirect).

* * *

### 2\. Whitelist

[Section titled “2. Whitelist”](https://docs.mida-app.io/fraud-filter/key-concepts/whitelist-blacklist-rules/#2-whitelist)

**Definition:** Whitelist rules ensure that trusted visitors can always access your store, regardless of other blocking rules.

**Use Cases:**

- Allow your own IP addresses (admin, staff).
- Ensure VIP customers or business partners are never blocked.
- Permit certain countries or ISPs where you operate.
- Allow access to specific products or collections even under broader restrictions.

**Supported Conditions:**

- IP address or range.
- Country, region, or city.
- ISP.
- User agent, referral URL

**Priority:**

- Whitelist rules override blacklist rules (trusted access always wins).
- Exception: future fraud automations may allow overriding whitelist if an order is extremely risky.

* * *

### 3\. Blacklist

[Section titled “3. Blacklist”](https://docs.mida-app.io/fraud-filter/key-concepts/whitelist-blacklist-rules/#3-blacklist)

**Definition:** Blacklist rules explicitly deny access to unwanted or high-risk visitors.

**Use Cases:**

- Block IPs or IP ranges tied to malicious activity.
- Block countries or regions where you do not sell or ship.
- Block ISPs or hosting providers commonly used for proxies.
- Block purchases of specific products/collections from certain regions.

**Supported Conditions:**

- IP address or range.
- Country, region, or city.
- ISP.

**Actions:**

- **Block** → deny access with a block page.
- **Redirect** → send visitor to a different page (e.g., “Not Available in Your Region”).

* * *

### 4\. Whitelist vs. Blacklist Logic

[Section titled “4. Whitelist vs. Blacklist Logic”](https://docs.mida-app.io/fraud-filter/key-concepts/whitelist-blacklist-rules/#4-whitelist-vs-blacklist-logic)

- **Whitelist is evaluated first.** If a visitor matches whitelist conditions, they are always allowed.
- If not on whitelist, the request is checked against blacklist rules.
- If matched → Block or Redirect.
- If no match → default action = Allow.

* * *

### Summary

[Section titled “Summary”](https://docs.mida-app.io/fraud-filter/key-concepts/whitelist-blacklist-rules/#summary)

- **Whitelist**: Always allow trusted visitors (IP, Geo, ISP, Product, Collection).
- **Blacklist**: Explicitly deny risky or unwanted traffic.
- **Together**, they provide precise control over who can view, browse, and order from your Shopify store.

* * *

Next: Content Protection Concepts

If you have any questions, feel free to contact us via **Crisp Chat** or email us at [support@mida-app.io](mailto:support@mida-app.io?subject=%5BMIDA%20Support%5D%20Question%20about%20Fraud%20Filter&body=Hi%20MIDA%20Team%2C%0A%0AI%20have%20a%20question%20about%20the%20Fraud%20Filter%20app.%20Please%20assist%20me%20with%20the%20following%3A%0A%0A-%20Shop%20URL%3A%20%0A-%20Issue%20details%3A%20%0A%0AThank%20you!%0A%0A%2D%20Your%20Name).