    (3-14-2026 - 3-16-2026) – Form Downloading

    Goal
    Download PDF forms found by the crawler.

    What I Did
    - Installed axios for downloading files
    - Created downloader service
    - Implemented automatic file download
    - Installed Puppeteer

    Result
    Error ahawhahwa - Encountered bot detection errors(error 403) when downloading directly via axios server blocked automated requests

    Next Step
    Use puppeteer to be able to launch as a real browser to connect to the server


    --------------------------------------------------------------------------
    --------------------------------------------------------------------------


    (3-17-2026 - 3-18-2026) – Web Crawling and Form Discovery

    Goal
    Crawl a government agency website using puppeeteer and find + download their PDF forms automatically.

    What I Did
    - Switched from axios to puppeteer-extra with stealth plugin to bypass bot detection
    - Identified SSS (sss.gov.ph) as the first working target agency — no Cloudflare,
    direct PDF links hosted at sss.gov.ph/wp-content/uploads/
    - Successfully crawled and downloaded all 65 SSS forms

    Result
    Crawler fully working for SSS finds 65 forms, downloads all PDFs to /downloads folder.
    Confirmed that not all agencies are crawlable (e.g. AFAB uses Cloudflare + external sites).

    Next Step
    Generate a hash/fingerprint for each downloaded PDF and store it in a database,
    so the next crawl can detect which forms have changed.

    --------------------------------------------------------------------------
    --------------------------------------------------------------------------

    (3-19-2026) – PDF Hashing

    Goal
    Generate a hasher for each downloaded PDF so changes can be detected on future crawls.

    What I Did
    - Created hasher.js service that reads a PDF file and returns its hash
    - Started setting up database connection for storing hashes

    Result
    Hashing working successfully each PDF now gets a unique SHA-256 hash.

    Next Step
    Connect to database and store the hash, file name, and download date
    so the next crawl can compare and detect updated forms.

    --------------------------------------------------------------------------
    --------------------------------------------------------------------------

    (3-19-2026 - 3-21-2026) – Database Storage

    Goal
    Store downloaded form metadata and hashes in a database
    so the system can track and detect changes over time.

    What I Did
    - Set up Supabase as the database
    - Connected the crawler to Supabase
    - Stored form name, URL, and hash automatically after each download

    Result
    Forms are now being saved to Supabase after every crawl 
    name, URL, and SHA-256 hash all stored successfully.

    Next Step
    Make a scheduled crawler

    --------------------------------------------------------------------------
    --------------------------------------------------------------------------

    (3-21-2026) – Scheduled Crawling

    Goal
    Automate the crawler to run on a schedule so the system
    checks for form updates automatically without manual triggering.

    What I Did
    - Installed node-cron
    - Wrapped the crawler inside a cron schedule

    Result
    System automatically checks SSS for form updates on a set interval.

    Next Step
    waiting for instructions...

    --------------------------------------------------------------------------
    --------------------------------------------------------------------------

    (3-30-2026) – Multiple Selectors (Attempted)

    Goal
    Improve PDF detection across different sites.

    What I Did
    - Used multiple hardcoded selectors for PDF links

    Result
    Not scalable breaks when websites change, requires constant updates.

    Next Step
    Find a more flexible approach.

    --------------------------------------------------------------------------
    --------------------------------------------------------------------------

    (4-05-2026) – AI-Based Extraction (Groq) (Attempted)

    Goal
    Use AI to dynamically detect PDF links.

    What I Did
    - Integrated Groq for AI-based parsing

    Result
    Not viable hit token limits quickly and not scalable for ~80 sites.

    Next Step
    Remove AI and simplify the crawler.

    --------------------------------------------------------------------------
    --------------------------------------------------------------------------

    (4-22-2026) – Final Crawler + System Integration

    Goal
    Build a scalable and working system without AI.

    What I Did
    - Extracted all `.pdf` links using simple filtering
    - Built Express API (`/crawl`)
    - Created frontend UI
    - Implemented async job polling (`/status/:jobId`)
    - Fixed env + database issues

    Result
    Fully working system:
    - Crawls, downloads, hashes, and stores PDFs
    - Frontend successfully triggers and tracks crawling

    Next Step
    - Still thinking...