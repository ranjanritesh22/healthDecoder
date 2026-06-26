# CLAUDE.md

## Project

Build a minimal, premium, mobile-first React web application called **HealthDecode**.

HealthDecode helps users understand their medical reports in simple, easy-to-read language. The app is designed for ordinary people with no medical background.

---

## Goal

A user uploads a medical report PDF.

The AI reads the report, extracts all laboratory values, interprets them, and generates a clean, well-designed PDF report in either **English** or **Hindi**.

The generated report should explain every important finding in plain language, summarize the user's overall health, and provide practical lifestyle guidance while clearly stating that it is **not a medical diagnosis** and does **not replace a doctor**.

---

## User Flow

Upload PDF

↓

Choose Language (English / हिन्दी)

↓

Generate Report

↓

Download Generated PDF

---

## Design

* Minimal UI
* Premium appearance
* Mobile-first
* Fully responsive
* Single-page application
* No authentication
* No dashboard
* No history
* No user accounts
* Fast and lightweight
* Clean typography with generous whitespace
* Smooth loading animation during AI processing

---

## AI Responsibilities

* Read uploaded PDF (including scanned PDFs when necessary)
* Extract all report values accurately
* Compare values against reference ranges
* Detect normal, high, low, and abnormal findings
* Explain each important parameter in simple language
* Generate an overall health summary
* Suggest general food and lifestyle recommendations based on the report
* Recommend when the user should consult a healthcare professional
* Never diagnose diseases or claim certainty
* Use calm, reassuring, patient-friendly language
* suggest all safety aspects to cure it and what to ask consultants 
* when doctor is needed or not can be cured by healthy lifestyle 
* a proper template pdf beautiful that normal pateint who is not to much educcated can see and read and understand what to do or what not to do 

---

## Generated PDF

Use a fixed, professional template.

Include:

* Patient Information (if available)
* Overall Health Summary
* Important Findings
* Parameter-by-Parameter Explanation
* Food Recommendations
* Foods to Limit
* Lifestyle Suggestions
* Questions to Ask Your Doctor
* Disclaimer
* and add by yourself what things should be added in the pdf template to help a normal educated or less educated people to know a village person as well the template should be like that helpfull for every one educated less doctor everyone 
* uploaded pdf breaks down and call the ai free tier and generate the response 

The PDF should look modern, readable, and printable.

---

## Technology

* React
* TypeScript
* Tailwind CSS
* PDF Upload
* OCR support for scanned reports if needed
* AI-powered interpretation
* PDF generation for final report
* lighteight app

---

## Vision

Build the simplest AI-powered medical report interpreter that removes medical jargon and helps every patient understand their health in plain English or Hindi within a minute

**Simple. Fast. Trustworthy.**
