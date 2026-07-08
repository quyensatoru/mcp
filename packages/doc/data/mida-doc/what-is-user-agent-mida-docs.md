---
title: "What is user agent? | MIDA Docs"
url: ""
crawledAt: "2026-06-22T03:19:05.842Z"
---
[Skip to content](https://docs.mida-app.io/fraud-filter/faq/what-is-user-agent/#_top)

# What is user agent?

A user agent is a text string sent by a browser, bot, or automation tool when it accesses your store. It provides metadata about the software or environment making the request—such as the browser name, version, device type, and platform.

It’s essentially the digital signature of each visitor or request.

Example:

Mozilla/5.0 (Macintosh; Intel Mac OS X 10\_15\_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36

Why User Agent matters:

MIDA Fraud Filter, IP Blocker uses User Agent data to:

- Detect automation tools and headless browsers.
- Identify bots and scrapers trying to bypass traditional IP/country filters.
- Allow merchants to define targeted conditions to block suspicious access.

Where to find it:

You can define User Agent-based rules under:

→ Conditions > User Agent (as shown in the Rule Builder UI)

![](https://docs.mida-app.io/_astro/image%20(6).DyFqCyuv_Wca59.webp)

Supported User Agent types:

Here are the common automation and scraping tools that MIDA detects and allows you to block:

🛠 Common headless browsers & automation tools:

- HeadlessChrome – headless version of Google Chrome used for automation.
- PhantomJS – deprecated headless browser, still used by legacy scrapers.
- Selenium – popular browser automation framework.
- Puppeteer – Node.js automation tool for Chrome.

🕷 Scraping & script clients:

- curl – command-line HTTP client.
- python-requests – common Python library used for bots/scrapers.
- scrapy – scraping framework built in Python.
- apache-httpclient – Java-based HTTP automation tool.

🧠 How this improves protection:

Many bots and scrapers rely on one of the tools above. By detecting and filtering traffic based on these User Agent signatures, you can:

- Block non-human traffic.
- Prevent fake orders or scraping of your product catalog.
- Reduce fraud and bandwidth abuse.

Important:

Some advanced bots may spoof user agents. Combine this with other rules (IP, VPN, behavior, ISP, etc.) for better accuracy.

If you have any questions, feel free to contact us via **Crisp Chat** or email us at [support@mida-app.io](mailto:support@mida-app.io?subject=%5BMIDA%20Support%5D%20Question%20about%20Fraud%20Filter&body=Hi%20MIDA%20Team%2C%0A%0AI%20have%20a%20question%20about%20the%20Fraud%20Filter%20app.%20Please%20assist%20me%20with%20the%20following%3A%0A%0A-%20Shop%20URL%3A%20%0A-%20Issue%20details%3A%20%0A%0AThank%20you!%0A%0A%2D%20Your%20Name).