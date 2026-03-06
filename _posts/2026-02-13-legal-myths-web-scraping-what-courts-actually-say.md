---
title: "Legal Myths About Web Scraping: What the Courts Actually Say"
date: 2026-02-13 16:00:00 +0000
categories: ["Ethics and Legal"]
tags: ["legal", "myths", "web scraping", "law", "court cases", "CFAA", "copyright", "terms of service"]
author: arman
image:
  path: /assets/img/2026-02-13-legal-myths-web-scraping-what-courts-actually-say-hero.png
  alt: "Legal Myths About Web Scraping: What the Courts Actually Say"
---

Most of what people believe about the legality of web scraping is wrong. Online forums, developer communities, and even some professional publications repeat claims that have been contradicted, clarified, or significantly narrowed by actual court rulings. The result is a landscape where scrapers are either paralyzed by fears that have no legal basis, or reckless because they assume protections that do not exist. Neither position is useful. This post walks through seven of the most persistent legal myths about web scraping and examines what courts in the United States and Europe have actually said about each one. The goal is not to provide legal advice -- it is to replace folklore with citations.

**Disclaimer:** This article is for educational purposes only and does not constitute legal advice. Laws vary by jurisdiction and change over time. If you face a legal question about web scraping, consult a qualified attorney in the relevant jurisdiction.

## Myth 1: "All Web Scraping Is Illegal"

This is the most common myth, and it is flatly wrong. There is no law in the United States or the European Union that makes web scraping illegal as a general category. Scraping is a method of data collection -- it is the automated equivalent of a human visiting a webpage and copying down information. Whether a particular scraping operation is lawful depends on what data is being collected, how it is being accessed, and what is done with it afterward.

The landmark case here is **hiQ Labs, Inc. v. LinkedIn Corp.**, decided by the Ninth Circuit Court of Appeals in 2022 and left standing when the Supreme Court declined to hear LinkedIn's appeal. In this case, hiQ scraped publicly available LinkedIn profile data to build workforce analytics products. LinkedIn sent a cease-and-desist letter and attempted to block hiQ's scrapers. hiQ sued for an injunction, and the Ninth Circuit ruled in hiQ's favor on multiple occasions.

The court's reasoning was significant. It held that accessing publicly available data on the open internet does not constitute a violation of the Computer Fraud and Abuse Act (CFAA), because the CFAA's prohibition on "unauthorized access" was designed to address hacking -- breaking into systems that require authentication -- not reading pages that anyone with a web browser can view. The court drew a clear line: if a website makes data available to the general public without requiring a login, scraping that data is not "unauthorized access" under the CFAA.

This does not mean all scraping is legal. It means that the blanket claim "scraping is illegal" has no basis in current case law. The legality depends entirely on the specific circumstances.

## Myth 2: "If It Is on the Internet, You Can Scrape It Freely"

This myth is the opposite extreme, and it is equally wrong. The fact that data is publicly accessible does not mean there are no restrictions on how you collect, store, or use it. Several categories of data carry legal obligations even when they are technically visible to anyone with a browser.

### Authenticated and Private Data

Data behind a login wall is fundamentally different from data on a public page. The CFAA's "unauthorized access" provisions apply much more strongly here. If you create an account, agree to terms of service that prohibit scraping, and then scrape anyway, you are in a weaker legal position. The Supreme Court's 2021 decision in **Van Buren v. United States** narrowed the CFAA's scope by rejecting the "exceeds authorized access" theory for people who misuse data they are authorized to see -- but this narrowing primarily helps insiders (like employees who misuse databases), not scrapers who create accounts specifically to circumvent access controls.

### Copyrighted Content

Scraping copyrighted text, images, or media for commercial redistribution raises copyright infringement claims that are entirely separate from the CFAA. If you scrape an entire news article and republish it on your own site, the fact that the article was publicly accessible is not a defense. Copyright protects the expression regardless of how easy it was to access. The fair use doctrine may apply in some cases -- particularly for transformative uses like search indexing or academic research -- but wholesale copying for competing commercial purposes will almost certainly fail a fair use analysis.

### Personal Data Under Privacy Laws

The European Union's General Data Protection Regulation (GDPR) applies to the processing of personal data of EU residents regardless of where the scraper is located. "Personal data" under GDPR is defined broadly: names, email addresses, IP addresses, location data, and any information that can be linked to an identifiable individual. Scraping publicly available personal data is still "processing" under GDPR, and it still requires a lawful basis. The most commonly invoked basis for scraping is "legitimate interest" under Article 6(1)(f), but this requires a balancing test that weighs the scraper's interest against the data subject's rights.

In the United States, the California Consumer Privacy Act (CCPA) and its successor, the California Privacy Rights Act (CPRA), impose similar -- though less sweeping -- obligations on businesses that collect personal information of California residents.

The takeaway: public availability is necessary but not sufficient. You still need to evaluate copyright, privacy, and contractual dimensions.

<figure>
  <img src="/assets/img/legal-myths-gavel.jpg" alt="Justice scales and gavel on a wooden surface" loading="lazy">
  <figcaption>The law doesn't deal in absolutes — context decides everything. <span class="img-credit">Photo by www.kaboompics.com / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Myth 3: "Terms of Service Are Legally Enforceable Against Scrapers"

This is one of the most nuanced areas, and blanket statements in either direction are misleading. The enforceability of Terms of Service (TOS) against scrapers depends heavily on how those terms were presented and whether the scraper can be said to have agreed to them.

### Browse-Wrap Agreements

Most websites present their terms of service as a link in the footer -- a "browse-wrap" agreement. The legal theory is that by using the site, you agree to the terms. Courts have been consistently skeptical of browse-wrap enforceability, particularly against automated agents. The key question is whether the user had "reasonable notice" of the terms and manifested "assent" to them.

In **Nguyen v. Barnes & Noble, Inc.** (9th Cir., 2014), the court held that a browse-wrap agreement was unenforceable because the website did not provide sufficient notice that browsing constituted acceptance of the terms. The user was never required to click anything, and the terms link was not conspicuous.

For scrapers, the situation is even weaker. A bot does not read footer links. A bot does not manifest assent. Courts have generally recognized that browse-wrap terms are difficult to enforce against automated data collection because the entire theory of consent relies on a human user who can reasonably be expected to notice and read the terms.

### Click-Wrap Agreements

Click-wrap agreements -- where a user must check a box or click a button indicating agreement before proceeding -- are much more enforceable. If a scraper creates an account and clicks through an agreement that prohibits scraping, the scraper has a real problem. This is a contractual relationship with clear assent, and courts routinely enforce click-wrap terms.

In **Meta Platforms, Inc. v. Bright Data Ltd.** (N.D. Cal., 2024), the court addressed this distinction directly. Bright Data had scraped data from Facebook and Instagram. Meta argued that Bright Data violated its Terms of Service. The court's analysis turned on which data was behind a login wall (where TOS had been agreed to via click-wrap) versus data on public pages (where the TOS argument was weaker). The court dismissed several of Meta's claims related to publicly accessible data while allowing claims related to data that required authentication to access.

The practical lesson: if you never create an account and never click through any agreement, browse-wrap TOS claims against you face significant enforceability hurdles. If you create an account to scrape, you are subject to whatever you agreed to.

## Myth 4: "robots.txt Is Legally Binding"

This myth is persistent and entirely wrong. The robots.txt file is a voluntary protocol defined in RFC 9309. It is a convention, not a law. It is not a contract. It does not create legal obligations. No court has ever held that violating robots.txt is, by itself, an actionable legal wrong.

For a deeper dive into [whether robots.txt is legally binding](/posts/is-robots-txt-legally-binding-scraping-law-explained/), we cover the topic in a dedicated post. The Robots Exclusion Protocol was proposed by Martijn Koster in 1994 as a cooperative mechanism for website operators to communicate crawling preferences to well-behaved bots. The key word is "preferences." The file is a request, not a command. Any HTTP client can ignore it without violating any statute.

However -- and this is the critical nuance -- courts have treated robots.txt as evidence of intent when evaluating claims under other legal theories. If a website's robots.txt explicitly disallows scraping of certain paths, and a scraper ignores it, that fact can be used to establish:

- **Knowledge that access was unwanted:** Relevant to CFAA claims about authorization.
- **Bad faith:** Relevant to trespass to chattels claims and copyright fair use analysis.
- **Willfulness:** Relevant to damages calculations in various claims.

In the hiQ v. LinkedIn case, the court noted LinkedIn's use of technical measures (including robots.txt) to try to prevent scraping, but ultimately held that these measures did not transform publicly available data into CFAA-protected data. The robots.txt file was part of the factual record but was not dispositive.

The practical position: ignoring robots.txt does not violate any law by itself, but it can make your legal position worse if you are challenged on other grounds. Respecting it demonstrates good faith. The emerging [IETF aipref proposal](/posts/ietf-aipref-the-new-robots-txt-for-the-ai-era/) may eventually add a new layer of machine-readable preferences alongside robots.txt.

## Myth 5: "You Cannot Get Sued for Scraping"

This is dangerously wrong, and it reflects a fundamental misunderstanding of how the legal system works. You can get sued for anything. The question is not whether you can be sued, but whether you would ultimately be found liable. And the distinction matters enormously, because litigation itself is a weapon.

Filing a lawsuit costs relatively little. Defending against one costs a great deal. Even if a scraping operation is entirely lawful, a well-funded plaintiff can file suit and force the scraper to spend tens or hundreds of thousands of dollars on legal defense before the case is resolved. This is not hypothetical -- it happens regularly.

LinkedIn sued hiQ. The litigation spanned years and went to the appellate courts multiple times. hiQ ultimately prevailed on many of its claims, but the company spent enormous resources defending its position. Not every scraper has the financial capacity to fight a multi-year federal lawsuit.

**Clearview AI** provides another instructive example. Clearview scraped billions of publicly available photos from social media platforms and built a facial recognition database. Multiple entities sued, and Clearview faced enforcement actions from data protection authorities in multiple countries. The company argued that the photos were public, but that argument did not prevent years of litigation and regulatory action. In 2022, Clearview settled with the ACLU in a case brought under Illinois' Biometric Information Privacy Act (BIPA), agreeing to significant restrictions on its business.

The lesson is that legal risk is not binary. The question is never just "is this legal?" It is also "can I afford to prove that it is legal?" and "what will it cost me in the meantime?" Responsible scraping practices reduce the likelihood of litigation, which is valuable regardless of whether you would ultimately win.

<figure>
  <img src="/assets/img/legal-myths-documents.jpg" alt="Person signing legal paperwork at a desk" loading="lazy">
  <figcaption>Getting sued is always possible. Winning is the question. <span class="img-credit">Photo by Tima Miroshnichenko / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Myth 6: "Scraping and Copying Are the Same Thing"

This conflation causes enormous confusion. Scraping is a method of access -- it is the automated retrieval of information from web pages. Copying for redistribution is a use of that information that raises entirely separate legal questions.

The distinction matters because the legal frameworks that govern access (primarily the CFAA) are different from the legal frameworks that govern use (primarily copyright law).

Consider a concrete example. A price comparison service scrapes product prices from multiple retailers. The scraper accesses the pages, extracts structured data (product name, price, availability), and presents aggregated results to its users. This involves:

1. **Access:** The scraper sends HTTP requests and receives HTML responses. Under hiQ v. LinkedIn, accessing publicly available pages is generally not a CFAA violation.

2. **Extraction:** The scraper parses the HTML to extract specific facts. Under U.S. copyright law, facts are not copyrightable. The Supreme Court established this clearly in **Feist Publications, Inc. v. Rural Telephone Service Co.** (1991): a compilation of facts can be copyrighted only if it involves a minimally creative selection or arrangement, and even then, the individual facts themselves remain unprotectable.

3. **Presentation:** The scraper displays the facts in its own format. As long as it is not copying the retailer's creative expression (layout, descriptions, images), this is generally permissible.

Now change the example: a scraper copies entire news articles and republishes them verbatim on an ad-supported website. The access method is the same, but the use is fundamentally different. The scraper is copying protected creative expression for a commercial purpose that directly substitutes for the original. This is likely copyright infringement regardless of whether the scraping itself was lawful.

The legal question is always two-part: was the access lawful, and was the use lawful? They are independent inquiries.

## Myth 7: "European Law Prohibits All Scraping"

European law is more restrictive than U.S. law in several respects, but it does not prohibit all scraping. The relevant frameworks are the GDPR (for personal data) and the EU Database Directive (for databases).

### GDPR and Personal Data

GDPR applies when you process personal data of individuals in the EU. "Processing" includes collection, storage, analysis, and any other operation performed on the data. Scraping personal data from public sources is processing under GDPR, and it requires a lawful basis.

The six lawful bases are: consent, contract, legal obligation, vital interests, public task, and legitimate interest. For scrapers, the most relevant basis is "legitimate interest" under Article 6(1)(f). This is not an automatic license -- it requires a three-part balancing test:

1. Is there a legitimate interest being pursued?
2. Is the processing necessary for that interest?
3. Does the interest override the fundamental rights and freedoms of the data subjects?

Some scraping activities can satisfy this test. Market research, academic study, and journalism have all been recognized as legitimate interests that can justify processing public personal data. But scraping personal data at scale for commercial purposes -- particularly for profiling or surveillance -- will often fail the balancing test.

The Clearview AI enforcement actions across Europe illustrate the limits. Data protection authorities in France (CNIL), Italy (Garante), and the UK (ICO) all imposed significant fines on Clearview AI for scraping publicly available facial images without a valid lawful basis. The French CNIL imposed a 20 million euro fine. The Italian Garante imposed a 20 million euro fine. These decisions established that public availability of photos does not create a lawful basis for mass biometric processing.

However, scraping non-personal data (product prices, weather data, financial statistics) does not trigger GDPR at all. The regulation applies to personal data only.

### The EU Database Directive

The EU Database Directive (96/9/EC) provides a separate layer of protection called the "sui generis" database right. This right protects databases that involved a "substantial investment" in obtaining, verifying, or presenting their contents. It is a uniquely European right with no direct equivalent in U.S. law.

Under this right, extracting or re-utilizing a "substantial part" of a protected database without authorization can be an infringement. This applies even if the individual data points are factual and non-copyrightable. The protection is for the database as a whole, not the individual entries.

The Court of Justice of the European Union (CJEU) has clarified the scope in several cases. In **Ryanair Ltd v. PR Aviation BV** (2015), the CJEU held that the database right does not apply when the database is made available to the public under a contractual arrangement -- in that case, Ryanair's terms of use could govern access because users had to agree to them. But where no such contractual arrangement exists, the database right must be assessed independently.

The practical implication: scraping European websites that contain personal data requires careful consideration of GDPR. Scraping databases that represent substantial investment in data compilation may trigger the database right. But scraping publicly available non-personal, non-database data is generally not prohibited.

<figure>
  <img src="/assets/img/legal-myths-eu-flags.jpg" alt="European Union flags waving in front of an institutional building" loading="lazy">
  <figcaption>European data law is strict, but it's not a blanket ban on scraping. <span class="img-credit">Photo by Jonas Horsch / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Key Cases: A Reference Summary

Understanding the legal landscape requires familiarity with the cases that shaped it. Here are the most important decisions, with their practical implications for scrapers.

### hiQ Labs, Inc. v. LinkedIn Corp. (9th Cir., 2022)

**Facts:** hiQ scraped publicly available LinkedIn profiles to build workforce analytics products. LinkedIn sent a cease-and-desist letter and deployed technical measures to block hiQ's scrapers.

**Holding:** The Ninth Circuit held that scraping publicly available data does not violate the CFAA. The court reasoned that the CFAA's prohibition on "access without authorization" applies to systems where authorization is required -- not to publicly available websites. The court also granted hiQ a preliminary injunction requiring LinkedIn to remove technical barriers to hiQ's scraping.

**Practical impact:** This is the strongest appellate authority supporting the legality of scraping public data in the United States. It establishes that public websites cannot use the CFAA to prevent scraping of their public-facing content. However, it does not address copyright, privacy, or contractual claims -- only the CFAA.

### Van Buren v. United States (Supreme Court, 2021)

**Facts:** A police officer was convicted under the CFAA for accessing a law enforcement database for a personal purpose (looking up a license plate for money). He had legitimate access to the database but used it for unauthorized reasons.

**Holding:** The Supreme Court held that the CFAA's "exceeds authorized access" provision applies only to those who access information in areas of a computer system that are off-limits to them -- not to those who access information they are entitled to see but use it for improper purposes.

**Practical impact:** This decision narrowed the CFAA significantly. It means that the "exceeds authorized access" theory cannot be used to prosecute someone for misusing data they were authorized to access. For scrapers, this is relevant because it limits the CFAA to genuine access violations (accessing systems without permission) rather than use violations (using lawfully accessed data in ways the website owner dislikes).

### Clearview AI (Multiple Jurisdictions, 2020-2024)

**Facts:** Clearview AI scraped billions of publicly available photos from social media platforms, news sites, and other sources. It built a facial recognition database and sold access to law enforcement agencies and private companies.

**Enforcement actions:** The ACLU sued under Illinois BIPA. Data protection authorities in France, Italy, the UK, Australia, and Canada took enforcement actions. Multiple U.S. states investigated.

**Outcomes:** Clearview settled with the ACLU in 2022, agreeing not to sell its database to most private entities in the U.S. European data protection authorities imposed fines totaling tens of millions of euros. The Australian Information Commissioner ordered Clearview to stop collecting Australian facial images.

**Practical impact:** Clearview demonstrates that scraping public data can still generate massive legal liability when the data is personal (especially biometric), the scale is enormous, and the use is surveillance. It also shows that international enforcement actions can reach companies regardless of where they are located.

### Meta Platforms, Inc. v. Bright Data Ltd. (N.D. Cal., 2024)

**Facts:** Bright Data scraped data from Facebook and Instagram. Meta sued, alleging violations of its Terms of Service, the CFAA, and state laws. Bright Data argued that publicly available data could be scraped freely under hiQ.

**Holding:** The court drew a distinction between publicly available data and data behind a login wall. It dismissed several of Meta's claims regarding publicly available data but allowed claims to proceed regarding data that required authentication to access. The court found that Bright Data had agreed to Meta's Terms of Service by creating accounts and could be bound by those terms with respect to authenticated content.

**Practical impact:** This case refined the hiQ framework by clarifying that the public-data defense does not extend to data behind a login wall. It also demonstrated that creating an account and agreeing to terms of service creates real contractual obligations that can be enforced against scrapers.

## Practical Guidelines for Responsible Scraping

Based on the actual state of the law -- not myths -- here are practical guidelines for reducing legal risk when scraping.

### What You Can Generally Do

- **Scrape publicly available, non-personal, factual data.** Product prices, weather information, public government records, and similar factual data on unauthenticated pages are generally the safest category. hiQ v. LinkedIn strongly supports the legality of this activity under the CFAA, and Feist establishes that facts themselves are not copyrightable.

- **Build transformative products from scraped data.** Aggregation, analysis, and transformation of factual data into new products is the strongest legal position. Some publishers are now exploring [content licensing as an alternative to scraping](/posts/microsofts-content-marketplace-from-scraping-to-licensing/). Price comparison tools, market research platforms, and academic datasets have the best legal footing.

- **Respect rate limits and server capacity.** This is not strictly a legal requirement, but it reduces the risk of trespass to chattels claims (which require showing actual harm to the server) and demonstrates good faith that helps in any legal proceeding.

### What Requires Caution

- **Scraping personal data.** Any identifiable information about real people triggers privacy law considerations. Under GDPR, you need a lawful basis. Under CCPA/CPRA, you may have notification and opt-out obligations. Minimize the personal data you collect, store it securely, and delete it when it is no longer needed.

- **Scraping content behind authentication.** Creating accounts to scrape data that is not publicly available significantly increases your legal exposure. You may be bound by terms of service you agreed to, and accessing authenticated systems without authorization is more clearly within the CFAA's scope.

- **Scraping copyrighted creative content.** If you scrape original articles, images, videos, or other creative works, consider what you are doing with them. Extracting facts from copyrighted works is generally fine. Republishing the creative expression is generally not.

### What You Should Avoid

- **Mass collection of personal data for surveillance or profiling.** Clearview AI's experience demonstrates the regulatory and litigation risk.

- **Scraping in violation of click-wrap agreements you accepted.** If you created an account and agreed to terms, those terms likely bind you.

- **Ignoring cease-and-desist letters.** Even if you believe your scraping is lawful, ignoring a cease-and-desist letter eliminates any argument that you did not know your access was unwanted. It does not make your scraping illegal by itself, but it makes your litigation position significantly worse.

- **Storing more data than you need.** Data minimization is not just a GDPR principle -- it is a practical litigation strategy. The less data you have, the less exposure you face.

## The Uncomfortable Truth About Legal Risk

The honest summary of web scraping law is uncomfortable for people who want bright-line rules. There are very few absolutes. The legality of a scraping operation depends on a matrix of factors:

- Is the data public or behind authentication?
- Is it factual or creative expression?
- Is it personal data?
- Did you agree to any terms of service?
- What jurisdiction are you in, and what jurisdiction are the data subjects in?
- What are you doing with the data?
- How much data are you collecting?
- Are you causing harm to the source website?

No single one of these factors is dispositive. A scraper can be on the right side of six factors and still face serious risk because of the seventh. The [evolution of web scraping detection methods](/posts/evolution-web-scraping-detection-methods-timeline/) over the past decade mirrors this growing legal complexity. The legal landscape is a spectrum, not a binary.

What the courts have actually said is more nuanced than either "all scraping is illegal" or "all scraping is fine." The case law supports a middle position: scraping publicly available factual data without circumventing access controls is generally lawful in the United States, but privacy laws, copyright, contractual obligations, and the sheer cost of litigation create real risks that responsible scrapers must manage.

## Final Word

The myths persist because they are simple, and the law is not. Simplicity is appealing when you want a quick answer to "can I scrape this?" But quick answers in this area are almost always wrong. The responsible approach is to understand the actual legal frameworks, evaluate your specific situation against the relevant case law, and make informed decisions about the risks you are willing to accept.

And if the stakes are high enough to worry about, they are high enough to justify talking to a lawyer.

*This post is for educational purposes only and does not constitute legal advice. The case law discussed is accurate as of the publication date but may be affected by subsequent decisions or legislation. Always consult qualified legal counsel for advice specific to your situation.*
