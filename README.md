# Government Form Checker

A Node.js-based automation platform for discovering, downloading, validating, extracting, and matching government forms across Philippine government websites.

The project started as a simple government PDF crawler and evolved into an automated document-processing pipeline designed to keep government form records up to date with minimal manual intervention.

## Overview

Government agencies use different website structures, document formats, authentication requirements, and anti-bot protections. This project automates the process of finding and processing their forms while providing safeguards for uncertain results.

### End-to-End Workflow

```text
Agency Sources
      ↓
Scheduled Crawler (Cron)
      ↓
Browser Automation / Web Access
      ↓
Discover Form Documents
      ↓
Download & File Validation
      ↓
Hash / Change Detection
      ↓
Text Extraction
      ↓
Fuzzy Matching
      ↓
Confidence Evaluation
   ↙      ↓       ↘
Auto     Review     AI
Match    Queue    Assist
            ↓
      Admin Approval
            ↓
        Final Record
```

## Key Features

### Automated Crawling

* Crawls government agency websites on a scheduled basis using cron jobs.
* Supports different website structures and agency-specific crawling logic.
* Uses browser automation for sites requiring JavaScript rendering or additional interaction.
* Handles Cloudflare and other anti-bot challenges using multiple browser/access strategies.

### Multi-Browser Automation

Uses a combination of:

* Playwright
* Puppeteer
* Camoufox
* ScraperAPI

Different agencies can require different approaches, so the crawler can use the most appropriate strategy for each source.

### Document Discovery & Validation

* Discovers PDF and supported document links from government websites.
* Downloads newly discovered forms.
* Validates downloaded files using file-type and magic-byte checks.
* Detects invalid or unexpected downloads before they enter the processing pipeline.

### Hash-Based Change Detection

Documents are hashed to determine whether a downloaded file is new or has changed since the previous crawl.

This prevents unnecessary downstream processing when the underlying document has not changed.

```text
Downloaded File
      ↓
Generate Hash
      ↓
Compare With Previous Hash
   ↙          ↘
Same        Changed
 ↓             ↓
Skip       Process
             ↓
        Extract & Match
```

### Document Text Extraction

Extracts text from supported documents for downstream processing.

Current processing includes:

* PDF text extraction using `pdf-parse`
* Docx text extraction using `mammoth`
* Document type detection
* Extraction status tracking for successful, empty, and failed extractions

This also makes it possible to measure documents that may require OCR or additional processing in the future.

### Fuzzy Matching

Discovered documents are matched against existing form records using fuzzy text matching rather than relying only on exact filenames.

This helps handle variations such as:

* different filenames
* spacing differences
* punctuation
* abbreviations
* minor wording changes

Matching can be performed locally without requiring an AI/API call for every document.

### Confidence-Based Automation

Matches are assigned confidence levels so that the system does not treat every result equally.

```text
High Confidence
      ↓
Automatic Match

Medium Confidence
      ↓
Admin Review
      ↓
Top Candidate Matches

Low Confidence
      ↓
AI-Assisted Review
      ↓
Admin Approval
```

The goal is to automate high-confidence work while keeping uncertain decisions visible to a human reviewer.

### AI-Assisted Validation

AI is used as a second opinion for low-confidence matches rather than as the sole decision-maker.

The AI can evaluate candidate matches and provide a recommendation that is then surfaced to the administrator for approval.

This creates a human-in-the-loop workflow:

```text
Automation → AI Recommendation → Human Approval
```

### Admin Review Workflow

Uncertain matches can be routed to an administrator rather than being silently applied.

The review workflow is designed to show:

* candidate matches
* confidence scores
* extracted document information
* AI recommendations when applicable

This allows human intervention only where automation is uncertain.

## Data & Backend

The project uses:

* Node.js
* PostgreSQL
* Supabase
* JavaScript
* asynchronous processing
* scheduled jobs / cron

The database stores crawler sources, processed documents, hashes, extraction information, matching results, and related metadata.

## Scale

Current system scope includes:

* **90+ Philippine government agency websites**
* **1,800+ processed government documents**
* recurring automated crawls
* agency-specific crawling and validation logic

## Engineering Challenges

The project involves real-world web automation problems including:

* Cloudflare and anti-bot protection
* inconsistent website structures
* JavaScript-rendered pages
* authentication differences between agencies
* unexpected file types and invalid downloads
* asynchronous processing failures
* document extraction failures
* inconsistent filenames and form naming
* matching uncertain or incomplete data

The system has required ongoing debugging and refinement as additional government agencies are brought into the pipeline.

## Project Status

**Active Development**

The crawler and processing pipeline are continuously being expanded as additional agencies are validated.

Current development focuses on improving:

* document extraction coverage
* matching accuracy
* confidence thresholds
* AI-assisted validation
* admin review workflows
* crawler reliability

## Technology Stack

**Backend**

* Node.js
* JavaScript

**Web Automation**

* Playwright
* Puppeteer
* Camoufox
* ScraperAPI

**Database**

* PostgreSQL
* Supabase

**Document Processing**

* pdf-parse
* Mammoth
* file signature / magic-byte validation
* hashing

**Matching & Automation**

* fuzzy matching
* confidence scoring
* AI/LLM-assisted validation
* cron scheduling

